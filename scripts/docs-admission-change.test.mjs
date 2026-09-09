import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import YAML from "yaml";
import { verifyDocsAdmissionChange, verifyAdmissionController, readAdmissionBaseFile } from "./verify-docs-admission-change.mjs";
import { verifyDocsAdmissionEvidence } from "./verify-docs-cohort-evidence.mjs";
import { validateDocsProtocolPolicy } from "./governance-policy.mjs";
import { validateDocsGovernanceReferences } from "./docs-cohort-policy.mjs";
import { qualifiedCohortProjection } from "./docs-cohort-policy.mjs";
import { POLICY_PATH, REGISTRY_PATH, EXCEPTIONS_PATH, RECOVERY_AUTHORITY_PATH,
  recoveryBlob, recoveryDigest, recoveryTarget, reproduceLegacyParserErrors } from "./docs-legacy-admission-recovery.mjs";

const base = "72e1a4c2c0845655153a0b757aa7c87c34ec8f7e";
const head = "c".repeat(40); // Synthetic central PR, never published.
const encode = (value) => Buffer.from(JSON.stringify(value));
const caller = (record) => Buffer.from(`name: Documentation Protocol\n\non:\n  pull_request:\n  merge_group:\n  push:\n\npermissions:\n  contents: read\n  id-token: write\n\njobs:\n  docs-protocol:\n    uses: ${record.reusable_workflow.repository}/${record.reusable_workflow.path}@${record.reusable_workflow.revision}\n`);

// Historical runners expose only the legacy CLI. Current v2 runners also
// expose the skipped legacy alternative; schema 1 executes neither qualifier.
const legacyQualification = "Run only the exact installed agent-teams-docs qualify CLI";
const v2Qualification = "Run Cohort v2 qualification through the trusted base-owned runner";
function successfulSteps(role, generation, schemaVersion = generation === 2 ? 3 : 2) {
  const step = (name, conclusion = "success") => ({ name, status: "completed", conclusion });
  if (role === "trusted-qualification") return [
    step(legacyQualification, schemaVersion === 2 ? "success" : "skipped"),
    ...(generation === 2 ? [step(v2Qualification)] : []),
    step("Confirm current controller authority stayed stable through qualification"),
  ];
  if (role === "docs-protocol-check") return [step("Run repository semantic documentation gate")];
  return [];
}

test("admission execution fixtures follow canonical legacy and v2 workflow branches", async () => {
  const workflow = YAML.parse(await readFile(".github/workflows/docs-protocol-check.yml", "utf8"));
  const steps = workflow.jobs["trusted-qualification"].steps;
  for (const [name, profile] of [[legacyQualification, "legacy"], [v2Qualification, "cohort-v2"]]) {
    const matching = steps.filter((step) => step.name === name);
    assert.equal(matching.length, 1);
    assert.equal(matching[0].if, `needs.trusted-authorize.outputs.qualification-profile == '${profile}'`);
  }
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "central-admission-integration-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const token = process.env.GH_TOKEN;
  process.env.GH_TOKEN = "synthetic-job-token";
  t.after(() => { if (token === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = token; });
  const baseBytes = await readAdmissionBaseFile(POLICY_PATH, base);
  const policy = JSON.parse(baseBytes);
  const registryBytes = await readFile(REGISTRY_PATH);
  const registry = JSON.parse(registryBytes);
  const asOfDate = new Date(Date.parse(registry.events.at(-1).effective_at) + 1_000);
  const asOf = asOfDate.toISOString().replace(/\.000Z$/u, "Z");
  const validFrom = new Date(asOfDate.getTime() - 60_000).toISOString().replace(/\.000Z$/u, "Z");
  const expiresAt = new Date(asOfDate.getTime() + 60_000).toISOString().replace(/\.000Z$/u, "Z");
  const exceptions = await readFile(EXCEPTIONS_PATH);
  const candidates = policy.repositories.filter((row) => ["bound", "rollout_pending"].includes(row.cohort_binding_status));
  const selected = policy.repositories.find((row) => row.repository === "agent-teams-ai/docs-protocol-canary-20260817");
  const collateral = policy.repositories.find((row) => row.repository === "agent-teams-ai/agent-teams-token");
  const originalCollateral = structuredClone(collateral);
  selected.desired_cohort_id = "docs-2026-09-08-stable15";
  const source = registry.cohorts.find((row) => row.cohort_id === collateral.observed_cohort_id);
  const sourceHead = "d".repeat(40);
  const recordFor = (entry) => registry.cohorts.find((row) => row.cohort_id === entry.observed_cohort_id);
  const entryFor = (repository) => candidates.find((entry) => entry.repository === repository);
  const projectionFor = (entry, id = entry.observed_cohort_id) => {
    const p = qualifiedCohortProjection(registry, id, { asOf });
    return encode({ ...p, repository: { provider: "github", id: String(entry.repository_id), nameWithOwner: entry.repository },
      cohortAuthority: { channel: p.channel, recordDigest: p.recordDigest, qualificationEventDigest: p.qualificationEventDigest,
        eligibleAfter: p.eligibleAfter, upgradeFrom: p.upgradeFrom, rollbackTo: p.rollbackTo } });
  };
  const runner = source.reusable_workflow.revision;
  const historicalPolicy = await readAdmissionBaseFile(POLICY_PATH, runner);
  const historicalRegistry = await readAdmissionBaseFile(REGISTRY_PATH, runner);
  const schemaPolicy = await readAdmissionBaseFile(POLICY_PATH.replace(".json", ".schema.json"), runner);
  const schemaRegistry = await readAdmissionBaseFile(REGISTRY_PATH.replace(".json", ".schema.json"), runner);
  const parserErrors = await reproduceLegacyParserErrors(JSON.parse(baseBytes), registry,
    { policy: JSON.parse(schemaPolicy), registry: JSON.parse(schemaRegistry) },
    { policy: JSON.parse(historicalPolicy), registry: JSON.parse(historicalRegistry) });
  const coord = (path, revision, content) => ({ path, revision, blob: recoveryBlob(content) });
  const diagnostic = `Central Docs policy schema validation failed: ${parserErrors.policy.map(({ instancePath, message }) => `${instancePath || "/"} ${message}`).join("; ")}`;
  const log = Buffer.from(`CONTROLLER_SNAPSHOT_SHA: ${base}\nJOB_WORKFLOW_SHA: ${runner}\nGITHUB_SHA: ${sourceHead}\n${diagnostic}\n`);
  const historicalLog = Buffer.from(`CONTROLLER_SNAPSHOT_SHA: ${runner}\nJOB_WORKFLOW_SHA: ${runner}\nGITHUB_SHA: ${collateral.observed_default_branch_evidence.revision}\n`);
  const failureStep = ["Authorize exact consumer snapshot without executing consumer code", null,
    "Require successful trusted structural authorization", "Require successful trusted qualification"];
  const jobs = ["trusted-authorize", "trusted-structural", "trusted-qualification", "docs-protocol-check"].map((role, i) => ({
    id: 71 + i, run_id: 800, run_attempt: 1, head_sha: sourceHead, name: `docs-protocol / ${role}`,
    html_url: `https://github.com/${collateral.repository}/actions/runs/800/job/${71 + i}`, status: "completed",
    conclusion: i === 1 ? "skipped" : "failure", steps: failureStep[i] === null ? [] :
      [{ number: 1, name: failureStep[i], status: "completed", conclusion: "failure" }],
  }));
  const proof = { schema_version: 1, source_target: recoveryTarget(registry, source.cohort_id),
    historical_inputs: { policy: coord(POLICY_PATH, runner, historicalPolicy), registry: coord(REGISTRY_PATH, runner, historicalRegistry) },
    historical_run: { attempt: 1, authorize_job_id: 171, log_digest: recoveryDigest(historicalLog) },
    current_inputs: { policy: coord(POLICY_PATH, base, baseBytes), registry: coord(REGISTRY_PATH, base, registryBytes) },
    schemas: { policy: coord(POLICY_PATH.replace(".json", ".schema.json"), runner, schemaPolicy),
      registry: coord(REGISTRY_PATH.replace(".json", ".schema.json"), runner, schemaRegistry) },
    caller_blob: recoveryBlob(caller(source)), projection_blob: recoveryBlob(projectionFor(collateral)), parser_errors: parserErrors,
    run: { id: 800, attempt: 1, workflow_id: collateral.observed_default_branch_evidence.workflow_id,
      head: sourceHead, branch: "main", path: collateral.caller_workflow_path }, jobs, parser_job_id: 71, parser_log_digest: recoveryDigest(log) };
  const execution = { controller: { repository: "agent-teams-ai/.github", repository_id: 1316243981 },
    pull_number: 999, base, head, execution_base: base, changed_files: [POLICY_PATH] };
  const operation = { kind: "selection", repository_id: selected.repository_id, before_policy_blob: recoveryBlob(baseBytes),
    after_policy_blob: recoveryBlob(encode(policy)), registry_blob: recoveryBlob(registryBytes), exceptions_blob: recoveryBlob(exceptions),
    target: recoveryTarget(registry, selected.desired_cohort_id) };
  const proofCoordinate = coord("governance/evidence/docs-admission-recovery/synthetic-integration.json", base, encode(proof));
  let decisionText = `Authorize central admission recovery synthetic-integration\nRepository: agent-teams-ai/.github (1316243981)\nPR: 999\nPolicy: ${operation.before_policy_blob} -> ${operation.after_policy_blob}\nProof: ${base}:${proofCoordinate.path}@${proofCoordinate.blob}\nExpires: ${expiresAt}\n`;
  const authorization = { id: "synthetic-integration", state: "active", valid_from: validFrom, expires_at: expiresAt,
    controller: execution.controller, pull_number: 999, operation,
    incidents: [{ source_entry: originalCollateral, source_head: sourceHead, proof: proofCoordinate,
      owner_decision: { comment_id: 7, actor_id: 8, actor_login: "synthetic-owner", body_digest: recoveryDigest(Buffer.from(decisionText)) } }] };
  const authority = { schema_version: 1, authorizations: [authorization] };
  const controller = { id: 1316243981, full_name: "agent-teams-ai/.github", default_branch: "main", archived: false, disabled: false };
  const centralPull = { number: 999, state: "open", merged: false, changed_files: 1,
    base: { sha: base, ref: "main", repo: controller }, head: { sha: head, repo: controller } };
  let controllerCalls = 0;
  const options = {
    clock: () => asOf, asOf, execution, basePolicyBytes: baseBytes,
    verifyController: async (value) => {
      controllerCalls++;
      return verifyAdmissionController(value, async (path) => path.endsWith("/pulls/999") ? centralPull
        : path.endsWith("/branches/main") ? { commit: { sha: base } } : controller);
    },
    readBaseFile: async (path, revision) => path === RECOVERY_AUTHORITY_PATH ? encode(authority) : readAdmissionBaseFile(path, revision),
    getRepository: async (repository) => ({ id: entryFor(repository).repository_id, full_name: repository,
      default_branch: "main", private: false, archived: false, disabled: false }),
    isCommitAncestor: async () => true,
    getDefaultBranchHead: async (repository) => repository === collateral.repository ? sourceHead : entryFor(repository).observed_default_branch_evidence.revision,
    getCheckRuns: async (repository, revision) => {
      const evidence = entryFor(repository).observed_default_branch_evidence;
      return [{ id: revision === sourceHead ? 74 : evidence.check_run_id, head_sha: revision, name: evidence.required_context,
        app: { id: evidence.integration_id }, conclusion: revision === sourceHead ? "failure" : "success",
        html_url: revision === sourceHead ? jobs[3].html_url : evidence.check_run_url }];
    },
    getWorkflowRun: async (repository, id) => {
      const entry = entryFor(repository), evidence = entry.observed_default_branch_evidence, workflow = recordFor(entry).reusable_workflow;
      return { id, workflow_id: evidence.workflow_id, run_attempt: 1, head_sha: id === 800 ? sourceHead : evidence.revision,
        head_branch: "main", path: evidence.caller_workflow_path, event: "push", status: "completed", conclusion: id === 800 ? "failure" : "success",
        repository: { id: entry.repository_id, full_name: repository },
        referenced_workflows: [{ sha: workflow.revision, path: `${workflow.repository}/${workflow.path}@${workflow.revision}` }] };
    },
    getWorkflowJobs: async (repository, id) => id === 800 ? structuredClone(jobs) : [{ id: 171, run_id: id, run_attempt: 1,
      head_sha: collateral.observed_default_branch_evidence.revision, name: "docs-protocol / trusted-authorize", status: "completed", conclusion: "success",
      html_url: `https://github.com/${repository}/actions/runs/${id}/job/171`,
      steps: [{ name: failureStep[0], status: "completed", conclusion: "success" }] }],
    readRepositoryFile: async (repository, path) => path === "architecture/foundation/docs-consumer-integration.json" ? encode({ schemaVersion: recordFor(entryFor(repository)).cohort_generation === 2 ? 3 : 2 }) : path.endsWith("managed-state.json") ? projectionFor(entryFor(repository)) : caller(recordFor(entryFor(repository))),
    readGitFile: async (repository, path, revision) => repository === execution.controller.repository
      ? path === proofCoordinate.path ? encode(proof) : readAdmissionBaseFile(path, revision)
      : options.readRepositoryFile(repository, path, revision),
    getDecisionComment: async () => ({ id: 7, user: { id: 8, login: "synthetic-owner", type: "User" }, body: decisionText,
      issue_url: "https://api.github.com/repos/agent-teams-ai/.github/issues/999" }),
    getCollaboratorPermission: async () => ({ permission: "admin", user: { id: 8, login: "synthetic-owner" } }),
    getJobLog: async (_repository, id) => id === 171 ? historicalLog : log,
  };
  const paths = { policy: join(directory, "policy.json"), exceptions: join(directory, "exceptions.json") };
  await writeFile(paths.exceptions, exceptions);
  return { policy, registry, selected, collateral, originalCollateral, authority, authorization, execution, options, centralPull,
    projectionFor,
    bindOperation: (kind) => {
      operation.kind = kind; operation.after_policy_blob = recoveryBlob(encode(policy));
      operation.target = recoveryTarget(registry, selected.desired_cohort_id);
      decisionText = `Authorize central admission recovery synthetic-integration\nRepository: agent-teams-ai/.github (1316243981)\nPR: 999\nPolicy: ${operation.before_policy_blob} -> ${operation.after_policy_blob}\nProof: ${base}:${proofCoordinate.path}@${proofCoordinate.blob}\nExpires: ${expiresAt}\n`;
      authorization.incidents[0].owner_decision.body_digest = recoveryDigest(Buffer.from(decisionText));
    },
    controllerCalls: () => controllerCalls,
    run: async () => { await writeFile(paths.policy, encode(policy)); return verifyDocsAdmissionChange(paths, options); } };
}

test("full imported verifier admits exact TEST selection with independently covered unchanged Token pending", async (t) => {
  const f = await fixture(t); const result = await f.run();
  assert.equal(result.historical_verified.length, 6); assert.equal(result.current_verified.length, 5);
  assert.equal(result.recovery_pending.length, 1); assert.equal(result.recovery_pending[0].repository_id, f.collateral.repository_id);
  assert.deepEqual(f.collateral, f.originalCollateral);
  assert.equal(f.selected.desired_cohort_id, "docs-2026-09-08-stable15");
  assert.equal(f.collateral.desired_cohort_id, "docs-2026-08-28-stable8");
  assert.equal(f.controllerCalls(), 2);
});

const negatives = {
  "PR-head incident proof": (f) => { f.options.readBaseFile = async (path, revision) => path === RECOVERY_AUTHORITY_PATH ? null : readAdmissionBaseFile(path, revision); },
  "self-approved authority": (f) => { f.authorization.approved = true; },
  "uncovered additional failed row": (f) => { const get = f.options.getCheckRuns;
    f.options.getCheckRuns = async (repo, revision) => repo === "agent-teams-ai/agent-runtime" ? [] : get(repo, revision); },
  "wrong current source head": (f) => { const get = f.options.getDefaultBranchHead;
    f.options.getDefaultBranchHead = async (repo) => repo === f.collateral.repository ? "e".repeat(40) : get(repo); },
  "wrong current target generation": (f) => { delete f.selected.desired_cohort_generation; },
  "Token selection of TEST-only stable15": (f) => { Object.assign(f.collateral, { desired_cohort_id: f.selected.desired_cohort_id, desired_cohort_generation: 2, cohort_binding_status: "rollout_pending" }); },
  "unknown full policy field": (f) => { f.policy.arbitrary = true; },
  "revoked authority": (f) => { f.authorization.state = "revoked"; },
  "cross-PR replay": (f) => { f.authorization.pull_number = 998; },
  "late controller drift": (f) => { const verify = f.options.verifyController;
    f.options.verifyController = async (execution) => { if (f.controllerCalls() === 1) f.centralPull.head.sha = "f".repeat(40); return verify(execution); }; },
};
for (const [name, mutate] of Object.entries(negatives)) {
  test(`full imported verifier rejects ${name}`, async (t) => { const f = await fixture(t); mutate(f); await assert.rejects(f.run()); });
}


function successfulTarget(f, advance = false) {
  const original = structuredClone(f.selected);
  const targetId = advance ? "docs-2026-09-08-stable14" : f.selected.desired_cohort_id;
  const record = f.registry.cohorts.find((row) => row.cohort_id === targetId);
  const targetHead = "e".repeat(40);
  const evidence = { ...original.observed_default_branch_evidence, revision: targetHead, check_run_id: 904,
    check_run_url: `https://github.com/${original.repository}/actions/runs/900/job/904`, workflow_run_id: 900,
    caller_workflow_digest: record.assets.caller_workflow.rendered_digest, observed_at: "2026-09-08T18:00:00Z" };
  if (advance) {
    const packageByName = new Map(record.packages.map((pkg) => [pkg.name, pkg.version]));
    Object.assign(f.selected, { desired_cohort_id: targetId, observed_cohort_id: targetId, observed_cohort_generation: 2,
      observed_cohort_record_digest: record.record_digest,
      observed_cohort_event_digest: f.registry.events.find((event) => event.cohort_id === targetId && event.state === "QUALIFIED").event_digest,
      cohort_binding_status: "bound", observed_default_branch_evidence: evidence,
      exact_package_version: packageByName.get("@agent-teams/docs-protocol"),
      exact_foundation_version: packageByName.get("@agent-teams/engineering-foundation"), reusable_workflow_revision: record.reusable_workflow.revision,
      exact_cohort_v2_packages: Object.fromEntries(["repository-mutation", "document-authoring", "docs-protocol", "docs-protocol-agent-teams", "engineering-foundation"]
        .map((name) => [name.replaceAll("-", "_"), packageByName.get(`@agent-teams/${name}`)])) });
    f.selected.qualification.observed_revision = targetHead;
    f.bindOperation("observation");
  }
  const priorOptions = { ...f.options };
  f.options.getDefaultBranchHead = async (repo) => repo === original.repository ? targetHead : priorOptions.getDefaultBranchHead(repo);
  f.options.getCheckRuns = async (repo, revision) => repo === original.repository ? [{ id: revision === targetHead ? 904 : original.observed_default_branch_evidence.check_run_id,
    head_sha: revision, name: evidence.required_context, app: { id: evidence.integration_id }, conclusion: "success",
    html_url: revision === targetHead ? evidence.check_run_url : original.observed_default_branch_evidence.check_run_url }] : priorOptions.getCheckRuns(repo, revision);
  f.options.getWorkflowRun = async (repo, id) => {
    if (repo !== original.repository) return priorOptions.getWorkflowRun(repo, id);
    const binding = id === 900 ? record : f.registry.cohorts.find((row) => row.cohort_id === original.observed_cohort_id);
    const workflow = binding.reusable_workflow;
    return { id, workflow_id: evidence.workflow_id, run_attempt: 1, head_sha: id === 900 ? targetHead : original.observed_default_branch_evidence.revision,
      head_branch: "main", path: original.caller_workflow_path, event: "push", status: "completed", conclusion: "success",
      repository: { id: original.repository_id, full_name: repo },
      referenced_workflows: [{ sha: workflow.revision, path: `${workflow.repository}/${workflow.path}@${workflow.revision}` }] };
  };
  f.options.getWorkflowJobs = async (repo, id, attempt) => repo === original.repository ?
    ["trusted-authorize", "trusted-structural", "trusted-qualification", "docs-protocol-check"].map((role, index) => ({ id: 901 + index,
      run_id: 900, run_attempt: 1, head_sha: targetHead, name: `docs-protocol / ${role}`, status: "completed", conclusion: "success",
      html_url: `https://github.com/${repo}/actions/runs/900/job/${901 + index}`,
      steps: successfulSteps(role, record.cohort_generation) })) : priorOptions.getWorkflowJobs(repo, id, attempt);
  f.options.readRepositoryFile = async (repo, path, revision) => {
    if (repo !== original.repository) return priorOptions.readRepositoryFile(repo, path, revision);
    const id = revision === targetHead ? targetId : original.observed_cohort_id;
    return path === "architecture/foundation/docs-consumer-integration.json" ? encode({ schemaVersion: record.cohort_generation === 2 ? 3 : 2 }) : path.endsWith("managed-state.json") ? f.projectionFor(original, id) : caller(f.registry.cohorts.find((row) => row.cohort_id === id));
  };
  return { original, targetHead, targetId };
}

test("full imported selected stable15 success remains separate from historical observed stable9.1", async (t) => {
  const f = await fixture(t); const { original, targetId } = successfulTarget(f);
  const report = await f.run();
  assert.equal(report.current_verified.find((row) => row.repository_id === f.selected.repository_id).cohort_id, targetId);
  assert.equal(f.selected.observed_cohort_id, original.observed_cohort_id);
  assert.equal(report.recovery_pending.length, 1);
});

test("full imported observation finalizes only the base-selected target while collateral remains pending", async (t) => {
  const f = await fixture(t); const { targetId, targetHead } = successfulTarget(f, true);
  const report = await f.run();
  assert.equal(report.current_verified.find((row) => row.repository_id === f.selected.repository_id).revision, targetHead);
  assert.equal(f.selected.observed_cohort_id, targetId);
  assert.equal(report.recovery.authorization_id, "synthetic-integration");
  assert.equal(report.recovery_pending.length, 1);
});

for (const conclusion of ["failure", "skipped"]) {
  test(`full imported observation rejects ${conclusion} target qualification`, async (t) => {
    const f = await fixture(t); successfulTarget(f, true);
    const get = f.options.getWorkflowJobs;
    f.options.getWorkflowJobs = async (repo, id, attempt) => (await get(repo, id, attempt)).map((job) =>
      repo === f.selected.repository && job.name.endsWith("trusted-qualification") ? { ...job, conclusion } : job);
    await assert.rejects(f.run(), /target trusted\/semantic job/u);
  });
}

// Independent review regressions: exercise the imported complete orchestration,
// including matching contexts on the recorded observation and the final reread.
for (const advance of [false, true]) {
  for (const late of [false, true]) {
    for (const conclusion of ["success", "failure", "cancelled", null]) {
      test(`current check uniqueness: advance=${advance}, late=${late}, conclusion=${conclusion}`, async (t) => {
        const f = await fixture(t); const { targetHead } = successfulTarget(f, advance);
        const get = f.options.getCheckRuns; let reads = 0;
        f.options.getCheckRuns = async (repo, revision) => {
          const checks = await get(repo, revision);
          if (repo === f.selected.repository && revision === targetHead && ++reads > (late ? (advance ? 2 : 1) : 0)) {
            return [...checks, { ...checks[0], id: 1904, conclusion,
              html_url: `https://github.com/${repo}/actions/runs/1900/job/1904` }];
          }
          return checks;
        };
        await assert.rejects(f.run(), /check|success|ambiguous|execution/i);
      });
    }
  }
}

test("skipped check on the same head is not competing admission evidence", async (t) => {
  const f = await fixture(t); const { targetHead } = successfulTarget(f, true);
  const get = f.options.getCheckRuns;
  f.options.getCheckRuns = async (repo, revision) => {
    const checks = await get(repo, revision);
    return repo === f.selected.repository && revision === targetHead
      ? [...checks, { ...checks[0], id: 1904, conclusion: "skipped",
        html_url: `https://github.com/${repo}/actions/runs/1900/job/1904` }] : checks;
  };
  const result = await f.run();
  assert.ok(result.current_verified.some((row) => row.revision === targetHead));
});

test("latest attempt replaces an earlier check from the same workflow run", async (t) => {
  const f = await fixture(t); const { targetHead } = successfulTarget(f, true);
  const get = f.options.getCheckRuns;
  f.options.getCheckRuns = async (repo, revision) => {
    const checks = await get(repo, revision);
    if (repo !== f.selected.repository || revision !== targetHead) return checks;
    const current = checks[0];
    return [{ ...current, id: current.id - 1, conclusion: "failure",
      html_url: current.html_url.replace(/\/job\/\d+$/u, `/job/${current.id - 1}`) }, current];
  };
  const result = await f.run();
  assert.ok(result.current_verified.some((row) => row.revision === targetHead));
});

for (const field of ["head_sha", "name", "app"]) {
  test(`different current check ${field} does not create context ambiguity`, async (t) => {
    const f = await fixture(t); const { targetHead } = successfulTarget(f, true);
    const get = f.options.getCheckRuns;
    f.options.getCheckRuns = async (repo, revision) => {
      const checks = await get(repo, revision);
      return repo === f.selected.repository && revision === targetHead
        ? [...checks, { ...checks[0], id: 1904, conclusion: "failure",
          [field]: field === "app" ? { id: 999 } : "unrelated" }] : checks;
    };
    const result = await f.run();
    assert.ok(result.current_verified.some((row) => row.revision === targetHead));
  });
}

test("historical recorded success remains valid despite a later failed check at that historical revision", async (t) => {
  const f = await fixture(t); const { original } = successfulTarget(f, true);
  const get = f.options.getCheckRuns;
  f.options.getCheckRuns = async (repo, revision) => {
    const checks = await get(repo, revision);
    return repo === original.repository && revision === original.observed_default_branch_evidence.revision
      ? [...checks, { ...checks[0], id: 1904, conclusion: "failure" }] : checks;
  };
  assert.equal((await f.run()).recovery_pending.length, 1);
});

async function bootstrapFixture(t) {
  const b = await firstBinding(t, 1);
  return { f: b.f, initial: b.prior, run: b.run };
}

test("ordinary bootstrap_pending first admission accepts a valid null-observation base without recovery", async (t) => {
  const { initial, run } = await bootstrapFixture(t);
  const result = await run();
  assert.equal(result.current_verified.length, 6);
  assert.equal(result.recovery_pending.length, 0);
  assert.ok(result.current_verified.some((r) => r.repository_id === initial.repository_id));
});

for (const kind of ["missing check", "failed check", "bound missing history", "partial bootstrap history", "wrong selected target", "moving target"]) {
  test(`first admission rejects ${kind}`, async (t) => {
    const { f, initial, run } = await bootstrapFixture(t);
    if (kind === "bound missing history") { initial.admission_status = "admitted"; initial.cohort_binding_status = "bound"; }
    if (kind === "partial bootstrap history") initial.observed_cohort_record_digest = "sha256:" + "0".repeat(64);
    if (kind === "wrong selected target") initial.desired_cohort_id = "docs-2026-09-08-stable15";
    if (kind === "moving target") {
      const get = f.options.getDefaultBranchHead;
      f.options.getDefaultBranchHead = async (repo) => repo === initial.repository ? "f".repeat(40) : get(repo);
    }
    if (["missing check", "failed check"].includes(kind)) {
      const get = f.options.getCheckRuns;
      f.options.getCheckRuns = async (repo, rev) => repo !== initial.repository ? get(repo, rev)
        : kind === "missing check" ? [] : (await get(repo, rev)).map((c) => ({ ...c, conclusion: "failure" }));
    }
    await assert.rejects(run(), /check|success|history|historical|selected target|default head/i);
  });
}


test("bootstrap accepts an explicitly null observed generation allowed by the schema", async (t) => {
  const { initial, run } = await bootstrapFixture(t);
  initial.observed_cohort_generation = null;
  const result = await run();
  assert.equal(result.current_verified.length, 6);
  assert.equal(result.recovery_pending.length, 0);
});

// Imported independent P1 regressions; synthetic API evidence, real validators.
async function firstBinding(t, generation = 2, schemaVersion = generation === 2 ? 3 : 2) {
  const f = await fixture(t);
  if (generation === 2) successfulTarget(f, true);
  const selected = generation === 2 ? f.selected : f.policy.repositories.find(r => r.repository.endsWith('/extension-foundation'));
  const basePolicy = structuredClone(f.policy);
  const prior = basePolicy.repositories.find(r => r.repository_id === selected.repository_id);
  prior.admission_status = 'admission_candidate'; prior.cohort_binding_status = 'bootstrap_pending';
  for (const key of ['observed_cohort_id', 'observed_cohort_record_digest', 'observed_cohort_event_digest',
    'exact_package_version', 'exact_foundation_version', 'reusable_workflow_revision', 'observed_default_branch_evidence']) prior[key] = null;
  delete prior.observed_cohort_generation; delete prior.exact_cohort_v2_packages;
  prior.qualification = { status: 'not_qualified', observed_revision: null, evidence_paths: [] };
  const read = async name => JSON.parse(await readFile(`governance/${name}.json`, 'utf8'));
  const [policySchema, schema, exceptions, security] = await Promise.all(['docs-protocol-policy-v2.schema',
    'docs-qualified-cohorts.schema', 'docs-protocol-exceptions', 'code-security-defaults'].map(read));
  const validate = () => { for (const p of [basePolicy, f.policy]) {
    validateDocsProtocolPolicy(p, policySchema); validateDocsGovernanceReferences(f.registry, exceptions, p, security);
  } };
  validate();
  f.options.getDefaultBranchHead = async repo => f.policy.repositories.find(r => r.repository === repo).observed_default_branch_evidence.revision;
  const readConsumer = f.options.readRepositoryFile;
  f.options.readRepositoryFile = async (repo, path, revision) => {
    if (repo === selected.repository && path === "architecture/foundation/docs-consumer-integration.json") {
      assert.equal(revision, selected.observed_default_branch_evidence.revision);
      return encode({ schemaVersion });
    }
    return readConsumer(repo, path, revision);
  };
  let jobReads = 0;
  const jobs = f.options.getWorkflowJobs;
  f.options.getWorkflowJobs = async (repo, id, attempt) => {
    if (repo !== selected.repository) return jobs(repo, id, attempt);
    jobReads++;
    const evidence = selected.observed_default_branch_evidence;
    return ['trusted-authorize', 'trusted-structural', 'trusted-qualification', 'docs-protocol-check'].map((role, index) => {
      const jobId = role === 'docs-protocol-check' ? evidence.check_run_id : 901 + index;
      return { id: jobId, run_id: evidence.workflow_run_id, run_attempt: 1, head_sha: evidence.revision,
        name: `docs-protocol / ${role}`, status: 'completed', conclusion: 'success',
        html_url: `https://github.com/${repo}/actions/runs/${evidence.workflow_run_id}/job/${jobId}`,
        steps: successfulSteps(role, generation, schemaVersion) };
    });
  };
  return { f, selected, prior, validate, jobReads: () => jobReads,
    run: () => verifyDocsAdmissionEvidence(f.policy, f.registry, schema, { ...f.options, basePolicy }) };
}

for (const generation of [1, 2]) {
  test(`bootstrap positive generation ${generation}: six current successes and zero recovery pending`, async t => {
    const b = await firstBinding(t, generation); const result = await b.run();
    assert.equal(result.current_verified.length, 6); assert.equal(result.recovery_pending.length, 0);
    assert.ok(result.current_verified.some(r => r.repository_id === b.selected.repository_id));
    assert.ok(b.jobReads() > 0, "first admission must read target qualification and semantic jobs");
  });
}

const projectionNegatives = {
  'wrong package integrity': p => { Object.values(p.packages)[0].integrity = 'sha512-forged'; },
  'invented package version': p => { Object.values(p.packages)[0].version = '99.0.0'; },
  'wrong generation': p => { p.schemaVersion = 1; },
  'wrong repository': p => { p.repository.id = '999'; },
  'forged asset digest': p => { p.assets.callerWorkflowDigest = 'sha256:' + 'f'.repeat(64); },
  'wrong runtime': p => { p.runtime.node = '0.0.0'; },
};
for (const [label, mutate] of Object.entries(projectionNegatives)) {
  test(`REQUIRED bootstrap rejects ${label}`, async t => {
    const b = await firstBinding(t); const read = b.f.options.readRepositoryFile;
    b.f.options.readRepositoryFile = async (repo, path, rev) => {
      const bytes = await read(repo, path, rev);
      if (repo !== b.selected.repository || !path.endsWith('managed-state.json')) return bytes;
      const p = JSON.parse(bytes); mutate(p); return Buffer.from(JSON.stringify(p));
    };
    await assert.rejects(b.run(), /target|projection|Cohort|package|runtime/i);
  });
}
for (const mutation of ['missing jobs', 'failed qualification', 'skipped semantics', 'wrong runner', 'missing attempt']) {
  test(`REQUIRED bootstrap rejects ${mutation}`, async t => {
    const b = await firstBinding(t);
    if (['wrong runner','missing attempt'].includes(mutation)) {
      const get = b.f.options.getWorkflowRun;
      b.f.options.getWorkflowRun = async (repo, id) => {
        const run = await get(repo, id);
        if (repo === b.selected.repository) {
          if (mutation === 'wrong runner') run.referenced_workflows[0].sha = 'f'.repeat(40);
          else delete run.run_attempt;
        } return run;
      };
    } else {
      const get = b.f.options.getWorkflowJobs;
      b.f.options.getWorkflowJobs = async (repo, id, attempt) => {
        const jobs = await get(repo, id, attempt); if (repo !== b.selected.repository) return jobs;
        if (mutation === 'missing jobs') return [];
        if (mutation === 'failed qualification') jobs.find(j => j.name.endsWith('trusted-qualification')).conclusion = 'failure';
        else jobs.find(j => j.name.endsWith('docs-protocol-check')).steps.forEach(s => s.conclusion = 'skipped');
        return jobs;
      };
    }
    await assert.rejects(b.run(), /target|qualification|semantic|runner|attempt/i);
  });
}

for (const mode of ["selected-target", "final-observed", "first-binding-legacy", "first-binding-v2"]) {
  for (const mutation of ["missing", "wrong-generation", "failure", "cancelled", "skipped", "in-progress", "duplicate", "duplicate-skipped"]) {
    test(`executed qualification rejects ${mutation}: ${mode}`, async (t) => {
      const generation = mode === "first-binding-legacy" ? 1 : 2;
      const b = mode.startsWith("first-binding") ? await firstBinding(t, generation) : null;
      const f = b ? b.f : await fixture(t);
      if (!b) successfulTarget(f, mode === "final-observed");
      const selected = b ? b.selected : f.selected;
      const get = f.options.getWorkflowJobs;
      f.options.getWorkflowJobs = async (repo, id, attempt) => {
        const jobs = await get(repo, id, attempt);
        if (repo !== selected.repository) return jobs;
        const job = jobs.find((job) => job.name.endsWith("trusted-qualification"));
        const name = generation === 2 ? v2Qualification : legacyQualification;
        const executed = job.steps.find((step) => step.name === name);
        if (mutation === "missing") job.steps = job.steps.filter((step) => step !== executed);
        else if (mutation === "wrong-generation") {
          executed.conclusion = "skipped";
          job.steps = job.steps.filter((step) => step.name !== (generation === 2 ? legacyQualification : v2Qualification));
          job.steps.push({ name: generation === 2 ? legacyQualification : v2Qualification, status: "completed", conclusion: "success" });
        } else if (mutation.startsWith("duplicate")) {
          job.steps.push({ ...executed, conclusion: mutation === "duplicate" ? "success" : "skipped" });
        } else if (mutation === "in-progress") executed.status = "in_progress";
        else executed.conclusion = mutation;
        return jobs;
      };
      await assert.rejects(b ? b.run() : f.run(), /target qualification\/semantics did not actually execute successfully/u);
    });
  }
}

test("historical schema1 first binding accepts skipped qualification with successful controller and semantics", async t => {
  const b = await firstBinding(t, 1, 1);
  const result = await b.run();
  assert.equal(result.current_verified.length, 6);
  assert.equal(result.recovery_pending.length, 0);
});


test("supported pinned runners bind actual none, legacy, and cohort-v2 dispatch", async () => {
  const registry = JSON.parse(await readFile(REGISTRY_PATH));
  for (const id of ["docs-2026-08-31-stable10", "docs-2026-09-08-stable14", "docs-2026-09-08-stable15"]) {
    const record = registry.cohorts.find(row => row.cohort_id === id);
    const { path, revision, blob_sha: blob } = record.reusable_workflow;
    const bytes = await readAdmissionBaseFile(path, revision);
    assert.equal(recoveryBlob(bytes), blob);
    const steps = YAML.parse(bytes.toString()).jobs["trusted-qualification"].steps;
    const legacy = steps.filter(step => step.name === legacyQualification);
    assert.equal(legacy.length, 1);
    if (record.cohort_generation === 2) {
      assert.equal(legacy[0].if, "needs.trusted-authorize.outputs.qualification-profile == 'legacy'");
      assert.equal(steps.filter(step => step.name === v2Qualification).length, 1);
      assert.equal(steps.find(step => step.name === v2Qualification).if,
        "needs.trusted-authorize.outputs.qualification-profile == 'cohort-v2'");
      const authorization = (await readAdmissionBaseFile("scripts/verify-docs-consumer-gate.mjs", revision)).toString();
      assert.ok(authorization.includes('const qualificationProfile = v2 ? "cohort-v2" : profile.schemaVersion === 2 ? "legacy" : "none";'));
    } else {
      assert.equal(steps.filter(step => step.name === v2Qualification).length, 0);
      assert.equal(legacy[0].if, "steps.qualification.outputs.enabled == 'true'");
      const detector = steps.find(step => step.name === "Detect exact qualification contract version");
      assert.equal(detector.id, "qualification");
      assert.ok(detector.run.includes('integration.schemaVersion !== 1 && integration.schemaVersion !== 2'));
      assert.ok(detector.run.includes('integration.schemaVersion === 2 ? "true" : "false"'));
      assert.ok(detector.run.includes('/architecture/foundation/docs-consumer-integration.json'));
    }
    assert.equal(steps.filter(step => step.name === "Confirm current controller authority stayed stable through qualification").length, 1);
  }
});

for (const field of ["qualification", "controller", "semantic"]) {
  for (const mutation of ["missing", "failure", "cancelled", "in-progress", "duplicate", "wrong-branch"]) {
    test(`historical schema1 rejects ${mutation} ${field}`, async t => {
      const b = await firstBinding(t, 1, 1);
      const get = b.f.options.getWorkflowJobs;
      b.f.options.getWorkflowJobs = async (...args) => {
        const jobs = await get(...args);
        if (args[0] !== b.selected.repository) return jobs;
        const job = jobs.find(job => job.name.endsWith(field === "semantic" ? " / docs-protocol-check" : " / trusted-qualification"));
        const name = field === "qualification" ? legacyQualification : field === "controller"
          ? "Confirm current controller authority stayed stable through qualification" : "Run repository semantic documentation gate";
        const step = job.steps.find(step => step.name === name);
        if (mutation === "missing") job.steps = job.steps.filter(item => item !== step);
        else if (mutation === "duplicate") job.steps.push({ ...step });
        else if (mutation === "in-progress") step.status = "in_progress";
        else step.conclusion = mutation === "wrong-branch" ? (field === "qualification" ? "success" : "skipped") : mutation;
        return jobs;
      };
      await assert.rejects(b.run(), /target qualification\/semantics did not actually execute successfully/u);
    });
  }
}

for (const generation of [1, 2]) {
  for (const contract of [null, {}, { schemaVersion: 0 }, { schemaVersion: "1" }, { schemaVersion: generation === 2 ? 1 : 3 }]) {
    test(`immutable contract rejects invalid selector ${JSON.stringify(contract)} generation ${generation}`, async t => {
      const b = await firstBinding(t, generation);
      const read = b.f.options.readRepositoryFile;
      b.f.options.readRepositoryFile = async (repo, path, revision) => repo === b.selected.repository &&
        path === "architecture/foundation/docs-consumer-integration.json" ? encode(contract) : read(repo, path, revision);
      await assert.rejects(b.run());
    });
  }
}

for (const [generation, schemaVersion] of [[1, 1], [1, 2], [2, 3]]) {
  for (const mutation of ["success", "failure", "duplicate-skipped"]) {
    test(`unselected qualification rejects ${mutation} schema ${schemaVersion}`, async t => {
      const b = await firstBinding(t, generation, schemaVersion);
      const get = b.f.options.getWorkflowJobs;
      b.f.options.getWorkflowJobs = async (...args) => {
        const jobs = await get(...args);
        if (args[0] !== b.selected.repository) return jobs;
        const job = jobs.find(job => job.name.endsWith(" / trusted-qualification"));
        const name = generation === 2 ? legacyQualification : v2Qualification;
        job.steps = job.steps.filter(step => step.name !== name);
        job.steps.push({ name, status: "completed", conclusion: mutation === "duplicate-skipped" ? "skipped" : mutation });
        if (mutation === "duplicate-skipped") job.steps.push({ ...job.steps.at(-1) });
        return jobs;
      };
      await assert.rejects(b.run(), /target qualification\/semantics did not actually execute successfully/u);
    });
  }
}
