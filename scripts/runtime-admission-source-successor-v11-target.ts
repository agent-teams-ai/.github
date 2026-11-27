import assert from "node:assert/strict";

// Source-owned finite binding. This module has no I/O or authority transport.
// Prepared refreshed PR467 tuple; mutable preparation is not qualification.
// Hosted collection separately requires Ready and fresh immutable-source/protection evidence.
export interface FiniteTarget {
  readonly repository: "agent-teams-ai/.github";
  readonly repositoryId: 1316243981;
  readonly pullRequest: number;
  readonly pullId: number;
  readonly headRef: string;
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
  "scripts/verify-docs-cohort-v2-receipt.mjs",
  "scripts/verify-docs-consumer-gate.test.mjs",
]);
export const FINITE_ADDED_TARGET_PATHS: readonly string[] = Object.freeze([]);

// BEGIN OBSERVED FINITE TARGET BINDING
export const OBSERVED_FINITE_TARGET_BINDING: FiniteTargetBinding = Object.freeze({
  state: "bound",
  target: {
    repository: "agent-teams-ai/.github",
    repositoryId: 1316243981,
    pullRequest: 467,
    pullId: 5524611730,
    headRef: "fix/docs-receipt-authorization-order-20261127",
    baseSHA: "a9d0b5edc5a98337276a1f213dc8663fdb295beb",
    headSHA: "acb42e96fd157775067381e0750144984fab52ca",
    baseTreeSHA: "b10d4e945f685a7ebd393bda223ce18f80db8a18",
    headTreeSHA: "0060e2cc0b790a604f6341dc43f3b863572057df",
    commits: 5,
  },
  tuple: [
    [
      "scripts/verify-docs-cohort-v2-receipt.mjs",
      "3c529582c28073caa6bb2eb0d471be8f3004f1fe",
      "15090b6ce1ca77f3591f3337137d564b4c82dc87",
    ],
    [
      "scripts/verify-docs-consumer-gate.test.mjs",
      "5f890bf76b0577be6f35f6ab478ecc225c5b3516",
      "1720cb51da26b4ddfc1f14b855f81cfdfceb8f90",
    ],
  ],
  commits: [
    "5a631462320e8083d27fa7e69ba97ecb4e50c412",
    "611cd2a78d1f9104dbf46bab69c3ff0e30ac6d8f",
    "acb42e96fd157775067381e0750144984fab52ca",
    "be1c81ec749aa62ddf524424ccd19284c5043a0e",
    "e8c9544c4225ada602706c55ff2f109aafb66e4a",
  ],
} satisfies BoundFiniteTarget);
// END OBSERVED FINITE TARGET BINDING

const oid = /^(?!0{40}$)[0-9a-f]{40}$/u;
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const object = (value: unknown): Record<string, unknown> => {
  assert.ok(isObject(value), "Finite target must be a mapping");
  return value;
};
const array = (value: unknown): unknown[] => {
  assert.ok(Array.isArray(value), "Finite target census must be an array");
  return value;
};
const sha = (value: unknown): void => {
  assert.ok(
    typeof value === "string" && oid.test(value),
    "Finite target requires an actual nonzero Git SHA",
  );
};

/** Only this source-owned PR467 tuple can authorize the bounded authorization digest correction. */
export function assertFiniteTargetBinding(binding: unknown): asserts binding is BoundFiniteTarget {
  const value = object(binding);
  assert.deepEqual(Object.keys(value).toSorted(), ["commits", "state", "target", "tuple"]);
  assert.equal(value["state"], "bound", "Finite authorization correction target is unbound");
  const target = object(value["target"]);
  assert.deepEqual(Object.keys(target).toSorted(), [
    "baseSHA",
    "baseTreeSHA",
    "commits",
    "headRef",
    "headSHA",
    "headTreeSHA",
    "pullId",
    "pullRequest",
    "repository",
    "repositoryId",
  ]);
  assert.equal(target["repository"], "agent-teams-ai/.github");
  assert.equal(target["repositoryId"], 1316243981);
  assert.equal(target["pullRequest"], 467);
  assert.equal(target["pullId"], 5524611730);
  assert.equal(target["headRef"], "fix/docs-receipt-authorization-order-20261127");
  for (const key of ["baseSHA", "headSHA", "baseTreeSHA", "headTreeSHA"]) {
    sha(target[key]);
  }
  assert.notEqual(target["baseSHA"], target["headSHA"]);
  assert.notEqual(target["baseTreeSHA"], target["headTreeSHA"]);
  assert.ok(
    Number.isSafeInteger(target["commits"]) &&
      Number(target["commits"]) >= 1 &&
      Number(target["commits"]) <= 250,
    "Complete bounded source commit count is required",
  );
  const tuple = array(value["tuple"]);
  assert.equal(tuple.length, FINITE_TARGET_PATHS.length);
  const paths: string[] = [];
  for (const raw of tuple) {
    const entry = array(raw);
    assert.equal(entry.length, 3);
    assert.ok(
      typeof entry[0] === "string" && FINITE_TARGET_PATHS.includes(entry[0]),
      "Unreviewed finite source path",
    );
    const path = entry[0];
    paths.push(path);
    assert.equal(
      entry[1] === null,
      FINITE_ADDED_TARGET_PATHS.includes(path),
      "The authorization correction permits no added or removed target files",
    );
    if (entry[1] !== null) {
      sha(entry[1]);
    }
    sha(entry[2]);
    assert.notEqual(entry[1], entry[2], "Unchanged finite tuple member");
  }
  assert.deepEqual(
    paths.toSorted(),
    [...FINITE_TARGET_PATHS].toSorted(),
    "Incomplete or duplicate finite path census",
  );
  const commits = array(value["commits"]);
  assert.equal(commits.length, target["commits"]);
  assert.equal(new Set(commits).size, commits.length);
  for (const commit of commits) {
    sha(commit);
  }
  assert.deepEqual(
    commits,
    commits.toSorted((left, right) =>
      String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
    ),
    "Canonical complete commit census required",
  );
  assert.ok(commits.includes(target["headSHA"]), "Exact head absent from finite commit census");
}

export function requireBoundFiniteTarget(
  binding: unknown = OBSERVED_FINITE_TARGET_BINDING,
): BoundFiniteTarget {
  if (
    binding !== null &&
    typeof binding === "object" &&
    "state" in binding &&
    binding.state === "unbound"
  ) {
    throw new Error(
      "Unbound v11 target: real reviewed PR467 and complete native qualification are required.",
    );
  }
  assertFiniteTargetBinding(binding);
  return binding;
}
