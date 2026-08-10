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

validateExecutableSpecLedger(ledger, ledgerSchema);
validateCodeSecurityDefaults(security, securitySchema);
validateActionsPolicy(actions, actionsSchema);
validateGovernanceReferences(ledger, security, actions);

console.log("Governance verified: active-repository ledger, security defaults, and Actions policy.");
