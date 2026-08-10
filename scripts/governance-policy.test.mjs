import assert from "node:assert/strict";
import test from "node:test";

import {
  loadJson,
  validateCodeSecurityDefaults,
  validateExecutableSpecLedger,
} from "./governance-policy.mjs";

const ledger = await loadJson("governance/executable-spec-qualification.json");
const security = await loadJson("governance/code-security-defaults.json");

const clone = (value) => structuredClone(value);

test("accepts the checked-in executable-spec qualification ledger", () => {
  assert.doesNotThrow(() => validateExecutableSpecLedger(clone(ledger)));
});

test("rejects a broadened Runtime qualification claim", () => {
  const changed = clone(ledger);
  const runtime = changed.repositories.find(({ repository }) => repository.endsWith("/agent-runtime"));
  runtime.specification_maturity = "production_bound";
  assert.throws(() => validateExecutableSpecLedger(changed), /maturity is invalid/u);
});

test("rejects a missing exact Platform mutation gate", () => {
  const changed = clone(ledger);
  const platform = changed.repositories.find(({ repository }) => repository.endsWith("/agent-teams-platform"));
  platform.gate_contract.executable_spec_commands.splice(1, 1);
  assert.throws(() => validateExecutableSpecLedger(changed), /executable-spec gates are invalid/u);
});

test("rejects a remote enforcement claim without attestation", () => {
  const changed = clone(ledger);
  changed.remote_enforcement.attestation = "enforced";
  assert.throws(() => validateExecutableSpecLedger(changed), /must not claim remote enforcement/u);
});

test("accepts the checked-in code-security defaults", () => {
  assert.doesNotThrow(() => validateCodeSecurityDefaults(clone(security)));
});

test("rejects routine Dependabot version-update ownership", () => {
  const changed = clone(security);
  changed.dependabot_policy.scope = "all_updates";
  assert.throws(() => validateCodeSecurityDefaults(changed), /security-only/u);
});

test("rejects removal of the GitHub Free private Platform exception", () => {
  const changed = clone(security);
  changed.required_check_exceptions = [];
  assert.throws(() => validateCodeSecurityDefaults(changed), /required-check exception/u);
});
