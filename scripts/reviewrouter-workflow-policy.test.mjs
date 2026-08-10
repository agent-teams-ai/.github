import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parse } from "yaml";

import { validateReviewRouterWorkflows } from "./reviewrouter-workflow-policy.mjs";

async function load(path) {
  const source = await readFile(path, "utf8");
  return { source, workflow: parse(source) };
}

const checkedIn = {
  review: await load(".github/workflows/reviewrouter-codex.yml"),
  caller: await load(".github/workflows/reviewrouter-interaction.yml"),
  reusable: await load(".github/workflows/reviewrouter-interaction-reusable.yml"),
};

function cloneWorkflows() {
  return structuredClone(checkedIn);
}

test("accepts the pinned reusable interaction workflow and thin caller", () => {
  assert.doesNotThrow(() => validateReviewRouterWorkflows(cloneWorkflows()));
});

test("rejects a mutable reusable-workflow caller reference", () => {
  const changed = cloneWorkflows();
  changed.caller.workflow.jobs.interaction.uses =
    "agent-teams-ai/.github/.github/workflows/reviewrouter-interaction-reusable.yml@main";
  assert.throws(() => validateReviewRouterWorkflows(changed), /pin the organization reusable workflow/u);
});

test("rejects caller-wide secret inheritance", () => {
  const changed = cloneWorkflows();
  changed.caller.workflow.jobs.interaction.secrets = "inherit";
  assert.throws(() => validateReviewRouterWorkflows(changed), /must not inherit all secrets/u);
});

test("rejects removal of the pull-request-only issue-comment filter", () => {
  const changed = cloneWorkflows();
  changed.reusable.workflow.jobs.interaction.if = "${{ github.event_name == 'workflow_dispatch' }}";
  assert.throws(() => validateReviewRouterWorkflows(changed), /fail-closed filter is missing/u);
});

test("rejects permission escalation in the reusable workflow", () => {
  const changed = cloneWorkflows();
  changed.reusable.workflow.jobs.interaction.permissions.contents = "write";
  assert.throws(() => validateReviewRouterWorkflows(changed), /permissions changed/u);
});
