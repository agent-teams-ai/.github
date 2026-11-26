import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Schema } from "ajv/dist/2020.js";
import {
  B304_RECOVERY_AUTHORITY_PATH,
  B304_RECOVERY_PROOF_PATH,
  b304RecoveryDecisionText,
  prepareB304AdmissionRecovery,
  verifyB304RegistryIncident,
  requireB304Pending,
  finishB304AdmissionRecovery,
  reconcileB304Pending,
  isB304RegistryIncidentSource,
  verifyB304IncidentArchive,
  verifyB304RecoveryStaging,
} from "./docs-b304-registry-incident.ts";
import type {
  B304ArchiveInput,
  B304StagingInput,
  B304IncidentAdapters,
  B304PrepareInput,
} from "./docs-b304-registry-incident.ts";

type Mapping = Record<string, unknown>;
const ROOT = new URL("../", import.meta.url);
const FIXTURES = new URL("./fixtures/docs-b304-registry-incident/", import.meta.url);
const CENTRAL = "agent-teams-ai/.github";
const RUNTIME = "agent-teams-ai/agent-runtime";
const HEAD = "cae4d350c947cd9f74bc04130531527c9a36baeb";
const OBSERVED = "b81ef94a35fb1fc70a35ddea6f0c61f567dc653e";
const FROZEN = "b30455e32cf5d54ade6d8301637701347e4ce57c";
const HISTORICAL = "755c8515a5d106402a7e9e2cff621fb1fdc855cf";
const CURRENT = "b88a08c8131b8c98650318eb374a5fd2840bed46";
const POLICY = "governance/docs-protocol-policy-v2.json";
const REGISTRY = "governance/docs-qualified-cohorts.json";
const EXCEPTIONS = "governance/docs-protocol-exceptions.json";
const RUN = 45724048832;
// These future PR/execution/decision values are synthetic ports, not a grant.
const BASE = "a".repeat(40);
const PROPOSED = "b".repeat(40);
const PROOF_REVISION = "c".repeat(40);
const VERIFIER_REVISION = "d".repeat(40);
const VERIFIER_PATH = "scripts/docs-b304-registry-incident.ts";
const verifierBytes = readFileSync(new URL("./docs-b304-registry-incident.ts", import.meta.url));
const gitCache = new Map<string, Buffer>();
const nativeFixture = parse(readFileSync(new URL("native-evidence.json", FIXTURES)));
const runtimeFixture = parse(readFileSync(new URL("runtime-files.json", FIXTURES)));

function isMapping(value: unknown): value is Mapping {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function mapping(value: unknown): Mapping {
  assert.ok(isMapping(value));
  return value;
}
function rows(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));
  return value;
}
function string(value: unknown): string {
  assert.ok(typeof value === "string");
  return value;
}
function parse(bytes: Buffer): Mapping {
  return mapping(JSON.parse(bytes.toString("utf8")) as unknown);
}
function encoded(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value, null, 2) + "\n");
}
function hash(bytes: Buffer): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}
function blob(bytes: Buffer): string {
  return createHash("sha1")
    .update("blob " + bytes.length + "\0")
    .update(bytes)
    .digest("hex");
}
function git(revision: string, path: string): Buffer {
  const key = revision + ":" + path;
  let result = gitCache.get(key);
  if (result === undefined) {
    result = execFileSync("git", ["show", key], { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 });
    gitCache.set(key, result);
  }
  return Buffer.from(result);
}
function schema(value: unknown): Schema {
  if (typeof value === "boolean") {
    return value;
  }
  return mapping(value);
}
function parserErrors(value: unknown, definition: unknown): unknown {
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema(definition));
  validate(value);
  return structuredClone(validate.errors ?? []);
}
function retirement(before: Buffer): Buffer {
  let source = before.toString("utf8");
  source = source
    .replace('"expected_repository_count": 11', '"expected_repository_count": 10')
    .replace('"owned_repository_count": 11', '"owned_repository_count": 10');
  const position = source.indexOf('"repository_id": 1336577313');
  assert.ok(position > 0);
  return Buffer.from(
    source.slice(0, position) +
      source
        .slice(position)
        .replace('"repository_lifecycle": "active"', '"repository_lifecycle": "deleted"'),
  );
}
function fixture() {
  const native = structuredClone(mapping(nativeFixture["native"]));
  const logs = new Map<number, Buffer>();
  const logBindings: Mapping = {};
  for (const [kind, raw] of Object.entries(mapping(nativeFixture["logs"]))) {
    const entry = mapping(raw);
    const id = Number(entry["job_id"]);
    const bytes = Buffer.from(string(entry["utf8"]));
    assert.equal(hash(bytes), entry["digest"]);
    logs.set(id, bytes);
    logBindings[kind] = { job_id: id, digest: hash(bytes) };
  }
  const sourceFiles = rows(runtimeFixture["files"]).map(mapping);
  const sourceBytes = new Map(
    sourceFiles.map((entry) => [string(entry["path"]), Buffer.from(string(entry["content"]))]),
  );
  for (const file of sourceFiles) {
    assert.equal(blob(Buffer.from(string(file["content"]))), file["blob"]);
  }
  const before = git(CURRENT, POLICY),
    registry = git(CURRENT, REGISTRY);
  const after = retirement(before),
    exceptions = git(CURRENT, EXCEPTIONS);
  assert.equal(blob(after), "f0d9b42d2968aabcc3d5148374286cd280ee34eb");
  const inputCoordinates: Mapping = {};
  for (const [key, revision, path] of [
    ["historical_policy", HISTORICAL, POLICY],
    ["historical_registry", HISTORICAL, REGISTRY],
    ["current_policy", CURRENT, POLICY],
    ["current_registry", CURRENT, REGISTRY],
    ["frozen_policy_schema", FROZEN, POLICY.replace(".json", ".schema.json")],
    ["frozen_registry_schema", FROZEN, REGISTRY.replace(".json", ".schema.json")],
    ["current_policy_schema", CURRENT, POLICY.replace(".json", ".schema.json")],
    ["current_registry_schema", CURRENT, REGISTRY.replace(".json", ".schema.json")],
  ]) {
    assert.ok(key !== undefined && revision !== undefined && path !== undefined);
    inputCoordinates[key] = { revision, path, blob: blob(git(revision, path)) };
  }
  const incident = {
    repository: RUNTIME,
    repository_id: 1314129620,
    source_head: HEAD,
    runner_revision: FROZEN,
  };
  const proof: Mapping = {
    schema_version: 1,
    classification: "inert-b304-registry-incident",
    incident,
    inputs: inputCoordinates,
    source_files: sourceFiles.map((entry) => ({ path: entry["path"], blob: entry["blob"] })),
    parser_errors: {
      policy: [],
      registry: parserErrors(
        parse(registry),
        parse(git(FROZEN, REGISTRY.replace(".json", ".schema.json"))),
      ),
    },
    native: structuredClone(native),
    logs: logBindings,
  };
  const execution: Mapping = {
    controller: { repository: CENTRAL, repository_id: 1316243981 },
    pull_number: 900001,
    pull_id: 900002,
    head_ref: "test/synthetic-b304-retirement",
    run_id: 900003,
    run_attempt: 1,
    base: BASE,
    head: PROPOSED,
    execution_base: BASE,
    changed_files: [POLICY],
  };
  const record: Mapping = {
    id: "synthetic-b304-retirement",
    state: "active",
    valid_from: "2026-11-26T18:00:00Z",
    expires_at: "2026-11-27T18:00:00Z",
    controller: execution["controller"],
    pull_number: execution["pull_number"],
    pull_id: execution["pull_id"],
    head_ref: execution["head_ref"],
    operation: {
      kind: "retire-deleted-canary",
      repository_id: 1336577313,
      before_policy_blob: blob(before),
      after_policy_blob: blob(after),
      registry_blob: blob(registry),
      exceptions_blob: blob(exceptions),
    },
    incident,
    proof: { revision: PROOF_REVISION, path: B304_RECOVERY_PROOF_PATH, blob: blob(encoded(proof)) },
    verifier_source: {
      revision: VERIFIER_REVISION,
      path: VERIFIER_PATH,
      blob: blob(verifierBytes),
    },
    owner_decision: {
      comment_id: 900004,
      actor_id: 900005,
      actor_login: "synthetic-owner",
      body_digest: "",
    },
  };
  let proofBytes = encoded(proof);
  let authority: Buffer | null = null;
  const comment: Mapping = {};
  const permission: Mapping = {
    permission: "admin",
    user: { id: 900005, login: "synthetic-owner" },
  };
  const controls = { now: "2026-11-26T18:00:01Z", head: HEAD, ancestry: true };
  const overrides = new Map<string, Buffer>();
  const sync = () => {
    proofBytes = encoded(proof);
    mapping(record["proof"])["blob"] = blob(proofBytes);
    const body = b304RecoveryDecisionText(record);
    mapping(record["owner_decision"])["body_digest"] = hash(Buffer.from(body));
    Object.assign(comment, {
      id: 900004,
      body,
      issue_url: "https://api.github.com/repos/" + CENTRAL + "/issues/900001",
      user: { id: 900005, login: "synthetic-owner", type: "User" },
    });
    authority = encoded({ schema_version: 1, authorization: record });
  };
  sync();
  const input: B304PrepareInput = {
    execution,
    asOf: controls.now,
    readBaseFile: async (path, revision) => {
      const overridden = overrides.get(CENTRAL + ":" + revision + ":" + path);
      if (overridden !== undefined) {
        return Buffer.from(overridden);
      }
      if (revision === PROOF_REVISION && path === B304_RECOVERY_PROOF_PATH) {
        return Buffer.from(proofBytes);
      }
      if (revision === VERIFIER_REVISION && path === VERIFIER_PATH) {
        return Buffer.from(verifierBytes);
      }
      if (revision !== BASE) {
        return git(revision, path);
      }
      assert.equal(revision, BASE);
      if (path === B304_RECOVERY_AUTHORITY_PATH) {
        return authority === null ? null : Buffer.from(authority);
      }
      if (path === POLICY) {
        return Buffer.from(before);
      }
      if (path === REGISTRY) {
        return Buffer.from(registry);
      }
      if (path === EXCEPTIONS) {
        return Buffer.from(exceptions);
      }
      if (path === VERIFIER_PATH) {
        return Buffer.from(verifierBytes);
      }
      throw new Error("Unexpected base path " + path);
    },
    basePolicyBytes: before,
    proposedPolicyBytes: after,
    registryBytes: registry,
    exceptionsBytes: exceptions,
  };
  const entry = rows(parse(before)["repositories"])
    .map(mapping)
    .find((row) => row["repository_id"] === 1314129620);
  assert.ok(entry);
  const adapters: B304IncidentAdapters = {
    currentTime: async () => controls.now,
    getRepository: async (repository) => {
      assert.equal(repository, RUNTIME);
      return {
        id: 1314129620,
        full_name: RUNTIME,
        default_branch: "main",
        archived: false,
        disabled: false,
      };
    },
    getDefaultBranchHead: async () => controls.head,
    isCommitAncestor: async () => controls.ancestry,
    getCheckRuns: async () =>
      rows(native["checks"]).map((value) => {
        const { app_id, ...check } = mapping(value);
        return { ...structuredClone(check), app: { id: app_id } };
      }),
    getWorkflowRun: async (_repository, id) => {
      assert.ok(id === RUN || id === 45792972738);
      return structuredClone(native[id === RUN ? "current" : "nightly"]);
    },
    getWorkflowRunAttempt: async (_repository, id, attempt) => {
      assert.equal(id, RUN);
      assert.equal(attempt, 1);
      return structuredClone(native["historical"]);
    },
    getWorkflowJobs: async (_repository, id, attempt) => {
      assert.equal(id, RUN);
      assert.ok(attempt === 1 || attempt === 2);
      return structuredClone(native[attempt === 1 ? "historical_jobs" : "current_jobs"]);
    },
    getJobLog: async (_repository, id) => {
      const result = logs.get(id);
      assert.ok(result);
      return Buffer.from(result);
    },
    readGitFile: async (repository, path, revision) => {
      const overridden = overrides.get(repository + ":" + revision + ":" + path);
      if (overridden !== undefined) {
        return Buffer.from(overridden);
      }
      if (
        repository === CENTRAL &&
        revision === PROOF_REVISION &&
        path === B304_RECOVERY_PROOF_PATH
      ) {
        return Buffer.from(proofBytes);
      }
      if (repository === CENTRAL && revision === VERIFIER_REVISION && path === VERIFIER_PATH) {
        return Buffer.from(verifierBytes);
      }
      if (repository === CENTRAL) {
        return git(revision, path);
      }
      assert.equal(repository, RUNTIME);
      assert.ok(revision === HEAD || revision === OBSERVED);
      const content = sourceBytes.get(path);
      assert.ok(content);
      return Buffer.from(content);
    },
    getDecisionComment: async () => structuredClone(comment),
    getCollaboratorPermission: async () => structuredClone(permission),
  };
  return {
    input,
    execution,
    entry,
    record,
    proof,
    native,
    logs,
    controls,
    comment,
    permission,
    overrides,
    adapters,
    sync,
    setAuthority: (value: Buffer | null) => {
      authority = value;
    },
  };
}
async function verifyFixture(f: ReturnType<typeof fixture>) {
  const capability = await prepareB304AdmissionRecovery(f.input);
  assert.ok(capability);
  const result = await verifyB304RegistryIncident(
    capability,
    f.entry,
    HEAD,
    f.execution,
    f.adapters,
  );
  return { capability, result };
}
async function refusal(change: (f: ReturnType<typeof fixture>) => void, message?: RegExp) {
  const f = fixture();
  change(f);
  if (message === undefined) {
    await assert.rejects(verifyFixture(f));
  } else {
    await assert.rejects(verifyFixture(f), message);
  }
}
function archiveInput(f: ReturnType<typeof fixture>): B304ArchiveInput {
  return {
    controllerBase: BASE,
    readBaseFile: f.input.readBaseFile,
    asOf: f.controls.now,
    basePolicyBytes: f.input.basePolicyBytes,
    registryBytes: f.input.registryBytes,
    exceptionsBytes: f.input.exceptionsBytes,
    proofBytes: encoded(f.proof),
    afterEvidence: async () => {},
  };
}
function stagingInput(f: ReturnType<typeof fixture>): B304StagingInput {
  return {
    ...archiveInput(f),
    recordBytes: encoded({ schema_version: 1, authorization: f.record }),
    operation: { pull_number: 900001, pull_id: 900002, head_ref: "test/synthetic-b304-retirement" },
    proposedPolicyBytes: f.input.proposedPolicyBytes,
  };
}

void test("B304 authority is absent or exactly inert until separately installed", async () => {
  const f = fixture();
  f.setAuthority(null);
  assert.equal(await prepareB304AdmissionRecovery(f.input), undefined);
  f.setAuthority(encoded({ schema_version: 1, authorization: null }));
  assert.equal(await prepareB304AdmissionRecovery(f.input), undefined);
  for (const malformed of [
    { schema_version: 2, authorization: null },
    { schema_version: 1, authorization: null, approved: true },
    { schema_version: 1 },
    { schema_version: 1, authorization: false },
  ]) {
    f.setAuthority(encoded(malformed));
    await assert.rejects(prepareB304AdmissionRecovery(f.input));
  }
  f.setAuthority(Buffer.from('{"schema_version":1,"authorization":null,"authorization":null}'));
  await assert.rejects(prepareB304AdmissionRecovery(f.input), /duplicate keys/u);
  f.setAuthority(Buffer.alloc(1024 * 1024 + 1, 32));
  await assert.rejects(prepareB304AdmissionRecovery(f.input), /bounded JSON/u);
});

void test("B304 dispatch preserves every unrelated and older Runtime legacy route", () => {
  const f = fixture();
  assert.equal(isB304RegistryIncidentSource(f.entry, HEAD), true);
  for (const invalid of [
    null,
    [],
    {},
    "Runtime",
    { ...f.entry, repository_id: 1 },
    { ...f.entry, repository: "other/runtime" },
    { ...f.entry, reusable_workflow_revision: "07d49409cb51f6124ad17673860b812a9d7b5f5b" },
    { ...f.entry, observed_cohort_id: "docs-2026-09-08-stable15" },
    { ...f.entry, observed_cohort_generation: 3 },
  ]) {
    assert.equal(isB304RegistryIncidentSource(invalid, HEAD), false);
  }
  assert.equal(isB304RegistryIncidentSource(f.entry, OBSERVED), false);
});

void test("B304 archive verification shares native proof but creates no authority or capability", async () => {
  const f = fixture();
  f.setAuthority(encoded({ schema_version: 1, authorization: null }));
  f.adapters.getDecisionComment = async () => {
    throw new Error("Archive cannot consume an owner decision");
  };
  const result = await verifyB304IncidentArchive(archiveInput(f), f.adapters);
  assert.deepEqual(result, {
    classification: "inert-b304-registry-incident",
    proof_blob: blob(encoded(f.proof)),
    source_head: HEAD,
    semantics: "unverified",
    qualification: "unverified",
    capability_created: false,
  });
  assert.equal(await prepareB304AdmissionRecovery(f.input), undefined);
  await assert.rejects(
    verifyB304RegistryIncident(
      {
        id: "synthetic-b304-retirement",
        recovery_family: "b304-registry-incident/v1",
      },
      f.entry,
      HEAD,
      f.execution,
      f.adapters,
    ),
    /capability/u,
  );
  const broken = structuredClone(f.proof);
  rows(mapping(broken["native"])["checks"]).pop();
  await assert.rejects(
    verifyB304IncidentArchive(
      {
        ...archiveInput(f),
        proofBytes: encoded(broken),
      },
      f.adapters,
    ),
    /native census/u,
  );
});

void test("B304 retained archive and fixture bind actual run endpoints", async () => {
  const f = fixture();
  f.setAuthority(encoded({ schema_version: 1, authorization: null }));
  const readRun = f.adapters.getWorkflowRun.bind(f.adapters);
  // These independently retained normal-run responses differ from attempt metadata.
  f.adapters.getWorkflowRun = async (repository, id) => {
    const run = mapping(await readRun(repository, id));
    return id === RUN
      ? { ...run, created_at: "2026-11-25T23:47:44Z" }
      : { ...run, updated_at: "2026-11-26T09:44:47Z" };
  };
  for (const proofBytes of [
    readFileSync(new URL(B304_RECOVERY_PROOF_PATH, ROOT)),
    encoded(f.proof),
  ]) {
    const result = await verifyB304IncidentArchive({ ...archiveInput(f), proofBytes }, f.adapters);
    assert.deepEqual(result, {
      classification: "inert-b304-registry-incident",
      proof_blob: blob(proofBytes),
      source_head: HEAD,
      semantics: "unverified",
      qualification: "unverified",
      capability_created: false,
    });
  }
  assert.equal(await prepareB304AdmissionRecovery(f.input), undefined);
});

void test("B304 rejects attempt metadata substituted for current or nightly run evidence", async () => {
  for (const [runId, field, attemptValue] of [
    [RUN, "created_at", "2026-11-26T16:05:21Z"],
    [45792972738, "updated_at", "2026-11-26T09:44:48Z"],
  ] as const) {
    await refusal((f) => {
      const readRun = f.adapters.getWorkflowRun.bind(f.adapters);
      f.adapters.getWorkflowRun = async (repository, id) => {
        const run = await readRun(repository, id);
        return id === runId ? { ...mapping(run), [field]: attemptValue } : run;
      };
    }, /entire independently read native census/u);
  }
});

void test("B304 installation requires prior source and archived proof yet creates no operation capability", async () => {
  const f = fixture();
  const candidate = stagingInput(f);
  f.setAuthority(encoded({ schema_version: 1, authorization: null }));
  const result = await verifyB304RecoveryStaging(candidate, f.adapters);
  assert.equal(result.authorization_id, "synthetic-b304-retirement");
  assert.equal(result.capability_created, false);
  assert.equal(result.qualification, "unverified");
  assert.equal(
    await prepareB304AdmissionRecovery(f.input),
    undefined,
    "staging does not write the authority",
  );
  await assert.rejects(
    verifyB304RegistryIncident(
      {
        id: result.authorization_id,
        recovery_family: "b304-registry-incident/v1",
      },
      f.entry,
      HEAD,
      f.execution,
      f.adapters,
    ),
    /capability/u,
  );
  await assert.rejects(
    verifyB304RecoveryStaging(
      {
        ...candidate,
        operation: { ...candidate.operation, pull_id: 123 },
      },
      f.adapters,
    ),
    /record pull_id/u,
  );
  f.controls.ancestry = false;
  await assert.rejects(verifyB304RecoveryStaging(candidate, f.adapters), /base ancestry/u);
});

void test("B304 proof parsing refuses duplicate keys and requires regular Git ownership", async () => {
  const f = fixture();
  const source = encoded(f.proof).toString("utf8");
  await assert.rejects(
    verifyB304IncidentArchive(
      {
        ...archiveInput(f),
        proofBytes: Buffer.from(
          source.replace('"schema_version": 1,', '"schema_version": 1, "schema_version": 1,'),
        ),
      },
      f.adapters,
    ),
    /duplicate keys/u,
  );
  await assert.rejects(
    verifyB304IncidentArchive(
      {
        ...archiveInput(f),
        proofBytes: Buffer.alloc(1024 * 1024 + 1, 32),
      },
      f.adapters,
    ),
    /bounded JSON/u,
  );
  const original = f.input.readBaseFile;
  f.input.readBaseFile = async (path, revision) => {
    if (path === B304_RECOVERY_PROOF_PATH) {
      throw new Error("Admission authority must be one regular base-owned file.");
    }
    return original(path, revision);
  };
  await assert.rejects(verifyFixture(f), /regular base-owned/u);
});

void test("B304 archive and staging finish only after outer controller rereads and final owner validity", async () => {
  const f = fixture();
  f.setAuthority(encoded({ schema_version: 1, authorization: null }));
  let reads = 0;
  const suppliedArchive = archiveInput(f);
  const verifiedBlob = blob(suppliedArchive.proofBytes);
  const archive = await verifyB304IncidentArchive(
    {
      ...suppliedArchive,
      afterEvidence: async () => {
        reads += 1;
        suppliedArchive.proofBytes.fill(0);
      },
    },
    f.adapters,
  );
  assert.equal(reads, 1);
  assert.equal(archive.capability_created, false);
  assert.notEqual(blob(suppliedArchive.proofBytes), verifiedBlob);
  assert.equal(
    archive.proof_blob,
    verifiedBlob,
    "report identifies only its owned verified snapshot",
  );
  await assert.rejects(
    verifyB304IncidentArchive(
      {
        ...archiveInput(f),
        afterEvidence: async () => {
          throw new Error("fresh staging PR drift");
        },
      },
      f.adapters,
    ),
    /staging PR drift/u,
  );
  for (const change of ["owner", "expiry"]) {
    const staged = fixture();
    const input = stagingInput(staged);
    staged.setAuthority(encoded({ schema_version: 1, authorization: null }));
    await assert.rejects(
      verifyB304RecoveryStaging(
        {
          ...input,
          afterEvidence: async () => {
            if (change === "owner") {
              staged.comment["body"] = "revoked while checking the operation PR";
            } else {
              staged.controls.now = "2026-11-27T18:00:00Z";
            }
          },
        },
        staged.adapters,
      ),
      change === "owner" ? /decision content/u : /validity/u,
    );
  }
});

void test("B304 staging cannot replace active authority relax operation images or install different verifier code", async () => {
  const f = fixture();
  const candidate = stagingInput(f);
  await assert.rejects(verifyB304RecoveryStaging(candidate, f.adapters), /null-to-active/u);
  f.setAuthority(encoded({ schema_version: 1, authorization: null }));
  await assert.rejects(
    verifyB304RecoveryStaging(
      {
        ...candidate,
        proposedPolicyBytes: f.input.basePolicyBytes,
      },
      f.adapters,
    ),
    /operation postimage/u,
  );
  const original = candidate.readBaseFile;
  await assert.rejects(
    verifyB304RecoveryStaging(
      {
        ...candidate,
        readBaseFile: async (path, revision) =>
          path === VERIFIER_PATH && revision === BASE
            ? Buffer.from("different installed source")
            : original(path, revision),
      },
      f.adapters,
    ),
    /actual installed verifier/u,
  );
  f.comment["body"] = "approved";
  await assert.rejects(verifyB304RecoveryStaging(candidate, f.adapters), /decision content/u);
});

void test("B304 exact retired-canary operation yields only finalized unverified Runtime pending", async () => {
  const f = fixture();
  const { capability, result } = await verifyFixture(f);
  assert.deepEqual(result, {
    status: "recovery_pending",
    repository_id: 1314129620,
    source_head: HEAD,
    semantics: "unverified",
    qualification: "unverified",
    incident_id: "synthetic-b304-retirement",
    recovery_family: "b304-registry-incident/v1",
  });
  assert.deepEqual(requireB304Pending(result, f.entry, HEAD), result);
  await assert.rejects(
    () => finishB304AdmissionRecovery(capability, f.execution, f.controls.now),
    /final verified fleet reread/u,
  );
  assert.deepEqual(
    await verifyB304RegistryIncident(capability, f.entry, HEAD, f.execution, f.adapters),
    result,
  );
  const finalized = await finishB304AdmissionRecovery(capability, f.execution, f.controls.now);
  const legacy = {
    status: "recovery_pending",
    repository_id: 1348461381,
    source_head: "d".repeat(40),
  };
  const platform = {
    status: "recovery_pending",
    repository_id: 1319378484,
    source_head: "e".repeat(40),
  };
  const report = {
    recovery_pending: [legacy, result, platform],
    recovery: { recovery_pending: [legacy] },
    b304_recovery: finalized,
    historical_verified: [1314129620],
    current_verified: [],
  };
  const before = structuredClone(report);
  const view = reconcileB304Pending(report, finalized);
  assert.deepEqual(view["recovery_pending"], [legacy, platform]);
  assert.deepEqual(view["recovery"], report.recovery);
  assert.deepEqual(report, before, "the full report and old recovery proof remain untouched");
  assert.throws(
    () => reconcileB304Pending(report, structuredClone(finalized)),
    /opaque finalized/u,
  );
  await assert.rejects(
    verifyB304RegistryIncident(capability, f.entry, HEAD, f.execution, f.adapters),
    /finalized capability/u,
  );
  await assert.rejects(
    () => finishB304AdmissionRecovery(capability, f.execution, f.controls.now),
    /finalized capability/u,
  );
});

void test("B304 rejects serialized capabilities and every altered execution binding", async () => {
  const f = fixture();
  const { capability } = await verifyFixture(f);
  await assert.rejects(
    verifyB304RegistryIncident(structuredClone(capability), f.entry, HEAD, f.execution, f.adapters),
    /capability/u,
  );
  for (const [key, value] of [
    ["controller", { repository: CENTRAL, repository_id: 1 }],
    ["pull_number", 999],
    ["pull_id", 999],
    ["head_ref", "other"],
    ["run_id", 999],
    ["run_attempt", 2],
    ["base", "d".repeat(40)],
    ["head", "e".repeat(40)],
    ["execution_base", "f".repeat(40)],
    ["changed_files", [POLICY, REGISTRY]],
  ] as const) {
    await assert.rejects(
      verifyB304RegistryIncident(
        capability,
        f.entry,
        HEAD,
        { ...f.execution, [key]: value },
        f.adapters,
      ),
      key,
    );
  }
});

void test("B304 authority refuses expired revoked backdated and unbounded windows", async () => {
  for (const [key, value] of [
    ["state", "revoked"],
    ["state", "retired"],
    ["state", true],
    ["valid_from", "2026-11-26T19:00:00Z"],
    ["expires_at", "2026-11-26T18:00:01Z"],
    ["expires_at", "2026-12-05T18:00:00Z"],
    ["valid_from", "2026-11-26"],
  ] as const) {
    await refusal((f) => {
      f.record[key] = value;
      f.sync();
    });
  }
  await refusal((f) => {
    f.record["future_base"] = BASE;
    f.sync();
  }, /closed fields/u);
});

void test("B304 grants cannot select EF change another consumer or authorize their installation", async () => {
  for (const [key, value] of [
    ["kind", "selection"],
    ["repository_id", 1333298097],
    ["before_policy_blob", "d".repeat(40)],
    ["after_policy_blob", "e".repeat(40)],
    ["registry_blob", "f".repeat(40)],
    ["exceptions_blob", "a".repeat(40)],
  ] as const) {
    await refusal((f) => {
      mapping(f.record["operation"])[key] = value;
      f.sync();
    }, /sole permitted retirement/u);
  }
  await refusal((f) => {
    f.record["pull_id"] = 900020;
    f.sync();
  }, /record pull_id/u);
  await refusal((f) => {
    f.execution["changed_files"] = [POLICY, B304_RECOVERY_AUTHORITY_PATH];
  });
  await refusal((f) => {
    mapping(f.record["incident"])["source_head"] = "e".repeat(40);
    f.sync();
  }, /sole covered/u);
});

void test("B304 preparation binds whole exact policy registry and exception bytes", async () => {
  await refusal((f) => {
    f.input.proposedPolicyBytes = Buffer.from(f.input.basePolicyBytes);
  }, /retirement postimage/u);
  for (const key of ["basePolicyBytes", "registryBytes", "exceptionsBytes"] as const) {
    await refusal((f) => {
      f.input[key] = Buffer.concat([f.input[key], Buffer.from(" ")]);
    }, /base-owned/u);
  }
  await refusal((f) => {
    f.input.proposedPolicyBytes = Buffer.concat([f.input.proposedPolicyBytes, Buffer.from(" ")]);
  }, /postimage/u);
});

void test("B304 parser errors alone never excuse historical cohort or event rewrites", async () => {
  const original = parse(git(CURRENT, REGISTRY));
  const definition = parse(git(FROZEN, REGISTRY.replace(".json", ".schema.json")));
  const oldErrors = parserErrors(original, definition);
  assert.equal(rows(oldErrors).length, 39);
  for (const mutation of ["package", "event"]) {
    const changed = structuredClone(original);
    if (mutation === "package") {
      const cohort = rows(changed["cohorts"])
        .map(mapping)
        .find((row) => row["cohort_id"] === "docs-2026-10-03-stable31");
      assert.ok(cohort);
      const pkg = rows(cohort["packages"])
        .map(mapping)
        .find((row) => row["name"] === "@agent-teams/engineering-foundation");
      assert.ok(pkg);
      pkg["version"] = "1.7.999";
    } else {
      mapping(rows(changed["events"])[0])["effective_at"] = "2026-08-17T00:00:00Z";
    }
    assert.deepEqual(
      parserErrors(changed, definition),
      oldErrors,
      mutation + " keeps the same 39 errors",
    );
    await refusal((f) => {
      f.overrides.set(CENTRAL + ":" + CURRENT + ":" + REGISTRY, encoded(changed));
    }, /immutable complete input blob/u);
  }
});

void test("B304 proof requires the whole pinned historical current and frozen-schema inputs", async () => {
  await refusal((f) => {
    mapping(f.proof["inputs"])["current_policy"] = mapping(f.proof["inputs"])["historical_policy"];
    f.sync();
  }, /input coordinates/u);
  await refusal((f) => {
    mapping(f.proof["parser_errors"])["policy"] = [{ error: "claimed failure" }];
    f.sync();
  }, /reproduced parser/u);
  await refusal((f) => {
    rows(mapping(f.proof["parser_errors"])["registry"]).pop();
    f.sync();
  }, /reproduced parser/u);
  await refusal((f) => {
    f.proof["approved"] = true;
    f.sync();
  }, /closed fields/u);
  await refusal((f) => {
    f.controls.ancestry = false;
  }, /base ancestry/u);
  await refusal((f) => {
    f.overrides.set(
      CENTRAL + ":" + PROOF_REVISION + ":" + B304_RECOVERY_PROOF_PATH,
      encoded({ schema_version: 1 }),
    );
  }, /immutable complete input blob/u);
});

void test("B304 checks include all 62 entries and both canonical and nightly executions", async () => {
  await refusal((f) => {
    rows(f.native["checks"]).pop();
  }, /62-check census/u);
  await refusal((f) => {
    const checks = rows(f.native["checks"]);
    checks[0] = structuredClone(checks[1]);
  }, /unique 62-check census/u);
  for (const id of [139589928841, 139817264933, 140032783052]) {
    await refusal((f) => {
      const check = rows(f.native["checks"])
        .map(mapping)
        .find((row) => row["id"] === id);
      assert.ok(check);
      check["app_id"] = 999;
    }, /canonical and nightly checks/u);
  }
  await refusal((f) => {
    const unrelated = rows(f.native["checks"])
      .map(mapping)
      .find((row) => row["name"] !== "docs-protocol / docs-protocol-check");
    assert.ok(unrelated);
    unrelated["name"] = "new same-head execution";
  }, /native census/u);
});

void test("B304 rejects an independent failure even when the archive and live census agree", async () => {
  const f = fixture();
  const checks = rows(f.native["checks"]).map(mapping);
  const unrelated = checks.find(
    (row) => row["conclusion"] === "success" && !string(row["name"]).includes("docs-protocol"),
  );
  assert.ok(unrelated);
  unrelated["conclusion"] = "failure";
  mapping(f.proof["native"])["checks"] = structuredClone(checks);
  f.sync();
  assert.equal(checks.length, 62);
  assert.equal(checks.filter((row) => row["conclusion"] === "failure").length, 4);
  await assert.rejects(verifyFixture(f), /only actual canonical failed checks/u);

  f.setAuthority(encoded({ schema_version: 1, authorization: null }));
  await assert.rejects(
    verifyB304IncidentArchive(archiveInput(f), f.adapters),
    /only actual canonical failed checks/u,
  );
  await assert.rejects(
    verifyB304RecoveryStaging(stagingInput(f), f.adapters),
    /only actual canonical failed checks/u,
  );
});

void test("B304 refuses pending or replayed runs and an omitted successful nightly", async () => {
  for (const [kind, key, value] of [
    ["current", "run_attempt", 3],
    ["current", "status", "in_progress"],
    ["current", "path", ".github/workflows/ci-nightly.yml"],
    ["current", "conclusion", "success"],
    ["historical", "run_attempt", 2],
    ["historical", "conclusion", "failure"],
    ["nightly", "conclusion", "failure"],
    ["nightly", "event", "push"],
  ] as const) {
    await refusal((f) => {
      mapping(f.native[kind])[key] = value;
    }, /exact .* run/u);
  }
  await refusal((f) => {
    mapping(mapping(f.native["current"])["repository"])["id"] = 1;
  }, /run repository/u);
  await refusal((f) => {
    rows(mapping(f.native["current"])["referenced_workflows"]).pop();
  }, /reusable runner/u);
});

void test("B304 requires four exact failed jobs with no consumer or qualification execution", async () => {
  await refusal((f) => {
    rows(f.native["current_jobs"]).pop();
  }, /four-job census/u);
  await refusal((f) => {
    const jobs = rows(f.native["current_jobs"]);
    jobs.push(structuredClone(jobs[0]));
  }, /four-job census/u);
  await refusal((f) => {
    const structural = rows(f.native["current_jobs"])
      .map(mapping)
      .find((job) => job["id"] === 140032689398);
    assert.ok(structural);
    structural["conclusion"] = "success";
  }, /failed job result/u);
  await refusal((f) => {
    const semantic = rows(f.native["current_jobs"])
      .map(mapping)
      .find((job) => job["id"] === 140032783052);
    assert.ok(semantic);
    const failure = rows(semantic["steps"])
      .map(mapping)
      .find((step) => step["conclusion"] === "failure");
    assert.ok(failure);
    failure["name"] = "Execute consumer semantics";
  }, /upstream guard failure/u);
  await refusal((f) => {
    const job = mapping(rows(f.native["current_jobs"])[0]);
    rows(job["steps"]).push({
      name: "independent failure",
      number: 99,
      status: "completed",
      conclusion: "failure",
    });
  }, /upstream guard failure/u);
  await refusal((f) => {
    mapping(rows(f.native["historical_jobs"])[0])["conclusion"] = "failure";
  }, /historical complete success/u);
});

void test("B304 verifies exact raw logs and independently rendered parser text", async () => {
  await refusal((f) => {
    f.logs.set(140032413292, Buffer.from("invented parser failure"));
  }, /raw log digest/u);
  await refusal((f) => {
    const previous = f.logs.get(140032413292);
    assert.ok(previous);
    const changed = Buffer.from(
      previous
        .toString("utf8")
        .replace("Qualified Docs Cohort registry does not satisfy", "Another error"),
    );
    f.logs.set(140032413292, changed);
    mapping(mapping(f.proof["logs"])["current_authorize"])["digest"] = hash(changed);
    f.sync();
  }, /actual complete parser failure/u);
  await refusal((f) => {
    const previous = f.logs.get(139589261301);
    assert.ok(previous);
    const changed = Buffer.concat([
      previous,
      Buffer.from("\nCONTROLLER_SNAPSHOT_SHA: " + HISTORICAL + "\n"),
    ]);
    f.logs.set(139589261301, changed);
    mapping(mapping(f.proof["logs"])["historical_authorize"])["digest"] = hash(changed);
    f.sync();
  }, /unique native log/u);
});

void test("B304 pins Runtime identity head full row and unchanged historical source preimages", async () => {
  await refusal((f) => {
    f.controls.head = "e".repeat(40);
  }, /live Runtime head/u);
  await refusal((f) => {
    f.entry["desired_cohort_id"] = "docs-2026-11-26-stable33";
  }, /entire unchanged Runtime/u);
  for (const path of [
    ".github/workflows/docs-protocol.yml",
    "architecture/foundation/docs-protocol.yaml",
    "architecture/foundation/docs-protocol-managed-state.json",
  ]) {
    await refusal((f) => {
      f.overrides.set(RUNTIME + ":" + HEAD + ":" + path, Buffer.from("{}\n"));
    }, /source preimage/u);
  }
  await refusal((f) => {
    f.overrides.set(
      RUNTIME + ":" + OBSERVED + ":architecture/foundation/docs-protocol.yaml",
      Buffer.from("different"),
    );
  }, /unchanged historical/u);
});

void test("B304 independent owner decision must remain current exact and administrator-owned", async () => {
  await refusal((f) => {
    f.comment["body"] = "approved";
  }, /decision content/u);
  await refusal((f) => {
    f.comment["issue_url"] = "https://api.github.com/repos/" + CENTRAL + "/issues/1";
  }, /operation PR/u);
  await refusal((f) => {
    mapping(f.comment["user"])["id"] = 7;
  }, /owner identity/u);
  await refusal((f) => {
    f.permission["permission"] = "write";
  }, /current owner authority/u);
  await refusal((f) => {
    mapping(f.permission["user"])["login"] = "another";
  }, /owner permission/u);
});

void test("B304 detects drift inside one read and across the final fleet reread", async () => {
  const inside = fixture();
  const original = inside.adapters.getCheckRuns.bind(inside.adapters);
  let reads = 0;
  inside.adapters.getCheckRuns = async (...args) => {
    reads += 1;
    const result = rows(await original(...args));
    if (reads > 1) {
      result.pop();
    }
    return result;
  };
  await assert.rejects(verifyFixture(inside), /62-check census/u);
  const f = fixture();
  const { capability } = await verifyFixture(f);
  f.controls.now = "2026-11-26T17:59:59Z";
  await assert.rejects(
    verifyB304RegistryIncident(capability, f.entry, HEAD, f.execution, f.adapters),
    /backdated/u,
  );
  f.controls.now = "2026-11-27T18:00:00Z";
  await assert.rejects(
    verifyB304RegistryIncident(capability, f.entry, HEAD, f.execution, f.adapters),
    /validity/u,
  );
  await assert.rejects(() => finishB304AdmissionRecovery(capability, f.execution, f.controls.now));
});

void test("B304 pending results and reconciliation cannot become verified or mask extra rows", async () => {
  const f = fixture();
  const { capability, result } = await verifyFixture(f);
  for (const [key, value] of [
    ["status", "current_verified"],
    ["semantics", "verified"],
    ["qualification", "verified"],
    ["repository_id", 1333298097],
    ["source_head", "e".repeat(40)],
    ["recovery_family", "legacy"],
    ["extra", true],
  ] as const) {
    assert.throws(() => requireB304Pending({ ...result, [key]: value }, f.entry, HEAD));
  }
  await verifyB304RegistryIncident(capability, f.entry, HEAD, f.execution, f.adapters);
  const finalized = await finishB304AdmissionRecovery(capability, f.execution, f.controls.now);
  assert.throws(
    () => reconcileB304Pending({ recovery_pending: [] }, finalized),
    /finalized pending/u,
  );
  assert.throws(
    () => reconcileB304Pending({ recovery_pending: [result, result] }, finalized),
    /finalized pending/u,
  );
  assert.throws(
    () =>
      reconcileB304Pending({ recovery_pending: [{ ...result, incident_id: "other" }] }, finalized),
    /finalized pending/u,
  );
});

void test("B304 final authorization is reread after all outer controller awaits", async () => {
  for (const mutation of ["comment", "permission", "expiry", "source time"]) {
    const f = fixture();
    const { capability } = await verifyFixture(f);
    await verifyB304RegistryIncident(capability, f.entry, HEAD, f.execution, f.adapters);
    // Model mutation while the outer controller/other-family checks await I/O.
    if (mutation === "comment") {
      f.comment["body"] = "revoked";
    } else if (mutation === "permission") {
      f.permission["permission"] = "read";
    } else if (mutation === "expiry") {
      f.controls.now = "2026-11-27T18:00:00Z";
    } else {
      f.controls.now = "2026-11-26T18:00:00Z";
    }
    await assert.rejects(
      finishB304AdmissionRecovery(capability, f.execution, "2026-11-26T18:00:01Z"),
    );
  }
  const f = fixture();
  const { capability } = await verifyFixture(f);
  await verifyB304RegistryIncident(capability, f.entry, HEAD, f.execution, f.adapters);
  const attempts = await Promise.allSettled([
    finishB304AdmissionRecovery(capability, f.execution, f.controls.now),
    finishB304AdmissionRecovery(capability, f.execution, f.controls.now),
  ]);
  assert.deepEqual(
    attempts.map((result) => result.status),
    ["fulfilled", "rejected"],
  );
});
