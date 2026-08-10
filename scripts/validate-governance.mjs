import {
  loadJson,
  validateCodeSecurityDefaults,
  validateExecutableSpecLedger,
} from "./governance-policy.mjs";

const ledger = await loadJson("governance/executable-spec-qualification.json");
const ledgerSchema = await loadJson("governance/executable-spec-qualification.schema.json");
const security = await loadJson("governance/code-security-defaults.json");
const securitySchema = await loadJson("governance/code-security-defaults.schema.json");

validateExecutableSpecLedger(ledger, ledgerSchema);
validateCodeSecurityDefaults(security, securitySchema);

console.log("Governance verified: six-repository qualification ledger and security defaults.");
