import { readFile } from "node:fs/promises";

import { parse } from "yaml";

import { validateReviewRouterWorkflows } from "./reviewrouter-workflow-policy.mjs";

async function loadWorkflow(path) {
  const source = await readFile(path, "utf8");
  return { source, workflow: parse(source) };
}

const [review, caller, reusable] = await Promise.all([
  loadWorkflow(".github/workflows/reviewrouter-codex.yml"),
  loadWorkflow(".github/workflows/reviewrouter-interaction.yml"),
  loadWorkflow(".github/workflows/reviewrouter-interaction-reusable.yml"),
]);

validateReviewRouterWorkflows({ review, caller, reusable });

console.log("ReviewRouter verified: immutable reusable interaction, thin caller, and least-privilege tokens.");
