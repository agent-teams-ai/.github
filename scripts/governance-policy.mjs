import { readFile } from "node:fs/promises";

const LEDGER_KEYS = [
  "$schema",
  "schema_version",
  "snapshot_date",
  "authority",
  "remote_enforcement",
  "repositories",
];
const REPOSITORY_KEYS = [
  "repository",
  "applicability",
  "specification_maturity",
  "specification_scope",
  "implementation_qualification",
  "deployment_qualification",
  "gate_contract",
];

const EXPECTED_REPOSITORIES = new Map(
  [
    [
      "agent-teams-ai/engineering-foundation",
      "capability_owner",
      "capability_implemented",
      "capability_only_not_product_qualified",
      "not_applicable",
      "pnpm check",
      ["pnpm foundation:check"],
      "not_attested",
      ["Generic development-only", "no product domain model"],
    ],
    [
      "agent-teams-ai/agent-runtime",
      "applicable",
      "synthetic_proposed",
      "not_qualified",
      "not_qualified",
      "pnpm check",
      ["pnpm architecture:operation-oracle"],
      "not_attested",
      ["Synthetic", "proposed", "not proof of production runtime binding"],
    ],
    [
      "agent-teams-ai/agent-teams-platform",
      "applicable",
      "implemented_internal_slice",
      "partially_qualified_internal_slice",
      "not_qualified",
      "pnpm check",
      [
        "pnpm spec:property",
        "pnpm spec:mutation",
        "pnpm spec:model",
        "pnpm spec:clean-checkout",
      ],
      "unavailable_free_private_repository",
      ["internal Project Management", "no public wire-contract", "whole-platform claim"],
    ],
    [
      "agent-teams-ai/agent-teams-orchestrator",
      "applicable",
      "accepted_partial_projections",
      "not_qualified",
      "not_qualified",
      "pnpm check",
      ["pnpm specs:check", "pnpm specs:test"],
      "not_attested",
      ["Accepted", "projections only", "full runtime binding", "outside the claim"],
    ],
    [
      "agent-teams-ai/.github",
      "governance_only",
      "governance_only",
      "not_applicable",
      "not_applicable",
      "pnpm check",
      ["pnpm governance:validate"],
      "not_attested",
      ["governance", "no product executable specification"],
    ],
    [
      "agent-teams-ai/craig-meeting-gateway",
      "not_applicable",
      "not_applicable",
      "not_applicable",
      "not_applicable",
      null,
      [],
      "not_applicable",
      ["N/A", "upstream-owned", "explicitly adopted"],
    ],
  ].map(
    ([repository, applicability, maturity, implementation, deployment, full, commands, remote, phrases]) => [
      repository,
      { applicability, maturity, implementation, deployment, full, commands, remote, phrases },
    ],
  ),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, path) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${path} must be an object.`);
}

function assertExactKeys(value, expected, path) {
  assertObject(value, path);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(JSON.stringify(actual) === JSON.stringify(wanted), `${path} has unexpected or missing fields.`);
}

function assertNonEmpty(value, path) {
  assert(typeof value === "string" && value.trim().length > 0, `${path} must be a non-empty string.`);
}

function assertQualification(value, expectedStatus, path) {
  assertExactKeys(value, ["status", "statement"], path);
  assert(value.status === expectedStatus, `${path}.status must be ${expectedStatus}.`);
  assertNonEmpty(value.statement, `${path}.statement`);
}

export function validateExecutableSpecLedger(ledger) {
  assertExactKeys(ledger, LEDGER_KEYS, "ledger");
  assert(ledger.$schema === "./executable-spec-qualification.schema.json", "Ledger schema reference is invalid.");
  assert(ledger.schema_version === 1, "Ledger schema_version must be 1.");
  assert(/^\d{4}-\d{2}-\d{2}$/u.test(ledger.snapshot_date), "Ledger snapshot_date must use YYYY-MM-DD.");
  assert(ledger.authority === "organization-policy", "Ledger authority is invalid.");
  assertExactKeys(ledger.remote_enforcement, ["attestation", "statement"], "ledger.remote_enforcement");
  assert(ledger.remote_enforcement.attestation === "not_provided", "Ledger must not claim remote enforcement.");
  assert(
    ledger.remote_enforcement.statement.includes("does not attest"),
    "Ledger must explicitly disclaim remote enforcement attestation.",
  );
  assert(Array.isArray(ledger.repositories), "ledger.repositories must be an array.");
  assert(ledger.repositories.length === EXPECTED_REPOSITORIES.size, "Ledger must contain exactly six repositories.");

  const seen = new Set();
  for (const record of ledger.repositories) {
    assertExactKeys(record, REPOSITORY_KEYS, "repository record");
    assert(!seen.has(record.repository), `Duplicate repository: ${record.repository}`);
    seen.add(record.repository);
    const expected = EXPECTED_REPOSITORIES.get(record.repository);
    assert(expected, `Unexpected repository: ${record.repository}`);
    assert(record.applicability === expected.applicability, `${record.repository} applicability is invalid.`);
    assert(record.specification_maturity === expected.maturity, `${record.repository} maturity is invalid.`);
    assertNonEmpty(record.specification_scope, `${record.repository}.specification_scope`);
    for (const phrase of expected.phrases) {
      assert(record.specification_scope.includes(phrase), `${record.repository} scope must preserve: ${phrase}`);
    }
    assertQualification(
      record.implementation_qualification,
      expected.implementation,
      `${record.repository}.implementation_qualification`,
    );
    assertQualification(
      record.deployment_qualification,
      expected.deployment,
      `${record.repository}.deployment_qualification`,
    );
    assertExactKeys(
      record.gate_contract,
      ["full_repository_command", "executable_spec_commands", "remote_required_check"],
      `${record.repository}.gate_contract`,
    );
    assert(record.gate_contract.full_repository_command === expected.full, `${record.repository} full gate is invalid.`);
    assert(
      JSON.stringify(record.gate_contract.executable_spec_commands) === JSON.stringify(expected.commands),
      `${record.repository} executable-spec gates are invalid.`,
    );
    assert(
      record.gate_contract.remote_required_check === expected.remote,
      `${record.repository} remote gate evidence is invalid.`,
    );
  }
}

const SECURITY_KEYS = [
  "schema_version",
  "observed_at",
  "organization",
  "defaults",
  "dependabot_policy",
  "transfer_policy",
  "required_check_exceptions",
];

export function validateCodeSecurityDefaults(policy) {
  assertExactKeys(policy, SECURITY_KEYS, "security policy");
  assert(policy.schema_version === 1, "Security policy schema_version must be 1.");
  assert(policy.organization === "agent-teams-ai", "Security policy organization is invalid.");
  assert(Array.isArray(policy.defaults) && policy.defaults.length === 2, "Security policy must contain two defaults.");
  const byId = new Map(policy.defaults.map((entry) => [entry.id, entry]));
  const publicDefault = byId.get(266049);
  const privateDefault = byId.get(266048);
  assert(publicDefault?.default_for_new_repositories === "public", "Configuration 266049 must target public repositories.");
  assert(privateDefault?.default_for_new_repositories === "private_and_internal", "Configuration 266048 must target private_and_internal repositories.");
  for (const entry of [publicDefault, privateDefault]) {
    assert(entry?.enforcement === "enforced", `Security configuration ${entry?.id ?? "missing"} must be enforced.`);
    assert(entry.dependency_graph === "enabled", `Security configuration ${entry.id} must enable dependency graph.`);
    assert(entry.dependabot_alerts === "enabled", `Security configuration ${entry.id} must enable Dependabot alerts.`);
    assert(entry.dependabot_security_updates === "enabled", `Security configuration ${entry.id} must enable security updates.`);
  }
  assert(policy.dependabot_policy?.scope === "security_updates_only", "Dependabot scope must remain security-only.");
  assert(policy.dependabot_policy?.routine_version_update_owner === "renovate", "Renovate must own routine updates.");
  assert(policy.transfer_policy?.automatic_default_application_assumed === false, "Transfers must fail closed to an explicit audit.");
  const platformException = policy.required_check_exceptions?.find(
    ({ repository }) => repository === "agent-teams-ai/agent-teams-platform",
  );
  assert(platformException, "The GitHub Free private Platform required-check exception is missing.");
  assert(platformException.reason.includes("GitHub Free"), "The Platform exception must identify the plan constraint.");
}

export async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
