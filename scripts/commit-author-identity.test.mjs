import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertIdentityRuleset, assertRegularGitFile } from "./audit-commit-author-identity.mjs";

const workflow = await readFile(".github/workflows/commit-author-identity-check.yml", "utf8");
const source = workflow.split("          script: |\n")[1].split("\n").map(line => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const policy = JSON.parse(await readFile("governance/commit-author-identity.json", "utf8"));
const template = await readFile("scripts/fixtures/commit-author-identity-caller.yml", "utf8");
const base = "a".repeat(40), head = "b".repeat(40), central = "c".repeat(40);
const human = { login: "777genius", type: "User" };
const commit = (author = human, name = "iliya", email = "iliyazelenkog@gmail.com", sha = head) => ({
  sha, author, commit: { author: { name, email }, committer: { name: "GitHub", email: "noreply@github.com" } },
  committer: { login: "web-flow", type: "User" },
});
const clone = value => structuredClone(value);
function fixture() {
  const repository = { id: 10, full_name: "agent-teams-ai/example", default_branch: "main" };
  const pull = { id: 20, number: 7, state: "open", merged: false, user: human, commits: 1,
    base: { sha: base, ref: "main", repo: repository },
    head: { sha: head, repo: { id: 30, full_name: "contributor/fork" } } };
  return { repository, pull, commits: [commit()], policy: clone(policy), template,
    baseCaller: template.replace("CENTRAL_REVISION", central),
    headCaller: template.replace("CENTRAL_REVISION", central), statuses: [], failures: [], pullReads: 0 };
}
async function run(f) {
  const unavailable = stage => { if (f.unavailable === stage) throw new Error(`Transport unavailable: ${stage}`); };
  const github = { rest: { pulls: {
    get: async () => { unavailable(++f.pullReads === 1 ? "pull" : "refresh"); return { data: clone(f.pullReads === 1 ? f.pull : f.latePull ?? f.pull) }; },
    listCommits: "commits", list: "open",
  }, repos: {
    get: async () => { unavailable("repository"); return { data: f.repository }; },
    getBranch: async () => { unavailable("central"); return { data: { commit: { sha: central } } }; },
    getContent: async ({ path, ref }) => {
      unavailable(path);
      let text = path === "governance/commit-author-identity.json" ? JSON.stringify(f.policy) :
        path === "scripts/fixtures/commit-author-identity-caller.yml" ? f.template :
        path === ".github/workflows/commit-author-identity-check.yml" ? workflow : ref === base ? f.baseCaller : f.headCaller;
      if (f.contentOverride) text = f.contentOverride(path, ref, text);
      if (text === null) throw new Error("404 missing caller");
      return { data: { type: "file", encoding: "base64", sha: createHash("sha1").update(text).digest("hex"), content: Buffer.from(text).toString("base64") } };
    },
    createCommitStatus: async value => { unavailable(value.state); f.statuses.push(value); },
  }, git: { getTree: async ({ tree_sha }) => {
    unavailable("git");
    const values = { "governance/commit-author-identity.json": JSON.stringify(f.policy), "scripts/fixtures/commit-author-identity-caller.yml": f.template,
      ".github/workflows/commit-author-identity-check.yml": workflow, ".github/workflows/commit-author-identity.yml": tree_sha === base ? f.baseCaller : f.headCaller };
    const tree = Object.entries(values).filter(([, value]) => value !== null).map(([path, value]) => ({ path, type: "blob", mode: tree_sha === head ? f.gitMode ?? "100644" : "100644", sha: createHash("sha1").update(value).digest("hex") }));
    return { data: { truncated: f.gitTruncated ?? false, tree } };
  } } }, paginate: async (method, parameters) => {
    unavailable(method); assert.equal(parameters.per_page, 100); return method === "open" ? f.open ?? [f.pull] : f.commits;
  } };
  const context = { repo: { owner: "agent-teams-ai", repo: f.repository.full_name.split("/")[1] }, eventName: f.event ?? "pull_request_target",
    payload: { pull_request: { number: 7, head: { sha: "e".repeat(40) }, user: human } } };
  await execute(context, github, { setFailed: value => f.failures.push(value), warning: () => {} });
  return f;
}
const states = f => f.statuses.map(value => value.state);
async function rejected(mutate) {
  const f = fixture(); mutate(f); await run(f);
  assert.ok(f.failures.length > 0); assert.ok(!states(f).includes("success"));
  if (states(f).includes("pending")) assert.equal(states(f).at(-1), "failure");
  return f;
}
test("owner and external humans pass on the independent exact head; GitHub committer is allowed", async () => {
  for (const [user, commits] of [
    [human, [commit()]],
    [{ login: "alice", type: "User" }, [commit({ login: "alice", type: "User" }, "Alice", "alice@example.org")]],
    [{ login: "alice", type: "User" }, [commit(null, "Alice", "alice@example.org")]],
    [{ login: "alice", type: "User" }, [commit({ login: "alice", type: "User" }, "iliya", "alice@example.org")]],
  ]) {
    const f = fixture(); f.pull.user = user; f.commits = commits; await run(f);
    assert.deepEqual(f.failures, []); assert.deepEqual(states(f), ["pending", "success"]);
    assert.ok(f.statuses.every(value => value.sha === head && value.context === "commit-author-identity"));
    assert.equal(f.pullReads, 2);
  }
});
test("central local caller uses trusted base workflow; same-head Bot PR cannot borrow human success", async () => {
  const f = fixture(); f.repository.full_name = "agent-teams-ai/.github";
  f.baseCaller = f.headCaller = await readFile(".github/workflows/commit-author-identity.yml", "utf8");
  await run(f); assert.deepEqual(f.failures, []);
  f.statuses = []; f.failures = []; f.pullReads = 0;
  f.contentOverride = (path, ref, text) => path.endsWith("identity-check.yml") && ref === head ? text + " " : text;
  await run(f); assert.ok(f.failures.length > 0); assert.deepEqual(states(f), ["pending", "failure"]);
  await rejected(value => { value.open = [value.pull, { ...value.pull, number: 8, user: { type: "Bot", login: "renovate" } }]; });
});
test("rejects Bot PR authors with owner commits, and bot/GitHub commit authors", async () => {
  for (const login of ["github-actions[bot]", "dependabot[bot]", "renovate"]) {
    await rejected(f => { f.pull.user = { login, type: "Bot" }; });
    await rejected(f => { f.commits = [commit({ login, type: "Bot" })]; });
  }
  for (const [author, name, email] of [
    [null, "github-actions[bot]", "41898282+github-actions[bot]@users.noreply.github.com"],
    [null, "dependabot[bot]", "49699333+dependabot[bot]@users.noreply.github.com"],
    [null, "GitHub", "noreply@github.com"], [null, " GitHub ", "noreply@github.com "], [null, "Alice", "NOREPLY@GITHUB.COM"],
    [{ login: "web-flow", type: "User" }, "Alice", "alice@example.org"],
    [human, "iliya", "wrong@example.org"], [null, "iliya", "wrong@example.org"],
    [human, "wrong", "iliyazelenkog@gmail.com"],
  ]) await rejected(f => { f.commits = [commit(author, name, email)]; });
});
test("complete pagination checks every commit including earlier bots", async () => {
  const f = fixture(); f.commits = Array.from({ length: 101 }, (_, i) => commit(human, "iliya", "iliyazelenkog@gmail.com", (i + 1).toString(16).padStart(40, "0")));
  f.commits.at(-1).sha = head; f.pull.commits = 101; await run(f); assert.deepEqual(f.failures, []);
  await rejected(value => { value.pull.commits = 2; value.commits = [commit(null, "dependabot[bot]", "bot@example.org", central), commit()]; });
  for (const mutate of [
    f => { f.pull.commits = 2; }, f => { f.pull.commits = 251; }, f => { f.commits[0].sha = central; },
    f => { f.pull.commits = 2; f.commits.push(commit()); }, f => { f.commits = []; },
    f => { f.commits[0].commit.author = null; }, f => { f.commits[0].author = undefined; },
  ]) await rejected(mutate);
});
test("rejects absent, deleted, broken, filtered, unpinned or changed caller", async () => {
  for (const mutate of [
    f => { f.headCaller = null; }, f => { f.baseCaller = null; },
    f => { f.headCaller = f.headCaller.replace("statuses: write", "statuses: read"); },
    f => { f.baseCaller = f.headCaller = f.baseCaller.replace("pull_request_target:", "pull_request:"); },
    f => { f.baseCaller = f.headCaller = f.baseCaller.replace(central, "main"); },
    f => { f.baseCaller = f.headCaller = f.baseCaller.replace(central, "0".repeat(40)); },
    f => { f.baseCaller = f.headCaller = f.baseCaller.replace("synchronize, ", ""); },
  ]) await rejected(mutate);
});
test("head/base/user/count movement and API/status transport failure cannot pass", async () => {
  for (const mutate of [
    f => { f.latePull = clone(f.pull); f.latePull.head.sha = central; },
    f => { f.latePull = clone(f.pull); f.latePull.base.sha = central; },
    f => { f.latePull = clone(f.pull); f.latePull.user = { login: "dependabot[bot]", type: "Bot" }; },
    f => { f.latePull = clone(f.pull); f.latePull.commits = 2; },
    f => { f.pull.base.ref = "topic"; }, f => { f.pull.state = "closed"; },
    f => { f.event = "pull_request"; }, f => { f.policy.owner = {}; },
  ]) await rejected(mutate);
  for (const stage of ["pull", "refresh", "repository", "central", "git", "commits", "open", "success", "pending",
    "governance/commit-author-identity.json", "scripts/fixtures/commit-author-identity-caller.yml", ".github/workflows/commit-author-identity.yml"]) {
    const f = fixture(); f.unavailable = stage; await run(f);
    assert.ok(f.failures.length > 0); assert.ok(!states(f).includes("success"));
  }
});
test("late policy/template drift and failure-status write error fail closed", async () => {
  for (const path of ["governance/commit-author-identity.json", "scripts/fixtures/commit-author-identity-caller.yml"]) {
    let reads = 0;
    await rejected(f => { f.contentOverride = (currentPath, ref, text) => currentPath === path && ++reads === 2 ? text + " " : text; });
  }
  const f = fixture(); f.pull.user = { type: "Bot", login: "renovate" }; f.unavailable = "failure";
  await run(f); assert.ok(f.failures.length > 0); assert.deepEqual(states(f), ["pending"]);
});
test("audit rejects missing/inactive/bypassed/mismatched default-branch required status rules", () => {
  const rule = { name: "Commit author identity", target: "branch", enforcement: "active", bypass_actors: [],
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [{ type: "required_status_checks", parameters: { strict_required_status_checks_policy: true,
      required_status_checks: [{ context: "commit-author-identity", integration_id: 15368 }] } }] };
  assertIdentityRuleset(rule, policy.ruleset);
  for (const mutate of [
    f => { f.enforcement = "disabled"; }, f => { f.bypass_actors = [{ actor_id: 1 }]; },
    f => { f.conditions.ref_name.include = ["~ALL"]; }, f => { f.rules = []; },
    f => { f.rules[0].parameters.required_status_checks[0].context = "other"; },
    f => { f.rules[0].parameters.required_status_checks[0].integration_id = null; },
    f => { f.rules[0].parameters.strict_required_status_checks_policy = false; },
  ]) { const changed = clone(rule); mutate(changed); assert.throws(() => assertIdentityRuleset(changed, policy.ruleset)); }
  assert.throws(() => assertIdentityRuleset(null, policy.ruleset));
});

test("rejects symlink/submodule callers and incomplete Git trees even if Contents resolves identical bytes", async () => {
  const regular = fixture(); regular.gitMode = "100755"; await run(regular); assert.deepEqual(regular.failures, []);
  for (const mode of ["120000", "160000", "040000"]) await rejected(f => { f.gitMode = mode; });
  await rejected(f => { f.gitTruncated = true; });
  const entry = { path: "caller.yml", type: "blob", mode: "100644", sha: head };
  assertRegularGitFile({ truncated: false, tree: [entry] }, "caller.yml", { sha: head });
  for (const tree of [{ truncated: true, tree: [entry] }, { truncated: false, tree: [entry, entry] }, { truncated: false, tree: [{ ...entry, mode: "120000" }] }])
    assert.throws(() => assertRegularGitFile(tree, "caller.yml", { sha: head }));
  assert.throws(() => assertRegularGitFile({ truncated: false, tree: [entry] }, "caller.yml", { sha: base }));
});
