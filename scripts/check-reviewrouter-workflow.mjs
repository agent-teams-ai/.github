import { readFile } from "node:fs/promises";

import { parse } from "yaml";

const reviewPath = ".github/workflows/reviewrouter-codex.yml";
const interactionPath = ".github/workflows/reviewrouter-interaction.yml";
const actionCommit = "08f6bc1481fd284fa82adfa47cda05c76b161b00";
const expectedReviewUses =
  `777genius/review-router/.github/workflows/reviewrouter-t0-reusable.yml@${actionCommit}`;
const fullSha = /^[0-9a-f]{40}$/u;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function samePermissions(actual, expected) {
  return (
    JSON.stringify(Object.entries(actual ?? {}).sort()) ===
    JSON.stringify(Object.entries(expected).sort())
  );
}

async function loadWorkflow(path) {
  const source = await readFile(path, "utf8");
  return { source, workflow: parse(source) };
}

const review = await loadWorkflow(reviewPath);
const interaction = await loadWorkflow(interactionPath);

assert(review.workflow.on?.pull_request, `${reviewPath} must use pull_request.`);
assert(
  review.workflow.on?.workflow_dispatch === undefined,
  `${reviewPath} must not enable workflow_dispatch for the client-triggered schema.`,
);
assert(
  !review.source.includes("pull_request_target"),
  `${reviewPath} must not use pull_request_target.`,
);
assert(
  samePermissions(review.workflow.permissions, {}),
  `${reviewPath} must deny root token permissions.`,
);

const reviewJob = review.workflow.jobs?.["codex-review"];
assert(reviewJob?.uses === expectedReviewUses, `${reviewPath} must use the immutable T0 workflow.`);
assert(
  reviewJob.with?.runtime_ref === actionCommit,
  "codex-review must pin the reusable workflow and runtime to the same commit.",
);
assert(
  samePermissions(reviewJob.permissions, {
    contents: "read",
    "pull-requests": "read",
    "id-token": "write",
  }),
  "codex-review must keep the Actions token read-only and grant only OIDC write.",
);
assert(reviewJob.with?.workflow_schema_version === 2, "codex-review must use workflow schema 2.");
assert(
  reviewJob.with?.provider_instance_id === "codex-rotating:1316243981",
  "codex-review must bind the .github repository provider identity.",
);
assert(
  reviewJob.secrets?.CODEX_AUTH_JSON ===
    "${{ secrets.REVIEWROUTER_CODEX_AUTH_JSON }}",
  "codex-review must use the dedicated rotating provider secret.",
);

const refreshJob = review.workflow.jobs?.["codex-refresh"];
const refreshStep = refreshJob?.steps?.[0];
assert(
  samePermissions(refreshJob?.permissions, { "id-token": "write" }),
  "codex-refresh must grant only OIDC write.",
);
assert(
  refreshStep?.uses === `777genius/review-router@${actionCommit}`,
  "codex-refresh must pin the same immutable ReviewRouter runtime commit.",
);
assert(
  refreshStep?.with?.["workflow-schema-version"] === "2",
  "codex-refresh must use workflow schema 2.",
);
assert(
  refreshStep?.with?.["provider-instance-id"] === "codex-rotating:1316243981",
  "codex-refresh must bind the .github repository provider identity.",
);

assert(
  samePermissions(interaction.workflow.permissions, {}),
  `${interactionPath} must deny root token permissions.`,
);
const interactionJob = interaction.workflow.jobs?.interaction;
assert(
  samePermissions(interactionJob?.permissions, {
    actions: "write",
    contents: "read",
    issues: "read",
    "pull-requests": "read",
    "id-token": "write",
  }),
  "interaction must grant only the permissions required for App publication, OIDC, and exact-run reruns.",
);
assert(
  interactionJob?.env?.RR_RUNTIME_REF === actionCommit,
  "interaction must pin the same ReviewRouter runtime commit.",
);
assert(
  interactionJob?.env?.REVIEWROUTER_COMMENT_TOKEN_MODE === "app-oidc",
  "interaction publication must use the GitHub App OIDC token.",
);

const externalUses = interactionJob.steps
  .map((step) => step.uses)
  .filter((value) => typeof value === "string" && !value.startsWith("./"));
for (const value of externalUses) {
  const [, reference = ""] = value.split("@");
  assert(fullSha.test(reference), `External action is not pinned to a full SHA: ${value}`);
}
const runtimeCheckout = interactionJob.steps.find(
  (step) => step.with?.repository === "777genius/review-router",
);
assert(runtimeCheckout, "Interaction must checkout the ReviewRouter runtime explicitly.");
assert(
  runtimeCheckout.with.ref === "${{ env.RR_RUNTIME_REF }}",
  "Interaction checkout must use the pinned runtime environment value.",
);

for (const legacyMarker of [
  "pull_request_target",
  "mode: codex-oauth-rotating",
  "REVIEWROUTER_COMMENT_TOKEN_MODE: github-token",
]) {
  assert(
    !review.source.includes(legacyMarker) && !interaction.source.includes(legacyMarker),
    `Legacy ReviewRouter marker is forbidden: ${legacyMarker}`,
  );
}

console.log("ReviewRouter workflow verified: App-first T0 schema 2 with least-privilege tokens.");
