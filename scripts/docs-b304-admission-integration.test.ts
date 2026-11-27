import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";

// The maintained tests are strict TypeScript. These two legacy Node entry
// modules remain an explicit unknown boundary; no declaration supplies types
// that their JavaScript implementation has not established.
type JsonRecord = Record<string, unknown>;
function isMapping(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function object(value: unknown): JsonRecord {
  assert.ok(isMapping(value));
  return value;
}
function array(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));
  return value;
}
function text(value: unknown): string {
  assert.ok(typeof value === "string");
  return value;
}
function number(value: unknown): number {
  assert.ok(typeof value === "number" && Number.isSafeInteger(value) && value > 0);
  return value;
}
function invoke(module: JsonRecord, name: string, ...args: unknown[]): unknown {
  const callable = module[name];
  assert.ok(typeof callable === "function", "Missing existing entry: " + name);
  const result: unknown = Reflect.apply(callable, undefined, args);
  return result;
}

const admission = object(
  await import(new URL("./verify-docs-admission-change.mjs", import.meta.url).href),
);
const evidence = object(
  await import(new URL("./verify-docs-cohort-evidence.mjs", import.meta.url).href),
);
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const source = "b88a08c8131b8c98650318eb374a5fd2840bed46";
const runtimeId = 1314129620;
const runtimeHead = "cae4d350c947cd9f74bc04130531527c9a36baeb";
const efId = 1333298097;
const policyPath = "governance/docs-protocol-policy-v2.json";
const registryPath = "governance/docs-qualified-cohorts.json";
const b304AuthorityPath = "governance/docs-b304-registry-recovery.json";
const asOf = "2026-11-26T23:00:00Z";
const encode = (value: unknown): Buffer => Buffer.from(JSON.stringify(value));
function sourceBytes(path: string): Buffer {
  return execFileSync("git", ["show", source + ":" + path], {
    cwd: repositoryRoot,
    maxBuffer: 8 * 1024 * 1024,
  });
}
function sourceDocument(path: string): JsonRecord {
  const parsed: unknown = JSON.parse(sourceBytes(path).toString("utf8"));
  return object(parsed);
}
function pendingRow(): JsonRecord {
  return {
    status: "recovery_pending",
    repository_id: runtimeId,
    source_head: runtimeHead,
    semantics: "unverified",
    qualification: "unverified",
    incident_id: "controlled-routing-fixture",
    recovery_family: "b304-registry-incident/v1",
  };
}

function fixture() {
  const policy = sourceDocument(policyPath);
  const basePolicy = structuredClone(policy);
  const registry = sourceDocument(registryPath);
  const schema = sourceDocument("governance/docs-qualified-cohorts.schema.json");
  const candidates = array(policy["repositories"])
    .map(object)
    .filter(
      (row) =>
        row["repository_lifecycle"] === "active" &&
        row["docs_role"] === "consumer" &&
        ["bound", "rollout_pending"].includes(text(row["cohort_binding_status"])),
    );
  assert.equal(candidates.length, 6);
  const state = {
    pendingCalls: 0,
    legacyCalls: 0,
    historicalRuntimeFailure: false,
    unrelatedFailure: false,
    rejectFinalPending: false,
    pendingResult: pendingRow(),
  };
  function entryFor(repository: string): JsonRecord {
    const entry = candidates.find((row) => row["repository"] === repository);
    assert.ok(entry);
    return entry;
  }
  function historical(entry: JsonRecord): JsonRecord {
    return object(entry["observed_default_branch_evidence"]);
  }
  function recordFor(entry: JsonRecord): JsonRecord {
    const record = array(registry["cohorts"])
      .map(object)
      .find((row) => row["cohort_id"] === entry["observed_cohort_id"]);
    assert.ok(record);
    return record;
  }
  function checkFor(entry: JsonRecord, revision: string): JsonRecord {
    const prior = historical(entry);
    return {
      id: prior["check_run_id"],
      head_sha: revision,
      name: prior["required_context"],
      app: { id: prior["integration_id"] },
      status: "completed",
      conclusion:
        state.historicalRuntimeFailure && entry["repository_id"] === runtimeId
          ? "failure"
          : "success",
      html_url: prior["check_run_url"],
    };
  }
  const adapters: JsonRecord = {
    asOf,
    getRepository: (repository: string) => ({
      id: entryFor(repository)["repository_id"],
      full_name: repository,
      default_branch: "main",
      archived: false,
      disabled: false,
      private: false,
    }),
    isCommitAncestor: () => true,
    getDefaultBranchHead: (repository: string) => {
      const entry = entryFor(repository);
      if (entry["repository_id"] === runtimeId) {
        return runtimeHead;
      }
      if (state.unrelatedFailure && entry["repository_id"] === 1348461381) {
        return "e".repeat(40);
      }
      return historical(entry)["revision"];
    },
    getCheckRuns: (repository: string, revision: string) => {
      const entry = entryFor(repository);
      const prior = historical(entry);
      if (entry["repository_id"] === runtimeId && revision === runtimeHead) {
        return [
          {
            ...checkFor(entry, revision),
            id: 139817264933,
            conclusion: "success",
            html_url:
              "https://github.com/agent-teams-ai/agent-runtime/actions/runs/45792972738/job/139817264933",
          },
          {
            ...checkFor(entry, revision),
            id: 140032783052,
            conclusion: "failure",
            html_url:
              "https://github.com/agent-teams-ai/agent-runtime/actions/runs/45724048832/job/140032783052",
          },
        ];
      }
      if (state.unrelatedFailure && revision !== prior["revision"]) {
        return [{ ...checkFor(entry, revision), conclusion: "failure" }];
      }
      return [checkFor(entry, revision)];
    },
    getWorkflowRun: (repository: string, id: number) => {
      const entry = entryFor(repository);
      const prior = historical(entry);
      const workflow = object(recordFor(entry)["reusable_workflow"]);
      return {
        id,
        workflow_id: prior["workflow_id"],
        run_attempt: 1,
        head_sha: prior["revision"],
        head_branch: "main",
        path: prior["caller_workflow_path"],
        event: "push",
        status: "completed",
        conclusion: "success",
        repository: { id: entry["repository_id"], full_name: repository },
        referenced_workflows: [
          {
            sha: workflow["revision"],
            path:
              text(workflow["repository"]) +
              "/" +
              text(workflow["path"]) +
              "@" +
              text(workflow["revision"]),
          },
        ],
      };
    },
    readRepositoryFile: (repository: string, path: string) => {
      const entry = entryFor(repository);
      const record = recordFor(entry);
      if (path === historical(entry)["caller_workflow_path"]) {
        const workflow = object(record["reusable_workflow"]);
        return Buffer.from(
          "name: Documentation Protocol\n\non:\n  pull_request:\n  merge_group:\n  push:\n\n" +
            "permissions:\n  contents: read\n  id-token: write\n\njobs:\n  docs-protocol:\n    uses: " +
            text(workflow["repository"]) +
            "/" +
            text(workflow["path"]) +
            "@" +
            text(workflow["revision"]) +
            "\n",
        );
      }
      assert.equal(path, "architecture/foundation/docs-protocol-managed-state.json");
      return encode({
        cohortId: record["cohort_id"],
        cohortAuthority: {
          recordDigest: entry["observed_cohort_record_digest"],
          qualificationEventDigest: entry["observed_cohort_event_digest"],
        },
      });
    },
    recovery: {
      execution: { changed_files: [policyPath] },
      getCapability: () => {
        state.legacyCalls += 1;
        throw new Error("Unrelated failure must still require its original authority.");
      },
    },
    b304Recovery: {
      verify: (entry: unknown, head: unknown) => {
        assert.equal(object(entry)["repository_id"], runtimeId);
        assert.equal(head, runtimeHead);
        state.pendingCalls += 1;
        if (state.rejectFinalPending && state.pendingCalls > 1) {
          throw new Error("Bound incident evidence changed during final reread.");
        }
        return structuredClone(state.pendingResult);
      },
    },
  };
  return { policy, basePolicy, registry, schema, candidates, state, adapters };
}
type Fixture = ReturnType<typeof fixture>;
async function audit(value: Fixture, overrides: JsonRecord = {}): Promise<JsonRecord> {
  return object(
    await invoke(
      evidence,
      "verifyDocsAdmissionEvidence",
      value.policy,
      value.registry,
      value.schema,
      { ...value.adapters, ...overrides },
    ),
  );
}
function selectEf(value: Fixture): void {
  const entry = array(value.policy["repositories"])
    .map(object)
    .find((row) => row["repository_id"] === efId);
  assert.ok(entry);
  entry["desired_cohort_id"] = "docs-2026-11-26-stable33";
  entry["desired_cohort_generation"] = 3;
  entry["v3_qualification_coordinates"] = {
    profile_schema_version: 4,
    cohort_schema_version: 3,
    managed_state_schema_version: 3,
    receipt_schema_version: 1,
    execution_envelope_schema_version: 1,
    evidence_class: "cohort-v3-supporting-canary",
  };
  entry["cohort_binding_status"] = "rollout_pending";
}

void test("bounded B304 routing retains the full historical fleet and only one unverified pending row", async () => {
  const value = fixture();
  const report = await audit(value);
  assert.equal(array(report["historical_verified"]).length, 6);
  assert.equal(array(report["current_verified"]).length, 5);
  assert.deepEqual(report["current_not_evaluated"], []);
  assert.deepEqual(report["recovery_pending"], [pendingRow()]);
  assert.equal(value.state.pendingCalls, 2, "Initial proof and final proof must both run.");
  assert.equal(value.state.legacyCalls, 0);
});

void test("bounded B304 routing does not broaden the ordinary EF desired current scope", async () => {
  const value = fixture();
  selectEf(value);
  const report = await audit(value, { basePolicy: value.basePolicy });
  assert.equal(array(report["historical_verified"]).length, 6);
  assert.deepEqual(
    array(report["current_verified"]).map((row) => object(row)["repository_id"]),
    [efId],
  );
  assert.equal(array(report["current_not_evaluated"]).length, 5);
  assert.ok(
    array(report["current_not_evaluated"]).some(
      (row) => object(row)["repository_id"] === runtimeId,
    ),
  );
  assert.deepEqual(report["recovery_pending"], []);
  assert.equal(value.state.pendingCalls, 0);
  assert.equal(value.state.legacyCalls, 0);
});

void test("bounded B304 routing never skips Runtime historical evidence in an EF-only current scope", async () => {
  const value = fixture();
  selectEf(value);
  value.state.historicalRuntimeFailure = true;
  await assert.rejects(
    audit(value, { basePolicy: value.basePolicy }),
    /live required check does not bind the observed head/u,
  );
  assert.equal(value.state.pendingCalls, 0);
});

void test("bounded B304 routing refuses an unrelated consumer failure", async () => {
  const value = fixture();
  value.state.unrelatedFailure = true;
  await assert.rejects(
    audit(value),
    /Unrelated failure must still require its original authority/u,
  );
  assert.equal(value.state.pendingCalls, 1);
  assert.equal(value.state.legacyCalls, 1);
});

void test("bounded B304 routing refuses revoked evidence at the final pending reread", async () => {
  const value = fixture();
  value.state.rejectFinalPending = true;
  await assert.rejects(audit(value), /Bound incident evidence changed during final reread/u);
  assert.equal(value.state.pendingCalls, 2);
});

for (const [field, forged] of [
  ["status", "current_verified"],
  ["semantics", "verified"],
  ["qualification", "qualified"],
  ["repository_id", efId],
  ["source_head", "f".repeat(40)],
  ["recovery_family", "legacy"],
] as const) {
  void test("bounded B304 routing refuses forged pending " + field, async () => {
    const value = fixture();
    value.state.pendingResult[field] = forged;
    await assert.rejects(audit(value), /pending|Runtime|B304|b304/u);
    assert.equal(value.state.pendingCalls, 1);
  });
}

void test("bounded B304 routing preserves original report rows during legacy reconciliation", () => {
  const original = {
    recovery_pending: [{ repository_id: 1348461381, source_head: "a".repeat(40) }],
    recovery: { recovery_pending: [{ repository_id: 1348461381, source_head: "a".repeat(40) }] },
  };
  const report = structuredClone(original);
  assert.equal(invoke(admission, "reconcileLegacyPending", report), report);
  assert.deepEqual(report, original);
});

void test("ordinary EF desired orchestration never reads or consumes a dormant B304 authority", async (t: TestContext) => {
  const value = fixture();
  selectEf(value);
  const directory = await mkdtemp(join(tmpdir(), "b304-admission-entry-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const priorToken = process.env.GH_TOKEN;
  process.env.GH_TOKEN = "synthetic-job-token";
  t.after(() => {
    if (priorToken === undefined) {
      delete process.env.GH_TOKEN;
    } else {
      process.env.GH_TOKEN = priorToken;
    }
  });
  const policy = join(directory, "policy.json");
  const exceptions = join(directory, "exceptions.json");
  const inventory = join(directory, "inventory.json");
  await writeFile(policy, encode(value.policy));
  await writeFile(exceptions, sourceBytes("governance/docs-protocol-exceptions.json"));
  await writeFile(inventory, sourceBytes("governance/organization-repository-inventory.json"));
  const execution = {
    controller: { repository: "agent-teams-ai/.github", repository_id: 1316243981 },
    pull_number: 9001,
    pull_id: 9002,
    head_ref: "synthetic-ef-desired",
    run_id: 9003,
    run_attempt: 1,
    base: source,
    head: "c".repeat(40),
    execution_base: source,
    changed_files: [policyPath],
  };
  let controllerReads = 0;
  let b304Reads = 0;
  const report = object(
    await invoke(
      admission,
      "verifyDocsAdmissionChange",
      { policy, exceptions, inventory },
      {
        ...value.adapters,
        clock: () => asOf,
        execution,
        basePolicyBytes: sourceBytes(policyPath),
        verifyController: (observed: unknown) => {
          assert.deepEqual(observed, execution);
          controllerReads += 1;
          return observed;
        },
        readBaseFile: async (path: string, revision: string) => {
          if (path === b304AuthorityPath) {
            b304Reads += 1;
            throw new Error("An out-of-scope record must not be consumed.");
          }
          const content = await invoke(admission, "readAdmissionBaseFile", path, revision);
          assert.ok(content === null || Buffer.isBuffer(content));
          return content;
        },
      },
    ),
  );
  assert.equal(controllerReads, 2);
  assert.equal(b304Reads, 0);
  assert.equal(value.state.pendingCalls, 0);
  assert.equal(array(report["historical_verified"]).length, 6);
  assert.deepEqual(report["recovery_pending"], []);
  assert.equal(report["b304_recovery"], undefined);
  assert.deepEqual(
    array(report["current_verified"]).map((row) => number(object(row)["repository_id"])),
    [efId],
  );
});
