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
  reviewTarget: "96cb95a89ca4a133fbb626133eb3ac6289938ff7",
  changes: Object.freeze([
    [".github/workflows/docs-protocol-check.yml", "f1492257de281f40a262042eb989291558147d5f", "9f6ffdbe9fda3a6b3bd464d0f8d9acf13db177b5"],
    ["scripts/check-community-files.mjs", "0cd13eade8a6a146934164e1e2f93dca0a3b35dd", "dc73c222cdee7120c2e8ad171ac71ddaca8db229"],
    ["scripts/check-community-files.test.mjs", "fe25fc2080ed470098208c7753793e8c1b144e4f", "e73940dff7c43315f87b5aa4ebc0c6c614b6ed64"],
    ["scripts/docs-admission-change.test.mjs", "f21dc2cc597469b2460964a664cb6532c265b72f", "ec825f0e38c41d94d20f88d426eddefafb9ea61f"],
    ["scripts/verify-docs-cohort-v2-receipt.mjs", "9f947073bb3bc1a0f1b5c9aa59eeba6e0f4add7c", "b1c92368888dde71ad7b73c107b6da6bb2e94d4d"],
    ["scripts/verify-docs-consumer-gate.mjs", "ef293a0d0098b8bd7c700ddd8c98968d10a8e9d9", "643cc6fab95bba66761082c7d883c7a3a113164c"],
    ["scripts/verify-docs-consumer-gate.test.mjs", "46e0ecb4621749d5a82a3cc5d85d830a57b72e39", "1ffbf36feea0f4643a0ffde81db98edf1c350f2a"],
  ] as const),
});
const historicalCohort = Object.freeze({
  changes: Object.freeze([
    ["scripts/docs-cohort-policy.test.mjs", "46820a7a94cd59403e5b3ae29429e72ec7c64373", "7543006ded770545dc1525e0aa199bdd52aaffe2"],
    ["scripts/docs-admission-change.test.mjs", "2269c2fb4cf386d1af4d122fafc6e369c519137d", "fcf776fe84f2e36b47e14971a41d3906739f913b"],
    ["scripts/verify-docs-cohort-evidence.mjs", "3b58fde6e5ec79241d60439785f2f94764b0fd99", "fba985a230c710aba355b15a0360f464ad961ff0"],
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
    "verify-docs-consumer-gate.test.mjs",
    "verify-docs-qualification-receipt.mjs", "verify-docs-cohort-v2-receipt.mjs",
    "docs-legacy-admission-recovery.mjs", "docs-platform-admission-recovery.mjs",
    "verify-docs-platform-recovery-installation-r317.mjs", "check-quality-scope.mjs",
    "run-quality-lint.mjs"].map(name => `scripts/${name}`),
  ...["actions-policy", "code-security-defaults", "docs-protocol-policy", "docs-protocol-policy-v2",
    "docs-protocol-exceptions", "docs-qualified-cohorts", "executable-spec-qualification",
    "organization-repository-inventory"].map(name => `governance/${name}.schema.json`),
  "docs/decisions/0001-qualified-docs-cohorts.md",
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
    const leaf = before?.type !== "tree" && after?.type !== "tree";
    const replacement = before && after && (before.type === "tree") !== (after.type === "tree");
    if (leaf || replacement) {
      if (!sameEntry(before, after)) {
        changed.add(path);
      }
    }
  }
  return changed;
}
function assertNoAncestorReplacement(base: Map<string, Entry>, head: Map<string, Entry>): void {
  for (const path of new Set([...base.keys(), ...head.keys()])) {
    const before = base.get(path), after = head.get(path);
    if (before && after && (before.type === "tree") !== (after.type === "tree")) {
      throw new Error(`Ancestor directory replacement: ${path}`);
    }
  }
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
function assertLegacyProtected(base: Map<string, Entry>, head: Map<string, Entry>, allowed: ReadonlySet<string>,
  historicalMissing: ReadonlySet<string> | undefined): void {
  for (const path of legacyProtectedPaths) {
    const before = entry(base, path), after = entry(head, path);
    if (historicalMissing?.has(path) && !before && !after) {
      continue;
    }
    assert.ok(before && before.type === "blob" && before.mode === "100644",
      `Missing protected input: ${path}`);
    assert.ok(after && after.type === "blob" && after.mode === "100644",
      `Missing protected input: ${path}`);
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


const laterProtectedPaths: ReadonlySet<string> = Object.freeze(new Set([
  ".github/workflows/commit-author-identity.yml",
  ".github/workflows/commit-author-identity-check.yml",
  "scripts/check-docs-verifier-authority.mts",
  "scripts/check-docs-verifier-authority.test.mts",
  "scripts/docs-platform-admission-recovery.mjs",
  "scripts/verify-docs-platform-recovery-installation-r317.mjs",
  "scripts/check-quality-scope.mjs",
  "scripts/run-quality-lint.mjs",
  "governance/docs-platform-admission-recovery.json",
  "governance/commit-author-identity.json",
  "foundation.config.yaml",
  "oxlint.json",
  "tsconfig.tooling.json",
  "docs/engineering-quality-profile.json",
  "docs/engineering-quality-source-policy.yaml",
  "docs/engineering-quality-required-tests.json",
]));
const historicalCommitTrees: ReadonlySet<string> = Object.freeze(new Set([
  "fff9d72e5b6f7022348d3a51ff54b1237ae68e1c/48f59318e7132d4e45cfceb6950101ddee65e874",
  "9cc720c30a3cb1501426c9a27f2f837692c7f2d0/6d6902acee4511a62217e88ac55e8af0b2525330",
]));
function isHistoricalCommitTree(baseCommit: string, baseTree: string,
  headCommit: string, headTree: string): boolean {
  const before = `${baseCommit}/${baseTree}`, after = `${headCommit}/${headTree}`;
  return before !== after && historicalCommitTrees.has(before) && historicalCommitTrees.has(after);
}
const historicalCohortData = Object.freeze({
  baseCommit: "de0cbe6b327fa3ec2d41a75ab30b4a839a6f247f",
  baseTree: "4bbb6095d0643208f81db3478c4d76b6e95e77da",
  headCommit: "64e4f5a1eb337bfaea8a7ca44d15696b83b0eff8",
  headTree: "65ade1cb9582a39d8f5cc772c2f8d4139930195a",
  absentPaths: Object.freeze(new Set<string>([
    "scripts/check-docs-verifier-authority.mts",
    "scripts/check-docs-verifier-authority.test.mts",
    "tsconfig.tooling.json",
  ])),
  changes: Object.freeze([
    ["governance/docs-qualified-cohorts.json", "7a61f13a8a73406d206612f9051666d9f9779c7d", "4643e77d369bc1acb8673d13214269e4eadc23d1"],
    ["governance/docs-runtime-closures/sha256-48dcadfa67bcf5f32e8aa7a510d83e9475335d7153b145ff84f00e9b5da993e2.json", undefined, "942e3629cbeaaac3514582be6f6e89c6a66e98b0"],
    ["governance/evidence/docs-cohorts/docs-2026-10-03-stable31/publication.json", undefined, "b1004a245150df492f9c827c9120e6873afb7ff7"],
    ["governance/evidence/docs-cohorts/docs-2026-10-03-stable31/record-review.md", undefined, "564971dccbaaf2499c4122ff99cd68fe7737ded1"],
  ] as const),
});
function isHistoricalCohortDataCommitTree(baseCommit: string, baseTree: string,
  headCommit: string, headTree: string): boolean {
  return baseCommit === historicalCohortData.baseCommit && baseTree === historicalCohortData.baseTree &&
    headCommit === historicalCohortData.headCommit && headTree === historicalCohortData.headTree;
}
type HistoricalDirection = "forward" | "rollback";
function historicalCohortShape(files: ChangedFile[], base: Map<string, Entry>, head: Map<string, Entry>): HistoricalDirection | undefined {
  const forward = historicalCohort.changes;
  const rollback = forward.map(([path, before, after]) => [path, after, before] as const);
  for (const [direction, changes] of [["forward", forward], ["rollback", rollback]] as const) {
    const paths = new Set(files.map(file => String(file.filename)));
    const expectedPaths = new Set(changes.map(([path]) => path));
    const exactFiles = files.length === changes.length && paths.size === files.length &&
      changes.every(([path, , after]) => {
        const file = files.find(candidate => candidate.filename === path);
        return file?.status === "modified" && file.previous_filename === undefined && file.sha === after;
      });
    const changed = changedLeaves(base, head);
    if (exactFiles && changed.size === changes.length &&
      [...expectedPaths].every(path => changed.has(path))) {
      return direction;
    }
  }
  return undefined;
}
function assertHistoricalCohort(files: ChangedFile[], base: Map<string, Entry>, head: Map<string, Entry>,
  direction: HistoricalDirection): void {
  const changes = direction === "forward" ? historicalCohort.changes :
    historicalCohort.changes.map(([path, before, after]) => [path, after, before] as const);
  assert.equal(files.length, changes.length, "Historical Cohort route must contain exactly three files");
  for (const [path, before, after] of changes) {
    const file = files.find(candidate => candidate.filename === path);
    assert.ok(file && file.status === "modified" && file.previous_filename === undefined && file.sha === after,
      `Unbound historical Cohort file: ${path}`);
    assert.ok(sameEntry(entry(base, path), { path, mode: "100644", type: "blob", sha: before }),
      `Historical Cohort before blob mismatch: ${path}`);
    assert.ok(sameEntry(entry(head, path), { path, mode: "100644", type: "blob", sha: after }),
      `Historical Cohort after blob mismatch: ${path}`);
  }
}
function assertHistoricalCohortData(files: ChangedFile[], base: Map<string, Entry>, head: Map<string, Entry>): void {
  const changes = historicalCohortData.changes;
  assert.equal(files.length, changes.length, "Historical Cohort data route must contain exactly four files");
  for (const [path, before, after] of changes) {
    const file = files.find(candidate => candidate.filename === path);
    const status = before === undefined ? "added" : "modified";
    assert.ok(file && file.status === status && file.previous_filename === undefined && file.sha === after,
      `Unbound historical Cohort data file: ${path}`);
    if (before === undefined) {
      assert.ok(!entry(base, path), `Historical Cohort data before tree unexpectedly contains ${path}`);
    } else {
      assert.ok(sameEntry(entry(base, path), { path, mode: "100644", type: "blob", sha: before }),
        `Historical Cohort data before blob mismatch: ${path}`);
    }
    assert.ok(sameEntry(entry(head, path), { path, mode: "100644", type: "blob", sha: after }),
      `Historical Cohort data after blob mismatch: ${path}`);
  }
}
const cohortData = (file: ChangedFile): boolean => oid.test(file.sha) &&
  file.previous_filename === undefined && !file.filename.split("/").includes("node_modules") &&
  !/(?:^|\/)(?:package(?:-lock)?\.json|npm-shrinkwrap\.json)$/u.test(file.filename) &&
  (file.filename === "governance/docs-qualified-cohorts.json" ? file.status === "modified" :
    file.status === "added" && (/^governance\/evidence\/docs-cohorts\/[a-z0-9][a-z0-9._/-]*\.(?:json|md)$/u.test(file.filename) ||
      /^governance\/docs-runtime-closures\/sha256-[0-9a-f]{64}\.json$/u.test(file.filename)));
function assertCohortData(files: ChangedFile[], base: Map<string, Entry>, head: Map<string, Entry>): void {
  assert.ok(files.every(cohortData), "Cohort-only route contains non-Cohort data");
  for (const file of files) {
    const before = entry(base, file.filename), after = entry(head, file.filename);
    if (file.status === "added") {
      assert.ok(!before && after?.type === "blob" && after.mode === "100644" && after.sha === file.sha,
        `Unbound added Cohort data: ${file.filename}`);
    } else {
      assert.ok(before?.type === "blob" && before.mode === "100644" &&
        after?.type === "blob" && after.mode === "100644" && after.sha === file.sha,
        `Unbound modified Cohort data: ${file.filename}`);
    }
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
function assertInstallDataBound(base: Map<string, Entry>, head: Map<string, Entry>, headData: unknown): void {
  const data = record(headData);
  for (const path of ["package.json", "pnpm-lock.yaml"]) {
    const before = entry(base, path), after = entry(head, path);
    assert.ok(before && after && before.type === "blob" && after.type === "blob" &&
      before.mode === "100644" && after.mode === "100644",
      `Install data is not regular: ${path}`);
    const blob = record(data[path]);
    assert.equal(blob.encoding, "base64", `Missing head install encoding: ${path}`);
    assert.ok(typeof blob.content === "string" && blob.content.length <= 3 * 1024 * 1024, `Oversized head install data: ${path}`);
    const bytes = Buffer.from(blob.content, "base64");
    assert.ok(Number.isSafeInteger(blob.size) && Number(blob.size) === bytes.length, `Unbound head install size: ${path}`);
    assert.equal(blob.sha, after.sha, `Unbound head install data: ${path}`);
    assert.equal(gitBlob(bytes), after.sha, `Head install blob mismatch: ${path}`);
  }
}
function assertInstallDataUnchanged(base: Map<string, Entry>, head: Map<string, Entry>, headData: unknown): void {
  assertInstallDataBound(base, head, headData);
  for (const path of ["package.json", "pnpm-lock.yaml"]) {
    assert.ok(sameEntry(entry(base, path), entry(head, path)), `Install data changed: ${path}`);
  }
}
function assertInstallBinding(base: Map<string, Entry>, head: Map<string, Entry>, headData: unknown,
  baseManifest: Buffer, baseLock: Buffer): void {
  assertInstallDataBound(base, head, headData);
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
    Number(evidence.changedFiles) <= 3000, "Invalid changed_files; expected 1..3000");
  assert.equal(files.length, Number(evidence.changedFiles), "Changed-file pagination mismatch");
  const cohort = files.every(cohortData);
  const base = parseTree(evidence.baseTree), head = parseTree(evidence.headTree);
  const baseInputs = parseInputEvidence(evidence.baseInputs, base, "base");
  const headInputs = parseInputEvidence(evidence.headInputs, head, "head");
  assertNoHiddenChanges(files, base, head);
  assertNoAncestorReplacement(base, head);
  const historicalDataPair = isHistoricalCohortDataCommitTree(String(evidence.baseSHA), String(record(evidence.baseTree).sha),
    String(evidence.headSHA), String(record(evidence.headTree).sha));
  const historical = !historicalDataPair && isHistoricalCommitTree(String(evidence.baseSHA), String(record(evidence.baseTree).sha),
    String(evidence.headSHA), String(record(evidence.headTree).sha))
    ? historicalCohortShape(files, base, head)
    : undefined;
  const special = specialShape(files, base, head);
  const allowedLegacyChanges = special
    ? new Set<string>(binding.changes.map(([path]) => path))
    : historical
      ? new Set<string>(historicalCohort.changes.map(([path]) => path))
      : new Set<string>();
  assertLegacyProtected(base, head, allowedLegacyChanges, historicalDataPair
    ? historicalCohortData.absentPaths
    : historical ? laterProtectedPaths : undefined);
  assertSuccessorInputs(base, head, baseInputs, headInputs);
  assertLiveEnvelope(evidence, special);
  assertInstallDataBound(base, head, evidence.headData);
  if (historicalDataPair) {
    assertHistoricalCohortData(files, base, head);
    assertCohortData(files, base, head);
    assertInstallDataUnchanged(base, head, evidence.headData);
    return sourceSuccessorResult.noop;
  }
  if (historical) {
    assertHistoricalCohort(files, base, head, historical);
    assertInstallDataUnchanged(base, head, evidence.headData);
    return sourceSuccessorResult.ordinary;
  }
  if (cohort) {
    assertCohortData(files, base, head);
    assertInstallDataUnchanged(base, head, evidence.headData);
    return sourceSuccessorResult.noop;
  }
  if (special) {
    assertSpecial(files, base, head);
    assertInstallBinding(base, head, evidence.headData, baseManifest, baseLock);
    return sourceSuccessorResult.special;
  }
  assert.ok(cohort || Number(evidence.changedFiles) <= 32,
    "Invalid changed_files; expected 1..32 outside Cohort data");
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
