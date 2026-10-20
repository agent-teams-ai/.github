import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { qualifiedCohortProjection } from "./docs-cohort-policy.mjs";
import {
  RETIREMENT_ADMISSION_DOCUMENT_PATHS,
  verifyPlatformRetirementAdmission,
} from "./docs-platform-retirement-admission-v1.ts";
import type { RetirementAdmissionInput, RetirementFleetApi } from "./docs-platform-retirement-admission-v1.ts";
import { HOSTED_PROTECTION_OBSERVATION } from "./docs-quality-runtime-transition-v1.ts";

const BASE = "3a203362c25c5ebbe6e44b745ba3f8a5eecbaad0";
const HEAD = "75b5147ecd144c20eb3cdcd215f5e50d30075361";
const POLICY = "governance/docs-protocol-policy-v2.json";
const EXCEPTIONS = "governance/docs-protocol-exceptions.json";
const git = (...args: string[]): Buffer => execFileSync("git", args, { cwd: new URL("../", import.meta.url) });
const blob = (bytes: Buffer): string => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const encoded = (value: unknown): Buffer => Buffer.from(JSON.stringify(value));
interface Observation {
  revision: string; default_branch: string; check_run_id: number; check_run_url: string;
  required_context: string; integration_id: number; workflow_run_id: number;
  workflow_id: number; caller_workflow_path: string;
}
interface FleetEntry {
  repository: string; repository_id: number; repository_lifecycle: string; docs_role: string;
  cohort_binding_status: string; observed_cohort_id: string; observed_default_branch_evidence: Observation;
}
interface Cohort {
  cohort_id: string; reusable_workflow: { repository: string; path: string; revision: string };
}

function fixture(t: test.TestContext): {
  input: RetirementAdmissionInput; api: RetirementFleetApi;
  reads: string[]; rows: FleetEntry[]; rechecks: () => number;
  mutateDocument: (path: string, mutate: (value: Record<string, unknown>) => void) => void;
} {
  // Synthetic read API evidence is used only inside tests; no statuses are published.
  const originalToken = process.env.GH_TOKEN;
  process.env.GH_TOKEN = "synthetic-retirement-admission-test";
  t.after(() => { if (originalToken === undefined) { delete process.env.GH_TOKEN; } else { process.env.GH_TOKEN = originalToken; } });
  const documents = new Map(RETIREMENT_ADMISSION_DOCUMENT_PATHS.map(path => {
    const revision = [POLICY, EXCEPTIONS].includes(path) ? HEAD : BASE;
    const actualPath = path === "basePolicy" ? POLICY : path;
    const bytes = git("show", `${revision}:${actualPath}`);
    return [path, { revision, blob: blob(bytes), bytes }] as const;
  }));
  const rows = (JSON.parse(documents.get(POLICY)!.bytes.toString()) as { repositories: FleetEntry[] })
    .repositories.filter(entry => entry.repository_lifecycle === "active" && entry.docs_role === "consumer" &&
      ["bound", "rollout_pending"].includes(entry.cohort_binding_status));
  const registry = JSON.parse(documents.get("governance/docs-qualified-cohorts.json")!.bytes.toString()) as { cohorts: Cohort[] };
  const entry = (repository: string): FleetEntry => {
    const row = rows.find(candidate => candidate.repository === repository); assert.ok(row); return row;
  };
  const cohort = (repository: string): Cohort => {
    const value = registry.cohorts.find(row => row.cohort_id === entry(repository).observed_cohort_id); assert.ok(value); return value;
  };
  const reads: string[] = [];
  let rechecks = 0;
  const input: RetirementAdmissionInput = {
    target: { repository: "agent-teams-ai/.github", repositoryId: 1316243981, pullRequest: 367,
      pullId: 1, baseSHA: BASE, headSHA: HEAD,
      baseTreeSHA: git("rev-parse", `${BASE}^{tree}`).toString().trim(),
      headTreeSHA: git("rev-parse", `${HEAD}^{tree}`).toString().trim() },
    executor: { repository: "agent-teams-ai/.github", sourceRef: "refs/heads/governance/TEST-retirement",
      sourceSHA: "a".repeat(40), sourceTreeSHA: "b".repeat(40),
      workflowPath: ".github/workflows/TEST-retirement.yml", runId: 1, runAttempt: 1, event: "push" },
    protectionObservation: HOSTED_PROTECTION_OBSERVATION,
    documents,
    recheck: async () => { rechecks++; },
  };
  const api: RetirementFleetApi = {
    getRepository: async repository => {
      reads.push(repository);
      return { id: entry(repository).repository_id, full_name: repository, default_branch: "main", private: false };
    },
    isCommitAncestor: async () => true,
    getDefaultBranchHead: async repository => entry(repository).observed_default_branch_evidence.revision,
    getCheckRuns: async (repository, revision) => {
      const evidence = entry(repository).observed_default_branch_evidence;
      return [{ id: evidence.check_run_id, head_sha: revision, name: evidence.required_context,
        app: { id: evidence.integration_id }, conclusion: "success", html_url: evidence.check_run_url }];
    },
    getWorkflowRun: async (repository, id) => {
      const observed = entry(repository).observed_default_branch_evidence;
      return { id, workflow_id: observed.workflow_id, run_attempt: 1, head_sha: observed.revision,
        head_branch: observed.default_branch, path: observed.caller_workflow_path, event: "push", conclusion: "success",
        repository: { id: entry(repository).repository_id, full_name: repository } };
    },
    readRepositoryFile: async (repository, path) => {
      const record = cohort(repository);
      if (path.endsWith("docs-protocol-managed-state.json")) {
        return encoded(qualifiedCohortProjection(registry, record.cohort_id));
      }
      assert.equal(path, entry(repository).observed_default_branch_evidence.caller_workflow_path);
      return Buffer.from(`name: Documentation Protocol\n\non:\n  pull_request:\n  merge_group:\n  push:\n\npermissions:\n  contents: read\n  id-token: write\n\njobs:\n  docs-protocol:\n    uses: ${record.reusable_workflow.repository}/${record.reusable_workflow.path}@${record.reusable_workflow.revision}\n`);
    },
  };
  return { input, api, reads, rows, rechecks: () => rechecks,
    mutateDocument: (path, mutate) => {
      const old = documents.get(path); assert.ok(old);
      const value = JSON.parse(old.bytes.toString()) as Record<string, unknown>;
      mutate(value); const bytes = encoded(value); documents.set(path, { ...old, bytes, blob: blob(bytes) });
    } };
}

test("retirement uses real schema/reference validators and evaluates the complete current fleet", async t => {
  const f = fixture(t);
  const report = await verifyPlatformRetirementAdmission(f.input, f.api);
  assert.equal(report.fullFleetCurrent, true);
  assert.deepEqual(f.reads.toSorted(), f.rows.map(row => row.repository).toSorted());
  assert.equal(report.historical_verified.length, f.rows.length);
  assert.equal(report.current_verified.length, f.rows.length);
  assert.deepEqual(report.current_not_evaluated, []);
  assert.deepEqual(report.recovery_pending, []);
  assert.deepEqual(report.executor, f.input.executor);
  assert.deepEqual(report.target, f.input.target);
  assert.deepEqual(report.protectionObservation, HOSTED_PROTECTION_OBSERVATION);
  assert.notEqual(report.executor.sourceSHA, report.target.baseSHA);
  assert.equal("execution_base" in report, false);
  assert.equal(f.rechecks(), 3);
});

test("an unrelated current fleet failure remains fatal without a recovery escape", async t => {
  const f = fixture(t), get = f.api.getCheckRuns!;
  const collateral = f.rows.at(-1)!;
  f.api.getCheckRuns = async (repo, revision) => (await get(repo, revision)).map(value =>
    repo === collateral.repository ? { ...value as object, conclusion: "failure" } : value);
  await assert.rejects(verifyPlatformRetirementAdmission(f.input, f.api), /success|successful/u);
  assert.ok(f.reads.includes(collateral.repository));
});

test("a genuine fleet transport failure propagates instead of producing a partial report", async t => {
  const f = fixture(t);
  f.api.getRepository = async () => { throw new Error("TEST GitHub transport unavailable"); };
  await assert.rejects(verifyPlatformRetirementAdmission(f.input, f.api), /TEST GitHub transport unavailable/u);
});

for (const forbidden of ["recovery", "platformRecovery", "fullFleetCurrent", "requireCredential", "asOf", "clock", "currentTime"]) {
  test(`retirement refuses injected ${forbidden} authority`, async t => {
    const f = fixture(t);
    Object.assign(f.api, { [forbidden]: async () => "untrusted" });
    await assert.rejects(verifyPlatformRetirementAdmission(f.input, f.api), /Unsupported fleet override/u);
    assert.deepEqual(f.reads, []);
  });
}

test("wrong revision and missing document evidence reject before API fleet reads", async t => {
  const f = fixture(t), documents = new Map(f.input.documents);
  const policy = documents.get(POLICY)!;
  documents.set(POLICY, { ...policy, revision: BASE });
  await assert.rejects(verifyPlatformRetirementAdmission({ ...f.input, documents }, f.api), /actual target revision/u);
  documents.delete("governance/docs-qualified-cohorts.schema.json");
  await assert.rejects(verifyPlatformRetirementAdmission({ ...f.input, documents }, f.api), /complete closed document inventory/u);
  assert.deepEqual(f.reads, []);
});

test("real schema rejection cannot be replaced by a synthetic successful API", async t => {
  const f = fixture(t);
  f.mutateDocument(POLICY, value => { value.schema_version = -1; });
  await assert.rejects(verifyPlatformRetirementAdmission(f.input, f.api), /Schema|schema/u);
  assert.deepEqual(f.reads, []);
});

test("full cross-policy reference checks reject inventory drift", async t => {
  const f = fixture(t);
  f.mutateDocument("governance/organization-repository-inventory.json", value => {
    const repositories = value.repositories as Record<string, unknown>[];
    repositories[0]!.id = 1;
  });
  await assert.rejects(verifyPlatformRetirementAdmission(f.input, f.api), /identity|checksum|inventory|match/u);
  assert.deepEqual(f.reads, []);
});

test("a stale live head/source/protection recheck fails after successful fleet evaluation", async t => {
  const f = fixture(t);
  let calls = 0;
  await assert.rejects(verifyPlatformRetirementAdmission({ ...f.input, recheck: async () => {
    if (++calls === 3) { throw new Error("TEST protected source or live target moved"); }
  } }, f.api), /TEST protected source or live target moved/u);
  assert.equal(f.reads.length, f.rows.length);
});

test("target and executor cannot collapse into a fake legacy execution base", async t => {
  const f = fixture(t);
  await assert.rejects(verifyPlatformRetirementAdmission({ ...f.input,
    executor: { ...f.input.executor, sourceSHA: BASE } }, f.api), /masquerade as target base/u);
  await assert.rejects(verifyPlatformRetirementAdmission({ ...f.input,
    executor: { ...f.input.executor, sourceSHA: HEAD } }, f.api), /PR-head execution/u);
});

