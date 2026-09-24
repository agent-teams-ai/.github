#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { recoveryBlob, verifyLegacyFailureJobs } from "./docs-legacy-admission-recovery.mjs";

// This verifier is installed only after an independently enforced G transition.
// Its source is always read from the protected base checkout. It never runs a
// PR-head script. An absent independently accepted tuple fails closed.
const exec = promisify(execFile);
const REPO = "agent-teams-ai/.github";
const REPO_ID = 1316243981;
const PLATFORM = "agent-teams-ai/agent-teams-platform";
const PLATFORM_ID = 1319378484;
const SOURCE_HEAD = "a3ce96e00df2f9958fbd614e7fa6cb965f83cab8";
const SNAPSHOT = "a9521f1f54a9ea836da6ade82344a3c9baded356";
const SOURCE_BLOBS = {
  profile_blob: "81daa0ccde2d9075374f70ac7f8281f751e9e4c0",
  caller_blob: "240d13c9528dc56a869bb13e9a7d3712d875484f",
  projection_blob: "ed4e08d2be259269e308b2a38c1a6a3aaf3f0951",
};
const SNAPSHOT_BLOBS = {
  "governance/docs-protocol-policy-v2.json": "55717f3171b0359b4eedba338f616ae72d943496",
  "governance/docs-qualified-cohorts.json": "18f59fc7312d78782f65b5f40dcc3774695211af",
  "governance/docs-protocol-exceptions.json": "ac336b865d697b62c938623f2960864e85f7698a",
};
const SHA = /^(?!0{40}$)[0-9a-f]{40}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const G = [
  ".github/workflows/docs-platform-recovery-installation-r317.yml",
  "scripts/docs-platform-recovery-installation-r317.test.mjs",
  "scripts/verify-docs-platform-recovery-installation-r317.mjs",
];
const E = [
  "docs/decisions/0007-platform-admission-cycle-recovery.md",
  "governance/evidence/docs-admission-recovery/platform-a3.json",
];
const I = [
  ".github/workflows/docs-admission-evidence.yml",
  "governance/docs-platform-admission-recovery.json",
  "scripts/docs-admission-change.test.mjs",
  "scripts/docs-admission-workflow.test.mjs",
  "scripts/docs-platform-admission-recovery.mjs",
  "scripts/docs-platform-admission-recovery.test.mjs",
  "scripts/verify-docs-admission-change.mjs",
  "scripts/verify-docs-cohort-evidence.mjs",
];
export const INSTALLATION_PATHS = Object.freeze({ G, E, I });
const need = (ok, message) => { if (!ok) { throw new Error(`r317 installation: ${message}`); } };
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const blob = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const name = (item) => item.path.split("/").at(-1);
const treeSortKey = (item) => Buffer.from(name(item) + (item.type === "tree" ? "/" : ""));
const tuple = (item) => JSON.stringify([item?.id, item?.number, item?.state, item?.merged, item?.draft,
  item?.base?.sha, item?.base?.ref, item?.base?.repo?.id, item?.head?.sha, item?.head?.ref,
  item?.head?.repo?.id, item?.changed_files, item?.commits, item?.updated_at]);
const REQUIRED_CONTEXTS = new Set(["check", "trusted-admission-evidence", "trusted-authority-evolution",
  "trusted-admission-authority-evolution-v1", "trusted-platform-recovery-installation-r317", "trusted-validation"]);
export function verifyMinimumProtections(snapshot) {
  const matches = snapshot?.rulesets?.filter((entry) => entry?.detail?.id === 19979783);
  need(matches?.length === 1, "required Protect main ruleset is missing");
  const { summary, detail } = matches[0];
  need(summary?.id === detail.id && summary.name === "Protect main" &&
    summary.enforcement === "active" && detail.name === "Protect main" &&
    detail.target === "branch" && detail.enforcement === "active" &&
    Array.isArray(detail.bypass_actors) && detail.bypass_actors.length === 0 &&
    Array.isArray(detail.conditions?.ref_name?.include) &&
    detail.conditions.ref_name.include.includes("~DEFAULT_BRANCH") &&
    Array.isArray(detail.conditions.ref_name.exclude) && detail.conditions.ref_name.exclude.length === 0 &&
    Array.isArray(detail.rules), "required Protect main scope or enforcement weakened");
  const types = new Map();
  for (const rule of detail.rules) {
    need(typeof rule?.type === "string" && !types.has(rule.type), "duplicate protection rule type");
    types.set(rule.type, rule);
  }
  for (const type of ["deletion", "non_fast_forward", "required_linear_history", "pull_request"]) {
    need(types.has(type), `required ${type} protection is missing`);
  }
  const checks = types.get("required_status_checks")?.parameters;
  need(checks?.strict_required_status_checks_policy === true && Array.isArray(checks.required_status_checks),
    "strict required status checks are missing");
  const contexts = new Map();
  for (const check of checks.required_status_checks) {
    need(typeof check?.context === "string" && !contexts.has(check.context),
      "duplicate or invalid required check context");
    contexts.set(check.context, check.integration_id);
  }
  for (const context of REQUIRED_CONTEXTS) {
    need(contexts.get(context) === 15368, `required check ${context} or integration differs`);
  }
}
export function parseIncidentJson(bytes, label, limit = 1024 * 1024) {
  need(Buffer.isBuffer(bytes) && bytes.length <= limit, `${label} missing or exceeds byte limit`);
  const source = bytes.toString("utf8");
  need(Buffer.from(source).equals(bytes), `${label} is not exact UTF-8`);
  let offset = 0;
  const space = () => { while (/\s/u.test(source[offset] ?? "")) { offset += 1; } };
  function string() {
    const start = offset++; need(source[start] === '"', `${label} string is invalid`);
    while (offset < source.length) {
      const c = source[offset];
      if (c === '"') { offset += 1; return JSON.parse(source.slice(start, offset)); }
      if (c === "\\") { offset += 2; }
      else { need(c.charCodeAt(0) >= 0x20, `${label} contains control character`); offset += 1; }
    }
    throw new Error(`${label} unterminated string`);
  }
  function value() {
    space(); const c = source[offset];
    if (c === '"') { string(); return; }
    if (c === "{" || c === "[") {
      const object = c === "{"; offset += 1; space(); const keys = new Set();
      if (source[offset] === (object ? "}" : "]")) { offset += 1; return; }
      while (true) {
        if (object) {
          need(source[offset] === '"', `${label} object key is invalid`);
          const key = string(); need(!keys.has(key), `${label} has duplicate key ${key}`); keys.add(key);
          space(); need(source[offset++] === ":", `${label} object colon missing`);
        }
        value(); space();
        if (source[offset] === (object ? "}" : "]")) { offset += 1; return; }
        need(source[offset++] === ",", `${label} separator is invalid`); space();
      }
    }
    const literal = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/u
      .exec(source.slice(offset))?.[0];
    need(literal !== undefined, `${label} literal is invalid`); offset += literal.length;
  }
  value(); space(); need(offset === source.length, `${label} trailing input`);
  return JSON.parse(source);
}
function closed(value, keys, label) {
  need(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  need(JSON.stringify(Object.keys(value).toSorted()) === JSON.stringify(keys.toSorted()), `${label} fields differ`);
}
function instant(value) {
  need(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace("Z", ".000Z"),
  "invalid UTC deadline");
  return Date.parse(value);
}
function identity(repo) {
  need(repo?.id === REPO_ID && repo.full_name === REPO && repo.default_branch === "main" &&
    repo.archived === false && repo.disabled === false, "wrong central repository identity");
}
function manifestRow(row) {
  closed(row, ["path", "status", "old", "new"], "manifest row");
  need(typeof row.path === "string" && /^[a-zA-Z0-9_./-]+$/u.test(row.path) &&
    row.path.split("/").every((part) => part && part !== "." && part !== ".."), "invalid manifest path");
  need(["added", "modified", "removed"].includes(row.status), "invalid manifest status");
  for (const [side, value] of [["old", row.old], ["new", row.new]]) {
    if (value === null) { continue; }
    closed(value, ["type", "mode", "blob", "bytes", "sha256"], `${side} identity`);
    need(value.type === "blob" && value.mode === "100644" && SHA.test(value.blob) &&
      Number.isSafeInteger(value.bytes) && value.bytes >= 0 && DIGEST.test(value.sha256),
    `invalid ${side} identity`);
  }
  need((row.status === "added" && row.old === null && row.new !== null) ||
    (row.status === "modified" && row.old !== null && row.new !== null && row.old.blob !== row.new.blob) ||
    (row.status === "removed" && row.old !== null && row.new === null), "invalid addition/modification/removal");
}
export function validateAcceptedInstallation(accepted, now) {
  closed(accepted, ["schema_version", "stage", "direction", "repository", "repository_id", "pull_number",
    "pull_id", "branch", "head_ref", "base", "head", "manifest", "manifest_digest", "guard_blob",
    "guard_test_blob", "verifier_blob", "run_id", "run_attempt", "decision_comment_id",
    "owner_id", "owner_login", "deadline", "expected_protections_digest",
    "forward_decision_comment_id"], "accepted tuple");
  need(accepted.schema_version === 1 && ["E", "I"].includes(accepted.stage) &&
    ["forward", "inverse"].includes(accepted.direction) &&
    (accepted.direction === "forward" || accepted.stage === "I") &&
    accepted.repository === REPO && accepted.repository_id === REPO_ID &&
    Number.isSafeInteger(accepted.pull_number) && accepted.pull_number > 0 &&
    Number.isSafeInteger(accepted.pull_id) && accepted.pull_id > 0 && accepted.branch === "main" &&
    typeof accepted.head_ref === "string" && /^[a-zA-Z0-9_./-]+$/u.test(accepted.head_ref) &&
    SHA.test(accepted.base) && SHA.test(accepted.head) && accepted.base !== accepted.head &&
    SHA.test(accepted.guard_blob) && SHA.test(accepted.guard_test_blob) && SHA.test(accepted.verifier_blob) &&
    Number.isSafeInteger(accepted.run_id) && accepted.run_id > 0 &&
    Number.isSafeInteger(accepted.run_attempt) && accepted.run_attempt > 0 &&
    Number.isSafeInteger(accepted.decision_comment_id) && accepted.decision_comment_id > 0 &&
    Number.isSafeInteger(accepted.owner_id) && accepted.owner_id > 0 &&
    /^[A-Za-z0-9-]+$/u.test(accepted.owner_login) && DIGEST.test(accepted.expected_protections_digest),
  "invalid incident tuple");
  need(accepted.direction === "inverse" ?
    Number.isSafeInteger(accepted.forward_decision_comment_id) && accepted.forward_decision_comment_id > 0 :
    accepted.forward_decision_comment_id === null,
  "inverse must name the retained forward decision");
  need(instant(accepted.deadline) > now && instant(accepted.deadline) - now <= 86400_000,
    "installation deadline expired or exceeds one day");
  need(Array.isArray(accepted.manifest), "manifest missing");
  const expectedPaths = INSTALLATION_PATHS[accepted.stage].toSorted();
  need(JSON.stringify(accepted.manifest.map((row) => row.path)) === JSON.stringify(expectedPaths),
    "manifest path set/order differs");
  accepted.manifest.forEach(manifestRow);
  need(accepted.stage !== "E" || accepted.manifest.every((row) => row.status === "added"),
    "E must add only evidence and decision");
  need(accepted.stage !== "I" || accepted.manifest.find((row) => row.path ===
    "governance/docs-platform-admission-recovery.json")?.status ===
    (accepted.direction === "forward" ? "added" : "removed"), "I authority transition differs");
  need(sha256(Buffer.from(JSON.stringify(accepted.manifest))) === accepted.manifest_digest,
    "manifest digest differs");
  return accepted;
}
export function verifiedTree(revision, snapshot) {
  const { commit, tree } = snapshot ?? {};
  need(SHA.test(revision) && commit?.sha === revision && SHA.test(commit.tree?.sha) &&
    tree?.sha === commit.tree.sha && tree.truncated === false && Array.isArray(tree.tree) &&
    tree.tree.length > 0 && tree.tree.length <= 20000,
  "incomplete or mismatched immutable commit/tree identity");
  const all = new Map();
  for (const entry of tree.tree) {
    need(typeof entry?.path === "string" && ![...entry.path].some((character) =>
      character.charCodeAt(0) <= 0x1f || character.charCodeAt(0) === 0x7f) &&
      entry.path.split("/").every((part) => part && part !== "." && part !== "..") &&
      !all.has(entry.path) && SHA.test(entry.sha) &&
      ((entry.type === "tree" && entry.mode === "040000") ||
        (entry.type === "blob" && ["100644", "100755"].includes(entry.mode) &&
          Number.isSafeInteger(entry.size) && entry.size >= 0)),
    "invalid immutable-tree entry/type/mode");
    all.set(entry.path, entry);
  }
  const children = new Map([["", []]]);
  for (const item of all.values()) { if (item.type === "tree") { children.set(item.path, []); } }
  for (const item of all.values()) {
    const parent = item.path.includes("/") ? item.path.slice(0, item.path.lastIndexOf("/")) : "";
    need(children.has(parent), "missing immutable-tree parent");
    children.get(parent).push(item);
  }
  for (const [path, items] of children) {
    items.sort((a, b) => Buffer.compare(treeSortKey(a), treeSortKey(b)));
    const bytes = Buffer.concat(items.flatMap((item) => [
      Buffer.from(`${item.mode.replace(/^0/u, "")} ${name(item)}\0`), Buffer.from(item.sha, "hex")
    ]));
    const digest = createHash("sha1").update(`tree ${bytes.length}\0`).update(bytes).digest("hex");
    need(digest === (path ? all.get(path).sha : tree.sha), "immutable-tree metadata hash mismatch");
  }
  return new Map([...all].filter(([, item]) => item.type === "blob"));
}
async function verifySide(expected, actual, api, label) {
  if (expected === null) { need(actual === undefined, `${label} must be absent`); return; }
  need(actual?.type === "blob" && actual.mode === "100644" && actual.sha === expected.blob &&
    actual.size === expected.bytes, `${label} Git type/mode/blob/size differs`);
  const bytes = await api.getBlob(expected.blob);
  need(Buffer.isBuffer(bytes) && bytes.length === expected.bytes && blob(bytes) === expected.blob &&
    sha256(bytes) === expected.sha256, `${label} content digest differs`);
}
export async function verifyStagedEProof(proofBytes, decisionBytes, api) {
  const decision = decisionBytes.toString("utf8");
  need(decision.startsWith("# ADR-0007:") && /^Status: Accepted$/mu.test(decision),
    "E decision is not independently accepted");
  const proof = parseIncidentJson(proofBytes, "E incident proof");
  closed(proof, ["schema_version", "repository_id", "source_head", "selected_cohort", "profile_blob",
    "caller_blob", "projection_blob", "run_id", "attempt", "workflow_id", "authorize_job_id",
    "semantic_job_id", "diagnostic_digest"], "E incident proof");
  need(proof.schema_version === 1 && proof.repository_id === PLATFORM_ID && proof.source_head === SOURCE_HEAD &&
    proof.selected_cohort === "docs-2026-09-16-stable25" &&
    Object.entries(SOURCE_BLOBS).every(([key, value]) => proof[key] === value) &&
    ["run_id", "attempt", "workflow_id", "authorize_job_id", "semantic_job_id"].every((key) =>
      Number.isSafeInteger(proof[key]) && proof[key] > 0) && DIGEST.test(proof.diagnostic_digest),
  "E proof incident identity/failure coordinates differ");
  const source = await api.getSourceRepository();
  need(source?.id === PLATFORM_ID && source.full_name === PLATFORM && source.default_branch === "main" &&
    source.archived === false && source.disabled === false &&
    await api.getSourceHead() === SOURCE_HEAD, "Platform source identity/head drifted");
  const policyBytes = await api.getRepositoryFile(REPO, "governance/docs-protocol-policy-v2.json", SNAPSHOT);
  need(Buffer.isBuffer(policyBytes) && recoveryBlob(policyBytes) === SNAPSHOT_BLOBS["governance/docs-protocol-policy-v2.json"],
    "E controller policy snapshot differs");
  const policy = parseIncidentJson(policyBytes, "E controller policy");
  const row = policy.repositories.find((entry) => entry.repository_id === PLATFORM_ID);
  need(row?.repository === PLATFORM && row.desired_cohort_id === "docs-2026-09-12-stable21" &&
    row.observed_cohort_id === row.desired_cohort_id && row.cohort_binding_status === "bound" &&
    row.observed_default_branch_evidence?.required_context &&
    row.observed_default_branch_evidence?.integration_id === 15368, "E policy row is not preserved stable21");
  for (const [path, expected] of Object.entries(SNAPSHOT_BLOBS)) {
    const bytes = path === "governance/docs-protocol-policy-v2.json" ? policyBytes :
      await api.getRepositoryFile(REPO, path, SNAPSHOT);
    need(Buffer.isBuffer(bytes) && recoveryBlob(bytes) === expected, `E controller ${path} snapshot differs`);
  }
  for (const [path, expected] of [
    [row.profile_path, SOURCE_BLOBS.profile_blob], [row.caller_workflow_path, SOURCE_BLOBS.caller_blob],
    ["architecture/foundation/docs-protocol-managed-state.json", SOURCE_BLOBS.projection_blob],
  ]) {
    const bytes = await api.getRepositoryFile(PLATFORM, path, SOURCE_HEAD);
    need(Buffer.isBuffer(bytes) && recoveryBlob(bytes) === expected, `E source ${path} blob differs`);
  }
  const checks = await api.getSourceChecks();
  need(Array.isArray(checks) && checks.filter((check) =>
    check.name === row.observed_default_branch_evidence.required_context).length === 1,
  "E failed required check is missing/duplicate");
  const check = checks.find((item) => item.name === row.observed_default_branch_evidence.required_context);
  need(check.id === proof.semantic_job_id && check.app?.id === 15368 && check.head_sha === SOURCE_HEAD &&
    check.conclusion === "failure" &&
    check.html_url === `https://github.com/${PLATFORM}/actions/runs/${proof.run_id}/job/${check.id}`,
  "E failed check context/App/job/run differs");
  const sourceRun = await api.getSourceRun(proof.run_id);
  need(sourceRun?.id === proof.run_id && sourceRun.run_attempt === proof.attempt &&
    sourceRun.workflow_id === proof.workflow_id && sourceRun.head_sha === SOURCE_HEAD && sourceRun.head_branch === "main" &&
    sourceRun.event === "push" && sourceRun.path === row.caller_workflow_path && sourceRun.status === "completed" &&
    sourceRun.conclusion === "failure" && sourceRun.repository?.id === PLATFORM_ID &&
    sourceRun.repository?.full_name === PLATFORM && sourceRun.referenced_workflows?.length === 1 &&
    sourceRun.referenced_workflows[0].sha === row.reusable_workflow_revision &&
    sourceRun.referenced_workflows[0].path ===
      `agent-teams-ai/.github/.github/workflows/docs-protocol-check.yml@${row.reusable_workflow_revision}`,
  "E failed run/attempt/source workflow differs");
  const jobs = await api.getSourceJobs(proof.run_id, proof.attempt);
  verifyLegacyFailureJobs(jobs, { id: sourceRun.id, attempt: sourceRun.run_attempt, head: SOURCE_HEAD,
    repository: PLATFORM }, proof.authorize_job_id);
  need(jobs.find((job) => job.name?.split(" / ").at(-1) === "docs-protocol-check")?.id ===
    proof.semantic_job_id, "E semantic job identity differs");
  const log = await api.getSourceLog(proof.authorize_job_id);
  need(Buffer.isBuffer(log) && sha256(log) === proof.diagnostic_digest,
    "E diagnostic log digest differs");
  const text = log.toString("utf8");
  need((text.match(/CONTROLLER_SNAPSHOT_SHA:/gu) ?? []).length === 1 &&
    new RegExp(`(?:^|\\n)(?:[0-9T:.Z-]+ )?\\s*CONTROLLER_SNAPSHOT_SHA: ${SNAPSHOT}(?:\\r?\\n|$)`, "u").test(text) &&
    (text.match(/Central consumer policy does not explicitly match the Cohort generation\./gu) ?? []).length === 1,
  "E controller snapshot or unique generation diagnostic differs");
  need(await api.getSourceHead() === SOURCE_HEAD &&
    JSON.stringify(await api.getSourceChecks()) === JSON.stringify(checks) &&
    JSON.stringify(await api.getSourceRun(proof.run_id)) === JSON.stringify(sourceRun),
  "E source/check/run changed during guard proof");
}
export function validateStagedIRecord(bytes, now = Date.now()) {
  const record = parseIncidentJson(bytes, "I authority record");
  closed(record, ["schema_version", "id", "state", "valid_from", "expires_at", "central_pull",
    "execution_decision_id",
    "before_policy_blob", "after_policy_blob", "registry_blob", "exceptions_blob", "proof",
    "owner_decision", "failure"], "I authority record");
  closed(record.proof, ["revision", "path", "blob"], "I proof coordinate");
  closed(record.owner_decision, ["comment_id", "actor_id", "actor_login", "body_digest"], "I owner decision");
  closed(record.failure, ["run_id", "attempt", "workflow_id", "authorize_job_id", "semantic_job_id",
    "diagnostic_digest"], "I failed execution");
  const start = instant(record.valid_from), end = instant(record.expires_at);
  need(record.schema_version === 1 && record.state === "active" && record.central_pull === 314 &&
    Number.isSafeInteger(record.execution_decision_id) && record.execution_decision_id > 0 &&
    record.id === "platform-a3-admission-cycle" && end > start && end - start <= 7 * 86400_000 &&
    now >= start && now < end &&
    record.before_policy_blob === SNAPSHOT_BLOBS["governance/docs-protocol-policy-v2.json"] &&
    record.after_policy_blob === "17a2c987aed7d0fa10cf9e2c5788f45d3ab41aad" &&
    record.registry_blob === SNAPSHOT_BLOBS["governance/docs-qualified-cohorts.json"] &&
    record.exceptions_blob === SNAPSHOT_BLOBS["governance/docs-protocol-exceptions.json"] &&
    SHA.test(record.proof?.revision) && SHA.test(record.proof?.blob) && record.proof?.path ===
      "governance/evidence/docs-admission-recovery/platform-a3.json" &&
    Number.isSafeInteger(record.owner_decision.comment_id) && record.owner_decision.comment_id > 0 &&
    Number.isSafeInteger(record.owner_decision.actor_id) && record.owner_decision.actor_id > 0 &&
    /^[A-Za-z0-9-]+$/u.test(record.owner_decision.actor_login) &&
    DIGEST.test(record.owner_decision.body_digest) &&
    ["run_id", "attempt", "workflow_id", "authorize_job_id", "semantic_job_id"].every((key) =>
      Number.isSafeInteger(record.failure[key]) && record.failure[key] > 0) &&
    DIGEST.test(record.failure.diagnostic_digest),
  "I authority remains unbound or embeds its own base commit");
  return record;
}
export async function verifyInstallationTransition(event, accepted, api, clock = Date.now) {
  validateAcceptedInstallation(accepted, clock());
  need(event?.action && ["opened", "synchronize", "reopened", "edited", "ready_for_review"].includes(event.action) &&
    event.repository?.id === REPO_ID && event.repository.full_name === REPO,
  "wrong event repository/action");
  const liveRepo = await api.getRepository(); identity(liveRepo);
  const pull = await api.getPull(accepted.pull_number);
  need(tuple(event.pull_request) === tuple(pull) && pull.id === accepted.pull_id &&
    pull.number === accepted.pull_number && pull.state === "open" && pull.merged === false &&
    pull.draft === false && pull.base.repo?.full_name === REPO && pull.head.repo?.full_name === REPO &&
    pull.base.repo?.id === REPO_ID && pull.head.repo?.id === REPO_ID &&
    pull.base.ref === accepted.branch && pull.base.sha === accepted.base &&
    pull.head.sha === accepted.head && pull.head.ref === accepted.head_ref &&
    pull.changed_files === accepted.manifest.length && Number.isSafeInteger(pull.commits) && pull.commits > 0,
  "wrong, forked, stale or replayed PR tuple");
  need(event.run_id === accepted.run_id && event.run_attempt === accepted.run_attempt,
    "run attempt replayed or unbound");
  const decision = await api.getDecisionComment(accepted.decision_comment_id);
  need(decision?.id === accepted.decision_comment_id && decision.user?.id === accepted.owner_id &&
    decision.user?.login === accepted.owner_login && decision.user?.type === "User" &&
    decision.issue_url === `https://api.github.com/repos/${REPO}/issues/${accepted.pull_number}` &&
    decision.body === JSON.stringify(accepted), "accepted decision bytes/identity differ");
  let retainedForward, retainedForwardComment, mergedForwardPull, mergedForwardPullSnapshot;
  if (accepted.direction === "inverse") {
    const retained = await api.getDecisionComment(accepted.forward_decision_comment_id);
    retainedForwardComment = JSON.stringify(retained);
    need(retained?.id === accepted.forward_decision_comment_id &&
      retained.user?.type === "User" && retained.user.id === accepted.owner_id &&
      retained.user.login === accepted.owner_login &&
      accepted.forward_decision_comment_id !== accepted.decision_comment_id,
    "retained forward decision identity differs");
    const forward = parseIncidentJson(Buffer.from(retained.body ?? ""), "retained forward installation");
    retainedForward = forward;
    validateAcceptedInstallation(forward, instant(forward.deadline) - 1000);
    need(retained.body === JSON.stringify(forward) && forward.stage === "I" &&
      forward.direction === "forward" && forward.repository === REPO &&
      forward.repository_id === REPO_ID && forward.decision_comment_id === retained.id &&
      retained.issue_url === `https://api.github.com/repos/${REPO}/issues/${forward.pull_number}` &&
      forward.owner_id === accepted.owner_id && forward.owner_login === accepted.owner_login &&
      forward.guard_blob === accepted.guard_blob && forward.guard_test_blob === accepted.guard_test_blob &&
      forward.verifier_blob === accepted.verifier_blob &&
      forward.manifest.length === accepted.manifest.length &&
      forward.manifest.every((row, index) => {
        const inverse = accepted.manifest[index];
        return row.path === inverse.path &&
          JSON.stringify(row.new) === JSON.stringify(inverse.old) &&
          JSON.stringify(row.old) === JSON.stringify(inverse.new);
      }), "inverse does not restore retained trusted forward bytes");
    mergedForwardPull = await api.getPull(forward.pull_number);
    need(mergedForwardPull?.id === forward.pull_id &&
      mergedForwardPull.number === forward.pull_number && mergedForwardPull.state === "closed" &&
      mergedForwardPull.merged === true && mergedForwardPull.draft === false &&
      mergedForwardPull.base?.ref === "main" && mergedForwardPull.base.repo?.id === REPO_ID &&
      mergedForwardPull.base.repo?.full_name === REPO &&
      mergedForwardPull.head?.sha === forward.head && mergedForwardPull.head.ref === forward.head_ref &&
      mergedForwardPull.head.repo?.id === REPO_ID && mergedForwardPull.head.repo?.full_name === REPO &&
      SHA.test(mergedForwardPull.merge_commit_sha) && mergedForwardPull.merge_commit_sha !== forward.base &&
      typeof mergedForwardPull.merged_at === "string" && Number.isFinite(Date.parse(mergedForwardPull.merged_at)),
    "retained forward PR has no bound merged installation");
    mergedForwardPullSnapshot = JSON.stringify(mergedForwardPull);
  }
  need(await api.getBranchHead("main") === accepted.base && event.execution_base === accepted.base,
    "execution did not use live protected base");
  const comparison = await api.compare(accepted.base, accepted.head);
  need(comparison?.status === "ahead" && comparison.merge_base_commit?.sha === accepted.base &&
    comparison.behind_by === 0 && comparison.ahead_by > 0, "head is not a same-base descendant");
  const protections = await api.getEffectiveProtections();
  verifyMinimumProtections(protections);
  need(sha256(Buffer.from(JSON.stringify(protections))) === accepted.expected_protections_digest,
    "effective protection snapshot changed");
  const owner = await api.getCollaboratorPermission(accepted.owner_login);
  need(owner?.permission === "admin" && owner.user?.id === accepted.owner_id &&
    owner.user.login === accepted.owner_login, "accepted owner lacks current admin authority");
  const pages = await api.getPullFiles(accepted.pull_number);
  need(Array.isArray(pages) && pages.length > 0 && pages.length <= 31 &&
    pages.every((page) => Array.isArray(page) && page.length <= 100), "invalid complete PR file pages");
  const files = pages.flat();
  need(files.length === pull.changed_files && files.length === accepted.manifest.length &&
    new Set(files.map((file) => file.filename)).size === files.length,
  "incomplete, duplicate or extra PR files");
  for (const [index, row] of accepted.manifest.entries()) {
    const file = files.find((item) => item.filename === row.path);
    need(file && file.status === row.status && file.previous_filename === undefined &&
      (row.new === null || file.sha === row.new.blob), `PR file differs at row ${index}`);
  }
  const [oldTree, newTree] = await Promise.all([api.getTree(accepted.base), api.getTree(accepted.head)]);
  const oldFiles = verifiedTree(accepted.base, oldTree), newFiles = verifiedTree(accepted.head, newTree);
  const changed = [...new Set([...oldFiles.keys(), ...newFiles.keys()])].filter((path) => {
    const old = oldFiles.get(path), next = newFiles.get(path);
    return old?.sha !== next?.sha || old?.mode !== next?.mode || old?.type !== next?.type;
  }).toSorted();
  need(JSON.stringify(changed) === JSON.stringify(accepted.manifest.map((row) => row.path)),
    "immutable-tree diff differs from complete manifest");
  for (const row of accepted.manifest) {
    await verifySide(row.old, oldFiles.get(row.path), api, `${row.path} old`);
    await verifySide(row.new, newFiles.get(row.path), api, `${row.path} new`);
  }
  if (retainedForward) {
    const installed = mergedForwardPull.merge_commit_sha;
    const forwardComparison = await api.compare(retainedForward.base, installed);
    need(forwardComparison?.status === "ahead" &&
      forwardComparison.merge_base_commit?.sha === retainedForward.base &&
      forwardComparison.behind_by === 0 && forwardComparison.ahead_by > 0,
    "retained forward base is not an ancestor of installed commit");
    if (installed !== accepted.base) {
      const installedComparison = await api.compare(installed, accepted.base);
      need(installedComparison?.status === "ahead" &&
        installedComparison.merge_base_commit?.sha === installed &&
        installedComparison.behind_by === 0 && installedComparison.ahead_by > 0,
      "installed forward commit is not an ancestor of inverse base");
    }
    const forwardBase = verifiedTree(retainedForward.base, await api.getTree(retainedForward.base));
    const installedFiles = verifiedTree(installed, await api.getTree(installed));
    const installedChanged = [...new Set([...forwardBase.keys(), ...installedFiles.keys()])]
      .filter((path) => {
        const old = forwardBase.get(path), next = installedFiles.get(path);
        return old?.sha !== next?.sha || old?.mode !== next?.mode || old?.type !== next?.type;
      }).toSorted();
    need(JSON.stringify(installedChanged) ===
      JSON.stringify(retainedForward.manifest.map((row) => row.path)),
    "merged installation tree differs from forward manifest");
    for (const row of retainedForward.manifest) {
      await verifySide(row.old, forwardBase.get(row.path), api, `${row.path} retained forward old`);
      await verifySide(row.new, installedFiles.get(row.path), api, `${row.path} installed forward new`);
      await verifySide(row.new, oldFiles.get(row.path), api, `${row.path} retained forward new`);
    }
  }
  if (accepted.stage === "E") {
    const proof = accepted.manifest.find((row) => row.path.endsWith("/platform-a3.json"));
    const adr = accepted.manifest.find((row) => row.path.endsWith("/0007-platform-admission-cycle-recovery.md"));
    await verifyStagedEProof(await api.getBlob(proof.new.blob), await api.getBlob(adr.new.blob), api);
  }
  let authorityBytes;
  if (accepted.stage === "I" && accepted.direction === "forward") {
    const authority = accepted.manifest.find((row) => row.path === "governance/docs-platform-admission-recovery.json");
    authorityBytes = await api.getBlob(authority.new.blob);
    const record = validateStagedIRecord(authorityBytes, clock());
    need(oldFiles.get(record.proof.path)?.sha === record.proof.blob &&
      oldFiles.get(E[0])?.type === "blob" && oldFiles.get(E[0])?.mode === "100644" &&
      oldFiles.get(E[1])?.type === "blob" && oldFiles.get(E[1])?.mode === "100644",
    "I base does not own exact accepted E proof and decision");
    await (api.verifyHostedProof ?? verifyStagedEProof)(await api.getBlob(record.proof.blob),
      await api.getBlob(oldFiles.get(E[0]).sha), api);
  }
  need(oldFiles.get(G[0])?.sha === accepted.guard_blob && oldFiles.get(G[1])?.sha === accepted.guard_test_blob &&
    oldFiles.get(G[2])?.sha === accepted.verifier_blob,
  "base guard/workflow test/verifier bytes differ from accepted tuple");
  const finalOwner = await api.getCollaboratorPermission(accepted.owner_login);
  need(JSON.stringify(finalOwner) === JSON.stringify(owner), "owner authority changed during verification");
  if (retainedForward) {
    need(JSON.stringify(await api.getDecisionComment(accepted.forward_decision_comment_id)) ===
      retainedForwardComment &&
      JSON.stringify(await api.getPull(retainedForward.pull_number)) === mergedForwardPullSnapshot,
    "retained forward authorization or merged provenance changed during verification");
  }
  const finalProtections = await api.getEffectiveProtections();
  verifyMinimumProtections(finalProtections);
  const finalDecision = await api.getDecisionComment(accepted.decision_comment_id);
  const finalPull = await api.getPull(accepted.pull_number);
  const finalHead = await api.getBranchHead("main");
  const finalNow = clock();
  if (authorityBytes) { validateStagedIRecord(authorityBytes, finalNow); }
  need(JSON.stringify(finalDecision) === JSON.stringify(decision) &&
    tuple(finalPull) === tuple(pull) &&
    finalHead === accepted.base &&
    sha256(Buffer.from(JSON.stringify(finalProtections))) ===
      accepted.expected_protections_digest && instant(accepted.deadline) > finalNow,
  "final PR/base/protection/deadline reread changed");
  return { stage: accepted.stage, direction: accepted.direction, manifest_digest: accepted.manifest_digest,
    base: accepted.base, head: accepted.head, status: "exact_candidate_verified" };
}

async function gh(path) {
  const { stdout } = await exec("gh", ["api", path], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 60_000 });
  return JSON.parse(stdout);
}
export async function readEffectiveProtections(read = gh) {
  const summaries = [];
  for (let page = 1; page <= 100; page += 1) {
    const rows = await read(`repos/${REPO}/rulesets?includes_parents=true&per_page=100&page=${page}`);
    need(Array.isArray(rows) && rows.length <= 100, "invalid effective ruleset page");
    summaries.push(...rows);
    if (rows.length < 100) { break; }
    need(page < 100, "effective ruleset pagination exceeded bound");
  }
  need(new Set(summaries.map((row) => row.id)).size === summaries.length &&
    summaries.every((row) => Number.isSafeInteger(row.id) && row.id > 0),
  "duplicate or invalid effective ruleset summary");
  const rulesets = [];
  for (const summary of summaries) {
    const detail = await read(`repos/${REPO}/rulesets/${summary.id}?includes_parents=true`);
    need(detail?.id === summary.id && Array.isArray(detail.rules) &&
      Array.isArray(detail.bypass_actors) && detail.conditions &&
      typeof detail.conditions === "object" && !Array.isArray(detail.conditions),
    "incomplete effective ruleset detail");
    rulesets.push({ summary, detail });
  }
  let classic_branch_protection;
  try {
    classic_branch_protection = await read(`repos/${REPO}/branches/main/protection`);
    need(classic_branch_protection && typeof classic_branch_protection === "object" &&
      !Array.isArray(classic_branch_protection), "invalid classic branch protection");
  } catch (error) {
    if (error?.status !== 404) { throw error; }
    classic_branch_protection = null;
  }
  return { rulesets, classic_branch_protection };
}
async function run() {
  const id = process.env.DOCS_R317_ACCEPTED_TUPLE_COMMENT_ID;
  need(/^[1-9][0-9]{0,15}$/u.test(id ?? ""), "independently accepted tuple comment is unbound");
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  event.execution_base = process.env.GITHUB_SHA;
  event.run_id = Number(process.env.GITHUB_RUN_ID);
  event.run_attempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  const comment = await gh(`repos/${REPO}/issues/comments/${id}`);
  need(comment.id === Number(id) && comment.user?.type === "User" &&
    comment.issue_url === `https://api.github.com/repos/${REPO}/issues/${event.pull_request?.number}`,
  "accepted decision comment identity differs");
  const accepted = parseIncidentJson(Buffer.from(comment.body ?? ""), "accepted tuple");
  need(comment.user.id === accepted.owner_id && comment.user.login === accepted.owner_login &&
    accepted.decision_comment_id === Number(id),
    "decision author differs from accepted tuple");
  const api = {
    getDecisionComment: (commentId) => gh(`repos/${REPO}/issues/comments/${commentId}`),
    getRepository: () => gh(`repos/${REPO}`),
    getSourceRepository: () => gh(`repos/${PLATFORM}`),
    getSourceHead: async () => (await gh(`repos/${PLATFORM}/branches/main`)).commit.sha,
    getSourceChecks: async () => {
      const result = await gh(`repos/${PLATFORM}/commits/${SOURCE_HEAD}/check-runs?per_page=100&filter=all`);
      need(result.total_count === result.check_runs?.length && result.total_count <= 100,
        "incomplete source check page"); return result.check_runs;
    },
    getSourceRun: (runId) => gh(`repos/${PLATFORM}/actions/runs/${runId}`),
    getSourceJobs: async (runId, attempt) => {
      const result = await gh(`repos/${PLATFORM}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`);
      need(result.total_count === result.jobs?.length && result.total_count <= 100,
        "incomplete source job page"); return result.jobs;
    },
    getSourceLog: async (jobId) => {
      const { stdout } = await exec("gh", ["api", `repos/${PLATFORM}/actions/jobs/${jobId}/logs`],
        { encoding: "buffer", maxBuffer: 16 * 1024 * 1024, timeout: 60_000 }); return stdout;
    },
    getRepositoryFile: async (repository, path, revision) => {
      const item = await gh(`repos/${repository}/contents/${path}?ref=${revision}`);
      need(item.type === "file" && item.encoding === "base64" && typeof item.content === "string",
        "invalid source Git content response");
      const bytes = Buffer.from(item.content.replace(/\s/gu, ""), "base64");
      need(recoveryBlob(bytes) === item.sha, "source Git content SHA differs"); return bytes;
    },
    getPull: (number) => gh(`repos/${REPO}/pulls/${number}`),
    getBranchHead: async (branch) => (await gh(`repos/${REPO}/branches/${branch}`)).commit.sha,
    compare: (base, head) => gh(`repos/${REPO}/compare/${base}...${head}`),
    getEffectiveProtections: () => readEffectiveProtections(async (path) => {
      try { return await gh(path); }
      catch (error) {
        if (path === `repos/${REPO}/branches/main/protection` &&
          /HTTP 404\b/u.test(error?.stderr ?? "")) { error.status = 404; }
        throw error;
      }
    }),
    getCollaboratorPermission: (login) => gh(`repos/${REPO}/collaborators/${login}/permission`),
    getPullFiles: async (number) => {
      const pages = [];
      for (let page = 1; page <= 31; page += 1) {
        const rows = await gh(`repos/${REPO}/pulls/${number}/files?per_page=100&page=${page}`);
        need(Array.isArray(rows), "invalid PR files API page"); pages.push(rows);
        if (rows.length < 100) { return pages; }
      }
      throw new Error("PR file pagination exceeded bound");
    },
    getTree: async (revision) => {
      const commit = await gh(`repos/${REPO}/git/commits/${revision}`);
      need(commit.sha === revision && SHA.test(commit.tree?.sha), "invalid immutable commit tree");
      return { commit, tree: await gh(`repos/${REPO}/git/trees/${commit.tree.sha}?recursive=1`) };
    },
    getBlob: async (sha) => {
      const item = await gh(`repos/${REPO}/git/blobs/${sha}`);
      need(item.encoding === "base64" && typeof item.content === "string", "invalid Git blob response");
      return Buffer.from(item.content.replace(/\s/gu, ""), "base64");
    },
  };
  console.log(JSON.stringify(await verifyInstallationTransition(event, accepted, api)));
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) { await run(); }
