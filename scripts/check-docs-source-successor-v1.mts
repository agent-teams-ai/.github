import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assertVerifierAuthority } from "./check-docs-verifier-authority.mts";

export const sourceSuccessorResult = Object.freeze({
  noop: "noop",
  special: "special",
  ordinary: "ordinary",
} as const);
export type SourceSuccessorResult = typeof sourceSuccessorResult[keyof typeof sourceSuccessorResult];

const binding = Object.freeze({
  repository: "agent-teams-ai/.github",
  pullRequest: 363,
  base: "5abed741aff64506d0e9f87f76541a4e93af7e4a",
  reviewTarget: "c6db8ef6761261581c7564e2c9bea4a5faef135a",
  changes: Object.freeze([
    [".github/workflows/docs-protocol-check.yml", "f1492257de281f40a262042eb989291558147d5f", "a9016c6edca859b4182934732f0ff9b9054ca4e5"],
    ["scripts/check-community-files.mjs", "0cd13eade8a6a146934164e1e2f93dca0a3b35dd", "144e26650e7b74da97473424ed67d3719bc3f05b"],
    ["scripts/check-community-files.test.mjs", "fe25fc2080ed470098208c7753793e8c1b144e4f", "020f637a33330c9cbffe30214fc4833f66556cf2"],
    ["scripts/docs-admission-change.test.mjs", "f21dc2cc597469b2460964a664cb6532c265b72f", "c6a477cf0407c8114d08b59904cb33df901b716c"],
    ["scripts/verify-docs-cohort-v2-receipt.mjs", "9f947073bb3bc1a0f1b5c9aa59eeba6e0f4add7c", "f284df356bae33561e79005292d53eaebb24e00f"],
    ["scripts/verify-docs-consumer-gate.mjs", "ef293a0d0098b8bd7c700ddd8c98968d10a8e9d9", "b3ba07222349bb0bd5ae62c7be2235c6e1ee26e0"],
    ["scripts/verify-docs-consumer-gate.test.mjs", "46e0ecb4621749d5a82a3cc5d85d830a57b72e39", "ea9b48dd798c9272ba649c63570b1076c204b915"],
  ] as const),
});
const successorInputs = Object.freeze([
  "scripts/check-docs-source-successor-v1.mts",
  "scripts/check-docs-source-successor-v1.test.mts",
  ".github/workflows/docs-source-successor-v1.yml",
  "docs/decisions/0009-bounded-docs-source-successor.md",
  "tsconfig.docs-source-successor.json",
]);
const legacyProtectedPaths = Object.freeze([
  ...["ci", "commit-author-identity", "commit-author-identity-check", "docs-authority-evolution",
    "docs-cohort-authority-evolution-v8", "docs-cohort-append-only", "docs-admission-evidence",
    "docs-admission-authority-evolution-v1", "docs-protocol-check"].map(name => `.github/workflows/${name}.yml`),
  ...["check-docs-verifier-authority.mts", "check-docs-verifier-authority.test.mts",
    "docs-cohort-authority-evolution-v8.test.mjs", "check-cohort-append-only.mjs",
    "check-cohort-emergency-append.mjs", "check-community-files.mjs", "docs-cohort-policy.mjs",
    "governance-policy.mjs", "validate-governance.mjs", "verify-docs-cohort-evidence.mjs",
    "verify-docs-admission-change.mjs", "verify-docs-consumer-gate.mjs",
    "verify-docs-qualification-receipt.mjs", "verify-docs-cohort-v2-receipt.mjs",
    "docs-legacy-admission-recovery.mjs", "docs-platform-admission-recovery.mjs",
    "verify-docs-platform-recovery-installation-r317.mjs", "check-quality-scope.mjs",
    "run-quality-lint.mjs"].map(name => `scripts/${name}`),
  ...["actions-policy", "code-security-defaults", "docs-protocol-policy", "docs-protocol-policy-v2",
    "docs-protocol-exceptions", "docs-qualified-cohorts", "executable-spec-qualification",
    "organization-repository-inventory"].map(name => `governance/${name}.schema.json`),
  "governance/docs-protocol-policy.json", "governance/docs-admission-recovery.json",
  "governance/docs-platform-admission-recovery.json", "governance/commit-author-identity.json",
  ".node-version", ".npmrc", "pnpm-workspace.yaml", "foundation.config.yaml", "oxlint.json",
  "tsconfig.tooling.json", "docs/engineering-quality-profile.json",
  "docs/engineering-quality-source-policy.yaml", "docs/engineering-quality-required-tests.json",
]);
const oid = /^(?!0{40}$)[0-9a-f]{40}$/u;
const validPath = (value: unknown): value is string => typeof value === "string" && value.length <= 4096 &&
  !/[\\\0]/u.test(value) && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
const record = (value: unknown): Record<string, unknown> => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected a complete mapping");
  return value as Record<string, unknown>;
};
const string = (value: unknown, label: string): string => {
  assert.ok(typeof value === "string" && value.length > 0, `Missing ${label}`);
  return value;
};
const gitBlob = (bytes: Buffer): string => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

type Entry = { path: string; mode: string; type: string; sha: string };
type ChangedFile = { filename: string; status: string; sha: string; previous_filename: string | undefined };
type InputEntry = Entry | null;
function parseTree(raw: unknown): Map<string, Entry> {
  const tree = record(raw);
  assert.equal(tree.truncated, false, "Incomplete Git tree");
  assert.ok(typeof tree.sha === "string" && oid.test(tree.sha), "Unbound Git tree");
  assert.ok(Array.isArray(tree.tree), "Missing Git tree");
  const entries = new Map<string, Entry>();
  for (const rawEntry of tree.tree) {
    const entry = record(rawEntry);
    const path = string(entry.path, "Git path");
    assert.ok(validPath(path) && typeof entry.sha === "string" && oid.test(entry.sha) &&
      typeof entry.mode === "string" && typeof entry.type === "string" &&
      (entry.type === "blob" ? ["100644", "100755", "120000"].includes(entry.mode) :
        entry.type === "tree" ? entry.mode === "040000" : entry.type === "commit" && entry.mode === "160000"),
      "Malformed Git entry");
    assert.ok(!entries.has(path), "Duplicate Git entry");
    entries.set(path, { path, mode: entry.mode, type: entry.type, sha: entry.sha });
  }
  return entries;
}

function parseFiles(raw: unknown): ChangedFile[] {
  assert.ok(Array.isArray(raw), "Missing changed files");
  const seen = new Set<string>();
  return raw.map(value => {
    const file = record(value);
    const path = string(file.filename, "changed filename");
    assert.ok(validPath(path) && !seen.has(path) && typeof file.sha === "string" && oid.test(file.sha),
      "Malformed or duplicate changed file");
    seen.add(path);
    assert.ok(["added", "modified", "removed", "renamed", "copied", "changed"].includes(String(file.status)), "Invalid file status");
    assert.ok(file.previous_filename === undefined || validPath(file.previous_filename), "Invalid rename origin");
    assert.ok(file.status !== "renamed" || file.previous_filename !== undefined, "Missing rename origin");
    return { filename: path, status: String(file.status), sha: String(file.sha),
      previous_filename: file.previous_filename as string | undefined };
  });
}

function parseInputEvidence(raw: unknown, tree: Map<string, Entry>, label: string): Map<string, InputEntry> {
  const values = record(raw);
  assert.deepEqual(Object.keys(values).toSorted(), [...successorInputs].toSorted(), `Invalid ${label} input inventory`);
  const result = new Map<string, InputEntry>();
  for (const path of successorInputs) {
    const value = values[path];
    if (value === null) { result.set(path, null); continue; }
    const parsed = parseTree({ sha: "1".repeat(40), truncated: false, tree: [value] }).get(path);
    assert.ok(parsed && parsed.path === path, `Malformed ${label} input: ${path}`);
    assert.deepEqual(parsed, tree.get(path) ?? null, `Unbound ${label} input: ${path}`);
    result.set(path, parsed);
  }
  return result;
}

function assertLiveEnvelope(evidence: Record<string, unknown>, special: boolean): void {
  assert.equal(evidence.repository, binding.repository, "Repository drift");
  assert.ok(Number.isSafeInteger(evidence.pullRequest) && Number(evidence.pullRequest) > 0, "Invalid pull request");
  if (special) {
    assert.equal(evidence.pullRequest, binding.pullRequest, "Special source pull request drift");
    assert.equal(evidence.base, binding.base, "Reviewed base drift");
    assert.equal(evidence.reviewTarget, binding.reviewTarget, "Audited source provenance drift");
  }
  for (const key of ["baseSHA", "headSHA", "sourceSHA"] as const) {
    assert.ok(typeof evidence[key] === "string" && oid.test(evidence[key]), `Invalid ${key}`);
  }
  assert.equal(evidence.sourceSHA, evidence.headSHA, "Audited sourceSHA is not the live source head");
  assert.equal(evidence.baseRef, evidence.defaultBranch, "Base is not the default branch");
  assert.equal(evidence.headRepository, binding.repository, "Foreign source repository");
  const live = record(evidence.live);
  assert.equal(live.state, "open", "PR is not open");
  assert.equal(live.baseSHA, evidence.baseSHA, "Live base drift");
  assert.equal(live.headSHA, evidence.headSHA, "Live head drift");
  assert.equal(live.sourceSHA, evidence.sourceSHA, "Live sourceSHA drift");
  assert.equal(live.baseRef, evidence.baseRef, "Live base ref drift");
  assert.equal(live.defaultBranch, evidence.defaultBranch, "Live default branch drift");
  assert.equal(live.headRepository, evidence.headRepository, "Live repository drift");
  assert.equal(live.changedFiles, evidence.changedFiles, "Live changed_files drift");
  assert.equal(live.pullRequest, evidence.pullRequest, "Live pull request drift");
  assert.equal(live.repository, evidence.repository, "Live repository drift");
}

const entry = (map: Map<string, Entry>, path: string): Entry | undefined => map.get(path);
const sameEntry = (a: Entry | undefined, b: Entry | undefined): boolean =>
  a?.sha === b?.sha && a?.mode === b?.mode && a?.type === b?.type;
function changedLeaves(base: Map<string, Entry>, head: Map<string, Entry>): Set<string> {
  const changed = new Set<string>();
  for (const path of new Set([...base.keys(), ...head.keys()])) {
    const before = base.get(path), after = head.get(path);
    if (before?.type !== "tree" || after?.type !== "tree") {
      if (!sameEntry(before, after)) {
        changed.add(path);
      }
    }
  }
  return changed;
}
function assertNoHiddenChanges(files: ChangedFile[], base: Map<string, Entry>, head: Map<string, Entry>): void {
  const declared = new Set<string>();
  for (const file of files) {
    declared.add(String(file.filename));
    if (file.status === "renamed") {
      declared.add(String(file.previous_filename));
    }
  }
  for (const path of changedLeaves(base, head)) {
    assert.ok(declared.has(path), `Unlisted changed Git leaf: ${path}`);
  }
}
function assertLegacyProtected(base: Map<string, Entry>, head: Map<string, Entry>, allowed: ReadonlySet<string>): void {
  for (const path of legacyProtectedPaths) {
    const before = entry(base, path), after = entry(head, path);
    assert.ok(before && before.type === "blob" && before.mode === "100644", `Missing protected input: ${path}`);
    assert.ok(allowed.has(path) || sameEntry(before, after), `Protected input changed: ${path}`);
  }
}
function assertSuccessorInputs(base: Map<string, Entry>, head: Map<string, Entry>,
  baseInputs: Map<string, InputEntry>, headInputs: Map<string, InputEntry>): void {
  const basePresent = successorInputs.filter(path => base.has(path));
  const headPresent = successorInputs.filter(path => head.has(path));
  assert.ok(basePresent.length === 0 || basePresent.length === successorInputs.length,
    "Successor inputs must be added together or remain together");
  assert.ok(headPresent.length === 0 || headPresent.length === successorInputs.length,
    "Successor head inputs must be added together or remain together");
  for (const path of successorInputs) {
    const before = entry(base, path), after = entry(head, path);
    assert.deepEqual(baseInputs.get(path) ?? null, before ?? null, `Unbound base input: ${path}`);
    assert.deepEqual(headInputs.get(path) ?? null, after ?? null, `Unbound head input: ${path}`);
    if (!before) {
      if (!after) {
        continue;
      }
      assert.ok(after && after.type === "blob" && after.mode === "100644", `Invalid bootstrap input: ${path}`);
      continue;
    }
    assert.ok(before.type === "blob" && before.mode === "100644" && sameEntry(before, after),
      `Protected successor input changed: ${path}`);
  }
}

function specialShape(files: ChangedFile[], base: Map<string, Entry>, head: Map<string, Entry>): boolean {
  const paths = new Set(files.map(file => String(file.filename)));
  return files.length === binding.changes.length && paths.size === files.length &&
    binding.changes.every(([path]) => paths.has(path)) &&
    changedLeaves(base, head).size === binding.changes.length &&
    binding.changes.every(([path]) => changedLeaves(base, head).has(path));
}
function assertSpecial(files: ChangedFile[], base: Map<string, Entry>, head: Map<string, Entry>): void {
  assert.equal(files.length, binding.changes.length, "Source transition must contain exactly seven files");
  for (const [path, before, after] of binding.changes) {
    const file = files.find(candidate => candidate.filename === path);
    assert.ok(file && file.status === "modified" && file.previous_filename === undefined && file.sha === after,
      `Unbound source file: ${path}`);
    assert.ok(sameEntry(entry(base, path), { path, mode: "100644", type: "blob", sha: before }), `Source before blob mismatch: ${path}`);
    assert.ok(sameEntry(entry(head, path), { path, mode: "100644", type: "blob", sha: after }), `Source after blob mismatch: ${path}`);
  }
}
function assertInstallBinding(base: Map<string, Entry>, head: Map<string, Entry>, headData: unknown,
  baseManifest: Buffer, baseLock: Buffer): void {
  const data = record(headData);
  for (const [path, bytes] of [["package.json", baseManifest], ["pnpm-lock.yaml", baseLock]] as const) {
    const before = entry(base, path), after = entry(head, path);
    assert.ok(before && after && before.type === "blob" && after.type === "blob" &&
      before.mode === "100644" && after.mode === "100644", `Install data must be regular: ${path}`);
    assert.equal(before.sha, gitBlob(bytes), `Trusted checkout does not match base: ${path}`);
    assert.equal(after.sha, before.sha, `Install data changed: ${path}`);
    const blob = record(data[path]);
    assert.equal(blob.encoding, "base64", `Missing head install encoding: ${path}`);
    assert.ok(typeof blob.content === "string" && blob.content.length <= 3 * 1024 * 1024, `Oversized head install data: ${path}`);
    const headBytes = Buffer.from(blob.content, "base64");
    assert.equal(blob.sha, after.sha, `Unbound head install data: ${path}`);
    assert.equal(gitBlob(headBytes), after.sha, `Head install blob mismatch: ${path}`);
    assert.equal(headBytes.toString("utf8"), bytes.toString("utf8"), `Install bytes changed: ${path}`);
  }
}
export function checkDocsSourceSuccessor(raw: unknown, baseManifest: Buffer, baseLock: Buffer): SourceSuccessorResult {
  const evidence = record(raw);
  const files = parseFiles(evidence.files);
  assert.equal(evidence.paginationComplete, true, "Changed-file pagination is incomplete");
  assert.ok(Number.isSafeInteger(evidence.changedFiles) && Number(evidence.changedFiles) >= 1 &&
    Number(evidence.changedFiles) <= 32, "Invalid changed_files; expected 1..32");
  assert.equal(files.length, Number(evidence.changedFiles), "Changed-file pagination mismatch");
  const base = parseTree(evidence.baseTree), head = parseTree(evidence.headTree);
  const baseInputs = parseInputEvidence(evidence.baseInputs, base, "base");
  const headInputs = parseInputEvidence(evidence.headInputs, head, "head");
  assertNoHiddenChanges(files, base, head);
  const special = specialShape(files, base, head);
  const allowedLegacyChanges = special
    ? new Set<string>(binding.changes.map(([path]) => path))
    : new Set<string>();
  assertLegacyProtected(base, head, allowedLegacyChanges);
  assertSuccessorInputs(base, head, baseInputs, headInputs);
  assertLiveEnvelope(evidence, special);
  if (special) {
    assertSpecial(files, base, head);
    assertInstallBinding(base, head, evidence.headData, baseManifest, baseLock);
    return sourceSuccessorResult.special;
  }
  const authority = assertVerifierAuthority({
    changedFiles: evidence.changedFiles,
    files: evidence.files,
    baseTree: evidence.baseTree,
    headTree: evidence.headTree,
    headData: evidence.headData,
  }, baseManifest, baseLock);
  return authority === "noop" ? sourceSuccessorResult.noop : sourceSuccessorResult.ordinary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [evidence, manifest, lock] = await Promise.all([
    readFile(process.argv[2]!, "utf8"), readFile("package.json"), readFile("pnpm-lock.yaml"),
  ]);
  console.log(`Docs source successor: ${checkDocsSourceSuccessor(JSON.parse(evidence), manifest, lock)}`);
}
