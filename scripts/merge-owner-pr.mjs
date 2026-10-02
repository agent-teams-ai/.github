import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const usage = "Usage: node scripts/merge-owner-pr.mjs --repository OWNER/REPO --pr NUMBER --expected-head SHA --subject 'fix: description' --body-file PATH";
const isSha = value => typeof value === "string" && /^(?!0{40}$)[0-9a-f]{40}$/u.test(value);
// GitHub omits terminal line endings in the squash message; interior bytes stay exact.
const messageWithoutTerminalNewlines = value => value.replace(/(?:\r?\n)+$/u, "");

function inputs(argv) {
  const flags = ["--repository", "--pr", "--expected-head", "--subject", "--body-file"];
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index], value = argv[index + 1];
    assert.ok(flags.includes(flag) && !Object.hasOwn(values, flag) &&
      typeof value === "string" && value.length > 0 && !value.startsWith("--") && !value.includes("\0"), usage);
    values[flag] = value;
  }
  assert.ok(flags.every(flag => Object.hasOwn(values, flag)), usage);
  const repository = values["--repository"], pr = values["--pr"], head = values["--expected-head"], subject = values["--subject"];
  assert.match(repository, /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/u, "Repository must be OWNER/REPO");
  assert.ok(![".", ".."].includes(repository.split("/")[1]), "Invalid repository name");
  assert.ok(/^[1-9][0-9]*$/u.test(pr) && Number.isSafeInteger(Number(pr)), "PR must be a positive safe integer");
  assert.ok(isSha(head), "Expected head must be an exact nonzero lowercase 40-hex SHA");
  assert.ok(subject === subject.trim() && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(subject) &&
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^()]+\))?!?: \S.*$/u.test(subject), "Subject must be one ordinary Conventional Commit line");
  return { repository, pr, head, subject, bodyFile: path.resolve(values["--body-file"]) };
}

const gh = args => execFileSync("gh", args, { encoding: "utf8", timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
  env: { ...process.env, GH_HOST: "github.com" } });
const api = endpoint => JSON.parse(gh(["api", "--hostname", "github.com", "--method", "GET", endpoint]));

function ownerPull(pull, options, owner) {
  if (pull.user?.type === "Bot") {
    throw new Error("Bot PR refused even if its SHA has cached green checks. Never reopen or merge Bot staging PRs; the owner must open a fresh PR after inspecting the generated branch.");
  }
  if (pull.user?.type === "User" && pull.user.login !== owner.login) {
    throw new Error("External human PR refused. Preserve the contributor's existing PR and authorship using the contributor-preserving flow; never use owner squash or replace their PR.");
  }
  assert.ok(pull.user?.type === "User" && pull.user.login === owner.login, "PR author must be User/777genius");
  assert.equal(pull.number, Number(options.pr), "Unexpected PR number");
  assert.equal(pull.base?.repo?.full_name, options.repository, "Unexpected PR repository");
  assert.equal(pull.head?.sha, options.head, "Stale or unexpected PR head; inspect the current diff before retrying");
}

async function mergeOwnerPull() {
  const options = inputs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(new URL("../governance/commit-author-identity.json", import.meta.url), "utf8"));
  const owner = policy.owner;
  assert.equal(owner?.login, "777genius", "Canonical policy must identify the human owner");
  assert.ok(typeof owner.email === "string" && /^[^\s@]+@[^\s@]+$/u.test(owner.email), "Invalid canonical owner email");
  const bytes = await readFile(options.bodyFile);
  const body = bytes.toString("utf8");
  assert.ok(Buffer.from(body, "utf8").equals(bytes) && !body.includes("\0"), "Body file must be valid UTF-8 without NUL; bytes will not be normalized");
  const expectedMessage = body.length === 0 ? options.subject : `${options.subject}\n\n${body}`;
  const temporary = await mkdtemp(path.join(tmpdir(), "merge-owner-pr-"));
  let attempted = false;
  try {
    // Freeze the supplied bytes before any network IO; gh reads this exact copy.
    const frozenBody = path.join(temporary, "body.txt");
    await writeFile(frozenBody, bytes, { mode: 0o600 });
    const authenticated = api("user");
    assert.ok(authenticated.type === "User" && authenticated.login === owner.login, "Authenticated gh user must be User/777genius");
    const root = `repos/${options.repository}`, endpoint = `${root}/pulls/${options.pr}`;
    const before = api(endpoint);
    ownerPull(before, options, owner);
    assert.ok(before.state === "open" && before.merged === false, "PR must be open and unmerged");
    attempted = true;
    gh(["pr", "merge", options.pr, "--repo", options.repository, "--squash", "--author-email", owner.email,
      "--match-head-commit", options.head, "--subject", options.subject, "--body-file", frozenBody]);
    // A successful gh exit is not proof: independently resolve the PR and final commit.
    const after = api(endpoint);
    ownerPull(after, options, owner);
    assert.ok(after.merged === true && after.state === "closed" && isSha(after.merge_commit_sha), "PR is not verifiably merged");
    const final = api(`${root}/commits/${after.merge_commit_sha}`);
    assert.equal(final.sha, after.merge_commit_sha, "Unexpected final commit SHA");
    assert.ok(final.author?.type === "User" && final.author.login === owner.login, "Final commit author account must be User/777genius");
    assert.equal(final.commit?.author?.email, owner.email, "Final commit author email differs from canonical owner policy");
    const committer = final.commit?.committer;
    const githubCommitter = final.committer?.type === "User" && final.committer.login === "web-flow" &&
      committer?.name === "GitHub" && committer.email === "noreply@github.com";
    const ownerCommitter = final.committer?.type === "User" && final.committer.login === owner.login &&
      committer?.name === "iliya" && committer.email === owner.email;
    assert.ok(githubCommitter || ownerCommitter, "Final commit committer must be the exact owner or GitHub web-flow identity");
    assert.equal(typeof final.commit?.message, "string", "Final commit message is missing");
    assert.equal(messageWithoutTerminalNewlines(final.commit.message), messageWithoutTerminalNewlines(expectedMessage),
      "Final commit message/body bytes or issue references differ from the supplied message");
    return { repository: options.repository, pr: Number(options.pr), head: options.head, merge_commit: final.sha, verified: true };
  } catch (error) {
    if (attempted) {
      throw new Error(`Merge attempted; no verified success. Inspect the actual PR/commit before any retry; never rewrite history. ${error.message}`);
    }
    throw error;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

try {
  process.stdout.write(`${JSON.stringify(await mergeOwnerPull())}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
