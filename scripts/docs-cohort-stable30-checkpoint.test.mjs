import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalDocsManagedAssetDigests,
  cohortRecordDigest,
  docsRuntimeClosureV2Evidence,
  qualifiedCohortProjection,
  QUALIFIED_DOCS_PROFILE_PATH,
  QUALIFIED_DOCS_SKILL_PATH,
  validateDocsQualifiedCohorts,
} from "./docs-cohort-policy.mjs";
import { renderCallerWorkflowTemplate } from "./verify-docs-cohort-evidence.mjs";

const evidenceRoot = "governance/evidence/docs-cohorts/docs-2026-09-30-stable30/";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const record = await json(`${evidenceRoot}record-draft.json`);
const registry = await json("governance/docs-qualified-cohorts.json");
const schema = await json("governance/docs-qualified-cohorts.schema.json");
const excerpts = await json(`${evidenceRoot}source-excerpts.json`);
const adapter = excerpts.packages.find(({ name }) => name === "@agent-teams/docs-protocol-agent-teams");
const bytes = (path) => Buffer.from(adapter.files_base64[path], "base64");
const sha256 = (source) => `sha256:${createHash("sha256").update(source).digest("hex")}`;

test("stable30 cannot enter central authority while cryptographic verification is pending", () => {
  assert.equal(record.record_digest, cohortRecordDigest(record));
  assert.ok(record.packages.every(({ provenance }) => provenance.signature_verified === false));
  assert.ok(!registry.cohorts.some(({ cohort_id }) => cohort_id === record.cohort_id));
  assert.ok(!registry.events.some(({ cohort_id }) => cohort_id === record.cohort_id));
  assert.throws(() => validateDocsQualifiedCohorts({
    ...registry, cohorts: [...registry.cohorts, record],
  }, schema), /JSON Schema/u);
  assert.equal(record.runtime.node, ">=24.18.0 <25");
  assert.deepEqual(record.canary_repositories, [{
    repository_id: 1348461381, repository: "agent-teams-ai/agent-teams-token",
  }]);
});

test("host closure binds the published successor SRIs and keeps the two transitives out of its importer", async () => {
  const source = await readFile(record.runtime_closure.projection_path, "utf8");
  assert.equal(sha256(source), record.runtime_closure.digest);
  const lock = JSON.parse(source).pnpmLock;
  const derived = docsRuntimeClosureV2Evidence(lock, record.packages);
  assert.equal(derived.source, source);
  assert.deepEqual(derived.authority, record.runtime_closure);
  assert.deepEqual(Object.keys(lock.importers["."].devDependencies).sort(), [
    "@agent-teams/docs-protocol", "@agent-teams/docs-protocol-agent-teams",
    "@agent-teams/engineering-foundation",
  ]);
  assert.deepEqual(record.packages.map(({ version }) => version), ["0.2.2", "0.3.2", "0.6.2", "0.2.13", "1.7.0"]);
  // A preceding Cohort lock, or a substituted archive at the same version,
  // must fail even when the graph still has five coordinates and three roots.
  const substituted = structuredClone(record.packages);
  substituted[0].integrity = `sha512-${"A".repeat(86)}==`;
  assert.throws(() => docsRuntimeClosureV2Evidence(lock, substituted), /integrity differs/u);
  for (const entry of record.packages) {
    const packed = excerpts.packages.find(({ name }) => name === entry.name);
    const manifest = JSON.parse(Buffer.from(packed.files_base64["package.json"], "base64"));
    assert.equal(packed.archive_integrity, entry.integrity);
    assert.equal(manifest.name, entry.name);
    assert.equal(manifest.version, entry.version);
    for (const { to } of record.dependency_edges.filter(({ from }) => from === entry.name)) {
      assert.equal(manifest.dependencies[to], record.packages.find(({ name }) => name === to).version);
    }
  }
});

test("raw provenance preserves failed attempt 1 and reconciles only those three coordinates to attempt 2", async () => {
  const origin = await json(`${evidenceRoot}sources/node26-foundation-release-attempt1.json`);
  const recovery = await json(`${evidenceRoot}sources/node26-foundation-release-attempt2.json`);
  const originJob = await json(`${evidenceRoot}sources/node26-foundation-release-job-attempt1.json`);
  const recoveryJob = await json(`${evidenceRoot}sources/node26-foundation-release-job-attempt2.json`);
  assert.equal(origin.conclusion, "failure");
  assert.equal(originJob.conclusion, "failure");
  assert.equal(recovery.conclusion, "success");
  assert.equal(recoveryJob.conclusion, "success");
  for (const [index, entry] of record.packages.entries()) {
    const bundle = await json(`${evidenceRoot}sources/attestations/${entry.name.split("/")[1]}-${entry.version}.json`);
    const provenance = bundle.attestations.filter(({ predicateType }) => predicateType === "https://slsa.dev/provenance/v1");
    assert.equal(provenance.length, 1);
    const statement = JSON.parse(Buffer.from(provenance[0].bundle.dsseEnvelope.payload, "base64"));
    assert.equal(statement.subject[0].digest.sha512, Buffer.from(entry.integrity.slice(7), "base64").toString("hex"));
    const build = statement.predicate.buildDefinition;
    assert.equal(build.resolvedDependencies[0].digest.gitCommit, "3cdb6dae33772e3c8623432c5764da69bea5484a");
    assert.equal(build.externalParameters.workflow.path, ".github/workflows/release.yml");
    const attempt = index < 3 ? 1 : 2;
    assert.equal(entry.provenance.workflow_run_attempt, attempt);
    assert.equal(statement.predicate.runDetails.metadata.invocationId,
      `https://github.com/agent-teams-ai/engineering-foundation/actions/runs/36602046555/attempts/${attempt}`);
    if (index < 3) {
      assert.deepEqual(entry.provenance.reconciliation, {
        workflow_run_attempt: 2, release_job_id: recoveryJob.id,
      });
    } else {
      assert.equal(entry.provenance.reconciliation, undefined);
    }
    for (const receipt of [origin, recovery, originJob, recoveryJob]) {
      assert.equal(receipt.head_sha, entry.provenance.source_commit);
      assert.equal(receipt.status, "completed");
    }
  }
  // This decodes authentic retained bundles; it performs no cryptographic audit.
});

test("published transition bytes support stable25 upgrade and rollback, and cannot imply a stable29 origin", () => {
  const catalog = JSON.parse(bytes(record.assets.transition_catalog.path));
  assert.deepEqual(catalog.currentSourceExecutors, []);
  assert.deepEqual(record.upgrade_from, ["docs-2026-09-16-stable25"]);
  assert.deepEqual(record.rollback_to, record.upgrade_from);
  assert.ok(catalog.directTargetBundles.some(({ cohort }) => cohort.cohortId === record.upgrade_from[0]));
  assert.ok(!catalog.directTargetBundles.some(({ cohort }) => cohort.cohortId === "docs-2026-09-25-stable29"));
  const managed = canonicalDocsManagedAssetDigests({
    profilePath: QUALIFIED_DOCS_PROFILE_PATH, skillPath: QUALIFIED_DOCS_SKILL_PATH,
  });
  // Verify every historical target, as the live verifier does; checking only
  // stable25 would miss an invalid unrelated bundle that blocks publication.
  for (const target of catalog.directTargetBundles) {
    assert.deepEqual(target.cohort, qualifiedCohortProjection(registry, target.cohort.cohortId));
    assert.equal(sha256(bytes(target.skillPath)), target.skillDigest);
    assert.equal(sha256(bytes(target.callerWorkflowPath)), target.callerWorkflowDigest);
    assert.equal(target.agentsRouteDigest, managed.agentsRouteDigest);
    assert.equal(target.docsScriptsDigest, managed.docsScriptsDigest);
  }
  for (const asset of Object.values(record.assets)) {
    assert.equal(asset.package, adapter.name);
    assert.equal(sha256(bytes(asset.path)), asset.digest);
  }
  assert.equal(sha256(renderCallerWorkflowTemplate(bytes(record.assets.caller_workflow.path), record.reusable_workflow)),
    record.assets.caller_workflow.rendered_digest);
});
