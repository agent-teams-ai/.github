import assert from "node:assert/strict";
import test from "node:test";

import {
  loadJson,
  validateActionsPolicy,
  validateCodeSecurityDefaults,
  validateExecutableSpecLedger,
} from "./governance-policy.mjs";

const ledger = await loadJson("governance/executable-spec-qualification.json");
const ledgerSchema = await loadJson("governance/executable-spec-qualification.schema.json");
const security = await loadJson("governance/code-security-defaults.json");
const securitySchema = await loadJson("governance/code-security-defaults.schema.json");
const actions = await loadJson("governance/actions-policy.json");
const actionsSchema = await loadJson("governance/actions-policy.schema.json");
const clone = (value) => structuredClone(value);

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

test("rejects qualification without an immutable revision", () => {
  const changed = clone(ledger);
  const qualified = changed.repositories.find(
    ({ implementation_qualification }) =>
      implementation_qualification.verification === "qualified_at_revision",
  );
  qualified.implementation_qualification.qualified_revision = null;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /must bind evidence/u);
});

test("rejects a claim of continuous remote audit", () => {
  const changed = clone(ledger);
  changed.remote_enforcement.continuous_audit = true;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /JSON Schema/u);
});

test("rejects a positive maturity without verified and accepted evidence", () => {
  const changed = clone(ledger);
  const positive = changed.repositories.find(
    ({ specification_maturity }) => specification_maturity === "capability_implemented",
  );
  positive.specification_evidence.verification = "unverified_snapshot";
  positive.specification_evidence.revision = null;
  positive.specification_evidence.entries = [];
  positive.specification_evidence.manifest_sha256 = null;
  positive.specification_evidence.approval_evidence = {
    status: "not_applicable",
    revision: null,
    entries: [],
    manifest_sha256: null,
  };
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /positive maturity requires/u);
});

test("rejects capability-only status with qualified product evidence", () => {
  const changed = clone(ledger);
  const capability = changed.repositories.find(
    ({ implementation_qualification }) =>
      implementation_qualification.status === "capability_only_not_product_qualified",
  );
  const qualification = capability.implementation_qualification;
  qualification.verification = "qualified_at_revision";
  qualification.qualified_revision = capability.specification_evidence.revision;
  qualification.evidence_entries = structuredClone(capability.specification_evidence.entries);
  qualification.manifest_sha256 = capability.specification_evidence.manifest_sha256;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /capability-only status/u);
});

test("rejects a positive qualification status with an unverified snapshot", () => {
  const changed = clone(ledger);
  const qualified = changed.repositories.find(
    ({ implementation_qualification }) =>
      implementation_qualification.status === "partially_qualified_internal_slice",
  );
  qualified.implementation_qualification.verification = "unverified_snapshot";
  qualified.implementation_qualification.qualified_revision = null;
  qualified.implementation_qualification.evidence_entries = [];
  qualified.implementation_qualification.manifest_sha256 = null;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /positive qualification status/u);
});

test("rejects governance-only records with a product qualification status", () => {
  const changed = clone(ledger);
  const governance = changed.repositories.find(({ applicability }) => applicability === "governance_only");
  governance.implementation_qualification.status = "not_qualified";
  governance.implementation_qualification.verification = "unverified_snapshot";
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /governance-only axes/u);
});

test("rejects N/A records with non-N/A maturity", () => {
  const changed = clone(ledger);
  const notApplicable = changed.repositories.find(({ applicability }) => applicability === "not_applicable");
  notApplicable.specification_maturity = "governance_only";
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /N\/A axes/u);
});

test("rejects an altered Git blob manifest", () => {
  const changed = clone(ledger);
  changed.repositories[0].specification_evidence.entries[0].git_blob_sha = "0".repeat(40);
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /manifest digest/u);
});

test("rejects overlap between active scope and archived exclusions", () => {
  const changed = clone(ledger);
  changed.scope.archived_exclusions[0].repository = changed.repositories[0].repository;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /both active and excluded/u);
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
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /must bind a ruleset ID/u);
});

test("rejects a nonzero approval count in the zero-approval ruleset snapshot", () => {
  const changed = clone(ledger);
  const observed = changed.repositories.find(
    ({ gate_contract }) => gate_contract.remote_required_checks.status === "observed_active",
  );
  observed.gate_contract.remote_required_checks.required_approving_review_count = 1;
  assert.throws(() => validateExecutableSpecLedger(changed, ledgerSchema), /exact zero-approval/u);
});

test("accepts the authoritative code-security defaults snapshot", () => {
  assert.doesNotThrow(() => validateCodeSecurityDefaults(clone(security), securitySchema));
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

test("rejects a repository attachment to an unknown security configuration", () => {
  const changed = clone(security);
  changed.repository_attachments[0].configuration_id = 999999;
  assert.throws(() => validateCodeSecurityDefaults(changed, securitySchema), /unknown security configuration/u);
});

test("accepts the dated partial Actions rollout snapshot", () => {
  assert.doesNotThrow(() => validateActionsPolicy(clone(actions), actionsSchema));
});

test("rejects a fully-enforced Actions claim while Gateway remains pending", () => {
  const changed = clone(actions);
  changed.action_sha_pinning.fully_enforced = true;
  assert.throws(() => validateActionsPolicy(changed, actionsSchema), /Fully enforced SHA pinning/u);
});
