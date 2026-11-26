import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateSchema } from "./governance-schema.ts";
import {
  createRepositoryRegistrationReader,
  parseRepositoryRegistrationJson,
  projectCurrentRepositoryInventory,
  projectRepositoryRegistrations,
} from "./repository-registration.ts";
import type {
  DocsSnapshot,
  HistoricalPolicyValidators,
  InventorySnapshot,
  LedgerSnapshot,
  RegistrationContext,
  RegistrationScope,
  RepositoryRegistration,
} from "./repository-registration.ts";

const loadJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8")) as unknown;
const inventorySchema = await loadJson("governance/organization-repository-inventory.schema.json");
const ledgerSchema = await loadJson("governance/executable-spec-qualification.schema.json");
const docsProtocolSchema = await loadJson("governance/docs-protocol-policy-v2.schema.json");
const registrationSchema = await loadJson(
  "governance/repository-registration-supplements.schema.json",
);
const inventory = validateSchema<InventorySnapshot>(
  await loadJson("governance/organization-repository-inventory.json"),
  inventorySchema,
  "Inventory",
);
const ledger = validateSchema<LedgerSnapshot>(
  await loadJson("governance/executable-spec-qualification.json"),
  ledgerSchema,
  "Ledger",
);
const docsProtocol = validateSchema<DocsSnapshot>(
  await loadJson("governance/docs-protocol-policy-v2.json"),
  docsProtocolSchema,
  "Docs",
);
const registrations = validateSchema<RegistrationScope>(
  await loadJson("governance/repository-registration-supplements.json"),
  registrationSchema,
  "Registrations",
  [inventorySchema, docsProtocolSchema],
);
const registrationContext: RegistrationContext = {
  inventory,
  ledger,
  docsProtocol,
  inventorySchema,
  docsProtocolSchema,
};
const validators: HistoricalPolicyValidators = {
  inventory: (value, schema) => {
    validateSchema(value, schema, "Inventory");
  },
  ledger: (value, schema) => {
    validateSchema(value, schema, "Ledger");
  },
  docs: (value, schema) => {
    validateSchema(value, schema, "Docs");
  },
};
const { validateRepositoryRegistrationSupplements, loadRepositoryRegistrationScope } =
  createRepositoryRegistrationReader(validators);
const first = (scope: RegistrationScope): RepositoryRegistration => {
  const value = scope.repositories[0];
  assert.ok(value);
  return value;
};

void test("pending Payments registration reconciles ownership without rewriting a historical census or qualification", async () => {
  const scope = await loadRepositoryRegistrationScope({ inventory, ledger, docsProtocol });
  const payment = scope.repositories.find(
    (record) => record.inventory.repository === "agent-teams-ai/payments-sdk",
  );
  assert.ok(payment);
  assert.equal(payment.owner_reference, "https://github.com/777genius");
  assert.equal(payment.executable_specification.specification_maturity, "not_assessed");
  assert.equal(payment.executable_specification.implementation_qualification, "not_qualified");
  assert.equal(payment.feature_module_standard.requirement, "full_adoption_all_production_modules");
  assert.equal(payment.docs_protocol.admission_status, "pending_classification");
  assert.ok(
    !inventory.repositories.some((record) => record.repository === payment.inventory.repository),
  );
  assert.equal(inventory.observed_at, "2026-09-16");
  assert.equal(ledger.snapshot_date, "2026-08-17");
  // Exercise the real retained entrypoint with its original semantic validators,
  // rather than claiming the isolated callback fixtures replace their invariants.
  assert.match(
    execFileSync(process.execPath, ["scripts/validate-governance.mjs"], {
      encoding: "utf8",
      timeout: 30_000,
    }),
    /Governance verified:/u,
  );
});

void test("registration rejects identity collisions, duplicate records and duplicated source coordinates", () => {
  const existing = inventory.repositories[0];
  assert.ok(existing);
  const mutations: ((value: RegistrationScope) => void)[] = [
    (value) => {
      first(value).inventory.id = existing.id;
    },
    (value) => {
      value.repositories.push(structuredClone(first(value)));
    },
    (value) => {
      const record = first(value),
        entry = record.source_change.entries[0];
      assert.ok(entry);
      record.source_change.entries.push({ ...entry, git_blob_sha: "a".repeat(40) });
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(registrations);
    mutate(changed);
    assert.throws(
      () =>
        validateRepositoryRegistrationSupplements(changed, registrationSchema, registrationContext),
      /collides|uniquely cover/u,
    );
  }
});

void test("registration cannot promote maturity, qualification, Docs admission or FMS conformance without a new proof contract", () => {
  const mutations: ((value: RepositoryRegistration) => void)[] = [
    (value) => {
      value.executable_specification.specification_maturity = "implemented_internal_slice";
    },
    (value) => {
      value.executable_specification.implementation_qualification =
        "partially_qualified_internal_slice";
    },
    (value) => {
      value.executable_specification.accepted_revision = "a".repeat(40);
    },
    (value) => {
      value.docs_protocol.admission_status = "admitted";
    },
    (value) => {
      value.feature_module_standard.qualification_status = "qualified";
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(registrations);
    mutate(first(changed));
    assert.throws(
      () =>
        validateRepositoryRegistrationSupplements(changed, registrationSchema, registrationContext),
      /JSON Schema|must remain pending/u,
    );
  }
});

void test("registration rejects stale authority basis, pre-creation observations and cross-repository source spoofing", () => {
  const mutations: ((value: RegistrationScope) => void)[] = [
    (value) => {
      value.complete_inventory_snapshot_revision = "2026-08-17.1";
    },
    (value) => {
      first(value).observed_at = "2026-10-18T00:00:00Z";
    },
    (value) => {
      first(value).observed_at = "2099-01-01T00:00:00Z";
    },
    (value) => {
      first(value).metadata_endpoint = "https://api.github.com/repos/agent-teams-ai/another";
    },
    (value) => {
      first(value).source_change.pull_request_url =
        "https://github.com/agent-teams-ai/another/pull/10";
    },
    (value) => {
      first(value).source_change.observed_head = "a".repeat(40);
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(registrations);
    mutate(changed);
    assert.throws(
      () =>
        validateRepositoryRegistrationSupplements(changed, registrationSchema, registrationContext),
      /exact historical|dated after creation|exact registered|same immutable source/u,
    );
  }
});

void test("registration JSON rejects duplicate keys before schema or status interpretation", () => {
  for (const source of [
    '{"registration_revision":"2026-10-23.1","registration_revision":"2026-10-24.1"}',
    '{"record":{"id":1,"id":2}}',
  ]) {
    assert.throws(() => parseRepositoryRegistrationJson(source), /duplicate record keys/u);
  }
});

void test("typed registration delegates each historical semantic validator and preserves the independent snapshots", async () => {
  const calls: string[] = [],
    before = structuredClone(registrationContext);
  const reader = createRepositoryRegistrationReader({
    inventory: (value, schema) => {
      calls.push("inventory");
      validators.inventory(value, schema);
    },
    ledger: (value, schema) => {
      calls.push("ledger");
      validators.ledger(value, schema);
    },
    docs: (value, schema) => {
      calls.push("docs");
      validators.docs(value, schema);
    },
  });
  const scope = await reader.loadRepositoryRegistrationScope({ inventory, ledger, docsProtocol });
  assert.deepEqual(calls, ["inventory", "ledger", "docs", "docs"]);
  const view = projectRepositoryRegistrations(inventory, docsProtocol, scope);
  assert.equal(view.inventoryRecords.length, inventory.repositories.length + 1);
  assert.equal(view.docsRecords.length, docsProtocol.repositories.length + 1);
  assert.deepEqual(registrationContext, before);
});

void test("historical Docs records may omit classification evidence without the projection inventing it", () => {
  const historical = structuredClone(docsProtocol);
  const controller = historical.repositories.find(
    (record) => record.repository === "agent-teams-ai/.github",
  );
  assert.ok(controller);
  delete controller.classification_evidence;
  const validated = validateSchema<DocsSnapshot>(historical, docsProtocolSchema, "Historical Docs");
  const projected = projectRepositoryRegistrations(inventory, validated, registrations);
  const retained = projected.docsRecords.find(
    (record) => record.repository === controller.repository,
  );
  assert.ok(retained);
  assert.equal(Object.hasOwn(retained, "classification_evidence"), false);
  assert.equal(retained.classification_evidence, undefined);
});

void test("current retirement projection preserves historical inputs and pending Payments registration", () => {
  const historical = structuredClone(inventory);
  const policy = structuredClone(docsProtocol);
  const supplement = structuredClone(registrations);
  const canary = policy.repositories.find(
    (record) => record.repository === "agent-teams-ai/docs-protocol-canary-20260817",
  );
  assert.ok(canary);
  canary.repository_lifecycle = "deleted";
  const before = structuredClone({ historical, policy, supplement });
  const view = projectRepositoryRegistrations(historical, policy, supplement);
  const current = projectCurrentRepositoryInventory(view.inventoryRecords, view.docsRecords);
  assert.equal(view.inventoryRecords.length, inventory.repositories.length + 1);
  assert.equal(current.length, inventory.repositories.length);
  assert.ok(
    view.inventoryRecords.some(
      (record) => record.repository === "agent-teams-ai/docs-protocol-canary-20260817",
    ),
  );
  assert.ok(
    !current.some((record) => record.repository === "agent-teams-ai/docs-protocol-canary-20260817"),
  );
  const payment = current.find((record) => record.repository === "agent-teams-ai/payments-sdk");
  assert.ok(payment);
  assert.strictEqual(payment, first(supplement).inventory);
  assert.equal(
    first(supplement).feature_module_standard.requirement,
    "full_adoption_all_production_modules",
  );
  assert.deepEqual({ historical, policy, supplement }, before);
  assert.notStrictEqual(current, view.inventoryRecords);
});

void test("current retirement requires both exact identity fields and an explicit deleted lifecycle", () => {
  const records = [{ repository: "agent-teams-ai/current", id: 1, archived: false }];
  const tombstone = {
    repository: "agent-teams-ai/current",
    repository_id: 1,
    repository_lifecycle: "deleted",
  };
  assert.deepEqual(projectCurrentRepositoryInventory(records, [tombstone]), []);
  for (const docs of [
    [],
    [{ ...tombstone, repository_id: 2 }],
    [{ ...tombstone, repository: "agent-teams-ai/another" }],
    [{ ...tombstone, repository_lifecycle: "active" }],
    [{ ...tombstone, repository_lifecycle: "archived" }],
    [{ ...tombstone, repository_lifecycle: "transferred" }],
  ]) {
    assert.deepEqual(projectCurrentRepositoryInventory(records, docs), records);
  }
  const archived = [{ repository: "agent-teams-ai/current", id: 1, archived: true }];
  assert.deepEqual(projectCurrentRepositoryInventory(archived, [tombstone]), archived);
});

void test("current retirement cannot remove a different ID that reuses a historical name", () => {
  const records = [{ repository: "agent-teams-ai/recreated", id: 2, archived: false }];
  const policy = [
    {
      repository: "agent-teams-ai/recreated",
      repository_id: 1,
      repository_lifecycle: "deleted",
    },
    {
      repository: "agent-teams-ai/recreated",
      repository_id: 2,
      repository_lifecycle: "active",
    },
  ];
  assert.deepEqual(projectCurrentRepositoryInventory(records, policy), records);
});

void test("current retirement refuses ambiguous or invalid identity inputs instead of masking them", () => {
  const record = { repository: "agent-teams-ai/current", id: 1, archived: false };
  const tombstone = {
    repository: "agent-teams-ai/current",
    repository_id: 1,
    repository_lifecycle: "deleted",
  };
  for (const records of [
    [record, { ...record }],
    [record, { ...record, repository: "agent-teams-ai/another" }],
    [record, { ...record, id: 2 }],
    [{ ...record, id: 0 }],
    [{ ...record, id: Number.NaN }],
    [{ ...record, repository: "" }],
  ]) {
    assert.throws(
      () => projectCurrentRepositoryInventory(records, [tombstone]),
      /unambiguous inventory identities/u,
    );
  }
  for (const policy of [
    [tombstone, { ...tombstone }],
    [tombstone, { ...tombstone, repository_lifecycle: "active" }],
    [tombstone, { ...tombstone, repository: "agent-teams-ai/another" }],
    [
      { ...tombstone, repository_lifecycle: "active" },
      { ...tombstone, repository_id: 2, repository_lifecycle: "active" },
    ],
    [{ ...tombstone, repository_id: 0 }],
    [{ ...tombstone, repository_id: Number.NaN }],
    [{ ...tombstone, repository: "" }],
    [{ ...tombstone, repository_lifecycle: "unknown" }],
  ]) {
    assert.throws(
      () => projectCurrentRepositoryInventory([record], policy),
      /unambiguous Docs identities and lifecycle/u,
    );
  }
});

void test("current retirement retains real historical guards, live drift rejection and full-fleet admission", () => {
  // This JavaScript fixture executes the retained .mjs runtime boundary. Its
  // successful execution does not claim strict type coverage of those modules.
  const source = String.raw`
    import assert from "node:assert/strict";
    import { readFile } from "node:fs/promises";
    import {
      loadJson, loadRepositoryRegistrationScope, validateDocsProtocolPolicy,
      validateGovernanceReferences, validateOrganizationRepositoryInventory,
    } from "./scripts/governance-policy.mjs";
    import { assertRepositoryInventoryCurrent } from "./scripts/observe-org-repository-inventory.mjs";
    import { currentAdmissionScope } from "./scripts/verify-docs-cohort-evidence.mjs";
    import { POLICY_PATH } from "./scripts/docs-legacy-admission-recovery.mjs";
    const paths = ["organization-repository-inventory", "executable-spec-qualification",
      "code-security-defaults", "actions-policy", "docs-protocol-policy-v2"]
      .map((name) => "governance/" + name + ".json");
    const bytes = await Promise.all(paths.map((path) => readFile(path)));
    const [inventory, ledger, security, actions, recordedPolicy] = bytes.map((value) => JSON.parse(value.toString("utf8")));
    const basePolicy = structuredClone(recordedPolicy);
    const canaryName = "agent-teams-ai/docs-protocol-canary-20260817";
    const prior = basePolicy.repositories.find((record) => record.repository === canaryName);
    assert.equal(prior.repository_id, 1336577313);
    assert.ok(["active", "deleted"].includes(prior.repository_lifecycle));
    // Keep this transition fixture usable after the actual data-only retirement.
    if (prior.repository_lifecycle === "deleted") {
      prior.repository_lifecycle = "active";
      basePolicy.admission.expected_repository_count += 1;
      basePolicy.admission.owned_repository_count += 1;
    }
    const policySchema = await loadJson("governance/docs-protocol-policy-v2.schema.json");
    validateOrganizationRepositoryInventory(inventory,
      await loadJson("governance/organization-repository-inventory.schema.json"));
    validateDocsProtocolPolicy(basePolicy, policySchema);
    const registrations = await loadRepositoryRegistrationScope({ inventory, ledger, docsProtocol: basePolicy });
    const originals = structuredClone({ inventory, ledger, security, actions, basePolicy, registrations });
    const policy = structuredClone(basePolicy);
    const canary = policy.repositories.find((record) => record.repository === canaryName);
    assert.equal(canary.repository_id, 1336577313);
    canary.repository_lifecycle = "deleted";
    policy.admission.expected_repository_count -= 1;
    policy.admission.owned_repository_count -= 1;
    validateDocsProtocolPolicy(policy, policySchema);
    const verify = (docs = policy, historical = inventory, specification = ledger, defaults = security) =>
      validateGovernanceReferences(specification, defaults, actions, historical, docs, registrations);
    verify();
    assert.equal(currentAdmissionScope(policy, basePolicy, [POLICY_PATH]), null);
    for (const change of [
      (docs) => { docs.repositories = docs.repositories.filter((record) => record.repository !== canaryName); },
      (docs) => { docs.repositories.find((record) => record.repository === canaryName).repository_id += 1; },
      (docs) => { docs.repositories.find((record) => record.repository === canaryName).repository = "agent-teams-ai/another"; },
      (docs) => { docs.repositories.find((record) => record.repository === canaryName).repository_lifecycle = "archived"; },
      (docs) => { docs.repositories.find((record) => record.repository === canaryName).repository_lifecycle = "transferred"; },
    ]) {
      const changed = structuredClone(policy);
      change(changed);
      assert.throws(() => verify(changed), /documentation protocol identity must match the active inventory/u);
    }
    const changedLedger = structuredClone(ledger);
    changedLedger.repositories.find((record) => record.repository === canaryName).repository_id += 1;
    assert.throws(() => verify(policy, inventory, changedLedger), /active ledger identity/u);
    const changedSecurity = structuredClone(security);
    assert.equal(changedSecurity.repository_attachments[0].visibility, "private");
    changedSecurity.repository_attachments[0].visibility = "public";
    assert.throws(() => verify(policy, inventory, ledger, changedSecurity), /security attachment identity/u);
    const declared = [...inventory.repositories, ...registrations.repositories.map((record) => record.inventory)];
    const liveRow = ({ repository, is_fork, ...record }) => ({ ...record, full_name: repository, fork: is_fork });
    const live = declared.filter((record) => record.id !== 1336577313).map(liveRow);
    assert.deepEqual(assertRepositoryInventoryCurrent(live, inventory, policy, registrations), {
      missingFromSnapshot: [], absentFromOrganization: [], structuralChanges: [], missingClassification: [],
    });
    const retired = liveRow(declared.find((record) => record.id === 1336577313));
    for (const present of [retired, { ...retired, id: 2000000017 }]) {
      assert.throws(() => assertRepositoryInventoryCurrent([...live, present], inventory, policy, registrations),
        /Organization repository inventory drift detected/u);
    }
    assert.deepEqual({ inventory, ledger, security, actions, basePolicy, registrations }, originals);
    assert.deepEqual(await Promise.all(paths.map((path) => readFile(path))), bytes);
    process.stdout.write("current-retirement-boundaries:PASS\n");
  `;
  assert.match(
    execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", source, "repository-retirement-fixture.mjs"],
      {
        encoding: "utf8",
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      },
    ),
    /^Organization defaults verified: [1-9][0-9]* files\ncurrent-retirement-boundaries:PASS\n$/u,
  );
});

void test("the shared synchronous schema boundary rejects invalid data and asynchronous schema claims", () => {
  const schema = {
    type: "object",
    properties: { id: { type: "number" } },
    required: ["id"],
    additionalProperties: false,
  };
  assert.deepEqual(validateSchema<{ id: number }>({ id: 1 }, schema, "Fixture"), { id: 1 });
  assert.throws(
    () => validateSchema({ id: "1" }, schema, "Fixture"),
    /Fixture does not satisfy its JSON Schema/u,
  );
  assert.throws(
    () => validateSchema({}, { $async: true, ...schema }, "Fixture"),
    /must validate synchronously/u,
  );
});
