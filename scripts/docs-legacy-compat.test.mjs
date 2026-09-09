import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";

const LEGACY = "07d49409cb51f6124ad17673860b812a9d7b5f5b";
const root = resolve(import.meta.dirname, "..");
const candidate = await mkdtemp(join(tmpdir(), "docs-legacy-compat-"));
after(() => rm(candidate, { recursive: true, force: true }));
const git = (...args) => execFileSync("git", args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
execFileSync("tar", ["-x", "-C", candidate], { input: git("archive", LEGACY) });
await symlink(join(root, "node_modules"), join(candidate, "node_modules"), "dir");
await writeFile(join(candidate, "scripts/old-policy.mjs"),
  await readFile(join(candidate, "scripts/docs-cohort-policy.mjs")));
await writeFile(join(candidate, "scripts/old-gate.mjs"),
  (await readFile(join(candidate, "scripts/verify-docs-consumer-gate.mjs"), "utf8"))
    .replace('"./docs-cohort-policy.mjs"', '"./old-policy.mjs"'));
const oldGate = await import(pathToFileURL(join(candidate, "scripts/old-gate.mjs")));
// Apply the actual reviewable artifact, never substitute today's gate for the old consumer.
execFileSync("git", ["apply", "--unsafe-paths", `--directory=${candidate}`,
  join(root, "compat/docs-legacy/successor.patch")], { cwd: root });
// Separate filename avoids the pre-patch ESM module cache.
await writeFile(join(candidate, "scripts/successor.mjs"),
  await readFile(join(candidate, "scripts/verify-docs-consumer-gate.mjs")));
const successor = await import(pathToFileURL(join(candidate, "scripts/successor.mjs")));
// Original stable8 fixture builders, with test registration removed.
const oldTests = await readFile(join(candidate, "scripts/verify-docs-consumer-gate.test.mjs"), "utf8");
await writeFile(join(candidate, "scripts/legacy-fixture.mjs"),
  oldTests.slice(0, oldTests.indexOf('\ntest("'))
    .replace('const REPOSITORY_ID = 1314129620;', 'const REPOSITORY_ID = 1999999999;')
    .replace('"agent-teams-ai/agent-runtime"', '"agent-teams-ai/docs-legacy-compat-fixture"')
    .replace('"docs-2026-08-18-rc1"', '"docs-legacy-compat-fixture"') + '\nexport { fixture, profile, projection };\n');
const { fixture, profile, projection } = await import(pathToFileURL(join(candidate, "scripts/legacy-fixture.mjs")));
const policyModule = await import(pathToFileURL(join(candidate, "scripts/docs-cohort-policy.mjs")));
const json = async (path, base = root) => JSON.parse(await readFile(join(base, path), "utf8"));
const policy = await json("governance/docs-protocol-policy-v2.json");
const registry = await json("governance/docs-qualified-cohorts.json");
// Offline fixture time follows the complete registry event history; never a qualification clock.
const fixtureAsOf = registry.events.map(event => event.effective_at).toSorted().at(-1);
const policySchema = await json("governance/docs-protocol-policy-v2.schema.json", candidate);
const registrySchema = await json("governance/docs-qualified-cohorts.schema.json", candidate);
const oldPolicySchema = JSON.parse(git("show", `${LEGACY}:governance/docs-protocol-policy-v2.schema.json`));
const oldRegistrySchema = JSON.parse(git("show", `${LEGACY}:governance/docs-qualified-cohorts.schema.json`));

function mixed() {
  const input = fixture();
  const record = input.registry.cohorts[0];
  // Append a synthetic legacy canary; every real published record/event is retained exactly.
  for (const pkg of record.packages) {
    pkg.provenance.workflow_run_attempt = 1;
    pkg.provenance.workflow_run_url = "https://github.com/agent-teams-ai/engineering-foundation/actions/runs/10";
    pkg.provenance.workflow_run_id = 10;
  }
  record.upgrade_from = [registry.cohorts[0].cohort_id];
  record.record_digest = policyModule.cohortRecordDigest(record);
  const events = input.registry.events;
  input.registry = structuredClone(registry);
  input.registry.cohorts.push(record);
  for (const event of events) {
    event.sequence = input.registry.events.length + 1;
    event.previous_event_digest = input.registry.events.at(-1).event_digest;
    event.event_digest = policyModule.cohortEventDigest(event);
    input.registry.events.push(event);
  }
  input.files["architecture/foundation/docs-consumer-integration.json"] = JSON.stringify(profile(record, events.at(-1)));
  input.files["architecture/foundation/docs-protocol-managed-state.json"] = JSON.stringify(projection(record, events.at(-1)));
  input.policy = structuredClone(policy);
  const entry = structuredClone(input.policy.repositories.find(e => e.repository === "agent-teams-ai/agent-runtime"));
  input.policy.repositories.push(entry);
  Object.assign(entry, {
    repository: input.repository.fullName, repository_id: input.repository.id,
    admission_status: "admission_candidate", cohort_binding_status: "bootstrap_pending",
    desired_cohort_id: record.cohort_id, observed_cohort_id: null,
    observed_cohort_record_digest: null, observed_cohort_event_digest: null,
    exact_package_version: null, exact_foundation_version: null,
    reusable_workflow_revision: null, observed_default_branch_evidence: null,
  });
  input.policySchema = policySchema;
  input.registrySchema = registrySchema;
  input.asOf = fixtureAsOf;
  return input;
}

test("artifact applies to exact stable8 and preserves the immutable workflow", async () => {
  assert.equal(await readFile(join(candidate, ".github/workflows/docs-protocol-check.yml"), "utf8"),
    git("show", `${LEGACY}:.github/workflows/docs-protocol-check.yml`).toString());
  for (const path of ["scripts/docs-cohort-policy.mjs", "governance/docs-protocol-policy-v2.schema.json", "governance/docs-qualified-cohorts.schema.json"]) {
    assert.equal(await readFile(join(candidate, path), "utf8"), await readFile(join(root, path), "utf8"));
  }
});

test("unpatched stable8 rejects complete mixed policy and, independently, registry", () => {
  const input = mixed();
  assert.throws(() => oldGate.authorizeConsumerGate({ ...input, policySchema: oldPolicySchema }), /policy schema validation failed/iu);
  assert.throws(() => oldGate.authorizeConsumerGate({ ...input, registrySchema: oldRegistrySchema }), /registry does not satisfy/iu);
});

test("successor executes the legacy branch with current mixed policy AND registry", () => {
  const input = mixed();
  assert(input.policy.repositories.some(e => e.desired_cohort_generation === 2 && e.v3_qualification_coordinates));
  assert(input.registry.cohorts.some(e => e.cohort_generation === 2));
  const result = successor.authorizeConsumerGate(input);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.expectedPackages.length, 2);
  assert.equal(result.cohortId, input.registry.cohorts.at(-1).cohort_id);
  assert.deepEqual(input.policy.repositories.slice(0, -1), policy.repositories);
  assert.deepEqual(input.registry.cohorts.slice(0, -1), registry.cohorts);
  assert.deepEqual(input.registry.events.slice(0, registry.events.length), registry.events);
});

test("mixed authority authorizes the original qualification-v2 wrapper", () => {
  const input = mixed();
  const path = "architecture/foundation/docs-consumer-integration.json";
  const integration = JSON.parse(input.files[path]);
  integration.schemaVersion = 2;
  integration.qualification = {
    contractPath: "architecture/foundation/docs-protocol-qualification.json",
    gateCommand: "pnpm docs:protocol:check",
  };
  input.files[path] = JSON.stringify(integration);
  input.files[integration.qualification.contractPath] = JSON.stringify({ schemaVersion: 2,
    scenarios: [{ id: "adr", type: "adr", intent: {}, expected: {} }] });
  input.tree.push({ path: integration.qualification.contractPath, type: "blob", mode: "100644" });
  assert.equal(successor.authorizeConsumerGate(input).schemaVersion, 1);
});

test("mixed input rejects forged caller, projection and generation-2 execution", () => {
  for (const [mutate, pattern] of [
    [i => { i.files[".github/workflows/docs-protocol.yml"] += "# forged\n"; }, /caller workflow bytes differ/iu],
    [i => {
      const path = "architecture/foundation/docs-protocol-managed-state.json";
      const managed = JSON.parse(i.files[path]); managed.stateDigest = `sha256:${"0".repeat(64)}`;
      i.files[path] = JSON.stringify(managed);
    }, /Managed projection differs/iu],
    [i => {
      const record = i.registry.cohorts.find(e => e.cohort_generation === 2);
      const path = "architecture/foundation/docs-protocol-managed-state.json";
      const managed = JSON.parse(i.files[path]); managed.cohortId = record.cohort_id;
      i.files[path] = JSON.stringify(managed);
      const entry = i.policy.repositories.at(-1);
      entry.desired_cohort_id = record.cohort_id; entry.desired_cohort_generation = 2;
    }, /Legacy compatibility successor cannot execute/iu],
  ]) {
    const input = mixed(); mutate(input);
    assert.throws(() => successor.authorizeConsumerGate(input), pattern);
  }
});

test("mixed authority stays closed for unrelated canary fields, generation and digests", () => {
  for (const mutate of [
    i => { i.policy.unrecognized = true; },
    i => { i.policy.repositories.find(e => e.desired_cohort_generation === 2).unrecognized = true; },
    i => { i.policy.repositories.find(e => e.desired_cohort_generation === 2).desired_cohort_generation = 3; },
    i => { i.policy.repositories.find(e => e.v3_qualification_coordinates).v3_qualification_coordinates.receipt_schema_version = 2; },
    i => { i.registry.cohorts.find(e => e.cohort_generation === 2).unrecognized = true; },
    i => { i.registry.cohorts.find(e => e.cohort_generation === 2).cohort_generation = 3; },
    i => { i.registry.cohorts[0].record_digest = `sha256:${"0".repeat(64)}`; },
    i => { i.registry.events[0].event_digest = `sha256:${"0".repeat(64)}`; },
  ]) {
    const input = mixed(); mutate(input);
    assert.throws(() => successor.authorizeConsumerGate(input), /schema|digest/iu);
  }
});

test("current revocation, archived lifecycle and suspended legacy cohort fail closed", () => {
  for (const mutate of [
    i => { i.policy.repositories.find(e => e.repository_id === i.repository.id).admission_status = "revoked"; },
    i => { i.policy.repositories.find(e => e.repository_id === i.repository.id).repository_lifecycle = "archived"; },
    i => {
      const event = { ...i.registry.events.at(-1), sequence: i.registry.events.length + 1,
        state: "SUSPENDED", previous_event_digest: i.registry.events.at(-1).event_digest };
      event.event_digest = policyModule.cohortEventDigest(event); i.registry.events.push(event);
    },
  ]) {
    const input = mixed(); mutate(input);
    assert.throws(() => successor.authorizeConsumerGate(input));
  }
});

test("real stable8 support expires and stable14 is not selectable by Token", () => {
  const states = policyModule.validateDocsQualifiedCohorts(registry, registrySchema, { asOf: fixtureAsOf });
  const stable8 = states.cohortById.get("docs-2026-08-28-stable8");
  const token = policy.repositories.find(e => e.repository.endsWith("/agent-teams-token"));
  assert(policyModule.isDocsCohortSupportedForExistingBinding(states.stateById.get(stable8.cohort_id),
    states.supportUntilById.get(stable8.cohort_id), Date.parse(fixtureAsOf), stable8, token.repository_id));
  assert.equal(policyModule.isDocsCohortSupportedForExistingBinding(states.stateById.get(stable8.cohort_id),
    states.supportUntilById.get(stable8.cohort_id), Date.parse("2026-09-29T00:00:00Z"), stable8, token.repository_id), false);
  const stable14 = registry.cohorts.find(e => e.cohort_id.endsWith("stable14"));
  assert.equal(policyModule.isDocsCohortSelectableForRepository(stable14, states.stateById.get(stable14.cohort_id), token.repository_id), false);
});

test("all original stable8 consumer regressions execute against patched candidate", (t) => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = execFileSync(process.execPath, ["--test", "scripts/verify-docs-consumer-gate.test.mjs"],
    { cwd: candidate, env, maxBuffer: 8 * 1024 * 1024 }).toString();
  assert.match(result, /(?:# |ℹ )fail 0/u);
  assert.doesNotMatch(result, /skipping running files/u);
  t.diagnostic(result.split("\n").filter(line => /(?:tests|pass|fail) \d+/u.test(line)).join("; "));
});
