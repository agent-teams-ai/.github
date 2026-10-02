import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const mergeCli = fileURLToPath(new URL("./merge-owner-pr.mjs", import.meta.url));
const auditCli = fileURLToPath(new URL("./audit-commit-author-identity.mjs", import.meta.url));
const repository = "agent-teams-ai/TEST", head = "b".repeat(40), mergedSha = "d".repeat(40);
const owner = { login: "777genius", type: "User" }, email = "iliyazelenkog@gmail.com";
const subject = "fix(identity): preserve #329 and $(literal)";
const body = "Fixes #329\r\nRefs agent-teams-ai/.github#12\nUnicode: café; literal $(command)\n\n";

// Disposable IO transport: only returns fixture API data, logs argv/body bytes,
// and records the simulated merge effect. All assertions live in the tests.
function fakeTransport() {
  const fs = require("node:fs");
  const config = JSON.parse(fs.readFileSync(process.env.FAKE_GH_SCENARIO, "utf8"));
  const args = process.argv.slice(2);
  const call = { args };
  if (args[0] === "pr" && args[1] === "merge") {
    call.bodyHex = fs.readFileSync(args[args.indexOf("--body-file") + 1]).toString("hex");
  }
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(call) + "\n");
  if (args[0] === "pr" && args[1] === "merge") {
    if (!config.mergeExit || config.mergeEffectBeforeFailure) fs.writeFileSync(process.env.FAKE_GH_EFFECT, "merged");
    if (config.mergeExit) { process.stderr.write("merge transport failed\n"); process.exit(config.mergeExit); }
    process.stdout.write("Merged (transport response alone is insufficient)\n");
    return;
  }
  if (args[0] === "api") {
    const endpoint = args.at(-1);
    if (config.failEndpoint === endpoint) { process.stderr.write("API transport failed\n"); process.exit(1); }
    if (config.overwriteBody && endpoint.includes("/pulls/")) fs.writeFileSync(config.overwriteBody, "changed after inspection");
    if (config.invalidJson === endpoint) { process.stdout.write("not JSON"); return; }
    const responses = fs.existsSync(process.env.FAKE_GH_EFFECT) ? { ...config.responses, ...config.after } : config.responses;
    if (Object.hasOwn(responses, endpoint)) {
      process.stdout.write(JSON.stringify(args.includes("--slurp") ? [responses[endpoint]] : responses[endpoint]));
      return;
    }
  }
  process.stderr.write("Unexpected fake-gh request: " + JSON.stringify(args) + "\n");
  process.exit(2);
}

function transport(t, scenario) {
  const directory = mkdtempSync(path.join(tmpdir(), "owner-merge-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const config = path.join(directory, "scenario.json"), log = path.join(directory, "calls.jsonl");
  const bodyFile = path.join(directory, "reviewed body.txt"), effect = path.join(directory, "effect");
  writeFileSync(path.join(directory, "gh"), "#!" + process.execPath + "\n(" + fakeTransport.toString() + ")();\n", { mode: 0o700 });
  writeFileSync(config, JSON.stringify(scenario));
  writeFileSync(log, "");
  writeFileSync(bodyFile, body);
  const env = { ...process.env, PATH: directory + path.delimiter + process.env.PATH, TMPDIR: directory,
    FAKE_GH_SCENARIO: config, FAKE_GH_LOG: log, FAKE_GH_EFFECT: effect };
  return {
    bodyFile, effect,
    setScenario: value => writeFileSync(config, JSON.stringify(value)),
    trace: () => readFileSync(log, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line)),
    run: (args = [], cli = mergeCli) => spawnSync(process.execPath, [cli, ...args], { cwd: directory, env, encoding: "utf8", timeout: 10_000 }),
  };
}

const pullEndpoint = "repos/" + repository + "/pulls/13";
const commitEndpoint = "repos/" + repository + "/commits/" + mergedSha;
const statusEndpoint = "repos/" + repository + "/commits/" + head + "/status";
function ownerScenario() {
  const pull = { number: 13, state: "open", merged: false, user: owner, head: { sha: head },
    base: { repo: { full_name: repository } }, body };
  return { responses: { user: owner, [pullEndpoint]: pull,
    // Realistic counterexample: a cached owner-PR #12 status shares PR #13's head.
    [statusEndpoint]: { sha: head, state: "success", statuses: [{ context: "commit-author-identity", state: "success" }] },
    ["repos/" + repository + "/pulls/12"]: { ...pull, number: 12 } },
  after: { [pullEndpoint]: { ...structuredClone(pull), state: "closed", merged: true, merge_commit_sha: mergedSha },
    [commitEndpoint]: { sha: mergedSha, author: owner, committer: { login: "web-flow", type: "User" },
      commit: { author: { name: "Iliya Zelenko", email }, committer: { name: "GitHub", email: "noreply@github.com" },
        message: subject + "\n\n" + body } } } };
}
const argsFor = fake => ["--repository", repository, "--pr", "13", "--expected-head", head, "--subject", subject, "--body-file", fake.bodyFile];
const merges = trace => trace.filter(call => call.args[0] === "pr");
function failed(result, expression) {
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "", "No unverified success may be printed");
  assert.match(result.stderr, expression);
}

test("Bot PR sharing cached-green owner head is rejected before any merge effect", t => {
  const scenario = ownerScenario();
  scenario.responses[pullEndpoint].user = { login: "github-actions[bot]", type: "Bot" };
  assert.equal(scenario.responses[statusEndpoint].state, "success");
  assert.equal(scenario.responses["repos/" + repository + "/pulls/12"].head.sha, scenario.responses[pullEndpoint].head.sha);
  const fake = transport(t, scenario);
  failed(fake.run(argsFor(fake)), /Bot PR refused.*cached green.*Never reopen/u);
  assert.equal(merges(fake.trace()).length, 0);
  assert.throws(() => readFileSync(fake.effect));
});

test("owner CLI uses exact explicit squash identity/head/message and independently verifies final commit", t => {
  const scenario = ownerScenario(), fake = transport(t, scenario);
  // Input changes during API IO cannot change the bytes supplied to gh.
  scenario.overwriteBody = fake.bodyFile; fake.setScenario(scenario);
  const result = fake.run(argsFor(fake));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { repository, pr: 13, head, merge_commit: mergedSha, verified: true });
  const trace = fake.trace(), call = merges(trace)[0], frozenBody = call.args.at(-1);
  assert.equal(merges(trace).length, 1);
  assert.deepEqual(call.args, ["pr", "merge", "13", "--repo", repository, "--squash", "--author-email", email,
    "--match-head-commit", head, "--subject", subject, "--body-file", frozenBody]);
  assert.notEqual(frozenBody, fake.bodyFile);
  assert.equal(call.bodyHex, Buffer.from(body).toString("hex"), "All refs, CRLF, Unicode and trailing LF survive transport");
  const apiArgs = ["api", "--hostname", "github.com", "--method", "GET"];
  assert.deepEqual(trace.filter(value => value !== call).map(value => value.args),
    [apiArgs.concat("user"), apiArgs.concat(pullEndpoint), apiArgs.concat(pullEndpoint), apiArgs.concat(commitEndpoint)]);
});

test("argument mistakes and unreadable/invalid UTF-8 body fail before gh is invoked", t => {
  const fake = transport(t, ownerScenario()), valid = argsFor(fake);
  const replaced = (flag, value) => valid.map((argument, index) => valid[index - 1] === flag ? value : argument);
  for (const args of [[], valid.concat("--auto"), valid.concat("--pr", "14"), valid.slice(0, -1),
    replaced("--repository", "../TEST"), replaced("--pr", "0"), replaced("--pr", "9007199254740992"),
    replaced("--expected-head", "0".repeat(40)), replaced("--expected-head", "main"),
    replaced("--subject", "Version Packages"), replaced("--subject", "fix: newline\ninjection"),
    replaced("--subject", "fix(scope\u2028name): unexpected line separator"),
    replaced("--body-file", fake.bodyFile + ".missing")]) {
    failed(fake.run(args), /Usage|Repository|PR must|Expected head|Subject|ENOENT/u);
  }
  writeFileSync(fake.bodyFile, Buffer.from([0xff]));
  failed(fake.run(valid), /valid UTF-8/u);
  assert.deepEqual(fake.trace(), []);
});

test("wrong auth, stale head, closed PR and unknown author cannot invoke merge", t => {
  for (const [mutate, expression] of [
    [scenario => { scenario.responses.user = { login: "alice", type: "User" }; }, /Authenticated gh user/u],
    [scenario => { scenario.responses.user = { login: "777genius", type: "Bot" }; }, /Authenticated gh user/u],
    [scenario => { scenario.responses[pullEndpoint].head.sha = "c".repeat(40); }, /Stale or unexpected PR head/u],
    [scenario => { scenario.responses[pullEndpoint].state = "closed"; }, /open and unmerged/u],
    [scenario => { scenario.responses[pullEndpoint].user = null; }, /PR author must/u],
    [scenario => { scenario.responses[pullEndpoint].base.repo.full_name = "agent-teams-ai/other"; }, /Unexpected PR repository/u],
  ]) {
    const scenario = ownerScenario(); mutate(scenario);
    const fake = transport(t, scenario);
    failed(fake.run(argsFor(fake)), expression);
    assert.equal(merges(fake.trace()).length, 0);
  }
});

test("external human PR keeps its existing PR/authorship and receives preservation guidance without modification", t => {
  const scenario = ownerScenario();
  scenario.responses[pullEndpoint].user = { login: "alice", type: "User" };
  const fake = transport(t, scenario);
  failed(fake.run(argsFor(fake)), /Preserve the contributor's existing PR and authorship.*contributor-preserving flow.*never use owner squash/u);
  assert.equal(merges(fake.trace()).length, 0);
  assert.throws(() => readFileSync(fake.effect));
});

test("post-merge PR/commit, account, email or message drift fails with reconciliation guidance and no rewrite", t => {
  for (const [mutate, expression] of [
    [scenario => { scenario.after[pullEndpoint].merged = false; }, /not verifiably merged/u],
    [scenario => { scenario.after[pullEndpoint].head.sha = "c".repeat(40); }, /unexpected PR head/u],
    [scenario => { scenario.after[pullEndpoint].user = { login: "robot", type: "Bot" }; }, /Bot PR refused/u],
    [scenario => { scenario.after[commitEndpoint].sha = head; }, /Unexpected final commit SHA/u],
    [scenario => { scenario.after[commitEndpoint].author = { login: "alice", type: "User" }; }, /Final commit author account/u],
    [scenario => { scenario.after[commitEndpoint].author = null; }, /Final commit author account/u],
    [scenario => { scenario.after[commitEndpoint].commit.author.email = "wrong@example.org"; }, /Final commit author email/u],
    [scenario => { scenario.after[commitEndpoint].commit.message = subject + "\n\nlost references"; }, /message\/body bytes or issue references/u],
    [scenario => { scenario.after[commitEndpoint].commit.message = subject + "\n\n" + body.trim(); }, /message\/body bytes or issue references/u],
    [scenario => { scenario.after[commitEndpoint].commit.message = "chore: unexpected subject\n\n" + body; }, /message\/body bytes or issue references/u],
    [scenario => { scenario.failEndpoint = commitEndpoint; }, /API transport failed/u],
  ]) {
    const scenario = ownerScenario(); mutate(scenario);
    const fake = transport(t, scenario);
    const result = fake.run(argsFor(fake));
    failed(result, expression);
    assert.match(result.stderr, /no verified success.*never rewrite history/u);
    const trace = fake.trace();
    assert.equal(merges(trace).length, 1);
    assert.ok(trace.every(call => call.args[0] === "pr" || (call.args[0] === "api" && call.args.includes("GET"))), "No rewrite or protection mutation");
  }
});

test("gh failures and invalid API data never fabricate success or retry an uncertain merge", t => {
  for (const change of [{ failEndpoint: "user" }, { invalidJson: pullEndpoint },
    { mergeExit: 1 }, { mergeExit: 1, mergeEffectBeforeFailure: true }]) {
    const fake = transport(t, { ...ownerScenario(), ...change });
    const result = fake.run(argsFor(fake));
    failed(result, /API transport failed|JSON|merge transport failed/u);
    assert.equal(merges(fake.trace()).length, change.mergeExit ? 1 : 0);
    if (change.mergeExit) assert.match(result.stderr, /Merge attempted; no verified success/u);
  }
});

function auditScenario() {
  const policy = JSON.parse(readFileSync(new URL("../governance/commit-author-identity.json", import.meta.url), "utf8"));
  const template = readFileSync(new URL("./fixtures/commit-author-identity-caller.yml", import.meta.url), "utf8");
  const implementation = readFileSync(new URL("../.github/workflows/commit-author-identity-check.yml", import.meta.url), "utf8");
  const pin = "c".repeat(40), blob = "e".repeat(40), permissions = { can_approve_pull_request_reviews: false, default_workflow_permissions: "read" };
  const repos = ["first", "second", "archived"].map((name, index) => ({ id: index + 1, name, full_name: "agent-teams-ai/" + name,
    owner: { login: "agent-teams-ai" }, default_branch: "main", archived: name === "archived" }));
  const scenario = { responses: { "orgs/agent-teams-ai/repos?type=all&per_page=100": repos,
    "orgs/agent-teams-ai/actions/permissions/workflow": permissions } };
  const file = text => ({ type: "file", encoding: "base64", sha: blob, content: Buffer.from(text).toString("base64") });
  const tree = name => ({ truncated: false, tree: [{ path: ".github/workflows/" + name, type: "blob", mode: "100644", sha: blob }] });
  for (const repo of repos.filter(value => !value.archived)) {
    const root = "repos/" + repo.full_name;
    Object.assign(scenario.responses, {
      [root]: repo, [root + "/actions/permissions/workflow"]: permissions,
      [root + "/rulesets?includes_parents=true&per_page=100"]: [{ id: 100, name: "Commit author identity" }],
      [root + "/rulesets/100"]: policy.ruleset, [root + "/branches/main"]: { commit: { sha: head } },
      [root + "/contents/.github/workflows/commit-author-identity.yml?ref=" + head]: file(template.replace("CENTRAL_REVISION", pin)),
      [root + "/git/trees/" + head + "?recursive=true"]: tree("commit-author-identity.yml"),
    });
  }
  scenario.responses["repos/agent-teams-ai/.github/contents/.github/workflows/commit-author-identity-check.yml?ref=" + pin] = file(implementation);
  scenario.responses["repos/agent-teams-ai/.github/git/trees/" + pin + "?recursive=true"] = tree("commit-author-identity-check.yml");
  return scenario;
}
const permissionEndpoints = ["orgs/agent-teams-ai/actions/permissions/workflow",
  "repos/agent-teams-ai/first/actions/permissions/workflow", "repos/agent-teams-ai/second/actions/permissions/workflow"];

test("audit reads actual org default and every active repository's workflow permissions while retaining identity gates", t => {
  const fake = transport(t, auditScenario()), result = fake.run([], auditCli);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.organization.actions_workflow_permissions.can_approve_pull_request_reviews, false);
  assert.equal(report.visible_active_repositories, 2);
  assert.ok(report.results.every(value => !value.error && value.actions_workflow_permissions.can_approve_pull_request_reviews === false));
  const trace = fake.trace();
  assert.deepEqual(trace.map(call => call.args.at(-1)).filter(endpoint => endpoint.endsWith("/actions/permissions/workflow")), permissionEndpoints);
  assert.ok(trace.every(call => call.args[0] === "api" && call.args.includes("GET")));
  for (const mutate of [
    scenario => { scenario.responses["repos/agent-teams-ai/first/rulesets/100"].enforcement = "disabled"; },
    scenario => { scenario.responses["repos/agent-teams-ai/first/contents/.github/workflows/commit-author-identity.yml?ref=" + head].content = Buffer.from("broken caller").toString("base64"); },
    scenario => { scenario.responses["repos/agent-teams-ai/.github/git/trees/" + "c".repeat(40) + "?recursive=true"].tree[0].mode = "120000"; },
  ]) {
    const scenario = auditScenario(); mutate(scenario);
    const negative = transport(t, scenario).run([], auditCli);
    assert.equal(negative.status, 1);
    assert.ok(JSON.parse(negative.stdout).results.some(value => value.error));
  }
});

test("audit rejects true, missing, unknown or inaccessible permission at org or either current repository", t => {
  for (const endpoint of permissionEndpoints) {
    for (const observed of [true, undefined, null, "false"]) {
      const scenario = auditScenario();
      scenario.responses[endpoint] = observed === undefined ? {} : { can_approve_pull_request_reviews: observed };
      const fake = transport(t, scenario), result = fake.run([], auditCli);
      assert.equal(result.status, 1, result.stderr);
      const report = JSON.parse(result.stdout);
      const failures = [report.organization, ...report.results].filter(value => value.error);
      assert.equal(failures.length, 1);
      assert.match(failures[0].error, /must be explicitly false/u);
      assert.deepEqual(fake.trace().map(call => call.args.at(-1)).filter(value => value.endsWith("/actions/permissions/workflow")), permissionEndpoints);
    }
    const scenario = auditScenario(); scenario.failEndpoint = endpoint;
    const result = transport(t, scenario).run([], auditCli);
    assert.equal(result.status, 1);
    assert.ok([JSON.parse(result.stdout).organization, ...JSON.parse(result.stdout).results].some(value => value.error));
  }
});
