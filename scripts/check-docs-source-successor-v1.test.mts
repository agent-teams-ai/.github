import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import nodePath from "node:path";
import test from "node:test";
import { parse, stringify } from "yaml";
import { assertVerifierAuthority } from "./check-docs-verifier-authority.mts";
import { checkDocsSourceSuccessor, sourceSuccessorResult } from "./check-docs-source-successor-v1.mts";

const baseRevision = "5abed741aff64506d0e9f87f76541a4e93af7e4a";
const git = (...args: string[]) => execFileSync("git", args, { cwd: new URL("../", import.meta.url), encoding: "utf8" });
// Historical tree evidence must carry install bytes from that same revision.
const manifest = Buffer.from(git("show", `${baseRevision}:package.json`));
const lock = Buffer.from(git("show", `${baseRevision}:pnpm-lock.yaml`));
const oid = (index: number): string => (index + 1).toString(16).padStart(40, "0");
type Entry = { path: string; mode: string; type: string; sha: string };
type ChangedFile = { filename: string; status: string; sha: string; previous_filename: string | undefined };
type Tree = { sha: string; truncated: boolean; tree: Entry[] };
type InstallBlob = { encoding: string; content: string; sha: string; size: number };
type LiveData = { state: string; baseSHA: string; headSHA: string; sourceSHA: string; baseRef: string;
  defaultBranch: string; headRepository: string; changedFiles: number; pullRequest: number; repository: string };
type Fixture = {
  changedFiles: number; files: ChangedFile[]; baseTree: Tree;
  headTree: Tree; headData: Record<string, InstallBlob>; repository: string; pullRequest: number;
  base: string; reviewTarget: string; baseSHA: string; headSHA: string; sourceSHA: string; baseRef: string;
  defaultBranch: string; headRepository: string; paginationComplete: boolean; live: LiveData;
  baseInputs: Record<string, Entry | null>; headInputs: Record<string, Entry | null>;
};
const special = [
  [".github/workflows/docs-protocol-check.yml", "f1492257de281f40a262042eb989291558147d5f", "9f6ffdbe9fda3a6b3bd464d0f8d9acf13db177b5"],
  ["scripts/check-community-files.mjs", "0cd13eade8a6a146934164e1e2f93dca0a3b35dd", "dc73c222cdee7120c2e8ad171ac71ddaca8db229"],
  ["scripts/check-community-files.test.mjs", "fe25fc2080ed470098208c7753793e8c1b144e4f", "e73940dff7c43315f87b5aa4ebc0c6c614b6ed64"],
  ["scripts/docs-admission-change.test.mjs", "f21dc2cc597469b2460964a664cb6532c265b72f", "ec825f0e38c41d94d20f88d426eddefafb9ea61f"],
  ["scripts/verify-docs-cohort-v2-receipt.mjs", "9f947073bb3bc1a0f1b5c9aa59eeba6e0f4add7c", "b1c92368888dde71ad7b73c107b6da6bb2e94d4d"],
  ["scripts/verify-docs-consumer-gate.mjs", "ef293a0d0098b8bd7c700ddd8c98968d10a8e9d9", "643cc6fab95bba66761082c7d883c7a3a113164c"],
  ["scripts/verify-docs-consumer-gate.test.mjs", "46e0ecb4621749d5a82a3cc5d85d830a57b72e39", "1ffbf36feea0f4643a0ffde81db98edf1c350f2a"],
] as const;
const controller = ["scripts/verify-docs-consumer-gate.mjs", "scripts/verify-docs-consumer-gate.test.mjs", "docs/decisions/0001-qualified-docs-cohorts.md"] as const;
function fixture(): Fixture {
  const tree: Entry[] = git("ls-tree", "-r", "-t", baseRevision).trim().split("\n").map(line => {
    const [header, path] = line.split("\t"); const [mode, type, sha] = header!.split(" ");
    return { path: path!, mode: mode!, type: type!, sha: sha! };
  });
  const headTree = structuredClone(tree);
  const headData = Object.fromEntries(Object.entries({ "package.json": manifest, "pnpm-lock.yaml": lock }).map(([path, bytes]) => [path, {
    encoding: "base64", content: bytes.toString("base64"), sha: tree.find(entry => entry.path === path)!.sha,
    size: bytes.length,
  }]));
  const baseSHA = "1".repeat(40), headSHA = "2".repeat(40);
  const inputPaths = ["scripts/check-docs-source-successor-v1.mts", "scripts/check-docs-source-successor-v1.test.mts",
    ".github/workflows/docs-source-successor-v1.yml", "docs/decisions/0009-bounded-docs-source-successor.md",
    "tsconfig.docs-source-successor.json"] as const;
  const baseInputs = Object.fromEntries(inputPaths.map(path => [path, tree.find(entry => entry.path === path) ?? null]));
  const headInputs = Object.fromEntries(inputPaths.map(path => [path, headTree.find(entry => entry.path === path) ?? null]));
  return {
    changedFiles: 1, files: [], baseTree: { sha: "3".repeat(40), truncated: false, tree },
    headTree: { sha: "4".repeat(40), truncated: false, tree: headTree }, headData,
    repository: "agent-teams-ai/.github", pullRequest: 77, base: baseRevision,
    reviewTarget: "96cb95a89ca4a133fbb626133eb3ac6289938ff7", baseSHA, headSHA, sourceSHA: headSHA,
    baseRef: "main", defaultBranch: "main", headRepository: "agent-teams-ai/.github", paginationComplete: true,
    live: { state: "open", baseSHA, headSHA, sourceSHA: headSHA, baseRef: "main", defaultBranch: "main",
      headRepository: "agent-teams-ai/.github", changedFiles: 1, pullRequest: 77,
      repository: "agent-teams-ai/.github" },
    baseInputs, headInputs,
  };
}
function sync(f: Fixture): void {
  f.changedFiles = f.files.length;
  f.live.changedFiles = f.changedFiles;
  const inputPaths = Object.keys(f.baseInputs);
  f.baseInputs = Object.fromEntries(inputPaths.map(path => [path, f.baseTree.tree.find(entry => entry.path === path) ?? null]));
  f.headInputs = Object.fromEntries(inputPaths.map(path => [path, f.headTree.tree.find(entry => entry.path === path) ?? null]));
}
function check(f: Fixture) { return checkDocsSourceSuccessor(f, manifest, lock); }
function ordinary(f = fixture(), path = "README.md", sha = "d".repeat(40)): Fixture {
  Object.assign(f.headTree.tree.find(entry => entry.path === path)!, { sha });
  f.files.push({ filename: path, status: "modified", sha, previous_filename: undefined });
  sync(f); return f;
}
function specialFixture(pr = 363): Fixture {
  const f = fixture(); f.pullRequest = pr; f.live.pullRequest = pr;
  for (const [path, before, after] of special) {
    const old = f.baseTree.tree.find(entry => entry.path === path)!;
    Object.assign(old, { mode: "100644", type: "blob", sha: before });
    Object.assign(f.headTree.tree.find(entry => entry.path === path)!, { mode: "100644", type: "blob", sha: after });
    f.files.push({ filename: path, status: "modified", sha: after, previous_filename: undefined });
  }
  sync(f); return f;
}
function controllerWeakeningFixture(path: string): Fixture {
  const f = fixture();
  // A one-file replacement leaves every non-target controller artifact unchanged.
  const sha = "1".repeat(40);
  Object.assign(f.headTree.tree.find(entry => entry.path === path)!, { sha });
  f.files.push({ filename: path, status: "modified", sha, previous_filename: undefined });
  sync(f); return f;
}
const bootstrapPaths = ["scripts/check-docs-source-successor-v1.mts", "scripts/check-docs-source-successor-v1.test.mts",
  ".github/workflows/docs-source-successor-v1.yml", "docs/decisions/0009-bounded-docs-source-successor.md",
  "tsconfig.docs-source-successor.json"] as const;
function bootstrapFixture(): Fixture {
  const f = fixture();
  bootstrapPaths.forEach((path, index) => {
    const sha = oid(index + 20);
    f.headTree.tree.push({ path, mode: "100644", type: "blob", sha });
    f.files.push({ filename: path, status: "added", sha, previous_filename: undefined });
  });
  sync(f); return f;
}
function protectedBootstrapFixture(): Fixture {
  const f = ordinary();
  bootstrapPaths.forEach((path, index) => {
    const entry = { path, mode: "100644", type: "blob", sha: oid(index + 20) };
    f.baseTree.tree.push({ ...entry }); f.headTree.tree.push({ ...entry });
  });
  sync(f); return f;
}

test("full five-file bootstrap is admitted and the ordinary changed-file cap is exactly 32", () => {
  assert.equal(check(bootstrapFixture()), sourceSuccessorResult.noop);
  const ordinary32 = fixture();
  for (let index = 0; index < 32; index += 1) {
    const path = `governance/evidence/docs-cohorts/ordinary-${index}.json`, sha = oid(index + 40);
    ordinary32.headTree.tree.push({ path, mode: "100644", type: "blob", sha });
    ordinary32.files.push({ filename: path, status: "added", sha, previous_filename: undefined });
  }
  sync(ordinary32); assert.equal(check(ordinary32), sourceSuccessorResult.noop);
  const ordinary33 = fixture();
  for (let index = 0; index < 33; index += 1) {
    const path = `docs/ordinary33-${index}.md`, sha = oid(index + 80);
    ordinary33.headTree.tree.push({ path, mode: "100644", type: "blob", sha });
    ordinary33.files.push({ filename: path, status: "added", sha, previous_filename: undefined });
  }
  sync(ordinary33); assert.throws(() => check(ordinary33), /1\.\.32/u);
});

test("partial, malformed, edited and deleted protected five-file states are rejected", () => {
  const partial = bootstrapFixture();
  partial.headTree.tree = partial.headTree.tree.filter(entry => entry.path !== bootstrapPaths[0]);
  partial.files = partial.files.filter(file => file.filename !== bootstrapPaths[0]); sync(partial);
  assert.throws(() => check(partial), /head inputs must be added together/u);
  const mode = bootstrapFixture();
  Object.assign(mode.headTree.tree.find(entry => entry.path === bootstrapPaths[1]!)!, { mode: "120000" }); sync(mode);
  assert.throws(() => check(mode), /Invalid bootstrap input/u);
  const edit = protectedBootstrapFixture();
  Object.assign(edit.headTree.tree.find(entry => entry.path === bootstrapPaths[2]!)!, { sha: oid(150) });
  edit.files.push({ filename: bootstrapPaths[2]!, status: "modified", sha: oid(150), previous_filename: undefined }); sync(edit);
  assert.throws(() => check(edit), /Protected successor input changed/u);
  const deletion = protectedBootstrapFixture();
  deletion.headTree.tree = deletion.headTree.tree.filter(entry => entry.path !== bootstrapPaths[3]);
  deletion.files.push({ filename: bootstrapPaths[3]!, status: "removed", sha: oid(20), previous_filename: undefined }); sync(deletion);
  assert.throws(() => check(deletion), /Successor head inputs must be added together or remain together/u);
});

test("unqualified controller artifacts are independently rejected; ordinary and special negatives remain", () => {
  assert.throws(() => check(controllerWeakeningFixture(controller[0]!)),
    /Protected input changed: scripts\/verify-docs-consumer-gate\.mjs/u);
  assert.throws(() => check(controllerWeakeningFixture(controller[1]!)),
    /Protected input changed: scripts\/verify-docs-consumer-gate\.test\.mjs/u);
  assert.throws(() => check(controllerWeakeningFixture(controller[2]!)),
    /Protected input changed: docs\/decisions\/0001-qualified-docs-cohorts\.md/u);
  const ordinaryIdentity = ordinary();
  ordinaryIdentity.base = oid(160); ordinaryIdentity.reviewTarget = oid(161);
  assert.equal(check(ordinaryIdentity), sourceSuccessorResult.noop);
  assert.throws(() => check(specialFixture(404)), /Special source pull request drift/u);
});

test("exact seven-file PR363 is special and binds before/after blobs", () => {
  assert.equal(check(specialFixture()), sourceSuccessorResult.special);
  const f = specialFixture(); Object.assign(f.headTree.tree.find(entry => entry.path === special[0]![0])!, { sha: "9".repeat(40) });
  assert.throws(() => check(f), /Source after blob mismatch/u);
});

test("metadata, pagination, mode, hidden, installer and dependency drift are rejected", () => {
  const cases: ((f: Fixture) => void)[] = [
    f => { f.live.changedFiles = 2; }, f => { f.paginationComplete = false; },
    f => { f.live.baseSHA = oid(170); },
    f => {
      const directory = f.headTree.tree.find(entry => entry.path === "docs")!;
      Object.assign(directory, { mode: "100644", type: "blob", sha: oid(171) });
      f.files.push({ filename: "docs", status: "modified", sha: oid(171), previous_filename: undefined });
    },
    f => { Object.assign(f.headTree.tree.find(entry => entry.path === controller[0]!)!, { mode: "120000" }); },
    f => { f.headTree.tree.push({ path: "hidden-TEST", mode: "100644", type: "blob", sha: "a".repeat(40) }); },
    f => { Object.assign(f.headTree.tree.find(entry => entry.path === "package.json")!, { sha: "b".repeat(40) }); },
    f => {
      const content = "bad";
      f.headData["pnpm-lock.yaml"] = {
        encoding: "base64",
        content,
        sha: "c".repeat(40),
        size: Buffer.from(content, "base64").length,
      };
    },
    f => { f.files.push({ filename: "README.md", status: "renamed", sha: oid(130), previous_filename: "old.md" }); },
    f => { f.files[0]!.filename = "scripts/node_modules/TEST.js"; },
  ];
  for (const mutate of cases) { const f = ordinary(); mutate(f); assert.throws(() => check(f)); }
  const ordinaryMode = ordinary();
  Object.assign(ordinaryMode.headTree.tree.find(entry => entry.path === "README.md")!, { mode: "120000" }); sync(ordinaryMode);
  assert.equal(check(ordinaryMode), sourceSuccessorResult.noop);
});

test("ordinary fallback executes existing verifier logic and preserves guard negative proof", () => {
  const historical = fixture();
  Object.assign(historical.headTree.tree.find(entry => entry.path === "README.md")!, { sha: oid(140) });
  historical.files.push({ filename: "README.md", status: "modified", sha: oid(140), previous_filename: undefined }); sync(historical);
  assert.equal(check(historical), sourceSuccessorResult.noop);
  const forbidden = ordinary(); forbidden.files[0]!.previous_filename = ".github/workflows/ci.yml";
  forbidden.files[0]!.status = "renamed"; sync(forbidden);
  assert.throws(() => check(forbidden), /Protected authority path/u);
});


const historicalChanges = [
  ["scripts/docs-cohort-policy.test.mjs", "modified", "46820a7a94cd59403e5b3ae29429e72ec7c64373", "7543006ded770545dc1525e0aa199bdd52aaffe2"],
  ["scripts/docs-admission-change.test.mjs", "modified", "2269c2fb4cf386d1af4d122fafc6e369c519137d", "fcf776fe84f2e36b47e14971a41d3906739f913b"],
  ["scripts/verify-docs-cohort-evidence.mjs", "modified", "3b58fde6e5ec79241d60439785f2f94764b0fd99", "fba985a230c710aba355b15a0360f464ad961ff0"],
] as const;
const cohortChanges = [
  ["governance/docs-qualified-cohorts.json", "modified", "7a61f13a8a73406d206612f9051666d9f9779c7d", "4643e77d369bc1acb8673d13214269e4eadc23d1"],
  ["governance/docs-runtime-closures/sha256-48dcadfa67bcf5f32e8aa7a510d83e9475335d7153b145ff84f00e9b5da993e2.json", "added", undefined, "942e3629cbeaaac3514582be6f6e89c6a66e98b0"],
  ["governance/evidence/docs-cohorts/docs-2026-10-03-stable31/publication.json", "added", undefined, "b1004a245150df492f9c827c9120e6873afb7ff7"],
  ["governance/evidence/docs-cohorts/docs-2026-10-03-stable31/record-review.md", "added", undefined, "564971dccbaaf2499c4122ff99cd68fe7737ded1"],
] as const;
const gitBuffer = (...args: string[]) => execFileSync("git", args, { cwd: new URL("../", import.meta.url) });
const gitBlobBytes = (bytes: Buffer): string => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
type ManifestFixture = { devDependencies: Record<string, string>; [key: string]: unknown };
type LockFixture = {
  importers: Record<string, { devDependencies: Record<string, { specifier: string; version: string }> }>;
  packages: Record<string, { resolution: Record<string, unknown> }>;
  snapshots: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};
function treeAt(revision: string): Tree {
  const sha = git("rev-parse", `${revision}^{tree}`).trim();
  const tree: Entry[] = git("ls-tree", "-r", "-t", revision).trim().split("\n").map(line => {
    const [header, filePath] = line.split("\t"); const [mode, type, blob] = header!.split(" ");
    return { path: filePath!, mode: mode!, type: type!, sha: blob! };
  });
  return { sha, truncated: false, tree };
}
function transitionFixture(baseCommit: string, headCommit: string,
  changes: readonly (readonly [string, string, string | undefined, string])[]): Fixture {
  const baseTree = treeAt(baseCommit), headTree = treeAt(headCommit);
  const files: ChangedFile[] = [];
  for (const [path, status, before, after] of changes) {
    const old = baseTree.tree.find(entry => entry.path === path), next = headTree.tree.find(entry => entry.path === path);
    if (status === "added") {
      assert.equal(old, undefined, `Historical before tree unexpectedly contains ${path}`);
    } else {
      assert.equal(old?.sha, before, `Historical before blob mismatch: ${path}`);
    }
    assert.equal(next?.sha, after, `Historical after blob mismatch: ${path}`);
    assert.equal(next?.mode, "100644"); assert.equal(next?.type, "blob");
    files.push({ filename: path, status, sha: after, previous_filename: undefined });
  }
  const headData = Object.fromEntries(["package.json", "pnpm-lock.yaml"].map(path => {
    const bytes = gitBuffer("show", `${headCommit}:${path}`);
    const entry = headTree.tree.find(candidate => candidate.path === path)!;
    assert.equal(entry.sha, gitBlobBytes(bytes), `Historical install blob mismatch: ${path}`);
    return [path, { encoding: "base64", content: bytes.toString("base64"), sha: entry.sha, size: bytes.length }];
  }));
  const inputPaths = ["scripts/check-docs-source-successor-v1.mts", "scripts/check-docs-source-successor-v1.test.mts",
    ".github/workflows/docs-source-successor-v1.yml", "docs/decisions/0009-bounded-docs-source-successor.md",
    "tsconfig.docs-source-successor.json"] as const;
  const baseInputs = Object.fromEntries(inputPaths.map(path => [path, baseTree.tree.find(entry => entry.path === path) ?? null]));
  const headInputs = Object.fromEntries(inputPaths.map(path => [path, headTree.tree.find(entry => entry.path === path) ?? null]));
  return {
    changedFiles: files.length, files, baseTree, headTree, headData,
    repository: "agent-teams-ai/.github", pullRequest: 344, base: baseCommit,
    reviewTarget: "96cb95a89ca4a133fbb626133eb3ac6289938ff7", baseSHA: baseCommit, headSHA: headCommit,
    sourceSHA: headCommit, baseRef: "main", defaultBranch: "main", headRepository: "agent-teams-ai/.github",
    paginationComplete: true,
    live: { state: "open", baseSHA: baseCommit, headSHA: headCommit, sourceSHA: headCommit, baseRef: "main",
      defaultBranch: "main", headRepository: "agent-teams-ai/.github", changedFiles: files.length, pullRequest: 344,
      repository: "agent-teams-ai/.github" },
    baseInputs, headInputs,
  };
}
const node26Base = "265dca86ddb48c14e7d94e0b5ca698776e3dd743";
const node26Head = "3094afecfe4ed810a9106ca2e7c1ee6908442748";
function node26DefaultFixture(reverse = false): Fixture {
  // Derive the reviewed PR359 tuple from raw history; the retained verifier remains the blob authority.
  const [base, head] = reverse ? [node26Head, node26Base] : [node26Base, node26Head];
  const changes = git("diff", "--raw", "--no-abbrev", base, head).trim().split("\n").map(line => {
    const [metadata, path] = line.split("\t");
    const [beforeMode, afterMode, before, after, status] = metadata!.split(" ");
    assert.equal(beforeMode, ":100644"); assert.equal(afterMode, "100644"); assert.equal(status, "M");
    return [path!, "modified", before!, after!] as const;
  });
  return transitionFixture(base, head, changes);
}
function cohortBoundaryFixture(count = 33): Fixture {
  const f = fixture();
  for (let index = 0; index < count; index += 1) {
    const path = `governance/evidence/docs-cohorts/boundary-test-${index}.json`, sha = oid(index + 220);
    f.headTree.tree.push({ path, mode: "100644", type: "blob", sha });
    f.files.push({ filename: path, status: "added", sha, previous_filename: undefined });
  }
  sync(f); return f;
}
function dependencyFixture(): Fixture {
  const f = fixture();
  const nextManifest = JSON.parse(manifest.toString()) as ManifestFixture;
  const nextLock = parse(lock.toString()) as LockFixture;
  nextManifest.devDependencies["s4-test-only"] = "1.2.3";
  nextLock.importers["."]!.devDependencies["s4-test-only"] = { specifier: "1.2.3", version: "1.2.3" };
  nextLock.packages["s4-test-only@1.2.3"] = { resolution: { integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}` } };
  nextLock.snapshots["s4-test-only@1.2.3"] = {};
  const dependencyEntries: ReadonlyArray<readonly [string, Buffer]> = [
    ["package.json", Buffer.from(JSON.stringify(nextManifest))],
    ["pnpm-lock.yaml", Buffer.from(stringify(nextLock))],
  ];
  for (const [path, bytes] of dependencyEntries) {
    const sha = gitBlobBytes(bytes), entry = f.headTree.tree.find(candidate => candidate.path === path)!;
    Object.assign(entry, { sha, size: bytes.length });
    f.headData[path] = { encoding: "base64", content: bytes.toString("base64"), sha, size: bytes.length };
    f.files.push({ filename: path, status: "modified", sha, previous_filename: undefined });
  }
  sync(f); return f;
}
function workflowScriptFromText(text: string): string {
  const workflow = parse(text) as { jobs: Record<string, { steps: { with?: { script?: string } }[] }> };
  const scripts = Object.values(workflow.jobs).flatMap(job => job.steps).map(step => step.with?.script).filter((script): script is string => typeof script === "string");
  assert.equal(scripts.length, 1, "Expected exactly one workflow materializer script");
  return scripts[0]!;
}
function workflowScript(revision: string, file: string): string {
  return workflowScriptFromText(gitBuffer("show", `${revision}:${file}`).toString("utf8"));
}
function workflowScriptFile(file: string): string {
  return workflowScriptFromText(readFileSync(file, "utf8"));
}
type WorkflowState = {
  pull: { number: number; changed_files: number; state: string;
    head: { sha: string; repo: { full_name: string } }; base: { ref: string; sha: string } };
  branch: string; defaultBranch: string; files: ChangedFile[]; baseTree: Tree; headTree: Tree;
  data: Map<string, InstallBlob>; baseCommit: string; headCommit: string;
};
type WorkflowRun = { failures: string[]; outputs: Map<string, string>; writes: Map<string, Buffer> };
function workflowState(f: Fixture, baseCommit: string, headCommit: string): WorkflowState {
  const sized = (tree: Tree): Tree => ({ ...tree, tree: tree.tree.map(entry => {
    const blob = f.headData[entry.path];
    return blob ? { ...entry, size: blob.size } : entry;
  }) });
  const pull = { number: f.pullRequest, changed_files: f.changedFiles, state: "open",
    head: { sha: headCommit, repo: { full_name: f.headRepository } },
    base: { ref: f.baseRef, sha: baseCommit } };
  const data = new Map<string, InstallBlob>(Object.values(f.headData).map(blob => [blob.sha, blob] as [string, InstallBlob]));
  return { pull, branch: baseCommit, defaultBranch: f.defaultBranch, files: f.files,
    baseTree: sized(f.baseTree), headTree: sized(f.headTree), data, baseCommit, headCommit };
}
async function runWorkflow(source: string, state: WorkflowState): Promise<WorkflowRun> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction("context", "github", "core", "require", "process", source);
  const failures: string[] = [], outputs = new Map<string, string>(), writes = new Map<string, Buffer>();
  const github = {
    paginate: async () => state.files,
    rest: {
      pulls: { listFiles: () => {}, get: async () => ({ data: state.pull }) },
      repos: { get: async () => ({ data: { default_branch: state.defaultBranch } }),
        getBranch: async () => ({ data: { commit: { sha: state.branch } } }) },
      git: {
        getCommit: async ({ commit_sha }: { commit_sha: string }) => ({ data: {
          sha: commit_sha, tree: { sha: commit_sha === state.baseCommit ? state.baseTree.sha : state.headTree.sha } } }),
        getTree: async ({ tree_sha }: { tree_sha: string }) => {
          if (tree_sha === state.baseCommit || tree_sha === state.baseTree.sha) {
            return { data: state.baseTree };
          }
          if (tree_sha === state.headCommit || tree_sha === state.headTree.sha) {
            return { data: state.headTree };
          }
          throw new Error(`Unknown tree_sha: ${tree_sha}`);
        },
        getBlob: async ({ file_sha }: { file_sha: string }) => ({ data: state.data.get(file_sha) }),
      },
    },
  };
  const requireFixture = (name: string) => name === "node:path" ? nodePath : {
    writeFile: async (target: string, bytes: Buffer, options: { flag: string }) => {
      assert.equal(options.flag, "wx"); assert.equal(writes.has(target), false); writes.set(target, bytes);
    },
  };
  try {
    await execute({ repo: { owner: "agent-teams-ai", repo: ".github" }, payload: { pull_request: state.pull } },
      github, { setFailed: (message: string) => failures.push(message),
        setOutput: (key: string, value: string) => outputs.set(key, value) },
      requireFixture, { env: { RUNNER_TEMP: "/TEST-runner" } });
  } catch (error) { failures.push(String(error)); }
  return { failures, outputs, writes };
}
test("actual historical and current materializers agree on finite, installer, Cohort and dependency routes", async () => {
  const historicalSource = workflowScript("fff9d72e5b6f7022348d3a51ff54b1237ae68e1c",
    ".github/workflows/docs-cohort-authority-evolution-v8.yml");
  const oldGuardSource = workflowScript("fff9d72e5b6f7022348d3a51ff54b1237ae68e1c",
    ".github/workflows/docs-authority-evolution.yml");
  const currentCohortSource = workflowScriptFile(".github/workflows/docs-cohort-authority-evolution-v8.yml");
  const currentSuccessorSource = workflowScriptFile(".github/workflows/docs-source-successor-v1.yml");
  const node26 = node26DefaultFixture(), node26Manifest = gitBuffer("show", `${node26.base}:package.json`),
    node26Lock = gitBuffer("show", `${node26.base}:pnpm-lock.yaml`);
  assert.equal(checkDocsSourceSuccessor(node26, node26Manifest, node26Lock), sourceSuccessorResult.ordinary);
  const node26MaterializerRun = await runWorkflow(currentCohortSource, workflowState(node26, node26.base, node26.headSHA));
  assert.deepEqual(node26MaterializerRun.failures, []);
  const node26Evidence = JSON.parse(node26MaterializerRun.writes.values().next().value!.toString()) as Record<string, unknown>;
  assert.equal(assertVerifierAuthority(node26Evidence, node26Manifest, node26Lock), "node26-default");
  assert.throws(() => checkDocsSourceSuccessor(node26Evidence, node26Manifest, node26Lock),
    /Changed-file pagination is incomplete/u);
  const node26SuccessorRun = await runWorkflow(currentSuccessorSource, workflowState(node26, node26.base, node26.headSHA));
  assert.deepEqual(node26SuccessorRun.failures, []);
  assert.equal(checkDocsSourceSuccessor(JSON.parse(node26SuccessorRun.writes.values().next().value!.toString()),
    node26Manifest, node26Lock), sourceSuccessorResult.ordinary);
  const partial = node26DefaultFixture(), omitted = partial.files.pop()!;
  Object.assign(partial.headTree.tree.find(entry => entry.path === omitted.filename)!,
    partial.baseTree.tree.find(entry => entry.path === omitted.filename)!); sync(partial);
  const extra = node26DefaultFixture(), extraSha = oid(600);
  Object.assign(extra.headTree.tree.find(entry => entry.path === "README.md")!, { sha: extraSha });
  extra.files.unshift({ filename: "README.md", status: "modified", sha: extraSha, previous_filename: undefined }); sync(extra);
  const reverseFixture = node26DefaultFixture(true),
    reverseManifest = gitBuffer("show", `${reverseFixture.base}:package.json`),
    reverseLock = gitBuffer("show", `${reverseFixture.base}:pnpm-lock.yaml`);
  const dependencyDrift = node26DefaultFixture();
  const driftedManifest = JSON.parse(Buffer.from(dependencyDrift.headData["package.json"]!.content, "base64").toString()) as ManifestFixture;
  driftedManifest.devDependencies.ajv = "8.21.0";
  const driftedBytes = Buffer.from(`${JSON.stringify(driftedManifest, null, 2)}\n`), driftedSha = gitBlobBytes(driftedBytes);
  dependencyDrift.headData["package.json"] = {
    encoding: "base64", content: driftedBytes.toString("base64"), sha: driftedSha, size: driftedBytes.length,
  };
  Object.assign(dependencyDrift.headTree.tree.find(entry => entry.path === "package.json")!, { sha: driftedSha });
  dependencyDrift.files.find(file => file.filename === "package.json")!.sha = driftedSha; sync(dependencyDrift);
  for (const rejected of [partial, extra, dependencyDrift]) {
    assert.throws(() => checkDocsSourceSuccessor(rejected, node26Manifest, node26Lock));
  }
  assert.throws(() => checkDocsSourceSuccessor(reverseFixture, reverseManifest, reverseLock), /Protected (?:authority path|input changed)/u);
  for (const reverse of [false, true]) {
    const changes = reverse ? historicalChanges.map(([path, status, before, after]) => [path, status, after, before] as const) : historicalChanges;
    const f = transitionFixture(reverse ? "9cc720c30a3cb1501426c9a27f2f837692c7f2d0" : "fff9d72e5b6f7022348d3a51ff54b1237ae68e1c",
      reverse ? "fff9d72e5b6f7022348d3a51ff54b1237ae68e1c" : "9cc720c30a3cb1501426c9a27f2f837692c7f2d0", changes);
    const old = await runWorkflow(historicalSource, workflowState(f, f.base, f.headSHA));
    assert.deepEqual(old.failures, []); assert.equal(old.outputs.get("mode"), "authority");
    assert.equal(checkDocsSourceSuccessor(f, manifest, lock), sourceSuccessorResult.ordinary);
    const successor = await runWorkflow(currentSuccessorSource, workflowState(f, f.base, f.headSHA));
    assert.deepEqual(successor.failures, []);
    assert.equal(checkDocsSourceSuccessor(JSON.parse(successor.writes.values().next().value!.toString()), manifest, lock),
      sourceSuccessorResult.ordinary);
  }
  const cohort = transitionFixture("de0cbe6b327fa3ec2d41a75ab30b4a839a6f247f", "64e4f5a1eb337bfaea8a7ca44d15696b83b0eff8", cohortChanges);
  const currentCohortRun = await runWorkflow(currentCohortSource, workflowState(cohort, cohort.base, cohort.headSHA));
  assert.equal(currentCohortRun.failures.length, 1);
  assert.match(String(currentCohortRun.failures[0]), /Missing regular base\/head authority/u);
  const historicalCohortSource = workflowScript("de0cbe6b327fa3ec2d41a75ab30b4a839a6f247f",
    ".github/workflows/docs-cohort-authority-evolution-v8.yml");
  const cohortRun = await runWorkflow(historicalCohortSource, workflowState(cohort, cohort.base, cohort.headSHA));
  assert.deepEqual(cohortRun.failures, []); assert.equal(cohortRun.outputs.get("mode"), "noop");
  assert.equal(checkDocsSourceSuccessor(cohort, manifest, lock), sourceSuccessorResult.noop);
  const successorCohort = await runWorkflow(currentSuccessorSource, workflowState(cohort, cohort.base, cohort.headSHA));
  assert.deepEqual(successorCohort.failures, []);
  assert.equal(checkDocsSourceSuccessor(JSON.parse(successorCohort.writes.values().next().value!.toString()), manifest, lock),
    sourceSuccessorResult.noop);
  const dependency = dependencyFixture();
  const dependencyRun = await runWorkflow(currentCohortSource, workflowState(dependency, dependency.base, dependency.headSHA));
  assert.deepEqual(dependencyRun.failures, []);
  const evidence = JSON.parse(dependencyRun.writes.values().next().value!.toString()) as Record<string, unknown>;
  assert.equal(assertVerifierAuthority(evidence, manifest, lock), "dependencies");
  assert.equal(checkDocsSourceSuccessor(dependency, manifest, lock), sourceSuccessorResult.ordinary);
  const guardRun = await runWorkflow(oldGuardSource, workflowState(dependency, dependency.base, dependency.headSHA));
  assert.deepEqual(guardRun.failures, []); assert.equal(guardRun.outputs.get("mode"), "noop");
});
test("NoOp 33 and 3000 are admitted while non-NoOp, source, shadow and install 33 are rejected", async () => {
  const oldCohortSource = workflowScript("fff9d72e5b6f7022348d3a51ff54b1237ae68e1c",
    ".github/workflows/docs-cohort-authority-evolution-v8.yml");
  const currentCohortSource = workflowScriptFile(".github/workflows/docs-cohort-authority-evolution-v8.yml");
  const oldGuardSource = workflowScript("fff9d72e5b6f7022348d3a51ff54b1237ae68e1c",
    ".github/workflows/docs-authority-evolution.yml");
  const currentSuccessorSource = workflowScriptFile(".github/workflows/docs-source-successor-v1.yml");
  const cohort33 = cohortBoundaryFixture(33), cohort3000 = cohortBoundaryFixture(3000);
  assert.equal(check(cohort33), sourceSuccessorResult.noop);
  assert.equal(check(cohort3000), sourceSuccessorResult.noop);
  for (const f of [cohort33, cohort3000]) {
    for (const source of [oldCohortSource, currentCohortSource]) {
      const run = await runWorkflow(source, workflowState(f, f.base, f.headSHA));
      assert.deepEqual(run.failures, []);
      assert.equal(run.outputs.get("mode"), "noop");
    }
  }
  const nonCohort = fixture();
  for (let index = 0; index < 33; index += 1) {
    const path = `docs/noncohort-TEST-${index}.md`, sha = oid(index + 260);
    nonCohort.headTree.tree.push({ path, mode: "100644", type: "blob", sha });
    nonCohort.files.push({ filename: path, status: "added", sha, previous_filename: undefined });
  }
  sync(nonCohort);
  assert.equal(assertVerifierAuthority(nonCohort, manifest, lock), "noop");
  const oldRun = await runWorkflow(oldGuardSource, workflowState(nonCohort, nonCohort.base, nonCohort.headSHA));
  assert.equal(oldRun.failures.length, 1);
  assert.match(oldRun.failures[0]!, /1\.\.32/u);
  const successorRun = await runWorkflow(currentSuccessorSource, workflowState(nonCohort, nonCohort.base, nonCohort.headSHA));
  assert.deepEqual(successorRun.failures, []);
  assert.throws(() => checkDocsSourceSuccessor(JSON.parse(successorRun.writes.values().next().value!.toString()), manifest, lock),
    /1\.\.32 outside Cohort data/u);
  assert.throws(() => check(nonCohort), /1\.\.32 outside Cohort data/u);
  const noop3000 = cohortBoundaryFixture(3000);
  assert.equal(assertVerifierAuthority(noop3000, manifest, lock), "noop");
  const add33 = (f: Fixture, prefix: string, base: number): Fixture => {
    for (let index = 0; index < 32; index += 1) {
      const path = `docs/${prefix}-TEST-${index}.md`, sha = oid(index + base);
      f.headTree.tree.push({ path, mode: "100644", type: "blob", sha });
      f.files.push({ filename: path, status: "added", sha, previous_filename: undefined });
    }
    return f;
  };
  const nonNoop = add33(dependencyFixture(), "nonnoop", 420); sync(nonNoop);
  assert.throws(() => check(nonNoop), /1\.\.32 outside Cohort data/u);
  const source33 = add33(fixture(), "source33", 460);
  Object.assign(source33.headTree.tree.find(entry => entry.path === controller[0]!)!, { sha: oid(500) });
  source33.files.push({ filename: controller[0]!, status: "modified", sha: oid(500), previous_filename: undefined });
  sync(source33); assert.throws(() => check(source33), /Protected input changed/u);
  const shadow33 = add33(fixture(), "shadow33", 520), shadowPath = "scripts/node_modules/TEST.js", shadowSHA = oid(560);
  shadow33.headTree.tree.push({ path: shadowPath, mode: "100644", type: "blob", sha: shadowSHA });
  shadow33.files.push({ filename: shadowPath, status: "added", sha: shadowSHA, previous_filename: undefined });
  sync(shadow33); assert.throws(() => check(shadow33));
  const install33 = add33(fixture(), "install33", 580);
  const manifestBytes = Buffer.from('{"changed":true}\n'), manifestSHA = gitBlobBytes(manifestBytes);
  Object.assign(install33.headTree.tree.find(entry => entry.path === "package.json")!, { sha: manifestSHA });
  install33.headData["package.json"] = { encoding: "base64", content: manifestBytes.toString("base64"), sha: manifestSHA, size: manifestBytes.byteLength };
  install33.files.push({ filename: "package.json", status: "modified", sha: manifestSHA, previous_filename: undefined });
  sync(install33); assert.throws(() => check(install33), /1\.\.32 outside Cohort data/u);
});

test("finite historical provenance admits only real forward and rollback tuples", async () => {
  const oldGuardSource = workflowScript("fff9d72e5b6f7022348d3a51ff54b1237ae68e1c",
    ".github/workflows/docs-authority-evolution.yml");
  const currentSuccessorSource = workflowScriptFile(".github/workflows/docs-source-successor-v1.yml");
  const states = [
    ["fff9d72e5b6f7022348d3a51ff54b1237ae68e1c", "48f59318e7132d4e45cfceb6950101ddee65e874"],
    ["9cc720c30a3cb1501426c9a27f2f837692c7f2d0", "6d6902acee4511a62217e88ac55e8af0b2525330"],
  ] as const;
  const historicalFixture = (rollback = false): Fixture => {
    const changes = rollback
      ? historicalChanges.map(([path, status, before, after]) => [path, status, after, before] as const)
      : historicalChanges;
    return transitionFixture(states[rollback ? 1 : 0]![0], states[rollback ? 0 : 1]![0], changes);
  };
  for (const rollback of [false, true]) {
    const f = historicalFixture(rollback);
    assert.equal(check(f), sourceSuccessorResult.ordinary);
    for (const source of [oldGuardSource, currentSuccessorSource]) {
      const run = await runWorkflow(source, workflowState(f, f.base, f.headSHA));
      assert.deepEqual(run.failures, []);
    }
  }
  const wrongPair = historicalFixture();
  wrongPair.headSHA = states[0]![0]; wrongPair.sourceSHA = wrongPair.headSHA;
  wrongPair.live.headSHA = wrongPair.headSHA; wrongPair.live.sourceSHA = wrongPair.headSHA;
  sync(wrongPair);
  assert.throws(() => check(wrongPair), /Missing protected input/u);
  const historicallyPresentMissing = historicalFixture();
  for (const tree of [historicallyPresentMissing.baseTree.tree, historicallyPresentMissing.headTree.tree]) {
    tree.splice(tree.findIndex(entry => entry.path === historicalChanges[0]![0]), 1);
  }
  sync(historicallyPresentMissing);
  assert.throws(() => check(historicallyPresentMissing), /Missing protected input/u);
  const laterPath = "tsconfig.tooling.json";
  const laterAdd = historicalFixture();
  laterAdd.headTree.tree.push({ path: laterPath, mode: "100644", type: "blob", sha: oid(360) });
  laterAdd.files.push({ filename: laterPath, status: "added", sha: oid(360), previous_filename: undefined }); sync(laterAdd);
  assert.throws(() => check(laterAdd), /Missing protected input/u);
  const laterRemove = historicalFixture();
  laterRemove.baseTree.tree.push({ path: laterPath, mode: "100644", type: "blob", sha: oid(361) });
  laterRemove.files.push({ filename: laterPath, status: "removed", sha: oid(361), previous_filename: undefined }); sync(laterRemove);
  assert.throws(() => check(laterRemove), /Missing protected input/u);
  const laterMode = historicalFixture();
  laterMode.baseTree.tree.push({ path: laterPath, mode: "100644", type: "blob", sha: oid(362) });
  laterMode.headTree.tree.push({ path: laterPath, mode: "120000", type: "blob", sha: oid(362) });
  laterMode.files.push({ filename: laterPath, status: "modified", sha: oid(362), previous_filename: undefined }); sync(laterMode);
  assert.throws(() => check(laterMode), /Missing protected input/u);
  const normalMissing = historicalFixture();
  normalMissing.headSHA = oid(363); normalMissing.sourceSHA = normalMissing.headSHA;
  normalMissing.live.headSHA = normalMissing.headSHA; normalMissing.live.sourceSHA = normalMissing.headSHA;
  sync(normalMissing);
  assert.throws(() => check(normalMissing), /Missing protected input/u);
});
