const ACTION_COMMIT = "08f6bc1481fd284fa82adfa47cda05c76b161b00";
const INTERACTION_WORKFLOW_COMMIT = "18fe8dac76d85f421c3e90489322474f7e76578f";
const EXPECTED_REVIEW_USES =
  `777genius/review-router/.github/workflows/reviewrouter-t0-reusable.yml@${ACTION_COMMIT}`;
const EXPECTED_INTERACTION_USES =
  `agent-teams-ai/.github/.github/workflows/reviewrouter-interaction-reusable.yml@${INTERACTION_WORKFLOW_COMMIT}`;
const FULL_SHA = /^[0-9a-f]{40}$/u;
const INTERACTION_PERMISSIONS = {
  actions: "write",
  contents: "read",
  issues: "read",
  "pull-requests": "read",
  "id-token": "write",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function samePermissions(actual, expected) {
  return (
    JSON.stringify(Object.entries(actual ?? {}).sort()) ===
    JSON.stringify(Object.entries(expected).sort())
  );
}

function validateReviewWorkflow(review) {
  assert(review.workflow.on?.pull_request, "Review workflow must use pull_request.");
  assert(review.workflow.on?.workflow_dispatch === undefined, "Review workflow must not enable workflow_dispatch.");
  assert(!review.source.includes("pull_request_target"), "Review workflow must not use pull_request_target.");
  assert(samePermissions(review.workflow.permissions, {}), "Review workflow must deny root token permissions.");

  const reviewJob = review.workflow.jobs?.["codex-review"];
  assert(reviewJob?.uses === EXPECTED_REVIEW_USES, "Review job must use the immutable T0 workflow.");
  assert(reviewJob.with?.runtime_ref === ACTION_COMMIT, "Review workflow and runtime pins must match.");
  assert(
    samePermissions(reviewJob.permissions, {
      contents: "read",
      "pull-requests": "read",
      "id-token": "write",
    }),
    "Review job permissions are not least privilege.",
  );
  assert(reviewJob.with?.workflow_schema_version === 2, "Review job must use workflow schema 2.");
  assert(reviewJob.with?.provider_instance_id === "codex-rotating:1316243981", "Review provider identity changed.");
  assert(
    reviewJob.secrets?.CODEX_AUTH_JSON === "${{ secrets.REVIEWROUTER_CODEX_AUTH_JSON }}",
    "Review job must map the rotating provider secret explicitly.",
  );

  const refreshJob = review.workflow.jobs?.["codex-refresh"];
  const refreshStep = refreshJob?.steps?.[0];
  assert(samePermissions(refreshJob?.permissions, { "id-token": "write" }), "Refresh must grant only OIDC write.");
  assert(refreshStep?.uses === `777genius/review-router@${ACTION_COMMIT}`, "Refresh runtime pin changed.");
  assert(refreshStep?.with?.["workflow-schema-version"] === "2", "Refresh must use workflow schema 2.");
}

function validateInteractionCaller(caller) {
  assert(caller.workflow.on?.pull_request_review_comment, "Interaction caller must receive review comments.");
  assert(caller.workflow.on?.issue_comment, "Interaction caller must receive issue comments.");
  assert(caller.workflow.on?.workflow_dispatch !== undefined, "Interaction caller must retain manual dispatch.");
  assert(!caller.source.includes("pull_request_target"), "Interaction caller must not use pull_request_target.");
  assert(samePermissions(caller.workflow.permissions, {}), "Interaction caller must deny root token permissions.");
  const jobEntries = Object.entries(caller.workflow.jobs ?? {});
  assert(jobEntries.length === 1, "Interaction caller must contain exactly one thin reusable-workflow job.");
  const interaction = caller.workflow.jobs?.interaction;
  assert(interaction?.uses === EXPECTED_INTERACTION_USES, "Interaction caller must pin the organization reusable workflow.");
  const [, reference = ""] = interaction.uses.split("@");
  assert(FULL_SHA.test(reference), "Interaction reusable workflow must be pinned to a full SHA.");
  assert(samePermissions(interaction.permissions, INTERACTION_PERMISSIONS), "Interaction caller permissions changed.");
  assert(interaction.steps === undefined && interaction["runs-on"] === undefined, "Interaction caller must remain thin.");
  assert(interaction.secrets !== "inherit", "Interaction caller must not inherit all secrets.");
  assert(
    interaction.secrets?.REVIEWROUTER_CODEX_AUTH_JSON === "${{ secrets.REVIEWROUTER_CODEX_AUTH_JSON }}" &&
      interaction.secrets?.REVIEW_ROUTER_LEDGER_KEY === "${{ secrets.REVIEW_ROUTER_LEDGER_KEY }}",
    "Interaction caller must map only the two named secrets.",
  );
}

function validateInteractionReusable(reusable) {
  assert(reusable.workflow.on?.workflow_call, "Reusable interaction workflow must use workflow_call.");
  for (const forbiddenTrigger of ["pull_request_target", "pull_request_review_comment", "issue_comment", "workflow_dispatch"]) {
    assert(reusable.workflow.on?.[forbiddenTrigger] === undefined, `Reusable workflow must not declare ${forbiddenTrigger}.`);
  }
  assert(samePermissions(reusable.workflow.permissions, {}), "Reusable interaction workflow must deny root permissions.");
  const declaredSecrets = reusable.workflow.on.workflow_call.secrets;
  assert(declaredSecrets?.REVIEWROUTER_CODEX_AUTH_JSON?.required === false, "Codex auth secret must be explicitly optional.");
  assert(declaredSecrets?.REVIEW_ROUTER_LEDGER_KEY?.required === false, "Ledger key secret must be explicitly optional.");

  const interaction = reusable.workflow.jobs?.interaction;
  assert(samePermissions(interaction?.permissions, INTERACTION_PERMISSIONS), "Reusable interaction permissions changed.");
  assert(interaction?.env?.RR_RUNTIME_REF === ACTION_COMMIT, "Reusable interaction runtime pin changed.");
  assert(interaction?.env?.REVIEWROUTER_COMMENT_TOKEN_MODE === "app-oidc", "Comments must use the App OIDC token.");
  for (const marker of ["github.event_name == 'issue_comment'", "github.event.issue.pull_request", "github.event.comment.user.type != 'Bot'"]) {
    assert(interaction?.if?.includes(marker), `Reusable interaction fail-closed filter is missing: ${marker}`);
  }

  const externalUses = interaction.steps
    .map((step) => step.uses)
    .filter((value) => typeof value === "string" && !value.startsWith("./"));
  for (const value of externalUses) {
    const [, reference = ""] = value.split("@");
    assert(FULL_SHA.test(reference), `External action is not pinned to a full SHA: ${value}`);
  }
  const runtimeCheckout = interaction.steps.find((step) => step.with?.repository === "777genius/review-router");
  assert(runtimeCheckout?.with?.ref === "${{ env.RR_RUNTIME_REF }}", "Runtime checkout must use the immutable env pin.");
}

export function validateReviewRouterWorkflows({ review, caller, reusable }) {
  validateReviewWorkflow(review);
  validateInteractionCaller(caller);
  validateInteractionReusable(reusable);
  for (const legacyMarker of [
    "pull_request_target",
    "mode: codex-oauth-rotating",
    "REVIEWROUTER_COMMENT_TOKEN_MODE: github-token",
  ]) {
    assert(
      !review.source.includes(legacyMarker) &&
        !caller.source.includes(legacyMarker) &&
        !reusable.source.includes(legacyMarker),
      `Legacy ReviewRouter marker is forbidden: ${legacyMarker}`,
    );
  }
}
