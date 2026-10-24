import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse, stringify } from "yaml";
import { checkDocsSourceSuccessor } from "./check-docs-source-successor-v1.mts";
import {
  ADR_PATH, assertCanaryWorkflow, assertCommitIdentity, assertCallerWorkflow, assertCurrentSuccessfulJobs, assertMainProtection, assertSourceTuple, assertStagingProtection,
  CALLER_WORKFLOW, CANARY_REFS, CANARY_WORKFLOW, canaryWorkflowDefinition, PREVIOUS_SOURCE_REF, PREVIOUS_SOURCE_SHA, PREVIOUS_SOURCE_INPUTS, callerWorkflowDefinition, EVIDENCE_PATH,
  checkSourceSuccessor, collectSourceEvidence, createGitHubReadApi, executorFromEnvironment,
  HOSTED_PROTECTION_OBSERVATION, parseCompleteTree, publishSourceSuccessor,
  planProtectionTransition, resolveExecutionTarget, SOURCE_CONTEXT, SOURCE_REF, SOURCE_WORKFLOW, TARGET, TARGET_TUPLE, targetPullSnapshot,
} from "./owner-name-alias-source-successor-v1.ts";
import type { GitHubReadApi, GitHubStatusApi } from "./owner-name-alias-source-successor-v1.ts";

const git = (...args: string[]): Buffer => execFileSync("git", args, {
  cwd: new URL("../", import.meta.url), maxBuffer: 16 * 1024 * 1024,
});
type Entry = { path: string; mode: string; type: string; sha: string; size?: number };
type RawTree = { sha: string; truncated: boolean; tree: Entry[] };
type Changed = { filename: string; status: string; sha: string; previous_filename?: string };
type Blob = { sha: string; size: number; encoding: string; content: string };
const hash = (kind: string, bytes: Buffer): string => createHash("sha1").update(`${kind} ${bytes.length}\0`).update(bytes).digest("hex");
function treeAt(revision: string): RawTree {
  return { sha: git("rev-parse", `${revision}^{tree}`).toString().trim(), truncated: false,
    tree: git("ls-tree", "-r", "-t", "-l", revision).toString().trimEnd().split("\n").map(line => {
      const [metadata, path] = line.split("\t"); assert.ok(metadata && path);
      const [mode, type, sha, size] = metadata.trim().split(/\s+/u); assert.ok(mode && type && sha);
      return { path, mode, type, sha, ...(size === "-" ? {} : { size: Number(size) }) };
    }) };
}
function filesBetween(base: string, head: string): Changed[] {
  const lines = git("diff", "--raw", "--no-abbrev", "--no-renames", base, head).toString().trimEnd();
  return lines === "" ? [] : lines.split("\n").map(line => {
    const [metadata, filename] = line.split("\t"); assert.ok(metadata && filename);
    const [, , before, after, status] = metadata.split(" "); assert.ok(before && after);
    assert.ok(status === "M" || status === "A" || status === "D");
    return { filename, status: status === "A" ? "added" : status === "D" ? "removed" : "modified", sha: status === "D" ? before : after };
  });
}
function encoded(bytes: Buffer): Blob {
  return { sha: hash("blob", bytes), size: bytes.length, encoding: "base64", content: bytes.toString("base64") };
}
const sourceSHA = "a".repeat(40);
const legacyInputs = ["scripts/check-docs-source-successor-v1.mts", "scripts/check-docs-source-successor-v1.test.mts",
  ".github/workflows/docs-source-successor-v1.yml", "docs/decisions/0009-bounded-docs-source-successor.md", "tsconfig.docs-source-successor.json"];
const qualityHelpers = ["scripts/quality-process.ts", "scripts/quality-process.test.ts", "scripts/run-governance-tests.ts", "scripts/run-governance-tests.test.ts"];
const inputEvidence = (tree: RawTree): Record<string, Entry | null> => Object.fromEntries(legacyInputs.map(path => [path, tree.tree.find(entry => entry.path === path) ?? null]));
function legacyFixture(baseRevision: string, headRevision: string, pullRequest = 77) {
  const baseTree = treeAt(baseRevision), headTree = treeAt(headRevision), files = filesBetween(baseRevision, headRevision);
  const baseManifest = git("show", `${baseRevision}:package.json`), baseLock = git("show", `${baseRevision}:pnpm-lock.yaml`);
  const envelope = {
    repository: TARGET.repository, pullRequest, base: "5abed741aff64506d0e9f87f76541a4e93af7e4a",
    reviewTarget: "96cb95a89ca4a133fbb626133eb3ac6289938ff7",
    baseSHA: baseRevision, headSHA: headRevision, sourceSHA: headRevision,
    baseRef: "main", defaultBranch: "main", headRepository: TARGET.repository,
    paginationComplete: true, changedFiles: files.length, files, baseTree, headTree,
    baseInputs: inputEvidence(baseTree), headInputs: inputEvidence(headTree),
    headData: Object.fromEntries(["package.json", "pnpm-lock.yaml"].map(path => [path, encoded(git("show", `${headRevision}:${path}`))])),
    live: { state: "open", pullRequest, repository: TARGET.repository, baseSHA: baseRevision, headSHA: headRevision,
      sourceSHA: headRevision, baseRef: "main", defaultBranch: "main", headRepository: TARGET.repository, changedFiles: files.length },
  };
  return { envelope, baseManifest, baseLock };
}
type LegacyFixture = ReturnType<typeof legacyFixture>;
/** Setup only: synthetic leaf changes receive complete trees, independently checked by Git below. */
function rehashTree(tree: RawTree): void {
  const directories = new Set(["", ...tree.tree.filter(entry => entry.type === "tree").map(entry => entry.path)]);
  for (const entry of tree.tree) {
    let parent = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
    while (parent !== "") {
      if (!directories.has(parent)) { directories.add(parent); tree.tree.push({ path: parent, type: "tree", mode: "040000", sha: "b".repeat(40) }); }
      parent = parent.includes("/") ? parent.slice(0, parent.lastIndexOf("/")) : "";
    }
  }
  for (const directory of [...directories].toSorted((left, right) => right.split("/").length - left.split("/").length || right.length - left.length)) {
    const direct = tree.tree.filter(entry => (entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "") === directory);
    const name = (entry: Entry): string => entry.path.split("/").at(-1)!;
    direct.sort((left, right) => Buffer.compare(Buffer.from(name(left) + (left.type === "tree" ? "/" : "")), Buffer.from(name(right) + (right.type === "tree" ? "/" : ""))));
    const bytes = Buffer.concat(direct.flatMap(entry => [Buffer.from(`${entry.mode.replace(/^0/u, "")} ${name(entry)}\0`), Buffer.from(entry.sha, "hex")]));
    const sha = hash("tree", bytes);
    if (directory === "") { tree.sha = sha; } else { tree.tree.find(entry => entry.path === directory)!.sha = sha; }
  }
}
function change(f: LegacyFixture, path: string, bytes: Buffer): void {
  const sha = hash("blob", bytes), before = f.envelope.baseTree.tree.find(entry => entry.path === path);
  const next = { path, type: "blob", mode: "100644", sha, size: bytes.length };
  const old = f.envelope.headTree.tree.find(entry => entry.path === path);
  if (old) { Object.assign(old, next); } else { f.envelope.headTree.tree.push(next); }
  f.envelope.files = f.envelope.files.filter(file => file.filename !== path);
  f.envelope.files.push({ filename: path, status: before ? "modified" : "added", sha });
  f.envelope.headSHA = "b".repeat(40); f.envelope.sourceSHA = f.envelope.headSHA;
  Object.assign(f.envelope.live, { headSHA: f.envelope.headSHA, sourceSHA: f.envelope.headSHA, changedFiles: f.envelope.files.length });
  f.envelope.changedFiles = f.envelope.files.length;
  if (["package.json", "pnpm-lock.yaml"].includes(path)) { f.envelope.headData[path] = encoded(bytes); }
  rehashTree(f.envelope.headTree); f.envelope.headInputs = inputEvidence(f.envelope.headTree);
}
function ordinaryFixture(): LegacyFixture {
  const f = legacyFixture(TARGET.headSHA, TARGET.headSHA);
  change(f, "README.md", Buffer.from("Independent ordinary source gate TEST\n")); return f;
}
function dependencyFixture(): LegacyFixture {
  const f = legacyFixture(TARGET.headSHA, TARGET.headSHA);
  const manifest = JSON.parse(f.baseManifest.toString()) as { devDependencies: Record<string, string> };
  const lock = parse(f.baseLock.toString()) as {
    importers: Record<string, { devDependencies: Record<string, { specifier: string; version: string }> }>;
    packages: Record<string, unknown>; snapshots: Record<string, unknown>;
  };
  manifest.devDependencies["source-v2-test-only"] = "1.2.3";
  lock.importers["."]!.devDependencies["source-v2-test-only"] = { specifier: "1.2.3", version: "1.2.3" };
  lock.packages["source-v2-test-only@1.2.3"] = { resolution: { integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}` } };
  lock.snapshots["source-v2-test-only@1.2.3"] = {};
  change(f, "package.json", Buffer.from(JSON.stringify(manifest)));
  change(f, "pnpm-lock.yaml", Buffer.from(stringify(lock))); return f;
}
const repository: { id: number; full_name: string } = { id: TARGET.repositoryId, full_name: TARGET.repository };
function pull() {
  return { number: Number(TARGET.pullRequest), id: Number(TARGET.pullId), state: "open", merged: false, draft: false,
    user: { id: 13103045, type: "User", login: "777genius" }, changed_files: TARGET_TUPLE.length, commits: Number(TARGET.commits),
    updated_at: "2026-10-20T00:00:00Z",
    base: { repo: repository, sha: String(TARGET.baseSHA), ref: "main" },
    head: { repo: repository, sha: String(TARGET.headSHA), ref: "TEST-quality-source" } };
}
function stagingLock() {
  return { id: 1, source: TARGET.repository, source_type: "Repository", target: "branch", enforcement: "active",
    conditions: { ref_name: { include: [SOURCE_REF], exclude: [] } }, bypass_actors: [] as unknown[], current_user_can_bypass: "never",
    rules: [{ type: "update" }, { type: "deletion" }, { type: "non_fast_forward" }] };
}
const contexts = ["check", "trusted-admission-evidence", "trusted-admission-authority-evolution-v1", "trusted-validation", "docs-quality-source-successor-v2"];
function statusRule(names: readonly string[]) {
  return { type: "required_status_checks", parameters: { strict_required_status_checks_policy: true, do_not_enforce_on_create: false,
    required_status_checks: names.map(context => ({ context, integration_id: 15368 })) } };
}
function protection() {
  const common = { source: TARGET.repository, source_type: "Repository", target: "branch", enforcement: "active", conditions: { ref_name: { exclude: [], include: ["~DEFAULT_BRANCH"] } },
    bypass_actors: [], current_user_can_bypass: "never" };
  return { main: { ...common, id: 19979783, rules: [
    { type: "deletion" }, { type: "non_fast_forward" }, { type: "required_linear_history" }, statusRule(contexts),
    { type: "pull_request", parameters: { required_approving_review_count: 0, dismiss_stale_reviews_on_push: true,
      required_reviewers: [], require_code_owner_review: false, dismissal_restriction: { enabled: false, allowed_actors: [] },
      require_last_push_approval: false, required_review_thread_resolution: true,
      require_extra_approval_for_unattributed_changes: true, allowed_merge_methods: ["squash"] } },
  ] }, identity: { ...common, id: 24363205, rules: [statusRule(["commit-author-identity"])] } };
}
const pushEnvironment = (): NodeJS.ProcessEnv => ({
  GITHUB_RUN_ID: "100", GITHUB_RUN_ATTEMPT: "2", GITHUB_REPOSITORY: TARGET.repository,
  GITHUB_SHA: sourceSHA, GITHUB_EVENT_NAME: "push", GITHUB_REF: SOURCE_REF,
  GITHUB_WORKFLOW_REF: `${TARGET.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`,
  GITHUB_WORKFLOW_SHA: sourceSHA,
  SOURCE_WORKFLOW_SHA: sourceSHA, SOURCE_WORKFLOW_REF: `${TARGET.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`,
  SOURCE_WORKFLOW_REPOSITORY: TARGET.repository, SOURCE_WORKFLOW_PATH: SOURCE_WORKFLOW,
});

function installationFixture(): LegacyFixture & { installationData: Record<string, Blob> } {
  const f = legacyFixture(TARGET.headSHA, TARGET.headSHA);
  const bytes = Buffer.from(stringify(callerWorkflowDefinition(sourceSHA)));
  change(f, CALLER_WORKFLOW, bytes);
  change(f, ADR_PATH, Buffer.from("# Independently reviewed v2 installation decision TEST\n"));
  change(f, EVIDENCE_PATH, Buffer.from("# Qualification evidence coordinates TEST\n"));
  const installationData = { [CALLER_WORKFLOW]: encoded(bytes) };
  return { ...f, installationData };
}

function collectorFixture(reusable = false, changedProtectedPath?: string, canary = false): {
  api: GitHubReadApi;
  env: NodeJS.ProcessEnv; event: { pull_request: ReturnType<typeof pull> } | undefined;
  state: { pull: ReturnType<typeof pull>; branch: string; source: string; sourceProtected: boolean;
    lock: ReturnType<typeof stagingLock>; previousSource: string; previousProtected: boolean; previousLock: ReturnType<typeof stagingLock>; main: ReturnType<typeof protection>["main"]; runAttempt: number;
    fork: boolean; files: Changed[]; commits: unknown[]; openPulls: unknown[] | undefined; canaryBytes: Buffer; corruptBlob: boolean; referencedSHA: string };
} {
  const sourceTree = treeAt(TARGET.baseSHA), live = pull();
  let baseTree = treeAt(TARGET.baseSHA), headTree = treeAt(TARGET.headSHA);
  let files = filesBetween(TARGET.baseSHA, TARGET.headSHA);
  const extraBlobs = new Map<string, Buffer>();
  if (reusable) {
    const f = canary ? { ...legacyFixture(TARGET.baseSHA, TARGET.baseSHA),
      installationData: { [CALLER_WORKFLOW]: encoded(Buffer.from(stringify(callerWorkflowDefinition(sourceSHA)))) } } : installationFixture();
    baseTree = structuredClone(f.envelope.headTree);
    f.envelope.baseTree = baseTree; f.envelope.baseInputs = inputEvidence(baseTree); f.envelope.files = [];
    change(f, "README.md", Buffer.from("Real reusable ordinary source TEST\n"));
    if (changedProtectedPath) { change(f, changedProtectedPath, Buffer.from("Unreviewed protected reusable source edit TEST\n")); }
    if (canary) {
      const bytes = Buffer.from(stringify(canaryWorkflowDefinition(sourceSHA)));
      change(f, CANARY_WORKFLOW, bytes); extraBlobs.set(hash("blob", bytes), bytes);
    }
    headTree = f.envelope.headTree; files = f.envelope.files;
    Object.assign(live, { number: 77, id: 77, changed_files: files.length, commits: 1,
      base: { ...live.base, sha: "c".repeat(40) }, head: { ...live.head, sha: "b".repeat(40) } });
    const caller = Buffer.from(f.installationData[CALLER_WORKFLOW]!.content, "base64");
    extraBlobs.set(hash("blob", caller), caller);
    if (canary) { live.head.ref = CANARY_REFS[0]!.slice("refs/heads/".length); }
  }
  const state = { pull: live, branch: live.base.sha, source: sourceSHA, sourceProtected: true,
    lock: stagingLock(), main: protection().main, runAttempt: 2, fork: false,
    files, commits: [] as unknown[], openPulls: undefined as unknown[] | undefined,
    canaryBytes: Buffer.from(stringify(canaryWorkflowDefinition(sourceSHA))),
    previousSource: String(PREVIOUS_SOURCE_SHA), previousProtected: true,
    previousLock: { ...stagingLock(), id: 25469495, conditions: { ref_name: { include: [PREVIOUS_SOURCE_REF], exclude: [] } } },
    corruptBlob: false, referencedSHA: sourceSHA };
  const env: NodeJS.ProcessEnv = reusable ? { ...pushEnvironment(), GITHUB_EVENT_NAME: "pull_request_target", GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: live.base.sha, GITHUB_WORKFLOW_SHA: live.base.sha,
    GITHUB_WORKFLOW_REF: `${TARGET.repository}/${CALLER_WORKFLOW}@refs/heads/main`,
    SOURCE_WORKFLOW_REF: `${TARGET.repository}/${SOURCE_WORKFLOW}@${sourceSHA}` } : pushEnvironment();
  const commits = git("rev-list", "--reverse", `${TARGET.baseSHA}..${TARGET.headSHA}`).toString().trim().split("\n").map(revision => {
    const [name, email, committerName, committerEmail] = git("show", "-s", "--format=%an%x00%ae%x00%cn%x00%ce", revision).toString().trimEnd().split("\0");
    const actor = { id: 13103045, type: "User", login: "777genius" };
    return { sha: revision, author: actor, committer: actor,
      commit: { author: { name, email }, committer: { name: committerName, email: committerEmail } } };
  });
  state.commits = reusable ? [{ ...commits[0]!, sha: live.head.sha }] : commits;
  if (canary) {
    Object.assign(env, { GITHUB_EVENT_NAME: "push", GITHUB_REF: CANARY_REFS[0], GITHUB_SHA: live.head.sha,
      GITHUB_WORKFLOW_SHA: live.head.sha, GITHUB_WORKFLOW_REF: `${TARGET.repository}/${CANARY_WORKFLOW}@${CANARY_REFS[0]}` });
  }
  const api: GitHubReadApi = { get: async request => {
    const path = request.replace(/^repos\/agent-teams-ai\/\.github/u, "");
    if (path === "") { return { ...repository, default_branch: "main", archived: false, disabled: false, fork: state.fork }; }
    if (path === `/pulls/${state.pull.number}`) { return structuredClone(state.pull); }
    if (path === "/branches/main") { return { name: "main", protected: true, commit: { sha: state.branch } }; }
    if (path === `/branches/${encodeURIComponent(PREVIOUS_SOURCE_REF.slice("refs/heads/".length))}`) {
      return { name: PREVIOUS_SOURCE_REF.slice("refs/heads/".length), protected: state.previousProtected, commit: { sha: state.previousSource } };
    }
    if (path.startsWith("/branches/governance%2F")) {
      return { name: SOURCE_REF.slice("refs/heads/".length), protected: state.sourceProtected, commit: { sha: state.source } };
    }
    if (path === "/actions/runs/100/attempts/2") {
      return { id: 100, run_attempt: state.runAttempt, event: canary ? "push" : reusable ? "pull_request_target" : "push",
        path: canary ? CANARY_WORKFLOW : reusable ? CALLER_WORKFLOW : SOURCE_WORKFLOW, head_sha: reusable ? state.pull.head.sha : sourceSHA,
        referenced_workflows: [{ path: `${TARGET.repository}/${SOURCE_WORKFLOW}@${sourceSHA}`, sha: state.referencedSHA }],
        head_branch: canary ? state.pull.head.ref : SOURCE_REF.slice("refs/heads/".length), repository,
        actor: { id: 13103045, type: "User", login: "777genius" } };
    }
    if (path.startsWith("/rulesets?")) { return [{ id: state.lock.id }, { id: 25469495 }]; }
    if (path === "/rulesets/25469495") { return structuredClone(state.previousLock); }
    if (path === "/rulesets/1") { return structuredClone(state.lock); }
    if (path === "/rulesets/19979783") { return structuredClone(state.main); }
    if (path === "/rulesets/24363205") { return protection().identity; }
    if (path.startsWith(`/pulls/${state.pull.number}/files?`)) { return state.files; }
    if (path.startsWith("/pulls?state=open&base=main")) { return state.openPulls ?? [structuredClone(state.pull)]; }
    if (path.startsWith(`/pulls/${state.pull.number}/commits?`)) {
      return structuredClone(state.commits);
    }
    if (path.startsWith("/compare/")) {
      return { status: "ahead", behind_by: 0, ahead_by: TARGET.commits, total_commits: TARGET.commits,
        base_commit: { sha: TARGET.baseSHA }, merge_base_commit: { sha: TARGET.baseSHA } };
    }
    if (path.startsWith("/git/commits/")) {
      const revision = path.slice("/git/commits/".length);
      return { sha: revision, tree: { sha: revision === sourceSHA ? sourceTree.sha : revision === state.pull.head.sha ? headTree.sha : baseTree.sha } };
    }
    if (path === `/git/trees/${baseTree.sha}?recursive=1`) { return baseTree; }
    if (path === `/git/trees/${headTree.sha}?recursive=1`) { return headTree; }
    if (path === `/git/trees/${sourceTree.sha}?recursive=1`) { return sourceTree; }
    if (path.startsWith("/git/blobs/")) {
      const blob = path.slice("/git/blobs/".length), bytes = extraBlobs.get(blob) ?? git("cat-file", "blob", blob), result = encoded(bytes);
      if (state.corruptBlob) { result.content = Buffer.alloc(bytes.length).toString("base64"); }
      return result;
    }
    throw new Error(`Unexpected test-only API read: ${request}`);
  } };
  return { api, env, event: reusable ? { pull_request: structuredClone(live) } : undefined, state };
}

test("the finite owner name alias transition binds the complete actual reviewed Git tree and six-file delta", () => {
  const base = treeAt(TARGET.baseSHA), head = treeAt(TARGET.headSHA), files = filesBetween(TARGET.baseSHA, TARGET.headSHA);
  assert.equal(files.length, TARGET_TUPLE.length);
  assert.equal(base.sha, TARGET.baseTreeSHA); assert.equal(head.sha, TARGET.headTreeSHA);
  assertSourceTuple(parseCompleteTree(base, base.sha), parseCompleteTree(head, head.sha), [files]);
  for (const path of legacyInputs) {
    assert.equal(base.tree.find(entry => entry.path === path)?.sha, head.tree.find(entry => entry.path === path)?.sha, `Frozen v1 input changed: ${path}`);
  }
});

test("complete-tree proof rejects truncation, omission, duplicate entries and mode substitutions", () => {
  const original = treeAt(TARGET.baseSHA);
  for (const mutate of [
    (value: RawTree) => { value.truncated = true; },
    (value: RawTree) => { value.tree.pop(); },
    (value: RawTree) => { value.tree.push({ ...value.tree[0]! }); },
    (value: RawTree) => { value.tree.find(entry => entry.type === "blob")!.mode = "120000"; },
  ]) { const value = structuredClone(original); mutate(value); assert.throws(() => parseCompleteTree(value, original.sha)); }
});

test("finite transition rejects extra, missing, duplicate, renamed and wrong-blob metadata", () => {
  const rawBase = treeAt(TARGET.baseSHA), rawHead = treeAt(TARGET.headSHA);
  const base = parseCompleteTree(rawBase, rawBase.sha), head = parseCompleteTree(rawHead, rawHead.sha);
  const files = filesBetween(TARGET.baseSHA, TARGET.headSHA);
  for (const invalid of [
    files.slice(1), [...files, { filename: "README.md", status: "modified", sha: "c".repeat(40) }],
    [files[1]!, ...files.slice(1)], [{ ...files[0]!, previous_filename: "other.md" }, ...files.slice(1)],
    [{ ...files[0]!, sha: "e".repeat(40) }, ...files.slice(1)],
  ]) { assert.throws(() => assertSourceTuple(base, head, [invalid])); }
});

test("retained ordinary route uses actual target-base install bytes, independently of staging CWD", async () => {
  const f = ordinaryFixture();
  assert.equal(checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock), "noop");
  assert.equal(await checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA), "noop");
  await assert.rejects(checkSourceSuccessor(f.envelope, Buffer.concat([f.baseManifest, Buffer.from("\n")]), f.baseLock, sourceSHA), /base|checkout|blob/u);
});

test("retained registry dependency update matches the unchanged frozen checker", async () => {
  const f = dependencyFixture();
  assert.equal(checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock), "ordinary");
  assert.equal(await checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA), "ordinary");
  const next = JSON.parse(Buffer.from(f.envelope.headData["package.json"]!.content, "base64").toString()) as { devDependencies: Record<string, string> };
  next.devDependencies.ajv = "8.21.0"; change(f, "package.json", Buffer.from(JSON.stringify(next)));
  assert.throws(() => checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock));
  await assert.rejects(checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA));
});

test("finite historical Cohort forward, rollback, Cohort-data and Node26 routes retain frozen results", async () => {
  for (const [base, head, expected] of [
    ["fff9d72e5b6f7022348d3a51ff54b1237ae68e1c", "9cc720c30a3cb1501426c9a27f2f837692c7f2d0", "ordinary"],
    ["9cc720c30a3cb1501426c9a27f2f837692c7f2d0", "fff9d72e5b6f7022348d3a51ff54b1237ae68e1c", "ordinary"],
    ["de0cbe6b327fa3ec2d41a75ab30b4a839a6f247f", "64e4f5a1eb337bfaea8a7ca44d15696b83b0eff8", "noop"],
    ["265dca86ddb48c14e7d94e0b5ca698776e3dd743", "3094afecfe4ed810a9106ca2e7c1ee6908442748", "ordinary"],
  ]) {
    assert.ok(base && head && expected);
    const f = legacyFixture(base, head);
    assert.equal(checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock), expected);
    assert.equal(await checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA), expected);
  }
});

test("the retained seven-file source content route still belongs to the unchanged frozen checker", async () => {
  const f = legacyFixture("5abed741aff64506d0e9f87f76541a4e93af7e4a", "5abed741aff64506d0e9f87f76541a4e93af7e4a", 363);
  for (const path of [
    ".github/workflows/docs-protocol-check.yml", "scripts/check-community-files.mjs", "scripts/check-community-files.test.mjs",
    "scripts/docs-admission-change.test.mjs", "scripts/verify-docs-cohort-v2-receipt.mjs",
    "scripts/verify-docs-consumer-gate.mjs", "scripts/verify-docs-consumer-gate.test.mjs",
  ]) { change(f, path, git("show", `3a203362c25c5ebbe6e44b745ba3f8a5eecbaad0:${path}`)); }
  assert.equal(checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock), "special");
  assert.equal(await checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA), "special");
  change(f, "scripts/verify-docs-consumer-gate.mjs", Buffer.from("Unreviewed special route source TEST\n"));
  assert.throws(() => checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock));
  await assert.rejects(checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA));
});

test("Cohort-only 33 and 3000 retain admission while ordinary 33 retains rejection", async () => {
  for (const [count, cohort] of [[33, true], [3000, true], [33, false]] as const) {
    const f = legacyFixture(TARGET.headSHA, TARGET.headSHA), bytes = Buffer.from("{}\n"), sha = hash("blob", bytes);
    const prefix = cohort ? "governance/evidence/docs-cohorts" : "docs";
    for (let index = 0; index < count; index++) {
      const path = `${prefix}/source-v2-boundary-test-${index}.json`;
      f.envelope.headTree.tree.push({ path, type: "blob", mode: "100644", sha, size: bytes.length });
      f.envelope.files.push({ filename: path, status: "added", sha });
    }
    f.envelope.headSHA = "b".repeat(40); f.envelope.sourceSHA = f.envelope.headSHA;
    f.envelope.changedFiles = count;
    Object.assign(f.envelope.live, { headSHA: f.envelope.headSHA, sourceSHA: f.envelope.headSHA, changedFiles: count });
    rehashTree(f.envelope.headTree);
    if (cohort) {
      assert.equal(checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock), "noop");
      assert.equal(await checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA), "noop");
    } else {
      assert.throws(() => checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock), /1\.\.32/u);
      await assert.rejects(checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA), /1\.\.32/u);
    }
  }
});

test("new quality helper closure is protected even where frozen v1 permits an ordinary edit", async () => {
  for (const path of qualityHelpers) {
    const f = legacyFixture(TARGET.headSHA, TARGET.headSHA);
    change(f, path, Buffer.from("// Independent extraction-closure negative TEST\n"));
    assert.equal(checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock), "noop");
    await assert.rejects(checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA), /protected|quality|helper/iu);
  }
});

test("the additive three-file caller installation is legal under frozen v1 and the new finite path", async () => {
  const f = installationFixture(), envelope = { ...f.envelope, installationData: f.installationData };
  assert.equal(checkDocsSourceSuccessor(envelope, f.baseManifest, f.baseLock), "noop");
  assert.equal(await checkSourceSuccessor(envelope, f.baseManifest, f.baseLock, sourceSHA), "noop");
  await assertCallerWorkflow(Buffer.from(stringify(callerWorkflowDefinition(sourceSHA))), sourceSHA);
  const partial = structuredClone(envelope); partial.files.pop(); partial.changedFiles--;
  await assert.rejects(checkSourceSuccessor(partial, f.baseManifest, f.baseLock, sourceSHA));
  await assert.rejects(checkSourceSuccessor({ ...envelope, installationData: {} }, f.baseManifest, f.baseLock, sourceSHA));
});

test("canonical caller rejects alternate source, extra jobs, inherited secrets and command inputs", async () => {
  const definition = callerWorkflowDefinition(sourceSHA);
  for (const mutate of [
    (value: object) => { Object.assign(value, { extra: "TEST" }); },
    (value: object) => { Object.assign(value, { jobs: { source: { uses: `${TARGET.repository}/${SOURCE_WORKFLOW}@refs/heads/main` } } }); },
    (value: object) => { Object.assign(value, { jobs: { source: { uses: `${TARGET.repository}/${SOURCE_WORKFLOW}@${sourceSHA}`, secrets: "inherit" } } }); },
    (value: object) => { Object.assign(value, { jobs: { source: { uses: `${TARGET.repository}/${SOURCE_WORKFLOW}@${sourceSHA}`, with: { command: "TEST" } } } }); },
  ]) {
    const value = structuredClone(definition); mutate(value);
    await assert.rejects(assertCallerWorkflow(Buffer.from(stringify(value)), sourceSHA));
  }
  await assert.rejects(assertCallerWorkflow(Buffer.from(stringify(callerWorkflowDefinition("b".repeat(40)))), sourceSHA));
});

test("the installed caller, decision and qualification evidence cannot certify their own changes", async () => {
  for (const path of [CALLER_WORKFLOW, ADR_PATH, EVIDENCE_PATH]) {
    const f = installationFixture();
    f.envelope.baseTree = structuredClone(f.envelope.headTree);
    f.envelope.baseInputs = structuredClone(f.envelope.headInputs);
    f.envelope.baseSHA = "c".repeat(40); f.envelope.live.baseSHA = f.envelope.baseSHA;
    f.envelope.files = [];
    change(f, path, Buffer.from("unreviewed installed authority edit TEST\n"));
    assert.equal(checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock), "noop");
    await assert.rejects(checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA), /protected|v2/iu);
  }
});

test("frozen v1 source, focused test, workflow, decision and compiler inputs remain immutable", async () => {
  for (const path of legacyInputs) {
    const f = legacyFixture(TARGET.headSHA, TARGET.headSHA); change(f, path, Buffer.from("frozen-input negative TEST\n"));
    assert.throws(() => checkDocsSourceSuccessor(f.envelope, f.baseManifest, f.baseLock));
    await assert.rejects(checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA));
  }
});

test("finite source adoption is selected only by the actual complete reviewed tuple", async () => {
  const f = legacyFixture(TARGET.baseSHA, TARGET.headSHA, TARGET.pullRequest);
  assert.equal(await checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA), "owner-name-alias");
  const wrongPull = structuredClone(f.envelope); wrongPull.pullRequest++; wrongPull.live.pullRequest++;
  await assert.rejects(checkSourceSuccessor(wrongPull, f.baseManifest, f.baseLock, sourceSHA));
  const extra = legacyFixture(TARGET.baseSHA, TARGET.headSHA, TARGET.pullRequest);
  change(extra, "README.md", Buffer.from("unreviewed addition TEST\n"));
  await assert.rejects(checkSourceSuccessor(extra.envelope, extra.baseManifest, extra.baseLock, sourceSHA));
});

test("live target binds owner name alias, repository, draft state and exact head/base", () => {
  assert.ok(targetPullSnapshot(pull()));
  for (const mutate of [
    (value: ReturnType<typeof pull>) => { value.head.sha = "e".repeat(40); },
    (value: ReturnType<typeof pull>) => { value.base.sha = "e".repeat(40); },
    (value: ReturnType<typeof pull>) => { value.user.id = 1; },
    (value: ReturnType<typeof pull>) => { value.user.type = "Bot"; },
    (value: ReturnType<typeof pull>) => { value.draft = true; },
    (value: ReturnType<typeof pull>) => { value.head.repo = { id: 1, full_name: "other/repo" }; },
  ]) { const value = structuredClone(pull()); mutate(value); assert.throws(() => targetPullSnapshot(value)); }
});

test("assembled source evidence detects live target, source, run, lock and main drift after collection", async () => {
  const f = collectorFixture();
  const bound = await collectSourceEvidence(f.api, executorFromEnvironment(pushEnvironment()));
  assert.deepEqual(bound.baseManifest, git("show", `${TARGET.baseSHA}:package.json`));
  assert.deepEqual(bound.baseLock, git("show", `${TARGET.baseSHA}:pnpm-lock.yaml`));
  assert.deepEqual(bound.protectionObservation, HOSTED_PROTECTION_OBSERVATION);
  assert.equal(await checkSourceSuccessor(bound.evidence, bound.baseManifest, bound.baseLock, sourceSHA), "owner-name-alias");
  const stable = structuredClone(f.state);
  for (const mutate of [
    () => { f.state.pull.head.sha = "e".repeat(40); },
    () => { f.state.pull.user.id = 1; },
    () => { f.state.branch = "e".repeat(40); },
    () => { f.state.source = "e".repeat(40); },
    () => { f.state.sourceProtected = false; },
    () => { f.state.runAttempt = 3; },
    () => { f.state.lock.enforcement = "disabled"; },
    () => { f.state.main.rules.pop(); },
    () => { f.state.fork = true; },
  ]) {
    Object.assign(f.state, structuredClone(stable)); mutate(); await assert.rejects(bound.recheck());
  }
  Object.assign(f.state, structuredClone(stable)); await bound.recheck();
});

test("collector rejects incomplete file evidence and forged blob bytes rather than deferring to a successful job", async () => {
  const files = collectorFixture(); files.state.files.pop();
  await assert.rejects(collectSourceEvidence(files.api, executorFromEnvironment(pushEnvironment())), /file|count/iu);
  const blob = collectorFixture(); blob.state.corruptBlob = true;
  await assert.rejects(collectSourceEvidence(blob.api, executorFromEnvironment(pushEnvironment())), /blob|content/iu);
});

test("actual reusable collection binds installed main caller, target-base bytes and referenced source workflow", async () => {
  const f = collectorFixture(true), executor = executorFromEnvironment(f.env, f.event);
  const bound = await collectSourceEvidence(f.api, executor);
  assert.equal(bound.executor.sourceSHA, sourceSHA);
  assert.equal(bound.executor.callerWorkflowSHA, f.state.pull.base.sha);
  assert.deepEqual(bound.baseManifest, git("show", `${TARGET.headSHA}:package.json`));
  assert.deepEqual(bound.baseLock, git("show", `${TARGET.headSHA}:pnpm-lock.yaml`));
  assert.equal(await checkSourceSuccessor(bound.evidence, bound.baseManifest, bound.baseLock, sourceSHA), "noop");
  f.state.referencedSHA = "e".repeat(40); await assert.rejects(bound.recheck(), /reference|source/iu);
  for (const path of [CALLER_WORKFLOW, ADR_PATH, EVIDENCE_PATH, ...qualityHelpers]) {
    const changed = collectorFixture(true, path);
    await assert.rejects(collectSourceEvidence(changed.api, executorFromEnvironment(changed.env, changed.event)), /protected|input/iu);
  }
});

test("push execution binds actual called-workflow provenance and a genuine staging attempt", () => {
  assert.equal(executorFromEnvironment(pushEnvironment()).runAttempt, 2);
  for (const [key, value] of [
    ["SOURCE_WORKFLOW_SHA", "0".repeat(40)], ["SOURCE_WORKFLOW_REPOSITORY", "other/repo"],
    ["SOURCE_WORKFLOW_PATH", ".github/workflows/other.yml"], ["GITHUB_REF", "refs/heads/main"],
    ["GITHUB_RUN_ATTEMPT", "0"], ["GITHUB_EVENT_NAME", "pull_request"],
  ]) { assert.throws(() => executorFromEnvironment({ ...pushEnvironment(), [key!]: value })); }
});

test("reusable execution keeps called-source identity separate from its protected main caller", () => {
  const value = pull();
  const env = { ...pushEnvironment(), GITHUB_EVENT_NAME: "pull_request_target", GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: value.base.sha, GITHUB_WORKFLOW_SHA: value.base.sha,
    GITHUB_WORKFLOW_REF: `${TARGET.repository}/${CALLER_WORKFLOW}@refs/heads/main`,
    SOURCE_WORKFLOW_REF: `${TARGET.repository}/${SOURCE_WORKFLOW}@${sourceSHA}` };
  const executor = executorFromEnvironment(env, { pull_request: value });
  assert.equal(executor.mode, "reusable"); assert.equal(executor.sourceSHA, sourceSHA);
  assert.equal(executor.callerWorkflowSHA, value.base.sha); assert.equal(executor.targetHeadSHA, value.head.sha);
  assert.notEqual(executor.sourceSHA, executor.callerWorkflowSHA);
  for (const [key, changed] of [
    ["SOURCE_WORKFLOW_REF", `${TARGET.repository}/${SOURCE_WORKFLOW}@refs/heads/main`],
    ["GITHUB_SHA", value.head.sha], ["GITHUB_WORKFLOW_SHA", value.head.sha],
    ["GITHUB_WORKFLOW_REF", `${TARGET.repository}/${SOURCE_WORKFLOW}@refs/heads/main`],
  ]) { assert.throws(() => executorFromEnvironment({ ...env, [key!]: changed }, { pull_request: value })); }
});

test("staging lock accepts GitHub normalized update or explicit false and rejects weakened variants", () => {
  assert.equal(assertStagingProtection([stagingLock()]), 1);
  const explicit = stagingLock(); Object.assign(explicit.rules[0]!, { parameters: { update_allows_fetch_and_merge: false } });
  assert.equal(assertStagingProtection([explicit]), 1);
  for (const parameters of [null, {}, { update_allows_fetch_and_merge: true }, { update_allows_fetch_and_merge: false, extra: true }]) {
    const value = stagingLock(); Object.assign(value.rules[0]!, { parameters });
    assert.throws(() => assertStagingProtection([value]));
  }
  for (const mutate of [
    (value: ReturnType<typeof stagingLock>) => { value.enforcement = "disabled"; },
    (value: ReturnType<typeof stagingLock>) => { value.bypass_actors = [{}]; },
    (value: ReturnType<typeof stagingLock>) => { value.current_user_can_bypass = "always"; },
    (value: ReturnType<typeof stagingLock>) => { value.conditions.ref_name.include = ["~ALL"]; },
  ]) { const value = stagingLock(); mutate(value); assert.throws(() => assertStagingProtection([value])); }
});

test("hosted public-read protection never certifies private bypass actors", () => {
  const hidden = Object.fromEntries(Object.entries(stagingLock()).filter(([key]) => !["bypass_actors", "current_user_can_bypass"].includes(key)));
  assert.equal(assertStagingProtection([hidden], "public_read"), 1);
  assert.throws(() => assertStagingProtection([hidden], "owner_full"));
  assert.deepEqual(HOSTED_PROTECTION_OBSERVATION, { mode: "public_read", privateBypass: "not_attested", ownerFullReadRequiredForCutover: true });
  assert.throws(() => assertStagingProtection([{ ...hidden, bypass_actors: null }], "public_read"));
});

test("main cutover changes only the source requirement and preserves all other contexts and policy", () => {
  const value = protection(); assertMainProtection(value.main, value.identity);
  const required = value.main.rules.find(rule => rule.type === "required_status_checks")!;
  Object.assign(required, statusRule([...contexts, SOURCE_CONTEXT])); assertMainProtection(value.main, value.identity);
  Object.assign(required, statusRule([...contexts.filter(name => name !== "docs-quality-source-successor-v2"), SOURCE_CONTEXT]));
  assertMainProtection(value.main, value.identity);
  for (const missing of ["check", "trusted-admission-evidence", "trusted-validation", "trusted-admission-authority-evolution-v1"]) {
    Object.assign(required, statusRule([...contexts.filter(name => ![missing, "docs-quality-source-successor-v2"].includes(name)), SOURCE_CONTEXT]));
    assert.throws(() => assertMainProtection(value.main, value.identity));
  }
  Object.assign(required, statusRule(contexts));
  value.identity.rules[0]!.parameters.required_status_checks[0]!.integration_id = 1;
  assert.throws(() => assertMainProtection(value.main, value.identity));
});

test("status transport refuses every legacy context and any unrelated new context", async () => {
  const api = createGitHubReadApi("synthetic-token-never-sent");
  for (const context of [...contexts, "commit-author-identity", "owner-name-alias-retirement-source-v1", "other-new-context"]) {
    await assert.rejects(async () => api.postStatus(TARGET.headSHA, {
      context, state: "success", target_url: "https://example.test", description: "TEST",
    }), /context|unowned|legacy/iu);
  }
});

test("a finite push publisher revokes its old success when live target metadata moved", async () => {
  const posts: string[] = []; const value = pull(); value.head.sha = "e".repeat(40);
  const api: GitHubStatusApi = { get: async () => value, postStatus: async (_head, status) => { posts.push(status.state); return {}; } };
  await assert.rejects(publishSourceSuccessor(api, executorFromEnvironment(pushEnvironment())));
  assert.deepEqual(posts, ["pending", "failure"]);
});

test("publisher marks only its own new context pending then failure when source verification fails", async () => {
  const posted: { context: string; state: string; head: string }[] = [];
  const api: GitHubStatusApi = {
    get: async path => { if (path.endsWith(`/pulls/${TARGET.pullRequest}`)) { return pull(); } throw new Error("TEST protected source API unavailable"); },
    postStatus: async (head, status) => { posted.push({ head, context: status.context, state: status.state }); return {}; },
  };
  await assert.rejects(publishSourceSuccessor(api, executorFromEnvironment(pushEnvironment())), /TEST protected source API unavailable/u);
  assert.deepEqual(posted, [
    { head: TARGET.headSHA, context: SOURCE_CONTEXT, state: "pending" },
    { head: TARGET.headSHA, context: SOURCE_CONTEXT, state: "failure" },
  ]);
});

test("publisher job evidence requires current-attempt decisive tests and semantics rather than skipped steps", async () => {
  const input = executorFromEnvironment(pushEnvironment()); assert.ok("pullRequest" in input);
  const executor = { ...input, sourceTreeSHA: TARGET.baseTreeSHA };
  const jobs = [
    { id: 1, name: "qualify", decisive: "Exercise accepting and rejecting source successor cases" },
    { id: 2, name: "source", decisive: "Verify actual protected source semantics" },
  ].map(job => ({ ...job, run_id: executor.runId, run_attempt: executor.runAttempt, head_sha: executor.sourceSHA,
    status: "completed", conclusion: "success", steps: [
      { name: "Set up job", status: "completed", conclusion: "success" },
      { name: job.decisive, status: "completed", conclusion: "success" },
    ] }));
  const api: GitHubReadApi = { get: async () => ({ total_count: jobs.length, jobs }) };
  await assertCurrentSuccessfulJobs(api, executor);
  for (const index of [0, 1]) {
    jobs[index]!.steps[1]!.conclusion = "skipped";
    await assert.rejects(assertCurrentSuccessfulJobs(api, executor), /decisive|step|semantic|test/iu);
    jobs[index]!.steps[1]!.conclusion = "success";
  }
  jobs[1]!.run_attempt++;
  await assert.rejects(assertCurrentSuccessfulJobs(api, executor), /attempt|succeed/iu);
});

test("independent Git object oracle checks that complete-tree fixtures are genuine", () => {
  const bytes = git("cat-file", "tree", TARGET.baseTreeSHA);
  assert.equal(hash("tree", bytes), TARGET.baseTreeSHA);
  const fixture = ordinaryFixture();
  const parsed = parseCompleteTree(fixture.envelope.headTree, fixture.envelope.headTree.sha);
  assert.equal(parsed.sha, fixture.envelope.headTree.sha);
});

function identityFixture() {
  const value = pull(), account = { type: "User", login: "777genius", id: 13103045 };
  const commit = { sha: value.head.sha, author: { ...account } as unknown, committer: { ...account } as unknown,
    commit: { author: { name: "Илия", email: "iliyazelenkog@gmail.com" }, committer: { name: "iliya", email: "iliyazelenkog@gmail.com" } } };
  return { pull: value, commit, open: [value] };
}

test("source identity accepts all four exact canonical and Cyrillic owner-name combinations", () => {
  for (const author of ["iliya", "Илия"]) {
    for (const committer of ["iliya", "Илия"]) {
      const f = identityFixture();
      f.commit.commit.author.name = author; f.commit.commit.committer.name = committer;
      assert.ok(assertCommitIdentity(f.pull, [f.commit], f.open));
    }
  }
});

test("owner account associations never admit alternate emails or unapproved raw names in either role", () => {
  for (const role of ["author", "committer"] as const) {
    for (const person of [
      { name: "iliya", email: "alternate@example.test" },
      { name: "Илия", email: "13103045+777genius@users.noreply.github.com" },
      { name: "Another human name", email: "iliyazelenkog@gmail.com" },
      { name: "Iliya", email: "iliyazelenkog@gmail.com" },
      { name: "iliya ", email: "iliyazelenkog@gmail.com" },
    ]) {
      const f = identityFixture(); f.commit.commit[role] = person;
      assert.throws(() => assertCommitIdentity(f.pull, [f.commit], f.open), /exact iliya/u);
    }
  }
});

test("raw owner claims, mixed roles and forged account IDs cannot replace BOTH owner associations", () => {
  const foreign = { type: "User", login: "external-human", id: 42 };
  for (const role of ["author", "committer"] as const) {
    for (const account of [null, foreign, { type: "Bot", login: "777genius", id: 13103045 }, { type: "User", login: "777genius", id: 42 }]) {
      const f = identityFixture(); f.commit[role] = account;
      assert.throws(() => assertCommitIdentity(f.pull, [f.commit], f.open));
    }
  }
  for (const person of [{ name: "777genius", email: "unassociated@example.test" },
    { name: "Other person", email: "iliyazelenkog@gmail.com" }, { name: "iliya", email: "unassociated@example.test" },
    { name: "Илия", email: "unassociated@example.test" }, { name: "ИЛИЯ", email: "unassociated@example.test" }]) {
    const f = identityFixture(); f.commit.author = null; f.commit.commit.author = person; f.commit.committer = foreign;
    assert.throws(() => assertCommitIdentity(f.pull, [f.commit], f.open));
  }
});

test("owner associations do not admit Bot, technical, malformed or Codex metadata in either source role", () => {
  for (const role of ["author", "committer"] as const) {
    for (const person of [
      { name: "GitHub", email: "noreply@github.com" }, { name: "codex", email: "person@example.test" },
      { name: "OpenAI Codex", email: "person@example.test" }, { name: "person", email: "openai@openai.com" },
      { name: "person[bot]", email: "person@example.test" }, { name: "person\nforged", email: "person@example.test" },
      { name: " ", email: "person@example.test" }, { name: "person", email: "two@@example.test" },
    ]) {
      const f = identityFixture(); f.commit.commit[role] = person;
      assert.throws(() => assertCommitIdentity(f.pull, [f.commit], f.open));
    }
  }
});

test("external human attribution and its technical committer retain the existing contributor flow", () => {
  const f = identityFixture(); f.pull.user = { type: "User", login: "external-human", id: 42 };
  f.commit.author = { type: "User", login: "external-human", id: 42 };
  f.commit.committer = { type: "User", login: "web-flow", id: 19864447 };
  f.commit.commit = { author: { name: "External Person", email: "person@example.test" }, committer: { name: "GitHub", email: "noreply@github.com" } };
  assert.ok(assertCommitIdentity(f.pull, [f.commit], f.open));
  f.commit.author = null; assert.ok(assertCommitIdentity(f.pull, [f.commit], f.open));
  f.commit.author = { type: "User", login: "external-human", id: 42 };
  f.commit.commit.author.name = "Илия"; assert.ok(assertCommitIdentity(f.pull, [f.commit], f.open));
});

test("identity proof rejects incomplete, duplicate, non-current and oversized commit evidence", () => {
  for (const count of [0, 251]) {
    const f = identityFixture(); f.pull.commits = count;
    assert.throws(() => assertCommitIdentity(f.pull, [f.commit], f.open));
  }
  const f = identityFixture();
  assert.throws(() => assertCommitIdentity(f.pull, [], f.open));
  assert.throws(() => assertCommitIdentity(f.pull, [{ ...f.commit, sha: "e".repeat(40) }], f.open));
  f.pull.commits = 2; assert.throws(() => assertCommitIdentity(f.pull, [f.commit, f.commit], f.open));
});

test("same-head Bot PRs block the shared status even when a genuine owner PR is valid", async () => {
  const f = collectorFixture(), bound = await collectSourceEvidence(f.api, executorFromEnvironment(f.env));
  f.state.openPulls = [f.state.pull, { ...f.state.pull, number: 999, user: { type: "Bot", login: "renovate[bot]", id: 42 } }];
  await assert.rejects(bound.recheck(), /conflicting|Bot|head/iu);
  f.state.openPulls = []; await assert.rejects(bound.recheck(), /head/iu);
});

test("identity associations are reread before status success on every target route", async () => {
  const f = collectorFixture(true), bound = await collectSourceEvidence(f.api, executorFromEnvironment(f.env, f.event));
  const changed = identityFixture().commit; changed.sha = f.state.pull.head.sha; changed.committer = null;
  f.state.commits = [changed]; await assert.rejects(bound.recheck());
});

const canaryEvent = (f: ReturnType<typeof collectorFixture>): object => ({
  repository, ref: f.env.GITHUB_REF, after: f.env.GITHUB_SHA, deleted: false,
});

test("canonical canary is an inputless push caller pinned to source and cannot execute target code", async () => {
  await assertCanaryWorkflow(Buffer.from(stringify(canaryWorkflowDefinition(sourceSHA))), sourceSHA);
  for (const extra of [{ secrets: "inherit" }, { with: { target: TARGET.headSHA } }, { steps: [{ run: "echo unsafe" }] }]) {
    const definition = canaryWorkflowDefinition(sourceSHA);
    Object.assign(definition, { jobs: { source: { uses: `${TARGET.repository}/${SOURCE_WORKFLOW}@${sourceSHA}`, ...extra } } });
    await assert.rejects(assertCanaryWorkflow(Buffer.from(stringify(definition)), sourceSHA));
  }
  await assert.rejects(assertCanaryWorkflow(Buffer.from(stringify(canaryWorkflowDefinition("e".repeat(40)))), sourceSHA));
});

test("genuine canary push derives its unique current target from actual head and branch without changing main", async () => {
  const f = collectorFixture(true, undefined, true), input = executorFromEnvironment(f.env, canaryEvent(f));
  assert.equal(input.mode, "canary"); assert.ok(!("pullRequest" in input));
  const bound = await collectSourceEvidence(f.api, input);
  assert.equal(bound.executor.targetBaseSHA, f.state.pull.base.sha);
  assert.equal(bound.executor.targetHeadSHA, f.env.GITHUB_SHA);
  assert.ok(!bound.baseTree.entries.has(CALLER_WORKFLOW), "Bootstrap must not require a previously installed main caller");
  assert.equal(await checkSourceSuccessor(bound.evidence, bound.baseManifest, bound.baseLock, sourceSHA), "noop");
  for (const [key, value] of [["GITHUB_SHA", "e".repeat(40)], ["GITHUB_WORKFLOW_SHA", sourceSHA],
    ["GITHUB_REF", "refs/heads/unapproved"], ["SOURCE_WORKFLOW_REF", `${TARGET.repository}/${SOURCE_WORKFLOW}@refs/heads/main`]]) {
    assert.throws(() => executorFromEnvironment({ ...f.env, [key!]: value }, canaryEvent(f)));
  }
});

test("canary cannot choose a missing, duplicate, different-repository or moved PR", async () => {
  const f = collectorFixture(true, undefined, true), input = executorFromEnvironment(f.env, canaryEvent(f));
  for (const values of [[], [f.state.pull, f.state.pull],
    [{ ...f.state.pull, head: { ...f.state.pull.head, repo: { id: 42, full_name: "foreign/repo" } } }]]) {
    f.state.openPulls = values; await assert.rejects(resolveExecutionTarget(f.api, input), /exactly one/iu);
  }
  f.state.openPulls = undefined;
  const resolved = await resolveExecutionTarget(f.api, input);
  f.state.pull.head.ref = "qualification/unapproved";
  await assert.rejects(resolveExecutionTarget(f.api, resolved), /exactly one/iu);
});

test("protected-input negative canary reaches the real frozen verifier and fails its source semantics", async () => {
  const f = collectorFixture(true, "governance/commit-author-identity.json", true);
  const bound = await collectSourceEvidence(f.api, executorFromEnvironment(f.env, canaryEvent(f)));
  await assert.rejects(checkSourceSuccessor(bound.evidence, bound.baseManifest, bound.baseLock, sourceSHA), /protected|identity|changed/iu);
});

test("old immutable v2 branch and lock remain required and are reread", async () => {
  const f = collectorFixture(), bound = await collectSourceEvidence(f.api, executorFromEnvironment(f.env));
  f.state.previousSource = "e".repeat(40); await assert.rejects(bound.recheck(), /frozen|v2/iu);
  f.state.previousSource = PREVIOUS_SOURCE_SHA; f.state.previousProtected = false;
  await assert.rejects(bound.recheck(), /frozen|v2/iu);
  f.state.previousProtected = true; f.state.previousLock.rules.pop();
  await assert.rejects(bound.recheck(), /lock/iu);
  for (const path of PREVIOUS_SOURCE_INPUTS) {
    const ordinary = ordinaryFixture(); change(ordinary, path, Buffer.from("unreviewed predecessor authority edit TEST\n"));
    await assert.rejects(checkSourceSuccessor(ordinary.envelope, ordinary.baseManifest, ordinary.baseLock, sourceSHA), /protected/iu);
  }
});

const withoutStatuses = (rules: readonly unknown[]): unknown[] => rules.filter(rule => (rule as { type: string }).type !== "required_status_checks");

test("cutover proposal preserves full rules and cannot retire either predecessor before additive readback", () => {
  const f = protection(), original = structuredClone(f);
  assert.throws(() => planProtectionTransition(f.main, f.identity, "retire"), /bridge/iu);
  const added = planProtectionTransition(f.main, f.identity, "add") as { main: typeof f.main; identity: typeof f.identity };
  assert.deepEqual(f, original, "Proposal generator must not mutate observed protections");
  const retired = planProtectionTransition(added.main, added.identity, "retire") as { main: typeof f.main; identity: typeof f.identity };
  assertMainProtection(retired.main, retired.identity);
  assert.deepEqual(withoutStatuses(retired.main.rules), withoutStatuses(original.main.rules));
  assert.deepEqual(retired.main.conditions, original.main.conditions);
  assert.deepEqual(retired.main.bypass_actors, []); assert.deepEqual(retired.identity.bypass_actors, []);
  assert.throws(() => planProtectionTransition(added.main, added.identity, "add"), /already/iu);
  const hidden = structuredClone(f); delete (hidden.main as { bypass_actors?: unknown }).bypass_actors;
  assert.throws(() => planProtectionTransition(hidden.main, hidden.identity, "add"), /bypass/iu);
});

test("the defining workflow runs only source-owned code, frozen installs and unconditional owned publication", async () => {
  const workflow = parse(await readFile(new URL(`../${SOURCE_WORKFLOW}`, import.meta.url), "utf8")) as {
    on: object; jobs: Record<string, { permissions: object; if?: string; needs?: string[]; steps: { uses?: string; with?: Record<string, unknown>; run?: string }[] }>;
  };
  assert.deepEqual(workflow.on, { push: { branches: [SOURCE_REF.slice("refs/heads/".length)] }, workflow_call: null });
  assert.deepEqual(Object.keys(workflow.jobs), ["qualify", "source", "publish"]);
  for (const [name, job] of Object.entries(workflow.jobs)) {
    const checkouts = job.steps.filter(step => step.uses?.startsWith("actions/checkout@"));
    assert.equal(checkouts.length, 1);
    assert.deepEqual(checkouts[0]!.with, { repository: "${{ job.workflow_repository }}", ref: "${{ job.workflow_sha }}",
      "fetch-depth": 0, "persist-credentials": false });
    assert.ok(job.steps.filter(step => step.uses !== undefined).every(step => /@[0-9a-f]{40}$/u.test(step.uses!)));
    if (name !== "publish") {
      assert.ok(job.steps.some(step => step.run === (name === "qualify"
        ? "pnpm install --frozen-lockfile --ignore-pnpmfile"
        : "pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile")));
    }
  }
  assert.equal(workflow.jobs.publish!.if, "always()");
  assert.deepEqual(workflow.jobs.publish!.needs, ["qualify", "source"]);
  assert.deepEqual(workflow.jobs.publish!.permissions, { actions: "read", contents: "read", "pull-requests": "read", statuses: "write" });
  assert.ok(workflow.jobs.qualify!.steps.some(step => step.run === "pnpm exec tsc --project tsconfig.owner-name-alias-source-successor-v1.json"));
  const full = workflow.jobs.qualify!.steps.findIndex(step => step.run === "pnpm check");
  const binding = workflow.jobs.qualify!.steps.findIndex(step => step.run === "node scripts/owner-name-alias-source-successor-v1.ts qualify");
  assert.ok(full >= 0 && binding > full, "Full central quality suite must succeed before live source binding");
});

test("a valid-metadata Bot PR revokes a previously shared success through pending then failure", async () => {
  const f = collectorFixture(true), bot = { type: "Bot", login: "renovate[bot]", id: 42 };
  f.state.pull.user = bot;
  const event = { pull_request: structuredClone(f.state.pull) };
  const posted: { head: string; context: string; state: string }[] = [];
  const api: GitHubStatusApi = { ...f.api, postStatus: async (head, value) => {
    posted.push({ head, context: value.context, state: value.state }); return {};
  } };
  await assert.rejects(publishSourceSuccessor(api, executorFromEnvironment(f.env, event)), /Bot|forbidden/iu);
  assert.deepEqual(posted, [
    { head: f.state.pull.head.sha, context: SOURCE_CONTEXT, state: "pending" },
    { head: f.state.pull.head.sha, context: SOURCE_CONTEXT, state: "failure" },
  ]);
});

test("the full central test route reaches the actual dedicated strict successor compiler and exact census", async () => {
  const project = JSON.parse(await readFile(new URL("../tsconfig.owner-name-alias-source-successor-v1.json", import.meta.url), "utf8")) as unknown;
  const files = ["scripts/owner-name-alias-source-successor-v1.ts", "scripts/owner-name-alias-source-successor-v1.test.ts"];
  assert.deepEqual(project, { extends: "./tsconfig.tooling.json", include: files });
  const args = ["node_modules/typescript/bin/tsc", "--project", "tsconfig.owner-name-alias-source-successor-v1.json"];
  const options = { cwd: new URL("../", import.meta.url), timeout: 30_000, maxBuffer: 1024 * 1024, encoding: "utf8" as const };
  const effective = JSON.parse(execFileSync(process.execPath, [...args, "--showConfig"], options)) as {
    files: string[]; compilerOptions: Record<string, unknown>;
  };
  assert.deepEqual(effective.files, files.map(path => `./${path}`));
  for (const option of ["strict", "noEmit", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes"]) {
    assert.equal(effective.compilerOptions[option], true);
  }
  assert.notEqual(effective.compilerOptions.noCheck, true);
  const compiled = execFileSync(process.execPath, [...args, "--listFiles"], options).trim().split("\n");
  assert.deepEqual(compiled.filter(path => path.includes("/scripts/owner-name-alias-source-successor-v1."))
    .map(path => path.slice(path.indexOf("/scripts/") + 1)).toSorted(), files.toSorted());
  assert.ok(compiled.some(path => path.endsWith("/scripts/check-docs-source-successor-v1.mts")), "Compile the real frozen dependency too");
});

test("a missing or closed canary PR cannot leave a previous shared-SHA success green", async () => {
  const f = collectorFixture(true, undefined, true), input = executorFromEnvironment(f.env, canaryEvent(f));
  f.state.openPulls = [];
  const posted: { head: string; context: string; state: string }[] = [];
  const api: GitHubStatusApi = { ...f.api, postStatus: async (head, value) => {
    posted.push({ head, context: value.context, state: value.state }); return {};
  } };
  await assert.rejects(publishSourceSuccessor(api, input), /exactly one/iu);
  assert.deepEqual(posted, [
    { head: input.targetHeadSHA, context: SOURCE_CONTEXT, state: "pending" },
    { head: input.targetHeadSHA, context: SOURCE_CONTEXT, state: "failure" },
  ]);
});
