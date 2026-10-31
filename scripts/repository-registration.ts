import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { validateSchema } from "./governance-schema.ts";

type Data = Record<string, unknown>;
export interface InventoryRepository extends Data {
  repository: string;
  id: number;
  created_at: string;
  archived: boolean;
  visibility: string;
  default_branch: string;
  is_fork: boolean;
  fork_parent: string | null;
}
export interface InventorySnapshot extends Data {
  snapshot_revision: string;
  observed_at: string;
  repositories: InventoryRepository[];
}
export interface LedgerSnapshot extends Data {
  ledger_revision: string;
  snapshot_date: string;
  repositories: { repository: string; repository_id: number }[];
}
export interface DocsRepository extends Data {
  repository: string;
  repository_id: number;
  governance_ownership: string;
  repository_lifecycle: string;
  docs_role: string;
  admission_status: string;
  source_provenance: { kind: string; parent_repository: string | null };
  classification_evidence?: {
    decision: string;
    observed_revision: string;
    evidence_paths: string[];
  } | null;
}
export interface DocsSnapshot extends Data {
  snapshot_revision: string;
  admission: Data & { expected_repository_count: number; owned_repository_count: number };
  repositories: DocsRepository[];
}
export interface RepositoryRegistration extends Data {
  inventory: InventoryRepository;
  owner_reference: string;
  observed_at: string;
  metadata_endpoint: string;
  source_change: {
    repository: string;
    pull_request_number: number;
    pull_request_url: string;
    observed_head: string;
    entries: { path: string; git_blob_sha: string }[];
  };
  executable_specification: Data;
  docs_protocol: DocsRepository;
  feature_module_standard: Data & { profile_path: string; adoption_decision_path: string };
}
export interface RegistrationScope extends Data {
  registration_revision: string;
  observation_scope: string;
  complete_inventory_snapshot_revision: string;
  historical_executable_ledger_revision: string;
  docs_policy_snapshot_revision: string;
  repositories: RepositoryRegistration[];
}
export interface RegistrationBaseContext {
  inventory: InventorySnapshot;
  ledger: LedgerSnapshot;
  docsProtocol: DocsSnapshot;
  asOf?: string;
}
export interface RegistrationContext extends RegistrationBaseContext {
  inventorySchema: unknown;
  docsProtocolSchema: unknown;
}
export interface HistoricalPolicyValidators {
  inventory: (value: unknown, schema: unknown) => void;
  ledger: (value: unknown, schema: unknown) => void;
  docs: (value: unknown, schema: unknown) => void;
}

const loadJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8")) as unknown;
const canonicalPath = (path: string): boolean => {
  for (const character of path) {
    const point = character.codePointAt(0);
    if (point !== undefined && (point <= 0x1f || point === 0x7f)) {
      return false;
    }
  }
  return (
    path === path.normalize("NFC") &&
    !path.includes("\\") &&
    !path.includes(":") &&
    !path.startsWith("/") &&
    path.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
};

export function parseRepositoryRegistrationJson(source: string): unknown {
  assert.ok(
    Buffer.byteLength(source) <= 1024 * 1024,
    "Registration supplement exceeds its bounded JSON size.",
  );
  const value: unknown = JSON.parse(source);
  const document = parseDocument(source, { uniqueKeys: true });
  assert.equal(
    document.errors.length,
    0,
    "Registration supplement JSON must not contain duplicate record keys.",
  );
  return value;
}

export function projectRepositoryRegistrations<I, D>(
  inventory: { repositories: readonly I[] },
  docs: { repositories: readonly D[] },
  registrations?: { repositories: readonly { inventory: I; docs_protocol: D }[] },
): { inventoryRecords: I[]; docsRecords: D[] } {
  return {
    inventoryRecords: [
      ...inventory.repositories,
      ...(registrations?.repositories.map((record) => record.inventory) ?? []),
    ],
    docsRecords: [
      ...docs.repositories,
      ...(registrations?.repositories.map((record) => record.docs_protocol) ?? []),
    ],
  };
}

function validateRegistrations(
  value: unknown,
  schema: unknown,
  context: RegistrationContext,
  validateDocs: HistoricalPolicyValidators["docs"],
): RegistrationScope {
  const { inventory, ledger, docsProtocol, inventorySchema, docsProtocolSchema } = context;
  const registrations = validateSchema<RegistrationScope>(
    value,
    schema,
    "Repository registration supplements",
    [inventorySchema, docsProtocolSchema],
  );
  assert.ok(
    registrations.complete_inventory_snapshot_revision === inventory.snapshot_revision &&
      registrations.historical_executable_ledger_revision === ledger.ledger_revision &&
      registrations.docs_policy_snapshot_revision === docsProtocol.snapshot_revision,
    "Registration supplement must bind the exact historical inventory, ledger and Docs policy basis.",
  );
  const names = new Set(inventory.repositories.map((record) => record.repository));
  const ids = new Set(inventory.repositories.map((record) => record.id));
  const ledgerNames = new Set(ledger.repositories.map((record) => record.repository));
  const ledgerIds = new Set(ledger.repositories.map((record) => record.repository_id));
  const docsNames = new Set(docsProtocol.repositories.map((record) => record.repository));
  const docsIds = new Set(docsProtocol.repositories.map((record) => record.repository_id));
  let latestObservation = "";
  for (const registration of registrations.repositories) {
    const record = registration.inventory,
      source = registration.source_change;
    const docs = registration.docs_protocol,
      fms = registration.feature_module_standard;
    assert.match(
      record.repository,
      /^agent-teams-ai\/[A-Za-z0-9_.-]+$/u,
      "Registration repository must be one canonical GitHub organization/repository identity.",
    );
    assert.ok(
      !names.has(record.repository) &&
        !ids.has(record.id) &&
        !ledgerNames.has(record.repository) &&
        !ledgerIds.has(record.id) &&
        !docsNames.has(record.repository) &&
        !docsIds.has(record.id),
      "Registration supplement identity collides with another registration or historical authority.",
    );
    names.add(record.repository);
    ids.add(record.id);
    assert.ok(
      !record.archived && !record.is_fork && record.fork_parent === null,
      "Pending registration v1 supports active owned original repositories only.",
    );
    assert.ok(
      Number.isFinite(Date.parse(registration.observed_at)) &&
        new Date(registration.observed_at).toISOString() ===
          registration.observed_at.replace(/Z$/u, ".000Z") &&
        Number.isFinite(Date.parse(record.created_at)) &&
        new Date(record.created_at).toISOString() === record.created_at.replace(/Z$/u, ".000Z") &&
        record.created_at <= registration.observed_at &&
        record.created_at.slice(0, 10) > ledger.snapshot_date &&
        registration.observed_at.slice(0, 10) >= inventory.observed_at &&
        registration.observed_at <= (context.asOf ?? new Date().toISOString()),
      "Registration observation must be valid, dated after creation and outside the historical ledger snapshot, never in the future.",
    );
    latestObservation =
      [latestObservation, registration.observed_at.slice(0, 10)].toSorted().at(-1) ?? "";
    assert.ok(
      registration.metadata_endpoint === `https://api.github.com/repos/${record.repository}` &&
        source.repository === record.repository &&
        source.pull_request_url ===
          `https://github.com/${record.repository}/pull/${source.pull_request_number}`,
      "Registration metadata and source change must belong to the exact registered repository.",
    );
    const paths = source.entries.map((entry) => entry.path);
    assert.ok(
      new Set(paths).size === paths.length &&
        paths.every(canonicalPath) &&
        [
          "AGENTS.md",
          "README.md",
          "package.json",
          fms.profile_path,
          fms.adoption_decision_path,
        ].every((path) => paths.includes(path)),
      "Registration source coordinates must uniquely cover owner routes, package, FMS profile and adoption decision.",
    );
    assert.ok(
      docs.repository === record.repository &&
        docs.repository_id === record.id &&
        docs.governance_ownership === "organization_owned" &&
        docs.repository_lifecycle === "active" &&
        docs.source_provenance.kind === "original" &&
        docs.source_provenance.parent_repository === null &&
        docs.docs_role === "pending_classification" &&
        docs.admission_status === "pending_classification" &&
        docs.classification_evidence?.decision === "pending_onboarding" &&
        docs.classification_evidence.observed_revision === source.observed_head &&
        docs.classification_evidence.evidence_paths.every((path) => paths.includes(path)),
      "Registration Docs classification must remain pending and bind the same immutable source observation.",
    );
  }
  assert.ok(
    registrations.registration_revision.startsWith(`${latestObservation}.`),
    "Registration revision date must match its latest individual observation; it is not a census date.",
  );
  const { docsRecords } = projectRepositoryRegistrations(inventory, docsProtocol, registrations);
  validateDocs(
    {
      ...docsProtocol,
      admission: {
        ...docsProtocol.admission,
        expected_repository_count:
          docsProtocol.admission.expected_repository_count + registrations.repositories.length,
        owned_repository_count:
          docsProtocol.admission.owned_repository_count + registrations.repositories.length,
      },
      repositories: docsRecords,
    },
    docsProtocolSchema,
  );
  return registrations;
}

// The retained semantic validators remain their owners. Only this narrow binding
// crosses the legacy entrypoint; no consumer code or configurable command enters it.
export function createRepositoryRegistrationReader(validators: HistoricalPolicyValidators): {
  validateRepositoryRegistrationSupplements: (
    value: unknown,
    schema: unknown,
    context: RegistrationContext,
  ) => RegistrationScope;
  loadRepositoryRegistrationScope: (context: RegistrationBaseContext) => Promise<RegistrationScope>;
} {
  return {
    validateRepositoryRegistrationSupplements: (value, schema, context) =>
      validateRegistrations(value, schema, context, validators.docs),
    loadRepositoryRegistrationScope: async (context) => {
      const [source, schema, inventorySchema, docsProtocolSchema, ledgerSchema] = await Promise.all(
        [
          readFile("governance/repository-registration-supplements.json", "utf8"),
          loadJson("governance/repository-registration-supplements.schema.json"),
          loadJson("governance/organization-repository-inventory.schema.json"),
          loadJson("governance/docs-protocol-policy-v2.schema.json"),
          loadJson("governance/executable-spec-qualification.schema.json"),
        ],
      );
      validators.inventory(context.inventory, inventorySchema);
      validators.ledger(context.ledger, ledgerSchema);
      validators.docs(context.docsProtocol, docsProtocolSchema);
      return validateRegistrations(
        parseRepositoryRegistrationJson(source),
        schema,
        { ...context, inventorySchema, docsProtocolSchema },
        validators.docs,
      );
    },
  };
}
