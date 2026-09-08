import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export const RECOVERY_AUTHORITY_PATH = "governance/docs-admission-recovery.json";
export const POLICY_PATH = "governance/docs-protocol-policy-v2.json";
export const REGISTRY_PATH = "governance/docs-qualified-cohorts.json";
export const EXCEPTIONS_PATH = "governance/docs-protocol-exceptions.json";
const MAX_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
const SHA = /^(?!0{40}$)[0-9a-f]{40}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const capabilities = new WeakMap();
const need = (condition, message) => { if (!condition) throw new Error(`Admission recovery: ${message}`); };
const equal = (actual, expected, label) => need(isDeepStrictEqual(actual, expected), `${label} differs`);
const positive = (n) => Number.isSafeInteger(n) && n > 0;
export const recoveryBlob = (bytes) => createHash("sha1")
  .update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest("hex");
export const recoveryDigest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function closed(value, keys, label) {
  need(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  equal(Object.keys(value).sort(), keys.split(" ").sort(), `${label} fields`);
}
function coordinate(value, label) {
  closed(value, "revision path blob", label);
  need(SHA.test(value.revision) && SHA.test(value.blob), `${label} requires immutable Git coordinates`);
  need(typeof value.path === "string" && /^[a-zA-Z0-9_./-]+$/u.test(value.path) &&
    value.path.split("/").every((part) => part && part !== "." && part !== ".."), `${label} path invalid`);
}
function identity(value, label) {
  closed(value, "repository repository_id", label);
  need(REPOSITORY.test(value.repository) && positive(value.repository_id), `${label} identity invalid`);
}
function timestamp(value, label) {
  need(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace("Z", ".000Z"),
  `${label} must be an exact UTC timestamp`);
  return Date.parse(value);
}

export function recoveryTarget(registry, cohortId) {
  const record = registry.cohorts.find((row) => row.cohort_id === cohortId);
  const qualification = registry.events.find((row) => row.cohort_id === cohortId && row.state === "QUALIFIED");
  need(record && qualification, "target has no qualified record");
  return { cohort_id: cohortId, record_digest: record.record_digest, event_digest: qualification.event_digest,
    generation: record.cohort_generation ?? 1, workflow: record.reusable_workflow, packages: record.packages };
}

export function validateRecoveryAuthority(authority) {
  closed(authority, "schema_version authorizations", "authority");
  need(authority.schema_version === 1 && Array.isArray(authority.authorizations) &&
    authority.authorizations.length <= 32, "invalid bounded authority version/count");
  const ids = new Set();
  for (const record of authority.authorizations) {
    closed(record, "id state valid_from expires_at controller pull_number operation incidents", "authorization");
    need(typeof record.id === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/u.test(record.id) && !ids.has(record.id),
      "invalid or duplicate incident authorization ID");
    ids.add(record.id);
    need(["active", "revoked", "retired"].includes(record.state), "invalid authorization state");
    const start = timestamp(record.valid_from, "valid_from");
    const end = timestamp(record.expires_at, "expires_at");
    need(end > start && end - start <= MAX_VALIDITY_MS, "authorization exceeds seven-day window");
    identity(record.controller, "controller");
    need(positive(record.pull_number), "central PR must be bound");
    const op = record.operation;
    closed(op, "kind repository_id before_policy_blob after_policy_blob registry_blob exceptions_blob target", "operation");
    need(["selection", "observation"].includes(op.kind) && positive(op.repository_id), "invalid operation");
    for (const field of ["before_policy_blob", "after_policy_blob", "registry_blob", "exceptions_blob"]) {
      need(SHA.test(op[field]), `invalid ${field}`);
    }
    need(op.before_policy_blob !== op.after_policy_blob, "empty operation");
    closed(op.target, "cohort_id record_digest event_digest generation workflow packages", "target");
    need(typeof op.target.cohort_id === "string" && DIGEST.test(op.target.record_digest) &&
      DIGEST.test(op.target.event_digest) && [1, 2].includes(op.target.generation), "invalid target coordinates");
    // Nested workflow/package structure is compared to the entire strictly
    // validated registry record before a capability can be created.
    need(Array.isArray(record.incidents) && record.incidents.length > 0 && record.incidents.length <= 32,
      "operation requires finite explicit incident coverage");
    const repositories = new Set();
    for (const incident of record.incidents) {
      closed(incident, "source_entry source_head proof owner_decision", "incident");
      const entry = incident.source_entry;
      need(entry && positive(entry.repository_id) && REPOSITORY.test(entry.repository) &&
        !repositories.has(entry.repository_id), "invalid/duplicate covered repository");
      repositories.add(entry.repository_id);
      need(SHA.test(incident.source_head), "source head must be bound");
      coordinate(incident.proof, "proof");
      need(incident.proof.path.startsWith("governance/evidence/docs-admission-recovery/"), "proof outside inert archive");
      closed(incident.owner_decision, "comment_id actor_id actor_login body_digest", "owner decision");
      const decision = incident.owner_decision;
      need(positive(decision.comment_id) && positive(decision.actor_id) &&
        typeof decision.actor_login === "string" && /^[A-Za-z0-9-]+$/u.test(decision.actor_login) &&
        DIGEST.test(decision.body_digest), "owner decision must bind independent identity/content");
    }
  }
  return authority;
}

function changedKeys(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !isDeepStrictEqual(before[key], after[key]));
}

function verifyTransition(before, after, record, registry) {
  const op = record.operation;
  equal(changedKeys(before, after), ["repositories"], "top-level policy transition");
  need(before.repositories.length === after.repositories.length, "repository inventory changed");
  const changed = [];
  before.repositories.forEach((row, index) => {
    const next = after.repositories[index];
    need(row.repository_id === next.repository_id && row.repository === next.repository, "identity/order changed");
    if (!isDeepStrictEqual(row, next)) changed.push([row, next]);
  });
  need(changed.length === 1 && changed[0][0].repository_id === op.repository_id, "unrelated policy rows changed");
  const [prior, next] = changed[0];
  need(prior.admission_status === "admitted" && next.admission_status === "admitted" &&
    prior.repository_lifecycle === "active" && next.repository_lifecycle === "active" &&
    prior.docs_role === "consumer" && next.docs_role === "consumer", "operation cannot change admission/lifecycle");
  equal(op.target, recoveryTarget(registry, next.desired_cohort_id), "exact target tuple");
  const fields = changedKeys(prior, next);
  if (op.kind === "selection") {
    need(fields.every((key) => ["desired_cohort_id", "desired_cohort_generation", "cohort_binding_status"].includes(key)) &&
      fields.includes("desired_cohort_id") && next.cohort_binding_status === "rollout_pending",
    "selection may only select an explicit successor");
  } else {
    const allowed = new Set(["cohort_binding_status", "observed_cohort_id", "observed_cohort_record_digest",
      "observed_cohort_event_digest", "observed_cohort_generation", "observed_default_branch_evidence",
      "exact_package_version", "exact_foundation_version", "exact_cohort_v2_packages", "reusable_workflow_revision", "qualification"]);
    need(fields.every((key) => allowed.has(key)) && fields.includes("observed_default_branch_evidence") &&
      next.observed_cohort_id === prior.desired_cohort_id && next.cohort_binding_status === "bound" &&
      prior.cohort_binding_status === "rollout_pending", "observation is not exact selected-target finalization");
    equal(next.qualification, { ...prior.qualification, observed_revision: next.observed_default_branch_evidence.revision },
      "observation qualification snapshot");
  }
  for (const incident of record.incidents) {
    const row = before.repositories.find((entry) => entry.repository_id === incident.source_entry.repository_id);
    equal(incident.source_entry, row, "covered source binding");
    need(row.admission_status === "admitted" && row.repository_lifecycle === "active" &&
      ["bound", "rollout_pending"].includes(row.cohort_binding_status), "covered source is not active and bound");
    if (row.repository_id !== op.repository_id) {
      equal(after.repositories.find((entry) => entry.repository_id === row.repository_id), row, "collateral row");
    }
  }
}

// This API is invoked only by trusted base-owned code. readBaseFile must read
// immutable base Git objects, never materialized PR data. The capability is
// process-local: serialized output can never be replayed as an authorization.
export async function prepareAdmissionRecovery(input) {
  const { execution, readBaseFile } = input;
  closed(execution, "controller pull_number base head execution_base changed_files", "execution");
  identity(execution.controller, "execution controller");
  need(positive(execution.pull_number) && SHA.test(execution.base) && SHA.test(execution.head) &&
    execution.base !== execution.head && execution.execution_base === execution.base, "stale/unbound execution");
  equal(execution.changed_files, [POLICY_PATH], "complete allowed recovery diff");
  const authorityBytes = await readBaseFile(RECOVERY_AUTHORITY_PATH, execution.base);
  if (authorityBytes === null) return null;
  const authority = validateRecoveryAuthority(JSON.parse(authorityBytes.toString("utf8")));
  const beforeBytes = await readBaseFile(POLICY_PATH, execution.base);
  const registryBytes = await readBaseFile(REGISTRY_PATH, execution.base);
  const exceptionsBytes = await readBaseFile(EXCEPTIONS_PATH, execution.base);
  equal(input.basePolicyBytes, beforeBytes, "trusted base policy bytes");
  equal(input.registryBytes, registryBytes, "trusted full registry bytes");
  equal(input.exceptionsBytes, exceptionsBytes, "unchanged exceptions bytes");
  const matches = authority.authorizations.filter((record) =>
    isDeepStrictEqual(record.controller, execution.controller) && record.pull_number === execution.pull_number &&
    record.operation.before_policy_blob === recoveryBlob(beforeBytes) &&
    record.operation.after_policy_blob === recoveryBlob(input.proposedPolicyBytes));
  need(matches.length === 1, "no unique authority for this exact PR/policy operation");
  const [record] = matches;
  const now = timestamp(input.asOf, "evaluation time");
  need(record.state === "active" && now >= Date.parse(record.valid_from) && now < Date.parse(record.expires_at),
    "authorization is expired, revoked, retired or not yet active");
  equal(record.operation.registry_blob, recoveryBlob(registryBytes), "current registry authority");
  equal(record.operation.exceptions_blob, recoveryBlob(exceptionsBytes), "exceptions authority");
  verifyTransition(JSON.parse(beforeBytes), JSON.parse(input.proposedPolicyBytes), record, JSON.parse(registryBytes));
  const capability = Object.freeze({ id: record.id, execution: structuredClone(execution) });
  capabilities.set(capability, { record: structuredClone(record), execution: structuredClone(execution),
    now, beforeBytes: Buffer.from(beforeBytes), registryBytes: Buffer.from(registryBytes),
    pending: new Map(), finalized: false });
  return capability;
}

export function recoveryIncident(capability, entry, head, execution) {
  const state = capabilities.get(capability);
  need(state && !state.finalized, "missing, serialized or finalized capability");
  equal(execution, state.execution, "fresh execution tuple");
  const incident = state.record.incidents.find((row) => row.source_entry.repository_id === entry.repository_id);
  need(incident && incident.source_head === head, "uncovered failure or changed source head");
  // Selection can change only desired fields. The complete before binding was
  // checked at capability creation; current observed source remains immutable.
  for (const key of Object.keys(incident.source_entry)) {
    if (!["desired_cohort_id", "desired_cohort_generation", "cohort_binding_status"].includes(key)) {
      equal(entry[key], incident.source_entry[key], `live source ${key}`);
    }
  }
  need(!(state.record.operation.kind === "observation" && entry.repository_id === state.record.operation.repository_id),
    "observed advancement requires current target success, never pending");
  return structuredClone(incident);
}

export function recoveryDecisionText(capability, incident) {
  const state = capabilities.get(capability);
  need(state && !state.finalized, "missing/finalized capability");
  return `Authorize central admission recovery ${state.record.id}\n` +
    `Repository: ${state.record.controller.repository} (${state.record.controller.repository_id})\n` +
    `PR: ${state.record.pull_number}\n` +
    `Policy: ${state.record.operation.before_policy_blob} -> ${state.record.operation.after_policy_blob}\n` +
    `Proof: ${incident.proof.revision}:${incident.proof.path}@${incident.proof.blob}\n` +
    `Expires: ${state.record.expires_at}\n`;
}

// Marking a row pending deliberately has no boolean acceptance input. A later
// evidence verifier must call this only after checking the actual proof and live
// source run. It remains internal to the base-owned process trust boundary.
function recordRecoveryPending(capability, incident, execution) {
  const state = capabilities.get(capability);
  need(state && !state.finalized, "missing/finalized capability");
  equal(execution, state.execution, "pending execution tuple");
  equal(incident, state.record.incidents.find((row) =>
    row.source_entry.repository_id === incident.source_entry.repository_id), "pending incident");
  state.pending.set(incident.source_entry.repository_id, incident.source_head);
}

export function finishAdmissionRecovery(capability, execution, asOf) {
  const state = capabilities.get(capability);
  need(state && !state.finalized, "missing/finalized capability");
  equal(execution, state.execution, "final execution tuple");
  const now = timestamp(asOf, "completion time");
  need(now >= state.now && now < Date.parse(state.record.expires_at), "authorization expired during evaluation");
  state.finalized = true;
  return { authorization_id: state.record.id, execution: structuredClone(state.execution),
    recovery_pending: [...state.pending].map(([repository_id, source_head]) => ({ repository_id, source_head })) };
}

const LEGACY_RUNNERS = new Set([
  "07d49409cb51f6124ad17673860b812a9d7b5f5b",
  "c72dac6ba10660ac9d7e1426759f80a585c39da5",
  "eef92e7fd40f538b4e9ba03e01bbd4e2d23f12f2",
]);
const FAILURE_STEPS = new Map([
  ["trusted-authorize", "Authorize exact consumer snapshot without executing consumer code"],
  ["trusted-qualification", "Require successful trusted structural authorization"],
  ["docs-protocol-check", "Require successful trusted qualification"],
]);

export async function reproduceLegacyParserErrors(policy, registry, schemas, historical) {
  const { default: Ajv2020 } = await import("ajv/dist/2020.js");
  const errors = {};
  for (const [name, document] of [["policy", policy], ["registry", registry]]) {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schemas[name]);
    if (historical !== undefined) need(validate(historical[name]) === true, `historical ${name} is not source-parser compatible`);
    need(validate(document) === false, `legacy ${name} parser did not reproduce rejection`);
    errors[name] = validate.errors;
  }
  return errors;
}

export function verifyLegacyFailureJobs(jobs, run, parserJobId) {
  need(Array.isArray(jobs) && jobs.length === 4 && new Set(jobs.map((job) => job.id)).size === 4,
    "incomplete/ambiguous incident workflow jobs");
  const roles = new Set();
  for (const job of jobs) {
    const role = job.name?.split(" / ").at(-1);
    need(!roles.has(role) && [...FAILURE_STEPS.keys(), "trusted-structural"].includes(role), "unexpected/duplicate job role");
    roles.add(role);
    need(positive(job.id) && job.run_id === run.id && job.run_attempt === run.attempt &&
      job.head_sha === run.head && job.status === "completed", "wrong job run/attempt/head/status");
    need(job.html_url === `https://github.com/${run.repository}/actions/runs/${run.id}/job/${job.id}`,
      "wrong incident job URL");
    if (role === "trusted-structural") {
      need(job.conclusion === "skipped" && Array.isArray(job.steps) && job.steps.length === 0,
        "structural job independently executed or failed");
      continue;
    }
    need(job.conclusion === "failure" && Array.isArray(job.steps) && job.steps.length > 0,
      "incident is not the known parser/dependency failure");
    const failed = job.steps.filter((step) => step.conclusion === "failure");
    need(failed.length === 1 && failed[0].name === FAILURE_STEPS.get(role), "independently failing job step");
    const failureNumber = failed[0].number;
    need(positive(failureNumber) && new Set(job.steps.map((step) => step.number)).size === job.steps.length,
      "invalid/duplicate step identity");
    for (const step of job.steps) {
      need(positive(step.number) && step.status === "completed" &&
        ["success", "failure", "skipped"].includes(step.conclusion), "incomplete/cancelled job step");
      if (step.number < failureNumber) need(step.conclusion === "success", "setup failure before parser/dependency check");
      if (step.number > failureNumber && !/^(Post |Complete job$)/u.test(step.name)) {
        need(step.conclusion === "skipped", "consumer/qualification code executed after dependency failure");
      }
    }
    if (role === "trusted-authorize") need(job.id === parserJobId, "wrong trusted parser job identity");
  }
}

function verifyLogSnapshot(log, snapshot, runner, head, label) {
  const text = log.toString("utf8");
  for (const [name, value] of [["CONTROLLER_SNAPSHOT_SHA", snapshot], ["JOB_WORKFLOW_SHA", runner], ["GITHUB_SHA", head]]) {
    const matches = [...text.matchAll(new RegExp(`(?:^|\\n)(?:[0-9T:.Z-]+ )? *${name}: ([^\\r\\n]+)`, "gu"))];
    need(matches.length === 1 && matches[0][1] === value, `${label} does not uniquely bind ${name}`);
  }
}

export async function verifyRecoveryIncident(capability, entry, head, execution, adapters) {
  const incident = recoveryIncident(capability, entry, head, execution);
  const state = capabilities.get(capability);
  const central = state.record.controller.repository;
  async function read(coordinateValue, label) {
    coordinate(coordinateValue, label);
    need(await adapters.isCommitAncestor(central, coordinateValue.revision, execution.base), `${label} is not base-owned ancestry`);
    const content = await adapters.readGitFile(central, coordinateValue.path, coordinateValue.revision);
    need(Buffer.isBuffer(content) && recoveryBlob(content) === coordinateValue.blob, `${label} blob mismatch`);
    return content;
  }
  const proofBytes = await read(incident.proof, "incident proof");
  const proof = JSON.parse(proofBytes.toString("utf8"));
  closed(proof, "schema_version source_target historical_inputs historical_run current_inputs schemas caller_blob projection_blob parser_errors run jobs parser_job_id parser_log_digest", "proof");
  need(proof.schema_version === 1 && SHA.test(proof.caller_blob) && SHA.test(proof.projection_blob) &&
    positive(proof.parser_job_id) && DIGEST.test(proof.parser_log_digest), "invalid proof bindings");
  const registry = JSON.parse(state.registryBytes);
  equal(proof.source_target, recoveryTarget(registry, incident.source_entry.observed_cohort_id), "source qualification/runner/packages");
  const workflow = proof.source_target.workflow;
  need(LEGACY_RUNNERS.has(workflow.revision) && workflow.repository === central &&
    workflow.path === ".github/workflows/docs-protocol-check.yml", "runner is outside the bounded legacy parser incident");
  const schemas = {};
  const historical = {};
  for (const name of ["historical_inputs", "current_inputs", "schemas", "parser_errors"]) {
    closed(proof[name], "policy registry", name);
  }
  for (const [kind, path, currentBytes] of [["policy", POLICY_PATH, state.beforeBytes],
    ["registry", REGISTRY_PATH, state.registryBytes]]) {
    const old = proof.historical_inputs[kind];
    const current = proof.current_inputs[kind];
    need(old.path === path && current.path === path, `${kind} input uses noncanonical path`);
    // Both snapshots are immutable, ancestor-owned Git objects. They are
    // retained independently; no projection/filtering rewrites current inputs.
    historical[kind] = JSON.parse(await read(old, `historical ${kind}`));
    equal(await read(current, `current ${kind}`), currentBytes, `complete current ${kind}`);
    const schema = proof.schemas[kind];
    need(schema.revision === workflow.revision && schema.path === path.replace(/\.json$/u, ".schema.json"),
      `${kind} schema is not owned by the source runner`);
    schemas[kind] = JSON.parse(await read(schema, `source ${kind} schema`));
    need(Array.isArray(proof.parser_errors[kind]) && proof.parser_errors[kind].length > 0 &&
      proof.parser_errors[kind].length <= 1000, `${kind} parser rejection is missing/unbounded`);
  }
  const errors = await (adapters.reproduceParserErrors ?? reproduceLegacyParserErrors)(
    JSON.parse(state.beforeBytes), registry, schemas, historical);
  equal(errors, proof.parser_errors, "exact parser errors against BOTH current documents");
  need(errors.policy.every((error) => error.keyword === "additionalProperties" &&
    /^\/repositories\/\d+$/u.test(error.instancePath) &&
    ["desired_cohort_generation", "v3_qualification_coordinates"].includes(error.params?.additionalProperty)),
  "arbitrary policy schema failures are not this incident");
  need(errors.registry.some((error) => /^\/cohorts\/\d+/u.test(error.instancePath)),
    "registry error is not the cohort generation incompatibility");

  need(proof.current_inputs.policy.revision === proof.current_inputs.registry.revision &&
    proof.historical_inputs.policy.revision === proof.historical_inputs.registry.revision,
  "policy and registry must share each exact controller snapshot");
  const decision = incident.owner_decision;
  const comment = await adapters.getDecisionComment(central, decision.comment_id);
  const acceptedText = recoveryDecisionText(capability, incident);
  need(comment.id === decision.comment_id && comment.user?.id === decision.actor_id &&
    comment.user?.login === decision.actor_login && comment.user?.type === "User" &&
    comment.body === acceptedText && recoveryDigest(Buffer.from(comment.body)) === decision.body_digest &&
    comment.issue_url === `https://api.github.com/repos/${central}/issues/${state.record.pull_number}`,
  "owner decision identity/content/PR not independently bound");
  const permission = await adapters.getCollaboratorPermission(central, decision.actor_login);
  need(permission.permission === "admin" && permission.user?.id === decision.actor_id &&
    permission.user?.login === decision.actor_login, "decision actor is not the independently verified owner authority");

  const evidence = incident.source_entry.observed_default_branch_evidence;
  const repository = await adapters.getRepository(entry.repository);
  need(repository.id === entry.repository_id && repository.full_name === entry.repository &&
    repository.default_branch === evidence.default_branch && repository.archived === false && repository.disabled === false,
  "live incident source identity/default branch/lifecycle differs");
  need(await adapters.getDefaultBranchHead(entry.repository, repository.default_branch) === head &&
    await adapters.isCommitAncestor(entry.repository, evidence.revision, head), "source drift/force push");
  // Historical input blobs must come from the actual successful source run,
  // not merely an arbitrary compatible ancestor chosen by a proof author.
  closed(proof.historical_run, "attempt authorize_job_id log_digest", "historical run proof");
  need(positive(proof.historical_run.attempt) && positive(proof.historical_run.authorize_job_id) &&
    DIGEST.test(proof.historical_run.log_digest), "historical run proof is unbound");
  const historicalRun = await adapters.getWorkflowRun(entry.repository, evidence.workflow_run_id);
  need(historicalRun.id === evidence.workflow_run_id && historicalRun.run_attempt === proof.historical_run.attempt &&
    historicalRun.workflow_id === evidence.workflow_id && historicalRun.head_sha === evidence.revision &&
    historicalRun.head_branch === evidence.default_branch && historicalRun.path === entry.caller_workflow_path &&
    historicalRun.event === "push" && historicalRun.status === "completed" && historicalRun.conclusion === "success" &&
    historicalRun.repository?.id === entry.repository_id && historicalRun.repository?.full_name === entry.repository,
  "historical input proof does not bind the recorded successful source run");
  need(Array.isArray(historicalRun.referenced_workflows) && historicalRun.referenced_workflows.length === 1 &&
    historicalRun.referenced_workflows[0].sha === workflow.revision &&
    historicalRun.referenced_workflows[0].path === `${central}/${workflow.path}@${workflow.revision}`,
  "historical input proof used a different source runner");
  const historicalJobs = await adapters.getWorkflowJobs(entry.repository, historicalRun.id, historicalRun.run_attempt);
  const authorize = historicalJobs.filter((job) => job.name.split(" / ").at(-1) === "trusted-authorize");
  need(authorize.length === 1 && authorize[0].id === proof.historical_run.authorize_job_id &&
    authorize[0].run_id === historicalRun.id && authorize[0].run_attempt === historicalRun.run_attempt &&
    authorize[0].head_sha === evidence.revision && authorize[0].status === "completed" && authorize[0].conclusion === "success" &&
    authorize[0].html_url === `https://github.com/${entry.repository}/actions/runs/${historicalRun.id}/job/${authorize[0].id}` &&
    authorize[0].steps.filter((step) => step.name === FAILURE_STEPS.get("trusted-authorize") &&
      step.status === "completed" && step.conclusion === "success").length === 1,
  "historical controller snapshot is not from the successful trusted authorization job");
  const historicalLog = await adapters.getJobLog(entry.repository, authorize[0].id);
  need(recoveryDigest(historicalLog) === proof.historical_run.log_digest, "historical trusted log digest differs");
  verifyLogSnapshot(historicalLog, proof.historical_inputs.policy.revision, workflow.revision, evidence.revision,
    "historical trusted authorization log");
  const [caller, projectionBytes] = await Promise.all([
    adapters.readGitFile(entry.repository, entry.caller_workflow_path, head),
    adapters.readGitFile(entry.repository, "architecture/foundation/docs-protocol-managed-state.json", head),
  ]);
  need(recoveryBlob(caller) === proof.caller_blob && recoveryDigest(caller) === registry.cohorts.find((row) =>
    row.cohort_id === incident.source_entry.observed_cohort_id).assets.caller_workflow.rendered_digest,
    "source caller differs from proof/qualified runner");
  need(recoveryBlob(projectionBytes) === proof.projection_blob, "source projection blob differs");
  const projection = JSON.parse(projectionBytes);
  const [historicalProjection, historicalProfile, currentProfile] = await Promise.all([
    adapters.readGitFile(entry.repository, "architecture/foundation/docs-protocol-managed-state.json", evidence.revision),
    adapters.readGitFile(entry.repository, entry.profile_path, evidence.revision),
    adapters.readGitFile(entry.repository, entry.profile_path, head),
  ]);
  equal(projection, JSON.parse(historicalProjection), "unchanged historical source projection");
  equal(currentProfile, historicalProfile, "unchanged historical source profile");
  const authority = projection.cohortAuthority ?? projection;
  need(projection.cohortId === incident.source_entry.observed_cohort_id &&
    authority.recordDigest === proof.source_target.record_digest &&
    authority.qualificationEventDigest === proof.source_target.event_digest, "source projection differs from observed qualification");

  closed(proof.run, "id attempt workflow_id head branch path", "failed run");
  need(positive(proof.run.id) && positive(proof.run.attempt) && positive(proof.run.workflow_id) &&
    proof.run.head === head && proof.run.branch === repository.default_branch &&
    proof.run.path === entry.caller_workflow_path && proof.run.workflow_id === evidence.workflow_id, "failed run coordinates differ");
  const run = await adapters.getWorkflowRun(entry.repository, proof.run.id);
  need(run.id === proof.run.id && run.run_attempt === proof.run.attempt && run.workflow_id === proof.run.workflow_id &&
    run.head_sha === head && run.head_branch === proof.run.branch && run.path === proof.run.path &&
    run.repository?.id === entry.repository_id && run.repository?.full_name === entry.repository &&
    run.event === "push" && run.status === "completed" && run.conclusion === "failure", "wrong live failed run");
  need(Array.isArray(run.referenced_workflows) && run.referenced_workflows.length === 1 &&
    run.referenced_workflows[0].sha === workflow.revision &&
    run.referenced_workflows[0].path === `${central}/${workflow.path}@${workflow.revision}`, "failed run used a different runner");
  const jobs = await adapters.getWorkflowJobs(entry.repository, run.id, run.run_attempt);
  equal(jobs, proof.jobs, "exact failed run/attempt jobs");
  verifyLegacyFailureJobs(jobs, { ...proof.run, repository: entry.repository }, proof.parser_job_id);
  const checks = (await adapters.getCheckRuns(entry.repository, head)).filter((check) =>
    check.name === evidence.required_context && check.app?.id === evidence.integration_id);
  const semantic = jobs.find((job) => job.name.split(" / ").at(-1) === "docs-protocol-check");
  need(checks.length === 1 && checks[0].head_sha === head && checks[0].conclusion === "failure" &&
    checks[0].id === semantic.id && checks[0].html_url === semantic.html_url, "missing/ambiguous/wrong failed required check");
  const log = await adapters.getJobLog(entry.repository, proof.parser_job_id);
  need(recoveryDigest(log) === proof.parser_log_digest, "parser log blob differs");
  const diagnostic = `Central Docs policy schema validation failed: ${errors.policy
    .map(({ instancePath, message }) => `${instancePath || "/"} ${message}`).join("; ")}`;
  const logText = log.toString("utf8");
  verifyLogSnapshot(log, proof.current_inputs.policy.revision, workflow.revision, head, "trusted parser job log");
  need(logText.includes(diagnostic), "hosted failure does not prove the reproduced parser diagnostic");
  need(await adapters.getDefaultBranchHead(entry.repository, repository.default_branch) === head,
    "source changed during incident verification");
  // Reruns and edited/revoked owner decisions invalidate an in-flight proof.
  equal(await adapters.getWorkflowRun(entry.repository, proof.run.id), run, "stable latest source run");
  equal(await adapters.getWorkflowRun(entry.repository, historicalRun.id), historicalRun, "stable historical source run");
  equal(await adapters.getDecisionComment(central, decision.comment_id), comment, "stable owner decision");
  equal(await adapters.getCollaboratorPermission(central, decision.actor_login), permission, "stable owner authority");
  recordRecoveryPending(capability, incident, execution);
  return { repository_id: entry.repository_id, source_head: head, status: "recovery_pending",
    semantics: "unverified", qualification: "unverified", incident_id: state.record.id };
}
