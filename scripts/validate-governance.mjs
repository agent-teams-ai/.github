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

validateOrganizationRepositoryInventory(inventory, inventorySchema);
validateExecutableSpecLedger(ledger, ledgerSchema);
validateCodeSecurityDefaults(security, securitySchema);
validateActionsPolicy(actions, actionsSchema);
validateDocsProtocolPolicy(docsProtocol, docsProtocolSchema);
validateGovernanceReferences(ledger, security, actions, inventory, docsProtocol);

console.log("Governance verified: inventory, ledgers, security defaults, Actions, and documentation protocol admission.");
