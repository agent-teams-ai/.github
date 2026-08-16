import {
  loadJson,
  validateActionsPolicy,
  validateCodeSecurityDefaults,
  validateDocsProtocolPolicy,
  validateExecutableSpecLedger,
  validateGovernanceReferences,
  validateOrganizationRepositoryInventory,
} from "./governance-policy.mjs";
import {
  validateDocsGovernanceReferences,
  validateDocsProtocolExceptions,
  validateDocsQualifiedCohorts,
} from "./docs-cohort-policy.mjs";

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
const docsCohorts = await loadJson("governance/docs-qualified-cohorts.json");
const docsCohortsSchema = await loadJson("governance/docs-qualified-cohorts.schema.json");
const docsExceptions = await loadJson("governance/docs-protocol-exceptions.json");
const docsExceptionsSchema = await loadJson("governance/docs-protocol-exceptions.schema.json");

validateOrganizationRepositoryInventory(inventory, inventorySchema);
validateExecutableSpecLedger(ledger, ledgerSchema);
validateCodeSecurityDefaults(security, securitySchema);
validateActionsPolicy(actions, actionsSchema);
validateDocsProtocolPolicy(docsProtocol, docsProtocolSchema);
validateDocsQualifiedCohorts(docsCohorts, docsCohortsSchema);
validateDocsProtocolExceptions(docsExceptions, docsExceptionsSchema);
validateGovernanceReferences(ledger, security, actions, inventory, docsProtocol);
validateDocsGovernanceReferences(docsCohorts, docsExceptions, docsProtocol, security);

console.log("Governance verified: inventory, ledgers, security defaults, Actions, Docs Cohorts, exceptions, and documentation protocol admission.");
