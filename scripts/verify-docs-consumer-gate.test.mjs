import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, opendir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import test from "node:test";

import { parseDocument, stringify as stringifyYaml } from "yaml";

import {
  cohortEventDigest,
  cohortRecordDigest,
  DOCS_COHORT_V2_DEPENDENCY_EDGES,
  DOCS_COHORT_V2_PACKAGES,
  docsRuntimeClosureAuthority,
  docsRuntimeClosureEvidence,
  docsRuntimeClosureV2Evidence,
} from "./docs-cohort-policy.mjs";
import {
  authorizeConsumerGate,
  canonicalManagedProjection,
  CURRENT_CONTROLLER_DATA_PATHS,
  currentDocsAdmissionPolicySource,
  GatePolicyError,
  gateErrorCode,
  managedStateDigest,
  parseJsonStrict,
  parseYamlStrict,
  runQualificationV3Command,
  shouldRunDocsGate,
  trustedInstallWorkspaceConfig,
  validateExactPnpmLock,
  validateQualificationContractV2Structure,
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

function canonical(value) {
  if (Array.isArray(value)) {return `[${value.map(canonical).join(",")}]`;}
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function installedTreeDigest(root) {
  const entries = [];
  async function visit(current) {
    const handle = await opendir(current);
    for await (const entry of handle) {
      const path = join(current, entry.name);
      const portable = path.slice(root.length + 1).split(sep).join("/");
      if (entry.isDirectory()) {entries.push({ kind: "directory", path: portable }); await visit(path);}
      else {entries.push({ kind: "file", path: portable, absolute: path });}
    }
  }
  await visit(root);
  entries.sort((left, right) => Buffer.compare(Buffer.from(`${left.kind}\0${left.path}`), Buffer.from(`${right.kind}\0${right.path}`)));
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(entry.kind).update("\0").update(entry.path).update("\0");
    if (entry.kind === "file") {hash.update(await readFile(entry.absolute)).update("\0");}
  }
  return `sha256:${hash.digest("hex")}`;
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

function addWorkspacePolicy(changed, workspaceSource, lockPolicySource) {
  changed.files["pnpm-workspace.yaml"] = workspaceSource;
  changed.files["pnpm-lock.yaml"] = changed.files["pnpm-lock.yaml"].replace(
    "importers:\n",
    `${lockPolicySource}importers:\n`,
  );
  changed.tree.push({ path: "pnpm-workspace.yaml", type: "blob", mode: "100644" });
  return changed;
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

function cohortV2Coordinates() {
  return DOCS_COHORT_V2_PACKAGES.map((entry) => ({
    ...entry,
    version: "1.0.0-rc.1",
    integrity: INTEGRITY,
  }));
}

function cohortV2Lock() {
  const version = "1.0.0-rc.1";
  const dependencies = (from) => Object.fromEntries(DOCS_COHORT_V2_DEPENDENCY_EDGES
    .filter((edge) => edge.from === from)
    .map((edge) => [edge.to, version]));
  return {
    lockfileVersion: "9.0",
    settings: { autoInstallPeers: true, excludeLinksFromLockfile: false },
    importers: { ".": { devDependencies: Object.fromEntries(DOCS_COHORT_V2_PACKAGES
      .filter(({ role }) => role === "direct")
      .map(({ name }) => [name, { specifier: version, version }])) } },
    packages: Object.fromEntries(DOCS_COHORT_V2_PACKAGES.map(({ name }) =>
      [`${name}@${version}`, { resolution: { integrity: INTEGRITY } }])),
    snapshots: Object.fromEntries(DOCS_COHORT_V2_PACKAGES.map(({ name }) =>
      [`${name}@${version}`, { dependencies: dependencies(name) }])),
  };
}

function cohortV2Manifest() {
  return {
    name: "cohort-v2-install",
    private: true,
    packageManager: "pnpm@11.18.0",
    devDependencies: Object.fromEntries(cohortV2Coordinates()
      .filter(({ role }) => role === "direct")
      .map(({ name, version }) => [name, version])),
  };
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

function cohortV2Fixture() {
  const input = fixture();
  const record = input.registry.cohorts[0];
  record.cohort_generation = 2;
  record.packages = cohortV2Coordinates().map(({ name, role, version, integrity }) => ({
    name, role, version, integrity,
    registry: "https://registry.npmjs.org/",
    published_at: "2026-08-16T00:01:00Z",
    provenance: {
      source_repository: "agent-teams-ai/engineering-foundation",
      source_repository_id: 1316243988,
      source_workflow: ".github/workflows/release.yml",
      source_commit: "4".repeat(40),
      workflow_run_id: 1,
      registry_attestation_url: `https://registry.npmjs.org/-/npm/v1/attestations/${name.replace("/", "%2f")}@${version}`,
      workflow_run_url: "https://github.com/agent-teams-ai/engineering-foundation/actions/runs/1",
      signature_verified: true,
    },
  }));
  record.dependency_edges = DOCS_COHORT_V2_DEPENDENCY_EDGES;
  record.schemas = { ...record.schemas, consumer_integration: 3, managed_state: 2,
    docs_protocol: 1, qualification_receipt: 3 };
  for (const asset of Object.values(record.assets)) {asset.package = "@agent-teams/docs-protocol-agent-teams";}
  const closure = docsRuntimeClosureV2Evidence(cohortV2Lock(), cohortV2Coordinates());
  record.runtime_closure = closure.authority;
  record.record_digest = cohortRecordDigest(record);
  const qualification = input.registry.events.at(-1);
  const packageByName = new Map(record.packages.map((entry) => [entry.name, entry]));
  const cohort = {
    schemaVersion: 2,
    cohortId: record.cohort_id,
    channel: record.channel,
    recordDigest: record.record_digest,
    qualificationEventDigest: qualification.event_digest,
    eligibleAfter: record.eligible_after,
    upgradeFrom: record.upgrade_from,
    rollbackTo: record.rollback_to,
    packages: Object.fromEntries([
      ["repositoryMutation", "@agent-teams/repository-mutation"],
      ["documentAuthoring", "@agent-teams/document-authoring"],
      ["docsProtocol", "@agent-teams/docs-protocol"],
      ["docsProtocolAgentTeams", "@agent-teams/docs-protocol-agent-teams"],
      ["engineeringFoundation", "@agent-teams/engineering-foundation"],
    ].map(([key, name]) => [key, {
      version: packageByName.get(name).version, integrity: packageByName.get(name).integrity,
    }])),
    workflow: { repository: record.reusable_workflow.repository, path: record.reusable_workflow.path,
      revision: record.reusable_workflow.revision, blobSha: record.reusable_workflow.blob_sha },
    assets: { skillDigest: record.assets.skill.digest,
      callerWorkflowDigest: record.assets.caller_workflow.rendered_digest,
      assetCatalogDigest: record.assets.asset_catalog.digest,
      transitionCatalogDigest: record.assets.transition_catalog.digest },
    schemas: { consumerIntegration: 3, managedState: 2, docsProtocol: 1 },
    runtime: { node: record.runtime.node, pnpm: record.runtime.pnpm,
      runtimeClosureDigest: record.runtime_closure.digest },
  };
  const consumerProfile = {
    schemaVersion: 3,
    repository: { provider: "github", id: String(REPOSITORY_ID), nameWithOwner: REPOSITORY },
    integrationRoot: ".", packageManager: "pnpm",
    profilePath: "architecture/foundation/docs-protocol.yaml",
    skillPath: ".agents/skills/docs-authoring/SKILL.md",
    callerWorkflowPath: ".github/workflows/docs-protocol.yml",
    managedStatePath: "architecture/foundation/docs-protocol-managed-state.json",
    cohort,
  };
  input.files["architecture/foundation/docs-consumer-integration.json"] = `${JSON.stringify(consumerProfile)}\n`;
  input.files["architecture/foundation/docs-protocol-managed-state.json"] = `${JSON.stringify(
    canonicalManagedProjection(consumerProfile, cohort, consumerProfile.repository),
  )}\n`;
  input.files["package.json"] = `${JSON.stringify(cohortV2Manifest())}\n`;
  input.files["pnpm-lock.yaml"] = stringifyYaml(cohortV2Lock());
  input.runtimeClosureSources = { [record.runtime_closure.projection_path]: closure.source };
  Object.assign(input.policy.repositories[0], {
    desired_cohort_generation: 2,
    observed_cohort_generation: 2,
    v3_qualification_coordinates: {
      profile_schema_version: 3, cohort_schema_version: 2, managed_state_schema_version: 2,
      receipt_schema_version: 3, execution_envelope_schema_version: 1,
      evidence_class: "cohort-v2-supporting-canary",
    },
  });
  return input;
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

test("authorizes Cohort v2 only through its explicit selected generation authority", () => {
  const input = cohortV2Fixture();
  const authorization = authorizeConsumerGate(input);
  assert.equal(authorization.schemaVersion, 2);
  assert.equal(authorization.qualificationProfile, "cohort-v2");
  assert.equal(authorization.qualificationPackageManager, "pnpm@11.20.0");
  assert.equal(authorization.expectedPackages.length, 5);
  assert.equal(authorization.qualificationAuthority.qualificationEvent.state, "QUALIFIED");
  const wrongDesired = cohortV2Fixture();
  wrongDesired.policy.repositories[0].desired_cohort_generation = undefined;
  assert.throws(() => authorizeConsumerGate(wrongDesired), /explicitly match the Cohort generation/u);
  const wrongObserved = cohortV2Fixture();
  wrongObserved.policy.repositories[0].desired_cohort_id = "other-cohort";
  wrongObserved.policy.repositories[0].observed_cohort_generation = null;
  assert.throws(() => authorizeConsumerGate(wrongObserved), /explicitly match the Cohort generation/u);
});

test("trusted v3 runner binds profile, lock, install evidence, and adapter bytes before import", async () => {
  const root = await mkdtemp(join(tmpdir(), "docs-v3-runner-"));
  const envKeys = ["AUTHORIZATION_PATH", "CONSUMER_CHECKOUT", "TRUSTED_INSTALL_ROOT",
    "INSTALL_EVIDENCE_PATH", "QUALIFICATION_RECEIPT"];
  const priorEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  try {
    const consumer = join(root, "consumer");
    const install = join(root, "install");
    const evidencePath = join(root, "install-evidence.json");
    const authorizationPath = join(root, "authorization.json");
    const receiptPath = join(root, "receipt.json");
    const input = cohortV2Fixture();
    const authorization = authorizeConsumerGate(input);
    await mkdir(join(consumer, "architecture", "foundation"), { recursive: true });
    await Promise.all([
      writeFile(join(consumer, "architecture/foundation/docs-consumer-integration.json"),
        input.files["architecture/foundation/docs-consumer-integration.json"]),
      writeFile(join(consumer, "pnpm-lock.yaml"), input.files["pnpm-lock.yaml"]),
    ]);
    const adapter = authorization.expectedPackages.find(({ name }) =>
      name === "@agent-teams/docs-protocol-agent-teams");
    const installedRoots = new Map();
    for (const expected of authorization.expectedPackages) {
      const packageRoot = join(install, "node_modules", ...expected.name.split("/"));
      await mkdir(packageRoot, { recursive: true });
      await writeFile(join(packageRoot, "package.json"), JSON.stringify({
        name: expected.name, version: expected.version,
      }));
      installedRoots.set(expected.name, packageRoot);
    }
    const adapterRoot = join(install, "node_modules", "@agent-teams", "docs-protocol-agent-teams");
    await mkdir(join(adapterRoot, "dist", "qualification"), { recursive: true });
    await Promise.all([
      writeFile(join(adapterRoot, "package.json"), JSON.stringify({
        name: adapter.name, version: adapter.version,
        exports: { "./qualification": { import: "./dist/qualification/index.js" } },
      })),
      writeFile(join(adapterRoot, "dist", "qualification", "index.js"), "export {};\n"),
    ]);
    const installedPackages = [];
    for (const entry of authorization.expectedPackages) {
      installedPackages.push({ ...entry, treeDigest: await installedTreeDigest(installedRoots.get(entry.name)) });
    }
    const authorizationDigest = digest(canonical({
      domain: "agent-teams.docs-consumer-gate-authorization/v1", body: authorization,
    }));
    const installEvidence = {
      schemaVersion: 1, authorizationDigest, packages: installedPackages,
    };
    const writeInstallEvidence = (value = installEvidence) =>
      writeFile(evidencePath, `${canonical(value)}\n`);
    await Promise.all([
      writeFile(authorizationPath, `${canonical({ authorization, authorizationDigest })}\n`),
      writeInstallEvidence(),
    ]);
    Object.assign(process.env, {
      AUTHORIZATION_PATH: authorizationPath,
      CONSUMER_CHECKOUT: consumer,
      TRUSTED_INSTALL_ROOT: install,
      INSTALL_EVIDENCE_PATH: evidencePath,
      QUALIFICATION_RECEIPT: receiptPath,
    });
    let imports = 0;
    const importModule = async (entrypoint) => {
      imports += 1;
      assert.equal(entrypoint, await import("node:fs/promises").then(({ realpath }) =>
        realpath(join(adapterRoot, "dist", "qualification", "index.js"))));
      return { runDocsProtocolQualificationV3: ({ profile, evidence, lockfileBytes }) => ({
        schemaVersion: 3,
        cohortAdmissible: profile.schemaVersion === 3 && evidence.schemas.managedState === 2 && lockfileBytes.length > 0,
        receiptDigest: `sha256:${"b".repeat(64)}`,
      }) };
    };
    await runQualificationV3Command({ importModule });
    assert.equal(imports, 1);
    assert.equal(await readFile(receiptPath, "utf8"),
      `${canonical({ schemaVersion: 3, cohortAdmissible: true, receiptDigest: `sha256:${"b".repeat(64)}` })}\n`);
    imports = 0;
    await writeFile(join(adapterRoot, "dist", "qualification", "index.js"), "export const tampered = true;\n");
    await assert.rejects(() => runQualificationV3Command({ importModule }),
      /installed bytes changed before qualification execution/u);
    assert.equal(imports, 0);
    await writeFile(join(adapterRoot, "dist", "qualification", "index.js"), "export {};\n");

    await writeInstallEvidence({ ...installEvidence, authorizationDigest: `sha256:${"c".repeat(64)}` });
    await assert.rejects(() => runQualificationV3Command({ importModule }),
      /install evidence is not bound to the authorization/u);
    assert.equal(imports, 0);

    const wrongTree = structuredClone(installEvidence);
    wrongTree.packages.find(({ name }) => name === adapter.name).treeDigest = `sha256:${"d".repeat(64)}`;
    await writeInstallEvidence(wrongTree);
    await assert.rejects(() => runQualificationV3Command({ importModule }),
      /installed bytes changed before qualification execution/u);
    assert.equal(imports, 0);

    const duplicateCoordinate = structuredClone(installEvidence);
    duplicateCoordinate.packages[duplicateCoordinate.packages.length - 1] =
      structuredClone(duplicateCoordinate.packages[0]);
    await writeInstallEvidence(duplicateCoordinate);
    await assert.rejects(() => runQualificationV3Command({ importModule }),
      /five unique authorized installed coordinates/u);
    assert.equal(imports, 0);

    const mismatchedCoordinate = structuredClone(installEvidence);
    mismatchedCoordinate.packages[mismatchedCoordinate.packages.length - 1].name =
      "@agent-teams/not-authorized";
    await writeInstallEvidence(mismatchedCoordinate);
    await assert.rejects(() => runQualificationV3Command({ importModule }),
      /installed evidence differs/u);
    assert.equal(imports, 0);
    await writeInstallEvidence();

    await writeFile(join(consumer, "pnpm-lock.yaml"), `${input.files["pnpm-lock.yaml"]}\n# drift\n`);
    await assert.rejects(() => runQualificationV3Command({ importModule }), /lockfile changed before qualification/u);
    assert.equal(imports, 0);
    await rm(join(consumer, "pnpm-lock.yaml"));
    await assert.rejects(() => runQualificationV3Command({ importModule }), /ENOENT/u);
    assert.equal(imports, 0);
    await writeFile(join(consumer, "pnpm-lock.yaml"), input.files["pnpm-lock.yaml"]);
    await writeFile(join(consumer, "architecture/foundation/docs-consumer-integration.json"), "{}\n");
    await assert.rejects(() => runQualificationV3Command({ importModule }), /profile changed before qualification/u);
    assert.equal(imports, 0);
    await rm(join(consumer, "architecture/foundation/docs-consumer-integration.json"));
    await assert.rejects(() => runQualificationV3Command({ importModule }), /ENOENT/u);
    assert.equal(imports, 0);
  } finally {
    for (const key of envKeys) {
      if (priorEnv[key] === undefined) {delete process.env[key];} else {process.env[key] = priorEnv[key];}
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("authorizes only exact consumer pnpm versions in the qualified runtime range", () => {
  for (const packageManager of ["pnpm@11.17.0", "pnpm@11.24.0", "pnpm@11.999999.999999"]) {
    const input = fixture();
    const manifestValue = JSON.parse(input.files["package.json"]);
    manifestValue.packageManager = packageManager;
    input.files["package.json"] = `${JSON.stringify(manifestValue)}\n`;
    assert.doesNotThrow(() => authorizeConsumerGate(input), packageManager);
  }

  for (const packageManager of [
    "pnpm@11.16.999999",
    "pnpm@12.0.0",
    "pnpm@11.024.0",
    "pnpm@11.24.0-rc.1",
    "pnpm@11.1000000.0",
  ]) {
    const input = fixture();
    const manifestValue = JSON.parse(input.files["package.json"]);
    manifestValue.packageManager = packageManager;
    input.files["package.json"] = `${JSON.stringify(manifestValue)}\n`;
    assert.throws(() => authorizeConsumerGate(input), />=11\.17\.0 <12/u, packageManager);
  }
});

test("rejects devEngines packageManager as a competing pnpm identity authority", () => {
  for (const packageManager of [
    {},
    { name: "pnpm" },
    { version: "11.24.0" },
    { version: ">=11.17.0 <12" },
  ]) {
    const input = fixture();
    const manifestValue = JSON.parse(input.files["package.json"]);
    manifestValue.devEngines = { packageManager };
    input.files["package.json"] = `${JSON.stringify(manifestValue)}\n`;
    assert.throws(
      () => authorizeConsumerGate(input),
      /devEngines\.packageManager is forbidden.*sole pnpm identity authority/u,
    );
  }
});

test("authorizes the v2 qualification wrapper without weakening exact Cohort projection", () => {
  const input = fixture();
  const path = "architecture/foundation/docs-consumer-integration.json";
  const profileValue = JSON.parse(input.files[path]);
  profileValue.schemaVersion = 2;
  profileValue.qualification = {
    contractPath: "architecture/foundation/docs-protocol-qualification.json",
    gateCommand: "pnpm docs:protocol:check",
  };
  input.files[path] = `${JSON.stringify(profileValue)}\n`;
  input.files["architecture/foundation/docs-protocol-qualification.json"] = `${JSON.stringify({
    schemaVersion: 2,
    scenarios: [{ id: "adr", type: "adr", intent: {}, expected: {} }],
  })}\n`;
  input.tree.push({ path: "architecture/foundation/docs-protocol-qualification.json", type: "blob", mode: "100644" });
  assert.doesNotThrow(() => authorizeConsumerGate(input));
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

test("dispatches workflow -> three-root install -> exact v2 closure -> schema 3 receipt verifier", async () => {
  const coordinates = cohortV2Coordinates();
  const lockValue = cohortV2Lock();
  assert.doesNotThrow(() => validateExactPnpmLock(
    cohortV2Manifest(), lockValue, coordinates, { qualificationProfile: "cohort-v2" },
  ));
  assert.deepEqual(Object.keys(cohortV2Manifest().devDependencies).sort(), [
    "@agent-teams/docs-protocol",
    "@agent-teams/docs-protocol-agent-teams",
    "@agent-teams/engineering-foundation",
  ]);
  const workspace = parseYamlStrict(
    trustedInstallWorkspaceConfig(coordinates, "cohort-v2"), "v2 install workspace", 8192,
  );
  assert.equal(workspace.minimumReleaseAgeExclude.length, 5);
  const evidence = docsRuntimeClosureV2Evidence(lockValue, coordinates);
  assert.equal(evidence.evidence.coordinates.length, 5);
  assert.equal(evidence.evidence.managedEdges.length, 7);
  const workflowSource = await readFile(new URL("../.github/workflows/docs-protocol-check.yml", import.meta.url), "utf8");
  assert.match(workflowSource, /qualification-profile:.*authorization\.outputs\.qualification-profile/u);
  assert.match(workflowSource, /qualification-profile == 'cohort-v2'[\s\S]*run-qualification-v3[\s\S]*verify-docs-cohort-v2-receipt\.mjs/u);
  assert.throws(() => validateExactPnpmLock(cohortV2Manifest(), lockValue, coordinates),
    /Legacy qualification requires exactly two packages/u);
});

test("rejects v2 transitive roots, missing managed edges, and schema/profile drift", () => {
  const coordinates = cohortV2Coordinates();
  const transitiveRoot = cohortV2Manifest();
  transitiveRoot.devDependencies["@agent-teams/repository-mutation"] = "1.0.0-rc.1";
  assert.throws(() => validateExactPnpmLock(
    transitiveRoot, cohortV2Lock(), coordinates, { qualificationProfile: "cohort-v2" },
  ), /root\/transitive role|transitive coordinate/u);
  const missingEdge = cohortV2Lock();
  delete missingEdge.snapshots["@agent-teams/docs-protocol@1.0.0-rc.1"]
    .dependencies["@agent-teams/repository-mutation"];
  assert.throws(() => validateExactPnpmLock(
    cohortV2Manifest(), missingEdge, coordinates, { qualificationProfile: "cohort-v2" },
  ), /dependency edges are not exactly closed/u);
  assert.throws(() => trustedInstallWorkspaceConfig(coordinates, "legacy"),
    /exactly the managed Cohort packages/u);
});

test("rejects hidden peer-suffixed managed snapshots and nested importer roots", () => {
  const coordinates = cohortV2Coordinates();
  const peerVariant = cohortV2Lock();
  peerVariant.snapshots["@agent-teams/docs-protocol@1.0.0-rc.1(peer@1.0.0)"] = {
    dependencies: { "@agent-teams/engineering-foundation": "1.0.0-rc.1" },
  };
  assert.throws(() => validateExactPnpmLock(
    cohortV2Manifest(), peerVariant, coordinates, { qualificationProfile: "cohort-v2" },
  ), /additional or unresolved managed snapshot variant/u);
  const nestedRoot = cohortV2Lock();
  nestedRoot.importers["packages/hostile"] = {
    devDependencies: {
      "@agent-teams/repository-mutation": { specifier: "1.0.0-rc.1", version: "1.0.0-rc.1" },
    },
  };
  assert.throws(() => validateExactPnpmLock(
    cohortV2Manifest(), nestedRoot, coordinates, { qualificationProfile: "cohort-v2" },
  ), /must not be a direct root in nested importer/u);
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

test("allows bounded exact security overlays outside managed package authority", () => {
  const changed = addWorkspacePolicy(
    fixture(),
    `packages: []
overrides:
  transitive-package: 1.0.0
  js-yaml: 5.2.2
packageExtensions:
  dependency-cruiser@18.1.0:
    peerDependencies:
      typescript: ">=2.0.0 <7.0.0"
`,
    `overrides:
  transitive-package: 1.0.0
  js-yaml: 5.2.2
packageExtensionsChecksum: sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
`,
  );
  assert.doesNotThrow(() => authorizeConsumerGate(changed));
});

test("rejects pnpm policy overlays that can replace qualified runtime authority", async (t) => {
  const cases = [
    {
      name: "managed package override",
      workspace: `overrides:\n  '@agent-teams/docs-protocol': 0.2.0-rc.0\n`,
      lockPolicy: `overrides:\n  '@agent-teams/docs-protocol': 0.2.0-rc.0\n`,
      pattern: /must not target a managed Cohort package/iu,
    },
    {
      name: "qualified transitive replacement",
      workspace: `overrides:\n  transitive-package: 1.0.1\n`,
      lockPolicy: `overrides:\n  transitive-package: 1.0.1\n`,
      pattern: /changes a Cohort-qualified runtime package/iu,
    },
    {
      name: "registry alias",
      workspace: `overrides:\n  js-yaml: npm:other@5.2.2\n`,
      lockPolicy: `overrides:\n  js-yaml: npm:other@5.2.2\n`,
      pattern: /must select one exact registry version/iu,
    },
    {
      name: "workspace and lock mismatch",
      workspace: `overrides:\n  js-yaml: 5.2.2\n`,
      lockPolicy: `overrides:\n  js-yaml: 5.2.1\n`,
      pattern: /exact root policy projection/iu,
    },
    {
      name: "qualified package extension",
      workspace: `packageExtensions:\n  transitive-package@1.0.0:\n    peerDependencies:\n      typescript: ">=5"\n`,
      lockPolicy: `packageExtensionsChecksum: sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n`,
      pattern: /must not target the qualified Docs runtime/iu,
    },
    {
      name: "managed peer injection",
      workspace: `packageExtensions:\n  dependency-cruiser@18.1.0:\n    peerDependencies:\n      '@agent-teams/docs-protocol': 0.2.0-rc.0\n`,
      lockPolicy: `packageExtensionsChecksum: sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n`,
      pattern: /unsafe peer dependency/iu,
    },
    {
      name: "workspace patch",
      workspace: `patchedDependencies:\n  x@1.0.0: patches/x.patch\n`,
      lockPolicy: "",
      pattern: /forbidden patches or hooks/iu,
    },
  ];
  for (const entry of cases) {
    await t.test(entry.name, () => {
      const changed = addWorkspacePolicy(fixture(), entry.workspace, entry.lockPolicy);
      assert.throws(() => authorizeConsumerGate(changed), entry.pattern);
    });
  }
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

test("requires one bounded v2 qualification scenario per type", () => {
  const integration = { schemaVersion: 2, qualification: { contractPath: "architecture/foundation/docs-protocol-qualification.json", gateCommand: "pnpm docs:protocol:check" } };
  const scenario = { id: "adr", type: "adr", intent: {}, expected: {} };
  assert.doesNotThrow(() => validateQualificationContractV2Structure(integration, { schemaVersion: 2, scenarios: [scenario] }));
  assert.throws(() => validateQualificationContractV2Structure(integration, { schemaVersion: 2, scenarios: [scenario, { ...scenario, id: "adr-two" }] }), /exactly one scenario per declared type/u);
});

test("rejects pnpm hooks, nested lockfiles, and symlinked governed files", () => {
  for (const entry of [
    { path: ".pnpmfile.cjs", type: "blob", mode: "100644" },
    { path: "packages/app/node_modules/poison/index.js", type: "blob", mode: "100644" },
    { path: "packages/app/pnpm-lock.yaml", type: "blob", mode: "100644" },
    { path: "package.json", type: "blob", mode: "120000", replace: true },
  ]) {
    const changed = fixture();
    if (entry.replace) {
      changed.tree = changed.tree.map((value) => value.path === entry.path ? entry : value);
    } else {
      changed.tree.push(entry);
    }
    assert.throws(() => authorizeConsumerGate(changed), /forbidden|node_modules|nested lockfile|regular committed file/iu);
  }
});

test("uses v2 pending, revocation, and eligibility admission even for a schemaVersion 1 pinned consumer", () => {
  const stableCompatibility = policy();
  for (const mutate of [
    (entry) => { entry.admission_status = "pending_classification"; },
    (entry) => { entry.repository_lifecycle = "deleted"; },
    (entry) => { entry.observed_cohort_id = null; },
  ]) {
    const currentV2 = clone(stableCompatibility);
    mutate(currentV2.repositories[0]);
    const selected = JSON.parse(currentDocsAdmissionPolicySource({
      "governance/docs-protocol-policy.json": JSON.stringify(stableCompatibility),
      "governance/docs-protocol-policy-v2.json": JSON.stringify(currentV2),
    }));
    const changed = fixture();
    assert.equal(JSON.parse(changed.files["architecture/foundation/docs-consumer-integration.json"]).schemaVersion, 1);
    changed.policy = selected;
    assert.throws(() => authorizeConsumerGate(changed), /not an active admitted/u);
  }
});

test("runs on PR, merge queue, and actual default branch but skips feature push", () => {
  assert.equal(shouldRunDocsGate("pull_request", "feature", "trunk"), true);
  assert.equal(shouldRunDocsGate("merge_group", "gh-readonly-queue/trunk/pr-1", "trunk"), true);
  assert.equal(shouldRunDocsGate("push", "trunk", "trunk"), true);
  assert.equal(shouldRunDocsGate("push", "feature", "trunk"), false);
});

test("isolates exact Cohort qualification from the untrusted semantic gate", async () => {
  const source = await readFile(new URL("../.github/workflows/docs-protocol-check.yml", import.meta.url), "utf8");
  const workflow = parseDocument(source, { strict: true, uniqueKeys: true }).toJS();
  assert.deepEqual(workflow.on, { workflow_call: {} });
  const trusted = workflow.jobs["trusted-structural"];
  const authorize = workflow.jobs["trusted-authorize"];
  const qualification = workflow.jobs["trusted-qualification"];
  const semantic = workflow.jobs["docs-protocol-check"];
  assert.equal(semantic.if,
    "always() && (github.event_name != 'push' || github.ref_name == github.event.repository.default_branch)");
  assert.deepEqual(authorize.permissions, { contents: "read", "id-token": "write" });
  assert.deepEqual(trusted.permissions, { contents: "read" });
  assert.deepEqual(qualification.permissions, { contents: "read" });
  assert.deepEqual(semantic.permissions, { contents: "read" });
  assert.doesNotMatch(JSON.stringify(authorize.steps), /consumer revision|agent-teams-docs qualify|docs:protocol:check/u);
  assert.match(JSON.stringify(qualification.steps), /agent-teams-docs qualify[\s\S]*verify-docs-qualification-receipt/u);
  assert.doesNotMatch(JSON.stringify(semantic.steps), /agent-teams-docs qualify|verify-docs-qualification-receipt/u);
  assert.match(JSON.stringify(semantic.steps), /pnpm docs:protocol:check/u);
  assert.equal(semantic.needs, "trusted-qualification");
});

test("later controller main changes only mutable lifecycle data, never pinned validator code", async () => {
  assert.deepEqual(CURRENT_CONTROLLER_DATA_PATHS, [
    "governance/docs-protocol-exceptions.json",
    "governance/docs-protocol-policy.json",
    "governance/docs-protocol-policy-v2.json",
    "governance/docs-qualified-cohorts.json",
  ]);
  assert.ok(CURRENT_CONTROLLER_DATA_PATHS.every((path) => path.endsWith(".json")));
  assert.ok(!CURRENT_CONTROLLER_DATA_PATHS.some((path) =>
    path.startsWith("scripts/") || path === "package.json" || path.endsWith("pnpm-lock.yaml")));

  const source = await readFile(new URL("../.github/workflows/docs-protocol-check.yml", import.meta.url), "utf8");
  const workflow = parseDocument(source, { strict: true, uniqueKeys: true }).toJS();
  const checkout = workflow.jobs["trusted-authorize"].steps.find(
    ({ name }) => name === "Check out exact Cohort-bound validator implementation"
  );
  assert.equal(checkout.with.repository, "${{ steps.authority.outputs.workflow-repository }}");
  assert.equal(checkout.with.ref, "${{ steps.authority.outputs.workflow-sha }}");
  assert.notEqual(checkout.with.ref, "${{ steps.authority.outputs.controller-sha }}");

  const before = fixture();
  before.controllerDataSources = {
    "governance/docs-protocol-exceptions.json": "{}",
    "governance/docs-protocol-policy.json": JSON.stringify(before.policy),
    "governance/docs-protocol-policy-v2.json": JSON.stringify(before.policy),
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
