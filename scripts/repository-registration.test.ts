import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateSchema } from "./governance-schema.ts";
import { createRepositoryRegistrationReader, parseRepositoryRegistrationJson, projectRepositoryRegistrations } from "./repository-registration.ts";
import type { DocsSnapshot, HistoricalPolicyValidators, InventorySnapshot, LedgerSnapshot, RegistrationContext, RegistrationScope, RepositoryRegistration } from "./repository-registration.ts";

const loadJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const inventorySchema = await loadJson("governance/organization-repository-inventory.schema.json");
const ledgerSchema = await loadJson("governance/executable-spec-qualification.schema.json");
const docsProtocolSchema = await loadJson("governance/docs-protocol-policy-v2.schema.json");
const registrationSchema = await loadJson("governance/repository-registration-supplements.schema.json");
const inventory = validateSchema<InventorySnapshot>(await loadJson("governance/organization-repository-inventory.json"), inventorySchema, "Inventory");
const ledger = validateSchema<LedgerSnapshot>(await loadJson("governance/executable-spec-qualification.json"), ledgerSchema, "Ledger");
const docsProtocol = validateSchema<DocsSnapshot>(await loadJson("governance/docs-protocol-policy-v2.json"), docsProtocolSchema, "Docs");
const registrations = validateSchema<RegistrationScope>(await loadJson("governance/repository-registration-supplements.json"), registrationSchema,
  "Registrations", [inventorySchema, docsProtocolSchema]);
const registrationContext: RegistrationContext = { inventory, ledger, docsProtocol, inventorySchema, docsProtocolSchema };
const validators: HistoricalPolicyValidators = {
  inventory: (value, schema) => { validateSchema(value, schema, "Inventory"); },
  ledger: (value, schema) => { validateSchema(value, schema, "Ledger"); },
  docs: (value, schema) => { validateSchema(value, schema, "Docs"); },
};
const { validateRepositoryRegistrationSupplements, loadRepositoryRegistrationScope } = createRepositoryRegistrationReader(validators);
const first = (scope: RegistrationScope): RepositoryRegistration => {
  const value = scope.repositories[0]; assert.ok(value); return value;
};

test("pending Payments registration reconciles ownership without rewriting a historical census or qualification", async () => {
  const scope = await loadRepositoryRegistrationScope({ inventory, ledger, docsProtocol });
  const payment = scope.repositories.find(record => record.inventory.repository === "agent-teams-ai/payments-sdk");
  assert.ok(payment);
  assert.equal(payment.owner_reference, "https://github.com/777genius");
  assert.equal(payment.executable_specification.specification_maturity, "not_assessed");
  assert.equal(payment.executable_specification.implementation_qualification, "not_qualified");
  assert.equal(payment.feature_module_standard.requirement, "full_adoption_all_production_modules");
  assert.equal(payment.docs_protocol.admission_status, "pending_classification");
  assert.ok(!inventory.repositories.some(record => record.repository === payment.inventory.repository));
  assert.equal(inventory.observed_at, "2026-09-16"); assert.equal(ledger.snapshot_date, "2026-08-17");
  // Exercise the real retained entrypoint with its original semantic validators,
  // rather than claiming the isolated callback fixtures replace their invariants.
  assert.match(execFileSync(process.execPath, ["scripts/validate-governance.mjs"], { encoding: "utf8", timeout: 30_000 }), /Governance verified:/u);
});

test("registration rejects identity collisions, duplicate records and duplicated source coordinates", () => {
  const existing = inventory.repositories[0]; assert.ok(existing);
  const mutations: ((value: RegistrationScope) => void)[] = [
    value => { first(value).inventory.id = existing.id; },
    value => { value.repositories.push(structuredClone(first(value))); },
    value => { const record = first(value), entry = record.source_change.entries[0]; assert.ok(entry);
      record.source_change.entries.push({ ...entry, git_blob_sha: "a".repeat(40) }); },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(registrations); mutate(changed);
    assert.throws(() => validateRepositoryRegistrationSupplements(changed, registrationSchema, registrationContext), /collides|uniquely cover/u);
  }
});

test("registration cannot promote maturity, qualification, Docs admission or FMS conformance without a new proof contract", () => {
  const mutations: ((value: RepositoryRegistration) => void)[] = [
    value => { value.executable_specification.specification_maturity = "implemented_internal_slice"; },
    value => { value.executable_specification.implementation_qualification = "partially_qualified_internal_slice"; },
    value => { value.executable_specification.accepted_revision = "a".repeat(40); },
    value => { value.docs_protocol.admission_status = "admitted"; },
    value => { value.feature_module_standard.qualification_status = "qualified"; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(registrations); mutate(first(changed));
    assert.throws(() => validateRepositoryRegistrationSupplements(changed, registrationSchema, registrationContext), /JSON Schema|must remain pending/u);
  }
});

test("registration rejects stale authority basis, pre-creation observations and cross-repository source spoofing", () => {
  const mutations: ((value: RegistrationScope) => void)[] = [
    value => { value.complete_inventory_snapshot_revision = "2026-08-17.1"; },
    value => { first(value).observed_at = "2026-10-18T00:00:00Z"; },
    value => { first(value).observed_at = "2099-01-01T00:00:00Z"; },
    value => { first(value).metadata_endpoint = "https://api.github.com/repos/agent-teams-ai/another"; },
    value => { first(value).source_change.pull_request_url = "https://github.com/agent-teams-ai/another/pull/10"; },
    value => { first(value).source_change.observed_head = "a".repeat(40); },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(registrations); mutate(changed);
    assert.throws(() => validateRepositoryRegistrationSupplements(changed, registrationSchema, registrationContext), /exact historical|dated after creation|exact registered|same immutable source/u);
  }
});

test("registration JSON rejects duplicate keys before schema or status interpretation", () => {
  for (const source of ['{"registration_revision":"2026-10-23.1","registration_revision":"2026-10-24.1"}', '{"record":{"id":1,"id":2}}']) {
    assert.throws(() => parseRepositoryRegistrationJson(source), /duplicate record keys/u);
  }
});

test("typed registration delegates each historical semantic validator and preserves the independent snapshots", async () => {
  const calls: string[] = [], before = structuredClone(registrationContext);
  const reader = createRepositoryRegistrationReader({
    inventory: (value, schema) => { calls.push("inventory"); validators.inventory(value, schema); },
    ledger: (value, schema) => { calls.push("ledger"); validators.ledger(value, schema); },
    docs: (value, schema) => { calls.push("docs"); validators.docs(value, schema); },
  });
  const scope = await reader.loadRepositoryRegistrationScope({ inventory, ledger, docsProtocol });
  assert.deepEqual(calls, ["inventory", "ledger", "docs", "docs"]);
  const view = projectRepositoryRegistrations(inventory, docsProtocol, scope);
  assert.equal(view.inventoryRecords.length, inventory.repositories.length + 1);
  assert.equal(view.docsRecords.length, docsProtocol.repositories.length + 1);
  assert.deepEqual(registrationContext, before);
});

test("historical Docs records may omit classification evidence without the projection inventing it", () => {
  const historical = structuredClone(docsProtocol);
  const controller = historical.repositories.find(record => record.repository === "agent-teams-ai/.github");
  assert.ok(controller);
  delete controller.classification_evidence;
  const validated = validateSchema<DocsSnapshot>(historical, docsProtocolSchema, "Historical Docs");
  const projected = projectRepositoryRegistrations(inventory, validated, registrations);
  const retained = projected.docsRecords.find(record => record.repository === controller.repository);
  assert.ok(retained);
  assert.equal(Object.hasOwn(retained, "classification_evidence"), false);
  assert.equal(retained.classification_evidence, undefined);
});

test("the shared synchronous schema boundary rejects invalid data and asynchronous schema claims", () => {
  const schema = { type: "object", properties: { id: { type: "number" } }, required: ["id"], additionalProperties: false };
  assert.deepEqual(validateSchema<{ id: number }>({ id: 1 }, schema, "Fixture"), { id: 1 });
  assert.throws(() => validateSchema({ id: "1" }, schema, "Fixture"), /Fixture does not satisfy its JSON Schema/u);
  assert.throws(() => validateSchema({}, { $async: true, ...schema }, "Fixture"), /must validate synchronously/u);
});
