import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertActionsWorkflowPermissions, assertIdentityRuleset, assertRegularGitFile } from "./audit-commit-author-identity.mjs";

const workflow = await readFile(".github/workflows/commit-author-identity-check.yml", "utf8");
const source = workflow.split("          script: |\n")[1].split("\n").map(line => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const policy = JSON.parse(await readFile("governance/commit-author-identity.json", "utf8"));
const template = await readFile("scripts/fixtures/commit-author-identity-caller.yml", "utf8");
const base = "a".repeat(40), head = "b".repeat(40), central = "c".repeat(40);
const human = { login: "777genius", type: "User" };
const commit = (author = human, name = "iliya", email = "iliyazelenkog@gmail.com", sha = head) => ({
  sha, author, commit: { author: { name, email }, committer: { name: "iliya", email: "iliyazelenkog@gmail.com" } },
  committer: human,
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
  f.operations = [];
  const unavailable = stage => { f.operations.push(stage); if (f.unavailable === stage) throw new Error(`Transport unavailable: ${stage}`); };
  const target = ref => Object.hasOwn(f.targets ?? {}, ref) ? f.targets[ref] : workflow;
  const github = { rest: { pulls: {
    get: async () => { unavailable(++f.pullReads === 1 ? "pull" : "refresh"); return { data: clone(f.pullReads === 1 ? f.pull : f.latePull ?? f.pull) }; },
    listCommits: "commits", list: "open",
  }, repos: {
    get: async () => { unavailable("repository"); await f.onRepositoryRead?.(++f.repositoryReads); return { data: f.repository }; },
    getBranch: async () => { unavailable("central"); return { data: { commit: { sha: ++f.branchReads === 1 ? central : f.lateCentral ?? central } } }; },
    getContent: async ({ path, ref }) => {
      unavailable(path);
      let text = path === "governance/commit-author-identity.json" ? JSON.stringify(f.policy) :
        path === "scripts/fixtures/commit-author-identity-caller.yml" ? f.template :
        path === ".github/workflows/commit-author-identity-check.yml" ? target(ref) : ref === base ? f.baseCaller : f.headCaller;
      if (f.contentOverride) text = f.contentOverride(path, ref, text);
      if (text === null) throw new Error("404 missing caller");
      return { data: { type: "file", encoding: "base64", sha: createHash("sha1").update(text).digest("hex"), content: Buffer.from(text).toString("base64") } };
    },
    createCommitStatus: async value => { unavailable(value.state); f.statuses.push(value); f.onStatus?.(value); },
  }, git: { getTree: async ({ tree_sha }) => {
    unavailable("git");
    const values = { "governance/commit-author-identity.json": JSON.stringify(f.policy), "scripts/fixtures/commit-author-identity-caller.yml": f.template,
      ".github/workflows/commit-author-identity-check.yml": target(tree_sha), ".github/workflows/commit-author-identity.yml": tree_sha === base ? f.baseCaller : f.headCaller };
    const tree = Object.entries(values).filter(([, value]) => value !== null).map(([path, value]) => ({ path, type: "blob", mode: path.endsWith("identity-check.yml") && tree_sha === f.upgrade ? f.targetMode ?? "100644" : tree_sha === head ? f.gitMode ?? "100644" : "100644", sha: createHash("sha1").update(value).digest("hex") }));
    return { data: { truncated: f.gitTruncated ?? false, tree } };
  } } }, paginate: async (method, parameters) => {
    unavailable(method); assert.equal(parameters.per_page, 100); return clone(method === "open" ? f.open ?? [f.pull] : f.commits);
  } };
  const context = { repo: { owner: "agent-teams-ai", repo: f.repository.full_name.split("/")[1] }, eventName: f.event ?? "pull_request_target",
    payload: { pull_request: { number: f.pull.number, head: { sha: "e".repeat(40) }, user: human } } };
  f.repositoryReads = 0; f.branchReads = 0;
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
test("exact owner source identity and external original metadata pass on the independent head", async () => {
  for (const [user, commits] of [
    [human, [commit()]],
    [human, [commit(null)]],
    [{ login: "alice", type: "User" }, [commit({ login: "alice", type: "User" }, "Alice", "alice@example.org")]],
    [{ login: "alice", type: "User" }, [commit(null, "Alice", "alice@example.org")]],
    [{ login: "alice", type: "User" }, [commit({ login: "alice", type: "User" }, "iliya", "alice@example.org")]],
  ]) {
    const f = fixture(); f.pull.user = user; f.commits = commits;
    if (user !== human) { commits[0].commit.committer = { name: "GitHub", email: "noreply@github.com" };
      commits[0].committer = { login: "web-flow", type: "User" }; }
    await run(f);
    assert.deepEqual(f.failures, []); assert.deepEqual(states(f), ["pending", "success"]);
    assert.ok(f.statuses.every(value => value.sha === head && value.context === "commit-author-identity"));
    assert.equal(f.pullReads, 2);
    assert.equal(f.operations.at(-2), "open", "Same-head PR ownership must be the last metadata read");
  }
  const f = fixture(); f.commits = [commit(null, "Alice", "alice@openai.com")];
  f.commits[0].commit.committer = { name: "Alice", email: "alice@openai.com" };
  f.commits[0].committer = null;
  await run(f); assert.deepEqual(states(f), ["pending", "success"]);
});
test("owner source committers must be exact, including unassociated owner authors", async () => {
  for (const author of [human, null]) for (const committer of [undefined, null, {}, { name: "iliya" }, { email: "iliyazelenkog@gmail.com" },
    { name: "wrong", email: "iliyazelenkog@gmail.com" }, { name: "iliya", email: "wrong@example.org" },
    { name: "GitHub", email: "noreply@github.com" }, { name: "web-flow", email: "noreply@github.com" },
    { name: "technical", email: "technical@example.org" }, { name: "Iliya", email: "iliyazelenkog@gmail.com" },
    { name: "iliya", email: "iliyazelenkog@gmail.com " }]) {
    const f = await rejected(value => { value.commits = [commit(author)]; value.commits[0].commit.committer = committer; });
    assert.match(f.failures[0], /exact raw author AND committer/u);
  }
});
test("known unassociated Codex/OpenAI source authors cannot masquerade as humans", async () => {
  for (const [name, email] of [["Codex", "codex@openai.com"], ["OpenAI", "openai@openai.com"],
    [" OpenAI Codex ", "CODEX@OPENAI.COM"], ["Codex", "unknown@example.org"],
    ["Alice", "codex@openai.com"], ["Alice", "openai@users.noreply.github.com"]]) {
    const f = await rejected(value => { value.commits = [commit(null, name, email)]; });
    assert.match(f.failures[0], /Codex\/OpenAI source commit AUTHOR/u);
  }
});
test("repository publisher serialization is a workflow concurrency contract", () => {
  const block = /^concurrency:\n((?:  .*\n)+)/mu.exec(workflow)?.[1];
  assert.equal(block, "  group: commit-author-identity-${{ github.repository }}\n  cancel-in-progress: false\n");
});
test("overlapping older human run cannot overwrite a same-head Bot failure with success", async () => {
  const older = fixture(), bot = fixture(), published = [];
  bot.pull.number = 8; bot.pull.user = { login: "renovate", type: "Bot" };
  older.onStatus = value => published.push(["human", value.sha, value.state]);
  bot.onStatus = value => published.push(["bot", value.sha, value.state]);
  older.onRepositoryRead = async count => {
    if (count === 2) { older.open = [clone(older.pull), clone(bot.pull)]; await run(bot); }
  };
  await run(older);
  assert.deepEqual(published, [["human", head, "pending"], ["bot", head, "pending"],
    ["bot", head, "failure"], ["human", head, "failure"]]);
  assert.match(bot.failures[0], /Bot\/GitHub PR authors/u);
  assert.match(older.failures[0], /Conflicting Bot\/GitHub PR author/u);
});
test("canonical pin-only upgrade admits reviewed implementation bytes and rejects other targets", async () => {
  const upgrade = "d".repeat(40);
  const upgraded = () => { const f = fixture(); f.upgrade = upgrade; f.headCaller = template.replace("CENTRAL_REVISION", upgrade); return f; };
  const good = upgraded(); await run(good);
  assert.deepEqual(good.failures, []); assert.deepEqual(states(good), ["pending", "success"]);
  for (const mutate of [
    f => { f.targets = { [upgrade]: workflow + "# unreviewed implementation\n" }; },
    f => { f.targets = { [upgrade]: null }; },
    f => { let reads = 0; f.contentOverride = (path, ref, text) => path.endsWith("identity-check.yml") && ref === upgrade && ++reads === 2 ? null : text; },
    f => { f.targetMode = "120000"; }, f => { f.targetMode = "160000"; },
    f => { f.headCaller += "# extra caller text\n"; },
    f => { f.baseCaller += "# extra caller text\n"; },
    f => { f.headCaller = f.headCaller.replace(upgrade, "0".repeat(40)); },
    f => { f.headCaller = f.headCaller.replace(upgrade, "main"); },
    f => { f.lateCentral = "e".repeat(40); f.targets = { [f.lateCentral]: workflow + "# authority moved\n" }; },
  ]) {
    const f = upgraded(); mutate(f); await run(f);
    assert.ok(f.failures.length > 0); assert.deepEqual(states(f), ["pending", "failure"]);
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
    rules: [{ type: "required_status_checks", parameters: { strict_required_status_checks_policy: true, do_not_enforce_on_create: false,
      required_status_checks: [{ context: "commit-author-identity", integration_id: 15368 }] } }] };
  assertIdentityRuleset(rule, policy.ruleset);
  for (const mutate of [
    f => { f.enforcement = "disabled"; }, f => { f.bypass_actors = [{ actor_id: 1 }]; },
    f => { f.conditions.ref_name.include = ["~ALL"]; }, f => { f.rules = []; },
    f => { f.rules[0].parameters.required_status_checks[0].context = "other"; },
    f => { f.rules[0].parameters.required_status_checks[0].integration_id = null; },
    f => { f.rules[0].parameters.strict_required_status_checks_policy = false; },
    f => { delete f.rules[0].parameters.do_not_enforce_on_create; },
    f => { f.rules[0].parameters.do_not_enforce_on_create = true; },
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

test("canonical Actions permission and observed creation/approval must be explicitly false", () => {
  assert.equal(policy.actions_workflow_permissions.can_approve_pull_request_reviews, false);
  assertActionsWorkflowPermissions({ can_approve_pull_request_reviews: false }, policy.actions_workflow_permissions);
  for (const actual of [null, {}, { can_approve_pull_request_reviews: true },
    { can_approve_pull_request_reviews: null }, { can_approve_pull_request_reviews: "false" }]) {
    assert.throws(() => assertActionsWorkflowPermissions(actual, policy.actions_workflow_permissions), /explicitly false/u);
  }
  assert.throws(() => assertActionsWorkflowPermissions({ can_approve_pull_request_reviews: false },
    { can_approve_pull_request_reviews: true }), /Canonical/u);
});
