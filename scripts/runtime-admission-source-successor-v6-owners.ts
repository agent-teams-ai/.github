import assert from "node:assert/strict";
import { checkSourceSuccessor as checkFrozenRuntimeV4 } from "./runtime-admission-source-successor-v4.ts";

export const FROZEN_RUNTIME_V4 = Object.freeze({
  revision: "72fa7a8af02e9ba7904c912f0bbb457254381002",
  ref: "refs/heads/governance/runtime-admission-source-successor-v4",
  context: "runtime-admission-source-successor-v4",
});
export const FROZEN_ADMISSION_V1 = Object.freeze({
  path: ".github/workflows/docs-admission-authority-evolution-v1.yml",
  blob: "8437f647e1ea0ea2f4778427cb09446b837c8af7",
  context: "trusted-admission-authority-evolution-v1",
  target: "scripts/verify-docs-admission-change.mjs",
});
export const PRESERVED_MAIN_CONTEXTS = Object.freeze([
  "check",
  "trusted-admission-evidence",
  "trusted-validation",
]);
export const PRESERVED_IDENTITY_CONTEXT = "commit-author-identity";
export const REQUIRED_CHECK_APP = 15368;

export type AdmissionV1Mode = "noop" | "rollback" | "forward";
export interface AdmissionV1Snapshot {
  readonly pull: unknown;
  readonly files: unknown;
  readonly repository: unknown;
  readonly defaultBranch: unknown;
}
const isMapping = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const mapping = (value: unknown): Record<string, unknown> => {
  assert.ok(isMapping(value));
  return value;
};
const expectedVerifier = new Map<unknown, AdmissionV1Mode>([
  ["e3f0f3d2e065b7c0ae324481a3056b7955a0702d", "rollback"],
  ["1bf455f2ca5bf97440e62b2ff4eaa6c36aa2212b", "forward"],
]);

/**
 * Typed preservation of the literal frozen V1 workflow algorithm.
 * The focused test executes that exact workflow body as the independent oracle.
 * This owner adds no new verifier blob, filename or installation permission.
 */
export function checkAdmissionV1Owner(snapshot: AdmissionV1Snapshot): AdmissionV1Mode {
  const pull = mapping(snapshot.pull);
  assert.ok(
    Number.isSafeInteger(pull.changed_files) &&
      typeof pull.changed_files === "number" &&
      pull.changed_files >= 1,
    "Admission authority evolution PR changed_files must be positive.",
  );
  assert.ok(Array.isArray(snapshot.files));
  const changed = snapshot.files.map(mapping);
  assert.ok(
    changed.length === pull.changed_files &&
      new Set(changed.map((file) => file.filename)).size === changed.length,
    "Paginated admission authority evidence is incomplete or duplicated.",
  );
  const allPaths = (file: Record<string, unknown>): unknown[] =>
    [file.filename, file.previous_filename].filter(Boolean);
  if (!changed.some((file) => allPaths(file).includes(FROZEN_ADMISSION_V1.target))) {
    return "noop";
  }
  const head = mapping(pull.head);
  const headRepository = head.repo === null || head.repo === undefined ? undefined : mapping(head.repo);
  assert.equal(
    headRepository?.full_name,
    "agent-teams-ai/.github",
    "Admission authority changes from forks are not eligible.",
  );
  const only = changed[0];
  assert.ok(
    changed.length === 1 &&
      only?.filename === FROZEN_ADMISSION_V1.target &&
      only.status === "modified" &&
      only.previous_filename === undefined &&
      expectedVerifier.has(only.sha),
    "This successor accepts only the exact reviewed verifier forward or rollback blob.",
  );
  const repository = mapping(snapshot.repository);
  const base = mapping(pull.base);
  assert.equal(
    base.ref,
    repository.default_branch,
    "Admission authority PR must target the live default branch.",
  );
  assert.equal(
    mapping(mapping(snapshot.defaultBranch).commit).sha,
    base.sha,
    "Admission authority PR base is stale; update it before cutover.",
  );
  const mode = expectedVerifier.get(only.sha);
  assert.ok(mode !== undefined);
  return mode;
}

export type OrdinarySourceOwner = "runtime-v4" | "admission-v1";
export class OrdinarySourceOwnersRefused extends Error {
  readonly owners: readonly OrdinarySourceOwner[];

  constructor(owners: readonly OrdinarySourceOwner[], causes: readonly unknown[]) {
    super(`Ordinary source owners refused: ${owners.join(", ")}`, {
      cause: new AggregateError(causes, "Retained source owner refusals"),
    });
    this.name = "OrdinarySourceOwnersRefused";
    this.owners = Object.freeze([...owners]);
  }
}

/**
 * Evaluate both retained owners before reporting a refusal. A V4 rejection must
 * not hide whether the independent admission owner was exercised.
 * Network collection, immutable-source binding and finite-target admission are
 * deliberately outside this preparation kernel.
 */
export async function checkOrdinarySourceOwners(
  evidence: unknown,
  baseManifest: Buffer,
  baseLock: Buffer,
  sourceSHA: string,
  admissionSnapshot: AdmissionV1Snapshot,
): Promise<{ readonly runtime: string; readonly admission: AdmissionV1Mode }> {
  const bound = mapping(evidence);
  const pull = mapping(admissionSnapshot.pull);
  const head = mapping(pull.head);
  const base = mapping(pull.base);
  const repository = mapping(admissionSnapshot.repository);
  assert.equal(pull.number, bound.pullRequest, "Ordinary owners received different PR identities.");
  assert.equal(pull.changed_files, bound.changedFiles, "Ordinary owners received different counts.");
  assert.deepEqual(admissionSnapshot.files, bound.files, "Ordinary owners received different files.");
  assert.equal(head.sha, bound.headSHA, "Ordinary owners received different heads.");
  assert.equal(mapping(head.repo).full_name, bound.headRepository);
  assert.equal(base.sha, bound.baseSHA, "Ordinary owners received different bases.");
  assert.equal(base.ref, bound.baseRef);
  assert.equal(repository.full_name, bound.repository);
  assert.equal(repository.default_branch, bound.defaultBranch);
  assert.equal(
    mapping(mapping(admissionSnapshot.defaultBranch).commit).sha,
    bound.baseSHA,
    "Ordinary owners received a stale current-main observation.",
  );
  const results = await Promise.allSettled([
    Promise.resolve().then(() =>
      checkFrozenRuntimeV4(evidence, baseManifest, baseLock, sourceSHA),
    ),
    Promise.resolve().then(() => checkAdmissionV1Owner(admissionSnapshot)),
  ] as const);
  const owners: OrdinarySourceOwner[] = [];
  const causes: unknown[] = [];
  for (const [index, owner] of [
    [0, "runtime-v4"],
    [1, "admission-v1"],
  ] as const) {
    const result = results[index];
    if (result.status === "rejected") {
      owners.push(owner);
      causes.push(result.reason);
    }
  }
  if (results[0].status !== "fulfilled" || results[1].status !== "fulfilled") {
    throw new OrdinarySourceOwnersRefused(owners, causes);
  }
  return Object.freeze({ runtime: results[0].value, admission: results[1].value });
}
