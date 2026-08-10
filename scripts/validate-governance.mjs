import {
  loadJson,
  validateCodeSecurityDefaults,
  validateExecutableSpecLedger,
} from "./governance-policy.mjs";

const ledger = await loadJson("governance/executable-spec-qualification.json");
const security = await loadJson("governance/code-security-defaults.json");

validateExecutableSpecLedger(ledger);
validateCodeSecurityDefaults(security);

console.log("Governance verified: six-repository qualification ledger and security defaults.");
