import { readFile } from "node:fs/promises";

import { parse } from "yaml";

const reviewPath = ".github/workflows/reviewrouter-codex.yml";
const interactionPath = ".github/workflows/reviewrouter-interaction.yml";
const reviewCommit = "08f6bc1481fd284fa82adfa47cda05c76b161b00";
const interactionCommit = "5da51b7b71b1db9ce531f946ec2bb90411a31300";
const expectedReviewUses =
  `777genius/review-router/.github/workflows/reviewrouter-t0-reusable.yml@${reviewCommit}`;
const expectedInteractionUses =
  `777genius/review-router/.github/workflows/reviewrouter-interaction-reusable.yml@${interactionCommit}`;

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
  reviewJob.with?.runtime_ref === reviewCommit,
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
  refreshStep?.uses === `777genius/review-router@${reviewCommit}`,
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
assert(
  JSON.stringify(interaction.workflow.on?.pull_request_review_comment?.types) ===
      JSON.stringify(["created", "edited"]) &&
    JSON.stringify(interaction.workflow.on?.issue_comment?.types) ===
      JSON.stringify(["created", "edited"]) &&
    interaction.workflow.on?.workflow_dispatch !== undefined,
  `${interactionPath} must preserve review-comment, PR-comment, and manual events.`,
);
const interactionJob = interaction.workflow.jobs?.interaction;
assert(
  interactionJob?.if ===
    "${{ github.event_name == 'workflow_dispatch' || ((github.event_name != 'issue_comment' || github.event.issue.pull_request) && github.event.comment.user.type != 'Bot') }}",
  "interaction must preserve the PR-only and non-bot event filter.",
);
assert(
  interactionJob?.uses === expectedInteractionUses,
  `${interactionPath} must call the immutable upstream interaction workflow.`,
);
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
  interactionJob?.with?.runtime_ref === interactionCommit,
  "interaction must pin the reusable workflow and runtime to the same commit.",
);
assert(
  interactionJob?.with?.api_url === "https://api.reviewrouter.site" &&
    interactionJob?.with?.runtime_config_mode === "oidc" &&
    interactionJob?.with?.review_workflow_file === "reviewrouter-codex.yml",
  "interaction must preserve its API, OIDC, and review-workflow contract.",
);
assert(
  interactionJob?.with?.discussion_mode ===
    "${{ vars.REVIEW_ROUTER_DISCUSSION_MODE || 'off' }}" &&
    interactionJob?.with?.discussion_model ===
      "${{ vars.REVIEW_CODEX_MODEL || 'gpt-5.5' }}" &&
    interactionJob?.with?.discussion_reasoning_effort ===
      "${{ vars.REVIEW_CODEX_EFFORT || 'xhigh' }}" &&
    interactionJob?.with?.discussion_max_per_pr ===
      "${{ vars.REVIEW_ROUTER_DISCUSSION_MAX_PER_PR || '20' }}" &&
    interactionJob?.with?.discussion_max_per_thread ===
      "${{ vars.REVIEW_ROUTER_DISCUSSION_MAX_PER_THREAD || '5' }}" &&
    interactionJob?.with?.discussion_timeout_seconds ===
      "${{ vars.REVIEW_ROUTER_DISCUSSION_TIMEOUT_SECONDS || '60' }}",
  "interaction must preserve all discussion variable mappings.",
);
assert(
  samePermissions(interactionJob?.secrets, {
    REVIEW_ROUTER_LEDGER_KEY: "${{ secrets.REVIEW_ROUTER_LEDGER_KEY }}",
    CODEX_AUTH_JSON: "${{ secrets.REVIEWROUTER_CODEX_AUTH_JSON }}",
  }),
  "interaction must preserve only the required secret mappings.",
);
assert(
  interactionJob?.steps === undefined &&
    interactionJob?.["runs-on"] === undefined &&
    interactionJob?.env === undefined,
  "interaction must remain a thin reusable-workflow caller.",
);

for (const legacyMarker of [
  "pull_request_target",
  "mode: codex-oauth-rotating",
  "REVIEWROUTER_COMMENT_TOKEN_MODE: github-token",
  "actions/checkout@",
  "actions/setup-node@",
  ".reviewrouter-runtime",
  "npm install -g",
]) {
  assert(
    !review.source.includes(legacyMarker) && !interaction.source.includes(legacyMarker),
    `Legacy ReviewRouter marker is forbidden: ${legacyMarker}`,
  );
}

console.log("ReviewRouter workflows verified: pinned thin callers with least-privilege tokens.");
