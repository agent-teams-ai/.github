import assert from "node:assert/strict";

export interface DocsManagedRuntime {
  readonly selectedLane: "node-26-managed-qualified";
  readonly node: ">=26.0.0 <27" | ">=26.12.1 <27";
  readonly pnpm: ">=11.17.0 <12";
  readonly qualificationRuntime: Readonly<{
    nodeVersion: "26.11.1" | "26.12.1";
    pnpmVersion: "11.20.0";
    platform: "linux";
    architecture: "x64";
  }>;
}

// Historical policy 3.0.0 remains a distinct, immutable runtime contract.
export const DOCS_COHORT_V3_RETAINED_RUNTIME: DocsManagedRuntime = Object.freeze({
  selectedLane: "node-26-managed-qualified",
  node: ">=26.0.0 <27",
  pnpm: ">=11.17.0 <12",
  qualificationRuntime: Object.freeze({
    nodeVersion: "26.11.1",
    pnpmVersion: "11.20.0",
    platform: "linux",
    architecture: "x64",
  }),
});

const PATCHED_RUNTIME: DocsManagedRuntime = Object.freeze({
  selectedLane: "node-26-managed-qualified",
  node: ">=26.12.1 <27",
  pnpm: ">=11.17.0 <12",
  qualificationRuntime: Object.freeze({
    nodeVersion: "26.12.1",
    pnpmVersion: "11.20.0",
    platform: "linux",
    architecture: "x64",
  }),
});

/** Select only an explicit published-policy identity; runtime ranges are not selectors. */
export function docsCohortV3Runtime(identity: unknown): DocsManagedRuntime {
  assert.ok(
    identity !== null && typeof identity === "object" && !Array.isArray(identity),
    "Cohort v3 policy identity must be a closed mapping.",
  );
  assert.deepEqual(
    Object.keys(identity).toSorted(),
    ["digest", "id", "version"],
    "Cohort v3 policy identity has unexpected fields.",
  );
  assert.ok(
    "id" in identity &&
      identity.id === "agent-teams.docs-protocol-current-policy" &&
      "digest" in identity &&
      typeof identity.digest === "string" &&
      /^sha256:(?!0{64}$)[0-9a-f]{64}$/u.test(identity.digest),
    "Cohort v3 policy identity must bind the exact ID and nonzero source digest.",
  );
  assert.ok("version" in identity, "Cohort v3 policy identity has no version.");
  switch (identity.version) {
    case "3.0.0":
      return DOCS_COHORT_V3_RETAINED_RUNTIME;
    case "3.1.0":
      return PATCHED_RUNTIME;
    default:
      throw new Error("Cohort v3 policy identity version is not admitted.");
  }
}

/** Called only after authorization of the committed selected Cohort record. */
export function docsQualificationNodeVersion(
  qualificationProfile: unknown,
  selectedPolicyIdentity?: unknown,
): "24.21.0" | "26.11.1" | "26.12.1" {
  switch (qualificationProfile) {
    case "none":
    case "legacy":
    case "cohort-v2":
      assert.equal(
        selectedPolicyIdentity,
        undefined,
        "Historical qualification cannot carry a generation 3 runtime selector.",
      );
      return "24.21.0";
    case "cohort-v3":
      return docsCohortV3Runtime(selectedPolicyIdentity).qualificationRuntime.nodeVersion;
    default:
      throw new Error("Qualification profile has no admitted Node runtime.");
  }
}
