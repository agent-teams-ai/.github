import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCS_COHORT_V3_RETAINED_RUNTIME,
  docsCohortV3Runtime,
  docsQualificationNodeVersion,
} from "./docs-managed-runtime-policy.ts";

const identity = (version: unknown) => ({
  id: "agent-teams.docs-protocol-current-policy",
  version,
  digest: `sha256:${"a".repeat(64)}`,
});

await test("keeps historical and patched semantic policies as separate exact runtime tuples", () => {
  assert.deepEqual(docsCohortV3Runtime(identity("3.0.0")), {
    selectedLane: "node-26-managed-qualified",
    node: ">=26.0.0 <27",
    pnpm: ">=11.17.0 <12",
    qualificationRuntime: {
      nodeVersion: "26.11.1",
      pnpmVersion: "11.20.0",
      platform: "linux",
      architecture: "x64",
    },
  });
  assert.deepEqual(docsCohortV3Runtime(identity("3.1.0")), {
    selectedLane: "node-26-managed-qualified",
    node: ">=26.12.1 <27",
    pnpm: ">=11.17.0 <12",
    qualificationRuntime: {
      nodeVersion: "26.12.1",
      pnpmVersion: "11.20.0",
      platform: "linux",
      architecture: "x64",
    },
  });
  assert.equal(docsCohortV3Runtime(identity("3.0.0")), DOCS_COHORT_V3_RETAINED_RUNTIME);
  for (const version of ["3.0.0", "3.1.0"]) {
    const runtime = docsCohortV3Runtime(identity(version));
    assert.equal(Object.isFrozen(runtime), true);
    assert.equal(Object.isFrozen(runtime.qualificationRuntime), true);
    assert.equal(Reflect.set(runtime.qualificationRuntime, "nodeVersion", "26.99.0"), false);
  }
});

await test("rejects unknown policy identities without a permissive version or runtime fallback", () => {
  for (const value of [
    null,
    [],
    {},
    identity("3.0.1"),
    identity("3.1.1"),
    identity("4.0.0"),
    identity(3.1),
    identity("^3.1.0"),
    { ...identity("3.1.0"), id: "foreign" },
    { ...identity("3.1.0"), digest: `sha256:${"0".repeat(64)}` },
    { ...identity("3.1.0"), nodeVersion: "26.12.1" },
  ]) {
    assert.throws(() => docsCohortV3Runtime(value), /policy identity/u);
  }
});

await test("workflow runtime selection is closed over the authorized selected policy", () => {
  for (const profile of ["none", "legacy", "cohort-v2"]) {
    assert.equal(docsQualificationNodeVersion(profile), "24.21.0");
    assert.throws(
      () => docsQualificationNodeVersion(profile, identity("3.1.0")),
      /Historical qualification/u,
    );
  }
  assert.equal(docsQualificationNodeVersion("cohort-v3", identity("3.0.0")), "26.11.1");
  assert.equal(docsQualificationNodeVersion("cohort-v3", identity("3.1.0")), "26.12.1");
  for (const profile of [undefined, "cohort-v4", "26.12.1", "${{ inputs.node }}"]) {
    assert.throws(
      () => docsQualificationNodeVersion(profile, identity("3.1.0")),
      /no admitted Node runtime/u,
    );
  }
  assert.throws(() => docsQualificationNodeVersion("cohort-v3"), /policy identity/u);
});
