import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseDocument } from "yaml";

import {
  cohortEventDigest,
  cohortRecordDigest,
  docsRuntimeClosureAuthority,
  docsRuntimeClosureEvidence,
} from "./docs-cohort-policy.mjs";
import {
  authorizeConsumerGate,
  canonicalManagedProjection,
  CURRENT_CONTROLLER_DATA_PATHS,
  GatePolicyError,
  gateErrorCode,
  managedStateDigest,
  parseJsonStrict,
  parseYamlStrict,
  shouldRunDocsGate,
  trustedInstallWorkspaceConfig,
} from "./verify-docs-consumer-gate.mjs";

const SHA = "1".repeat(40);
const BLOB_SHA = "2".repeat(40);
const DIGEST = `sha256:${"3".repeat(64)}`;
const INTEGRITY = `sha512-${"A".repeat(86)}==`;
const TRANSITIVE_INTEGRITY = `sha512-${"T".repeat(86)}==`;
const REPOSITORY_ID = 1314129620;
const REPOSITORY = "agent-teams-ai/agent-runtime";
const COHORT_ID = "docs-2026-08-18-rc1";
const CALLER = `name: Documentation Protocol

on:
  pull_request:
  merge_group:
  push:

permissions:
  contents: read
  id-token: write

jobs:
  docs-protocol:
    uses: agent-teams-ai/.github/.github/workflows/docs-protocol-check.yml@${SHA}
`;

function digest(source) {
  return `sha256:${createHash("sha256").update(source).digest("hex")}`;
}

function registry() {
  const record = {
    cohort_id: COHORT_ID,
    channel: "rc",
    packages: [
      {
        name: "@agent-teams/engineering-foundation",
        version: "0.18.0-rc.0",
        integrity: INTEGRITY,
        registry: "https://registry.npmjs.org/",
        published_at: "2026-08-16T00:00:00Z",
        provenance: {
          source_repository: "agent-teams-ai/engineering-foundation",
          source_repository_id: 1316243988,
          source_workflow: ".github/workflows/release.yml",
          source_commit: "4".repeat(40),
          workflow_run_id: 1,
          registry_attestation_url: "https://registry.npmjs.org/-/npm/v1/attestations/@agent-teams%2fengineering-foundation@0.18.0-rc.0",
          workflow_run_url: "https://github.com/agent-teams-ai/engineering-foundation/actions/runs/1",
          signature_verified: true,
        },
      },
      {
        name: "@agent-teams/docs-protocol",
        version: "0.2.0-rc.0",
        integrity: INTEGRITY,
        registry: "https://registry.npmjs.org/",
        published_at: "2026-08-16T00:01:00Z",
        provenance: {
          source_repository: "agent-teams-ai/engineering-foundation",
          source_repository_id: 1316243988,
          source_workflow: ".github/workflows/release.yml",
          source_commit: "4".repeat(40),
          workflow_run_id: 1,
          registry_attestation_url: "https://registry.npmjs.org/-/npm/v1/attestations/@agent-teams%2fdocs-protocol@0.2.0-rc.0",
          workflow_run_url: "https://github.com/agent-teams-ai/engineering-foundation/actions/runs/1",
          signature_verified: true,
        },
      },
    ],
    reusable_workflow: {
      repository: "agent-teams-ai/.github",
      repository_id: 1316243981,
      path: ".github/workflows/docs-protocol-check.yml",
      revision: SHA,
      blob_sha: BLOB_SHA,
    },
    schemas: {
      consumer_integration: 1,
      consumer_plan: 1,
      managed_state: 1,
      foundation_plan: 1,
      foundation_journal: 1,
      foundation_receipt: 1,
      foundation_envelope: 5,
      docs_protocol: 1,
    },
    assets: {
      skill: { package: "@agent-teams/docs-protocol", path: "skills/docs/SKILL.md", digest: DIGEST },
      caller_workflow: {
        package: "@agent-teams/docs-protocol",
        path: "assets/docs-protocol.yml",
        digest: `sha256:${"5".repeat(64)}`,
        rendered_digest: digest(CALLER),
      },
      asset_catalog: { package: "@agent-teams/docs-protocol", path: "assets/catalog.json", digest: `sha256:${"6".repeat(64)}` },
      transition_catalog: { package: "@agent-teams/docs-protocol", path: "assets/transition-catalog.json", digest: `sha256:${"9".repeat(64)}` },
    },
    runtime: {
      node: ">=24.18.0 <25",
      pnpm: ">=11.17.0 <12",
      apply_platforms: ["linux", "macos"],
      check_plan_platforms: ["linux", "macos", "windows"],
    },
    runtime_closure: runtimeClosure(),
    eligible_after: "2026-08-17T00:01:00Z",
    upgrade_from: [],
    rollback_to: [],
    canary_repositories: [{ repository_id: REPOSITORY_ID, repository: REPOSITORY }],
    evidence_references: ["test:packed-pair"],
  };
  record.record_digest = cohortRecordDigest(record);
  const result = {
    $schema: "./docs-qualified-cohorts.schema.json",
    schema_version: 1,
    organization: "agent-teams-ai",
    policy: {
      minimum_release_age_hours: 24,
      inventory_page_size: 100,
      inventory_max_pages: 100,
      inventory_termination: "first_empty_page",
      authority: "recommended_cohort_only",
    },
    cohorts: [record],
    events: [],
  };
  for (const [index, [state, effectiveAt]] of [
    ["PUBLISHED_UNQUALIFIED", "2026-08-16T00:01:00Z"],
    ["VERIFIED", "2026-08-16T00:02:00Z"],
    ["COOLDOWN", "2026-08-16T00:03:00Z"],
    ["QUALIFIED", "2026-08-17T00:01:00Z"],
  ].entries()) {
    const event = {
      sequence: index + 1,
      cohort_id: COHORT_ID,
      state,
      effective_at: effectiveAt,
      evidence_references: [`test:${state.toLowerCase()}`],
      canary_evidence: [],
      support_until: null,
      previous_event_digest: result.events.at(-1)?.event_digest ?? null,
    };
    event.event_digest = cohortEventDigest(event);
    result.events.push(event);
  }
  return result;
}

function policy() {
  return {
    repositories: [{
      repository: REPOSITORY,
      repository_id: REPOSITORY_ID,
      source_provenance: { kind: "original", parent_repository: null },
      governance_ownership: "organization_owned",
      repository_lifecycle: "active",
      docs_role: "consumer",
      admission_status: "admitted",
      protocol_required: true,
      desired_cohort_id: COHORT_ID,
      observed_cohort_id: COHORT_ID,
      profile_path: "architecture/foundation/docs-protocol.yaml",
      caller_workflow_path: ".github/workflows/docs-protocol.yml",
    }],
  };
}

function profile(record, qualification) {
  const packageByName = new Map(record.packages.map((entry) => [entry.name, entry]));
  return {
    schemaVersion: 1,
    repository: { provider: "github", id: String(REPOSITORY_ID), nameWithOwner: REPOSITORY },
    integrationRoot: ".",
    packageManager: "pnpm",
    profilePath: "architecture/foundation/docs-protocol.yaml",
    skillPath: ".agents/skills/docs-authoring/SKILL.md",
    callerWorkflowPath: ".github/workflows/docs-protocol.yml",
    managedStatePath: "architecture/foundation/docs-protocol-managed-state.json",
    cohort: {
      schemaVersion: 1,
      cohortId: COHORT_ID,
      channel: record.channel,
      recordDigest: record.record_digest,
      qualificationEventDigest: qualification.event_digest,
      eligibleAfter: record.eligible_after,
      upgradeFrom: record.upgrade_from,
      rollbackTo: record.rollback_to,
      packages: {
        docsProtocol: {
          version: packageByName.get("@agent-teams/docs-protocol").version,
          integrity: packageByName.get("@agent-teams/docs-protocol").integrity,
        },
        engineeringFoundation: {
          version: packageByName.get("@agent-teams/engineering-foundation").version,
          integrity: packageByName.get("@agent-teams/engineering-foundation").integrity,
        },
      },
      workflow: {
        repository: record.reusable_workflow.repository,
        path: record.reusable_workflow.path,
        revision: record.reusable_workflow.revision,
        blobSha: record.reusable_workflow.blob_sha,
      },
      assets: {
        skillDigest: record.assets.skill.digest,
        callerWorkflowDigest: record.assets.caller_workflow.rendered_digest,
        assetCatalogDigest: record.assets.asset_catalog.digest,
        transitionCatalogDigest: record.assets.transition_catalog.digest,
      },
      schemas: { consumerIntegration: 1, managedState: 1, docsProtocol: 1 },
      runtime: {
        node: record.runtime.node,
        pnpm: record.runtime.pnpm,
        runtimeClosureDigest: record.runtime_closure.digest,
      },
    },
  };
}

function projection(record, qualification) {
  const consumerProfile = profile(record, qualification);
  return canonicalManagedProjection(
    consumerProfile,
    consumerProfile.cohort,
    { provider: "github", id: String(REPOSITORY_ID), nameWithOwner: REPOSITORY },
  );
}

function manifest() {
  return {
    name: "test-consumer",
    private: true,
    packageManager: "pnpm@11.18.0",
    devDependencies: {
      "@agent-teams/docs-protocol": "0.2.0-rc.0",
      "@agent-teams/engineering-foundation": "0.18.0-rc.0",
    },
  };
}

function lock() {
  return `lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      '@agent-teams/docs-protocol':
        specifier: 0.2.0-rc.0
        version: 0.2.0-rc.0
      '@agent-teams/engineering-foundation':
        specifier: 0.18.0-rc.0
        version: 0.18.0-rc.0
packages:
  '@agent-teams/docs-protocol@0.2.0-rc.0':
    resolution:
      integrity: ${INTEGRITY}
  '@agent-teams/engineering-foundation@0.18.0-rc.0':
    resolution:
      integrity: ${INTEGRITY}
  transitive-package@1.0.0:
    resolution:
      integrity: ${TRANSITIVE_INTEGRITY}
snapshots:
  '@agent-teams/docs-protocol@0.2.0-rc.0':
    dependencies:
      '@agent-teams/engineering-foundation': 0.18.0-rc.0
      transitive-package: 1.0.0
  '@agent-teams/engineering-foundation@0.18.0-rc.0': {}
  transitive-package@1.0.0: {}
`;
}

function runtimeClosure() {
  return docsRuntimeClosureAuthority(
    parseDocument(lock(), { strict: true, uniqueKeys: true }).toJS(),
    [
      { name: "@agent-teams/engineering-foundation", version: "0.18.0-rc.0", integrity: INTEGRITY },
      { name: "@agent-teams/docs-protocol", version: "0.2.0-rc.0", integrity: INTEGRITY },
    ],
  );
}

function runtimeClosureEvidence() {
  return docsRuntimeClosureEvidence(
    parseDocument(lock(), { strict: true, uniqueKeys: true }).toJS(),
    [
      { name: "@agent-teams/engineering-foundation", version: "0.18.0-rc.0", integrity: INTEGRITY },
      { name: "@agent-teams/docs-protocol", version: "0.2.0-rc.0", integrity: INTEGRITY },
    ],
  );
}

function fixture() {
  const registryValue = registry();
  const record = registryValue.cohorts[0];
  const qualification = registryValue.events.at(-1);
  const closureEvidence = runtimeClosureEvidence();
  const files = {
    "architecture/foundation/docs-consumer-integration.json": `${JSON.stringify(profile(record, qualification))}\n`,
    "architecture/foundation/docs-protocol-managed-state.json": `${JSON.stringify(projection(record, qualification))}\n`,
    ".github/workflows/docs-protocol.yml": CALLER,
    "package.json": `${JSON.stringify(manifest())}\n`,
    "pnpm-lock.yaml": lock(),
  };
  return {
    registry: registryValue,
    policy: policy(),
    repository: { id: REPOSITORY_ID, fullName: REPOSITORY, defaultBranch: "main" },
    workflowIdentity: {
      sha: SHA,
      ref: `agent-teams-ai/.github/.github/workflows/docs-protocol-check.yml@${SHA}`,
      repository: "agent-teams-ai/.github",
      filePath: ".github/workflows/docs-protocol-check.yml",
    },
    calledWorkflowBlobSha: BLOB_SHA,
    callerSha: "7".repeat(40),
    controllerSnapshotSha: "8".repeat(40),
    runtimeClosureSources: {
      [record.runtime_closure.projection_path]: closureEvidence.source,
    },
    tree: Object.keys(files).map((path) => ({ path, type: "blob", mode: "100644" })),
    files,
    asOf: "2026-08-18T00:00:00Z",
  };
}

function clone(value) {
  return structuredClone(value);
}

function setPath(value, path, replacement) {
  const segments = path.split(".");
  const leaf = segments.pop();
  let target = value;
  for (const segment of segments) {target = target[segment];}
  target[leaf] = replacement;
}

test("authorizes an inputless exact caller from central desired/observed authority", () => {
  const result = authorizeConsumerGate(fixture());
  assert.equal(result.repositoryId, REPOSITORY_ID);
  assert.equal(result.cohortId, COHORT_ID);
  assert.equal(result.expectedPackages.length, 2);
});

test("isolated install bypasses release age only for the exact authorized package pair", () => {
  const source = trustedInstallWorkspaceConfig([
    { name: "@agent-teams/docs-protocol", version: "0.2.0-rc.0" },
    { name: "@agent-teams/engineering-foundation", version: "0.18.0-rc.0" },
  ]);
  const config = parseYamlStrict(source, "trusted pnpm workspace", 4096);
  assert.deepEqual(config, {
    packages: [],
    minimumReleaseAgeExclude: [
      "@agent-teams/engineering-foundation@0.18.0-rc.0",
      "@agent-teams/docs-protocol@0.2.0-rc.0",
    ],
  });
  assert.doesNotMatch(source, /@agent-teams\/\*/u);
  assert.doesNotMatch(source, /minimumReleaseAge:\s*0|trustLockfile/iu);
  assert.throws(
    () => trustedInstallWorkspaceConfig([
      { name: "@agent-teams/docs-protocol", version: "0.2.0-rc.0" },
      { name: "@agent-teams/other", version: "1.0.0" },
    ]),
    /exact managed package versions/iu,
  );
});

test("rejects every mutated field of the exact central Cohort profile projection", async (t) => {
  const mutations = [
    ["schemaVersion", 2],
    ["cohortId", "docs-2026-08-19-rc2"],
    ["channel", "stable"],
    ["recordDigest", `sha256:${"a".repeat(64)}`],
    ["qualificationEventDigest", `sha256:${"b".repeat(64)}`],
    ["eligibleAfter", "2026-08-18T00:01:00Z"],
    ["upgradeFrom", ["docs-2026-08-17-rc0"]],
    ["rollbackTo", ["docs-2026-08-17-rc0"]],
    ["packages.docsProtocol.version", "0.2.1-rc.0"],
    ["packages.docsProtocol.integrity", `sha512-${"B".repeat(86)}==`],
    ["packages.engineeringFoundation.version", "0.18.1-rc.0"],
    ["packages.engineeringFoundation.integrity", `sha512-${"C".repeat(86)}==`],
    ["workflow.repository", "agent-teams-ai/engineering-foundation"],
    ["workflow.path", ".github/workflows/other.yml"],
    ["workflow.revision", "a".repeat(40)],
    ["workflow.blobSha", "b".repeat(40)],
    ["assets.skillDigest", `sha256:${"c".repeat(64)}`],
    ["assets.callerWorkflowDigest", `sha256:${"d".repeat(64)}`],
    ["assets.assetCatalogDigest", `sha256:${"e".repeat(64)}`],
    ["assets.transitionCatalogDigest", `sha256:${"f".repeat(64)}`],
    ["schemas.consumerIntegration", 2],
    ["schemas.managedState", 2],
    ["schemas.docsProtocol", 2],
    ["runtime.node", ">=25 <26"],
    ["runtime.pnpm", ">=12 <13"],
    ["runtime.runtimeClosureDigest", `sha256:${"2".repeat(64)}`],
  ];

  for (const [path, replacement] of mutations) {
    await t.test(path, () => {
      const changed = fixture();
      const integrationPath = "architecture/foundation/docs-consumer-integration.json";
      const value = JSON.parse(changed.files[integrationPath]);
      setPath(value.cohort, path, replacement);
      changed.files[integrationPath] = `${JSON.stringify(value)}\n`;
      assert.throws(
        () => authorizeConsumerGate(changed),
        /profile differs from the exact central immutable Cohort projection/iu,
      );
    });
  }
});

test("recomputed local stateDigest cannot authorize any managed projection mutation", async (t) => {
  const mutations = [
    ["schemaVersion", 2],
    ["cohortId", "docs-2026-08-19-rc2"],
    ["cohortAuthority.channel", "stable"],
    ["cohortAuthority.recordDigest", `sha256:${"a".repeat(64)}`],
    ["cohortAuthority.qualificationEventDigest", `sha256:${"b".repeat(64)}`],
    ["cohortAuthority.eligibleAfter", "2026-08-18T00:01:00Z"],
    ["cohortAuthority.upgradeFrom", ["docs-2026-08-17-rc0"]],
    ["cohortAuthority.rollbackTo", ["docs-2026-08-17-rc0"]],
    ["repository.provider", "forgejo"],
    ["repository.id", "999"],
    ["repository.nameWithOwner", "agent-teams-ai/other"],
    ["packages.docsProtocol.version", "0.2.1-rc.0"],
    ["packages.docsProtocol.integrity", `sha512-${"B".repeat(86)}==`],
    ["packages.engineeringFoundation.version", "0.18.1-rc.0"],
    ["packages.engineeringFoundation.integrity", `sha512-${"C".repeat(86)}==`],
    ["schemas.consumerIntegration", 2],
    ["schemas.managedState", 2],
    ["schemas.docsProtocol", 2],
    ["runtime.node", ">=25 <26"],
    ["runtime.pnpm", ">=12 <13"],
    ["runtime.runtimeClosureDigest", `sha256:${"2".repeat(64)}`],
    ["profilePath", "architecture/foundation/other.yaml"],
    ["skillPath", ".agents/skills/other/SKILL.md"],
    ["callerWorkflowPath", ".github/workflows/other.yml"],
    ["managedStatePath", "architecture/foundation/other.json"],
    ["assets.skillDigest", `sha256:${"c".repeat(64)}`],
    ["assets.callerWorkflowDigest", `sha256:${"d".repeat(64)}`],
    ["assets.assetCatalogDigest", `sha256:${"e".repeat(64)}`],
    ["assets.transitionCatalogDigest", `sha256:${"f".repeat(64)}`],
    ["assets.agentsRouteDigest", `sha256:${"0".repeat(64)}`],
    ["assets.docsScriptsDigest", `sha256:${"1".repeat(64)}`],
  ];

  for (const [path, replacement] of mutations) {
    await t.test(path, () => {
      const changed = fixture();
      const managedPath = "architecture/foundation/docs-protocol-managed-state.json";
      const value = JSON.parse(changed.files[managedPath]);
      setPath(value, path, replacement);
      delete value.stateDigest;
      value.stateDigest = managedStateDigest(value);
      changed.files[managedPath] = `${JSON.stringify(value)}\n`;
      assert.throws(
        () => authorizeConsumerGate(changed),
        /Managed projection (?:differs from the exact central immutable Cohort projection|selects an unknown central Cohort)/iu,
      );
    });
  }
});

test("authorizes the first candidate PR without pretending default-branch observation", () => {
  const changed = fixture();
  Object.assign(changed.policy.repositories[0], {
    admission_status: "admission_candidate",
    cohort_binding_status: "bootstrap_pending",
    desired_cohort_id: COHORT_ID,
    observed_cohort_id: null,
  });
  assert.doesNotThrow(() => authorizeConsumerGate(changed));
});

test("rejects premature admission before an observed default-branch binding", () => {
  const changed = fixture();
  Object.assign(changed.policy.repositories[0], {
    admission_status: "admitted",
    cohort_binding_status: "bound",
    observed_cohort_id: null,
  });
  assert.throws(() => authorizeConsumerGate(changed), /admitted or bootstrap-candidate/u);
});

test("rejects QUALIFIED observed binding for an undeclared non-canary repository", () => {
  const changed = fixture();
  const record = changed.registry.cohorts[0];
  record.canary_repositories = [{
    repository_id: 1319378484,
    repository: "agent-teams-ai/agent-teams-platform",
  }];
  record.record_digest = cohortRecordDigest(record);
  for (const path of [
    "architecture/foundation/docs-consumer-integration.json",
    "architecture/foundation/docs-protocol-managed-state.json",
  ]) {
    const value = JSON.parse(changed.files[path]);
    if (value.cohort !== undefined) {value.cohort.recordDigest = record.record_digest;}
    if (value.cohortAuthority !== undefined) {
      value.cohortAuthority.recordDigest = record.record_digest;
    }
    changed.files[path] = `${JSON.stringify(value)}\n`;
  }
  assert.throws(() => authorizeConsumerGate(changed), /neither selectable nor supported/iu);
});

test("rejects a forged caller workflow", () => {
  const changed = fixture();
  changed.files[".github/workflows/docs-protocol.yml"] = CALLER.replace(SHA, "9".repeat(40));
  assert.throws(() => authorizeConsumerGate(changed), /caller workflow bytes differ/iu);
});

test("rejects a forged consumer profile repository identity", () => {
  const changed = fixture();
  const value = JSON.parse(changed.files["architecture/foundation/docs-consumer-integration.json"]);
  value.repository.id = "999";
  changed.files["architecture/foundation/docs-consumer-integration.json"] = JSON.stringify(value);
  assert.throws(() => authorizeConsumerGate(changed), /profile repository identity is forged/iu);
});

test("rejects a forged physical lock integrity", () => {
  const changed = fixture();
  changed.files["pnpm-lock.yaml"] = lock().replace(INTEGRITY, `sha512-${"B".repeat(86)}==`);
  assert.throws(() => authorizeConsumerGate(changed), /integrity differs/iu);
});

test("allows package-manager-owned transitive resolution without changing trusted Cohort install evidence", () => {
  const changed = fixture();
  changed.files["pnpm-lock.yaml"] = lock()
    .replaceAll("transitive-package@1.0.0", "transitive-package@1.0.1")
    .replace("transitive-package: 1.0.0", "transitive-package: 1.0.1")
    .replace(TRANSITIVE_INTEGRITY, `sha512-${"U".repeat(86)}==`);
  const authorization = authorizeConsumerGate(changed);
  assert.equal(
    authorization.expectedRuntimeClosureLock.packages["transitive-package@1.0.0"].resolution.integrity,
    TRANSITIVE_INTEGRITY,
  );
});

test("rejects forged content-addressed runtime closure evidence", () => {
  const changed = fixture();
  const path = changed.registry.cohorts[0].runtime_closure.projection_path;
  changed.runtimeClosureSources[path] = changed.runtimeClosureSources[path].replace(
    TRANSITIVE_INTEGRITY,
    `sha512-${"V".repeat(86)}==`,
  );
  assert.throws(
    () => authorizeConsumerGate(changed),
    /runtime closure evidence is missing or has the wrong content digest/iu,
  );
});

test("rejects package patches before consumer package execution", () => {
  const changed = fixture();
  const value = JSON.parse(changed.files["package.json"]);
  value.pnpm = { patchedDependencies: { "x@1.0.0": "patches/x.patch" } };
  changed.files["package.json"] = JSON.stringify(value);
  assert.throws(() => authorizeConsumerGate(changed), /forbidden pnpm mutation policy/iu);
});

test("rejects a live repository ID that differs from central admission", () => {
  const changed = fixture();
  changed.repository.id = 999;
  assert.throws(() => authorizeConsumerGate(changed), /absent from central Docs admission/iu);
});

test("rejects caller workflow identity substituted for called reusable workflow identity", () => {
  const changed = fixture();
  changed.workflowIdentity = {
    sha: changed.callerSha,
    ref: `${REPOSITORY}/.github/workflows/docs-protocol.yml@${changed.callerSha}`,
    repository: REPOSITORY,
    filePath: ".github/workflows/docs-protocol.yml",
  };
  assert.throws(() => authorizeConsumerGate(changed), /called reusable workflow identity/iu);
});

test("rejects nested managed pins and wrong Docs to Foundation resolution", () => {
  const nested = fixture();
  nested.files["pnpm-lock.yaml"] = lock().replace("packages:\n", `  packages/app:\n    devDependencies:\n      '@agent-teams/docs-protocol':\n        specifier: 0.2.0-rc.0\n        version: 0.2.0-rc.0\npackages:\n`);
  assert.throws(() => authorizeConsumerGate(nested), /forbidden in nested importer/iu);

  const dependency = fixture();
  dependency.files["pnpm-lock.yaml"] = lock().replace(
    "'@agent-teams/engineering-foundation': 0.18.0-rc.0",
    "'@agent-teams/engineering-foundation': 0.17.0"
  );
  assert.throws(() => authorizeConsumerGate(dependency), /wrong exact Foundation dependency/iu);
});

test("rejects duplicate JSON and YAML keys", () => {
  assert.throws(() => parseJsonStrict('{"a":1,"a":2}', "fixture.json", 1024), /duplicate JSON key/iu);
  assert.throws(() => parseYamlStrict("a: 1\na: 2\n", "fixture.yml", 1024), /duplicate-free YAML/iu);
});

test("rejects pnpm hooks, nested lockfiles, and symlinked governed files", () => {
  for (const entry of [
    { path: ".pnpmfile.cjs", type: "blob", mode: "100644" },
    { path: "packages/app/pnpm-lock.yaml", type: "blob", mode: "100644" },
    { path: "package.json", type: "blob", mode: "120000", replace: true },
  ]) {
    const changed = fixture();
    if (entry.replace) {
      changed.tree = changed.tree.map((value) => value.path === entry.path ? entry : value);
    } else {
      changed.tree.push(entry);
    }
    assert.throws(() => authorizeConsumerGate(changed), /forbidden|nested lockfile|regular committed file/iu);
  }
});

test("runs on PR, merge queue, and actual default branch but skips feature push", () => {
  assert.equal(shouldRunDocsGate("pull_request", "feature", "trunk"), true);
  assert.equal(shouldRunDocsGate("merge_group", "gh-readonly-queue/trunk/pr-1", "trunk"), true);
  assert.equal(shouldRunDocsGate("push", "trunk", "trunk"), true);
  assert.equal(shouldRunDocsGate("push", "feature", "trunk"), false);
});

test("current integration cannot hide invalid daily documentation", async () => {
  const source = await readFile(new URL("../.github/workflows/docs-protocol-check.yml", import.meta.url), "utf8");
  const workflow = parseDocument(source, { strict: true, uniqueKeys: true }).toJS();
  assert.deepEqual(workflow.on, { workflow_call: {} });
  const job = workflow.jobs["docs-protocol-check"];
  assert.equal(job.if,
    "github.event_name != 'push' || github.ref_name == github.event.repository.default_branch");
  const integration = job.steps.findIndex(({ name }) => name === "Run trusted absolute Consumer Integration CLI");
  const documentation = job.steps.findIndex(({ name }) => name === "Run trusted absolute documentation structural check");
  assert.ok(integration >= 0 && documentation > integration);
  assert.match(job.steps[integration].run, /steps\.trusted-install\.outputs\.cli.*consumer check/su);
  assert.match(job.steps[documentation].run, /steps\.trusted-install\.outputs\.cli.* check.*profile_path/su);
  assert.equal(job.steps[documentation].env.NODE_PATH,
    "${{ env.TRUSTED_INSTALL_ROOT }}/node_modules");
  assert.doesNotMatch(job.steps[documentation].env.NODE_PATH, /CONSUMER_CHECKOUT/u);
  assert.doesNotMatch(job.steps[documentation].run, /pnpm|docs:check/u);
});

test("later controller main changes only mutable lifecycle data, never pinned validator code", async () => {
  assert.deepEqual(CURRENT_CONTROLLER_DATA_PATHS, [
    "governance/docs-protocol-exceptions.json",
    "governance/docs-protocol-policy.json",
    "governance/docs-qualified-cohorts.json",
  ]);
  assert.ok(CURRENT_CONTROLLER_DATA_PATHS.every((path) => path.endsWith(".json")));
  assert.ok(!CURRENT_CONTROLLER_DATA_PATHS.some((path) =>
    path.startsWith("scripts/") || path === "package.json" || path.endsWith("pnpm-lock.yaml")));

  const source = await readFile(new URL("../.github/workflows/docs-protocol-check.yml", import.meta.url), "utf8");
  const workflow = parseDocument(source, { strict: true, uniqueKeys: true }).toJS();
  const checkout = workflow.jobs["docs-protocol-check"].steps.find(
    ({ name }) => name === "Check out exact Cohort-bound validator implementation"
  );
  assert.equal(checkout.with.repository, "${{ steps.authority.outputs.workflow-repository }}");
  assert.equal(checkout.with.ref, "${{ steps.authority.outputs.workflow-sha }}");
  assert.notEqual(checkout.with.ref, "${{ steps.authority.outputs.controller-sha }}");

  const before = fixture();
  before.controllerDataSources = {
    "governance/docs-protocol-exceptions.json": "{}",
    "governance/docs-protocol-policy.json": JSON.stringify(before.policy),
    "governance/docs-qualified-cohorts.json": JSON.stringify(before.registry),
  };
  const after = clone(before);
  after.controllerDataSources["governance/docs-qualified-cohorts.json"] += "\n";
  const first = authorizeConsumerGate(before);
  const second = authorizeConsumerGate(after);
  assert.equal(first.workflowIdentity.sha, second.workflowIdentity.sha);
  assert.notEqual(
    first.controllerDataDigests["governance/docs-qualified-cohorts.json"],
    second.controllerDataDigests["governance/docs-qualified-cohorts.json"]
  );
});

test("uses stable policy rejection and transient infrastructure failure codes", () => {
  assert.equal(gateErrorCode(new GatePolicyError("forged caller")), "DOCS_GATE_POLICY_REJECTED");
  assert.equal(gateErrorCode(new Error("network unavailable")), "DOCS_GATE_INFRASTRUCTURE_FAILURE");
});
