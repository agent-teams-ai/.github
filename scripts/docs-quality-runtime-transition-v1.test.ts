import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  assertMainProtection,
  assertRetirementTuple,
  assertStagingProtection,
  BRIDGE_CONTEXTS,
  collectRetirementEvidence,
  createGitHubReadApi,
  executorFromEnvironment,
  HOSTED_PROTECTION_OBSERVATION,
  parseCompleteTree,
  publishRetirementBridge,
  readVerifiedDocument,
  RETIREMENT,
  RETIREMENT_TUPLE,
  retirementPullSnapshot,
  SOURCE_REF,
  SOURCE_WORKFLOW,
} from "./docs-quality-runtime-transition-v1.ts";
import type { GitHubStatusApi, GitHubReadApi } from "./docs-quality-runtime-transition-v1.ts";

const git = (...args: string[]): Buffer => execFileSync("git", args, {
  cwd: new URL("../", import.meta.url), maxBuffer: 16 * 1024 * 1024,
});
function rawTree(revision: string): {
  sha: string; truncated: boolean; tree: { path: string; mode: string; type: string; sha: string; size?: number }[];
} {
  const sha = git("rev-parse", `${revision}^{tree}`).toString().trim();
  const tree = git("ls-tree", "-r", "-t", "-l", revision).toString().trimEnd().split("\n").map(line => {
    const [metadata, path] = line.split("\t"); assert.ok(path && metadata);
    const [mode, type, hash, size] = metadata.trim().split(/\s+/u); assert.ok(mode && type && hash);
    return { path, mode, type, sha: hash, ...(size === "-" ? {} : { size: Number(size) }) };
  });
  return { sha, truncated: false, tree };
}
const files = (): object[] => RETIREMENT_TUPLE.map(([filename, before, sha]) => ({
  filename, status: before === null ? "added" : "modified", sha,
}));
const repository: { id: number; full_name: string } = { id: RETIREMENT.repositoryId, full_name: RETIREMENT.repository };
function pull() {
  return { number: 367, id: RETIREMENT.pullId, state: "open", merged: false, draft: false,
    user: { id: 13103045, type: "User", login: "777genius" }, changed_files: 10, commits: 3,
    updated_at: "2026-10-20T00:00:00Z",
    base: { repo: repository, sha: String(RETIREMENT.baseSHA), ref: "main" },
    head: { repo: repository, sha: String(RETIREMENT.headSHA), ref: "TEST-retirement-source" } };
}
function stagingLock() {
  return { id: 1, source: RETIREMENT.repository, source_type: "Repository", target: "branch", enforcement: "active",
    conditions: { ref_name: { include: [SOURCE_REF], exclude: [] } }, bypass_actors: [], current_user_can_bypass: "never",
    rules: [{ type: "update", parameters: { update_allows_fetch_and_merge: false } }, { type: "deletion" }, { type: "non_fast_forward" }] };
}
const contexts = ["check", "trusted-admission-evidence", "trusted-admission-authority-evolution-v1", "trusted-validation", "docs-source-successor-v1"];
function statusRule(names: readonly string[]) {
  return { type: "required_status_checks", parameters: {
    strict_required_status_checks_policy: true, do_not_enforce_on_create: false,
    required_status_checks: names.map(context => ({ context, integration_id: 15368 })),
  } };
}
function protection() {
  const common = { target: "branch", enforcement: "active", conditions: { ref_name: { exclude: [], include: ["~DEFAULT_BRANCH"] } },
    bypass_actors: [], current_user_can_bypass: "never" };
  return {
    main: { ...common, id: 19979783, rules: [
      { type: "deletion" }, { type: "non_fast_forward" }, { type: "required_linear_history" }, statusRule(contexts),
      { type: "pull_request", parameters: { required_approving_review_count: 0, dismiss_stale_reviews_on_push: true,
        required_reviewers: [], require_code_owner_review: false, dismissal_restriction: { enabled: false, allowed_actors: [] },
        require_last_push_approval: false, required_review_thread_resolution: true,
        require_extra_approval_for_unattributed_changes: true, allowed_merge_methods: ["squash"] } },
    ] },
    identity: { ...common, id: 24363205, rules: [statusRule(["commit-author-identity"])] },
  };
}
const environment = (): NodeJS.ProcessEnv => ({
  GITHUB_RUN_ID: "100", GITHUB_RUN_ATTEMPT: "2", GITHUB_REPOSITORY: RETIREMENT.repository,
  GITHUB_SHA: "a".repeat(40), GITHUB_EVENT_NAME: "push", GITHUB_REF: SOURCE_REF,
  GITHUB_WORKFLOW_REF: `${RETIREMENT.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`,
});

function collectorFixture(): {
  api: GitHubReadApi; state: { pull: ReturnType<typeof pull>; branch: string; source: string;
    lock: ReturnType<typeof stagingLock>; main: ReturnType<typeof protection>["main"]; runAttempt: number };
} {
  const source = "a".repeat(40), baseTree = rawTree(RETIREMENT.baseSHA), headTree = rawTree(RETIREMENT.headSHA);
  const state = { pull: pull(), branch: String(RETIREMENT.baseSHA), source, lock: stagingLock(), main: protection().main, runAttempt: 2 };
  const commits = git("rev-list", "--reverse", `${RETIREMENT.baseSHA}..${RETIREMENT.headSHA}`).toString().trim().split("\n").map(hash => {
    const [authorName, authorEmail, committerName, committerEmail] = git("show", "-s", "--format=%an%x00%ae%x00%cn%x00%ce", hash).toString().trimEnd().split("\0");
    return { sha: hash, author: { id: 13103045, type: "User", login: "777genius" }, committer: { id: 13103045, type: "User", login: "777genius" },
      commit: { author: { name: authorName, email: authorEmail }, committer: { name: committerName, email: committerEmail } } };
  });
  const api: GitHubReadApi = { get: async request => {
    const path = request.replace(/^repos\/agent-teams-ai\/\.github/u, "");
    if (path === "") { return { ...repository, default_branch: "main", archived: false, disabled: false }; }
    if (path === "/pulls/367") { return structuredClone(state.pull); }
    if (path === "/branches/main") { return { name: "main", protected: true, commit: { sha: state.branch } }; }
    if (path.startsWith("/branches/governance%2F")) { return { name: SOURCE_REF.slice("refs/heads/".length), protected: true, commit: { sha: state.source } }; }
    if (path === "/actions/runs/100/attempts/2") {
      return { id: 100, run_attempt: state.runAttempt, event: "push", path: SOURCE_WORKFLOW, head_sha: source,
        head_branch: SOURCE_REF.slice("refs/heads/".length), repository,
        actor: { id: 13103045, type: "User", login: "777genius" } };
    }
    if (path.startsWith("/rulesets?")) { return [{ id: state.lock.id }]; }
    if (path === "/rulesets/1") { return structuredClone(state.lock); }
    if (path === "/rulesets/19979783") { return structuredClone(state.main); }
    if (path === "/rulesets/24363205") { return protection().identity; }
    if (path.startsWith("/pulls/367/files?")) { return files(); }
    if (path.startsWith("/pulls/367/commits?")) { return commits; }
    if (path.startsWith("/compare/")) {
      return { status: "ahead", behind_by: 0, ahead_by: 3, total_commits: 3,
        base_commit: { sha: RETIREMENT.baseSHA }, merge_base_commit: { sha: RETIREMENT.baseSHA } };
    }
    if (path.startsWith("/git/commits/")) {
      const revision = path.slice("/git/commits/".length);
      return { sha: revision, tree: { sha: revision === RETIREMENT.headSHA ? headTree.sha : baseTree.sha } };
    }
    if (path === `/git/trees/${baseTree.sha}?recursive=1`) { return baseTree; }
    if (path === `/git/trees/${headTree.sha}?recursive=1`) { return headTree; }
    if (path.startsWith("/git/blobs/")) {
      const hash = path.slice("/git/blobs/".length), bytes = git("cat-file", "blob", hash);
      return { sha: hash, size: bytes.length, encoding: "base64", content: bytes.toString("base64") };
    }
    throw new Error(`Unexpected test read boundary: ${request}`);
  } };
  return { api, state };
}

test("the exact real ten-file retirement tree and file list bind", () => {
  const base = rawTree(RETIREMENT.baseSHA), head = rawTree(RETIREMENT.headSHA);
  assert.equal(base.sha, RETIREMENT.baseTreeSHA); assert.equal(head.sha, RETIREMENT.headTreeSHA);
  assertRetirementTuple(parseCompleteTree(base, base.sha), parseCompleteTree(head, head.sha), [files()]);
});

test("complete tree hashing rejects hidden leaves, mode changes, truncation and duplicate paths", () => {
  const original = rawTree(RETIREMENT.baseSHA);
  for (const change of [
    (tree: typeof original) => { tree.truncated = true; },
    (tree: typeof original) => { tree.tree.pop(); },
    (tree: typeof original) => { tree.tree.push({ ...tree.tree[0]! }); },
    (tree: typeof original) => { tree.tree.find(entry => entry.type === "blob")!.mode = "120000"; },
  ]) {
    const value = structuredClone(original); change(value);
    assert.throws(() => parseCompleteTree(value, original.sha));
  }
});

test("retirement rejects partial, extra, renamed, duplicate and wrong-blob file tuples", () => {
  const rawBase = rawTree(RETIREMENT.baseSHA), rawHead = rawTree(RETIREMENT.headSHA);
  const base = parseCompleteTree(rawBase, rawBase.sha), head = parseCompleteTree(rawHead, rawHead.sha);
  for (const changed of [
    files().slice(1), [...files(), { filename: "README.md", status: "modified", sha: "c".repeat(40) }],
    [{ ...files()[0], previous_filename: "other.md" }, ...files().slice(1)],
    [files()[1]!, ...files().slice(1)], [{ ...files()[0], sha: "d".repeat(40) }, ...files().slice(1)],
  ]) { assert.throws(() => assertRetirementTuple(base, head, [changed])); }
});

test("changed blob data is authenticated before JSON is handed to any validator", async () => {
  const raw = rawTree(RETIREMENT.baseSHA), tree = parseCompleteTree(raw, raw.sha), path = "governance/docs-protocol-policy-v2.json";
  const entry = tree.entries.get(path)!;
  const bytes = git("show", `${RETIREMENT.baseSHA}:${path}`);
  const response = { sha: entry.sha, size: bytes.length, encoding: "base64", content: bytes.toString("base64") };
  const api: GitHubReadApi = { get: async () => response };
  assert.deepEqual((await readVerifiedDocument(api, tree, RETIREMENT.baseSHA, path)).bytes, bytes);
  const damaged = Buffer.from(bytes); damaged[0] = 0;
  response.content = damaged.toString("base64");
  await assert.rejects(readVerifiedDocument(api, tree, RETIREMENT.baseSHA, path), /blob content/u);
});

test("real owner PR metadata rejects another head, base, actor, repository or draft state", () => {
  assert.ok(retirementPullSnapshot(pull()));
  for (const mutate of [
    (value: ReturnType<typeof pull>) => { value.head.sha = "a".repeat(40); },
    (value: ReturnType<typeof pull>) => { value.base.sha = "b".repeat(40); },
    (value: ReturnType<typeof pull>) => { value.user.type = "Bot"; },
    (value: ReturnType<typeof pull>) => { value.user.id = 1; },
    (value: ReturnType<typeof pull>) => { value.head.repo = { id: 1, full_name: "other/repo" }; },
    (value: ReturnType<typeof pull>) => { value.draft = true; },
  ]) { const value = structuredClone(pull()); mutate(value); assert.throws(() => retirementPullSnapshot(value)); }
});

test("the assembled collector rechecks live target, locked source, run and main protection after real Git evidence", async () => {
  const f = collectorFixture();
  const evidence = await collectRetirementEvidence(f.api, executorFromEnvironment(environment()));
  assert.equal(evidence.documents.size, 17);
  assert.deepEqual(evidence.protectionObservation, HOSTED_PROTECTION_OBSERVATION);
  const stable = structuredClone(f.state);
  const mutations = [
    () => { f.state.pull.head.sha = "e".repeat(40); },
    () => { f.state.pull.user.login = "other-human"; },
    () => { f.state.branch = "e".repeat(40); },
    () => { f.state.source = "e".repeat(40); },
    () => { f.state.runAttempt = 3; },
    () => { f.state.lock.enforcement = "disabled"; },
    () => { f.state.main.rules.pop(); },
  ];
  for (const mutate of mutations) {
    Object.assign(f.state, structuredClone(stable)); mutate();
    await assert.rejects(evidence.recheck());
  }
  Object.assign(f.state, structuredClone(stable)); await evidence.recheck();
});

test("execution requires actual push run coordinates on the dedicated source ref", () => {
  assert.equal(executorFromEnvironment(environment()).runAttempt, 2);
  for (const [key, value] of [
    ["GITHUB_EVENT_NAME", "pull_request_target"], ["GITHUB_REF", "refs/heads/main"],
    ["GITHUB_SHA", "0".repeat(40)], ["GITHUB_RUN_ID", "1.5"], ["GITHUB_RUN_ATTEMPT", "0"],
  ]) { assert.throws(() => executorFromEnvironment({ ...environment(), [key!]: value })); }
});

test("staging authority requires an exact active owner lock with no bypass", () => {
  assert.equal(assertStagingProtection([stagingLock()]), 1);
  for (const mutate of [
    (value: ReturnType<typeof stagingLock>) => { value.enforcement = "evaluate"; },
    (value: ReturnType<typeof stagingLock>) => { value.conditions.ref_name.include = ["~ALL"]; },
    (value: ReturnType<typeof stagingLock>) => { value.rules.pop(); },
    (value: ReturnType<typeof stagingLock>) => { value.current_user_can_bypass = "always"; },
    (value: ReturnType<typeof stagingLock>) => { value.bypass_actors = [{}] as never[]; },
  ]) { const value = stagingLock(); mutate(value); assert.throws(() => assertStagingProtection([value])); }
  assert.throws(() => assertStagingProtection([stagingLock(), stagingLock()]));
});

test("read-only protection observation does not claim that private bypass actors were attested", () => {
  const lock = stagingLock();
  const hiddenLock = Object.fromEntries(Object.entries(lock).filter(([key]) =>
    !["bypass_actors", "current_user_can_bypass"].includes(key)));
  assert.equal(assertStagingProtection([hiddenLock], "public_read"), 1);
  assert.throws(() => assertStagingProtection([hiddenLock], "owner_full"));
  assert.deepEqual(HOSTED_PROTECTION_OBSERVATION, {
    mode: "public_read", privateBypass: "not_attested", ownerFullReadRequiredForCutover: true,
  });
  for (const bypass_actors of [[{}], null, "unobserved"]) {
    assert.throws(() => assertStagingProtection([{ ...hiddenLock, bypass_actors }], "public_read"));
  }
  const value = protection();
  for (const rule of [value.main, value.identity]) {
    Reflect.deleteProperty(rule, "bypass_actors"); Reflect.deleteProperty(rule, "current_user_can_bypass");
  }
  assertMainProtection(value.main, value.identity, "public_read");
  assert.throws(() => assertMainProtection(value.main, value.identity, "owner_full"));
  assert.throws(() => assertMainProtection({ ...value.main, bypass_actors: [{}] }, value.identity, "public_read"));
});

test("a staged source cannot permit upstream fetch-and-merge or hide its update parameters", () => {
  const lock = stagingLock();
  Object.assign(lock.rules[0]!, { parameters: { update_allows_fetch_and_merge: true } });
  assert.throws(() => assertStagingProtection([lock], "public_read"));
  Reflect.deleteProperty(lock.rules[0]!, "parameters");
  assert.throws(() => assertStagingProtection([lock], "public_read"));
});

test("main protection accepts only original, add-before-replace and exact successor contexts", () => {
  const value = protection(); assertMainProtection(value.main, value.identity);
  const required = value.main.rules.find(rule => rule.type === "required_status_checks")!;
  Object.assign(required, statusRule([...contexts, ...BRIDGE_CONTEXTS])); assertMainProtection(value.main, value.identity);
  Object.assign(required, statusRule([...contexts.filter(name => !["docs-source-successor-v1", "trusted-admission-evidence"].includes(name)), ...BRIDGE_CONTEXTS]));
  assertMainProtection(value.main, value.identity);
  Object.assign(required, statusRule(contexts.filter(name => name !== "check")));
  assert.throws(() => assertMainProtection(value.main, value.identity), /Unapproved/u);
});

test("main protection rejects integration, strictness, identity and PR-policy weakening", () => {
  const mutations = [
    (value: ReturnType<typeof protection>) => { const rule = value.main.rules.find(candidate => candidate.type === "required_status_checks")!; Object.assign(rule, { parameters: { ...statusRule(contexts).parameters, strict_required_status_checks_policy: false } }); },
    (value: ReturnType<typeof protection>) => { value.identity.rules[0]!.parameters.required_status_checks[0]!.integration_id = 1; },
    (value: ReturnType<typeof protection>) => { value.identity.rules[0]!.parameters.required_status_checks = []; },
    (value: ReturnType<typeof protection>) => { const rule = value.main.rules.find(candidate => candidate.type === "pull_request")!; Object.assign(rule, { parameters: {} }); },
  ];
  for (const mutate of mutations) { const value = protection(); mutate(value); assert.throws(() => assertMainProtection(value.main, value.identity)); }
});

test("status transport cannot overwrite any legacy required context", async () => {
  const api = createGitHubReadApi("synthetic-token-never-sent");
  for (const context of [...contexts, "commit-author-identity"]) {
    await assert.rejects(async () => api.postStatus(RETIREMENT.headSHA, { context, state: "success", target_url: "https://example.test", description: "TEST" }), /Legacy or unowned/u);
  }
});

test("publisher posts pending then failure on its own contexts after a source/API failure", async () => {
  const posted: { context: string; state: string; head: string }[] = [];
  const api: GitHubStatusApi = {
    get: async path => { if (path.endsWith("/pulls/367")) { return pull(); } throw new Error("TEST protected source unavailable"); },
    postStatus: async (head, status) => { posted.push({ head, context: status.context, state: status.state }); return {}; },
  };
  await assert.rejects(publishRetirementBridge(api, executorFromEnvironment(environment())), /TEST protected source unavailable/u);
  assert.deepEqual(posted, [
    ...BRIDGE_CONTEXTS.map(context => ({ head: RETIREMENT.headSHA, context, state: "pending" })),
    ...BRIDGE_CONTEXTS.map(context => ({ head: RETIREMENT.headSHA, context, state: "failure" })),
  ]);
});

test("publisher writes no status for a different live target", async () => {
  let posts = 0;
  const moved = pull(); moved.head.sha = "e".repeat(40);
  const api: GitHubStatusApi = { get: async () => moved, postStatus: async () => { posts++; return {}; } };
  await assert.rejects(publishRetirementBridge(api, executorFromEnvironment(environment())));
  assert.equal(posts, 0);
});

test("independent tree digest oracle uses actual Git object bytes", () => {
  const bytes = git("cat-file", "tree", RETIREMENT.baseTreeSHA);
  assert.equal(createHash("sha1").update(`tree ${bytes.length}\0`).update(bytes).digest("hex"), RETIREMENT.baseTreeSHA);
});
