import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse, stringify } from "yaml";
import { TARGET as HISTORICAL_TARGET } from "./docs-quality-source-successor-v2.ts";
import { assertCallerWorkflow, assertMainProtection, assertSourceTuple, assertStagingProtection,
  callerWorkflowDefinition, checkSourceSuccessor, collectSourceEvidence, createGitHubReadApi,
  executorFromEnvironment, requireTarget, parseCompleteTree, targetPullSnapshot, SOURCE_CONTEXT, SOURCE_REF, SOURCE_WORKFLOW, CALLER_WORKFLOW,
  TARGET, TARGET_TUPLE, PREVIOUS_CONTENT_PACKET_SHA256, CURRENT_CONTENT_PACKET_SHA256 } from "./docs-quality-source-successor-v3.ts";
import type { GitHubReadApi, GitHubStatusApi, ProtectedExecutor } from "./docs-quality-source-successor-v3.ts";

const IDENTITY = { repository: "agent-teams-ai/.github", repositoryId: 1316243981 };
const BASE = "7ec79111e02c61014760d6427d2b55d821f35e61";
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
const inputEvidence = (tree: RawTree): Record<string, Entry | null> => Object.fromEntries(legacyInputs.map(path => [path, tree.tree.find(entry => entry.path === path) ?? null]));
function legacyFixture(baseRevision: string, headRevision: string, pullRequest = 77) {
  const baseTree = treeAt(baseRevision), headTree = treeAt(headRevision), files = filesBetween(baseRevision, headRevision);
  const baseManifest = git("show", `${baseRevision}:package.json`), baseLock = git("show", `${baseRevision}:pnpm-lock.yaml`);
  const envelope = {
    repository: IDENTITY.repository, pullRequest, base: "5abed741aff64506d0e9f87f76541a4e93af7e4a",
    reviewTarget: "96cb95a89ca4a133fbb626133eb3ac6289938ff7",
    baseSHA: baseRevision, headSHA: headRevision, sourceSHA: headRevision,
    baseRef: "main", defaultBranch: "main", headRepository: IDENTITY.repository,
    paginationComplete: true, changedFiles: files.length, files, baseTree, headTree,
    baseInputs: inputEvidence(baseTree), headInputs: inputEvidence(headTree),
    headData: Object.fromEntries(["package.json", "pnpm-lock.yaml"].map(path => [path, encoded(git("show", `${headRevision}:${path}`))])),
    live: { state: "open", pullRequest, repository: IDENTITY.repository, baseSHA: baseRevision, headSHA: headRevision,
      sourceSHA: headRevision, baseRef: "main", defaultBranch: "main", headRepository: IDENTITY.repository, changedFiles: files.length },
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
  const f = legacyFixture(TARGET.headSHA, TARGET.headSHA); change(f, "README.md", Buffer.from("Inert ordinary v3 fixture\n")); return f;
}
function stackDependencyFixture(): LegacyFixture {
  const f = legacyFixture(TARGET.headSHA, TARGET.headSHA);
  const manifest = JSON.parse(f.baseManifest.toString()) as { devDependencies: Record<string, string> };
  const lock = parse(f.baseLock.toString()) as {
    importers: Record<string, { devDependencies: Record<string, { specifier: string; version: string }> }>;
    packages: Record<string, { resolution: { integrity: string } }>; snapshots: Record<string, unknown>;
  };
  // Only inert future head metadata changes; the base remains the exact real F3 target.
  const previous = manifest.devDependencies["stack-toolchain"]!;
  assert.equal(previous, "0.1.1");
  const oldKey = `stack-toolchain@${previous}`, nextKey = "stack-toolchain@0.1.2";
  manifest.devDependencies["stack-toolchain"] = "0.1.2";
  lock.importers["."]!.devDependencies["stack-toolchain"] = { specifier: "0.1.2", version: "0.1.2" };
  lock.packages[nextKey] = structuredClone(lock.packages[oldKey]!);
  lock.packages[nextKey]!.resolution.integrity = `sha512-${Buffer.alloc(64, 7).toString("base64")}`;
  lock.snapshots[nextKey] = structuredClone(lock.snapshots[oldKey]);
  delete lock.packages[oldKey]; delete lock.snapshots[oldKey];
  change(f, "package.json", Buffer.from(JSON.stringify(manifest))); change(f, "pnpm-lock.yaml", Buffer.from(stringify(lock)));
  return f;
}
const run = (f: LegacyFixture): Promise<string> => checkSourceSuccessor(f.envelope, f.baseManifest, f.baseLock, sourceSHA);

test("bound finite target uses the actual PR392 two-commit ninety-six-file Git delta", async () => {
  assert.equal(PREVIOUS_CONTENT_PACKET_SHA256, "56b101258eccd51149dac8cc7ba61eddad81801ef9f272be4178485be4fad23e");
  assert.equal(CURRENT_CONTENT_PACKET_SHA256, "d3e2615e1ebb27cfd1f27c3b266449e7020586f21a9c34042ce08cd701a38f42");
  assert.equal(requireTarget(), TARGET); assert.equal(TARGET.changedFiles, 96); assert.equal(TARGET.commits, 2);
  assert.equal(git("rev-list", "--count", `${TARGET.baseSHA}..${TARGET.headSHA}`).toString().trim(), "2");
  const f = legacyFixture(TARGET.baseSHA, TARGET.headSHA, TARGET.pullRequest);
  const base = parseCompleteTree(f.envelope.baseTree, TARGET.baseTreeSHA);
  const head = parseCompleteTree(f.envelope.headTree, TARGET.headTreeSHA);
  assert.equal(f.envelope.files.length, 96); assert.equal(TARGET_TUPLE.length, 96);
  assertSourceTuple(base, head, [f.envelope.files]); assert.equal(await run(f), "quality-runtime");
});

test("finite target refuses incomplete, duplicate, renamed, wrong-blob and wrong-tree evidence", () => {
  const f = legacyFixture(TARGET.baseSHA, TARGET.headSHA, TARGET.pullRequest), files = f.envelope.files;
  const base = parseCompleteTree(f.envelope.baseTree, TARGET.baseTreeSHA);
  const head = parseCompleteTree(f.envelope.headTree, TARGET.headTreeSHA);
  for (const invalid of [files.slice(1), [...files, files[0]!], [files[1]!, ...files.slice(1)],
    [{ ...files[0]!, previous_filename: "other.md" }, ...files.slice(1)],
    [{ ...files[0]!, sha: "e".repeat(40) }, ...files.slice(1)]]) {
    assert.throws(() => assertSourceTuple(base, head, [invalid]));
  }
  assert.throws(() => assertSourceTuple(head, base, [files]), /tree drift/u);
  for (const mutate of [(tree: RawTree) => { tree.truncated = true; },
    (tree: RawTree) => { tree.tree.pop(); }, (tree: RawTree) => { tree.tree.push(tree.tree[0]!); },
    (tree: RawTree) => { tree.tree.find(entry => entry.type === "blob")!.mode = "120000"; }]) {
    const tree = structuredClone(f.envelope.headTree); mutate(tree);
    assert.throws(() => parseCompleteTree(tree, TARGET.headTreeSHA));
  }
});

function targetPull() {
  const repo = { id: TARGET.repositoryId, full_name: TARGET.repository };
  return { number: TARGET.pullRequest, id: TARGET.pullId, state: "open", merged: false, draft: false,
    user: { id: 13103045, type: "User", login: "777genius" }, changed_files: 96, commits: 2,
    base: { repo, sha: TARGET.baseSHA, ref: "main" }, head: { repo, sha: TARGET.headSHA, ref: "inert-source-target" } };
}

test("exact PR identity refuses old attempt, wrong owner, commit count and target coordinates", () => {
  assert.doesNotThrow(() => targetPullSnapshot(targetPull()));
  for (const patch of [{ commits: 1 }, { changed_files: 95 }, { id: 1 }, { draft: true },
    { user: { id: 1, type: "User", login: "attacker" } },
    { head: { ...targetPull().head, sha: "92423694e610d723d8428c5d6550577892c9d5d2" } }]) {
    assert.throws(() => targetPullSnapshot({ ...targetPull(), ...patch }));
  }
});

test("invalid protected execution refuses before API reads and CLI fails before transport", async () => {
  let effects = 0;
  const api: GitHubStatusApi = { get: async () => { effects++; throw Error("must not read"); },
    postStatus: async () => { effects++; throw Error("must not publish"); } };
  await assert.rejects(collectSourceEvidence(api, {} as Omit<ProtectedExecutor, "sourceTreeSHA">), /Wrong protected/u);
  assert.equal(effects, 0);
  for (const mode of ["qualify", "source", "publish"]) {
    const result = spawnSync(process.execPath, ["scripts/docs-quality-source-successor-v3.ts", mode],
      { encoding: "utf8", env: { ...process.env, GITHUB_TOKEN: "inert-TEST-only", GITHUB_RUN_ID: "" } });
    assert.equal(result.status, 1); assert.match(result.stderr, /Invalid real run/u);
  }
});

test("frozen v2 source and every v1 input retain their actual Git bytes", async () => {
  for (const path of ["scripts/docs-quality-source-successor-v2.ts", "scripts/docs-quality-source-successor-v2.test.ts",
    ".github/workflows/docs-quality-source-successor-v2.yml", "tsconfig.docs-quality-source-successor-v2.json"]) {
    assert.deepEqual(await readFile(path), git("show", `d2904ef5181b1a3f42da2b6fad7e5f7fccad1ecd:${path}`));
  }
  for (const path of legacyInputs) { assert.deepEqual(await readFile(path), git("show", `${BASE}:${path}`)); }
});

test("ordinary current source and real finite PR369 history delegate to the frozen v2 owner", async () => {
  const ordinary = ordinaryFixture();
  assert.equal(ordinary.envelope.baseSHA, TARGET.headSHA);
  assert.deepEqual(ordinary.baseManifest, git("show", `${TARGET.headSHA}:package.json`));
  assert.deepEqual(ordinary.baseLock, git("show", `${TARGET.headSHA}:pnpm-lock.yaml`));
  assert.equal(await run(ordinary), "noop");
  await assert.rejects(checkSourceSuccessor(ordinary.envelope, git("show", `${BASE}:package.json`), ordinary.baseLock, sourceSHA), /base|blob/u);
  const historical = legacyFixture(HISTORICAL_TARGET.baseSHA, HISTORICAL_TARGET.headSHA, HISTORICAL_TARGET.pullRequest);
  assert.equal(await run(historical), "quality-runtime");
});

test("future Stack root plus consistent registry lock remains a dependency pair only", async () => {
  const f = stackDependencyFixture();
  assert.equal(f.envelope.baseSHA, TARGET.headSHA);
  assert.deepEqual(f.baseManifest, git("show", `${TARGET.headSHA}:package.json`));
  assert.deepEqual(f.baseLock, git("show", `${TARGET.headSHA}:pnpm-lock.yaml`));
  assert.deepEqual(f.envelope.files.map(file => file.filename).toSorted(), ["package.json", "pnpm-lock.yaml"]);
  assert.equal(await run(f), "ordinary");
  for (const [path, bytes] of [
    ["scripts/quality-process.ts", Buffer.from("unreviewed source\n")],
    ["toolchain.config.json", Buffer.from("{}\n")],
    ["tsconfig.json", Buffer.from("{}\n")],
    ["scripts/check-docs-source-successor-v1.mts", Buffer.from("unreviewed predecessor\n")],
    ["scripts/docs-quality-source-successor-v2.ts", Buffer.from("unreviewed predecessor addition\n")],
    ["docs/engineering-quality-profile.json", Buffer.from("{}\n")],
  ] as const) {
    const altered = stackDependencyFixture(); change(altered, path, bytes); await assert.rejects(run(altered));
  }
  const script = stackDependencyFixture(), manifest = JSON.parse(script.baseManifest.toString()) as { scripts: Record<string, string> };
  manifest.scripts.check = "true"; change(script, "package.json", Buffer.from(JSON.stringify(manifest))); await assert.rejects(run(script));
  const inconsistent = stackDependencyFixture(); change(inconsistent, "pnpm-lock.yaml", inconsistent.baseLock); await assert.rejects(run(inconsistent));
});

function statusRule(names: readonly string[]) {
  return { type: "required_status_checks", parameters: { strict_required_status_checks_policy: true, do_not_enforce_on_create: false,
    required_status_checks: names.map(context => ({ context, integration_id: 15368 })) } };
}
const unchanged = ["check", "trusted-admission-evidence", "trusted-admission-authority-evolution-v1", "trusted-validation"];
function protection(contexts: readonly string[]) {
  const common = { target: "branch", enforcement: "active", conditions: { ref_name: { exclude: [], include: ["~DEFAULT_BRANCH"] } },
    bypass_actors: [] as unknown[], current_user_can_bypass: "never" };
  return { main: { ...common, id: 19979783, rules: [
    { type: "deletion" }, { type: "non_fast_forward" }, { type: "required_linear_history" }, statusRule(contexts),
    { type: "pull_request", parameters: { required_approving_review_count: 0, dismiss_stale_reviews_on_push: true,
      required_reviewers: [], require_code_owner_review: false, dismissal_restriction: { enabled: false, allowed_actors: [] },
      require_last_push_approval: false, required_review_thread_resolution: true,
      require_extra_approval_for_unattributed_changes: true, allowed_merge_methods: ["squash"] } },
  ] }, identity: { ...common, id: 24363205, rules: [statusRule(["commit-author-identity"])] } };
}

test("v3 admits only current v2, add-before-remove bridge, and final v3 protection phases", () => {
  for (const names of [[...unchanged, "docs-quality-source-successor-v2"],
    [...unchanged, "docs-quality-source-successor-v2", SOURCE_CONTEXT], [...unchanged, SOURCE_CONTEXT]]) {
    const f = protection(names); assert.doesNotThrow(() => assertMainProtection(f.main, f.identity));
  }
  for (const names of [unchanged, [...unchanged, "docs-source-successor-v1"],
    [...unchanged.slice(1), SOURCE_CONTEXT], [...unchanged, SOURCE_CONTEXT, "unexpected"]]) {
    const f = protection(names); assert.throws(() => assertMainProtection(f.main, f.identity));
  }
  const f = protection([...unchanged, SOURCE_CONTEXT]);
  f.main.bypass_actors.push({ actor_id: 1 }); assert.throws(() => assertMainProtection(f.main, f.identity));
});

test("v3 staging source remains exact locked ref and full-owner bypass observation", () => {
  const lock = { id: 1, source: IDENTITY.repository, source_type: "Repository", target: "branch", enforcement: "active",
    conditions: { ref_name: { include: [SOURCE_REF], exclude: [] } }, bypass_actors: [], current_user_can_bypass: "never",
    rules: [{ type: "update" }, { type: "deletion" }, { type: "non_fast_forward" }] };
  assert.equal(assertStagingProtection([lock]), 1);
  const old = structuredClone(lock); old.conditions.ref_name.include = ["refs/heads/governance/quality-source-successor-v2"];
  assert.throws(() => assertStagingProtection([old]));
  assert.throws(() => assertStagingProtection([{ ...lock, bypass_actors: undefined }]));
});

/** Inert defining-source envelope; target trees/install bytes are real committed PR392 data. */
function finiteCollectorFixture() {
  const baseTree = treeAt(TARGET.baseSHA), headTree = treeAt(TARGET.headSHA);
  const actor = { id: 13103045, type: "User", login: "777genius" };
  const commits = git("rev-list", "--reverse", `${TARGET.baseSHA}..${TARGET.headSHA}`).toString().trim().split("\n").map(revision => {
    const [name, email, committerName, committerEmail] = git("show", "-s", "--format=%an%x00%ae%x00%cn%x00%ce", revision)
      .toString().trimEnd().split("\0");
    return { sha: revision, author: { ...actor }, committer: { ...actor },
      commit: { author: { name, email }, committer: { name: committerName, email: committerEmail } } };
  });
  const lock = { id: 1, source: TARGET.repository, source_type: "Repository", target: "branch", enforcement: "active",
    conditions: { ref_name: { include: [SOURCE_REF], exclude: [] } }, bypass_actors: [] as unknown[], current_user_can_bypass: "never",
    rules: [{ type: "update" }, { type: "deletion" }, { type: "non_fast_forward" }] };
  const state = { pull: targetPull(), main: TARGET.baseSHA, source: sourceSHA, sourceProtected: true,
    lock, attempt: 2, files: filesBetween(TARGET.baseSHA, TARGET.headSHA), commits, corruptBlob: false };
  const env: NodeJS.ProcessEnv = { GITHUB_RUN_ID: "100", GITHUB_RUN_ATTEMPT: "2", GITHUB_REPOSITORY: TARGET.repository,
    GITHUB_SHA: sourceSHA, GITHUB_EVENT_NAME: "push", GITHUB_REF: SOURCE_REF, GITHUB_WORKFLOW_SHA: sourceSHA,
    GITHUB_WORKFLOW_REF: `${TARGET.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`,
    SOURCE_WORKFLOW_SHA: sourceSHA, SOURCE_WORKFLOW_REF: `${TARGET.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`,
    SOURCE_WORKFLOW_REPOSITORY: TARGET.repository, SOURCE_WORKFLOW_PATH: SOURCE_WORKFLOW };
  const repository = { id: TARGET.repositoryId, full_name: TARGET.repository };
  const api: GitHubReadApi = { get: async request => {
    const path = request.replace(/^repos\/agent-teams-ai\/\.github/u, "");
    if (path === "") { return { ...repository, default_branch: "main", archived: false, disabled: false, fork: false }; }
    if (path === `/pulls/${TARGET.pullRequest}`) { return structuredClone(state.pull); }
    if (path === "/branches/main") { return { name: "main", protected: true, commit: { sha: state.main } }; }
    if (path.startsWith("/branches/governance%2F")) {
      return { name: SOURCE_REF.slice("refs/heads/".length), protected: state.sourceProtected, commit: { sha: state.source } };
    }
    if (path === "/actions/runs/100/attempts/2") {
      return { id: 100, run_attempt: state.attempt, event: "push", path: SOURCE_WORKFLOW, head_sha: sourceSHA,
        head_branch: SOURCE_REF.slice("refs/heads/".length), repository, actor };
    }
    if (path.startsWith("/rulesets?")) { return [{ id: state.lock.id }]; }
    if (path === "/rulesets/1") { return structuredClone(state.lock); }
    if (path === "/rulesets/19979783") { return protection([...unchanged, "docs-quality-source-successor-v2"]).main; }
    if (path === "/rulesets/24363205") { return protection([...unchanged, "docs-quality-source-successor-v2"]).identity; }
    if (path.startsWith(`/pulls/${TARGET.pullRequest}/files?`)) { return structuredClone(state.files); }
    if (path.startsWith(`/pulls/${TARGET.pullRequest}/commits?`)) { return structuredClone(state.commits); }
    if (path.startsWith("/compare/")) {
      return { status: "ahead", behind_by: 0, ahead_by: 2, total_commits: 2,
        base_commit: { sha: TARGET.baseSHA }, merge_base_commit: { sha: TARGET.baseSHA } };
    }
    if (path.startsWith("/git/commits/")) {
      const revision = path.slice("/git/commits/".length);
      assert.ok([sourceSHA, TARGET.headSHA, TARGET.baseSHA].includes(revision));
      return { sha: revision, tree: { sha: revision === TARGET.baseSHA ? baseTree.sha : headTree.sha } };
    }
    if (path === `/git/trees/${baseTree.sha}?recursive=1`) { return baseTree; }
    if (path === `/git/trees/${headTree.sha}?recursive=1`) { return headTree; }
    if (path.startsWith("/git/blobs/")) {
      const result = encoded(git("cat-file", "blob", path.slice("/git/blobs/".length)));
      if (state.corruptBlob) { result.content = ""; }
      return result;
    }
    throw new Error(`Unexpected inert API read: ${request}`);
  } };
  return { state, api, executor: executorFromEnvironment(env) };
}

test("new collector binds two actual owner commits, complete target trees and real base install bytes", async () => {
  const f = finiteCollectorFixture(), bound = await collectSourceEvidence(f.api, f.executor);
  assert.equal(bound.baseTree.sha, TARGET.baseTreeSHA); assert.equal(bound.headTree.sha, TARGET.headTreeSHA);
  assert.deepEqual(bound.baseManifest, git("show", `${TARGET.baseSHA}:package.json`));
  assert.deepEqual(bound.baseLock, git("show", `${TARGET.baseSHA}:pnpm-lock.yaml`));
  assert.equal(await checkSourceSuccessor(bound.evidence, bound.baseManifest, bound.baseLock, sourceSHA), "quality-runtime");
  await bound.recheck();
  for (const mutate of [(value: typeof f.state) => { value.pull.head.sha = "f".repeat(40); },
    (value: typeof f.state) => { value.main = "e".repeat(40); },
    (value: typeof f.state) => { value.source = "d".repeat(40); },
    (value: typeof f.state) => { value.sourceProtected = false; },
    (value: typeof f.state) => { value.attempt++; },
    (value: typeof f.state) => { value.lock.bypass_actors.push({ actor_id: 1 }); }]) {
    const fresh = finiteCollectorFixture(), observed = await collectSourceEvidence(fresh.api, fresh.executor);
    mutate(fresh.state); await assert.rejects(observed.recheck());
  }
});

test("new collector rejects missing files, forged blobs and non-owner author or committer", async () => {
  for (const mutate of [(value: ReturnType<typeof finiteCollectorFixture>["state"]) => { value.files.pop(); },
    (value: ReturnType<typeof finiteCollectorFixture>["state"]) => { value.corruptBlob = true; },
    (value: ReturnType<typeof finiteCollectorFixture>["state"]) => { value.commits.pop(); },
    (value: ReturnType<typeof finiteCollectorFixture>["state"]) => { value.commits[0]!.author.id = 1; },
    (value: ReturnType<typeof finiteCollectorFixture>["state"]) => { value.commits[1]!.commit.committer.email = "other@example.invalid"; }]) {
    const f = finiteCollectorFixture(); mutate(f.state); await assert.rejects(collectSourceEvidence(f.api, f.executor));
  }
});

test("future caller has only the exact defining source and no caller-controlled inputs or secrets", async () => {
  const caller = callerWorkflowDefinition(sourceSHA);
  await assertCallerWorkflow(Buffer.from(stringify(caller)), sourceSHA);
  await assert.rejects(assertCallerWorkflow(Buffer.from(stringify({ ...caller, secrets: "inherit" })), sourceSHA));
  const workflow = parse(await readFile(".github/workflows/docs-quality-source-successor-v3.yml", "utf8")) as {
    on: { push: { branches: string[] }; workflow_call: null }; permissions: object; jobs: Record<string, {
      permissions: Record<string, string>; steps: { uses?: string; with?: Record<string, unknown>; env?: Record<string, string>; run?: string }[] }>;
  };
  assert.deepEqual(workflow.on.push.branches, [SOURCE_REF.slice("refs/heads/".length)]);
  assert.equal(workflow.on.workflow_call, null); assert.deepEqual(workflow.permissions, { contents: "read" });
  for (const [name, job] of Object.entries(workflow.jobs)) {
    assert.equal(job.permissions.statuses, name === "publish" ? "write" : undefined);
    const checkout = job.steps[0]!; assert.equal(checkout.with?.ref, "${{ job.workflow_sha }}");
    assert.equal(checkout.with?.["persist-credentials"], false);
  }
  const fetch = workflow.jobs.qualify!.steps.find(step => step.run?.endsWith(" fetch-fixtures"));
  assert.equal(fetch?.run, "node scripts/docs-quality-source-successor-v3.ts fetch-fixtures");
  assert.deepEqual(fetch?.env, { GIT_TERMINAL_PROMPT: "0" });
  assert.ok(workflow.jobs.qualify!.steps.some(step =>
    step.run === "pnpm exec tsc --project tsconfig.docs-quality-source-successor-v3.json"));
  assert.ok(workflow.jobs.qualify!.steps.some(step => step.run?.startsWith("pnpm exec oxlint ") &&
    step.run.includes("scripts/docs-quality-source-successor-v3.ts scripts/docs-quality-source-successor-v3.test.ts")));
  assert.ok(workflow.jobs.qualify!.steps.every(step => !step.run?.includes("node --input-type=module")));
});

test("untrusted source environment and mutable caller provenance are refused", () => {
  assert.throws(() => executorFromEnvironment({}), /Invalid real run/u);
  assert.throws(() => executorFromEnvironment({ GITHUB_RUN_ID: "1", GITHUB_RUN_ATTEMPT: "1",
    GITHUB_REPOSITORY: "attacker/.github" }), /Wrong execution repository/u);
  assert.equal(CALLER_WORKFLOW, ".github/workflows/docs-quality-source-successor-v3-caller.yml");
  assert.equal(SOURCE_WORKFLOW, ".github/workflows/docs-quality-source-successor-v3.yml");
});

test("v3 status transport refuses predecessor and unrelated contexts before HTTP", () => {
  const api = createGitHubReadApi("inert-TEST-only");
  for (const context of ["docs-source-successor-v1", "docs-quality-source-successor-v2", "check"]) {
    assert.throws(() => api.postStatus(sourceSHA, { context, state: "success",
      target_url: "https://example.invalid/inert", description: "inert" }), /unowned status context/u);
  }
});

test("reusable provenance separates the immutable defining source from the current main caller", () => {
  // Inert defining-source envelope; this is not a merged-main or installed-caller claim.
  const base = BASE, head = HISTORICAL_TARGET.headSHA;
  const repository = { id: IDENTITY.repositoryId, full_name: IDENTITY.repository };
  const event = { pull_request: { number: 77, id: 77, state: "open", merged: false, draft: false,
    changed_files: 1, commits: 1, base: { repo: repository, sha: base, ref: "main" },
    head: { repo: repository, sha: head, ref: "inert-fixture" } } };
  const environment: NodeJS.ProcessEnv = { GITHUB_RUN_ID: "1", GITHUB_RUN_ATTEMPT: "1", GITHUB_REPOSITORY: IDENTITY.repository,
    SOURCE_WORKFLOW_REPOSITORY: IDENTITY.repository, SOURCE_WORKFLOW_PATH: SOURCE_WORKFLOW,
    SOURCE_WORKFLOW_SHA: sourceSHA, GITHUB_WORKFLOW_SHA: base, GITHUB_EVENT_NAME: "pull_request_target",
    SOURCE_WORKFLOW_REF: `${IDENTITY.repository}/${SOURCE_WORKFLOW}@${sourceSHA}`,
    GITHUB_WORKFLOW_REF: `${IDENTITY.repository}/${CALLER_WORKFLOW}@refs/heads/main`,
    GITHUB_REF: "refs/heads/main", GITHUB_SHA: base };
  const executor = executorFromEnvironment(environment, event);
  assert.equal(executor.sourceSHA, sourceSHA); assert.equal(executor.callerWorkflowSHA, base);
  assert.equal(executor.targetHeadSHA, head); assert.equal(executor.mode, "reusable");
  for (const environmentChange of [{ SOURCE_WORKFLOW_REF: `${IDENTITY.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}` },
    { GITHUB_WORKFLOW_SHA: sourceSHA }, { GITHUB_REF: "refs/heads/feature" }]) {
    assert.throws(() => executorFromEnvironment({ ...environment, ...environmentChange }, event));
  }
});
