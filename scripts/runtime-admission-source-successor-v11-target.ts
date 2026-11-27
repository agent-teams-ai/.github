import assert from "node:assert/strict";

// Source-owned finite binding. This module has no I/O or authority transport.
// Prepared refreshed PR447 tuple; mutable preparation is not qualification.
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
  ".github/workflows/repository-admission-check.yml",
  "docs/repository-admission.md",
  "scripts/check-repository-admission.test.ts",
  "scripts/check-repository-admission.ts",
  "scripts/repository-bootstrap-observation.test.ts",
  "scripts/repository-bootstrap-observation.ts",
]);
export const FINITE_ADDED_TARGET_PATHS: readonly string[] = Object.freeze([]);

// BEGIN OBSERVED FINITE TARGET BINDING
export const OBSERVED_FINITE_TARGET_BINDING: FiniteTargetBinding = Object.freeze({
  state: "bound",
  target: {
    repository: "agent-teams-ai/.github",
    repositoryId: 1316243981,
    pullRequest: 447,
    pullId: 5518207736,
    headRef: "fix/current-stack-admission-20261126",
    baseSHA: "283c9b8d79580b48be5b1b8d6a94a09b9543185b",
    headSHA: "404939142f6e4bbd03fe53a1f710feed310971a3",
    baseTreeSHA: "b835f11c1433c562d3575e7d351697d4cc44f572",
    headTreeSHA: "8d9711fa54aa196ceb7ef2a1fe7879fd4a278b5d",
    commits: 5,
  },
  tuple: [
    [
      ".github/workflows/repository-admission-check.yml",
      "8d36fae3db231a879ec67c1eed4df9ed69ff1981",
      "7ef4ee6eead25a7a678635593879867362969525",
    ],
    [
      "docs/repository-admission.md",
      "28b4911095b010cd493046d22df61c1a638683c8",
      "8706663902dc21e9fcb28d39511fb59285d67e1a",
    ],
    [
      "scripts/check-repository-admission.test.ts",
      "834c7941f8abaa7f377305a4502f9d987d7f7784",
      "d564e0a771239a58aefd93f481b9d6dfb86fa9e0",
    ],
    [
      "scripts/check-repository-admission.ts",
      "e5f5a9854e5e49683c13b3c739d003d3bb8a2026",
      "e92b12986ac364922052bf99328f34d477d0de93",
    ],
    [
      "scripts/repository-bootstrap-observation.test.ts",
      "23ac00152931e34eb20549d149ba811ee63d4d13",
      "e03491f22fbf667bab75f9cef7f789b0862ca320",
    ],
    [
      "scripts/repository-bootstrap-observation.ts",
      "ebb56e1681ecad0f478d58977e9092961dcfea6e",
      "f914807cd0e197f916c66aa8604f3722dbb4272a",
    ],
  ],
  commits: [
    "050d47ec66717f0f177b586c36520eb09f3ab4e0",
    "404939142f6e4bbd03fe53a1f710feed310971a3",
    "ac7a46473518dcc0829906f0d8f89dd7044332c6",
    "dc6c27fd514eb05e3860c68de394c1a43c383fd2",
    "dc6fa5ee69b78351949c805bbbbc497a200c472b",
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

/** Only this source-owned PR447 tuple can authorize the bounded current-toolchain admission correction. */
export function assertFiniteTargetBinding(binding: unknown): asserts binding is BoundFiniteTarget {
  const value = object(binding);
  assert.deepEqual(Object.keys(value).toSorted(), ["commits", "state", "target", "tuple"]);
  assert.equal(value["state"], "bound", "Finite current-toolchain admission target is unbound");
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
  assert.equal(target["pullRequest"], 447);
  assert.equal(target["pullId"], 5518207736);
  assert.equal(target["headRef"], "fix/current-stack-admission-20261126");
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
      "The admission correction permits no added or removed target files",
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
      "Unbound v11 target: real reviewed PR447 and complete native qualification are required.",
    );
  }
  assertFiniteTargetBinding(binding);
  return binding;
}
