import assert from "node:assert/strict";

// Source-owned finite target: actual PR #441 after independent source review
// and complete native Node 26 / Node 24 checks. No data grant is installed here.
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
  readonly target: FiniteTarget;
  readonly tuple: readonly FiniteFileTuple[];
  readonly commits: readonly string[];
}

// These reviewed #438 images must survive composition byte-for-byte.
// They are retained inputs, not the future atomic PR's identity.
export const RETAINED_RETIREMENT_IMAGES = Object.freeze([
  [
    "docs/repository-admission.md",
    "28b4911095b010cd493046d22df61c1a638683c8"
  ],
  [
    "docs/repository-registration.md",
    "67bb3620625b84693314f699b5cb656303187867"
  ],
  [
    "scripts/governance-policy.mjs",
    "dae3ab8b57933b547d8eb6875899cb6e57226b0f"
  ],
  [
    "scripts/observe-org-repository-inventory.mjs",
    "e690144f94f4fa2ea6b4410960bfecb0fba2136f"
  ],
  [
    "scripts/repository-registration.test.ts",
    "57d226674416a55260e8e719ce87cb9768753144"
  ],
  [
    "scripts/repository-registration.ts",
    "2775cebb687f51654c0b02c26bee35a6904bf8d2"
  ],
  [
    "governance/evidence/docs-admission/canary-deletion-20261126.json",
    "ae4f396d378a9e4a061debabb5022c8ec7770ec2"
  ]
] as const);
export const REQUIRED_ATOMIC_PATHS = Object.freeze([
  ...RETAINED_RETIREMENT_IMAGES.map(([path]) => path),
  "scripts/docs-b304-registry-incident.ts",
  "scripts/docs-b304-recovery-staging.ts",
  "scripts/verify-docs-admission-change.mjs",
  "scripts/verify-docs-cohort-evidence.mjs",
  ".github/workflows/docs-admission-evidence.yml",
  "governance/docs-b304-registry-recovery.json",
  "governance/evidence/docs-b304-registry-recovery/runtime-20261126.json",
]);
export const INERT_B304_AUTHORITY = Object.freeze({
  path: "governance/docs-b304-registry-recovery.json",
  blob: "0b5e9a6c2d0f0ec93da25d5ad6123d9f0f89dcf4",
});

export const INCIDENT_ARCHIVE = Object.freeze({
  path: "governance/evidence/docs-b304-registry-recovery/runtime-20261126.json",
  blob: "2ec1dd73094608e9b65bb5aa1a29d8f86a2b5271",
});

// BEGIN OBSERVED FINITE TARGET BINDING
export const TARGET: BoundFiniteTarget | null = Object.freeze<BoundFiniteTarget>({
  "target": {
    "repository": "agent-teams-ai/.github",
    "repositoryId": 1316243981,
    "pullRequest": 441,
    "pullId": 5515091190,
    "headRef": "fix/bounded-retirement-recovery-20261126",
    "baseSHA": "89b5d7c512d9c4b5ae63709857a0d71cb2e6d178",
    "headSHA": "bd982a6fa1a77329a558414aef2a99cb87d18896",
    "baseTreeSHA": "9c0f91b0e0e962964d5486d685b7f4d8c52ccd23",
    "headTreeSHA": "ce81b934943b1c4917e8f9c0cea214c86236e4fc",
    "commits": 1
  },
  "tuple": [
    [
      ".github/workflows/docs-admission-evidence.yml",
      "a95efa08ae173554e1c82b6e5460ee8160810c44",
      "d6a371bb7164d3db9322c8ed0ee402cf5cb9001c"
    ],
    [
      "docs/docs-b304-registry-recovery.md",
      null,
      "044543903beab50dabbf32ecdcae12ee4336cc57"
    ],
    [
      "docs/engineering-quality-profile.json",
      "b35b10ccab73a5c3f32fa2b15e49d3229b06922e",
      "a40de5259b5042af29a8f53ed2f99fc18f81251f"
    ],
    [
      "docs/engineering-quality.md",
      "7915702a1cc8796bee92f405a7ef1a12a900957c",
      "1e877ec585e510aef8a7a2560930b307a4bae585"
    ],
    [
      "docs/repository-admission.md",
      "f2cbf6513c450baa205964df69e2b1026fd40034",
      "28b4911095b010cd493046d22df61c1a638683c8"
    ],
    [
      "docs/repository-registration.md",
      "08561be2ad32a03e21fde7f048fb8b986ec1a974",
      "67bb3620625b84693314f699b5cb656303187867"
    ],
    [
      "governance/docs-b304-registry-recovery.json",
      null,
      "0b5e9a6c2d0f0ec93da25d5ad6123d9f0f89dcf4"
    ],
    [
      "governance/evidence/docs-admission/canary-deletion-20261126.json",
      null,
      "ae4f396d378a9e4a061debabb5022c8ec7770ec2"
    ],
    [
      "governance/evidence/docs-b304-registry-recovery/runtime-20261126.json",
      null,
      "2ec1dd73094608e9b65bb5aa1a29d8f86a2b5271"
    ],
    [
      "scripts/check-quality-scope.mjs",
      "d3301c4392b140ce2fd601c91842ebfeff77e24d",
      "f61c181619cab8e1b00dc06bf8583cb03698b5f9"
    ],
    [
      "scripts/check-quality-scope.test.mjs",
      "f634839b047f37d92d23ffbfb16e4957774d24dd",
      "160dae3eb535282e9d4bebdf1fc183d5ba9bd648"
    ],
    [
      "scripts/docs-admission-workflow.test.mjs",
      "d41f3ea3038a309047a39ab4ad9642501655bdad",
      "ed476d8dbc2a848c343a89631348b20b6328b6f9"
    ],
    [
      "scripts/docs-b304-admission-integration.test.ts",
      null,
      "c5a6b1d61e1637852324635bc9bde8d49b0ef42f"
    ],
    [
      "scripts/docs-b304-recovery-staging.test.ts",
      null,
      "b95d08b2e8e704ddb2d4076579a319bc9bd935b8"
    ],
    [
      "scripts/docs-b304-recovery-staging.ts",
      null,
      "30610654d586a3574d5cddf01ecaa5d016573b80"
    ],
    [
      "scripts/docs-b304-registry-incident.test.ts",
      null,
      "337d7cf25610717ed34a58ae9bf28b5eebf090be"
    ],
    [
      "scripts/docs-b304-registry-incident.ts",
      null,
      "6fe65b2b66a479cd26be7008e19478aefcceee47"
    ],
    [
      "scripts/fixtures/docs-b304-registry-incident/native-evidence.json",
      null,
      "bc6032448b03c5dbe86db76af3a390f59f5997fd"
    ],
    [
      "scripts/fixtures/docs-b304-registry-incident/runtime-files.json",
      null,
      "335323d7c70fa93f5528983cd383700fec71a992"
    ],
    [
      "scripts/governance-policy.mjs",
      "a0120e03d9f3cdae19231b7b8944b056186f59fd",
      "dae3ab8b57933b547d8eb6875899cb6e57226b0f"
    ],
    [
      "scripts/observe-org-repository-inventory.mjs",
      "062a10731e553c5f87cbc4ee9e6c84543a8e0ab0",
      "e690144f94f4fa2ea6b4410960bfecb0fba2136f"
    ],
    [
      "scripts/read-docs-portable-authority-r322.test.mjs",
      "21c0553b84f5dd53cbcfc8740745d8b4005450a3",
      "3a48ff0e947246bac1d6991f59d53ed8bd3d4aef"
    ],
    [
      "scripts/repository-registration.test.ts",
      "d0f460c7405bd46f3cc7a885bd309e3b31450e16",
      "57d226674416a55260e8e719ce87cb9768753144"
    ],
    [
      "scripts/repository-registration.ts",
      "65faa0a6b366df2c88a39ac2b8faffde7f037820",
      "2775cebb687f51654c0b02c26bee35a6904bf8d2"
    ],
    [
      "scripts/verify-docs-admission-change.mjs",
      "f3db341a5d9fc5ec74c9c3379153940db99177c0",
      "109ca56d41ceba6c24fd056fee68cc518abd43e7"
    ],
    [
      "scripts/verify-docs-cohort-evidence.mjs",
      "fadb1dcec324f14cc5407f103d9b6424a6b18ec0",
      "f7e3d76923ad7c853f568c8a5f6dc4da6b8ce32c"
    ],
    [
      "toolchain.config.json",
      "97b068b1b96227d9ef6bfd719a2aaa60ffb4e4b1",
      "32da818dfc4174e6865485da67bcc3fc417e9c31"
    ],
    [
      "tsconfig.tooling.json",
      "0c9248ca92cdebdfcdf2b63a0a65f51ce5112226",
      "6f4886a2a7e3ac18e832732ebca3d25fc898566c"
    ]
  ],
  "commits": [
    "bd982a6fa1a77329a558414aef2a99cb87d18896"
  ]
});
// END OBSERVED FINITE TARGET BINDING

type Mapping = Record<string, unknown>;
const isMapping = (value: unknown): value is Mapping =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function object(value: unknown): Mapping {
  assert.ok(isMapping(value), "Finite target must be a mapping");
  return value;
}
function list(value: unknown): unknown[] {
  assert.ok(Array.isArray(value), "Finite target list required");
  return value;
}
const oid = /^(?!0{40}$)[0-9a-f]{40}$/u;
function sha(value: unknown): void {
  assert.ok(typeof value === "string" && oid.test(value), "Unbound finite Git identity");
}
function assertFinitePath(value: unknown): asserts value is string {
  assert.ok(
    typeof value === "string" &&
      value.length > 0 &&
      value.length <= 4096 &&
      !value.includes("\\") && !/\p{Cc}/u.test(value) &&
      value.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
    "Canonical finite source path required",
  );
}
export function assertFiniteTargetBinding(value: unknown): asserts value is BoundFiniteTarget {
  const binding = object(value), target = object(binding["target"]);
  assert.deepEqual(Object.keys(binding).toSorted(), ["commits", "target", "tuple"]);
  assert.deepEqual(
    Object.keys(target).toSorted(),
    ["repository", "repositoryId", "pullRequest", "pullId", "headRef", "baseSHA",
      "headSHA", "baseTreeSHA", "headTreeSHA", "commits"].toSorted(),
  );
  assert.equal(target["repository"], "agent-teams-ai/.github");
  assert.equal(target["repositoryId"], 1316243981);
  for (const key of ["pullRequest", "pullId", "commits"]) {
    assert.ok(Number.isSafeInteger(target[key]) && Number(target[key]) > 0);
  }
  assert.ok(Number(target["commits"]) <= 250);
  assert.ok(
    typeof target["headRef"] === "string" && target["headRef"].length > 0 &&
      target["headRef"] !== "main" && !/[\s\p{Cc}]/u.test(target["headRef"]),
    "Real same-repository operation head ref required",
  );
  for (const key of ["baseSHA", "headSHA", "baseTreeSHA", "headTreeSHA"]) {
    sha(target[key]);
  }
  assert.notEqual(target["baseSHA"], target["headSHA"]);
  assert.notEqual(target["baseTreeSHA"], target["headTreeSHA"]);
  assert.notEqual(target["pullRequest"], 438, "Historical retirement PR is not the atomic target");
  assert.notEqual(target["headSHA"], "2b2ea1732661d1d990e7bc27d34c8dcbc31b9817");
  const tuple = list(binding["tuple"]);
  assert.ok(tuple.length >= REQUIRED_ATOMIC_PATHS.length && tuple.length <= 3000);
  const images = new Map<string, unknown[]>();
  for (const raw of tuple) {
    const entry = list(raw);
    assert.equal(entry.length, 3);
    assertFinitePath(entry[0]);
    assert.ok(!images.has(entry[0]), "Duplicate finite path");
    if (entry[1] !== null) {
      sha(entry[1]);
    }
    sha(entry[2]);
    assert.notEqual(entry[1], entry[2], "Unchanged finite tuple member");
    images.set(entry[0], entry);
  }
  for (const required of REQUIRED_ATOMIC_PATHS) {
    assert.ok(images.has(required), "Incomplete atomic source target: " + required);
  }
  for (const [retained, after] of RETAINED_RETIREMENT_IMAGES) {
    assert.equal(images.get(retained)?.[2], after, "Reviewed retirement image changed: " + retained);
  }
  assert.deepEqual(
    images.get(INERT_B304_AUTHORITY.path),
    [INERT_B304_AUTHORITY.path, null, INERT_B304_AUTHORITY.blob],
    "The source leg may only add the exact inert-null B304 authority",
  );
  assert.deepEqual(
    images.get(INCIDENT_ARCHIVE.path),
    [INCIDENT_ARCHIVE.path, null, INCIDENT_ARCHIVE.blob],
    "The source leg may only add the actual immutable incident observation",
  );
  const commits = list(binding["commits"]);
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

export function requireTargetBinding(binding: unknown = TARGET): BoundFiniteTarget {
  if (binding === null) {
    throw new Error("Composite v6 target is unbound; collection and publication are forbidden.");
  }
  assertFiniteTargetBinding(binding);
  return binding;
}
