// Source-owned finite binding. This module has no I/O or authority transport.
// Actual PR438 was independently reviewed before replacing the unbound state.
export interface FiniteTarget {
  readonly repository: "agent-teams-ai/.github";
  readonly repositoryId: 1316243981;
  readonly pullRequest: number;
  readonly pullId: number;
  readonly baseSHA: string;
  readonly headSHA: string;
  readonly baseTreeSHA: string;
  readonly headTreeSHA: string;
  readonly commits: number;
}
export type FiniteFileTuple = readonly [path: string, before: string | null, after: string];
export interface BoundFiniteTarget {
  readonly state: "bound";
  readonly target: FiniteTarget;
  readonly tuple: readonly FiniteFileTuple[];
  readonly commits: readonly string[];
}
export interface UnboundFiniteTarget {
  readonly state: "unbound";
  readonly reason: string;
}
export type FiniteTargetBinding = BoundFiniteTarget | UnboundFiniteTarget;

export const FINITE_TARGET_PATHS: readonly string[] = Object.freeze([
  "scripts/repository-registration.ts",
  "scripts/repository-registration.test.ts",
  "scripts/governance-policy.mjs",
  "scripts/observe-org-repository-inventory.mjs",
  "docs/repository-admission.md",
  "docs/repository-registration.md",
  "governance/evidence/docs-admission/canary-deletion-20261126.json",
]);
export const FINITE_ADDED_EVIDENCE_PATH =
  "governance/evidence/docs-admission/canary-deletion-20261126.json";

// BEGIN OBSERVED FINITE TARGET BINDING
export const OBSERVED_FINITE_TARGET_BINDING: FiniteTargetBinding = Object.freeze({
  state: "bound",
  target: Object.freeze({
    repository: "agent-teams-ai/.github",
    repositoryId: 1316243981,
    pullRequest: 438,
    pullId: 5513289558,
    baseSHA: "b88a08c8131b8c98650318eb374a5fd2840bed46",
    headSHA: "2b2ea1732661d1d990e7bc27d34c8dcbc31b9817",
    baseTreeSHA: "7836157a48e966170044755d70c4691a59108ef7",
    headTreeSHA: "60bc5cb183dd180911848328317a13991af62fb5",
    commits: 1,
  } satisfies FiniteTarget),
  tuple: Object.freeze([
    [
      "docs/repository-admission.md",
      "f2cbf6513c450baa205964df69e2b1026fd40034",
      "28b4911095b010cd493046d22df61c1a638683c8",
    ],
    [
      "docs/repository-registration.md",
      "08561be2ad32a03e21fde7f048fb8b986ec1a974",
      "67bb3620625b84693314f699b5cb656303187867",
    ],
    [
      "scripts/governance-policy.mjs",
      "a0120e03d9f3cdae19231b7b8944b056186f59fd",
      "dae3ab8b57933b547d8eb6875899cb6e57226b0f",
    ],
    [
      "scripts/observe-org-repository-inventory.mjs",
      "062a10731e553c5f87cbc4ee9e6c84543a8e0ab0",
      "e690144f94f4fa2ea6b4410960bfecb0fba2136f",
    ],
    [
      "scripts/repository-registration.test.ts",
      "d0f460c7405bd46f3cc7a885bd309e3b31450e16",
      "57d226674416a55260e8e719ce87cb9768753144",
    ],
    [
      "scripts/repository-registration.ts",
      "65faa0a6b366df2c88a39ac2b8faffde7f037820",
      "2775cebb687f51654c0b02c26bee35a6904bf8d2",
    ],
    [
      "governance/evidence/docs-admission/canary-deletion-20261126.json",
      null,
      "ae4f396d378a9e4a061debabb5022c8ec7770ec2",
    ],
  ] satisfies readonly FiniteFileTuple[]),
  commits: Object.freeze(["2b2ea1732661d1d990e7bc27d34c8dcbc31b9817"]),
} satisfies BoundFiniteTarget);
// END OBSERVED FINITE TARGET BINDING

export function requireBoundFiniteTarget(
  binding: FiniteTargetBinding = OBSERVED_FINITE_TARGET_BINDING,
): BoundFiniteTarget {
  if (binding.state !== "bound") {
    throw new Error("Unbound v5 target: real reviewed PR and complete Git tuple are required.");
  }
  return binding;
}
