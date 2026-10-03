import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { selectLatestFailedSourceCheck } from "./verify-docs-platform-recovery-installation-r317.mjs";
import { recoveryBlob, recoveryDigest, recoveryTarget } from "./docs-legacy-admission-recovery.mjs";
import { PLATFORM_RECOVERY, platformRecoveryDecisionText,
  validatePlatformPolicyTransition, validatePlatformRecoveryRecord, verifyPlatformAdmissionRecovery,
  verifyPlatformRecoveryCandidateEvidence } from "./docs-platform-admission-recovery.mjs";

// Exact files from the incident's central controller snapshot. The compressed
// copies keep this test independent of moving main and of Git history in CI.
const historicalSnapshot = "a9521f1f54a9ea836da6ade82344a3c9baded356";
assert.equal(PLATFORM_RECOVERY.historical_base, historicalSnapshot);
assert.equal(PLATFORM_RECOVERY.controller_snapshot_sha, historicalSnapshot);
const historicalFiles = {
  "governance/docs-protocol-policy-v2.json": ["policy.json.gz", "1c038fc38acc50078bb2983a6294a10d279b6195f4d91896bcea04586a7925df", "55717f3171b0359b4eedba338f616ae72d943496"],
  "governance/docs-qualified-cohorts.json": ["cohorts.json.gz", "ca396a280154093f7c122378ed5937a203e53df74548f8046ffb5bcfd9ef7100", "18f59fc7312d78782f65b5f40dcc3774695211af"],
  "governance/docs-protocol-exceptions.json": ["exceptions.json.gz", "10657f44d0a80adbdf725cf8cebf123086b4dd10790bb09562388f2172c53bae", "ac336b865d697b62c938623f2960864e85f7698a"],
  "scripts/verify-docs-consumer-gate.mjs": ["runner.mjs.gz", "91193d8ad4c7c24d481c8d1697e330497ebdeed502cc9491a646ad6419dddc74", "ef293a0d0098b8bd7c700ddd8c98968d10a8e9d9"],
  ".github/workflows/docs-protocol-check.yml": ["controller.yml.gz", "ddee57a5e685407548ad8eebaa6f1e934600104af192dcd542160915c24fd1d6", "9bcbe54dfec6280045ac596e55c1f14ce5f176e1"],
};
const controllerData = Object.fromEntries(await Promise.all(Object.entries(historicalFiles)
  .map(async ([path, [name, digest, blob]]) => {
    const bytes = gunzipSync(await readFile(new URL(`./fixtures/platform-recovery-a9521f1f/${name}`, import.meta.url)), { maxOutputLength: 1024 * 1024 });
    assert.equal(createHash("sha256").update(bytes).digest("hex"), digest, `${path}@${historicalSnapshot} SHA-256`);
    assert.equal(recoveryBlob(bytes), blob, `${path}@${historicalSnapshot} Git blob`);
    return [path, bytes];
  })));
const policyBytes = controllerData["governance/docs-protocol-policy-v2.json"];
const registryBytes = controllerData["governance/docs-qualified-cohorts.json"];
const exceptionsBytes = controllerData["governance/docs-protocol-exceptions.json"];
assert.equal(recoveryBlob(policyBytes), PLATFORM_RECOVERY.before_policy_blob);
assert.equal(recoveryBlob(registryBytes), PLATFORM_RECOVERY.registry_blob);
assert.equal(recoveryBlob(exceptionsBytes), PLATFORM_RECOVERY.exceptions_blob);
const base = JSON.parse(policyBytes);
const baseBytes = policyBytes;
const after = Buffer.from(policyBytes.toString("utf8").replace(
  '"cohort_binding_status": "bound",\n      "desired_cohort_id": "docs-2026-09-15-stable23"',
  '"cohort_binding_status": "rollout_pending",\n      "desired_cohort_id": "docs-2026-09-24-stable28"'));
assert.equal(recoveryBlob(after), PLATFORM_RECOVERY.after_policy_blob);
const failure = { run_id: 1001, attempt: 1, workflow_id: 1002, authorize_job_id: 1003,
  semantic_job_id: 1004, diagnostic_digest: `sha256:${"1".repeat(64)}` };
const record = {
  schema_version: 1, id: "platform-a3-admission-cycle", state: "active",
  valid_from: "2026-09-24T00:00:00Z", expires_at: "2026-09-25T00:00:00Z",
  central_pull: 314, execution_decision_id: 1007,
  before_policy_blob: recoveryBlob(baseBytes), after_policy_blob: recoveryBlob(after),
  registry_blob: recoveryBlob(registryBytes), exceptions_blob: recoveryBlob(exceptionsBytes),
  proof: { revision: "a9521f1f54a9ea836da6ade82344a3c9baded356",
    path: "governance/evidence/docs-admission-recovery/platform-a3.json",
    blob: "1".repeat(40) },
  owner_decision: { comment_id: 1005, actor_id: 1006, actor_login: "synthetic-owner",
    body_digest: `sha256:${"2".repeat(64)}` }, failure,
};
const input = { asOf: "2026-09-24T12:00:00Z", execution: {
  controller: { repository: "agent-teams-ai/.github", repository_id: 1316243981 },
  pull_number: 314, pull_id: 101, head_ref: "synthetic-policy", run_id: 103,
  run_attempt: 1, base: "e".repeat(40), head: "f".repeat(40),
  execution_base: "e".repeat(40), changed_files: ["governance/docs-protocol-policy-v2.json"],
}, accepted_execution: {
  controller: { repository: "agent-teams-ai/.github", repository_id: 1316243981 },
  pull_number: 314, pull_id: 101, branch: "main", head_ref: "synthetic-policy", base: "e".repeat(40),
  head: "f".repeat(40), direction: "forward", manifest_digest: `sha256:${"3".repeat(64)}`,
  guard_blob: "a".repeat(40), guard_test_blob: "b".repeat(40), verifier_blob: "c".repeat(40),
  decision_id: 1007, run_id: 103, run_attempt: 1, deadline: "2026-09-25T00:00:00Z",
}, basePolicyBytes: baseBytes, proposedPolicyBytes: after, registryBytes, exceptionsBytes };
const policyManifest = [{ path: "governance/docs-protocol-policy-v2.json", status: "modified",
  old: { type: "blob", mode: "100644", blob: recoveryBlob(baseBytes), bytes: baseBytes.length,
    sha256: recoveryDigest(baseBytes) },
  new: { type: "blob", mode: "100644", blob: recoveryBlob(after), bytes: after.length,
    sha256: recoveryDigest(after) } }];
input.accepted_execution.manifest_digest = recoveryDigest(Buffer.from(JSON.stringify(policyManifest)));
function altered(change) {
  const nextRecord = structuredClone(record);
  const nextInput = { ...structuredClone(input),
    basePolicyBytes: Buffer.from(input.basePolicyBytes),
    proposedPolicyBytes: Buffer.from(input.proposedPolicyBytes),
    registryBytes: Buffer.from(input.registryBytes),
    exceptionsBytes: Buffer.from(input.exceptionsBytes) };
  change(nextRecord, nextInput);
  return [nextRecord, nextInput];
}
function policyChange(change) {
  return altered((nextRecord, nextInput) => {
    const policy = JSON.parse(nextInput.proposedPolicyBytes);
    change(policy);
    nextInput.proposedPolicyBytes = Buffer.from(JSON.stringify(policy));
    nextRecord.after_policy_blob = recoveryBlob(nextInput.proposedPolicyBytes);
  });
}
test("accepts only the synthetic exact one-row selection shape", () => {
  const result = validatePlatformRecoveryRecord(record, input);
  assert.equal(result.platform.repository_id, PLATFORM_RECOVERY.repository_id);
  assert.equal(result.changed_repository_id, 1314129620);
  assert.equal(result.target.cohort_id, "docs-2026-09-24-stable28");
});
for (const [label, mutation, pattern] of [
  ["self approval", (r) => { r.approved = true; }, /record fields/u],
  ["revocation", (r) => { r.state = "revoked"; }, /expired, revoked/u],
  ["expiry", (_r, i) => { i.asOf = "2026-09-25T00:00:00Z"; }, /expired, revoked/u],
  ["long window", (r) => { r.expires_at = "2026-10-02T00:00:00Z"; }, /expired, revoked/u],
  ["stale central head", (_r, i) => { i.execution.head = "c".repeat(40); }, /stale or replayed/u],
  ["different PR", (_r, i) => { i.execution.pull_number = 315; }, /stale or replayed/u],
  ["record retargeted to another PR", (r, i) => { r.central_pull = 315; i.execution.pull_number = 315; }, /invalid central coordinates/u],
  ["stale execution base", (_r, i) => { i.execution.base = "c".repeat(40); i.execution.execution_base = i.execution.base; }, /stale or replayed/u],
  ["unbound accepted tuple", (_r, i) => { i.accepted_execution = null; }, /accepted execution/u],
  ["wrong manifest digest", (_r, i) => { i.accepted_execution.manifest_digest = "bad"; }, /accepted execution tuple/u],
  ["different valid manifest digest", (_r, i) => {
    i.accepted_execution.manifest_digest = `sha256:${"f".repeat(64)}`;
  }, /execution manifest digest differs/u],
  ["expired installation deadline", (_r, i) => { i.accepted_execution.deadline = i.asOf; }, /accepted execution tuple/u],
  ["extra changed file", (_r, i) => { i.execution.changed_files.push("scripts/evil.mjs"); }, /complete permitted/u],
  ["registry drift", (_r, i) => { i.registryBytes = Buffer.from("{}"); }, /registry blob/u],
  ["exceptions drift", (_r, i) => { i.exceptionsBytes = Buffer.from("{}"); }, /exceptions blob/u],
  ["policy drift", (_r, i) => { i.basePolicyBytes = Buffer.from("{}"); }, /before policy/u],
  ["fabricated decision", (r) => { r.owner_decision.approved = true; }, /owner decision fields/u],
  ["unbound failed job", (r) => { r.failure.semantic_job_id = 0; }, /failed run\/attempt/u],
]) {
  test(`rejects ${label}`, () => {
    const [r, i] = altered(mutation);
    assert.throws(() => validatePlatformRecoveryRecord(r, i), pattern);
  });
}
for (const [label, change, pattern] of [
  ["Platform observation edit", (p) => { p.repositories.find((r) => r.repository_id === PLATFORM_RECOVERY.repository_id).observed_cohort_id = PLATFORM_RECOVERY.selected; }, /exactly one non-Platform/u],
  ["unrelated row edit", (p) => { p.repositories.find((r) => r.repository_id === 1348461381).admission_status = "suspended"; }, /exactly one non-Platform/u],
  ["SUPERSEDED stable25 selection", (p) => { p.repositories.find((r) => r.repository_id === 1314129620).desired_cohort_id = PLATFORM_RECOVERY.selected; }, /eligible successor/u],
  ["unqualified target", (p) => { p.repositories.find((r) => r.repository_id === 1314129620).desired_cohort_id = "missing"; }, /target|qualified/u],
  ["qualification change", (p) => { p.repositories.find((r) => r.repository_id === 1314129620).qualification.status = "not_qualified"; }, /selection fields/u],
]) {
  test(`rejects ${label}`, () => {
    const [, i] = policyChange(change);
    assert.throws(() => validatePlatformPolicyTransition(base,
      JSON.parse(i.proposedPolicyBytes), JSON.parse(registryBytes), i.asOf), pattern);
  });
}
test("active route rejects an absent independently accepted execution decision", async () => {
  const r = structuredClone(record); r.execution_decision_id = 0;
  await assert.rejects(verifyPlatformAdmissionRecovery(r, input, {},
    { repository_id: PLATFORM_RECOVERY.repository_id }, PLATFORM_RECOVERY.source_head),
  /independently accepted execution decision/u);
});

const runnerBytes = controllerData["scripts/verify-docs-consumer-gate.mjs"];
const controllerBytes = controllerData[".github/workflows/docs-protocol-check.yml"];
function hostedFixture() {
  const [r, i] = altered(() => {});
  const selected = recoveryTarget(JSON.parse(registryBytes), PLATFORM_RECOVERY.selected);
  const profile = Buffer.from("synthetic profile fixture\n");
  const caller = Buffer.from("synthetic caller fixture\n");
  const projection = Buffer.from(JSON.stringify({ cohortId: PLATFORM_RECOVERY.selected,
    cohortAuthority: { recordDigest: selected.record_digest,
      qualificationEventDigest: selected.event_digest } }));
  const incident = { ...PLATFORM_RECOVERY, profile_blob: recoveryBlob(profile),
    caller_blob: recoveryBlob(caller), projection_blob: recoveryBlob(projection),
    runner_script_blob: recoveryBlob(runnerBytes) };
  const log = Buffer.from(`CONTROLLER_SNAPSHOT_SHA: ${incident.controller_snapshot_sha}\n` +
    "Error: Central consumer policy does not explicitly match the Cohort generation.\n");
  r.failure.diagnostic_digest = recoveryDigest(log);
  const proof = Buffer.from(JSON.stringify({ schema_version: 1, repository_id: incident.repository_id,
    source_head: incident.source_head, selected_cohort: incident.selected,
    profile_blob: incident.profile_blob, caller_blob: incident.caller_blob,
    projection_blob: incident.projection_blob, ...r.failure }));
  r.proof.blob = recoveryBlob(proof);
  r.owner_decision.body_digest = recoveryDigest(Buffer.from(platformRecoveryDecisionText(r, incident)));
  const comment = { id: r.owner_decision.comment_id,
    user: { id: r.owner_decision.actor_id, login: r.owner_decision.actor_login, type: "User" },
    body: platformRecoveryDecisionText(r, incident),
    issue_url: "https://api.github.com/repos/agent-teams-ai/.github/issues/314" };
  const permission = { permission: "admin",
    user: { id: r.owner_decision.actor_id, login: r.owner_decision.actor_login } };
  const context = base.repositories.find((row) => row.repository_id === incident.repository_id)
    .observed_default_branch_evidence.required_context;
  const url = (id) => `https://github.com/${incident.repository}/actions/runs/${r.failure.run_id}/job/${id}`;
  const checks = [{ id: r.failure.semantic_job_id, name: context, head_sha: incident.source_head,
    app: { id: 15368 }, conclusion: "failure", html_url: url(r.failure.semantic_job_id) }];
  const run = { id: r.failure.run_id, run_attempt: r.failure.attempt,
    workflow_id: r.failure.workflow_id, head_sha: incident.source_head, head_branch: "main",
    path: ".github/workflows/docs-protocol.yml", event: "push", status: "completed",
    conclusion: "failure", repository: { id: incident.repository_id, full_name: incident.repository },
    referenced_workflows: [{ sha: selected.workflow.revision,
      path: `agent-teams-ai/.github/${selected.workflow.path}@${selected.workflow.revision}` }] };
  const failedStep = new Map([["trusted-authorize", "Authorize exact consumer snapshot without executing consumer code"],
    ["trusted-qualification", "Require successful trusted structural authorization"],
    ["docs-protocol-check", "Require successful trusted qualification"]]);
  const jobs = ["trusted-authorize", "trusted-structural", "trusted-qualification", "docs-protocol-check"]
    .map((role, index) => ({ id: [r.failure.authorize_job_id, 1007, 1008,
      r.failure.semantic_job_id][index], name: `docs-protocol / ${role}`,
    run_id: run.id, run_attempt: run.run_attempt, head_sha: incident.source_head,
    status: "completed", conclusion: role === "trusted-structural" ? "skipped" : "failure",
    html_url: url([r.failure.authorize_job_id, 1007, 1008, r.failure.semantic_job_id][index]),
    steps: role === "trusted-structural" ? [] : [
      { number: 1, name: "Set up trusted runner", status: "completed", conclusion: "success" },
      { number: 2, name: failedStep.get(role), status: "completed", conclusion: "failure" },
      { number: 3, name: "Run repository semantic documentation gate", status: "completed", conclusion: "skipped" },
    ] }));
  const guardData = Object.fromEntries([
    ".github/workflows/docs-platform-recovery-installation-r317.yml",
    "scripts/docs-platform-recovery-installation-r317.test.mjs",
    "scripts/verify-docs-platform-recovery-installation-r317.mjs",
  ].map((path) => [path, Buffer.from(`synthetic installed ${path}\n`)]));
  i.accepted_execution.guard_blob = recoveryBlob(guardData[".github/workflows/docs-platform-recovery-installation-r317.yml"]);
  i.accepted_execution.guard_test_blob = recoveryBlob(guardData["scripts/docs-platform-recovery-installation-r317.test.mjs"]);
  i.accepted_execution.verifier_blob = recoveryBlob(guardData["scripts/verify-docs-platform-recovery-installation-r317.mjs"]);
  const executionComment = { id: r.execution_decision_id,
    user: { id: r.owner_decision.actor_id, login: r.owner_decision.actor_login, type: "User" },
    body: JSON.stringify(i.accepted_execution),
    issue_url: "https://api.github.com/repos/agent-teams-ai/.github/issues/314" };
  const state = { head: incident.source_head, checks, run, jobs, log, comment, permission,
    finalPermission: permission, clock: "2026-09-24T12:01:00Z", source: { profile, caller, projection },
    proof, runner: runnerBytes, controller: controllerBytes, guardData,
    executionComment, permissionReads: 0,
    snapshotReads: [], controllerData: Object.fromEntries(Object.entries(controllerData)
      .map(([path, bytes]) => [path, Buffer.from(bytes)])),
    fleetReads: 0, fleetError: null, fleetEffect: null };
  const adapters = {
    isCommitAncestor: async () => true,
    readGitFile: async (repo, path, revision) => {
      if (repo === "agent-teams-ai/.github") {
        if (revision === i.execution.base && Object.hasOwn(state.guardData, path)) {
          return state.guardData[path];
        }
        if (path === r.proof.path) { return state.proof; }
        if (path === selected.workflow.path && revision === selected.workflow.revision) {
          return state.controller;
        }
        if (path === "scripts/verify-docs-consumer-gate.mjs" &&
          revision === selected.workflow.revision) { return state.runner; }
        if (Object.hasOwn(state.controllerData, path)) {
          state.snapshotReads.push([path, revision]);
          return revision === incident.controller_snapshot_sha ? state.controllerData[path] : null;
        }
        throw new Error(`unexpected central Git read: ${path}@${revision}`);
      }
      return path === "architecture/foundation/docs-protocol-managed-state.json"
        ? state.source.projection : path === ".github/workflows/docs-protocol.yml"
          ? state.source.caller : state.source.profile;
    },
    getDecisionComment: async (_repo, id) => id === r.execution_decision_id ? state.executionComment : state.comment,
    getCollaboratorPermission: async () => (++state.permissionReads === 1
      ? state.permission : state.finalPermission),
    getRepository: async () => ({ id: incident.repository_id, full_name: incident.repository,
      default_branch: "main", archived: false, disabled: false }),
    getDefaultBranchHead: async () => state.head,
    getCheckRuns: async () => state.checks,
    getWorkflowRun: async () => state.run,
    getWorkflowJobs: async () => state.jobs,
    getJobLog: async () => state.log,
    evaluateRemainingFleet: async (scope) => {
      assert.deepEqual(scope, { platform_repository_id: incident.repository_id,
        changed_repository_id: 1314129620 });
      state.fleetReads += 1;
      state.fleetEffect?.();
      if (state.fleetError) { throw state.fleetError; }
    },
    currentTime: async () => state.clock,
  };
  return { r, i, incident, state, adapters,
    run: () => verifyPlatformRecoveryCandidateEvidence(r, i, adapters, incident),
    runInstalled: () => verifyPlatformAdmissionRecovery(r, i, adapters,
      { repository_id: incident.repository_id }, incident.source_head, incident) };
}
function rebindProof(f) {
  const proof = JSON.parse(f.state.proof);
  proof.diagnostic_digest = f.r.failure.diagnostic_digest;
  f.state.proof = Buffer.from(JSON.stringify(proof));
  f.r.proof.blob = recoveryBlob(f.state.proof);
  f.state.comment.body = platformRecoveryDecisionText(f.r, f.incident);
  f.r.owner_decision.body_digest = recoveryDigest(Buffer.from(f.state.comment.body));
}

test("complete synthetic hosted fixture reaches candidate-only result", async () => {
  const f = hostedFixture();
  assert.deepEqual(await f.run(), { repository_id: PLATFORM_RECOVERY.repository_id,
    source_head: PLATFORM_RECOVERY.source_head, status: "candidate_evidence_only",
    semantics: "unverified", qualification: "unverified" });
  assert.equal(f.state.permissionReads, 2);
  assert.equal(f.state.fleetReads, 1);
  assert.deepEqual(f.state.snapshotReads, [
    ["governance/docs-protocol-policy-v2.json", f.incident.controller_snapshot_sha],
    ["governance/docs-qualified-cohorts.json", f.incident.controller_snapshot_sha],
    ["governance/docs-protocol-exceptions.json", f.incident.controller_snapshot_sha],
  ]);
});
for (const conclusion of ["failure", "skipped"]) {
  test(`hosted recovery accepts an older ${conclusion} required check`, async () => {
    const f = hostedFixture();
    const current = f.state.checks[0];
    f.state.checks.unshift({ ...current, id: 1003, conclusion,
      html_url: `https://github.com/${f.incident.repository}/actions/runs/1002/job/1003` });
    assert.equal(selectLatestFailedSourceCheck(f.state.checks, current.name,
      f.r.failure.semantic_job_id, f.r.failure.run_id).id, current.id);
    assert.equal((await f.run()).status, "candidate_evidence_only");
  });
}
test("hosted recovery rejects a later decisive successful required check", async () => {
  const f = hostedFixture();
  const current = f.state.checks[0];
  f.state.checks.push({ ...current, id: 1005, conclusion: "success",
    html_url: `https://github.com/${f.incident.repository}/actions/runs/1006/job/1005` });
  assert.throws(() => selectLatestFailedSourceCheck(f.state.checks, current.name,
    f.r.failure.semantic_job_id, f.r.failure.run_id), /latest decisive/u);
  await assert.rejects(f.run(), /latest decisive/u);
});
test("hosted recovery keeps source check identity and run binding strict", async () => {
  for (const [mutate, pattern] of [
    [(f) => { f.state.checks[0].head_sha = "f".repeat(40); }, /failed required check is missing/u],
    [(f) => { f.state.checks.push({ ...f.state.checks[0] }); }, /missing\/duplicate/u],
    [(f) => { delete f.state.checks[0].html_url; }, /check context\/App\/job\/run differs/u],
  ]) {
    const f = hostedFixture();
    mutate(f);
    await assert.rejects(f.run(), pattern);
  }
});
test("independently accepted synthetic installation remains recovery_pending after fleet and rereads", async () => {
  const f = hostedFixture();
  const result = await f.runInstalled();
  assert.deepEqual(result, { repository_id: f.incident.repository_id,
    source_head: f.incident.source_head, status: "recovery_pending",
    semantics: "unverified", qualification: "unverified" });
  assert.equal(f.state.fleetReads, 1);
  assert.equal(f.state.permissionReads, 4);
});
for (const [label, expireAt] of [
  ["final execution-comment reread", "comment"],
  ["final execution-permission reread", "permission"],
]) {
  test(`installed route rejects exact expiry during ${label}`, async () => {
    const f = hostedFixture();
    if (expireAt === "comment") {
      const read = f.adapters.getDecisionComment;
      let reads = 0;
      f.adapters.getDecisionComment = async (...args) => {
        const result = await read(...args);
        if (args[1] === f.r.execution_decision_id && ++reads === 2) {
          f.state.clock = f.r.expires_at;
        }
        return result;
      };
    } else {
      const read = f.adapters.getCollaboratorPermission;
      f.adapters.getCollaboratorPermission = async (...args) => {
        const result = await read(...args);
        if (f.state.permissionReads === 4) { f.state.clock = f.r.expires_at; }
        return result;
      };
    }
    await assert.rejects(f.runInstalled(), /expired, revoked/u);
  });
}
for (const [label, mutate, pattern] of [
  ["execution decision replay", (f) => { f.state.executionComment.body = JSON.stringify({
    ...f.i.accepted_execution, head: "c".repeat(40) }); }, /stale or replayed/u],
  ["changed guard bytes", (f) => { f.state.guardData["scripts/verify-docs-platform-recovery-installation-r317.mjs"] = Buffer.from("wrong"); }, /installed guard/u],
  ["unrelated fleet failure", (f) => { f.state.fleetError = new Error("unrelated consumer failed"); }, /unrelated consumer failed/u],
  ["execution decision changed during fleet", (f) => { f.state.fleetEffect = () => {
    f.state.executionComment = { ...f.state.executionComment, body: "revoked" };
  }; }, /stable execution decision/u],
]) {
  test(`installed synthetic route rejects ${label}`, async () => {
    const f = hostedFixture(); mutate(f);
    await assert.rejects(f.runInstalled(), pattern);
  });
}
test("hosted fixture rejects duplicate incident proof keys", async () => {
  const f = hostedFixture();
  f.state.proof = Buffer.from(f.state.proof.toString().replace("{", '{"schema_version":1,'));
  f.r.proof.blob = recoveryBlob(f.state.proof);
  await assert.rejects(f.run(), /duplicate key/u);
});
for (const [label, mutate, pattern] of [
  ["missing controller snapshot coordinate", (f) => {
    f.state.log = Buffer.from("Error: Central consumer policy does not explicitly match the Cohort generation.\n");
  }, /unique incident controller snapshot/u],
  ["duplicate controller snapshot coordinate", (f) => {
    f.state.log = Buffer.concat([f.state.log,
      Buffer.from(`CONTROLLER_SNAPSHOT_SHA: ${f.incident.controller_snapshot_sha}\n`)]);
  }, /unique incident controller snapshot/u],
  ["duplicate malformed controller snapshot declaration", (f) => {
    f.state.log = Buffer.concat([f.state.log, Buffer.from("CONTROLLER_SNAPSHOT_SHA:\n")]);
  }, /unique incident controller snapshot/u],
  ["stale controller snapshot coordinate", (f) => {
    f.state.log = Buffer.from(f.state.log.toString().replace(f.incident.controller_snapshot_sha,
      "f".repeat(40)));
  }, /unique incident controller snapshot/u],
  ["malformed controller snapshot coordinate", (f) => {
    f.state.log = Buffer.from(f.state.log.toString().replace(f.incident.controller_snapshot_sha,
      "not-a-sha"));
  }, /unique incident controller snapshot/u],
  ["wrong controller policy Git blob", (f) => {
    f.state.controllerData["governance/docs-protocol-policy-v2.json"] = Buffer.from("{}");
  }, /controller snapshot .*Git blob differs/u],
  ["wrong controller registry Git blob", (f) => {
    f.state.controllerData["governance/docs-qualified-cohorts.json"] = Buffer.from("{}");
  }, /controller snapshot .*Git blob differs/u],
  ["wrong controller exceptions Git blob", (f) => {
    f.state.controllerData["governance/docs-protocol-exceptions.json"] = Buffer.from("{}");
  }, /controller snapshot .*Git blob differs/u],
]) {
  test(`hosted fixture rejects ${label}`, async () => {
    const f = hostedFixture(); mutate(f);
    f.r.failure.diagnostic_digest = recoveryDigest(f.state.log);
    rebindProof(f);
    await assert.rejects(f.run(), pattern);
  });
}
for (const [label, mutate, pattern] of [
  ["stale default head", (f) => { f.state.head = "f".repeat(40); }, /source head drifted/u],
  ["source profile drift", (f) => { f.state.source.profile = Buffer.from("changed"); }, /source blob drifted/u],
  ["source projection drift", (f) => { f.state.source.projection = Buffer.from("{}"); }, /source blob drifted/u],
  ["wrong check App", (f) => { f.state.checks[0].app.id = 0; }, /failed required check is missing/u],
  ["replayed run attempt", (f) => { f.state.run.run_attempt = 2; }, /run\/runner differs/u],
  ["independent qualification failure", (f) => { f.state.jobs[2].steps[1].name = "Run qualification"; }, /independently failing job step/u],
  ["independent semantic execution", (f) => { f.state.jobs[3].steps[2].conclusion = "failure"; }, /independently failing job step/u],
  ["wrong diagnostic", (f) => { f.state.log = Buffer.from("Central Docs policy stable21 stable25\n"); f.r.failure.diagnostic_digest = recoveryDigest(f.state.log); rebindProof(f); }, /unique reproduced generation diagnostic/u],
  ["pinned controller drift", (f) => { f.state.controller = Buffer.from("wrong controller"); }, /controller authorization step/u],
  ["pinned runner drift", (f) => { f.state.runner = Buffer.from("wrong source"); }, /runner generation assertion/u],
  ["missing remaining-fleet verifier", (f) => { delete f.adapters.evaluateRemainingFleet; }, /remaining fleet verifier is not installed/u],
  ["unrelated consumer failure", (f) => { f.state.fleetError = new Error("uncovered consumer failed"); }, /uncovered consumer failed/u],
  ["owner permission revoked during fleet", (f) => { f.state.fleetEffect = () => { f.state.finalPermission = { ...f.state.permission, permission: "read" }; }; }, /lost current owner authority/u],
  ["expiry during fleet", (f) => { f.state.fleetEffect = () => { f.state.clock = f.r.expires_at; }; }, /expired, revoked/u],
]) {
  test(`hosted fixture rejects ${label}`, async () => {
    const f = hostedFixture(); mutate(f);
    await assert.rejects(f.run(), pattern);
  });
}

// stable31 uses the supplied Mac GH packet, independently of the a3 fixture.
const pendingRoot = new URL("./fixtures/platform-stable31-pending-source/", import.meta.url);
const pendingBytes = async (path) => {
  const compressed = path.endsWith(".mjs") || path.endsWith("docs-qualified-cohorts.json") || path.endsWith(".fixture.json") || path.endsWith("/package.json");
  const bytes = await readFile(new URL(path + (compressed ? ".gz" : ""), pendingRoot));
  return compressed ? gunzipSync(bytes, { maxOutputLength: 4 * 1024 * 1024 }) : bytes;
};
const pendingPacket = JSON.parse(await pendingBytes("packet.json"));
const pendingRaw = new Map(await Promise.all(pendingPacket.manifest.map(async (item) => {
  const bytes = await pendingBytes(item.path);
  assert.equal(bytes.length, item.bytes); assert.equal(recoveryDigest(bytes), item.sha256);
  if (item.gitBlob) assert.equal(recoveryBlob(bytes), item.gitBlob);
  return [item.path, bytes];
})));
const pendingReceipt = await readFile(new URL("../governance/evidence/docs-admission/platform-stable31-pending-source.json", import.meta.url));
assert.equal(recoveryDigest(await pendingBytes("packet.json")), JSON.parse(pendingReceipt).packet_sha256);
const pendingPolicy = JSON.parse(await pendingBytes("selection-policy.fixture.json"));
const pendingRegistry = await pendingBytes("recommended-TEST.fixture.json");
const pendingSchema = JSON.parse(await readFile(new URL("../governance/docs-qualified-cohorts.schema.json", import.meta.url)));
const { verifyPlatformPendingSelection } = await import("./docs-platform-admission-recovery.mjs");
function pendingFixture(inverse = false) {
  const before = structuredClone(pendingPolicy), after = structuredClone(pendingPolicy);
  const selected = (inverse ? before : after).repositories.find(row => row.repository_id === 1319378484);
  selected.desired_cohort_id = "docs-2026-10-03-stable31"; selected.cohort_binding_status = "rollout_pending";
  const state = { head: pendingPacket.source, run: JSON.parse(pendingRaw.get("run.json")),
    checks: JSON.parse(pendingRaw.get("checks.json")).check_runs, jobs: JSON.parse(pendingRaw.get("jobs.json")).jobs };
  const adapters = {
    getRepository: async () => JSON.parse(pendingRaw.get("repository.json")),
    getDefaultBranchHead: async () => state.head, isCommitAncestor: async () => true,
    getCheckRuns: async () => structuredClone(state.checks), getWorkflowRun: async () => structuredClone(state.run),
    getWorkflowJobs: async () => structuredClone(state.jobs), getJobLog: async () => Buffer.from(pendingRaw.get("authorize.log")),
    readGitFile: async (repo, path, revision) => {
      const coordinate = pendingPacket.manifest.find(item => item.repository === repo && item.repositoryPath === path && item.revision === revision);
      assert.ok(coordinate, `${repo}:${path}@${revision}`); return Buffer.from(pendingRaw.get(coordinate.path));
    },
  };
  const input = { receiptBytes: pendingReceipt, basePolicyBytes: Buffer.from(JSON.stringify(before)),
    proposedPolicyBytes: Buffer.from(JSON.stringify(after)), registryBytes: pendingRegistry, registrySchema: pendingSchema,
    asOf: "2026-10-03T06:00:00Z", execution: { controller: { repository: "agent-teams-ai/.github", repository_id: 1316243981 },
      base: "e".repeat(40), head: "f".repeat(40), execution_base: "e".repeat(40), changed_files: ["governance/docs-protocol-policy-v2.json"],
      pull_number: 338, pull_id: 3381, run_id: 3382, run_attempt: 1 } };
  const entry = after.repositories.find(row => row.repository_id === 1319378484);
  return { before, after, entry, input, state, adapters,
    verify: () => verifyPlatformPendingSelection(input, adapters, entry, state.head) };
}
test("stable31 replays the actual pinned authorization function and real schemas on the authentic failed packet", async (t) => {
  const support = JSON.parse(await pendingBytes("replay-support.json"));
  const sources = new Map();
  for (const item of support.manifest) {
    const bytes = gunzipSync(await readFile(new URL(item.path, pendingRoot)));
    assert.equal(bytes.length, item.bytes); assert.equal(recoveryDigest(bytes), item.sha256);
    assert.equal(recoveryBlob(bytes), item.gitBlob); sources.set(item.repositoryPath, bytes);
  }
  assert.equal(recoveryBlob(sources.get("scripts/docs-cohort-policy.mjs")), "4d05735b16bdb4dd06eb75712a356fc98376edc2");
  // Retarget only module specifiers: the real pinned function and its real
  // pinned policy owner run unchanged, with actual installed Ajv and YAML.
  // Real file modules preserve the pinned runner's file-URL entrypoint guard.
  // Only import specifiers change; authorization and CLI guard code are intact.
  const moduleRoot = await mkdtemp(join(tmpdir(), "TEST-platform-pinned-replay-"));
  t.after(() => rm(moduleRoot, { recursive: true, force: true }));
  const cohortPath = join(moduleRoot, "docs-cohort-policy.mjs");
  const runnerPath = join(moduleRoot, "verify-docs-consumer-gate.mjs");
  const cohort = sources.get("scripts/docs-cohort-policy.mjs").toString().replace('"ajv/dist/2020.js"', JSON.stringify(import.meta.resolve("ajv/dist/2020.js")));
  const runner = pendingRaw.get("pinned-runner/scripts/verify-docs-consumer-gate.mjs").toString()
    .replace('"ajv/dist/2020.js"', JSON.stringify(import.meta.resolve("ajv/dist/2020.js")))
    .replace('"yaml"', JSON.stringify(import.meta.resolve("yaml")))
    .replace('"./docs-cohort-policy.mjs"', JSON.stringify(pathToFileURL(cohortPath).href));
  await writeFile(cohortPath, cohort);
  await writeFile(runnerPath, runner);
  const { authorizeConsumerGate } = await import(pathToFileURL(runnerPath).href);
  const schema = path => JSON.parse(sources.get(`governance/${path}.schema.json`));
  const workflow = { repository: "agent-teams-ai/.github", filePath: ".github/workflows/docs-protocol-check.yml", sha: pendingPacket.pinnedRunner };
  workflow.ref = `${workflow.repository}/${workflow.filePath}@${workflow.sha}`;
  const fileCoordinates = pendingPacket.manifest.filter(item => item.repository === "agent-teams-ai/agent-teams-platform");
  const input = { policy: JSON.parse(pendingRaw.get("controller-snapshot/governance/docs-protocol-policy-v2.json")),
    registry: JSON.parse(pendingRaw.get("controller-snapshot/governance/docs-qualified-cohorts.json")),
    exceptions: JSON.parse(pendingRaw.get("controller-snapshot/governance/docs-protocol-exceptions.json")),
    policySchema: schema("docs-protocol-policy-v2"), registrySchema: schema("docs-qualified-cohorts"), exceptionsSchema: schema("docs-protocol-exceptions"),
    workflowIdentity: workflow, calledWorkflowBlobSha: "9bcbe54dfec6280045ac596e55c1f14ce5f176e1", callerSha: pendingPacket.source,
    controllerSnapshotSha: pendingPacket.controllerSnapshot, asOf: "2026-10-02T13:49:00Z",
    repository: { id: 1319378484, fullName: pendingPacket.repository, defaultBranch: "main" },
    tree: fileCoordinates.map(item => ({ path: item.repositoryPath, type: "blob", mode: "100644", sha: item.gitBlob })),
    files: Object.fromEntries(fileCoordinates.map(item => [item.repositoryPath, pendingRaw.get(item.path).toString()])) };
  const diagnostic = "Central consumer policy does not explicitly match the Cohort generation.";
  assert.throws(() => authorizeConsumerGate(input), error => error.message === diagnostic);
  assert.ok(pendingRaw.get("authorize.log").toString().includes(`DOCS_GATE_POLICY_REJECTED: ${diagnostic}`));
  const altered = structuredClone(input); const projection = JSON.parse(altered.files["architecture/foundation/docs-protocol-managed-state.json"]);
  projection.packages = { forged: { version: "99.0.0" } };
  altered.files["architecture/foundation/docs-protocol-managed-state.json"] = JSON.stringify(projection);
  assert.throws(() => authorizeConsumerGate(altered), error => error.message === diagnostic,
    "generation fails before graph validation; it cannot certify downstream source qualification");
  const invalidSchemaInput = structuredClone(input); invalidSchemaInput.policy.repositories[0].repository_id = "wrong";
  assert.throws(() => authorizeConsumerGate(invalidSchemaInput), /policy schema validation failed/u);
});
for (const inverse of [false, true]) test(`stable31 exact ${inverse ? "pre-movement inverse" : "forward"} retains the whole observation and failed truth`, async () => {
  const f = pendingFixture(inverse); const before = structuredClone(f.before), after = structuredClone(f.after);
  assert.deepEqual(await f.verify(), { repository_id: 1319378484, source_head: "5d3551d02237281a2ae4a97e8e8d7a188c741559",
    status: "recovery_pending", qualification: "unverified", semantics: "unverified" });
  assert.deepEqual(f.before, before); assert.deepEqual(f.after, after);
  assert.equal(f.entry.observed_cohort_id, "docs-2026-09-12-stable21");
});
const pendingMutations = {
  "unqualified actual target": async f => { f.input.registryBytes = await pendingBytes("qualified-base.fixture.json"); },
  "receipt tamper": f => { f.input.receiptBytes = Buffer.concat([f.input.receiptBytes, Buffer.from(" ")]); },
  "source movement": f => { f.state.head = "a".repeat(40); },
  "wrong attempt": f => { f.state.run.run_attempt++; },
  "wrong run snapshot": f => {
    const read = f.adapters.readGitFile;
    f.adapters.readGitFile = async (repo, path, revision) => revision === pendingPacket.controllerSnapshot
      ? Buffer.from("wrong snapshot") : read(repo, path, revision);
  },
  "wrong run identity": f => { f.state.run.id++; },
  "wrong check URL": f => { f.state.checks.find(c => c.id === 110868628467).html_url += "?forged"; },
  "wrong semantic job": f => { f.state.jobs.find(j => j.id === 110868628467).id++; },
  "wrong App": f => { f.state.checks.find(c => c.id === 110868628467).app.id = 1; },
  "wrong check head": f => { f.state.checks.find(c => c.id === 110868628467).head_sha = "a".repeat(40); },
  "newer decisive run": f => { f.state.checks.push({ ...f.state.checks.find(c => c.id === 110868628467), id: 110868628468 }); },
  "independent qualification failure": f => { f.state.jobs.find(j => j.id === 110865327956).steps[11].conclusion = "failure"; },
  "executed consumer semantics": f => { f.state.jobs.find(j => j.id === 110868628467).steps[6].conclusion = "success"; },
  "tampered log": f => { f.adapters.getJobLog = async () => Buffer.from("DOCS_GATE_POLICY_REJECTED: unrelated failure\n"); },
};
for (const [label, mutate] of Object.entries(pendingMutations)) test(`stable31 rejects ${label}`, async () => {
  const f = pendingFixture(); await mutate(f); await assert.rejects(f.verify());
});
for (const path of ["package.json", "pnpm-lock.yaml", "architecture/foundation/docs-protocol.yaml",
  ".github/workflows/docs-protocol.yml", "architecture/foundation/docs-protocol-managed-state.json",
  "architecture/foundation/docs-consumer-integration.json", "architecture/foundation/docs-protocol-qualification.json"]) {
  test(`stable31 binds authentic source ${path}`, async () => {
    const f = pendingFixture(); const read = f.adapters.readGitFile;
    f.adapters.readGitFile = async (repo, name, revision) => name === path ? Buffer.from("tampered") : read(repo, name, revision);
    await assert.rejects(f.verify(), /immutable source/u);
  });
}
