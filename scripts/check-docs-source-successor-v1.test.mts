import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkDocsSourceSuccessor, sourceSuccessorResult } from "./check-docs-source-successor-v1.mts";

const manifest = readFileSync("package.json"), lock = readFileSync("pnpm-lock.yaml");
const baseRevision = "5abed741aff64506d0e9f87f76541a4e93af7e4a";
const git = (...args: string[]) => execFileSync("git", args, { cwd: new URL("../", import.meta.url), encoding: "utf8" });
const oid = (index: number): string => (index + 1).toString(16).padStart(40, "0");
type Entry = { path: string; mode: string; type: string; sha: string };
type ChangedFile = { filename: string; status: string; sha: string; previous_filename: string | undefined };
type Tree = { sha: string; truncated: boolean; tree: Entry[] };
type InstallBlob = { encoding: string; content: string; sha: string };
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
  [".github/workflows/docs-protocol-check.yml", "f1492257de281f40a262042eb989291558147d5f", "a9016c6edca859b4182934732f0ff9b9054ca4e5"],
  ["scripts/check-community-files.mjs", "0cd13eade8a6a146934164e1e2f93dca0a3b35dd", "144e26650e7b74da97473424ed67d3719bc3f05b"],
  ["scripts/check-community-files.test.mjs", "fe25fc2080ed470098208c7753793e8c1b144e4f", "020f637a33330c9cbffe30214fc4833f66556cf2"],
  ["scripts/docs-admission-change.test.mjs", "f21dc2cc597469b2460964a664cb6532c265b72f", "c6a477cf0407c8114d08b59904cb33df901b716c"],
  ["scripts/verify-docs-cohort-v2-receipt.mjs", "9f947073bb3bc1a0f1b5c9aa59eeba6e0f4add7c", "f284df356bae33561e79005292d53eaebb24e00f"],
  ["scripts/verify-docs-consumer-gate.mjs", "ef293a0d0098b8bd7c700ddd8c98968d10a8e9d9", "b3ba07222349bb0bd5ae62c7be2235c6e1ee26e0"],
  ["scripts/verify-docs-consumer-gate.test.mjs", "46e0ecb4621749d5a82a3cc5d85d830a57b72e39", "ea9b48dd798c9272ba649c63570b1076c204b915"],
] as const;
const controller = ["scripts/verify-docs-consumer-gate.mjs", "scripts/verify-docs-consumer-gate.test.mjs", "docs/decisions/0001-qualified-docs-cohorts.md"] as const;
function fixture(): Fixture {
  const tree: Entry[] = git("ls-tree", "-r", "-t", baseRevision).trim().split("\n").map(line => {
    const [header, path] = line.split("\t"); const [mode, type, sha] = header!.split(" ");
    return { path: path!, mode: mode!, type: type!, sha: sha! };
  });
  const headTree = structuredClone(tree);
  const headData = Object.fromEntries(["package.json", "pnpm-lock.yaml"].map(path => [path, {
    encoding: "base64", content: readFileSync(path).toString("base64"), sha: tree.find(entry => entry.path === path)!.sha,
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
    reviewTarget: "c6db8ef6761261581c7564e2c9bea4a5faef135a", baseSHA, headSHA, sourceSHA: headSHA,
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
function controllerFixture(): Fixture {
  const f = fixture();
  controller.forEach((path, index) => {
    const sha = (index + 1).toString(16).padStart(40, "0");
    Object.assign(f.headTree.tree.find(entry => entry.path === path)!, { sha });
    f.files.push({ filename: path, status: "modified", sha, previous_filename: undefined });
  });
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
    const path = `governance/evidence/docs-cohorts/ordinary33-${index}.json`, sha = oid(index + 80);
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

test("exact controller three paths are ordinary; four paths and special wrong PR are rejected", () => {
  assert.equal(check(controllerFixture()), sourceSuccessorResult.ordinary);
  const ordinaryIdentity = ordinary();
  ordinaryIdentity.base = oid(160); ordinaryIdentity.reviewTarget = oid(161);
  assert.equal(check(ordinaryIdentity), sourceSuccessorResult.noop);
  const four = controllerFixture();
  Object.assign(four.headTree.tree.find(entry => entry.path === "README.md")!, { sha: oid(120) });
  four.files.push({ filename: "README.md", status: "modified", sha: oid(120), previous_filename: undefined }); sync(four);
  assert.throws(() => check(four), /exactly three/u);
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
    f => { Object.assign(f.headTree.tree.find(entry => entry.path === controller[0]!)!, { mode: "120000" }); },
    f => { f.headTree.tree.push({ path: "hidden-TEST", mode: "100644", type: "blob", sha: "a".repeat(40) }); },
    f => { Object.assign(f.headTree.tree.find(entry => entry.path === "package.json")!, { sha: "b".repeat(40) }); },
    f => { f.headData["pnpm-lock.yaml"] = { encoding: "base64", content: "bad", sha: "c".repeat(40) }; },
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
