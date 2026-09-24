import { isDeepStrictEqual } from "node:util";
import { recoveryBlob, recoveryDigest, recoveryTarget, verifyLegacyFailureJobs,
  POLICY_PATH } from "./docs-legacy-admission-recovery.mjs";
import { docsCohortTransitionKind, isDocsCohortSelectableForRepository,
  validateDocsQualifiedCohorts } from "./docs-cohort-policy.mjs";
import { parseIncidentJson, selectLatestFailedSourceCheck } from
  "./verify-docs-platform-recovery-installation-r317.mjs";

// Incident-specific verifier. Only the protected base may supply its record.
// The current base has no active record or installed guard transition.
export const PLATFORM_RECOVERY_AUTHORITY_PATH = "governance/docs-platform-admission-recovery.json";
export const PLATFORM_RECOVERY = Object.freeze({
  central_pull: 314,
  historical_base: "a9521f1f54a9ea836da6ade82344a3c9baded356",
  before_policy_blob: "55717f3171b0359b4eedba338f616ae72d943496",
  after_policy_blob: "17a2c987aed7d0fa10cf9e2c5788f45d3ab41aad",
  registry_blob: "18f59fc7312d78782f65b5f40dcc3774695211af",
  exceptions_blob: "ac336b865d697b62c938623f2960864e85f7698a",
  repository: "agent-teams-ai/agent-teams-platform",
  repository_id: 1319378484,
  source_head: "a3ce96e00df2f9958fbd614e7fa6cb965f83cab8",
  observed: "docs-2026-09-12-stable21",
  selected: "docs-2026-09-16-stable25",
  profile_blob: "81daa0ccde2d9075374f70ac7f8281f751e9e4c0",
  caller_blob: "240d13c9528dc56a869bb13e9a7d3712d875484f",
  projection_blob: "ed4e08d2be259269e308b2a38c1a6a3aaf3f0951",
  runner_script_blob: "48f326515fb47ce0b41e49596bc2467020e9655b",
  // This incident's controller data is the exact central base snapshot.
  // Another snapshot requires a newly reviewed incident tuple.
  controller_snapshot_sha: "a9521f1f54a9ea836da6ade82344a3c9baded356",
});
const SHA = /^(?!0{40}$)[0-9a-f]{40}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const need = (condition, message) => { if (!condition) {throw new Error(`Platform recovery: ${message}`);} };
const equal = (actual, expected, label) => need(isDeepStrictEqual(actual, expected), `${label} differs`);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const manifestIdentity = (bytes) => ({ type: "blob", mode: "100644", blob: recoveryBlob(bytes),
  bytes: bytes.length, sha256: recoveryDigest(bytes) });
function closed(value, keys, label) {
  need(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  equal(Object.keys(value).toSorted(), keys.split(" ").toSorted(), `${label} fields`);
}
function time(value) {
  need(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace("Z", ".000Z"),
  "invalid exact UTC time");
  return Date.parse(value);
}
function changedKeys(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !isDeepStrictEqual(before[key], after[key]));
}
export function platformRecoveryDecisionText(record, incident = PLATFORM_RECOVERY) {
  return `Authorize Platform admission cycle recovery ${record.id}\n` +
    `Central PR: ${record.central_pull}\n` +
    `Central policy: ${record.before_policy_blob} -> ${record.after_policy_blob}\n` +
    `Platform source: ${incident.source_head}\n` +
    `Failed run: ${record.failure.run_id}/${record.failure.attempt}/${record.failure.authorize_job_id}\n` +
    `Proof: ${record.proof.revision}:${record.proof.path}@${record.proof.blob}\n` +
    `Expires: ${record.expires_at}\n`;
}

export function validatePlatformPolicyTransition(before, after, registry, asOf, incident = PLATFORM_RECOVERY) {
  equal(changedKeys(before, after), ["repositories"], "policy top-level transition");
  need(before.repositories.length === after.repositories.length, "repository inventory changed");
  const changed = [];
  for (let index = 0; index < before.repositories.length; index += 1) {
    const prior = before.repositories[index];
    const next = after.repositories[index];
    need(prior.repository_id === next.repository_id && prior.repository === next.repository, "repository order/identity changed");
    if (!isDeepStrictEqual(prior, next)) {changed.push([prior, next]);}
  }
  need(changed.length === 1 && changed[0][0].repository_id !== incident.repository_id,
    "recovery permits exactly one non-Platform selection");
  const [prior, next] = changed[0];
  equal(changedKeys(prior, next).toSorted(),
    ["cohort_binding_status", "desired_cohort_id"], "selection fields");
  need(prior.cohort_binding_status === "bound" && next.cohort_binding_status === "rollout_pending" &&
    prior.observed_cohort_id === next.observed_cohort_id && next.desired_cohort_id !== incident.selected,
  "selection is not one eligible successor");
  const lifecycle = validateDocsQualifiedCohorts(registry, { type: "object" }, { asOf });
  const target = recoveryTarget(registry, next.desired_cohort_id);
  const targetRecord = lifecycle.cohortById.get(target.cohort_id);
  const priorRecord = lifecycle.cohortById.get(prior.observed_cohort_id);
  need(target.generation === next.desired_cohort_generation &&
    isDocsCohortSelectableForRepository(targetRecord, lifecycle.stateById.get(target.cohort_id), prior.repository_id) &&
    docsCohortTransitionKind(priorRecord, targetRecord) === "upgrade",
  "successor lacks qualified reachable eligibility");
  const platform = before.repositories.find((row) => row.repository_id === incident.repository_id);
  equal(after.repositories.find((row) => row.repository_id === incident.repository_id), platform,
    "Platform policy row");
  need(platform?.repository === incident.repository && platform.admission_status === "admitted" &&
    platform.observed_cohort_id === incident.observed &&
    platform.desired_cohort_id === incident.observed && platform.cohort_binding_status === "bound",
  "Platform policy is not the preserved stable21 observation");
  return { platform, target, changed_repository_id: prior.repository_id };
}

export function validatePlatformRecoveryRecord(record, input, incident = PLATFORM_RECOVERY) {
  // This record is committed in the execution base. Its own commit SHA cannot
  // appear inside it. The final PR/base/head tuple is a separate, independently
  // accepted coordinate supplied by the installed guard, never by the PR head.
  closed(record, "schema_version id state valid_from expires_at central_pull execution_decision_id before_policy_blob after_policy_blob registry_blob exceptions_blob proof owner_decision failure", "record");
  need(record.schema_version === 1 && /^[a-z0-9][a-z0-9-]{0,79}$/u.test(record.id) &&
    ["active", "revoked", "retired"].includes(record.state), "invalid record identity/state");
  const start = time(record.valid_from);
  const end = time(record.expires_at);
  const now = time(input.asOf);
  need(end > start && end - start <= 7 * 86400_000 && record.state === "active" &&
    now >= start && now < end, "authority expired, revoked, retired, or not yet valid");
  need(record.before_policy_blob === incident.before_policy_blob &&
    record.after_policy_blob === incident.after_policy_blob &&
    record.registry_blob === incident.registry_blob &&
    record.exceptions_blob === incident.exceptions_blob, "incident authority blobs are not exact");
  need(record.central_pull === incident.central_pull && positive(record.execution_decision_id) &&
    [record.before_policy_blob, record.after_policy_blob, record.registry_blob,
    record.exceptions_blob].every((value) => SHA.test(value)), "invalid central coordinates");
  const execution = input.execution;
  equal(execution.controller, { repository: "agent-teams-ai/.github", repository_id: 1316243981 }, "central identity");
  const accepted = input.accepted_execution;
  closed(accepted, "controller pull_number pull_id branch head_ref base head direction manifest_digest guard_blob guard_test_blob verifier_blob decision_id run_id run_attempt deadline", "accepted execution");
  equal(accepted.controller, execution.controller, "accepted central identity");
  need(accepted.pull_number === record.central_pull && positive(accepted.pull_id) &&
    accepted.branch === "main" && /^[a-zA-Z0-9_./-]+$/u.test(accepted.head_ref) &&
    accepted.direction === "forward" &&
    SHA.test(accepted.base) && SHA.test(accepted.head) && accepted.base !== accepted.head &&
    DIGEST.test(accepted.manifest_digest) && SHA.test(accepted.guard_blob) &&
    SHA.test(accepted.guard_test_blob) && SHA.test(accepted.verifier_blob) &&
    accepted.decision_id === record.execution_decision_id &&
    positive(accepted.run_id) && positive(accepted.run_attempt) &&
    time(accepted.deadline) > now && time(accepted.deadline) - now <= 86400_000,
  "accepted execution tuple is invalid or expired");
  need(record.central_pull === execution.pull_number && accepted.base === execution.base &&
    accepted.head === execution.head && accepted.pull_id === execution.pull_id &&
    accepted.head_ref === execution.head_ref && accepted.run_id === execution.run_id &&
    accepted.run_attempt === execution.run_attempt && execution.execution_base === execution.base,
  "stale or replayed central PR/base/head");
  equal(execution.changed_files, [POLICY_PATH], "complete permitted PR diff");
  equal(record.before_policy_blob, recoveryBlob(input.basePolicyBytes), "before policy blob");
  equal(record.after_policy_blob, recoveryBlob(input.proposedPolicyBytes), "after policy blob");
  equal(record.registry_blob, recoveryBlob(input.registryBytes), "registry blob");
  equal(record.exceptions_blob, recoveryBlob(input.exceptionsBytes), "exceptions blob");
  need(record.before_policy_blob !== record.after_policy_blob, "empty policy operation");
  const executionManifest = [{ path: POLICY_PATH, status: "modified",
    old: manifestIdentity(input.basePolicyBytes), new: manifestIdentity(input.proposedPolicyBytes) }];
  need(accepted.manifest_digest === recoveryDigest(Buffer.from(JSON.stringify(executionManifest))),
    "accepted execution manifest digest differs from policy bytes");
  const transition = validatePlatformPolicyTransition(JSON.parse(input.basePolicyBytes),
    JSON.parse(input.proposedPolicyBytes), JSON.parse(input.registryBytes), input.asOf, incident);
  closed(record.proof, "revision path blob", "proof");
  need(SHA.test(record.proof.revision) && SHA.test(record.proof.blob) &&
    /^governance\/evidence\/docs-admission-recovery\/[a-z0-9-]+\.json$/u.test(record.proof.path),
  "proof must be an immutable base-owned incident record");
  closed(record.owner_decision, "comment_id actor_id actor_login body_digest", "owner decision");
  need(positive(record.owner_decision.comment_id) && positive(record.owner_decision.actor_id) &&
    /^[A-Za-z0-9-]+$/u.test(record.owner_decision.actor_login) &&
    DIGEST.test(record.owner_decision.body_digest), "owner decision identity/content invalid");
  closed(record.failure, "run_id attempt workflow_id authorize_job_id semantic_job_id diagnostic_digest", "failed execution");
  need(["run_id", "attempt", "workflow_id", "authorize_job_id", "semantic_job_id"]
    .every((key) => positive(record.failure[key])) && DIGEST.test(record.failure.diagnostic_digest),
  "failed run/attempt/jobs/diagnostic invalid");
  return transition;
}

const GENERATION_DIAGNOSTIC = "Central consumer policy does not explicitly match the Cohort generation.";
const GENERATION_SOURCE = `  const selectedGeneration = policyEntry.desired_cohort_id === record.cohort_id
    ? policyEntry.desired_cohort_generation
    : policyEntry.observed_cohort_id === record.cohort_id
      ? policyEntry.observed_cohort_generation
      : undefined;
  assert(record.cohort_generation === 2
    ? selectedGeneration === 2
    : selectedGeneration === undefined,
  "${GENERATION_DIAGNOSTIC}");`;

async function verifyGenerationDiagnostic(adapters, incident, platform, selected, projection, log, digest) {
  need(Buffer.isBuffer(log) && recoveryDigest(log) === digest, "trusted authorization log digest differs");
  const controller = await adapters.readGitFile("agent-teams-ai/.github",
    selected.workflow.path, selected.workflow.revision);
  need(Buffer.isBuffer(controller) && recoveryBlob(controller) === selected.workflow.blob_sha &&
    controller.toString("utf8").split("\n").slice(111, 114).join("\n") ===
      `      - name: Authorize exact consumer snapshot without executing consumer code\n` +
      `        id: authorization\n` +
      `        run: node "$TRUSTED_GOVERNANCE_ROOT/scripts/verify-docs-consumer-gate.mjs" authorize` &&
    controller.toString("utf8").split("\n")[119] ===
      "          CONTROLLER_SNAPSHOT_SHA: ${{ steps.authority.outputs.controller-sha }}" &&
    controller.toString("utf8").split("\n").filter((line) =>
      line.trim() === "core.setOutput(\"controller-sha\", revision);").length === 1,
  "pinned controller authorization step/source coordinate differs");
  const source = await adapters.readGitFile("agent-teams-ai/.github",
    "scripts/verify-docs-consumer-gate.mjs", selected.workflow.revision);
  need(Buffer.isBuffer(source) && recoveryBlob(source) === incident.runner_script_blob &&
    source.toString("utf8").split("\n").slice(791, 800).join("\n") === GENERATION_SOURCE,
  "pinned runner generation assertion/source coordinate differs");
  // The pinned authorize command reaches this assertion after selecting the
  // managed projection's Cohort. The central policy selects stable21 only.
  const selectedGeneration = platform.desired_cohort_id === projection.cohortId
    ? platform.desired_cohort_generation
    : platform.observed_cohort_id === projection.cohortId
      ? platform.observed_cohort_generation
      : undefined;
  need(selected.generation === 2 && selectedGeneration === undefined &&
    platform.desired_cohort_id === incident.observed && projection.cohortId === incident.selected,
  "pinned runner does not reproduce the generation rejection");
  const lines = log.toString("utf8").split(/\r?\n/u);
  need(lines.filter((line) => /^(?:[0-9T:.Z-]+ )?(?:Error: )?Central consumer policy does not explicitly match the Cohort generation\.$/u.test(line)).length === 1,
  "trusted authorization log lacks the unique reproduced generation diagnostic");
  const declarations = lines.filter((line) =>
    /^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z )?\s*CONTROLLER_SNAPSHOT_SHA:/u.test(line));
  const match = declarations.length === 1 &&
    /^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z )?\s*CONTROLLER_SNAPSHOT_SHA: ([0-9a-f]{40})\s*$/u.exec(declarations[0]);
  need(match && SHA.test(match[1]) && match[1] === incident.controller_snapshot_sha &&
    incident.controller_snapshot_sha === incident.historical_base,
  "trusted authorization log lacks the unique incident controller snapshot");
  return match[1];
}

async function verifyControllerSnapshot(adapters, snapshot, incident, input) {
  for (const [path, expected, bytes] of [
    [POLICY_PATH, incident.before_policy_blob, input.basePolicyBytes],
    ["governance/docs-qualified-cohorts.json", incident.registry_blob, input.registryBytes],
    ["governance/docs-protocol-exceptions.json", incident.exceptions_blob, input.exceptionsBytes],
  ]) {
    const actual = await adapters.readGitFile("agent-teams-ai/.github", path, snapshot);
    need(Buffer.isBuffer(actual) && recoveryBlob(actual) === expected && actual.equals(bytes),
      `controller snapshot ${path} Git blob differs`);
  }
}

export async function verifyPlatformAdmissionRecovery(record, input, adapters, entry, sourceHead,
  incident = PLATFORM_RECOVERY) {
  need(entry?.repository_id === incident.repository_id &&
    sourceHead === incident.source_head, "wrong Platform row or source head");
  need(positive(record?.execution_decision_id), "no independently accepted execution decision is bound");
  const decision = await adapters.getDecisionComment("agent-teams-ai/.github", record.execution_decision_id);
  const accepted = parseIncidentJson(Buffer.from(decision?.body ?? ""), "accepted Platform execution");
  need(decision.id === record.execution_decision_id && accepted.decision_id === decision.id &&
    decision.user?.id === record.owner_decision.actor_id &&
    decision.user?.login === record.owner_decision.actor_login && decision.user?.type === "User" &&
    decision.issue_url === `https://api.github.com/repos/agent-teams-ai/.github/issues/${record.central_pull}`,
  "independent execution decision identity differs");
  const permission = await adapters.getCollaboratorPermission("agent-teams-ai/.github", decision.user.login);
  need(permission.permission === "admin" && permission.user?.id === decision.user.id &&
    permission.user?.login === decision.user.login, "execution decision actor lacks current admin authority");
  for (const [path, expected] of [
    [".github/workflows/docs-platform-recovery-installation-r317.yml", accepted.guard_blob],
    ["scripts/docs-platform-recovery-installation-r317.test.mjs", accepted.guard_test_blob],
    ["scripts/verify-docs-platform-recovery-installation-r317.mjs", accepted.verifier_blob],
  ]) {
    const bytes = await adapters.readGitFile("agent-teams-ai/.github", path, input.execution.base);
    need(Buffer.isBuffer(bytes) && recoveryBlob(bytes) === expected, `installed guard ${path} blob differs`);
  }
  const result = await verifyPlatformRecoveryCandidateEvidence(record,
    { ...input, accepted_execution: accepted }, adapters, incident);
  equal(await adapters.getDecisionComment("agent-teams-ai/.github", record.execution_decision_id),
    decision, "stable execution decision");
  const finalPermission = await adapters.getCollaboratorPermission("agent-teams-ai/.github", decision.user.login);
  need(finalPermission.permission === "admin" && finalPermission.user?.id === decision.user.id &&
    finalPermission.user?.login === decision.user.login,
  "execution decision actor lost current admin authority");
  const finalTime = await adapters.currentTime();
  need(typeof finalTime === "string" && time(finalTime) >= time(input.asOf), "final clock regressed");
  validatePlatformRecoveryRecord(record, { ...input, accepted_execution: accepted, asOf: finalTime }, incident);
  input.onVerifiedExecution?.(accepted);
  return { ...result, status: "recovery_pending" };
}

// Candidate evidence verifier for isolated review fixtures only. It is not an
// admission result or owner authorization. The public entry above stays closed
// until a separate, exact-byte guard/authority installation is reviewed.
export async function verifyPlatformRecoveryCandidateEvidence(record, input, adapters,
  incident = PLATFORM_RECOVERY) {
  const { platform, changed_repository_id } = validatePlatformRecoveryRecord(record, input, incident);
  const repo = incident.repository;
  const head = incident.source_head;
  const evidence = platform.observed_default_branch_evidence;
  const owner = record.owner_decision;
  need(await adapters.isCommitAncestor("agent-teams-ai/.github", record.proof.revision, input.execution.base),
    "proof is not base-owned ancestry");
  const proofBytes = await adapters.readGitFile("agent-teams-ai/.github", record.proof.path, record.proof.revision);
  need(Buffer.isBuffer(proofBytes) && recoveryBlob(proofBytes) === record.proof.blob,
    "proof Git blob differs");
  const proof = parseIncidentJson(proofBytes, "Platform incident proof");
  closed(proof, "schema_version repository_id source_head selected_cohort profile_blob caller_blob projection_blob run_id attempt workflow_id authorize_job_id semantic_job_id diagnostic_digest", "incident proof");
  equal(proof, { schema_version: 1, repository_id: incident.repository_id, source_head: head,
    selected_cohort: incident.selected, profile_blob: incident.profile_blob,
    caller_blob: incident.caller_blob, projection_blob: incident.projection_blob,
    ...record.failure }, "incident proof");
  const comment = await adapters.getDecisionComment("agent-teams-ai/.github", owner.comment_id);
  const body = platformRecoveryDecisionText(record, incident);
  need(comment.id === owner.comment_id && comment.user?.id === owner.actor_id &&
    comment.user?.login === owner.actor_login && comment.user?.type === "User" &&
    comment.body === body && recoveryDigest(Buffer.from(body)) === owner.body_digest &&
    comment.issue_url === `https://api.github.com/repos/agent-teams-ai/.github/issues/${record.central_pull}`,
  "owner decision is not independently accepted for this exact tuple");
  const permission = await adapters.getCollaboratorPermission("agent-teams-ai/.github", owner.actor_login);
  need(permission.permission === "admin" && permission.user?.id === owner.actor_id &&
    permission.user?.login === owner.actor_login, "decision actor lacks current owner authority");
  const repository = await adapters.getRepository(repo);
  need(repository.id === incident.repository_id && repository.full_name === repo &&
    repository.default_branch === "main" && repository.archived === false && repository.disabled === false &&
    evidence.default_branch === "main", "Platform live repository identity/lifecycle changed");
  need(await adapters.getDefaultBranchHead(repo, "main") === head &&
    await adapters.isCommitAncestor(repo, evidence.revision, head), "Platform source head drifted");
  for (const [path, blob] of [[platform.profile_path, incident.profile_blob],
    [platform.caller_workflow_path, incident.caller_blob],
    ["architecture/foundation/docs-protocol-managed-state.json", incident.projection_blob]]) {
    const bytes = await adapters.readGitFile(repo, path, head);
    need(Buffer.isBuffer(bytes) && recoveryBlob(bytes) === blob, `${path} source blob drifted`);
  }
  const projection = JSON.parse(await adapters.readGitFile(repo,
    "architecture/foundation/docs-protocol-managed-state.json", head));
  const selected = recoveryTarget(JSON.parse(input.registryBytes), incident.selected);
  need(projection.cohortId === incident.selected &&
    projection.cohortAuthority.recordDigest === selected.record_digest &&
    projection.cohortAuthority.qualificationEventDigest === selected.event_digest &&
    selected.workflow.revision === platform.reusable_workflow_revision,
  "source projection/qualified runner differs");
  const checks = await adapters.getCheckRuns(repo, head);
  const context = evidence.required_context;
  selectLatestFailedSourceCheck(checks, context, record.failure.semantic_job_id,
    record.failure.run_id);
  const run = await adapters.getWorkflowRun(repo, record.failure.run_id);
  need(run.id === record.failure.run_id && run.run_attempt === record.failure.attempt &&
    run.workflow_id === record.failure.workflow_id && run.head_sha === head &&
    run.head_branch === "main" && run.path === platform.caller_workflow_path &&
    run.event === "push" && run.status === "completed" && run.conclusion === "failure" &&
    run.repository?.id === incident.repository_id && run.repository?.full_name === repo &&
    run.referenced_workflows?.length === 1 && run.referenced_workflows[0].sha === selected.workflow.revision &&
    run.referenced_workflows[0].path === `agent-teams-ai/.github/${selected.workflow.path}@${selected.workflow.revision}`,
  "failed default-branch run/runner differs");
  const jobs = await adapters.getWorkflowJobs(repo, run.id, run.run_attempt);
  verifyLegacyFailureJobs(jobs, { id: run.id, attempt: run.run_attempt,
    head, repository: repo }, record.failure.authorize_job_id);
  need(jobs.find((job) => job.name?.split(" / ").at(-1) === "docs-protocol-check")?.id ===
    record.failure.semantic_job_id, "failed semantic job identity differs");
  const log = await adapters.getJobLog(repo, record.failure.authorize_job_id);
  const snapshot = await verifyGenerationDiagnostic(adapters, incident, platform, selected, projection, log,
    record.failure.diagnostic_digest);
  await verifyControllerSnapshot(adapters, snapshot, incident, input);
  // Installation must bind this port to the ordinary full-fleet verifier and
  // propagate every uncovered consumer failure. No such adapter is installed.
  need(typeof adapters.evaluateRemainingFleet === "function",
    "remaining fleet verifier is not installed");
  await adapters.evaluateRemainingFleet({ platform_repository_id: incident.repository_id,
    changed_repository_id });
  need(await adapters.getDefaultBranchHead(repo, "main") === head,
    "Platform head changed during verification");
  equal(await adapters.getCheckRuns(repo, head), checks, "stable complete check set");
  equal(await adapters.getWorkflowRun(repo, run.id), run, "stable run attempt");
  equal(await adapters.getDecisionComment("agent-teams-ai/.github", owner.comment_id), comment,
    "stable accepted decision");
  const finalPermission = await adapters.getCollaboratorPermission("agent-teams-ai/.github", owner.actor_login);
  need(finalPermission.permission === "admin" && finalPermission.user?.id === owner.actor_id &&
    finalPermission.user?.login === owner.actor_login, "decision actor lost current owner authority");
  const fresh = await adapters.currentTime();
  need(typeof fresh === "string" && time(fresh) >= time(input.asOf), "final clock regressed");
  validatePlatformRecoveryRecord(record, { ...input, asOf: fresh }, incident);
  return { repository_id: incident.repository_id, source_head: head,
    status: "candidate_evidence_only", semantics: "unverified", qualification: "unverified" };
}
