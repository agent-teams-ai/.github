import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import {
  RECOVERY_AUTHORITY_PATH, POLICY_PATH, REGISTRY_PATH, EXCEPTIONS_PATH,
  recoveryBlob, recoveryDigest, recoveryTarget, validateRecoveryAuthority,
  prepareAdmissionRecovery, recoveryIncident, recoveryDecisionText,
  finishAdmissionRecovery, verifyRecoveryIncident, verifyLegacyFailureJobs, reproduceLegacyParserErrors,
} from "./docs-legacy-admission-recovery.mjs";

// Synthetic fixtures only. No real authorization/proof file is published.
const bytes = (value) => Buffer.from(JSON.stringify(value));
const sha = (n) => n.toString(16).repeat(40);
const digest = (value) => recoveryDigest(bytes(value));
function fixture() {
  const controller = { repository: "example/central", repository_id: 1 };
  const source = (id) => ({ repository: `example/consumer-${id}`, repository_id: id,
    repository_lifecycle: "active", docs_role: "consumer", admission_status: "admitted",
    cohort_binding_status: "bound", desired_cohort_id: "source", observed_cohort_id: "source",
    profile_path: "architecture/foundation/docs-protocol.yaml",
    observed_cohort_record_digest: digest("source"), observed_cohort_event_digest: digest("qualified"),
    observed_default_branch_evidence: { revision: sha(1), check_run_id: 12 },
    qualification: { status: "qualified", observed_revision: sha(1), evidence_paths: ["synthetic.json"] } });
  const before = { repositories: [source(2), source(3)] };
  const after = structuredClone(before);
  Object.assign(after.repositories[0], { desired_cohort_id: "test-only", cohort_binding_status: "rollout_pending" });
  const registry = { cohorts: [{ cohort_id: "test-only", record_digest: digest("target"),
    reusable_workflow: { revision: sha(4), blob_sha: sha(5) }, packages: [{ name: "synthetic", version: "1.0.0", integrity: "synthetic" }] }],
  events: [{ cohort_id: "test-only", state: "QUALIFIED", event_digest: digest("target-qualified") }] };
  const exceptions = bytes({ exceptions: [] });
  const record = { id: "synthetic-selection", state: "active", valid_from: "2026-09-08T00:00:00Z",
    expires_at: "2026-09-09T00:00:00Z", controller, pull_number: 44,
    operation: { kind: "selection", repository_id: 2, before_policy_blob: recoveryBlob(bytes(before)),
      after_policy_blob: recoveryBlob(bytes(after)), registry_blob: recoveryBlob(bytes(registry)),
      exceptions_blob: recoveryBlob(exceptions), target: recoveryTarget(registry, "test-only") },
    incidents: [{ source_entry: structuredClone(before.repositories[1]), source_head: sha(2),
      proof: { revision: sha(3), path: "governance/evidence/docs-admission-recovery/synthetic.json", blob: sha(4) },
      owner_decision: { comment_id: 9, actor_id: 8, actor_login: "synthetic-owner", body_digest: digest("decision") } }] };
  const authority = { schema_version: 1, authorizations: [record] };
  const execution = { controller, pull_number: 44, base: sha(5), head: sha(6), execution_base: sha(5), changed_files: [POLICY_PATH] };
  const input = { execution, asOf: "2026-09-08T12:00:00Z", basePolicyBytes: bytes(before),
    proposedPolicyBytes: bytes(after), registryBytes: bytes(registry), exceptionsBytes: exceptions,
    readBaseFile: async (path, revision) => {
      assert.equal(revision, input.execution.base);
      return new Map([[RECOVERY_AUTHORITY_PATH, bytes(authority)], [POLICY_PATH, bytes(before)],
        [REGISTRY_PATH, bytes(registry)], [EXCEPTIONS_PATH, exceptions]]).get(path);
    } };
  return { controller, before, after, registry, record, authority, execution, input,
    prepare: () => prepareAdmissionRecovery(input),
    updatePolicy: () => {
      input.proposedPolicyBytes = bytes(after);
      record.operation.after_policy_blob = recoveryBlob(input.proposedPolicyBytes);
    } };
}

test("exact TEST-only selection covers unchanged collateral without selecting that target for collateral", async () => {
  const f = fixture();
  const capability = await f.prepare();
  const incident = recoveryIncident(capability, f.after.repositories[1], sha(2), f.execution);
  assert.equal(incident.source_entry.desired_cohort_id, "source");
  assert.equal(f.after.repositories[0].desired_cohort_id, "test-only");
  assert.match(recoveryDecisionText(capability, incident), /PR: 44\nPolicy: [a-f0-9]{40} -> [a-f0-9]{40}/u);
  assert.deepEqual(finishAdmissionRecovery(capability, f.execution, "2026-09-08T12:00:01Z").recovery_pending,
    []);
  assert.throws(() => recoveryIncident(capability, f.after.repositories[1], sha(2), f.execution), /finalized/u);
});

test("absent base authority returns no capability, never reads PR-head authority", async () => {
  const f = fixture();
  f.input.readBaseFile = async (path, revision) => {
    assert.equal(path, RECOVERY_AUTHORITY_PATH);
    assert.equal(revision, f.execution.base);
    assert.notEqual(revision, f.execution.head);
    return null;
  };
  assert.equal(await f.prepare(), null);
});

const mutations = {
  "self-approved boolean": (f) => { f.record.approved = true; },
  "unknown operation field": (f) => { f.record.operation.allowFailures = true; },
  "wrong PR": (f) => { f.execution.pull_number++; },
  "wrong controller ID": (f) => { f.execution.controller = { ...f.controller, repository_id: 99 }; },
  "wrong controller name": (f) => { f.execution.controller = { ...f.controller, repository: "fork/central" }; },
  "PR-head execution authority": (f) => { f.execution.execution_base = f.execution.head; },
  "wrong base policy input": (f) => { f.input.basePolicyBytes = bytes({}); },
  "wrong policy blob": (f) => { f.record.operation.before_policy_blob = sha(9); },
  "wrong target workflow": (f) => { f.record.operation.target.workflow.revision = sha(9); },
  "wrong target record": (f) => { f.record.operation.target.record_digest = digest("other"); },
  "wrong target event": (f) => { f.record.operation.target.event_digest = digest("other"); },
  "wrong target package": (f) => { f.record.operation.target.packages[0].integrity = "forged"; },
  "wrong target generation": (f) => { f.record.operation.target.generation = 2; },
  "wrong registry blob": (f) => { f.record.operation.registry_blob = sha(9); },
  "wrong exceptions blob": (f) => { f.record.operation.exceptions_blob = sha(9); },
  "expired": (f) => { f.input.asOf = f.record.expires_at; },
  "not yet active": (f) => { f.input.asOf = "2026-09-07T12:00:00Z"; },
  "revoked": (f) => { f.record.state = "revoked"; },
  "retired": (f) => { f.record.state = "retired"; },
  "unbounded lifetime": (f) => { f.record.expires_at = "2027-09-08T00:00:00Z"; },
  "invalid calendar expiry": (f) => { f.record.expires_at = "2026-02-31T00:00:00Z"; },
  "extra diff file": (f) => { f.execution.changed_files.push("README.md"); },
  "self-authority addition": (f) => { f.execution.changed_files.push(RECOVERY_AUTHORITY_PATH); },
  "empty coverage": (f) => { f.record.incidents = []; },
  "duplicate coverage": (f) => { f.record.incidents.push(structuredClone(f.record.incidents[0])); },
  "source binding drift": (f) => { f.record.incidents[0].source_entry.observed_cohort_id = "forged"; },
  "UNBOUND proof": (f) => { f.record.incidents[0].proof.revision = "UNBOUND"; },
  "proof traversal": (f) => { f.record.incidents[0].proof.path = "governance/evidence/docs-admission-recovery/../forged.json"; },
  "owner approval boolean": (f) => { f.record.incidents[0].owner_decision.approved = true; },
  "unrelated row transition": (f) => { f.after.repositories[1].desired_cohort_id = "test-only"; f.updatePolicy(); },
  "unrelated top-level transition": (f) => { f.after.comment = "unrelated"; f.updatePolicy(); },
  "lifecycle mutation": (f) => { f.after.repositories[0].repository_lifecycle = "archived"; f.updatePolicy(); },
  "observation during selection": (f) => { f.after.repositories[0].observed_cohort_id = "test-only"; f.updatePolicy(); },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`bounded authority rejects ${name}`, async () => {
    const f = fixture(); mutate(f);
    await assert.rejects(f.prepare(), /Admission recovery:/u);
  });
}

test("serialized capabilities and stale-head receipts cannot authorize pending", async () => {
  const f = fixture(); const capability = await f.prepare();
  for (const forged of [structuredClone(capability), {}, null]) {
    assert.throws(() => recoveryIncident(forged, f.after.repositories[1], sha(2), f.execution), /capability/u);
  }
  assert.throws(() => recoveryIncident(capability, f.after.repositories[1], sha(9), f.execution), /source head/u);
  assert.throws(() => recoveryIncident(capability, f.after.repositories[1], sha(2), { ...f.execution, head: sha(9) }), /execution tuple/u);
  assert.throws(() => recoveryIncident(capability, f.after.repositories[0], sha(2), f.execution), /uncovered/u);
  assert.throws(() => finishAdmissionRecovery(capability, f.execution, f.record.expires_at), /expired/u);
});

test("identical clean central rebase requires a newly evaluated capability", async () => {
  const f = fixture(); const old = await f.prepare();
  f.execution.base = sha(7); f.execution.execution_base = sha(7); f.execution.head = sha(8);
  assert.throws(() => recoveryIncident(old, f.after.repositories[1], sha(2), f.execution), /execution tuple/u);
  const fresh = await f.prepare();
  assert.equal(recoveryIncident(fresh, f.after.repositories[1], sha(2), f.execution).source_head, sha(2));
});

test("matching after-policy bytes retire applicability without mutating archive", async () => {
  const f = fixture();
  f.input.basePolicyBytes = bytes(f.after);
  const previousRead = f.input.readBaseFile;
  f.input.readBaseFile = async (path, revision) => path === POLICY_PATH ? bytes(f.after) : previousRead(path, revision);
  await assert.rejects(f.prepare(), /no unique authority/u);
  validateRecoveryAuthority(f.authority);
});

test("observation operation may cover collateral but cannot finalize a failed target", async () => {
  const f = fixture();
  Object.assign(f.before.repositories[0], { desired_cohort_id: "test-only", cohort_binding_status: "rollout_pending" });
  Object.assign(f.after.repositories[0], { observed_cohort_id: "test-only", cohort_binding_status: "bound",
    observed_default_branch_evidence: { revision: sha(7), check_run_id: 99 } });
  f.after.repositories[0].qualification.observed_revision = sha(7);
  f.record.operation.kind = "observation";
  f.record.operation.before_policy_blob = recoveryBlob(bytes(f.before));
  f.input.basePolicyBytes = bytes(f.before);
  f.record.incidents.push({ ...structuredClone(f.record.incidents[0]), source_entry: structuredClone(f.before.repositories[0]) });
  f.updatePolicy();
  const capability = await f.prepare();
  assert.throws(() => recoveryIncident(capability, f.before.repositories[0], sha(2), f.execution), /requires current target success/u);
  assert.equal(recoveryIncident(capability, f.after.repositories[1], sha(2), f.execution).source_entry.repository_id, 3);
});

async function proofFixture() {
  const f = fixture();
  const entry = f.before.repositories[1];
  const caller = Buffer.from("synthetic immutable caller\n");
  const runner = "07d49409cb51f6124ad17673860b812a9d7b5f5b";
  const workflow = { repository: f.controller.repository, path: ".github/workflows/docs-protocol-check.yml", revision: runner, blob_sha: sha(7) };
  const sourceRecord = { cohort_id: "source", record_digest: entry.observed_cohort_record_digest,
    reusable_workflow: workflow, packages: [], assets: { caller_workflow: { rendered_digest: recoveryDigest(caller) } } };
  f.registry.cohorts.push(sourceRecord);
  f.registry.events.push({ cohort_id: "source", state: "QUALIFIED", event_digest: entry.observed_cohort_event_digest });
  entry.caller_workflow_path = ".github/workflows/docs.yml";
  Object.assign(entry.observed_default_branch_evidence, { default_branch: "main", workflow_id: 50, workflow_run_id: 80,
    required_context: "docs-protocol / docs-protocol-check", integration_id: 15368 });
  f.after.repositories[1] = structuredClone(entry);
  f.record.incidents[0].source_entry = structuredClone(entry);
  f.record.operation.before_policy_blob = recoveryBlob(bytes(f.before));
  f.input.basePolicyBytes = bytes(f.before);
  f.input.registryBytes = bytes(f.registry);
  f.record.operation.registry_blob = recoveryBlob(f.input.registryBytes);
  f.updatePolicy();
  const files = new Map();
  const coord = (path, content, revision = sha(3)) => {
    files.set(`${revision}:${path}`, content);
    return { path, revision, blob: recoveryBlob(content) };
  };
  const projection = bytes({ cohortId: "source", cohortAuthority: {
    recordDigest: entry.observed_cohort_record_digest, qualificationEventDigest: entry.observed_cohort_event_digest } });
  const errors = {
    policy: [{ instancePath: "/repositories/7", keyword: "additionalProperties",
      params: { additionalProperty: "desired_cohort_generation" }, message: "must NOT have additional properties" }],
    registry: [{ instancePath: "/cohorts/23", keyword: "additionalProperties", params: { additionalProperty: "cohort_generation" } }],
  };
  const run = { id: 60, attempt: 2, workflow_id: 50, head: sha(2), branch: "main", path: entry.caller_workflow_path };
  const failureNames = ["Authorize exact consumer snapshot without executing consumer code", null,
    "Require successful trusted structural authorization", "Require successful trusted qualification"];
  const jobs = ["trusted-authorize", "trusted-structural", "trusted-qualification", "docs-protocol-check"].map((role, i) => ({
    id: 71 + i, run_id: run.id, run_attempt: run.attempt, head_sha: run.head,
    name: `docs-protocol / ${role}`, html_url: `https://github.com/${entry.repository}/actions/runs/60/job/${71 + i}`,
    status: "completed", conclusion: role === "trusted-structural" ? "skipped" : "failure",
    steps: failureNames[i] === null ? [] : [{ number: 1, name: failureNames[i], status: "completed", conclusion: "failure" }],
  }));
  const log = Buffer.from(`CONTROLLER_SNAPSHOT_SHA: ${sha(3)}\nJOB_WORKFLOW_SHA: ${runner}\nGITHUB_SHA: ${sha(2)}\n` +
    "Central Docs policy schema validation failed: /repositories/7 must NOT have additional properties\n");
  const historicalLog = Buffer.from(`CONTROLLER_SNAPSHOT_SHA: ${sha(1)}\nJOB_WORKFLOW_SHA: ${runner}\nGITHUB_SHA: ${sha(1)}\n`);
  const proof = { schema_version: 1,
    historical_run: { attempt: 1, authorize_job_id: 171, log_digest: recoveryDigest(historicalLog) }, source_target: recoveryTarget(f.registry, "source"),
    historical_inputs: { policy: coord(POLICY_PATH, bytes({ historical: "policy" }), sha(1)),
      registry: coord(REGISTRY_PATH, bytes({ historical: "registry" }), sha(1)) },
    current_inputs: { policy: coord(POLICY_PATH, f.input.basePolicyBytes), registry: coord(REGISTRY_PATH, f.input.registryBytes) },
    schemas: { policy: coord(POLICY_PATH.replace(".json", ".schema.json"), bytes({ synthetic: "policy-schema" }), runner),
      registry: coord(REGISTRY_PATH.replace(".json", ".schema.json"), bytes({ synthetic: "registry-schema" }), runner) },
    caller_blob: recoveryBlob(caller), projection_blob: recoveryBlob(projection), parser_errors: errors,
    run, jobs, parser_job_id: 71, parser_log_digest: recoveryDigest(log) };
  let capability;
  async function seal() {
    f.record.incidents[0].proof = coord(f.record.incidents[0].proof.path, bytes(proof));
    // Obtain the exact owner-decision text, then prepare a fresh capability
    // carrying its digest. This is synthetic owner/API evidence, not real approval.
    capability = await f.prepare();
    const text = recoveryDecisionText(capability, f.record.incidents[0]);
    f.record.incidents[0].owner_decision.body_digest = recoveryDigest(Buffer.from(text));
    capability = await f.prepare();
  }
  await seal();
  const liveRun = { id: run.id, run_attempt: run.attempt, workflow_id: run.workflow_id,
    head_sha: run.head, head_branch: run.branch, path: run.path, event: "push", status: "completed", conclusion: "failure",
    repository: { id: entry.repository_id, full_name: entry.repository },
    referenced_workflows: [{ sha: workflow.revision, path: `${workflow.repository}/${workflow.path}@${workflow.revision}` }] };
  const historicalRun = { ...structuredClone(liveRun), id: 80, run_attempt: 1, head_sha: sha(1), conclusion: "success" };
  const historicalJobs = [{ id: 171, run_id: 80, run_attempt: 1, head_sha: sha(1), name: "docs-protocol / trusted-authorize",
    status: "completed", conclusion: "success", html_url: `https://github.com/${entry.repository}/actions/runs/80/job/171`,
    steps: [{ name: "Authorize exact consumer snapshot without executing consumer code", status: "completed", conclusion: "success" }] }];
  const adapters = {
    isCommitAncestor: async () => true,
    readGitFile: async (repo, path, revision) => repo === entry.repository
      ? path === entry.caller_workflow_path ? caller : projection : files.get(`${revision}:${path}`),
    reproduceParserErrors: async () => structuredClone(errors),
    getDecisionComment: async () => ({ id: 9, user: { id: 8, login: "synthetic-owner", type: "User" },
      body: recoveryDecisionText(capability, f.record.incidents[0]),
      issue_url: "https://api.github.com/repos/example/central/issues/44" }),
    getCollaboratorPermission: async () => ({ permission: "admin", user: { id: 8, login: "synthetic-owner" } }),
    getRepository: async () => ({ id: entry.repository_id, full_name: entry.repository, default_branch: "main", archived: false, disabled: false }),
    getDefaultBranchHead: async () => sha(2),
    getWorkflowRun: async (_repo, id) => structuredClone(id === 80 ? historicalRun : liveRun),
    getWorkflowJobs: async (_repo, id) => structuredClone(id === 80 ? historicalJobs : jobs),
    getCheckRuns: async () => [{ id: 74, head_sha: sha(2), name: entry.observed_default_branch_evidence.required_context,
      app: { id: 15368 }, conclusion: "failure", html_url: jobs[3].html_url }],
    getJobLog: async (_repo, id) => id === 171 ? historicalLog : log,
  };
  return { ...f, entry, proof, jobs, run, errors, files, adapters, liveRun, historicalRun, historicalJobs, seal,
    verify: () => verifyRecoveryIncident(capability, entry, sha(2), f.execution, adapters),
    finish: () => finishAdmissionRecovery(capability, f.execution, "2026-09-08T12:00:01Z") };
}

test("independent owner, both parser replays and exact source run produce pending, never current success", async () => {
  const f = await proofFixture();
  const result = await f.verify();
  assert.equal(result.status, "recovery_pending");
  assert.equal(result.qualification, "unverified");
  assert.equal(result.semantics, "unverified");
  assert.deepEqual(f.finish().recovery_pending, [{ repository_id: 3, source_head: sha(2) }]);
});

test("latest check attempt replaces an earlier check from the same workflow run", async () => {
  const f = await proofFixture();
  const current = await f.adapters.getCheckRuns();
  f.adapters.getCheckRuns = async () => [{
    ...current[0],
    id: current[0].id - 1,
    html_url: current[0].html_url.replace(/\/job\/\d+$/u, "/job/73"),
  }, ...current];
  assert.equal((await f.verify()).status, "recovery_pending");
});

const proofMutations = {
  "changed source profile since historical success": (f) => {
    const read = f.adapters.readGitFile;
    f.adapters.readGitFile = async (repo, path, revision) => path === f.entry.profile_path && revision === sha(2)
      ? Buffer.from("changed source profile") : read(repo, path, revision);
  },
  "changed projection package even with owner proof": async (f) => {
    const read = f.adapters.readGitFile;
    const changed = JSON.parse(await read(f.entry.repository, "architecture/foundation/docs-protocol-managed-state.json", sha(2)));
    changed.packages = { forged: "0.0.0" };
    const content = bytes(changed);
    f.adapters.readGitFile = async (repo, path, revision) => repo === f.entry.repository && path.endsWith("managed-state.json") && revision === sha(2)
      ? content : read(repo, path, revision);
    f.proof.projection_blob = recoveryBlob(content); await f.seal();
  },
  "wrong historical run attempt": (f) => { f.historicalRun.run_attempt++; },
  "wrong historical source head": (f) => { f.historicalRun.head_sha = sha(9); },
  "historical failed run": (f) => { f.historicalRun.conclusion = "failure"; },
  "historical wrong runner": (f) => { f.historicalRun.referenced_workflows[0].sha = sha(9); },
  "historical untrusted job": (f) => { f.historicalJobs[0].name = "consumer supplied task"; },
  "historical skipped parser": (f) => { f.historicalJobs[0].steps[0].conclusion = "skipped"; },
  "historical log digest mismatch": (f) => { const get = f.adapters.getJobLog;
    f.adapters.getJobLog = async (repo, id) => id === 171 ? Buffer.from("forged") : get(repo, id); },
  "historical wrong controller log even with owner proof": async (f) => {
    const get = f.adapters.getJobLog;
    const wrong = Buffer.from((await get(f.entry.repository, 171)).toString().replace(sha(1), sha(9)));
    f.proof.historical_run.log_digest = recoveryDigest(wrong);
    f.adapters.getJobLog = async (repo, id) => id === 171 ? wrong : get(repo, id); await f.seal();
  },
  "non-owner accepted comment": (f) => { f.adapters.getCollaboratorPermission = async () => ({ permission: "write", user: { id: 8, login: "synthetic-owner" } }); },
  "wrong actor ID": (f) => { f.adapters.getCollaboratorPermission = async () => ({ permission: "admin", user: { id: 99, login: "synthetic-owner" } }); },
  "forged decision body": (f) => { const old = f.adapters.getDecisionComment; f.adapters.getDecisionComment = async () => ({ ...await old(), body: "approved: true" }); },
  "decision for another PR": (f) => { const old = f.adapters.getDecisionComment; f.adapters.getDecisionComment = async () => ({ ...await old(), issue_url: "https://api.github.com/repos/example/central/issues/99" }); },
  "PR-head proof ancestry": (f) => { f.adapters.isCommitAncestor = async () => false; },
  "forged proof blob": (f) => { f.files.set(`${f.record.incidents[0].proof.revision}:${f.record.incidents[0].proof.path}`, bytes({})); },
  "wrong source ID": (f) => { const old = f.adapters.getRepository; f.adapters.getRepository = async () => ({ ...await old(), id: 99 }); },
  "source head drift": (f) => { f.adapters.getDefaultBranchHead = async () => sha(9); },
  "wrong current run attempt": (f) => { f.liveRun.run_attempt++; },
  "wrong current run head": (f) => { f.liveRun.head_sha = sha(9); },
  "wrong run event": (f) => { f.liveRun.event = "pull_request"; },
  "wrong runner": (f) => { f.liveRun.referenced_workflows[0].sha = sha(9); },
  "missing source check": (f) => { f.adapters.getCheckRuns = async () => []; },
  "ambiguous source check": (f) => { const old = f.adapters.getCheckRuns; f.adapters.getCheckRuns = async () => {
    const checks = await old();
    return [...checks, { ...checks[0], id: checks[0].id + 100,
      html_url: checks[0].html_url.replace(/\/actions\/runs\/\d+/u, "/actions/runs/999") }];
  }; },
  "wrong source App": (f) => { const old = f.adapters.getCheckRuns; f.adapters.getCheckRuns = async () => (await old()).map((row) => ({ ...row, app: { id: 99 } })); },
  "wrong parser log": (f) => { f.adapters.getJobLog = async () => Buffer.from("unrelated error"); },
  "unreproduced registry rejection": (f) => { f.adapters.reproduceParserErrors = async () => ({ policy: f.errors.policy, registry: [] }); },
  "independently failed semantic gate": async (f) => {
    f.jobs[3].steps[0].name = "Run repository semantic documentation gate"; await f.seal();
  },
  "independently failed qualification": async (f) => {
    f.jobs[2].steps[0].name = "Run only the exact installed agent-teams-docs qualify CLI"; await f.seal();
  },
  "arbitrary parser error even with owner proof": async (f) => {
    f.errors.policy[0].params.additionalProperty = "arbitrary"; await f.seal();
  },
  "wrong job attempt even with owner proof": async (f) => { f.jobs[0].run_attempt++; await f.seal(); },
  "wrong job URL even with owner proof": async (f) => { f.jobs[0].html_url += "?forged=1"; await f.seal(); },
  "executed semantic code after dependency failure": async (f) => {
    f.jobs[3].steps.push({ number: 2, name: "Run repository semantic documentation gate", status: "completed", conclusion: "success" }); await f.seal();
  },
};
for (const [name, mutate] of Object.entries(proofMutations)) {
  test(`live incident verifier rejects ${name}`, async () => {
    const f = await proofFixture(); await mutate(f);
    await assert.rejects(f.verify(), /Admission recovery:/u);
    assert.deepEqual(f.finish().recovery_pending, []);
  });
}

test("dependency-guard failures do not excuse a cancelled/missing/incomplete parser job", async () => {
  const f = await proofFixture();
  for (const jobs of [f.jobs.slice(1), [...f.jobs, f.jobs[0]],
    f.jobs.map((job, i) => i === 0 ? { ...job, conclusion: "cancelled" } : job)]) {
    assert.throws(() => verifyLegacyFailureJobs(jobs, { ...f.run, repository: f.entry.repository }, 71), /Admission recovery:/u);
  }
});


test("exact legacy runner schemas reject BOTH full current documents; modern runners accept", async () => {
  const run = promisify(execFile);
  const [policy, registry] = await Promise.all([POLICY_PATH, REGISTRY_PATH].map(async (path) => JSON.parse(await readFile(path, "utf8"))));
  const legacy = ["07d49409cb51f6124ad17673860b812a9d7b5f5b", "c72dac6ba10660ac9d7e1426759f80a585c39da5",
    "eef92e7fd40f538b4e9ba03e01bbd4e2d23f12f2"];
  const modern = ["a2fa473bcfdbcf1eb5a68c81b9f58ef9e03917c0", "822ab02e6be9c76218b4da33b9c1fdec97bef9ef"];
  async function document(revision, path) {
    const { stdout } = await run("git", ["show", `${revision}:${path}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    return JSON.parse(stdout);
  }
  for (const revision of [...legacy, ...modern]) {
    const [policySchema, registrySchema] = await Promise.all([POLICY_PATH, REGISTRY_PATH].map((path) =>
      document(revision, path.replace(/\.json$/u, ".schema.json"))));
    const policyValidator = new Ajv2020({ allErrors: true, strict: true }).compile(policySchema);
    const registryValidator = new Ajv2020({ allErrors: true, strict: true }).compile(registrySchema);
    assert.equal(policyValidator(policy), modern.includes(revision), `${revision}: complete policy`);
    assert.equal(registryValidator(registry), modern.includes(revision), `${revision}: complete registry`);
    if (legacy.includes(revision)) {
      const historical = { policy: await document(revision, POLICY_PATH), registry: await document(revision, REGISTRY_PATH) };
      const errors = await reproduceLegacyParserErrors(policy, registry, { policy: policySchema, registry: registrySchema }, historical);
      const expectedPolicyProperties = policy.repositories.flatMap((row) =>
        ["desired_cohort_generation", "observed_cohort_generation", "exact_cohort_v2_packages", "v3_qualification_coordinates"]
          .filter((key) => Object.hasOwn(row, key)));
      assert.ok(errors.registry.length > 0);
      assert.deepEqual(errors.policy.map((error) => error.params.additionalProperty).sort(),
        expectedPolicyProperties.sort());
      // Fixture-only negative control: changing policy alone cannot repair the
      // independent registry rejection. No authority file is written or filtered.
      const policyOnly = structuredClone(policy);
      for (const row of policyOnly.repositories) {
        delete row.desired_cohort_generation;
        delete row.observed_cohort_generation;
        delete row.exact_cohort_v2_packages;
        delete row.v3_qualification_coordinates;
      }
      assert.equal(policyValidator(policyOnly), true);
      assert.equal(registryValidator(registry), false);
      await assert.rejects(reproduceLegacyParserErrors(policyOnly, registry, { policy: policySchema, registry: registrySchema }),
        /policy parser did not reproduce rejection/u);
    } else {
      const arbitrary = structuredClone(policy); arbitrary.arbitrary = true;
      assert.equal(policyValidator(arbitrary), false, "modern strict full policy rejects arbitrary authority fields");
    }
  }
});
