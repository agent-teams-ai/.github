import assert from "node:assert/strict";

// Source-owned finite binding. This module has no I/O or authority transport.
// Actual observed PR455 tuple; mutable preparation is not qualification.
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
  ".github/workflows/docs-admission-evidence.yml",
  ".github/workflows/docs-protocol-check.yml",
  "docs/decisions/0019-bounded-docs-policy31-runtime.md",
  "docs/engineering-quality-profile.json",
  "docs/engineering-quality.md",
  "docs/governance/docs-gen3-current-policy-mapping.md",
  "governance/docs-qualified-cohorts.schema.json",
  "scripts/check-community-files.mjs",
  "scripts/check-community-files.test.mjs",
  "scripts/check-quality-scope.mjs",
  "scripts/check-quality-scope.test.mjs",
  "scripts/docs-admission-change.test.mjs",
  "scripts/docs-admission-workflow.test.mjs",
  "scripts/docs-cohort-policy.mjs",
  "scripts/docs-cohort-v2.test.mjs",
  "scripts/docs-managed-runtime-policy.test.ts",
  "scripts/docs-managed-runtime-policy.ts",
  "scripts/read-docs-portable-authority-r322.test.mjs",
  "scripts/verify-docs-cohort-v2-receipt.mjs",
  "scripts/verify-docs-consumer-gate.mjs",
  "scripts/verify-docs-consumer-gate.test.mjs",
  "toolchain.config.json",
  "tsconfig.tooling.json",
]);
export const FINITE_ADDED_TARGET_PATHS: readonly string[] = Object.freeze([
  "docs/decisions/0019-bounded-docs-policy31-runtime.md",
  "scripts/docs-managed-runtime-policy.test.ts",
  "scripts/docs-managed-runtime-policy.ts",
]);

// BEGIN OBSERVED FINITE TARGET BINDING
export const OBSERVED_FINITE_TARGET_BINDING: FiniteTargetBinding = Object.freeze({
  state: "bound",
  target: {
    repository: "agent-teams-ai/.github",
    repositoryId: 1316243981,
    pullRequest: 455,
    pullId: 5520339333,
    headRef: "fix/docs-runtime-policy31",
    baseSHA: "046492c51aab39cb74bbd9119ab7e9be85c169de",
    headSHA: "a97745c1d1092f4a7f4978ce3257fce5e3223f91",
    baseTreeSHA: "6c9e0e247187eb085f145c27a03f340e6a6be1b8",
    headTreeSHA: "471d873fc1fe8efa38b05a68d8e1561f55a4c480",
    commits: 5,
  },
  tuple: [
    [
      ".github/workflows/docs-admission-evidence.yml",
      "d6a371bb7164d3db9322c8ed0ee402cf5cb9001c",
      "aa6570aa02f19c34085f2e05dc2934514fe9ebd5",
    ],
    [
      ".github/workflows/docs-protocol-check.yml",
      "4097e816cf8725035c49c94e27308a6c66a0119b",
      "714af12998ef140dd55a2ec3057f67775586cfd7",
    ],
    [
      "docs/decisions/0019-bounded-docs-policy31-runtime.md",
      null,
      "e431e192b96baccca38f30614453d970cc97f95e",
    ],
    [
      "docs/engineering-quality-profile.json",
      "a40de5259b5042af29a8f53ed2f99fc18f81251f",
      "0ef4543c714e948d8447eb656cbb45b7942a5abc",
    ],
    [
      "docs/engineering-quality.md",
      "1e877ec585e510aef8a7a2560930b307a4bae585",
      "b99083fb1a1ff660879a97d3dc788c33935272c8",
    ],
    [
      "docs/governance/docs-gen3-current-policy-mapping.md",
      "1c60290d6a02f9fbb616dff0f106bbb352f9223f",
      "ea5259846430568c376b6569044a6dcfbe7e6383",
    ],
    [
      "governance/docs-qualified-cohorts.schema.json",
      "582d2d57eac11f03dc031b11ad48a768a0c05624",
      "4ff09c8d88b01798dc1aa650a8e92a33d3b83e8d",
    ],
    [
      "scripts/check-community-files.mjs",
      "0d33a4af1a60df54f60a1252cbaff243b193594b",
      "69d1c284e4f821a15c707bd7c559fa345eb28127",
    ],
    [
      "scripts/check-community-files.test.mjs",
      "34b1b96905e8bb6129fa12aba664bdbc94a8abae",
      "44e6400728b0c5ac68c4704d0dae5949e97c5d57",
    ],
    [
      "scripts/check-quality-scope.mjs",
      "f61c181619cab8e1b00dc06bf8583cb03698b5f9",
      "f28b1ed946ef186862206a2c6ee8740c7be8a5e5",
    ],
    [
      "scripts/check-quality-scope.test.mjs",
      "160dae3eb535282e9d4bebdf1fc183d5ba9bd648",
      "f3bfc6a83dedf494789deab2a46193e5a5a61f03",
    ],
    [
      "scripts/docs-admission-change.test.mjs",
      "ce286b67dc70b0ce6ec585e17fab6c2409feff75",
      "9e1bebaa97293c7a14b34ee936a645e8da7b2eb3",
    ],
    [
      "scripts/docs-admission-workflow.test.mjs",
      "ed476d8dbc2a848c343a89631348b20b6328b6f9",
      "fb272c2f9ebd5d0c99c20fa2579b06c9029759c7",
    ],
    [
      "scripts/docs-cohort-policy.mjs",
      "ac9576c36f4f2d2919fcebab2643809b5d2e45cc",
      "95a9b9b50e0d6a648e64e4253b5128b438f88d86",
    ],
    [
      "scripts/docs-cohort-v2.test.mjs",
      "36ab2d43674f22981cca281c867c87e5a5eac9a9",
      "1b3f5d4b6dafe2c9a6cf8f282a5930bcdf1681e6",
    ],
    [
      "scripts/docs-managed-runtime-policy.test.ts",
      null,
      "5b4dd3ba18a935c3d95768adf450aed6655ba160",
    ],
    ["scripts/docs-managed-runtime-policy.ts", null, "78952c0e45290d00be8a2a89c150496435620f18"],
    [
      "scripts/read-docs-portable-authority-r322.test.mjs",
      "3a48ff0e947246bac1d6991f59d53ed8bd3d4aef",
      "4c989cb9d409b4b896ac5776818e65e9fe9820bd",
    ],
    [
      "scripts/verify-docs-cohort-v2-receipt.mjs",
      "31d9f0deb4010af4fd7bace44059b80a454a253c",
      "3c529582c28073caa6bb2eb0d471be8f3004f1fe",
    ],
    [
      "scripts/verify-docs-consumer-gate.mjs",
      "103c4c194de35349d858ea2ceaf5f6ee804579c0",
      "efcc1ae738d2fa603aea6ca06ffd32f2e3000717",
    ],
    [
      "scripts/verify-docs-consumer-gate.test.mjs",
      "b1108c54c08d7cf71b73e9634b8fa7d0b750f7a6",
      "5f890bf76b0577be6f35f6ab478ecc225c5b3516",
    ],
    [
      "toolchain.config.json",
      "32da818dfc4174e6865485da67bcc3fc417e9c31",
      "904d00f10d4b254b9dccf2ea93466da407665f2a",
    ],
    [
      "tsconfig.tooling.json",
      "6f4886a2a7e3ac18e832732ebca3d25fc898566c",
      "b60690407479bf65e96a53615132ce8c223593e4",
    ],
  ],
  commits: [
    "2099109548b97a38c8b52631370199d450926afd",
    "553e489a8a087b46b731a484e9d4beb5cc01b4e1",
    "8b5b601dd864d04d9de3b3cfada6f16728a81b17",
    "a97745c1d1092f4a7f4978ce3257fce5e3223f91",
    "b04f2c0ea41583094076ddaea1ce51e4ca109f5c",
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

/** Only this source-owned PR455 tuple can authorize the bounded runtime support. */
export function assertFiniteTargetBinding(binding: unknown): asserts binding is BoundFiniteTarget {
  const value = object(binding);
  assert.deepEqual(Object.keys(value).toSorted(), ["commits", "state", "target", "tuple"]);
  assert.equal(value["state"], "bound", "Finite runtime support target is unbound");
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
  assert.equal(target["pullRequest"], 455);
  assert.equal(target["pullId"], 5520339333);
  assert.equal(target["headRef"], "fix/docs-runtime-policy31");
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
      "Only the three exact runtime-support additions are admitted",
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
      "Unbound v8 target: real reviewed PR455 and complete native qualification are required.",
    );
  }
  assertFiniteTargetBinding(binding);
  return binding;
}
