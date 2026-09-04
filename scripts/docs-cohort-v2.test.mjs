import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertDocsCohortAppendOnly,
  cohortEventDigest,
  cohortRecordDigest,
  DOCS_COHORT_V2_DEPENDENCY_EDGES,
  DOCS_COHORT_V2_PACKAGES,
  docsCohortTransitionKind,
  docsRuntimeClosureV2Evidence,
  qualifiedCohortProjection,
  validateDocsQualifiedCohorts,
} from "./docs-cohort-policy.mjs";
import {
  docsCohortV2ExecutionEnvelopeDigest,
  verifyDocsCohortV2SupportingEvidence,
} from "./verify-docs-cohort-v2-receipt.mjs";

const schema = JSON.parse(await readFile("governance/docs-qualified-cohorts.schema.json", "utf8"));
const current = JSON.parse(await readFile("governance/docs-qualified-cohorts.json", "utf8"));
const INTEGRITY = `sha512-${"A".repeat(86)}==`;
const VERSION = "1.0.0-rc.1";

function lock() {
  const locator = (name) => `${name}@${VERSION}`;
  const dependencyMap = (from) => Object.fromEntries(DOCS_COHORT_V2_DEPENDENCY_EDGES
    .filter((edge) => edge.from === from).map((edge) => [edge.to, VERSION]));
  return {
    lockfileVersion: "9.0",
    importers: { ".": { devDependencies: Object.fromEntries(DOCS_COHORT_V2_PACKAGES
      .filter(({ role }) => role === "direct")
      .map(({ name }) => [name, { specifier: VERSION, version: VERSION }])) } },
    packages: Object.fromEntries(DOCS_COHORT_V2_PACKAGES.map(({ name }) =>
      [locator(name), { resolution: { integrity: INTEGRITY } }])),
    snapshots: Object.fromEntries(DOCS_COHORT_V2_PACKAGES.map(({ name }) =>
      [locator(name), { dependencies: dependencyMap(name) }])),
  };
}

function provenance(name) {
  return {
    source_repository: "agent-teams-ai/engineering-foundation",
    source_repository_id: 1316243988,
    source_workflow: ".github/workflows/release.yml",
    source_commit: "a".repeat(40),
    workflow_run_id: 123,
    workflow_run_attempt: 1,
    registry_attestation_url: `https://registry.npmjs.org/-/npm/v1/attestations/${name.replace("/", "%2f")}@${VERSION}`,
    workflow_run_url: "https://github.com/agent-teams-ai/engineering-foundation/actions/runs/123",
    signature_verified: true,
  };
}

function fixture() {
  const registry = structuredClone(current);
  const predecessor = registry.cohorts.at(-1).cohort_id;
  const closure = docsRuntimeClosureV2Evidence(lock(), DOCS_COHORT_V2_PACKAGES.map((entry) => ({
    ...entry,
    version: VERSION,
    integrity: INTEGRITY,
  })));
  const record = {
    cohort_generation: 2,
    cohort_id: "docs-2026-09-04-v2-rc1",
    channel: "rc",
    packages: DOCS_COHORT_V2_PACKAGES.map(({ name, role }) => ({
      name,
      role,
      version: VERSION,
      integrity: INTEGRITY,
      registry: "https://registry.npmjs.org/",
      published_at: "2026-09-03T00:00:00Z",
      provenance: provenance(name),
    })),
    dependency_edges: DOCS_COHORT_V2_DEPENDENCY_EDGES,
    reusable_workflow: {
      repository: "agent-teams-ai/.github",
      repository_id: 1316243981,
      path: ".github/workflows/docs-protocol-check.yml",
      revision: "b".repeat(40),
      blob_sha: "c".repeat(40),
    },
    schemas: {
      consumer_integration: 3,
      managed_state: 2,
      docs_protocol: 1,
      qualification_receipt: 3,
      foundation_plan: 1,
      foundation_journal: 1,
      foundation_receipt: 1,
      foundation_envelope: 5,
    },
    assets: Object.fromEntries(["skill", "caller_workflow", "asset_catalog", "transition_catalog"]
      .map((key, index) => [key, {
        package: "@agent-teams/docs-protocol-agent-teams",
        path: key === "skill" ? "skills/docs/SKILL.md" :
          key === "caller_workflow" ? "assets/docs-protocol.yml" :
            key === "asset_catalog" ? "assets/catalog.json" : "assets/transition-catalog.json",
        digest: `sha256:${String(index + 1).repeat(64)}`,
        ...(key === "caller_workflow" ? { rendered_digest: `sha256:${"9".repeat(64)}` } : {}),
      }])),
    runtime: {
      node: ">=24.18.0 <25",
      pnpm: ">=11.17.0 <12",
      apply_platforms: ["linux", "macos"],
      check_plan_platforms: ["linux", "macos", "windows"],
    },
    runtime_closure: closure.authority,
    eligible_after: "2026-09-04T00:00:00Z",
    upgrade_from: [predecessor],
    rollback_to: [predecessor],
    canary_repositories: [{
      repository_id: 1336577313,
      repository: "agent-teams-ai/docs-protocol-canary-20260817",
    }],
    evidence_references: ["test:cohort-v2"],
    record_digest: `sha256:${"f".repeat(64)}`,
  };
  record.record_digest = cohortRecordDigest(record);
  registry.cohorts.push(record);
  let previous = registry.events.at(-1).event_digest;
  const eventTimes = ["2026-09-03T00:00:00Z", "2026-09-03T01:00:00Z", "2026-09-04T00:00:00Z"];
  for (const [index, state] of ["PUBLISHED_UNQUALIFIED", "VERIFIED", "QUALIFIED"].entries()) {
    const event = {
      sequence: registry.events.length + 1,
      cohort_id: record.cohort_id,
      state,
      effective_at: eventTimes[index],
      support_until: null,
      evidence_references: [`test:v2-${state.toLowerCase()}`],
      canary_evidence: [],
      previous_event_digest: previous,
      event_digest: `sha256:${"0".repeat(64)}`,
    };
    event.event_digest = cohortEventDigest(event);
    registry.events.push(event);
    previous = event.event_digest;
  }
  return { registry, record, closure };
}

test("coexists with byte-immutable v1 and dispatches only on the explicit v2 discriminator", () => {
  const { registry, record } = fixture();
  assert.doesNotThrow(() => validateDocsQualifiedCohorts(registry, schema, {
    asOf: "2026-09-04T03:00:00Z",
  }));
  assert.deepEqual(registry.cohorts.slice(0, current.cohorts.length), current.cohorts);
  assert.deepEqual(registry.events.slice(0, current.events.length), current.events);
  const disguised = structuredClone(record);
  delete disguised.cohort_generation;
  disguised.record_digest = cohortRecordDigest(disguised);
  const invalid = structuredClone(registry);
  invalid.cohorts.splice(-1, 1, disguised);
  assert.throws(() => validateDocsQualifiedCohorts(invalid, schema, {
    asOf: "2026-09-04T03:00:00Z",
  }), /JSON Schema/u);
  assert.notEqual(cohortRecordDigest(record), cohortRecordDigest(disguised));
});

test("binds three roots, two transitives, seven exact internal edges, and runtime domain v2", () => {
  const { closure } = fixture();
  assert.equal(closure.evidence.domain, "agent-teams.docs-runtime-closure/v2");
  assert.equal(closure.evidence.schemaVersion, 2);
  assert.deepEqual(Object.keys(closure.evidence.pnpmLock.importers["."].devDependencies).sort(), [
    "@agent-teams/docs-protocol",
    "@agent-teams/docs-protocol-agent-teams",
    "@agent-teams/engineering-foundation",
  ]);
  assert.deepEqual(new Set(closure.evidence.managedEdges.map(({ from, to }) => `${from}>${to}`)),
    new Set(DOCS_COHORT_V2_DEPENDENCY_EDGES.map(({ from, to }) => `${from}>${to}`)));
  const bad = lock();
  bad.snapshots[`@agent-teams/docs-protocol@${VERSION}`].dependencies["@agent-teams/engineering-foundation"] = VERSION;
  assert.throws(() => docsRuntimeClosureV2Evidence(bad, DOCS_COHORT_V2_PACKAGES.map((entry) => ({
    ...entry, version: VERSION, integrity: INTEGRITY,
  }))), /dependency edges are not exactly closed/u);
});

test("projects schema tuple 3/2/1 and docs-protocol-agent-teams-owned v2 assets", () => {
  const { registry, record } = fixture();
  const projection = qualifiedCohortProjection(registry, record.cohort_id, {
    asOf: "2026-09-04T03:00:00Z",
  });
  assert.equal(projection.schemaVersion, 2);
  assert.deepEqual(projection.schemas, { consumerIntegration: 3, managedState: 2, docsProtocol: 1 });
  assert.deepEqual(Object.keys(projection.packages), [
    "repositoryMutation", "documentAuthoring", "docsProtocol",
    "docsProtocolAgentTeams", "engineeringFoundation",
  ]);
  assert.ok(Object.values(record.assets).every(({ package: owner }) =>
    owner === "@agent-teams/docs-protocol-agent-teams"));
});

test("binds migration edges to a qualified target and recognizes explicit upgrade/rollback", () => {
  const { registry, record } = fixture();
  const predecessor = registry.cohorts.at(-2);
  assert.equal(docsCohortTransitionKind(predecessor, record), "upgrade");
  assert.equal(docsCohortTransitionKind(record, predecessor), "rollback");
  assert.ok(registry.events.some(({ cohort_id, state }) =>
    cohort_id === predecessor.cohort_id && state === "QUALIFIED"));
  const withoutEdge = structuredClone(record);
  withoutEdge.upgrade_from = [];
  withoutEdge.rollback_to = [];
  assert.equal(docsCohortTransitionKind(predecessor, withoutEdge), undefined);
});

test("locks every top-level metadata field while allowing only append-only records/events", () => {
  const changed = structuredClone(current);
  changed.organization = "attacker";
  assert.throws(() => assertDocsCohortAppendOnly(current, changed), /top-level metadata/u);
  const added = fixture().registry;
  assert.doesNotThrow(() => assertDocsCohortAppendOnly(current, added));
});

test("accepts receipt v3 only with an immutable envelope and never substitutes central CANARY evidence", () => {
  const { registry, record } = fixture();
  const qualification = registry.events.find(({ cohort_id, state }) =>
    cohort_id === record.cohort_id && state === "QUALIFIED");
  const body = {
    schemaVersion: 3,
    cohortAdmissible: true,
    profileSchemaVersion: 3,
    cohort: {
      schemaVersion: 2,
      cohortId: record.cohort_id,
      recordDigest: record.record_digest,
      qualificationEventDigest: qualification.event_digest,
    },
    packages: record.packages.map(({ name, version, integrity }, index) => ({
      key: ["repositoryMutation", "documentAuthoring", "docsProtocol",
        "docsProtocolAgentTeams", "engineeringFoundation"][index],
      name, version, integrity,
    })),
    schemas: { consumerIntegration: 3, managedState: 2, docsProtocol: 1 },
    runtime: { runtimeClosureDigest: record.runtime_closure.digest },
    checks: ["profile-v3", "cohort-v2", "five-package-closure", "exact-package-versions",
      "exact-package-integrities", "schema-bindings-3-2-1", "runtime-closure-digest"],
  };
  const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` :
    value !== null && typeof value === "object" ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}` : JSON.stringify(value);
  const receipt = { ...body, receiptDigest: `sha256:${createHash("sha256").update(canonical(body)).digest("hex")}` };
  const envelopeBody = {
    schemaVersion: 1,
    domain: "agent-teams.docs-cohort-v2-execution-envelope/v1",
    callerSha: "d".repeat(40),
    checkout: { repository: "agent-teams-ai/docs-protocol-canary-20260817", repositoryId: 1336577313, revision: "d".repeat(40) },
    workflow: {
      repository: record.reusable_workflow.repository,
      path: record.reusable_workflow.path,
      revision: record.reusable_workflow.revision,
      blobSha: record.reusable_workflow.blob_sha,
      runId: 456,
      runAttempt: 1,
    },
    authorizationDigest: `sha256:${"6".repeat(64)}`,
    installEvidenceDigest: `sha256:${"7".repeat(64)}`,
    receiptDigest: receipt.receiptDigest,
  };
  const executionEnvelope = {
    ...envelopeBody,
    envelopeDigest: docsCohortV2ExecutionEnvelopeDigest(envelopeBody),
  };
  const verified = verifyDocsCohortV2SupportingEvidence({
    receipt, executionEnvelope, record, qualificationEvent: qualification,
  });
  assert.equal(verified.centralCanaryEvidenceSatisfied, false);
  assert.equal(verified.evidenceClass, "cohort-v2-supporting-canary");
  const wrongReceiptEvent = structuredClone(receipt);
  wrongReceiptEvent.cohort.qualificationEventDigest = `sha256:${"8".repeat(64)}`;
  const { receiptDigest: _oldReceiptDigest, ...wrongReceiptBody } = wrongReceiptEvent;
  wrongReceiptEvent.receiptDigest = `sha256:${createHash("sha256").update(canonical(wrongReceiptBody)).digest("hex")}`;
  const wrongReceiptEnvelope = structuredClone(executionEnvelope);
  wrongReceiptEnvelope.receiptDigest = wrongReceiptEvent.receiptDigest;
  const { envelopeDigest: _oldEnvelopeDigest, ...wrongReceiptEnvelopeBody } = wrongReceiptEnvelope;
  wrongReceiptEnvelope.envelopeDigest = docsCohortV2ExecutionEnvelopeDigest(wrongReceiptEnvelopeBody);
  assert.throws(() => verifyDocsCohortV2SupportingEvidence({
    receipt: wrongReceiptEvent, executionEnvelope: wrongReceiptEnvelope, record,
    qualificationEvent: qualification,
  }), /exact Cohort v2 authority/u);
  const forgedQualification = structuredClone(qualification);
  forgedQualification.event_digest = `sha256:${"8".repeat(64)}`;
  assert.throws(() => verifyDocsCohortV2SupportingEvidence({
    receipt, executionEnvelope, record, qualificationEvent: forgedQualification,
  }), /exact immutable QUALIFIED event/u);
  const undeclaredCheckout = structuredClone(executionEnvelope);
  undeclaredCheckout.checkout = {
    repository: "agent-teams-ai/not-a-canary", repositoryId: 999, revision: undeclaredCheckout.callerSha,
  };
  const { envelopeDigest: _priorDigest, ...undeclaredBody } = undeclaredCheckout;
  undeclaredCheckout.envelopeDigest = docsCohortV2ExecutionEnvelopeDigest(undeclaredBody);
  assert.throws(() => verifyDocsCohortV2SupportingEvidence({
    receipt, executionEnvelope: undeclaredCheckout, record, qualificationEvent: qualification,
  }), /declared canary repository/u);
  executionEnvelope.callerSha = "e".repeat(40);
  assert.throws(() => verifyDocsCohortV2SupportingEvidence({
    receipt, executionEnvelope, record, qualificationEvent: qualification,
  }),
    /envelope digest binding/u);
});
