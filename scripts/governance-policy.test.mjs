import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadJson,
  validateActionsPolicy,
  validateCodeSecurityDefaults,
  validateDocsProtocolPolicy,
  validateExecutableSpecLedger,
  validateGovernanceReferences,
  validateOrganizationRepositoryInventory,
} from "./governance-policy.mjs";

const inventory = await loadJson("governance/organization-repository-inventory.json");
const inventorySchema = await loadJson("governance/organization-repository-inventory.schema.json");
const ledger = await loadJson("governance/executable-spec-qualification.json");
const ledgerSchema = await loadJson("governance/executable-spec-qualification.schema.json");
const security = await loadJson("governance/code-security-defaults.json");
const securitySchema = await loadJson("governance/code-security-defaults.schema.json");
const actions = await loadJson("governance/actions-policy.json");
const actionsSchema = await loadJson("governance/actions-policy.schema.json");
const docsProtocol = await loadJson("governance/docs-protocol-policy.json");
const docsProtocolSchema = await loadJson("governance/docs-protocol-policy.schema.json");
const clone = (value) => structuredClone(value);
const qualifyDocsConsumer = (policy, repository = "agent-teams-ai/agent-runtime") => {
  const record = policy.repositories.find((candidate) => candidate.repository === repository);
  const revision = "a".repeat(40);
  record.admission_status = "admitted";
  record.exact_package_version = policy.protocol.qualified_package_version;
  record.profile_path = "docs/document-authoring.yaml";
  record.caller_workflow_path = ".github/workflows/docs-protocol.yml";
  record.reusable_workflow_revision = "b".repeat(40);
  record.qualification_evidence_path = "docs/docs-protocol-qualification.json";
  record.qualification = {
    status: "qualified",
    observed_revision: revision,
    evidence_paths: [
      "package.json",
      record.profile_path,
      record.caller_workflow_path,
      record.qualification_evidence_path,
    ],
  };
  return record;
};
const coordinateChecksum = (entries) => {
  const canonical = [...entries]
    .sort(({ path: left }, { path: right }) => (left < right ? -1 : left > right ? 1 : 0))
    .map(({ path, git_blob_sha: blob }) => `${path}\0${blob}\n`)
    .join("");
  return createHash("sha256").update(canonical).digest("hex");
};

test("accepts the authoritative dated organization repository inventory", () => {
  assert.doesNotThrow(() =>
    validateOrganizationRepositoryInventory(clone(inventory), inventorySchema));
});

test("rejects an internally inconsistent organization inventory entry", () => {
  const changed = clone(inventory);
  changed.repositories[0].id += 1;
  assert.throws(
    () => validateOrganizationRepositoryInventory(changed, inventorySchema),
    /Inventory internal checksum/u,
  );
});

test("accepts the authoritative documentation protocol admission policy", () => {
  assert.doesNotThrow(() => validateDocsProtocolPolicy(clone(docsProtocol), docsProtocolSchema));
});

test("rejects an omitted new owned repository even when policy self-counts are changed", () => {
  const changed = clone(docsProtocol);
  const index = changed.repositories.findIndex(
    ({ repository }) => repository === "agent-teams-ai/extension-foundation",
  );
  changed.repositories.splice(index, 1);
  changed.admission.expected_repository_count -= 1;
  changed.admission.owned_repository_count -= 1;
  assert.throws(
    () => validateGovernanceReferences(
      clone(ledger), clone(security), clone(actions), clone(inventory), changed,
    ),
    /documentation protocol identity must match/u,
  );
});

test("rejects fake documentation protocol qualification without complete evidence", () => {
  const changed = clone(docsProtocol);
  const runtime = changed.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/agent-runtime",
  );
  runtime.admission_status = "admitted";
  runtime.qualification.status = "qualified";
  runtime.exact_package_version = "1.0.0";
  assert.throws(
    () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
    /qualified admission requires bound package/u,
  );
});

test("accepts a fully bound documentation protocol consumer qualification", () => {
  const changed = clone(docsProtocol);
  qualifyDocsConsumer(changed);
  assert.doesNotThrow(() => validateDocsProtocolPolicy(changed, docsProtocolSchema));
});

test("rejects a consumer qualification with a fake package version", () => {
  const changed = clone(docsProtocol);
  const runtime = qualifyDocsConsumer(changed);
  runtime.exact_package_version = "9.9.9";
  assert.throws(
    () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
    /qualified admission requires bound package/u,
  );
});

test("rejects zero consumer and reusable-workflow revisions independently", () => {
  for (const axis of ["consumer", "reusable"]) {
    const changed = clone(docsProtocol);
    const runtime = qualifyDocsConsumer(changed);
    if (axis === "consumer") {
      runtime.qualification.observed_revision = "0".repeat(40);
    } else {
      runtime.reusable_workflow_revision = "0".repeat(40);
    }
    assert.throws(
      () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
      /qualified admission requires bound package/u,
    );
  }
});

test("keeps the consumer revision separate from the reusable workflow target revision", () => {
  const changed = clone(docsProtocol);
  const runtime = qualifyDocsConsumer(changed);
  assert.notEqual(runtime.qualification.observed_revision, runtime.reusable_workflow_revision);
  assert.doesNotThrow(() => validateDocsProtocolPolicy(changed, docsProtocolSchema));
});

test("rejects overlapping documentation admission paths", () => {
  const changed = clone(docsProtocol);
  const runtime = qualifyDocsConsumer(changed);
  runtime.profile_path = runtime.caller_workflow_path;
  runtime.qualification.evidence_paths = [
    "package.json",
    runtime.profile_path,
    runtime.qualification_evidence_path,
  ];
  assert.throws(
    () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
    /qualified admission requires bound package/u,
  );
});

test("rejects profile, caller, and qualification paths with the wrong artifact type", () => {
  for (const [field, value] of [
    ["profile_path", "docs/document-authoring.json"],
    ["caller_workflow_path", "docs/docs-protocol.yml"],
    ["qualification_evidence_path", "docs/docs-protocol-qualification.yaml"],
  ]) {
    const changed = clone(docsProtocol);
    const runtime = qualifyDocsConsumer(changed);
    const previous = runtime[field];
    runtime[field] = value;
    runtime.qualification.evidence_paths = runtime.qualification.evidence_paths.map(
      (path) => path === previous ? value : path,
    );
    assert.throws(
      () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
      /qualified admission requires bound package/u,
    );
  }
});

test("rejects non-canonical documentation repository paths", () => {
  const cases = [
    ["profile_path", "https://example.com/document-authoring.yaml"],
    ["caller_workflow_path", ".github\\workflows\\docs-protocol.yml"],
    ["qualification_evidence_path", "docs/../docs-protocol-qualification.json"],
    ["profile_path", "docs/./document-authoring.yaml"],
    ["profile_path", "/docs/document-authoring.yaml"],
    ["profile_path", "docs/cafe\u0301.yaml"],
  ];
  for (const [field, value] of cases) {
    const changed = clone(docsProtocol);
    const runtime = qualifyDocsConsumer(changed);
    const previous = runtime[field];
    runtime[field] = value;
    runtime.qualification.evidence_paths = runtime.qualification.evidence_paths.map(
      (path) => path === previous ? value : path,
    );
    assert.throws(() => validateDocsProtocolPolicy(changed, docsProtocolSchema));
  }

  const changed = clone(docsProtocol);
  const runtime = qualifyDocsConsumer(changed);
  runtime.qualification.evidence_paths.push("docs//extra.md");
  assert.throws(() => validateDocsProtocolPolicy(changed, docsProtocolSchema));
});

test("rejects qualification evidence that omits the caller or qualification record", () => {
  for (const omitted of [
    ".github/workflows/docs-protocol.yml",
    "docs/docs-protocol-qualification.json",
  ]) {
    const changed = clone(docsProtocol);
    const runtime = qualifyDocsConsumer(changed);
    runtime.qualification.evidence_paths = runtime.qualification.evidence_paths.filter(
      (path) => path !== omitted,
    );
    assert.throws(
      () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
      /qualified admission requires bound package/u,
    );
  }
});

test("rejects documentation protocol exemption on an owned repository", () => {
  const changed = clone(docsProtocol);
  const runtime = changed.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/agent-runtime",
  );
  runtime.exemption = clone(
    changed.repositories.find(({ ownership }) => ownership === "external_fork").exemption,
  );
  assert.throws(
    () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
    /consumer admission contract is incomplete/u,
  );
});

test("rejects Foundation as both protocol producer and consumer", () => {
  const changed = clone(docsProtocol);
  const foundation = changed.repositories.find(
    ({ role }) => role === "protocol_producer",
  );
  foundation.protocol_required = true;
  foundation.fixed_gate_command = changed.protocol.fixed_gate_command;
  assert.throws(
    () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
    /producer is not a consumer/u,
  );
});

test("rejects a governance controller other than the organization-owned .github repository", () => {
  const changed = clone(docsProtocol);
  const controller = changed.repositories.find(({ role }) => role === "governance_controller");
  const runtime = changed.repositories.find(({ repository }) => repository === "agent-teams-ai/agent-runtime");
  controller.role = "consumer";
  runtime.role = "governance_controller";
  assert.throws(
    () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
    /governance controller must be exactly/u,
  );
});

test("rejects an external fork without the exempt role or exemption", () => {
  for (const mutation of [
    (craig) => { craig.role = "consumer"; },
    (craig) => { craig.exemption = null; },
  ]) {
    const changed = clone(docsProtocol);
    const craig = changed.repositories.find(({ ownership }) => ownership === "external_fork");
    mutation(craig);
    assert.throws(
      () => validateDocsProtocolPolicy(changed, docsProtocolSchema),
      /Craig gateway must remain an explicit external-fork/u,
    );
  }
});

test("accepts the authoritative executable-spec qualification ledger", () => {
  assert.doesNotThrow(() => validateExecutableSpecLedger(clone(ledger), ledgerSchema));
});

test("rejects duplicate repository identities without mirroring repository values", () => {
  const changed = clone(ledger);
  changed.repositories[1].repository = changed.repositories[0].repository;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /Duplicate repository/u);
});

test("rejects a non-resolvable owner reference shape", () => {
  const changed = clone(ledger);
  changed.repositories[0].owner_reference = "repository-maintainers";
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /JSON Schema/u);
});

test("requires the ledger revision date to match the snapshot date", () => {
  const changed = clone(ledger);
  changed.ledger_revision = "2026-08-10.5";
  assert.throws(
    () => validateExecutableSpecLedger(changed, ledgerSchema),
    /revision date must match its snapshot date/u,
  );
});

test("rejects governance acceptance without a revision coordinate", () => {
  const changed = clone(ledger);
  const qualified = changed.repositories.find(
    ({ implementation_qualification }) =>
      implementation_qualification.evidence_status === "governance_accepted_coordinates",
  );
  qualified.implementation_qualification.accepted_revision = null;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /requires a revision coordinate/u);
});

test("rejects a claim of continuous remote audit", () => {
  const changed = clone(ledger);
  changed.remote_enforcement.continuous_audit = true;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /JSON Schema/u);
});

test("rejects a positive maturity without human-reviewed and accepted coordinates", () => {
  const changed = clone(ledger);
  const positive = changed.repositories.find(
    ({ specification_maturity }) => specification_maturity === "capability_implemented",
  );
  positive.specification_evidence.evidence_status = "unverified_snapshot";
  positive.specification_evidence.revision = null;
  positive.specification_evidence.entries = [];
  positive.specification_evidence.coordinate_checksum_sha256 = null;
  positive.specification_evidence.approval_evidence = {
    status: "not_applicable",
    revision: null,
    entries: [],
    coordinate_checksum_sha256: null,
  };
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /positive maturity requires/u);
});

test("rejects capability-only status with governance-accepted product coordinates", () => {
  const changed = clone(ledger);
  const capability = changed.repositories.find(
    ({ implementation_qualification }) =>
      implementation_qualification.status === "capability_only_not_product_qualified",
  );
  const qualification = capability.implementation_qualification;
  qualification.evidence_status = "governance_accepted_coordinates";
  qualification.accepted_revision = capability.specification_evidence.revision;
  qualification.evidence_entries = structuredClone(capability.specification_evidence.entries);
  qualification.coordinate_checksum_sha256 = capability.specification_evidence.coordinate_checksum_sha256;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /capability-only status/u);
});

test("rejects a positive qualification status with an unreviewed snapshot", () => {
  const changed = clone(ledger);
  const qualified = changed.repositories.find(
    ({ implementation_qualification }) =>
      implementation_qualification.status === "partially_qualified_internal_slice",
  );
  qualified.implementation_qualification.evidence_status = "unverified_snapshot";
  qualified.implementation_qualification.accepted_revision = null;
  qualified.implementation_qualification.evidence_entries = [];
  qualified.implementation_qualification.coordinate_checksum_sha256 = null;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /positive qualification status/u);
});

test("rejects governance acceptance backed only by proposed approval evidence", () => {
  const changed = clone(ledger);
  const proposed = changed.repositories.find(
    ({ specification_maturity }) => specification_maturity === "synthetic_proposed",
  );
  proposed.implementation_qualification = {
    status: "partially_qualified_internal_slice",
    statement: "Adversarial qualification claim.",
    evidence_status: "governance_accepted_coordinates",
    accepted_revision: proposed.specification_evidence.revision,
    evidence_entries: structuredClone(proposed.specification_evidence.entries),
    coordinate_checksum_sha256: proposed.specification_evidence.coordinate_checksum_sha256,
  };
  assert.throws(
    () => validateExecutableSpecLedger(changed, ledgerSchema),
    /requires accepted catalog or ADR evidence/u,
  );
});

test("rejects governance-only records with a product qualification status", () => {
  const changed = clone(ledger);
  const governance = changed.repositories.find(({ applicability }) => applicability === "governance_only");
  governance.implementation_qualification.status = "not_qualified";
  governance.implementation_qualification.evidence_status = "unverified_snapshot";
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /governance-only axes/u);
});

test("rejects N/A records with non-N/A maturity", () => {
  const changed = clone(ledger);
  const notApplicable = changed.repositories.find(({ applicability }) => applicability === "not_applicable");
  notApplicable.specification_maturity = "governance_only";
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /maturity is incompatible/u);
});

test("rejects every applicability and maturity mismatch", () => {
  const cases = [
    ["capability_owner", "accepted_partial_projections"],
    ["applicable", "governance_only"],
    ["governance_only", "not_applicable"],
    ["not_applicable", "synthetic_proposed"],
  ];
  for (const [applicability, invalidMaturity] of cases) {
    const changed = clone(ledger);
    const record = changed.repositories.find((candidate) => candidate.applicability === applicability);
    record.specification_maturity = invalidMaturity;
    assert.throws(
      () => validateExecutableSpecLedger(changed, ledgerSchema),
      /maturity is incompatible with applicability/u,
    );
  }
});

test("requires both aggregate and executable-spec gates for every applicable repository", () => {
  for (const mutation of [
    (record) => {
      record.gate_contract.full_repository_command = null;
    },
    (record) => {
      record.gate_contract.executable_spec_commands = [];
    },
  ]) {
    const changed = clone(ledger);
    const record = changed.repositories.find(
      ({ applicability }) => applicability === "capability_owner",
    );
    mutation(record);
    assert.throws(
      () => validateExecutableSpecLedger(changed, ledgerSchema),
      /local gate applicability is inconsistent/u,
    );
  }
});

test("rejects product qualification on the capability owner", () => {
  const changed = clone(ledger);
  const capability = changed.repositories.find(
    ({ applicability }) => applicability === "capability_owner",
  );
  capability.implementation_qualification = {
    status: "partially_qualified_internal_slice",
    statement: "Adversarial product qualification.",
    evidence_status: "governance_accepted_coordinates",
    accepted_revision: capability.specification_evidence.revision,
    evidence_entries: structuredClone(capability.specification_evidence.entries),
    coordinate_checksum_sha256:
      capability.specification_evidence.coordinate_checksum_sha256,
  };
  assert.throws(
    () => validateExecutableSpecLedger(changed, ledgerSchema),
    /capability-owner qualification axes/u,
  );
});

test("rejects an internally inconsistent evidence-coordinate edit", () => {
  const changed = clone(ledger);
  changed.repositories[0].specification_evidence.entries[0].git_blob_sha = "0".repeat(40);
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /internal coordinate checksum/u);
});

test("treats the coordinate checksum only as ledger-internal consistency", () => {
  const changed = clone(ledger);
  const evidence = changed.repositories[0].specification_evidence;
  evidence.revision = "0".repeat(40);
  evidence.entries = evidence.entries.map((entry) => ({
    ...entry,
    git_blob_sha: "0".repeat(40),
  }));
  evidence.coordinate_checksum_sha256 = coordinateChecksum(evidence.entries);
  evidence.approval_evidence.revision = evidence.revision;
  evidence.approval_evidence.entries = evidence.approval_evidence.entries.map((entry) => ({
    ...entry,
    git_blob_sha: "0".repeat(40),
  }));
  evidence.approval_evidence.coordinate_checksum_sha256 = coordinateChecksum(
    evidence.approval_evidence.entries,
  );
  assert.doesNotThrow(() => validateExecutableSpecLedger(changed, ledgerSchema));
});

test("does not describe evidence coordinates as external or offline verification", async () => {
  const sources = await Promise.all(
    [
      "GOVERNANCE.md",
      "README.md",
      "docs/organization-security-baseline.md",
      "governance/executable-spec-qualification.schema.json",
    ].map((path) => readFile(path, "utf8")),
  );
  const forbiddenClaims = [
    /verified_at_revision/u,
    /qualified_at_revision/u,
    /offline[- ]verified/u,
    /offline (?:external )?(?:binding|proof|verification)/u,
    /external Git (?:binding|proof|verification)/u,
    /mechanically bind/u,
    /deterministic external (?:binding|proof|verification)/u,
  ];
  for (const pattern of forbiddenClaims) {
    assert.doesNotMatch(sources.join("\n"), pattern);
  }
});

test("rejects overlap between active scope and archived exclusions", () => {
  const changed = clone(ledger);
  changed.scope.archived_exclusions.push({
    repository: changed.repositories[0].repository,
    repository_id: 999999998,
    archived: true,
    reason: "Synthetic archived overlap.",
  });
  changed.scope.observed_repository_count += 1;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /both active and excluded/u);
});

test("rejects duplicate archived repository IDs", () => {
  const changed = clone(ledger);
  changed.scope.archived_exclusions.push(
    {
      repository: "agent-teams-ai/archived-one",
      repository_id: 999999998,
      archived: true,
      reason: "Synthetic archived repository.",
    },
    {
      repository: "agent-teams-ai/archived-two",
      repository_id: 999999998,
      archived: true,
      reason: "Synthetic archived repository.",
    },
  );
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /IDs must be unique/u);
});

test("rejects an archived repository ID reused by an active repository", () => {
  const changed = clone(ledger);
  changed.scope.archived_exclusions.push({
    repository: "agent-teams-ai/archived-one",
    repository_id: changed.repositories[0].repository_id,
    archived: true,
    reason: "Synthetic archived repository.",
  });
  changed.scope.observed_repository_count += 1;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /ID cannot be both active and excluded/u);
});

test("rejects a scope count that omits an organization repository", () => {
  const changed = clone(ledger);
  changed.scope.observed_repository_count -= 1;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /repository count/u);
});

test("accepts a structurally counted additional ledger record before inventory reconciliation", () => {
  const changed = clone(ledger);
  const additional = structuredClone(
    changed.repositories.find(({ applicability }) => applicability === "not_applicable"),
  );
  additional.repository = "agent-teams-ai/future-product";
  additional.repository_id = 999999999;
  additional.gate_contract.remote_required_checks.evidence_endpoint =
    `https://api.github.com/repos/${additional.repository}/rulesets/${additional.gate_contract.remote_required_checks.ruleset_id}`;
  changed.repositories.push(additional);
  changed.scope.active_repository_count += 1;
  changed.scope.observed_repository_count += 1;
  assert.doesNotThrow(() => validateExecutableSpecLedger(changed, ledgerSchema));
});

test("rejects an approval requirement that would deadlock current governance", () => {
  const changed = clone(ledger);
  changed.approval_policy.minimum_required_approvals = 1;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /single-member deadlock/u);
});

test("rejects approval-policy evidence from another organization", () => {
  const changed = clone(ledger);
  changed.approval_policy.evidence_reference =
    "https://api.github.com/orgs/other/actions/permissions/workflow";
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /JSON Schema/u);
});

test("rejects active required checks without a ruleset identity", () => {
  const changed = clone(ledger);
  const observed = changed.repositories.find(
    ({ gate_contract }) => gate_contract.remote_required_checks.status === "observed_active",
  );
  observed.gate_contract.remote_required_checks.ruleset_id = null;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /exact enforced shape/u);
});

test("rejects a nonzero approval count in the zero-approval ruleset snapshot", () => {
  const changed = clone(ledger);
  const observed = changed.repositories.find(
    ({ gate_contract }) => gate_contract.remote_required_checks.status === "observed_active",
  );
  observed.gate_contract.remote_required_checks.required_approving_review_count = 1;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /exact enforced shape/u);
});

test("rejects unavailable required checks mixed with enforced fields", () => {
  const changed = clone(ledger);
  const unavailable = changed.repositories.find(
    ({ gate_contract }) =>
      gate_contract.remote_required_checks.status === "unavailable_free_private_repository",
  );
  unavailable.gate_contract.remote_required_checks.ruleset_id = 1;
  unavailable.gate_contract.remote_required_checks.required_approving_review_count = 0;
  unavailable.gate_contract.remote_required_checks.require_code_owner_review = false;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /exact exception shape/u);
});

test("rejects observed required checks carrying an exception", () => {
  const changed = clone(ledger);
  const observed = changed.repositories.find(
    ({ gate_contract }) => gate_contract.remote_required_checks.status === "observed_active",
  );
  observed.gate_contract.remote_required_checks.exception_id =
    "platform-private-required-checks-github-free";
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /exact enforced shape/u);
});

test("rejects observed rulesets under an unverified remote snapshot", () => {
  const changed = clone(ledger);
  changed.remote_enforcement.verification = "unverified_snapshot";
  assert.throws(
    () => validateExecutableSpecLedger(changed, ledgerSchema),
    /verification must match the repository observations/u,
  );
});

test("rejects ruleset evidence scoped to another repository", () => {
  const changed = clone(ledger);
  const observed = changed.repositories.find(
    ({ gate_contract }) => gate_contract.remote_required_checks.status === "observed_active",
  );
  observed.gate_contract.remote_required_checks.evidence_endpoint =
    "https://api.github.com/repos/agent-teams-ai/other/rulesets/19979782";
  assert.throws(
    () => validateExecutableSpecLedger(changed, ledgerSchema),
    /exact enforced shape/u,
  );
});

test("rejects ruleset evidence outside the root observation date", () => {
  const changed = clone(ledger);
  changed.repositories[0].gate_contract.remote_required_checks.observed_at = "2026-08-10";
  assert.throws(
    () => validateExecutableSpecLedger(changed, ledgerSchema),
    /dated organization snapshot/u,
  );
});

test("rejects an unqueried ruleset under the dated full snapshot", () => {
  const changed = clone(ledger);
  const remote = changed.repositories.find(
    ({ gate_contract }) => gate_contract.remote_required_checks.status === "observed_active",
  ).gate_contract.remote_required_checks;
  remote.status = "not_observed";
  remote.observed_at = null;
  remote.evidence_endpoint = null;
  remote.http_status = null;
  remote.ruleset_id = null;
  remote.required_approving_review_count = null;
  remote.require_code_owner_review = null;
  remote.checks = [];
  remote.reason = "Rulesets were not queried.";
  assert.throws(
    () => validateExecutableSpecLedger(changed, ledgerSchema),
    /dated organization snapshot/u,
  );
});

test("accepts the authoritative code-security defaults snapshot", () => {
  assert.doesNotThrow(() => validateCodeSecurityDefaults(clone(security), securitySchema));
});

test("rejects a claim of continuous code-security audit", () => {
  const changed = clone(security);
  changed.continuous_audit = true;
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /JSON Schema/u);
});

test("rejects routine Dependabot version-update ownership", () => {
  const changed = clone(security);
  changed.dependabot_policy.scope = "all_updates";
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /JSON Schema/u);
});

test("rejects duplicate security-default visibility targets", () => {
  const changed = clone(security);
  changed.defaults[1].default_for_new_repositories =
    changed.defaults[0].default_for_new_repositories;
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /visibility targets/u);
});

test("rejects a security-default snapshot with the wrong API endpoint", () => {
  const changed = clone(security);
  changed.defaults_evidence.endpoint =
    "https://api.github.com/orgs/agent-teams-ai/code-security/configurations/266049";
  assert.throws(
    () => validateCodeSecurityDefaults(changed, securitySchema),
    /Observed security state must cite its API endpoint/u,
  );
});

test("accepts a confirmed true two-factor requirement observation", () => {
  const changed = clone(security);
  const twoFactor = changed.organization_observations.find(
    ({ claim }) => claim === "two_factor_requirement_enabled",
  );
  twoFactor.value = true;
  twoFactor.transition_status = "none";
  twoFactor.risk = null;
  twoFactor.compensation = null;
  assert.doesNotThrow(() => validateCodeSecurityDefaults(changed, securitySchema));
});

test("rejects enabled two-factor while user confirmation is pending", () => {
  const changed = clone(security);
  const twoFactor = changed.organization_observations.find(
    ({ claim }) => claim === "two_factor_requirement_enabled",
  );
  twoFactor.value = true;
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /must not retain/u);
});

test("rejects a disabled two-factor requirement without an explicit disposition", () => {
  const changed = clone(security);
  const twoFactor = changed.organization_observations.find(
    ({ claim }) => claim === "two_factor_requirement_enabled",
  );
  twoFactor.transition_status = "none";
  twoFactor.risk = null;
  twoFactor.compensation = null;
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /must record/u);
});

test("rejects duplicate organization security observations", () => {
  const changed = clone(security);
  changed.organization_observations[1] = structuredClone(
    changed.organization_observations[0],
  );
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /claims must be unique/u);
});

test("rejects an organization endpoint with a shared-prefix owner", () => {
  const changed = clone(security);
  changed.organization_observations[0].endpoint =
    "https://api.github.com/orgs/agent-teams-ai-evil/settings/billing/advanced-security";
  assert.throws(
    () => validateCodeSecurityDefaults(changed, securitySchema),
    /scoped to the observed organization/u,
  );
});

test("rejects organization billing evidence inside a repository attachment", () => {
  const changed = clone(security);
  changed.repository_attachments[0].evidence_records.push(
    structuredClone(changed.organization_observations[0]),
  );
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /JSON Schema/u);
});

test("rejects a repository attachment to an unknown security configuration", () => {
  const changed = clone(security);
  const attachment = changed.repository_attachments[0].evidence_records.find(
    ({ claim }) => claim === "configuration_attachment",
  );
  attachment.configuration_id = 999999;
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /unknown security configuration/u);
});

test("rejects a public attachment using the private security default", () => {
  const changed = clone(security);
  const publicAttachment = changed.repository_attachments[0];
  publicAttachment.visibility = "public";
  publicAttachment.evidence_records.find(
    ({ claim }) => claim === "configuration_attachment",
  ).configuration_id = 266048;
  assert.throws(
    () => validateCodeSecurityDefaults(changed, securitySchema),
    /does not match repository visibility/u,
  );
});

test("rejects duplicate Platform security evidence claims", () => {
  const changed = clone(security);
  changed.repository_attachments[0].evidence_records[1] = structuredClone(
    changed.repository_attachments[0].evidence_records[0],
  );
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /claims must be unique/u);
});

test("rejects repository security evidence scoped to another repository", () => {
  const changed = clone(security);
  changed.repository_attachments[0].evidence_records[0].endpoint =
    "https://api.github.com/repos/agent-teams-ai/engineering-foundation/code-security-configuration";
  assert.throws(
    () => validateCodeSecurityDefaults(changed, securitySchema),
    /endpoint must match the repository scope/u,
  );
});

test("rejects whitespace-only required-check exception explanations", () => {
  for (const field of ["reason", "compensation"]) {
    const changed = clone(security);
    changed.required_check_exceptions[0][field] = " ";
    assert.throws(
      () => validateCodeSecurityDefaults(changed, securitySchema),
      /JSON Schema/u,
    );
  }
});

test("accepts the dated fully enforced Actions snapshot", () => {
  assert.doesNotThrow(() => validateActionsPolicy(clone(actions), actionsSchema));
});

test("rejects a fully-enforced Actions claim with a pending repository", () => {
  const changed = clone(actions);
  changed.action_sha_pinning.pending.push({
    repository: "agent-teams-ai/craig-meeting-gateway",
    reason: "Synthetic pending repository.",
    reference: "https://github.com/agent-teams-ai/craig-meeting-gateway/pull/7",
  });
  assert.throws(() => validateActionsPolicy(changed, actionsSchema), /Fully enforced SHA pinning/u);
});

test("rejects an incomplete organization Actions coverage snapshot", () => {
  const changed = clone(actions);
  changed.action_sha_pinning.enabled_repositories = "selected";
  assert.throws(() => validateActionsPolicy(changed, actionsSchema), /must be equal to constant/u);
});

test("rejects workflow-permission evidence from another organization", () => {
  const changed = clone(actions);
  changed.organization_workflow_permissions.evidence_endpoint =
    "https://api.github.com/orgs/other/actions/permissions/workflow";
  assert.throws(() => validateActionsPolicy(changed, actionsSchema), /JSON Schema/u);
});

test("rejects organization-wide workflow pull-request creation or approval", () => {
  const changed = clone(actions);
  changed.owner_bootstrap_release_pr.organization_create_and_approve_enabled = true;
  assert.throws(() => validateActionsPolicy(changed, actionsSchema), /JSON Schema/u);
});

test("requires owner creation of the exact generated release revision tuple", () => {
  for (const mutation of [
    (policy) => {
      policy.pull_request_creation.actor = "github-actions[bot]";
    },
    (policy) => {
      policy.pull_request_creation.required_verification = ["exact_head_sha", "exact_base_sha"];
    },
  ]) {
    const changed = clone(actions);
    mutation(changed.owner_bootstrap_release_pr);
    assert.throws(() => validateActionsPolicy(changed, actionsSchema), /JSON Schema/u);
  }
});

test("approves only exact bot-authored release runs after manual inspection", () => {
  for (const mutation of [
    (approval) => {
      approval.mode = "automatic";
    },
    (approval) => {
      approval.allowed_run_author = "dependabot[bot]";
    },
    (approval) => {
      approval.required_verification = ["exact_generated_diff", "exact_head_sha"];
    },
  ]) {
    const changed = clone(actions);
    mutation(changed.owner_bootstrap_release_pr.workflow_run_approval);
    assert.throws(() => validateActionsPolicy(changed, actionsSchema), /JSON Schema/u);
  }
});

test("reruns only a failed Release workflow", () => {
  const changed = clone(actions);
  changed.owner_bootstrap_release_pr.rerun_policy = "any_release_run";
  assert.throws(() => validateActionsPolicy(changed, actionsSchema), /JSON Schema/u);
});

test("requires checks, ReviewRouter, and attestation before release merge", () => {
  const changed = clone(actions);
  changed.owner_bootstrap_release_pr.merge_requirements.pop();
  assert.throws(() => validateActionsPolicy(changed, actionsSchema), /JSON Schema/u);
});

test("requires the canonical GitHub SHA-pinning API field", () => {
  const changed = clone(actions);
  changed.action_sha_pinning.sha_pinning_required = false;
  assert.throws(
    () => validateActionsPolicy(changed, actionsSchema),
    /Fully enforced SHA pinning/u,
  );
});

test("accepts cross-policy required-check exception references", () => {
  assert.doesNotThrow(() => validateGovernanceReferences(clone(ledger), clone(security), clone(actions), clone(inventory), clone(docsProtocol)));
});

test("rejects ledger removal hidden by decremented self-counts", () => {
  const changed = clone(ledger);
  changed.repositories.pop();
  changed.scope.active_repository_count -= 1;
  changed.scope.observed_repository_count -= 1;
  assert.throws(
    () => validateGovernanceReferences(changed, clone(security), clone(actions), clone(inventory), clone(docsProtocol)),
    /scope counts must match/u,
  );
});

test("rejects a security attachment with the wrong inventory ID", () => {
  const changed = clone(security);
  changed.repository_attachments[0].repository_id += 1;
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), changed, clone(actions), clone(inventory), clone(docsProtocol)),
    /attachment identity must match/u,
  );
});

test("rejects a security attachment with the wrong inventory visibility", () => {
  const changed = clone(security);
  const publicAttachment = changed.repository_attachments[0];
  publicAttachment.visibility = "public";
  publicAttachment.evidence_records.find(
    ({ claim }) => claim === "configuration_attachment",
  ).configuration_id = 266049;
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), changed, clone(actions), clone(inventory), clone(docsProtocol)),
    /attachment identity must match/u,
  );
});

test("rejects private-plan ruleset unavailability on a public repository", () => {
  const changed = clone(ledger);
  const publicRecord = changed.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/engineering-foundation",
  );
  const privateRecord = changed.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/agent-teams-platform",
  );
  publicRecord.gate_contract.remote_required_checks = clone(
    privateRecord.gate_contract.remote_required_checks,
  );
  publicRecord.gate_contract.remote_required_checks.evidence_endpoint =
    `https://api.github.com/repos/${publicRecord.repository}/rulesets`;
  assert.throws(
    () => validateGovernanceReferences(changed, clone(security), clone(actions), clone(inventory), clone(docsProtocol)),
    /requires private inventory visibility/u,
  );
});

test("rejects a security snapshot rebound to another organization", () => {
  const changed = clone(security);
  changed.organization = "other-org";
  changed.defaults_evidence.endpoint =
    "https://api.github.com/orgs/other-org/code-security/configurations/defaults";
  for (const observation of changed.organization_observations) {
    observation.endpoint = observation.endpoint.replace(
      "/orgs/agent-teams-ai",
      "/orgs/other-org",
    );
  }
  assert.doesNotThrow(() => validateCodeSecurityDefaults(changed, securitySchema));
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), changed, clone(actions), clone(inventory), clone(docsProtocol)),
    /organization evidence must match/u,
  );
});

test("rejects a dangling Actions required-check exception reference", () => {
  const changed = clone(actions);
  changed.required_check_exception_ids = ["missing-policy-exception"];
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), clone(security), changed, clone(inventory), clone(docsProtocol)),
    /references unknown required-check exception/u,
  );
});

test("rejects duplicate authority exception IDs before building lookup maps", () => {
  const changed = clone(security);
  changed.required_check_exceptions.push({
    ...structuredClone(changed.required_check_exceptions[0]),
    repository: "agent-teams-ai/engineering-foundation",
  });
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), changed, clone(actions), clone(inventory), clone(docsProtocol)),
    /authority IDs must be unique/u,
  );
});

test("rejects duplicate Actions exception references", () => {
  const changed = clone(actions);
  changed.required_check_exception_ids.push(changed.required_check_exception_ids[0]);
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), clone(security), changed, clone(inventory), clone(docsProtocol)),
    /Actions exception references must be unique/u,
  );
});

test("rejects one exception referenced by multiple ledger repositories", () => {
  const changed = clone(ledger);
  const changedInventory = clone(inventory);
  const platform = changed.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/agent-teams-platform",
  );
  const foundation = changed.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/engineering-foundation",
  );
  foundation.gate_contract.remote_required_checks = structuredClone(
    platform.gate_contract.remote_required_checks,
  );
  changedInventory.repositories.find(
    ({ repository }) => repository === foundation.repository,
  ).visibility = "private";
  assert.throws(
    () => validateGovernanceReferences(changed, clone(security), clone(actions), changedInventory, clone(docsProtocol)),
    /Ledger exception references must be one-to-one/u,
  );
});

test("rejects an exception referenced outside its repository scope", () => {
  const changed = clone(security);
  changed.required_check_exceptions[0].repository = "agent-teams-ai/engineering-foundation";
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), changed, clone(actions), clone(inventory), clone(docsProtocol)),
    /exception owned by another repository/u,
  );
});
