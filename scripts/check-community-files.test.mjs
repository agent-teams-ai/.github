import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import YAML from "yaml";

import {
  validateDocsProtocolWorkflow,
  validateRenovateDocsCohortRule,
} from "./check-community-files.mjs";

const source = await readFile(".github/workflows/docs-protocol-check.yml", "utf8");
const workflow = YAML.parse(source);
const clone = (value) => structuredClone(value);
const renovate = JSON.parse(await readFile("renovate-config.json", "utf8"));

test("allows Docs package updates only through one qualified Cohort proposal", () => {
  assert.doesNotThrow(() => validateRenovateDocsCohortRule(clone(renovate)));
  for (const mutate of [
    (changed) => { changed.packageRules.at(-1).enabled = true; },
    (changed) => { changed.packageRules.at(-1).matchPackageNames.pop(); },
    (changed) => { changed.packageRules.push({
      matchPackageNames: ["@agent-teams/docs-protocol"], enabled: true,
    }); },
  ]) {
    const changed = clone(renovate);
    mutate(changed);
    assert.throws(() => validateRenovateDocsCohortRule(changed), /Cohort rule/u);
  }
});

test("accepts the fixed documentation protocol reusable workflow", () => {
  assert.doesNotThrow(() => validateDocsProtocolWorkflow(clone(workflow), source));
});

test("rejects forbidden documentation protocol job capabilities", () => {
  for (const field of ["permissions", "env", "container", "defaults"]) {
    const changed = clone(workflow);
    changed.jobs["docs-protocol-check"][field] = {};
    assert.throws(
      () => validateDocsProtocolWorkflow(changed, YAML.stringify(changed)),
      /job shape, runner, and timeout/u,
    );
  }
});

test("rejects a documentation protocol workflow on the wrong runner or timeout", () => {
  for (const [field, value] of [
    ["runs-on", "ubuntu-latest"],
    ["timeout-minutes", 30],
    ["if", "always()"],
  ]) {
    const changed = clone(workflow);
    changed.jobs["docs-protocol-check"][field] = value;
    assert.throws(
      () => validateDocsProtocolWorkflow(changed, YAML.stringify(changed)),
      /job shape, runner, and timeout/u,
    );
  }
});

test("rejects root defaults, environment, or a second documentation protocol job", () => {
  for (const mutate of [
    (changed) => { changed.env = {}; },
    (changed) => { changed.defaults = {}; },
    (changed) => { changed.jobs.extra = clone(changed.jobs["docs-protocol-check"]); },
  ]) {
    const changed = clone(workflow);
    mutate(changed);
    assert.throws(() => validateDocsProtocolWorkflow(changed, YAML.stringify(changed)));
  }
});

test("rejects caller-controlled workflow inputs and secret capability", () => {
  const withInput = clone(workflow);
  withInput.on.workflow_call = { inputs: { cohort: { required: true, type: "string" } } };
  assert.throws(() => validateDocsProtocolWorkflow(withInput, YAML.stringify(withInput)),
    /inputless/u);

  const withSecret = clone(workflow);
  withSecret.jobs["docs-protocol-check"].steps[5].env.EXTRA = "${{ secrets.TOKEN }}";
  assert.throws(() => validateDocsProtocolWorkflow(withSecret, YAML.stringify(withSecret)));
});

test("rejects bypass of preinstall verification or immutable checkout", () => {
  const noLockVerification = clone(workflow);
  noLockVerification.jobs["docs-protocol-check"].steps[9].run = "true";
  assert.throws(() => validateDocsProtocolWorkflow(
    noLockVerification,
    YAML.stringify(noLockVerification),
  ), /preinstall lock validation/u);

  const credentialedCheckout = clone(workflow);
  credentialedCheckout.jobs["docs-protocol-check"].steps[6].with["persist-credentials"] = true;
  assert.throws(() => validateDocsProtocolWorkflow(
    credentialedCheckout,
    YAML.stringify(credentialedCheckout),
  ), /immutable checkout/u);

  const lockfileOnlyResolver = clone(workflow);
  lockfileOnlyResolver.jobs["docs-protocol-check"].steps[8].run += " --lockfile-only";
  assert.throws(() => validateDocsProtocolWorkflow(
    lockfileOnlyResolver,
    YAML.stringify(lockfileOnlyResolver),
  ), /preinstall lock validation/u);
});

test("rejects appended commands and every extra step capability", () => {
  const appended = clone(workflow);
  appended.jobs["docs-protocol-check"].steps[13].run += " && node consumer-controlled.mjs";
  assert.throws(() => validateDocsProtocolWorkflow(appended, YAML.stringify(appended)),
    /trusted authorization/u);

  const extraEnv = clone(workflow);
  extraEnv.jobs["docs-protocol-check"].steps[13].env = { EXTRA: "value" };
  assert.throws(() => validateDocsProtocolWorkflow(extraEnv, YAML.stringify(extraEnv)),
    /trusted authorization/u);

  const extraKey = clone(workflow);
  extraKey.jobs["docs-protocol-check"].steps[13]["continue-on-error"] = true;
  assert.throws(() => validateDocsProtocolWorkflow(extraKey, YAML.stringify(extraKey)),
    /trusted authorization/u);

  const changedAuthorityScript = clone(workflow);
  changedAuthorityScript.jobs["docs-protocol-check"].steps[0].with.script += "\ncore.info('extra');\n";
  assert.throws(() => validateDocsProtocolWorkflow(
    changedAuthorityScript,
    YAML.stringify(changedAuthorityScript),
  ), /trusted authorization/u);
});
