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
const HISTORICAL_V1_COHORT_ID = "docs-2026-08-17-rc1";
const FIXTURE_AS_OF = "2026-09-04T03:00:00Z";

function historicalV1QualifiedPrefix(source) {
  const record = source.cohorts.find(({ cohort_id }) => cohort_id === HISTORICAL_V1_COHORT_ID);
  assert.ok(record, "the named historical v1 cohort must exist");
  assert.equal(source.cohorts[0], record);
  assert.equal(record.cohort_generation, undefined);
  const qualificationIndex = source.events.findIndex(({ cohort_id, state }) =>
    cohort_id === HISTORICAL_V1_COHORT_ID && state === "QUALIFIED");
  assert.ok(qualificationIndex >= 0, "the named cohort must have an explicit QUALIFIED event");
  const events = source.events.slice(0, qualificationIndex + 1);
  assert.deepEqual(events.map(({ sequence }) => sequence), [1, 2, 3, 4]);
  assert.ok(events.every(({ cohort_id }) => cohort_id === HISTORICAL_V1_COHORT_ID));
  assert.equal(events.at(-1).state, "QUALIFIED");
  assert.equal(events.at(-1).effective_at, "2026-08-17T10:46:59Z");
  return structuredClone({ ...source, cohorts: [record], events });
}

const historicalV1 = historicalV1QualifiedPrefix(current);

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
  const registry = structuredClone(historicalV1);
  const predecessor = HISTORICAL_V1_COHORT_ID;
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
    asOf: FIXTURE_AS_OF,
  }));
  assert.deepEqual(registry.cohorts.slice(0, historicalV1.cohorts.length), historicalV1.cohorts);
  assert.deepEqual(registry.events.slice(0, historicalV1.events.length), historicalV1.events);
  const disguised = structuredClone(record);
  delete disguised.cohort_generation;
  disguised.record_digest = cohortRecordDigest(disguised);
  const invalid = structuredClone(registry);
  invalid.cohorts.splice(-1, 1, disguised);
  assert.throws(() => validateDocsQualifiedCohorts(invalid, schema, {
    asOf: FIXTURE_AS_OF,
  }), /JSON Schema/u);
  assert.notEqual(cohortRecordDigest(record), cohortRecordDigest(disguised));
});

test("v2 accepts optional closed publication reconciliation with fresh record digests", () => {
  const { registry, record } = fixture();
  const validate = () => {
    record.record_digest = cohortRecordDigest(record);
    validateDocsQualifiedCohorts(registry, schema, { asOf: FIXTURE_AS_OF });
  };
  assert.doesNotThrow(validate);
  for (const entry of record.packages) {
    entry.provenance.reconciliation = { workflow_run_attempt: 2, release_job_id: 777 };
  }
  assert.doesNotThrow(validate);
  const origin = record.packages[0].provenance;
  const valid = structuredClone(origin.reconciliation);
  const invalid = [null, [], {}, { ...valid, unknown: true }];
  for (const field of Object.keys(valid)) {
    const missing = { ...valid };
    delete missing[field];
    invalid.push(missing);
    for (const value of [0, -1, "2", true]) {
      invalid.push({ ...valid, [field]: value });
    }
  }
  for (const reconciliation of invalid) {
    origin.reconciliation = reconciliation;
    assert.throws(validate, /JSON Schema/u, JSON.stringify(reconciliation));
  }
  for (const field of Object.keys(valid)) {
    // Fractional values cannot be canonicalized; schema must reject them first.
    origin.reconciliation = { ...valid, [field]: 1.5 };
    assert.throws(() => validateDocsQualifiedCohorts(registry, schema, {
      asOf: FIXTURE_AS_OF,
    }), /JSON Schema/u);
  }
  origin.reconciliation = valid;
  origin.unrelated = true;
  assert.throws(validate, /JSON Schema/u);
  delete origin.unrelated;
  assert.doesNotThrow(validate);
});

test("later suffixes including an unqualified tail preserve the historical prefix and source", () => {
  const source = structuredClone(current);
  const tail = structuredClone(source.cohorts[0]);
  tail.cohort_id = "docs-2026-09-07-rc1";
  tail.record_digest = cohortRecordDigest(tail);
  source.cohorts.push(tail);
  const event = {
    ...structuredClone(source.events[0]),
    cohort_id: tail.cohort_id,
    sequence: source.events.length + 1,
    state: "PUBLISHED_UNQUALIFIED",
    effective_at: "2026-09-07T00:00:00Z",
    previous_event_digest: source.events.at(-1).event_digest,
  };
  event.event_digest = cohortEventDigest(event);
  source.events.push(event);
  const before = structuredClone(source);
  assert.deepEqual(historicalV1QualifiedPrefix(source), historicalV1);
  assert.deepEqual(source, before);
});

test("rejects a final QUALIFIED event one millisecond after the fixed fixture clock", () => {
  const { registry } = fixture();
  const qualification = registry.events.at(-1);
  assert.equal(qualification.state, "QUALIFIED");
  qualification.effective_at = new Date(Date.parse(FIXTURE_AS_OF) + 1).toISOString();
  qualification.event_digest = cohortEventDigest(qualification);
  assert.throws(() => validateDocsQualifiedCohorts(registry, schema, {
    asOf: FIXTURE_AS_OF,
  }), /future/u);
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
    asOf: FIXTURE_AS_OF,
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
  const changed = structuredClone(historicalV1);
  changed.organization = "attacker";
  assert.throws(() => assertDocsCohortAppendOnly(historicalV1, changed), /top-level metadata/u);
  const added = fixture().registry;
  assert.doesNotThrow(() => assertDocsCohortAppendOnly(historicalV1, added));
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
    value !== null && typeof value === "object" ? `{${Object.entries(value).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
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

// OFFLINE conformance fixture ONLY, not a hosted receipt or trusted execution proof.
// Captured unmodified from installed @agent-teams/docs-protocol-agent-teams@0.2.3
// public ./qualification runDocsProtocolQualificationV3 using the Canary stable17
// profile and closure82 lock. No managed command, hash mock, or receipt re-signing.
// The literal bytes and digest are an independent producer oracle for this test.
const publicV3ReceiptSource = `{
  "schemaVersion": 3,
  "cohortAdmissible": true,
  "profileSchemaVersion": 3,
  "cohort": {
    "schemaVersion": 2,
    "cohortId": "docs-2026-09-09-stable17",
    "recordDigest": "sha256:ec499aa9d9c40f996040c73c29d9c051cfb1325a532b8e2d851b803a234cbe24",
    "qualificationEventDigest": "sha256:942e4eac460621ab889a945990af080f1cbcdcbdc2497f9b891f11e31b544d44"
  },
  "packages": [
    {
      "key": "repositoryMutation",
      "name": "@agent-teams/repository-mutation",
      "version": "0.2.0",
      "integrity": "sha512-a02kzLlWtQjPAG2fFo/HyC+T6D+hW+FJ+aNCYoTLuTdKqeuL50hIvSnQLMUbGajWBb4nAvaINvW2jvmJ+Qku0g=="
    },
    {
      "key": "documentAuthoring",
      "name": "@agent-teams/document-authoring",
      "version": "0.3.0",
      "integrity": "sha512-LdNT8VHPQxXvuyXsCblFSeCmbEEZcXwiCTY1E+c0ZEWWJG0V2qoi95F8fHAwI4ngZLDmLr/yzHGyDqwkd9GBrA=="
    },
    {
      "key": "docsProtocol",
      "name": "@agent-teams/docs-protocol",
      "version": "0.6.0",
      "integrity": "sha512-xSlc0DFTGh0jed9581LoToHAXwxxZMhzlItbPeoc67YNBSDxLCP8XNwK0LCMs4w8MLqY6silJDtpzsHFw2XSVg=="
    },
    {
      "key": "docsProtocolAgentTeams",
      "name": "@agent-teams/docs-protocol-agent-teams",
      "version": "0.2.3",
      "integrity": "sha512-06faihpc/s86i/+leI+TmvVPCbVgEC30wSLfYvw4h360rbRNSLgY1pQEeY7W8+pQMi+LdYopt6fkBl0Z7ZGJrg=="
    },
    {
      "key": "engineeringFoundation",
      "name": "@agent-teams/engineering-foundation",
      "version": "1.1.1",
      "integrity": "sha512-tBVsRkm92KN/Um1c2S+3N8DTEBU2Ki7VgfuZWJ/SEhyNwP24ElMQxlSOaV/TrClBsEnjVkDsbGQxLP8jRJqmEw=="
    }
  ],
  "schemas": {
    "consumerIntegration": 3,
    "managedState": 2,
    "docsProtocol": 1
  },
  "runtime": {
    "runtimeClosureDigest": "sha256:e2c56ef5299a33d83e86279151e32eab0eb4ca19e020a02aa65d657cb3fa5054"
  },
  "checks": [
    "profile-v3",
    "cohort-v2",
    "five-package-closure",
    "exact-package-versions",
    "exact-package-integrities",
    "schema-bindings-3-2-1",
    "runtime-closure-digest"
  ],
  "receiptDigest": "sha256:484bf81c618827f3bbab556e500f6d22ddaed21be7659f726aa5747a0628d20e"
}
`;

test("published adapter 0.2.3 receipt bytes conform independently of key insertion order and receipt locale sorting", (t) => {
  assert.equal(createHash("sha256").update(publicV3ReceiptSource).digest("hex"),
    "86a458768f19d050221bb4555c2a6451d9ec7f064c660c40aea677db2eba24c8");
  const receipt = JSON.parse(publicV3ReceiptSource);
  const record = current.cohorts.find(({ cohort_id }) => cohort_id === receipt.cohort.cohortId);
  const qualificationEvent = current.events.find(({ event_digest }) =>
    event_digest === receipt.cohort.qualificationEventDigest);
  // Test-only execution coordinates, as in the existing supporting-evidence fixture.
  // This unchanged envelope digest also pins the existing central digest domain.
  const executionEnvelope = {
    "schemaVersion": 1,
    "domain": "agent-teams.docs-cohort-v2-execution-envelope/v1",
    "callerSha": "dddddddddddddddddddddddddddddddddddddddd",
    "checkout": {
      "repository": "agent-teams-ai/docs-protocol-canary-20260817",
      "repositoryId": 1336577313,
      "revision": "dddddddddddddddddddddddddddddddddddddddd"
    },
    "workflow": {
      "repository": "agent-teams-ai/.github",
      "path": ".github/workflows/docs-protocol-check.yml",
      "revision": "b4b90d89a1ba3429d01e670c9d0a4c7210cd82cf",
      "blobSha": "9bcbe54dfec6280045ac596e55c1f14ce5f176e1",
      "runId": 456,
      "runAttempt": 1
    },
    "authorizationDigest": "sha256:6666666666666666666666666666666666666666666666666666666666666666",
    "installEvidenceDigest": "sha256:7777777777777777777777777777777777777777777777777777777777777777",
    "receiptDigest": "sha256:484bf81c618827f3bbab556e500f6d22ddaed21be7659f726aa5747a0628d20e",
    "envelopeDigest": "sha256:88efea2961b84bf6f4d5a3438b75ef6333b276877bd94bc11a5690e7af3a4a25"
  };
  const verify = (value = receipt, bindings = {}) => verifyDocsCohortV2SupportingEvidence({
    receipt: value, record, qualificationEvent, executionEnvelope, ...bindings,
  });
  assert.equal(verify().centralCanaryEvidenceSatisfied, false);
  const reverseKeys = (value) => Array.isArray(value) ? value.map(reverseKeys) :
    value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value)
      .reverse().map(([key, entry]) => [key, reverseKeys(entry)])) : value;
  assert.deepEqual(verify(reverseKeys(receipt)), verify());

  // Changing locale collation of these receipt keys cannot affect its digest.
  // Delegate every other comparison so central event/envelope domains stay intact.
  const localeCompare = String.prototype.localeCompare;
  t.mock.method(String.prototype, "localeCompare", function (right, ...options) {
    if (["schemas", "schemaVersion"].includes(String(this)) &&
      ["schemas", "schemaVersion"].includes(String(right))) {
      throw new Error("Receipt digest must not use locale collation.");
    }
    return localeCompare.call(this, right, ...options);
  });
  assert.deepEqual(verify(reverseKeys(receipt)), verify());
  const legacyDigest = structuredClone(receipt);
  legacyDigest.receiptDigest = "sha256:6d129e2ed02fd9a1897a68cb333a6362e316db2f4f93aafd256296e93aac1d19";
  assert.throws(() => verify(legacyDigest), /Qualification receipt v3 digest is invalid/u);
  for (const mutate of [
    (value) => {value.packages[0].version = "0.2.1";},
    (value) => {value.packages[0].integrity = INTEGRITY;},
    (value) => {value.cohort.recordDigest = `sha256:${"a".repeat(64)}`;},
    (value) => {value.cohort.qualificationEventDigest = `sha256:${"b".repeat(64)}`;},
    (value) => {value.schemas.managedState = 1;},
    (value) => {value.runtime.runtimeClosureDigest = `sha256:${"c".repeat(64)}`;},
    (value) => {value.checks.reverse();},
    (value) => {value.packages.reverse();},
    (value) => {value.receiptDigest = "sha256:invalid";},
  ]) {
    const tampered = structuredClone(receipt);
    mutate(tampered);
    assert.throws(() => verify(tampered), /Qualification receipt v3 digest is invalid/u);
  }
  const wrongRecord = structuredClone(record);
  wrongRecord.packages[0].version = "0.2.1";
  assert.throws(() => verify(receipt, { record: wrongRecord }), /coordinate .* is not exact/u);
  const wrongRuntime = structuredClone(record);
  wrongRuntime.runtime_closure.digest = `sha256:${"c".repeat(64)}`;
  assert.throws(() => verify(receipt, { record: wrongRuntime }), /schema\/runtime checks differ/u);
  const wrongEnvelope = structuredClone(executionEnvelope);
  wrongEnvelope.installEvidenceDigest = `sha256:${"c".repeat(64)}`;
  assert.throws(() => verify(receipt, { executionEnvelope: wrongEnvelope }), /envelope digest binding/u);
});
