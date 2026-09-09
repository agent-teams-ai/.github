import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { verifyRecoveryIncident } from "./docs-legacy-admission-recovery.mjs";

// Execute the actual admission functions without installing unrelated Renovate
// dependencies. Lifecycle/schema validation is an injected boundary here; the
// full cohort and governance suites remain required integration gates.
const source = await readFile(new URL("./verify-docs-cohort-evidence.mjs", import.meta.url), "utf8");
const section = (start, end) => {
  const offset = source.indexOf(start);
  const limit = source.indexOf(end, offset + start.length);
  assert.ok(offset >= 0 && limit > offset, `Missing source section ${start}`);
  return source.slice(offset, limit);
};
const makeVerifier = new Function("assert", "createHash", "validateDocsQualifiedCohorts", "isDeepStrictEqual", "qualifiedCohortProjection", "verifyRecoveryIncident",
  `const defaultIsCommitAncestor = () => { throw new Error("Unmocked ancestry adapter"); };
   ${section("function decisiveCheckRuns(", "\n}\n") + "\n}"}
   ${section("function workflowRunIdFromCheck(", "\n}\n") + "\n}"}
   ${section("function sha256(", "function plainRecord(")}
   ${section("export async function verifyAdmissionRevision(", "export async function verifyDocsCohortEvidence(").replaceAll("export ", "")}
   return verifyDocsAdmissionEvidence;`);
const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function fixture() {
  const repository = "example/consumer";
  const historical = "1".repeat(40);
  const current = "2".repeat(40);
  const caller = (id) => Buffer.from(`uses: example/authority/gate.yml@${id.repeat(40)}\n`);
  const workflow = (id) => ({ repository: "example/authority", path: "gate.yml", revision: id.repeat(40) });
  const record = (id) => ({ cohort_id: id, record_digest: digest(id), reusable_workflow: workflow(id),
    assets: { caller_workflow: { rendered_digest: digest(caller(id)) } } });
  const old = record("a");
  const target = record("b");
  const event = (id) => ({ event_digest: digest(`qualified:${id}`) });
  const evidence = { default_branch: "main", revision: historical, check_run_id: 11,
    workflow_run_id: 21, check_run_url: `https://github.com/${repository}/actions/runs/21/job/11`,
    required_context: "docs-protocol / docs-protocol-check", integration_id: 15368,
    workflow_id: 31, caller_workflow_path: ".github/workflows/docs.yml",
    caller_workflow_digest: old.assets.caller_workflow.rendered_digest };
  const entry = { repository, repository_id: 123, repository_lifecycle: "active",
    docs_role: "consumer", cohort_binding_status: "rollout_pending", admission_status: "admitted",
    observed_cohort_id: "a", desired_cohort_id: "b",
    observed_cohort_record_digest: old.record_digest,
    observed_cohort_event_digest: event("a").event_digest,
    caller_workflow_path: evidence.caller_workflow_path,
    required_check_context: evidence.required_context, observed_default_branch_evidence: evidence };
  const lifecycle = { cohortById: new Map([["a", old], ["b", target]]),
    qualificationEventById: new Map([["a", event("a")], ["b", event("b")]]) };
  const targetProjection = (id) => ({ schemaVersion: 1, cohortId: id, packages: { synthetic: { version: "1.0.0" } },
    schemas: { managedState: 1 }, runtime: { node: "24.18.0", pnpm: "11.18.0" }, assets: { callerWorkflowDigest: digest(caller(id)) },
    recordDigest: digest(id), qualificationEventDigest: event(id).event_digest,
    channel: "stable", eligibleAfter: "2026-09-01T00:00:00Z", upgradeFrom: ["a"], rollbackTo: [] });
  const checks = (revision) => [{ id: revision === historical ? 11 : 12, head_sha: revision,
    name: evidence.required_context, app: { id: 15368 }, conclusion: "success",
    html_url: revision === historical ? evidence.check_run_url
      : `https://github.com/${repository}/actions/runs/22/job/12` }];
  const run = (id) => ({ id, workflow_id: 31, head_sha: id === 21 ? historical : current,
    head_branch: "main", event: "push", conclusion: "success", status: "completed", run_attempt: 1,
    referenced_workflows: [{ sha: (id === 21 ? "a" : currentId).repeat(40),
      path: `example/authority/gate.yml@${(id === 21 ? "a" : currentId).repeat(40)}` }], path: evidence.caller_workflow_path,
    repository: { id: 123, full_name: repository } });
  let currentId = "b";
  const adapters = {
    getRepository: async () => ({ id: 123, full_name: repository, default_branch: "main" }),
    getDefaultBranchHead: async () => current,
    isCommitAncestor: async () => true,
    getCheckRuns: async (_repo, revision) => checks(revision),
    getWorkflowRun: async (_repo, id) => run(id),
    getWorkflowJobs: async () => ["trusted-authorize", "trusted-structural", "trusted-qualification", "docs-protocol-check"]
      .map((role, index) => ({ id: index === 3 ? 12 : 101 + index, run_id: 22, run_attempt: 1, head_sha: current,
        name: `docs-protocol / ${role}`, status: "completed", conclusion: "success",
        html_url: `https://github.com/${repository}/actions/runs/22/job/${index === 3 ? 12 : 101 + index}`,
        // These records are legacy Cohorts (no cohort_generation discriminator).
        // Match the canonical legacy branch, including the skipped v2 runner.
        steps: role === "trusted-qualification" ? [
          { name: "Run only the exact installed agent-teams-docs qualify CLI", status: "completed", conclusion: "success" },
          { name: "Run Cohort v2 qualification through the trusted base-owned runner", status: "completed", conclusion: "skipped" },
          { name: "Confirm current controller authority stayed stable through qualification", status: "completed", conclusion: "success" },
        ] : role === "docs-protocol-check" ? [
          { name: "Run repository semantic documentation gate", status: "completed", conclusion: "success" },
        ] : [] })),
    readRepositoryFile: async (_repo, path, revision) => {
      const id = revision === historical ? "a" : currentId;
      const expected = targetProjection(id);
      return path.endsWith("managed-state.json") ? Buffer.from(JSON.stringify({
        ...expected, repository: { provider: "github", id: "123", nameWithOwner: repository },
        cohortAuthority: { recordDigest: digest(id), qualificationEventDigest: event(id).event_digest,
          channel: expected.channel, eligibleAfter: expected.eligibleAfter, upgradeFrom: expected.upgradeFrom, rollbackTo: expected.rollbackTo } }))
        : caller(id);
    },
  };
  const verify = makeVerifier((condition, message) => assert.ok(condition, message), createHash, () => lifecycle, isDeepStrictEqual, (_registry, id) => targetProjection(id), verifyRecoveryIncident);
  return { entry, evidence, lifecycle, adapters, checks, run, historical, current,
    setCurrent: (id) => { currentId = id; },
    execute: () => verify({ repositories: [entry] }, {}, {}, adapters) };
}

for (const binding of ["a", "b"]) {
  test(`historical source and current ${binding === "a" ? "source" : "selected target"} success are independently bound`, async () => {
    const f = fixture();
    f.setCurrent(binding);
    const before = structuredClone(f.entry);
    Object.freeze(f.entry);
    const report = await f.execute();
    assert.deepEqual(report.historical_verified, [123]);
    assert.deepEqual(report.current_verified, [{ repository_id: 123, revision: f.current, cohort_id: binding }]);
    assert.deepEqual(report.recovery_pending, []);
    assert.deepEqual(f.entry, before);
  });
}

const negatives = {
  "unrelated target": (f) => f.setCurrent("c"),
  "wrong historical caller": (f) => { f.evidence.caller_workflow_digest = digest("forged"); },
  "wrong observed record": (f) => { f.entry.observed_cohort_record_digest = digest("forged"); },
  "wrong observed event": (f) => { f.entry.observed_cohort_event_digest = digest("forged"); },
  "wrong target record": (f) => { f.lifecycle.cohortById.get("b").record_digest = digest("forged"); },
  "wrong target event": (f) => { f.lifecycle.qualificationEventById.get("b").event_digest = digest("forged"); },
  "wrong target caller": (f) => { f.lifecycle.cohortById.get("b").assets.caller_workflow.rendered_digest = digest("forged"); },
  "wrong target generation": (f) => { f.lifecycle.cohortById.get("b").cohort_generation = 2; },
  "wrong identity": (f) => { f.entry.repository_id = 124; },
  "force pushed history": (f) => { f.adapters.isCommitAncestor = async () => false; },
  "moving head": (f) => { let n = 0; f.adapters.getDefaultBranchHead = async () => ++n % 2 ? f.current : "3".repeat(40); },
  "missing current check": (f) => { f.adapters.getCheckRuns = async (_r, rev) => rev === f.current ? [] : f.checks(rev); },
  "ambiguous current check": (f) => { f.adapters.getCheckRuns = async (_r, rev) => rev === f.current ? [...f.checks(rev), ...f.checks(rev)] : f.checks(rev); },
};
for (const [name, mutate] of Object.entries(negatives)) {
  test(`rejects ${name}`, async () => { const f = fixture(); mutate(f); await assert.rejects(f.execute(), { name: "AssertionError" }); });
}
for (const [field, value] of [["event", "pull_request"], ["head_sha", "3".repeat(40)],
  ["path", ".github/workflows/forged.yml"], ["conclusion", "failure"], ["workflow_id", 99]]) {
  test(`rejects wrong current run ${field}`, async () => {
    const f = fixture();
    f.adapters.getWorkflowRun = async (_r, id) => id === 21 ? f.run(id) : { ...f.run(id), [field]: value };
    await assert.rejects(f.execute(), { name: "AssertionError" });
  });
}
for (const conclusion of ["failure", "cancelled", "skipped", null]) {
  test(`does not classify arbitrary ${conclusion} as recovery`, async () => {
    const f = fixture();
    f.adapters.getCheckRuns = async (_r, rev) => f.checks(rev).map((check) =>
      rev === f.current ? { ...check, conclusion } : check);
    await assert.rejects(f.execute(), { name: "AssertionError" });
  });
}

const targetMutations = {
  "package SRI/coordinate": (f) => { const read = f.adapters.readRepositoryFile;
    f.adapters.readRepositoryFile = async (repo, path, revision) => {
      const content = await read(repo, path, revision);
      if (path.endsWith("managed-state.json") && revision === f.current) {
        const projection = JSON.parse(content); projection.packages.synthetic.version = "9.9.9";
        return Buffer.from(JSON.stringify(projection));
      }
      return content;
    }; },
  "runner binding": (f) => { const read = f.adapters.getWorkflowRun;
    f.adapters.getWorkflowRun = async (repo, id) => {
      const run = await read(repo, id); if (id === 22) run.referenced_workflows[0].sha = "f".repeat(40); return run;
    }; },
  "run attempt": (f) => { const read = f.adapters.getWorkflowRun;
    f.adapters.getWorkflowRun = async (repo, id) => ({ ...await read(repo, id), run_attempt: id === 22 ? 2 : 1 }); },
  "incomplete job pages": (f) => { const read = f.adapters.getWorkflowJobs; f.adapters.getWorkflowJobs = async () => (await read()).slice(1); },
  "failed qualification": (f) => { const read = f.adapters.getWorkflowJobs;
    f.adapters.getWorkflowJobs = async () => (await read()).map((job) => job.name.endsWith("trusted-qualification") ? { ...job, conclusion: "failure" } : job); },
  "skipped semantic execution": (f) => { const read = f.adapters.getWorkflowJobs;
    f.adapters.getWorkflowJobs = async () => (await read()).map((job) => ({ ...job, steps: job.steps.map((step) =>
      step.name === "Run repository semantic documentation gate" ? { ...step, conclusion: "skipped" } : step) })); },
};
// Exercise executed-step rejection on both selected-target and final-observed
// paths; successful job conclusions alone must not satisfy qualification.
for (const mutation of ["missing", "wrong-generation", "failure", "cancelled", "skipped", "duplicate"]) {
  targetMutations[`${mutation} qualification execution`] = (f) => {
    const read = f.adapters.getWorkflowJobs;
    f.adapters.getWorkflowJobs = async () => (await read()).map((job) => {
      if (!job.name.endsWith("trusted-qualification")) return job;
      const name = "Run only the exact installed agent-teams-docs qualify CLI";
      const executed = job.steps.find((step) => step.name === name);
      const steps = mutation === "missing" ? job.steps.filter((step) => step !== executed)
        : mutation === "duplicate" ? [...job.steps, { ...executed }]
          : job.steps.map((step) => step === executed
            ? { ...step, conclusion: mutation === "wrong-generation" ? "skipped" : mutation }
            : mutation === "wrong-generation" && step.name === "Run Cohort v2 qualification through the trusted base-owned runner"
              ? { ...step, conclusion: "success" } : step);
      return { ...job, steps };
    });
  };
}
for (const [name, mutate] of Object.entries(targetMutations)) {
  test(`selected target rejects wrong ${name}`, async () => {
    const f = fixture(); mutate(f); await assert.rejects(f.execute(), { name: "AssertionError" });
  });
}

function observationFixture() {
  const f = fixture();
  f.adapters.basePolicy = { repositories: [structuredClone(f.entry)] };
  Object.assign(f.entry, { cohort_binding_status: "bound", observed_cohort_id: "b",
    observed_cohort_record_digest: f.lifecycle.cohortById.get("b").record_digest,
    observed_cohort_event_digest: f.lifecycle.qualificationEventById.get("b").event_digest,
    observed_default_branch_evidence: { ...f.evidence, revision: f.current, check_run_id: 12,
      workflow_run_id: 22, check_run_url: f.checks(f.current)[0].html_url,
      caller_workflow_digest: f.lifecycle.cohortById.get("b").assets.caller_workflow.rendered_digest } });
  return f;
}

test("observed advancement verifies both prior source history and current successful selected target", async () => {
  const f = observationFixture(); const before = structuredClone(f.entry);
  const report = await f.execute();
  assert.deepEqual(report.current_verified, [{ repository_id: 123, revision: f.current, cohort_id: "b" }]);
  assert.deepEqual(report.recovery_pending, []); assert.deepEqual(f.entry, before);
});

for (const [name, mutate] of Object.entries({
  "unselected target": (f) => { f.adapters.basePolicy.repositories[0].desired_cohort_id = "a"; },
  "forged historical caller": (f) => { f.adapters.basePolicy.repositories[0].observed_default_branch_evidence.caller_workflow_digest = digest("forged"); },
  "stale successful observation": (f) => { f.adapters.getDefaultBranchHead = async () => "3".repeat(40); },
  "force-pushed prior observation": (f) => { f.adapters.isCommitAncestor = async () => false; },
  ...targetMutations,
})) {
  test(`final observed advancement rejects ${name}`, async () => {
    const f = observationFixture(); mutate(f); await assert.rejects(f.execute(), { name: "AssertionError" });
  });
}


test("a same-head workflow rerun cannot replay an earlier successful admission result", async () => {
  const f = fixture(); const get = f.adapters.getWorkflowRun; const count = new Map();
  f.adapters.getWorkflowRun = async (repo, id) => {
    const run = await get(repo, id); count.set(id, (count.get(id) ?? 0) + 1);
    return id === 22 && count.get(id) > 1 ? { ...run, run_attempt: 2, conclusion: "failure" } : run;
  };
  await assert.rejects(f.execute(), /workflow execution changed/u);
});
