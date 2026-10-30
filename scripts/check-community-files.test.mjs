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
    (changed) => {
      changed.packageRules.at(-1).enabled = true;
    },
    (changed) => {
      changed.packageRules.at(-1).matchPackageNames.pop();
    },
    (changed) => {
      changed.packageRules.push({
        matchPackageNames: ["@agent-teams/docs-protocol"],
        enabled: true,
      });
    },
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
  const root = clone(workflow);
  root.permissions["id-token"] = "write";
  assert.throws(
    () => validateDocsProtocolWorkflow(root, YAML.stringify(root)),
    /exact trusted|allowlist/u,
  );
  const semantic = clone(workflow);
  semantic.jobs["docs-protocol-check"].permissions["id-token"] = "write";
  assert.throws(
    () => validateDocsProtocolWorkflow(semantic, YAML.stringify(semantic)),
    /exact trusted|allowlist/u,
  );
});

test("rejects wrong split-job runner, timeout, or dependency", () => {
  for (const mutate of [
    (changed) => {
      changed.jobs["trusted-structural"]["runs-on"] = "ubuntu-latest";
    },
    (changed) => {
      changed.jobs["docs-protocol-check"]["timeout-minutes"] = 30;
    },
    (changed) => {
      changed.jobs["docs-protocol-check"].needs = null;
    },
    (changed) => {
      changed.jobs["trusted-qualification"].needs = ["trusted-authorize"];
    },
  ]) {
    const changed = clone(workflow);
    mutate(changed);
    assert.throws(() => validateDocsProtocolWorkflow(changed, YAML.stringify(changed)));
  }
});

test("rejects root defaults, environment, or a second documentation protocol job", () => {
  for (const mutate of [
    (changed) => {
      changed.env = {};
    },
    (changed) => {
      changed.defaults = {};
    },
    (changed) => {
      changed.jobs.extra = clone(changed.jobs["docs-protocol-check"]);
    },
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
  trustedGate.jobs["trusted-authorize"].steps.push({
    name: "bad",
    run: "pnpm docs:protocol:check",
  });
  assert.throws(
    () => validateDocsProtocolWorkflow(trustedGate, YAML.stringify(trustedGate)),
    /allowlist/u,
  );
  const changedAuthorityScript = clone(workflow);
  changedAuthorityScript.jobs["trusted-authorize"].steps[0].with.script = "core.info('extra');\n";
  assert.throws(
    () =>
      validateDocsProtocolWorkflow(changedAuthorityScript, YAML.stringify(changedAuthorityScript)),
    /authority script/u,
  );
});

test("rejects run/comment bypasses despite preserved step names", () => {
  for (const mutate of [
    (changed) => {
      changed.jobs["trusted-qualification"].steps[5].run = "true # base verifier install";
    },
    (changed) => {
      changed.jobs["trusted-qualification"].steps[10].run = "true # prepare-install";
    },
    (changed) => {
      changed.jobs["trusted-qualification"].steps[12].run =
        "true # pnpm install --ignore-scripts --ignore-pnpmfile";
    },
    (changed) => {
      changed.jobs["trusted-qualification"].steps[14].run = "true # agent-teams-docs qualify";
    },
    (changed) => {
      changed.jobs["trusted-qualification"].steps[15].run =
        "true # verify-docs-qualification-receipt.mjs";
    },
    (changed) => {
      changed.jobs["docs-protocol-check"].steps[5].run = "true # pnpm docs:protocol:check";
    },
  ]) {
    const changed = clone(workflow);
    mutate(changed);
    assert.throws(
      () => validateDocsProtocolWorkflow(changed, YAML.stringify(changed)),
      /allowlist/u,
    );
  }
});

test("dispatches none, legacy, Cohort v2, and generation3 while preserving v2 Node24", () => {
  const qualification = workflow.jobs["trusted-qualification"];
  assert.equal(
    workflow.jobs["trusted-authorize"].outputs["qualification-profile"],
    "${{ steps.authorization.outputs.qualification-profile }}",
  );
  const byName = new Map(qualification.steps.map((step) => [step.name, step]));
  assert.equal(
    byName.get("Set up pnpm for legacy trusted qualification tooling").with.version,
    "11.18.0",
  );
  assert.equal(
    byName.get("Set up pnpm for Cohort v2 or v3 trusted qualification tooling").with.version,
    "11.20.0",
  );
  assert.match(
    byName.get("Run only the exact installed agent-teams-docs qualify CLI").run,
    /trusted-install\.outputs\.cli/u,
  );
  assert.doesNotMatch(
    byName.get("Run Cohort v2 or v3 qualification through the trusted base-owned runner").run,
    /trusted-install\.outputs\.cli/u,
  );
  const managedRunner = byName.get(
    "Run Cohort v2 or v3 qualification through the trusted base-owned runner",
  );
  assert.match(managedRunner.run, /run-qualification-v3/u);
  assert.deepEqual(managedRunner.env, { DOCS_COHORT_PNPM_EXECUTABLE: "pnpm" });
  assert.deepEqual(
    byName.get("Bind Cohort v2 or v3 authorized consumer receipt without asserting central CANARY")
      .env,
    { DOCS_COHORT_PNPM_EXECUTABLE: "pnpm" },
  );
  assert.match(
    byName.get("Set up Node for trusted qualification tooling").with["node-version"],
    /cohort-v3.*26\.11\.1.*24\.21\.0/u,
  );
  assert.match(
    byName.get("Bind Cohort v2 or v3 authorized consumer receipt without asserting central CANARY")
      .run,
    /verify-docs-cohort-v2-receipt\.mjs/u,
  );
  assert.equal(
    byName.get("Confirm current controller authority stayed stable through qualification").if,
    undefined,
  );
  const semantic = workflow.jobs["docs-protocol-check"];
  assert.deepEqual(semantic.needs, ["trusted-authorize", "trusted-qualification"]);
  assert.equal(
    semantic.steps.find((step) => step.name === "Set up Node for repository semantic gate").with[
      "node-version"
    ],
    "${{ needs.trusted-authorize.outputs.qualification-profile == 'cohort-v3' && '26.11.1' || '24.21.0' }}",
  );
});

test("initializes qualification temp paths at runtime instead of job expression evaluation", () => {
  const qualification = workflow.jobs["trusted-qualification"];
  assert.equal(JSON.stringify(qualification.env).includes("runner.temp"), false);
  const initializer = qualification.steps.find(
    (step) => step.name === "Initialize isolated qualification paths",
  );
  assert.match(initializer.run, /RUNNER_TEMP/u);
  assert.match(initializer.run, /GITHUB_ENV/u);

  const changed = clone(workflow);
  changed.jobs["trusted-qualification"].steps.find(
    (step) => step.name === "Initialize isolated qualification paths",
  ).run = "true";
  assert.throws(() => validateDocsProtocolWorkflow(changed), /allowlist/u);
});

test("derives only the untrusted semantic gate pnpm from the validated consumer packageManager", () => {
  const semanticSetup = workflow.jobs["docs-protocol-check"].steps.find(
    (step) => step.name === "Set up pnpm for repository semantic gate",
  );
  assert.deepEqual(semanticSetup.with, { run_install: false });

  for (const jobName of ["trusted-authorize", "trusted-structural", "trusted-qualification"]) {
    const trustedSetup = workflow.jobs[jobName].steps.find((step) =>
      step.uses?.startsWith("pnpm/action-setup@"),
    );
    assert.equal(trustedSetup.with.version, "11.18.0");
  }

  const changed = clone(workflow);
  changed.jobs["docs-protocol-check"].steps.find(
    (step) => step.name === "Set up pnpm for repository semantic gate",
  ).with.version = "11.18.0";
  assert.throws(() => validateDocsProtocolWorkflow(changed), /allowlist/u);
});

test("retains only exact nonsecret Gen3 evidence after successful controller stability", () => {
  const name = "Retain verified nonsecret generation3 qualification evidence";
  const steps = workflow.jobs["trusted-qualification"].steps;
  const artifact = steps.find((step) => step.name === name);
  assert.ok(
    steps.findIndex((step) => step.name === name) >
      steps.findIndex(
        (step) =>
          step.name === "Confirm current controller authority stayed stable through qualification",
      ),
  );
  assert.equal(
    artifact.if,
    "success() && needs.trusted-authorize.outputs.qualification-profile == 'cohort-v3'",
  );
  assert.equal(
    artifact.with.path,
    "${{ env.QUALIFICATION_RECEIPT }}\n${{ env.INSTALL_EVIDENCE_PATH }}\n",
  );
  for (const mutate of [
    (list) => {
      list.splice(
        list.findIndex((step) => step.name === name),
        1,
      );
    },
    (list) => {
      list.find((step) => step.name === name).with.path = "${{ runner.temp }}/**";
    },
    (list) => {
      const i = list.findIndex((step) => step.name === name);
      list.splice(i - 1, 0, list.splice(i, 1)[0]);
    },
    (list) => {
      list.find((step) => step.name === name).if = "always()";
    },
    (list) => {
      list.find((step) => step.name === name).with["retention-days"] = 30;
    },
    (list) => {
      list.push({ ...list.find((step) => step.name === name), name: "extra evidence" });
    },
  ]) {
    const changed = clone(workflow);
    mutate(changed.jobs["trusted-qualification"].steps);
    assert.throws(() => validateDocsProtocolWorkflow(changed), /allowlist/u);
  }
});
