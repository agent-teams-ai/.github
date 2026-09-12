import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { parse } from "yaml";

const reviewPath = ".github/workflows/reviewrouter-codex.yml";
const interactionPath = ".github/workflows/reviewrouter-interaction.yml";
const reviewCommit = "75cbecab131d74021677fcd1fb21962994d306b8";
const reviewSecret =
  "REVIEWROUTER_CODEX_AUTH_JSON_R1316243981_P2e7c56bda356e46d_E4_c00bdf94aa1684657780cad55cd4159a";
const interactionSourceSha256 =
  "10bbf435f6b604ab5a959995ab717b8dde186591586f6af8970cd3067a9c74ee";
const reviewSecretMatch =
  /_E([1-9][0-9]*)_([a-f0-9]{32})$/.exec(reviewSecret);
if (!reviewSecretMatch) {
  throw new Error("reviewSecret must use the versioned namespace format.");
}
const [, reviewEpoch, reviewNamespace] = reviewSecretMatch;
const expectedReviewUses =
  `777genius/review-router/.github/workflows/reviewrouter-t0-reusable.yml@${reviewCommit}`;

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

assert(
  review.workflow.on?.pull_request_target,
  `${reviewPath} must use pull_request_target for the versioned V4 secret namespace.`,
);
assert(
  review.workflow.on?.pull_request === undefined,
  `${reviewPath} must not retain the legacy pull_request trigger.`,
);
assert(
  review.workflow.on?.workflow_dispatch === undefined,
  `${reviewPath} must not enable workflow_dispatch for the client-triggered schema.`,
);
assert(
  samePermissions(review.workflow.permissions, {}),
  `${reviewPath} must deny root token permissions.`,
);
assert(
  review.workflow.name ===
    `ReviewRouter Codex OAuth [namespace=sns_${reviewNamespace};epoch=${reviewEpoch};secret=${reviewSecret}]`,
  `${reviewPath} must attest the exact versioned namespace in its name.`,
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
assert(reviewJob.with?.workflow_schema_version === 4, "codex-review must use workflow schema 4.");
assert(
  reviewJob.if ===
    "${{ github.event_name == 'pull_request_target' && github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.user.type != 'Bot' && (github.event.pull_request.draft == false || vars.REVIEW_ROUTER_REVIEW_DRAFTS == 'true') }}",
  "codex-review must preserve the same-repository, non-bot V4 event filter.",
);
assert(
  reviewJob.with?.provider_instance_id === "codex-rotating:1316243981",
  "codex-review must bind the .github repository provider identity.",
);
assert(
  reviewJob.secrets?.CODEX_AUTH_JSON ===
    `\${{ secrets.${reviewSecret} }}`,
  "codex-review must use the exact versioned rotating provider secret.",
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
  refreshStep?.with?.["workflow-schema-version"] === "4",
  "codex-refresh must use workflow schema 4.",
);
assert(
  refreshStep?.with?.["provider-instance-id"] === "codex-rotating:1316243981",
  "codex-refresh must bind the .github repository provider identity.",
);
assert(
  refreshStep?.with?.["auth-json"] === `\${{ secrets.${reviewSecret} }}`,
  "codex-refresh must use the exact versioned rotating provider secret.",
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
  createHash("sha256").update(interaction.source).digest("hex") ===
    interactionSourceSha256,
  `${interactionPath} must match the exact canonical explicit interaction V2 source.`,
);

for (const legacyMarker of [
  "mode: codex-oauth-rotating",
  "REVIEWROUTER_COMMENT_TOKEN_MODE: github-token",
]) {
  assert(
    !review.source.includes(legacyMarker) && !interaction.source.includes(legacyMarker),
    `Legacy ReviewRouter marker is forbidden: ${legacyMarker}`,
  );
}

console.log("ReviewRouter workflows verified: pinned canonical sources with least-privilege tokens.");
