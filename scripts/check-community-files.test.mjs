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

test("keeps OIDC only in the trusted authorization job", () => {
  const root = clone(workflow); root.permissions["id-token"] = "write";
  assert.throws(() => validateDocsProtocolWorkflow(root, YAML.stringify(root)), /exact trusted|allowlist/u);
  const semantic = clone(workflow); semantic.jobs["docs-protocol-check"].permissions["id-token"] = "write";
  assert.throws(() => validateDocsProtocolWorkflow(semantic, YAML.stringify(semantic)), /exact trusted|allowlist/u);
});

test("rejects wrong split-job runner, timeout, or dependency", () => {
  for (const mutate of [
    (changed) => { changed.jobs["trusted-structural"]["runs-on"] = "ubuntu-latest"; },
    (changed) => { changed.jobs["docs-protocol-check"]["timeout-minutes"] = 30; },
    (changed) => { changed.jobs["docs-protocol-check"].needs = null; },
    (changed) => { changed.jobs["trusted-qualification"].needs = ["trusted-authorize"]; },
  ]) { const changed = clone(workflow); mutate(changed); assert.throws(() => validateDocsProtocolWorkflow(changed, YAML.stringify(changed))); }
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
  assert.throws(() => validateDocsProtocolWorkflow(withInput, YAML.stringify(withInput)));

  const withSecret = clone(workflow);
  withSecret.jobs["trusted-structural"].steps[5].env = { EXTRA: "${{ secrets.TOKEN }}" };
  assert.throws(() => validateDocsProtocolWorkflow(withSecret, YAML.stringify(withSecret)));
});

test("rejects semantic commands in OIDC and changed authority", () => {
  const trustedGate = clone(workflow);
  trustedGate.jobs["trusted-authorize"].steps.push({ name: "bad", run: "pnpm docs:protocol:check" });
  assert.throws(() => validateDocsProtocolWorkflow(trustedGate, YAML.stringify(trustedGate)), /allowlist/u);
  const changedAuthorityScript = clone(workflow);
  changedAuthorityScript.jobs["trusted-authorize"].steps[0].with.script = "core.info('extra');\n";
  assert.throws(() => validateDocsProtocolWorkflow(
    changedAuthorityScript,
    YAML.stringify(changedAuthorityScript),
  ), /authority script/u);
});

test("rejects run/comment bypasses despite preserved step names", () => {
  for (const mutate of [
    (changed) => { changed.jobs["trusted-qualification"].steps[4].run = "true # base verifier install"; },
    (changed) => { changed.jobs["trusted-qualification"].steps[9].run = "true # prepare-install"; },
    (changed) => { changed.jobs["trusted-qualification"].steps[11].run = "true # pnpm install --ignore-scripts --ignore-pnpmfile"; },
    (changed) => { changed.jobs["trusted-qualification"].steps[13].run = "true # agent-teams-docs qualify"; },
    (changed) => { changed.jobs["trusted-qualification"].steps[14].run = "true # verify-docs-qualification-receipt.mjs"; },
    (changed) => { changed.jobs["docs-protocol-check"].steps[5].run = "true # pnpm docs:protocol:check"; },
  ]) {
    const changed = clone(workflow);
    mutate(changed);
    assert.throws(() => validateDocsProtocolWorkflow(changed, YAML.stringify(changed)), /allowlist/u);
  }
});

test("keeps schemaVersion 1 as a trusted qualification no-op", () => {
  const qualification = workflow.jobs["trusted-qualification"];
  assert.equal(qualification.steps[8].name, "Detect exact qualification contract version");
  for (const step of qualification.steps.slice(9, 15)) {
    assert.equal(step.if, "steps.qualification.outputs.enabled == 'true'");
  }
  assert.equal(qualification.steps.at(-1).if, undefined);
  assert.equal(workflow.jobs["docs-protocol-check"].needs, "trusted-qualification");
});
