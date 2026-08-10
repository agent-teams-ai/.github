import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadJson,
  validateActionsPolicy,
  validateCodeSecurityDefaults,
  validateExecutableSpecLedger,
  validateGovernanceReferences,
} from "./governance-policy.mjs";

const ledger = await loadJson("governance/executable-spec-qualification.json");
const ledgerSchema = await loadJson("governance/executable-spec-qualification.schema.json");
const security = await loadJson("governance/code-security-defaults.json");
const securitySchema = await loadJson("governance/code-security-defaults.schema.json");
const actions = await loadJson("governance/actions-policy.json");
const actionsSchema = await loadJson("governance/actions-policy.schema.json");
const clone = (value) => structuredClone(value);
const coordinateChecksum = (entries) => {
  const canonical = [...entries]
    .sort(({ path: left }, { path: right }) => (left < right ? -1 : left > right ? 1 : 0))
    .map(({ path, git_blob_sha: blob }) => `${path}\0${blob}\n`)
    .join("");
  return createHash("sha256").update(canonical).digest("hex");
};

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
  changed.scope.archived_exclusions[0].repository = changed.repositories[0].repository;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /both active and excluded/u);
});

test("rejects duplicate archived repository IDs", () => {
  const changed = clone(ledger);
  changed.scope.archived_exclusions[1].repository_id =
    changed.scope.archived_exclusions[0].repository_id;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /IDs must be unique/u);
});

test("rejects an archived repository ID reused by an active repository", () => {
  const changed = clone(ledger);
  changed.scope.archived_exclusions[0].repository_id = changed.repositories[0].repository_id;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /ID cannot be both active and excluded/u);
});

test("rejects a scope count that omits an organization repository", () => {
  const changed = clone(ledger);
  changed.scope.observed_repository_count -= 1;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /repository count/u);
});

test("rejects an approval requirement that would deadlock current governance", () => {
  const changed = clone(ledger);
  changed.approval_policy.minimum_required_approvals = 1;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /single-member deadlock/u);
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

test("rejects duplicate Platform security evidence claims", () => {
  const changed = clone(security);
  changed.repository_attachments[0].evidence_records[1] = structuredClone(
    changed.repository_attachments[0].evidence_records[0],
  );
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /claims must be unique/u);
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

test("accepts cross-policy required-check exception references", () => {
  assert.doesNotThrow(() => validateGovernanceReferences(clone(ledger), clone(security), clone(actions)));
});

test("rejects a dangling Actions required-check exception reference", () => {
  const changed = clone(actions);
  changed.required_check_exception_ids = ["missing-policy-exception"];
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), clone(security), changed),
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
    () => validateGovernanceReferences(clone(ledger), changed, clone(actions)),
    /authority IDs must be unique/u,
  );
});

test("rejects duplicate Actions exception references", () => {
  const changed = clone(actions);
  changed.required_check_exception_ids.push(changed.required_check_exception_ids[0]);
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), clone(security), changed),
    /Actions exception references must be unique/u,
  );
});

test("rejects one exception referenced by multiple ledger repositories", () => {
  const changed = clone(ledger);
  const platform = changed.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/agent-teams-platform",
  );
  const foundation = changed.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/engineering-foundation",
  );
  foundation.gate_contract.remote_required_checks = structuredClone(
    platform.gate_contract.remote_required_checks,
  );
  assert.throws(
    () => validateGovernanceReferences(changed, clone(security), clone(actions)),
    /Ledger exception references must be one-to-one/u,
  );
});

test("rejects an exception referenced outside its repository scope", () => {
  const changed = clone(security);
  changed.required_check_exceptions[0].repository = "agent-teams-ai/engineering-foundation";
  assert.throws(
    () => validateGovernanceReferences(clone(ledger), changed, clone(actions)),
    /exception owned by another repository/u,
  );
});
