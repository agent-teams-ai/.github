import { compareLeafInventories, type LeafInventory, type RejectionReason as LeafRejectionReason } from "@agent-teams/ci-input-proof";

/**
 * Shared v1 mechanism for the future Runtime selector and central owner merge
 * guard. Adapters supply independent expectations, complete Git-leaf inventories
 * and canonical SHA256 fingerprints (installed executable bytes/graph, not just
 * versions). They authenticate Actions origin externally. Schema matching is NOT
 * authentication; no authenticated flag is evidence. Adapters still prove full-
 * main success/ancestry, F..H and B..H policy, current-H checks and routing.
 * This module performs no IO, hashing or product policy. A match reports omission
 * of unchanged inputs, never executed/passed tests. Structural drift rejects even
 * on permitted content paths. Directory tree OIDs are not leaf content proof.
 * Structural evolution needs a new version; unsupported versions fail closed.
 */
export type InputEntry = Readonly<{
  path: string;
  membership: "closed" | "structural";
  content: string;
} & ({ type: "file"; mode: "100644" | "100755" }
  | { type: "symlink"; mode: "120000" }
  | { type: "gitlink"; mode: "160000" })>;

export type Fingerprints = Readonly<{
  suite: string;
  policy: string;
  implementation: string;
  toolchain: string;
  installedGraph: string;
}>;

export type RunOrigin = Readonly<{
  repository: string;
  runId: string;
  attempt: number;
  workflow: string;
  workflowRevision: string;
  sourceRevision: string;
}>;

export type QualificationInputProofV1 = Readonly<{
  version: 1;
  repository: string;
  candidate: string;
  fullAncestor: string;
  fingerprints: Fingerprints;
  origin: RunOrigin;
  inputs: readonly InputEntry[];
}>;

/** Trusted adapter context, derived separately from either proof payload. */
export type ComparisonExpectationV1 = Readonly<{
  version: 1;
  repository: string;
  candidate: string;
  fullAncestor: string;
  fingerprints: Fingerprints;
  qualifiedOrigin: RunOrigin;
  currentOrigin: RunOrigin;
  inputCount: number;
  /** Full F inventory independently materialized from Git, never copied from a receipt. */
  inputs: readonly InputEntry[];
  permittedContentChanges: readonly string[];
}>;

export type RejectionReason = "missing-proof" | "malformed-proof"
  | "unsupported-version" | "malformed-expectation" | "duplicate-input"
  | "incomplete-inputs" | "identity-mismatch" | "fingerprint-mismatch"
  | "origin-mismatch" | "invalid-content-permission"
  | "input-structure-changed" | "closed-input-changed";

export type ComparisonResult = Readonly<
  { status: "omitted-unchanged-inputs" }
  | { status: "rejected"; reason: RejectionReason }
>;

// Protocol resource ceilings, not consumer selection policy.
export const MAX_INPUT_ENTRIES = 65_536;
const fingerprintKeys = ["suite", "policy", "implementation", "toolchain", "installedGraph"] as const;
const originKeys = ["repository", "runId", "attempt", "workflow", "workflowRevision", "sourceRevision"] as const;
const identityKeys = ["version", "repository", "candidate", "fullAncestor", "fingerprints"] as const;
const reject = (reason: RejectionReason): ComparisonResult => ({ status: "rejected", reason });

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function shape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Reflect.ownKeys(value).length === keys.length
    && keys.every(key => Object.getOwnPropertyDescriptor(value, key)?.value !== undefined);
}
function denseDataArray(value: unknown, limit: number): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
      || value.length > limit || Reflect.ownKeys(value).length !== value.length + 1) {return false;}
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value")) {return false;}
  }
  return true;
}
const leafReasons: Readonly<Record<LeafRejectionReason, RejectionReason>> = {
  "malformed-inventory": "malformed-proof", "unsupported-version": "unsupported-version",
  "unsupported-scheme": "malformed-proof", "scheme-mismatch": "malformed-proof",
  "duplicate-input": "duplicate-input", "incomplete-inputs": "incomplete-inputs",
  "invalid-content-permission": "invalid-content-permission",
  "input-structure-changed": "input-structure-changed", "closed-input-changed": "closed-input-changed",
  "exceeded-limit": "incomplete-inputs",
};
function digest(value: unknown, git = false): value is string {
  return typeof value === "string" && (git ? /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u : /^[a-f0-9]{64}$/u).test(value)
    && !/^0+$/u.test(value);
}
function repository(value: unknown): value is string {
  return typeof value === "string" && value.length <= 201 && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value)
    && value.split("/").every(part => part !== "." && part !== "..");
}
function inputPath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 4096
    && !value.includes("\\") && [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
}
function fingerprints(value: unknown): value is Fingerprints {
  return shape(value, fingerprintKeys) && fingerprintKeys.every(key => digest(value[key]));
}
function origin(value: unknown): value is RunOrigin {
  return shape(value, originKeys) && repository(value.repository)
    && typeof value.runId === "string" && /^[1-9][0-9]{0,19}$/u.test(value.runId)
    && typeof value.attempt === "number" && Number.isSafeInteger(value.attempt) && value.attempt > 0
    && inputPath(value.workflow) && digest(value.workflowRevision, true) && digest(value.sourceRevision, true);
}
function identity(value: Record<string, unknown>): boolean {
  return value.version === 1 && repository(value.repository) && digest(value.candidate, true)
    && digest(value.fullAncestor, true) && fingerprints(value.fingerprints);
}
function entry(value: unknown): value is InputEntry {
  return shape(value, ["path", "type", "mode", "membership", "content"])
    && inputPath(value.path) && digest(value.content)
    && (value.membership === "closed" || value.membership === "structural")
    && ((value.type === "file" && (value.mode === "100644" || value.mode === "100755"))
      || (value.type === "symlink" && value.mode === "120000")
      || (value.type === "gitlink" && value.mode === "160000"));
}
function expectation(value: unknown): value is ComparisonExpectationV1 {
  return shape(value, [...identityKeys, "qualifiedOrigin", "currentOrigin", "inputCount", "inputs", "permittedContentChanges"])
    && identity(value) && origin(value.qualifiedOrigin) && origin(value.currentOrigin)
    && typeof value.inputCount === "number" && Number.isSafeInteger(value.inputCount)
    && value.inputCount > 0 && value.inputCount <= MAX_INPUT_ENTRIES
    && denseDataArray(value.inputs, MAX_INPUT_ENTRIES) && value.inputs.length === value.inputCount
    && value.inputs.every(entry)
    && denseDataArray(value.permittedContentChanges, value.inputCount)
    && value.permittedContentChanges.every(inputPath);
}

function parseProof(value: unknown): QualificationInputProofV1 | RejectionReason {
  if (value === null || value === undefined) {return "missing-proof";}
  const version: unknown = record(value) ? Object.getOwnPropertyDescriptor(value, "version")?.value : undefined;
  if (typeof version === "number" && Number.isSafeInteger(version) && version !== 1) {
    return "unsupported-version";
  }
  if (!shape(value, [...identityKeys, "origin", "inputs"]) || !identity(value) || !origin(value.origin)
      || !Array.isArray(value.inputs)) {return "malformed-proof";}
  if (value.inputs.length === 0 || value.inputs.length > MAX_INPUT_ENTRIES) {return "incomplete-inputs";}
  // Reject executable descriptors/iterators before normalization can erase them.
  if (!denseDataArray(value.inputs, MAX_INPUT_ENTRIES)) {return "malformed-proof";}
  const inputs: unknown[] = value.inputs.map(input => input);
  if (!inputs.every(entry)) {return "malformed-proof";}
  if (new Set(inputs.map(input => input.path)).size !== inputs.length) {return "duplicate-input";}
  if (!inputs.some(input => input.membership === "closed")) {return "incomplete-inputs";}
  return {
    version: 1, repository: value.repository as string, candidate: value.candidate as string,
    fullAncestor: value.fullAncestor as string, fingerprints: { ...value.fingerprints as Fingerprints },
    origin: { ...value.origin }, inputs: inputs.map(input => ({ ...input })),
  };
}

/**
 * Compare inert deserialized proofs against independent trusted adapter context.
 * inputCount comes from the complete admitted inventory, never these records.
 * Completeness and authenticity are adapter obligations, not self-attestations.
 * Results retain no caller objects/arrays and grant no merge/execution success.
 */
export function compareQualificationInputs(
  expected: ComparisonExpectationV1, qualified: unknown, current: unknown,
): ComparisonResult {
  try {
    if (!expectation(expected)) {return reject("malformed-expectation");}
    const wanted = { ...expected, fingerprints: { ...expected.fingerprints },
      qualifiedOrigin: { ...expected.qualifiedOrigin }, currentOrigin: { ...expected.currentOrigin },
      inputs: expected.inputs.map(input => ({ ...input })),
      permittedContentChanges: [...expected.permittedContentChanges] };
    const before = parseProof(qualified);
    if (typeof before === "string") {return reject(before);}
    const after = parseProof(current);
    if (typeof after === "string") {return reject(after);}
    for (const [proof, candidate, run] of [
      [before, wanted.fullAncestor, wanted.qualifiedOrigin],
      [after, wanted.candidate, wanted.currentOrigin],
    ] as const) {
      if (proof.repository !== wanted.repository || proof.candidate !== candidate || proof.fullAncestor !== wanted.fullAncestor) {
        return reject("identity-mismatch");
      }
      if (fingerprintKeys.some(key => proof.fingerprints[key] !== wanted.fingerprints[key])) {return reject("fingerprint-mismatch");}
      if (run.repository !== wanted.repository || run.sourceRevision !== candidate
          || originKeys.some(key => proof.origin[key] !== run[key])) {return reject("origin-mismatch");}
      if (proof.inputs.length !== wanted.inputCount) {return reject("incomplete-inputs");}
    }
    const independent = parseProof({ version: 1, repository: wanted.repository,
      candidate: wanted.fullAncestor, fullAncestor: wanted.fullAncestor,
      fingerprints: wanted.fingerprints, origin: wanted.qualifiedOrigin, inputs: wanted.inputs });
    if (typeof independent === "string") {return reject("malformed-expectation");}
    const allowed = new Set(wanted.permittedContentChanges);
    const baseline = new Map(independent.inputs.map(input => [input.path, input]));
    if (allowed.size !== wanted.permittedContentChanges.length
        || [...allowed].some(path => baseline.get(path)?.membership !== "structural")) {
      return reject("invalid-content-permission");
    }
    const inventory: LeafInventory = { version: 1, digestScheme: "sha256", inputs: independent.inputs };
    const relations = [
      compareLeafInventories(inventory, { ...inventory, inputs: before.inputs }, []),
      compareLeafInventories(inventory, { ...inventory, inputs: after.inputs }, wanted.permittedContentChanges),
    ];
    // Both inventories' structure precedes any content rejection in the v1 wrapper.
    if (relations.some(result => result.status === "rejected" && result.reason === "input-structure-changed")) {
      return reject("input-structure-changed");
    }
    for (const result of relations) {
      if (result.status === "rejected") {return reject(leafReasons[result.reason]);}
    }
    return { status: "omitted-unchanged-inputs" };
  } catch {
    return reject("malformed-proof");
  }
}
