import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject, Schema } from "ajv/dist/2020.js";
import { parseDocument } from "yaml";

export const B304_RECOVERY_AUTHORITY_PATH = "governance/docs-b304-registry-recovery.json";
export const B304_RECOVERY_PROOF_PATH =
  "governance/evidence/docs-b304-registry-recovery/runtime-20261126.json";
const FAMILY = "b304-registry-incident/v1";
const CENTRAL = "agent-teams-ai/.github";
const CONTROLLER = Object.freeze({ repository: CENTRAL, repository_id: 1316243981 });
const POLICY = "governance/docs-protocol-policy-v2.json";
const REGISTRY = "governance/docs-qualified-cohorts.json";
const EXCEPTIONS = "governance/docs-protocol-exceptions.json";
const HISTORICAL = "755c8515a5d106402a7e9e2cff621fb1fdc855cf";
const SNAPSHOT = "b88a08c8131b8c98650318eb374a5fd2840bed46";
const RUNTIME = "agent-teams-ai/agent-runtime";
const RUNTIME_ID = 1314129620;
const SOURCE_HEAD = "cae4d350c947cd9f74bc04130531527c9a36baeb";
const OBSERVED_HEAD = "b81ef94a35fb1fc70a35ddea6f0c61f567dc653e";
const RUNNER = "b30455e32cf5d54ade6d8301637701347e4ce57c";
const RUN = 45724048832;
const NIGHTLY = 45792972738;
const CONTEXT = "docs-protocol / docs-protocol-check";
const COHORT = "docs-2026-10-03-stable31";
const POLICY_BLOB = "2d60b967eb37185a6f85c84c031950dc73458e34";
const REGISTRY_BLOB = "10a07154e9361bfc148bab9ecb2ca1155325824d";
const SHA = /^(?!0{40}$)[0-9a-f]{40}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAX_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFIER_PATH = "scripts/docs-b304-registry-incident.ts";
const OPERATION = Object.freeze({
  kind: "retire-deleted-canary",
  repository_id: 1336577313,
  before_policy_blob: POLICY_BLOB,
  after_policy_blob: "f0d9b42d2968aabcc3d5148374286cd280ee34eb",
  registry_blob: REGISTRY_BLOB,
  exceptions_blob: "7fb208e80500a9ff3dfc449e03c9700e6e15e82e",
});
const INCIDENT = Object.freeze({
  repository: RUNTIME,
  repository_id: RUNTIME_ID,
  source_head: SOURCE_HEAD,
  runner_revision: RUNNER,
});
const INPUTS = {
  historical_policy: { revision: HISTORICAL, path: POLICY, blob: POLICY_BLOB },
  historical_registry: {
    revision: HISTORICAL,
    path: REGISTRY,
    blob: "5618159309435248c8ab677a70585d989c3fb12d",
  },
  current_policy: { revision: SNAPSHOT, path: POLICY, blob: POLICY_BLOB },
  current_registry: { revision: SNAPSHOT, path: REGISTRY, blob: REGISTRY_BLOB },
  frozen_policy_schema: {
    revision: RUNNER,
    path: POLICY.replace(".json", ".schema.json"),
    blob: "d45b368c2967f6347236b978971c6c0545f60b10",
  },
  frozen_registry_schema: {
    revision: RUNNER,
    path: REGISTRY.replace(".json", ".schema.json"),
    blob: "99ead31926964965e9061d5f3097f1beef1c31e8",
  },
  current_policy_schema: {
    revision: SNAPSHOT,
    path: POLICY.replace(".json", ".schema.json"),
    blob: "b5423e69812a42db5b509a04456fafc1cf04c18f",
  },
  current_registry_schema: {
    revision: SNAPSHOT,
    path: REGISTRY.replace(".json", ".schema.json"),
    blob: "582d2d57eac11f03dc031b11ad48a768a0c05624",
  },
} as const;
const SOURCE_FILES = [
  { path: ".github/workflows/docs-protocol.yml", blob: "7ebfa3fdad403362a46bf0ad0968bf1304a560fa" },
  {
    path: "architecture/foundation/docs-protocol.yaml",
    blob: "0879922d2655fcaa5e85d117c34ebfc0bb0ce99b",
  },
  {
    path: "architecture/foundation/docs-protocol-managed-state.json",
    blob: "599341c45072684dc593353dba0b757de5c69ef5",
  },
] as const;
const FAILED_JOBS = [
  [
    140032413292,
    "trusted-authorize",
    "Authorize exact consumer snapshot without executing consumer code",
    7,
  ],
  [140032688518, "trusted-qualification", "Require successful trusted structural authorization", 2],
  [140032689398, "trusted-structural", null, null],
  [140032783052, "docs-protocol-check", "Require successful trusted qualification", 2],
] as const;
const SUCCESSFUL_JOBS = [
  [139589261301, "trusted-authorize"],
  [139589494629, "trusted-structural"],
  [139589710079, "trusted-qualification"],
  [139589928841, "docs-protocol-check"],
] as const;
const LOGS = {
  historical_authorize: 139589261301,
  current_authorize: 140032413292,
  current_qualification: 140032688518,
  current_semantic: 140032783052,
} as const;

type Mapping = Record<string, unknown>;
// The existing owner adapter requires a single regular 100644 Git entry,
// returns its exact blob bytes, and never follows a symlink or Contents alias.
type ReadBaseFile = (path: string, revision: string) => Promise<Buffer | null>;
export interface B304IncidentAdapters {
  currentTime(): string | Promise<string>;
  getRepository(repository: string): Promise<unknown>;
  getDefaultBranchHead(repository: string, branch: string): Promise<string>;
  isCommitAncestor(repository: string, ancestor: string, descendant: string): Promise<boolean>;
  getCheckRuns(repository: string, head: string): Promise<unknown>;
  getWorkflowRun(repository: string, id: number): Promise<unknown>;
  getWorkflowRunAttempt(repository: string, id: number, attempt: number): Promise<unknown>;
  getWorkflowJobs(repository: string, id: number, attempt: number): Promise<unknown>;
  getJobLog(repository: string, id: number): Promise<Buffer>;
  readGitFile(repository: string, path: string, revision: string): Promise<Buffer | null>;
  getDecisionComment(repository: string, id: number): Promise<unknown>;
  getCollaboratorPermission(repository: string, login: string): Promise<unknown>;
}
export interface B304PrepareInput {
  execution: unknown;
  readBaseFile: ReadBaseFile;
  asOf: string;
  basePolicyBytes: Buffer;
  proposedPolicyBytes: Buffer;
  registryBytes: Buffer;
  exceptionsBytes: Buffer;
}
interface B304BaseInput {
  controllerBase: string;
  readBaseFile: ReadBaseFile;
  asOf: string;
  basePolicyBytes: Buffer;
  registryBytes: Buffer;
  exceptionsBytes: Buffer;
}
export interface B304ArchiveInput extends B304BaseInput {
  proofBytes: Buffer;
  afterEvidence(): Promise<void>;
}
export interface B304StagingInput extends B304BaseInput {
  recordBytes: Buffer;
  operation: { pull_number: number; pull_id: number; head_ref: string };
  proposedPolicyBytes: Buffer;
  afterEvidence(): Promise<void>;
}
export interface B304InertVerification {
  classification: "inert-b304-registry-incident";
  proof_blob: string;
  source_head: typeof SOURCE_HEAD;
  semantics: "unverified";
  qualification: "unverified";
  capability_created: false;
}
export interface B304StagingVerification extends B304InertVerification {
  authorization_id: string;
}
export interface B304Capability {
  readonly id: string;
  readonly recovery_family: typeof FAMILY;
}
export interface B304Pending {
  status: "recovery_pending";
  repository_id: typeof RUNTIME_ID;
  source_head: typeof SOURCE_HEAD;
  semantics: "unverified";
  qualification: "unverified";
  incident_id: string;
  recovery_family: typeof FAMILY;
}
export interface B304Finalized {
  readonly authorization_id: string;
  readonly recovery_family: typeof FAMILY;
  readonly execution: unknown;
  readonly recovery_pending: readonly B304Pending[];
}
interface ProofContext {
  controllerBase: string;
  readBaseFile: ReadBaseFile;
  basePolicyBytes: Buffer;
  registryBytes: Buffer;
  sourceEntry: Mapping;
}
interface State extends ProofContext {
  record: Mapping;
  execution: Mapping;
  authorityBytes: Buffer;
  input: B304PrepareInput;
  createdAt: number;
  lastTime: number;
  verified: number;
  fingerprint: unknown;
  validityAdapters: B304IncidentAdapters | null;
  finalizing: boolean;
  finalized: boolean;
}
const capabilities = new WeakMap<B304Capability, State>();
const finalizedReports = new WeakMap<B304Finalized, B304Pending>();

function need(condition: unknown, message: string): asserts condition {
  assert.ok(condition, "B304 registry incident: " + message);
}
function object(value: unknown): Mapping {
  need(value !== null && typeof value === "object" && !Array.isArray(value), "expected mapping");
  return Object.fromEntries(Object.entries(value));
}
function list(value: unknown): unknown[] {
  need(Array.isArray(value), "expected complete list");
  return value;
}
function text(value: unknown): string {
  need(typeof value === "string", "expected string");
  return value;
}
function positive(value: unknown): number {
  need(
    typeof value === "number" && Number.isSafeInteger(value) && value > 0,
    "invalid positive ID",
  );
  return value;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  need(isDeepStrictEqual(actual, expected), label + " differs");
}
function closed(value: unknown, keys: string): Mapping {
  const result = object(value);
  equal(Object.keys(result).toSorted(), keys.split(" ").toSorted(), "closed fields");
  return result;
}
function parse(bytes: Buffer): unknown {
  need(bytes.length <= 1024 * 1024, "bounded JSON size exceeded");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}
function parseClosedJson(bytes: Buffer): unknown {
  const result = parse(bytes);
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const document = parseDocument(source, { uniqueKeys: true });
  need(document.errors.length === 0, "duplicate keys in closed JSON boundary");
  return result;
}
function blob(bytes: Buffer): string {
  return createHash("sha1")
    .update("blob " + bytes.length + "\0")
    .update(bytes)
    .digest("hex");
}
function digest(bytes: Buffer): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}
function time(value: unknown): number {
  const source = text(value);
  need(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(source), "noncanonical UTC time");
  const result = Date.parse(source);
  need(
    Number.isFinite(result) && new Date(result).toISOString() === source.replace("Z", ".000Z"),
    "invalid time",
  );
  return result;
}
function execution(value: unknown): Mapping {
  const result = closed(
    value,
    "controller pull_number pull_id head_ref run_id run_attempt base head execution_base changed_files",
  );
  equal(result["controller"], CONTROLLER, "controller identity");
  for (const key of ["pull_number", "pull_id", "run_id", "run_attempt"]) {
    positive(result[key]);
  }
  need(text(result["head_ref"]).length > 0, "empty head ref");
  need(
    SHA.test(text(result["base"])) &&
      SHA.test(text(result["head"])) &&
      result["base"] !== result["head"] &&
      result["execution_base"] === result["base"],
    "stale execution",
  );
  equal(result["changed_files"], [POLICY], "complete operation diff");
  return result;
}
function validateRecord(value: unknown, envelope: Mapping, asOf: number): Mapping {
  const record = closed(
    value,
    "id state valid_from expires_at controller pull_number pull_id head_ref operation incident proof verifier_source owner_decision",
  );
  need(/^[a-z0-9][a-z0-9-]{0,79}$/u.test(text(record["id"])), "invalid authorization ID");
  need(record["state"] === "active", "revoked, retired or inactive authorization");
  const start = time(record["valid_from"]);
  const end = time(record["expires_at"]);
  need(
    end > start && end - start <= MAX_VALIDITY_MS && asOf >= start && asOf < end,
    "invalid seven-day validity",
  );
  equal(record["controller"], CONTROLLER, "record controller");
  positive(record["pull_number"]);
  positive(record["pull_id"]);
  need(text(record["head_ref"]).length > 0, "record head ref");
  for (const key of ["pull_number", "pull_id", "head_ref"]) {
    equal(record[key], envelope[key], "record " + key);
  }
  equal(record["operation"], OPERATION, "sole permitted retirement");
  equal(record["incident"], INCIDENT, "sole covered Runtime incident");
  const proof = closed(record["proof"], "revision path blob");
  need(
    SHA.test(text(proof["revision"])) &&
      SHA.test(text(proof["blob"])) &&
      proof["path"] === B304_RECOVERY_PROOF_PATH,
    "immutable proof coordinate",
  );
  const verifier = closed(record["verifier_source"], "revision path blob");
  need(
    SHA.test(text(verifier["revision"])) &&
      SHA.test(text(verifier["blob"])) &&
      verifier["path"] === VERIFIER_PATH,
    "prior installed verifier coordinate",
  );
  const owner = closed(record["owner_decision"], "comment_id actor_id actor_login body_digest");
  positive(owner["comment_id"]);
  positive(owner["actor_id"]);
  need(
    /^[A-Za-z0-9-]+$/u.test(text(owner["actor_login"])) && DIGEST.test(text(owner["body_digest"])),
    "independent owner coordinates",
  );
  return record;
}
function sourceEntry(bytes: Buffer): Mapping {
  const rows = list(object(parse(bytes))["repositories"]).map(object);
  const selected = rows.filter((row) => row["repository_id"] === RUNTIME_ID);
  need(selected.length === 1 && selected[0] !== undefined, "unique unchanged Runtime row");
  return selected[0];
}
async function proofContext(input: B304BaseInput): Promise<ProofContext> {
  need(SHA.test(input.controllerBase), "immutable controller base");
  time(input.asOf);
  for (const [path, bytes, expectedBlob] of [
    [POLICY, input.basePolicyBytes, OPERATION.before_policy_blob],
    [REGISTRY, input.registryBytes, OPERATION.registry_blob],
    [EXCEPTIONS, input.exceptionsBytes, OPERATION.exceptions_blob],
  ] as const) {
    equal(await input.readBaseFile(path, input.controllerBase), bytes, "base-owned " + path);
    equal(blob(bytes), expectedBlob, "exact complete " + path);
  }
  return {
    controllerBase: input.controllerBase,
    readBaseFile: input.readBaseFile,
    basePolicyBytes: Buffer.from(input.basePolicyBytes),
    registryBytes: Buffer.from(input.registryBytes),
    sourceEntry: sourceEntry(input.basePolicyBytes),
  };
}

// The base-owned record binds semantic inputs and a real PR, never its own
// installation commit or a predicted future operation head/run.
export async function prepareB304AdmissionRecovery(
  input: B304PrepareInput,
): Promise<B304Capability | undefined> {
  const envelope = execution(input.execution);
  const authorityBytes = await input.readBaseFile(
    B304_RECOVERY_AUTHORITY_PATH,
    text(envelope["base"]),
  );
  if (authorityBytes === null) {
    return undefined;
  }
  const authority = closed(parseClosedJson(authorityBytes), "schema_version authorization");
  need(authority["schema_version"] === 1, "unsupported authority version");
  if (authority["authorization"] === null) {
    return undefined;
  }
  const now = time(input.asOf);
  const record = validateRecord(authority["authorization"], envelope, now);
  const context = await proofContext({ ...input, controllerBase: text(envelope["base"]) });
  equal(blob(input.proposedPolicyBytes), OPERATION.after_policy_blob, "exact retirement postimage");
  const capability = Object.freeze({ id: text(record["id"]), recovery_family: FAMILY });
  capabilities.set(capability, {
    ...context,
    record: structuredClone(record),
    execution: structuredClone(envelope),
    authorityBytes: Buffer.from(authorityBytes),
    input: {
      ...input,
      execution: structuredClone(envelope),
      basePolicyBytes: Buffer.from(input.basePolicyBytes),
      proposedPolicyBytes: Buffer.from(input.proposedPolicyBytes),
      registryBytes: Buffer.from(input.registryBytes),
      exceptionsBytes: Buffer.from(input.exceptionsBytes),
    },
    createdAt: now,
    lastTime: now,
    verified: 0,
    fingerprint: null,
    validityAdapters: null,
    finalizing: false,
    finalized: false,
  });
  return capability;
}
function stateFor(capability: B304Capability | undefined, suppliedExecution: unknown): State {
  const state = capability === undefined ? undefined : capabilities.get(capability);
  need(
    state !== undefined && !state.finalized && !state.finalizing,
    "absent, serialized or finalized capability",
  );
  equal(execution(suppliedExecution), state.execution, "full fresh execution");
  return state;
}
function decisionText(record: Mapping): string {
  const proof = object(record["proof"]);
  const verifier = object(record["verifier_source"]);
  return (
    "Authorize bounded B304 registry incident " +
    text(record["id"]) +
    "\n" +
    "Controller: " +
    CENTRAL +
    " (1316243981)\n" +
    "PR: " +
    positive(record["pull_number"]) +
    " (" +
    positive(record["pull_id"]) +
    ")\n" +
    "Head ref: " +
    text(record["head_ref"]) +
    "\n" +
    "Operation: retire-deleted-canary (1336577313)\n" +
    "Policy: " +
    OPERATION.before_policy_blob +
    " -> " +
    OPERATION.after_policy_blob +
    "\n" +
    "Registry: " +
    OPERATION.registry_blob +
    "\nExceptions: " +
    OPERATION.exceptions_blob +
    "\n" +
    "Runtime: " +
    RUNTIME +
    " (1314129620) @ " +
    SOURCE_HEAD +
    "\n" +
    "Proof: " +
    text(proof["revision"]) +
    ":" +
    text(proof["path"]) +
    "@" +
    text(proof["blob"]) +
    "\n" +
    "Installed verifier: " +
    text(verifier["revision"]) +
    ":" +
    text(verifier["path"]) +
    "@" +
    text(verifier["blob"]) +
    "\n" +
    "Valid from: " +
    text(record["valid_from"]) +
    "\n" +
    "Expires: " +
    text(record["expires_at"]) +
    "\n" +
    "Result: recovery_pending; semantics and qualification remain unverified.\n"
  );
}
export function b304RecoveryDecisionText(record: unknown): string {
  return decisionText(object(record));
}
async function readCoordinate(
  coordinate: Mapping,
  context: ProofContext,
  adapters: B304IncidentAdapters,
): Promise<Buffer> {
  const revision = text(coordinate["revision"]);
  need(
    await adapters.isCommitAncestor(CENTRAL, revision, context.controllerBase),
    "input outside base ancestry",
  );
  const bytes = await context.readBaseFile(text(coordinate["path"]), revision);
  need(
    Buffer.isBuffer(bytes) && blob(bytes) === coordinate["blob"],
    "immutable complete input blob",
  );
  return bytes;
}
function schema(value: unknown): Schema {
  if (typeof value === "boolean") {
    return value;
  }
  const result = object(value);
  need(!("$async" in result) || result["$async"] === false, "asynchronous schema");
  return result;
}
function schemaErrors(value: unknown, definition: unknown): ErrorObject[] {
  const validator = new Ajv2020({ allErrors: true, strict: true }).compile(schema(definition));
  validator(value);
  return structuredClone(validator.errors ?? []);
}
function unchangedPrefix(historical: unknown, current: unknown): void {
  const old = object(historical);
  const next = object(current);
  const oldRecords = list(old["cohorts"]),
    records = list(next["cohorts"]);
  const oldEvents = list(old["events"]),
    events = list(next["events"]);
  const { cohorts: _oc, events: _oe, ...oldMetadata } = old;
  const { cohorts: _nc, events: _ne, ...metadata } = next;
  equal(metadata, oldMetadata, "registry metadata");
  equal(
    [oldRecords.length, records.length, events.length - oldEvents.length],
    [44, 45, 3],
    "bounded append census",
  );
  equal(records.slice(0, oldRecords.length), oldRecords, "whole historical cohort prefix");
  equal(events.slice(0, oldEvents.length), oldEvents, "whole historical event prefix");
  const addition = object(records[44]);
  need(
    addition["cohort_id"] === "docs-2026-11-26-stable33" && addition["cohort_generation"] === 3,
    "only Gen3 append",
  );
  equal(
    events.slice(oldEvents.length).map((event) => {
      const item = object(event);
      equal(item["cohort_id"], addition["cohort_id"], "new event cohort");
      return item["state"];
    }),
    ["PUBLISHED_UNQUALIFIED", "VERIFIED", "QUALIFIED"],
    "new lifecycle prefix",
  );
}
async function verifyInputs(
  proof: Mapping,
  context: ProofContext,
  adapters: B304IncidentAdapters,
): Promise<string> {
  equal(proof["inputs"], INPUTS, "fixed full input coordinates");
  const data = new Map<string, Buffer>();
  for (const [name, coordinate] of Object.entries(INPUTS)) {
    data.set(name, await readCoordinate(coordinate, context, adapters));
  }
  const get = (name: string): Buffer => {
    const result = data.get(name);
    need(result !== undefined, "missing parser input");
    return result;
  };
  equal(get("historical_policy"), get("current_policy"), "unchanged complete policy");
  equal(get("current_policy"), context.basePolicyBytes, "live base policy");
  equal(get("current_registry"), context.registryBytes, "live complete registry");
  const oldRegistry = parse(get("historical_registry"));
  const registry = parse(get("current_registry"));
  unchangedPrefix(oldRegistry, registry);
  for (const [input, definition] of [
    ["historical_policy", "frozen_policy_schema"],
    ["historical_registry", "frozen_registry_schema"],
    ["current_policy", "frozen_policy_schema"],
    ["current_policy", "current_policy_schema"],
    ["current_registry", "current_registry_schema"],
  ] as const) {
    equal(
      schemaErrors(parse(get(input)), parse(get(definition))),
      [],
      input + " parser acceptance",
    );
  }
  const errors = schemaErrors(registry, parse(get("frozen_registry_schema")));
  need(
    errors.length === 39 &&
      errors.every((error) => /^\/cohorts\/44(?:\/|$)/u.test(error.instancePath)),
    "only appended Gen3 schema rejection",
  );
  equal(
    proof["parser_errors"],
    { policy: [], registry: errors },
    "independently reproduced parser errors",
  );
  return (
    "Qualified Docs Cohort registry does not satisfy its JSON Schema: " +
    errors.map((error) => (error.instancePath || "/") + " " + error.message).join("; ")
  );
}
function select(value: unknown, keys: string): Mapping {
  const mapping = object(value);
  return Object.fromEntries(keys.split(" ").map((key) => [key, mapping[key]]));
}
function checkCensus(value: unknown): Mapping[] {
  const checks = list(value)
    .map((item): Mapping => {
      const check = object(item);
      const result = select(check, "id head_sha name html_url status conclusion");
      positive(result["id"]);
      equal(result["head_sha"], SOURCE_HEAD, "census source head");
      need(
        result["status"] === "completed" &&
          ["success", "failure", "skipped"].includes(text(result["conclusion"])),
        "incomplete check census",
      );
      text(result["name"]);
      text(result["html_url"]);
      return { ...result, app_id: positive(object(check["app"])["id"]) };
    })
    .toSorted((a, b) => positive(a["id"]) - positive(b["id"]));
  need(
    checks.length === 62 && new Set(checks.map((row) => row["id"])).size === 62,
    "complete unique 62-check census",
  );
  const docs = checks.filter((row) => row["name"] === CONTEXT && row["app_id"] === 15368);
  equal(
    docs.map((row) => [row["id"], row["conclusion"], row["html_url"]]),
    [
      [139589928841, "success", jobUrl(RUN, 139589928841)],
      [139817264933, "success", jobUrl(NIGHTLY, 139817264933)],
      [140032783052, "failure", jobUrl(RUN, 140032783052)],
    ],
    "complete canonical and nightly checks",
  );
  equal(
    checks
      .filter((row) => row["conclusion"] === "failure")
      .map((row) => [row["id"], row["name"], row["html_url"], row["app_id"]]),
    FAILED_JOBS.filter((row) => row[2] !== null).map(([id, role]) => [
      id,
      "docs-protocol / " + role,
      jobUrl(RUN, id),
      15368,
    ]),
    "only actual canonical failed checks",
  );
  return checks;
}
function jobUrl(run: number, job: number): string {
  return "https://github.com/" + RUNTIME + "/actions/runs/" + run + "/job/" + job;
}
function runProjection(value: unknown, kind: "historical" | "current" | "nightly"): Mapping {
  const run = object(value);
  const nightly = kind === "nightly";
  const result = select(
    run,
    "id workflow_id run_attempt head_sha head_branch event path status conclusion created_at updated_at run_started_at",
  );
  equal(
    select(result, "id workflow_id run_attempt head_sha head_branch event path status conclusion"),
    {
      id: nightly ? NIGHTLY : RUN,
      workflow_id: nightly ? 375281830 : 335216823,
      run_attempt: kind === "current" ? 2 : 1,
      head_sha: SOURCE_HEAD,
      head_branch: "main",
      event: nightly ? "schedule" : "push",
      path: nightly ? ".github/workflows/ci-nightly.yml" : ".github/workflows/docs-protocol.yml",
      status: "completed",
      conclusion: kind === "current" ? "failure" : "success",
    },
    "exact " + kind + " run",
  );
  for (const key of ["created_at", "updated_at", "run_started_at"]) {
    time(result[key]);
  }
  equal(
    select(run["repository"], "id full_name"),
    { id: RUNTIME_ID, full_name: RUNTIME },
    "run repository",
  );
  const references = list(run["referenced_workflows"]).map((item) => {
    const ref = object(item);
    need(SHA.test(text(ref["sha"])), "referenced SHA");
    text(ref["path"]);
    if (ref["ref"] !== undefined) {
      text(ref["ref"]);
    }
    return ref["ref"] === undefined ? select(ref, "path sha") : select(ref, "path sha ref");
  });
  const expectedRunner = {
    path: CENTRAL + "/.github/workflows/docs-protocol-check.yml@" + RUNNER,
    sha: RUNNER,
  };
  equal(
    references.filter((ref) => ref["sha"] === RUNNER),
    [expectedRunner],
    "exact frozen reusable runner",
  );
  need(nightly || references.length === 1, "unexpected canonical workflow reference");
  return {
    ...result,
    repository: { id: RUNTIME_ID, full_name: RUNTIME },
    referenced_workflows: references,
  };
}
function jobsProjection(value: unknown, historical: boolean): Mapping[] {
  const jobs = list(value)
    .map((item): Mapping => {
      const job = select(
        item,
        "id run_id run_attempt head_sha name html_url status conclusion steps",
      );
      const id = positive(job["id"]);
      equal(
        select(job, "run_id run_attempt head_sha status"),
        {
          run_id: RUN,
          run_attempt: historical ? 1 : 2,
          head_sha: SOURCE_HEAD,
          status: "completed",
        },
        "job execution",
      );
      equal(job["html_url"], jobUrl(RUN, id), "job URL");
      const steps = list(job["steps"]).map((step) => {
        const result = select(step, "name number status conclusion");
        text(result["name"]);
        positive(result["number"]);
        need(
          result["status"] === "completed" &&
            ["success", "failure", "skipped"].includes(text(result["conclusion"])),
          "unfinished job step",
        );
        return result;
      });
      need(
        new Set(steps.map((step) => step["number"])).size === steps.length,
        "duplicate step numbers",
      );
      if (historical) {
        const expected = SUCCESSFUL_JOBS.find((row) => row[0] === id);
        need(expected !== undefined, "unexpected historical job");
        equal(job["name"], "docs-protocol / " + expected[1], "historical job role");
        need(
          job["conclusion"] === "success" &&
            steps.length > 0 &&
            steps.every((step) => step["conclusion"] !== "failure"),
          "historical complete success",
        );
      } else {
        const expected = FAILED_JOBS.find((row) => row[0] === id);
        need(expected !== undefined, "unexpected failed-attempt job");
        equal(job["name"], "docs-protocol / " + expected[1], "failed job role");
        equal(job["conclusion"], expected[2] === null ? "skipped" : "failure", "failed job result");
        if (expected[2] === null) {
          equal(steps, [], "unexecuted structural job");
        } else {
          equal(
            steps.filter((step) => step["conclusion"] === "failure"),
            [
              {
                name: expected[2],
                number: expected[3],
                status: "completed",
                conclusion: "failure",
              },
            ],
            "sole upstream guard failure",
          );
        }
      }
      return { ...job, steps };
    })
    .toSorted((a, b) => positive(a["id"]) - positive(b["id"]));
  equal(
    jobs.map((job) => job["id"]),
    (historical ? SUCCESSFUL_JOBS : FAILED_JOBS).map((row) => row[0]).toSorted((a, b) => a - b),
    "complete four-job census",
  );
  return jobs;
}
function logSnapshot(bytes: Buffer, snapshot: string): string {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  for (const [name, expected] of [
    ["CONTROLLER_SNAPSHOT_SHA", snapshot],
    ["JOB_WORKFLOW_SHA", RUNNER],
    ["GITHUB_SHA", SOURCE_HEAD],
  ]) {
    const matches = [
      ...source.matchAll(
        new RegExp("(?:^|\\n)(?:[0-9T:.Z-]+ )? *" + name + ": ([^\\r\\n]+)", "gu"),
      ),
    ];
    equal(
      matches.map((match) => match[1]),
      [expected],
      "unique native log " + name,
    );
  }
  return source;
}
async function verifyLogs(
  proof: Mapping,
  errorText: string,
  adapters: B304IncidentAdapters,
): Promise<void> {
  const expected = closed(proof["logs"], Object.keys(LOGS).join(" "));
  const logs = new Map<string, Buffer>();
  for (const [kind, id] of Object.entries(LOGS)) {
    const log = await adapters.getJobLog(RUNTIME, id);
    need(Buffer.isBuffer(log), "raw native log required");
    const binding = closed(expected[kind], "job_id digest");
    equal(binding["job_id"], id, "log job");
    need(
      DIGEST.test(text(binding["digest"])) && digest(log) === binding["digest"],
      "raw log digest",
    );
    logs.set(kind, log);
  }
  const historical = logs.get("historical_authorize"),
    current = logs.get("current_authorize");
  need(historical !== undefined && current !== undefined, "missing native parser log");
  logSnapshot(historical, HISTORICAL);
  const currentText = logSnapshot(current, SNAPSHOT);
  need(currentText.split(errorText).length === 2, "unique actual complete parser failure");
}
async function verifySource(
  context: ProofContext,
  adapters: B304IncidentAdapters,
): Promise<Mapping> {
  const repository = object(await adapters.getRepository(RUNTIME));
  equal(
    select(repository, "id full_name default_branch archived disabled"),
    {
      id: RUNTIME_ID,
      full_name: RUNTIME,
      default_branch: "main",
      archived: false,
      disabled: false,
    },
    "live Runtime identity",
  );
  equal(await adapters.getDefaultBranchHead(RUNTIME, "main"), SOURCE_HEAD, "live Runtime head");
  need(
    await adapters.isCommitAncestor(RUNTIME, OBSERVED_HEAD, SOURCE_HEAD),
    "historical source ancestry",
  );
  for (const coordinate of SOURCE_FILES) {
    const current = await adapters.readGitFile(RUNTIME, coordinate.path, SOURCE_HEAD);
    const old = await adapters.readGitFile(RUNTIME, coordinate.path, OBSERVED_HEAD);
    need(Buffer.isBuffer(current) && blob(current) === coordinate.blob, "exact source preimage");
    equal(old, current, "unchanged historical caller/profile/projection");
  }
  equal(context.sourceEntry["observed_cohort_id"], COHORT, "observed source cohort");
  equal(
    object(context.sourceEntry["observed_default_branch_evidence"])["revision"],
    OBSERVED_HEAD,
    "observed source revision",
  );
  return select(repository, "id full_name default_branch archived disabled");
}
async function ownerDecision(record: Mapping, adapters: B304IncidentAdapters): Promise<Mapping> {
  const expected = object(record["owner_decision"]);
  const comment = object(
    await adapters.getDecisionComment(CENTRAL, positive(expected["comment_id"])),
  );
  const body = decisionText(record);
  equal(
    select(comment, "id body issue_url"),
    {
      id: expected["comment_id"],
      body,
      issue_url:
        "https://api.github.com/repos/" + CENTRAL + "/issues/" + positive(record["pull_number"]),
    },
    "owner decision content and operation PR",
  );
  equal(
    select(comment["user"], "id login type"),
    {
      id: expected["actor_id"],
      login: expected["actor_login"],
      type: "User",
    },
    "independent owner identity",
  );
  equal(digest(Buffer.from(body)), expected["body_digest"], "owner decision digest");
  const permission = object(
    await adapters.getCollaboratorPermission(CENTRAL, text(expected["actor_login"])),
  );
  equal(permission["permission"], "admin", "current owner authority");
  equal(
    select(permission["user"], "id login"),
    { id: expected["actor_id"], login: expected["actor_login"] },
    "owner permission identity",
  );
  return { comment, permission };
}
async function nativeSnapshot(adapters: B304IncidentAdapters): Promise<Mapping> {
  return {
    checks: checkCensus(await adapters.getCheckRuns(RUNTIME, SOURCE_HEAD)),
    historical: runProjection(await adapters.getWorkflowRunAttempt(RUNTIME, RUN, 1), "historical"),
    current: runProjection(await adapters.getWorkflowRun(RUNTIME, RUN), "current"),
    nightly: runProjection(await adapters.getWorkflowRun(RUNTIME, NIGHTLY), "nightly"),
    historical_jobs: jobsProjection(await adapters.getWorkflowJobs(RUNTIME, RUN, 1), true),
    current_jobs: jobsProjection(await adapters.getWorkflowJobs(RUNTIME, RUN, 2), false),
  };
}
async function verifyProof(
  proofBytes: Buffer,
  context: ProofContext,
  adapters: B304IncidentAdapters,
): Promise<Mapping> {
  const proof = closed(
    parseClosedJson(proofBytes),
    "schema_version classification incident inputs source_files parser_errors native logs",
  );
  equal(
    select(proof, "schema_version classification incident"),
    {
      schema_version: 1,
      classification: "inert-b304-registry-incident",
      incident: INCIDENT,
    },
    "inert incident proof",
  );
  equal(proof["source_files"], SOURCE_FILES, "immutable consumer preimages");
  const errorText = await verifyInputs(proof, context, adapters);
  const source = await verifySource(context, adapters);
  const native = await nativeSnapshot(adapters);
  equal(native, proof["native"], "entire independently read native census");
  await verifyLogs(proof, errorText, adapters);
  equal(await nativeSnapshot(adapters), native, "stable complete native evidence");
  equal(await verifySource(context, adapters), source, "stable source");
  return { source, native, proofBlob: blob(proofBytes) };
}
async function installedVerifier(
  record: Mapping,
  context: ProofContext,
  readBaseFile: ReadBaseFile,
  adapters: B304IncidentAdapters,
): Promise<void> {
  const coordinate = object(record["verifier_source"]);
  const bytes = await readCoordinate(coordinate, context, adapters);
  equal(
    await readBaseFile(VERIFIER_PATH, context.controllerBase),
    bytes,
    "actual installed verifier",
  );
}
function inertVerification(proofBytes: Buffer): B304InertVerification {
  return {
    classification: "inert-b304-registry-incident",
    proof_blob: blob(proofBytes),
    source_head: SOURCE_HEAD,
    semantics: "unverified",
    qualification: "unverified",
    capability_created: false,
  };
}

// Archive and installation verification share the same live proof kernel.
// Neither path enters the operation capability WeakMap.
export async function verifyB304IncidentArchive(
  input: B304ArchiveInput,
  adapters: B304IncidentAdapters,
): Promise<B304InertVerification> {
  const proofBytes = Buffer.from(input.proofBytes);
  const context = await proofContext(input);
  const start = time(await adapters.currentTime());
  need(start >= time(input.asOf), "backdated archive verification");
  await verifyProof(proofBytes, context, adapters);
  await input.afterEvidence();
  need(time(await adapters.currentTime()) >= start, "backdated archive completion");
  return inertVerification(proofBytes);
}
export async function verifyB304RecoveryStaging(
  input: B304StagingInput,
  adapters: B304IncidentAdapters,
): Promise<B304StagingVerification> {
  const context = await proofContext(input);
  const baseBytes = await input.readBaseFile(B304_RECOVERY_AUTHORITY_PATH, input.controllerBase);
  need(Buffer.isBuffer(baseBytes), "staging requires installed inert authority");
  equal(
    parseClosedJson(baseBytes),
    { schema_version: 1, authorization: null },
    "only null-to-active staging",
  );
  const proposed = closed(parseClosedJson(input.recordBytes), "schema_version authorization");
  need(proposed["schema_version"] === 1, "unsupported staged version");
  const operation = closed(input.operation, "pull_number pull_id head_ref");
  const start = time(await adapters.currentTime());
  need(start >= time(input.asOf), "backdated staged verification");
  const record = validateRecord(proposed["authorization"], operation, start);
  equal(blob(input.proposedPolicyBytes), OPERATION.after_policy_blob, "real operation postimage");
  await installedVerifier(record, context, input.readBaseFile, adapters);
  const owner = await ownerDecision(record, adapters);
  const proofBytes = await readCoordinate(object(record["proof"]), context, adapters);
  await verifyProof(proofBytes, context, adapters);
  await installedVerifier(record, context, input.readBaseFile, adapters);
  equal(
    await input.readBaseFile(B304_RECOVERY_AUTHORITY_PATH, input.controllerBase),
    baseBytes,
    "stable inert base",
  );
  await input.afterEvidence();
  equal(await ownerDecision(record, adapters), owner, "stable staged owner decision");
  const end = time(await adapters.currentTime());
  need(end >= start, "backdated staged completion");
  validateRecord(record, operation, end);
  return { ...inertVerification(proofBytes), authorization_id: text(record["id"]) };
}

// Dispatch only; this predicate confers no authorization and leaves every older
// Runtime/legacy incident with its original verifier and refusal semantics.
export function isB304RegistryIncidentSource(entry: unknown, head: string): boolean {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return false;
  }
  const source = object(entry);
  return (
    source["repository_id"] === RUNTIME_ID &&
    source["repository"] === RUNTIME &&
    head === SOURCE_HEAD &&
    source["reusable_workflow_revision"] === RUNNER &&
    source["observed_cohort_id"] === COHORT &&
    source["observed_cohort_generation"] === 2
  );
}
function pending(id: string): B304Pending {
  return {
    status: "recovery_pending",
    repository_id: RUNTIME_ID,
    source_head: SOURCE_HEAD,
    semantics: "unverified",
    qualification: "unverified",
    incident_id: id,
    recovery_family: FAMILY,
  };
}
export function requireB304Pending(result: unknown, entry: unknown, head: string): B304Pending {
  const mapping = object(result);
  need(
    object(entry)["repository_id"] === RUNTIME_ID &&
      object(entry)["repository"] === RUNTIME &&
      head === SOURCE_HEAD,
    "pending source identity",
  );
  const id = text(mapping["incident_id"]);
  need(/^[a-z0-9][a-z0-9-]{0,79}$/u.test(id), "pending authorization ID");
  const expected = pending(id);
  equal(mapping, expected, "pending-only result");
  return expected;
}
export async function verifyB304RegistryIncident(
  capability: B304Capability | undefined,
  entry: unknown,
  head: string,
  suppliedExecution: unknown,
  adapters: B304IncidentAdapters,
): Promise<B304Pending> {
  const state = stateFor(capability, suppliedExecution);
  equal(entry, state.sourceEntry, "entire unchanged Runtime policy row");
  equal(head, SOURCE_HEAD, "covered source head");
  const now = time(await adapters.currentTime());
  need(now >= state.lastTime, "backdated evaluation");
  validateRecord(state.record, state.execution, now);
  equal(
    await state.input.readBaseFile(B304_RECOVERY_AUTHORITY_PATH, text(state.execution["base"])),
    state.authorityBytes,
    "stable base authority",
  );
  await installedVerifier(state.record, state, state.input.readBaseFile, adapters);
  const owner = await ownerDecision(state.record, adapters);
  const proofBytes = await readCoordinate(object(state.record["proof"]), state, adapters);
  const proof = await verifyProof(proofBytes, state, adapters);
  equal(
    await ownerDecision(state.record, adapters),
    owner,
    "stable independently accepted decision",
  );
  await installedVerifier(state.record, state, state.input.readBaseFile, adapters);
  const end = time(await adapters.currentTime());
  need(end >= now, "backdated completion");
  validateRecord(state.record, state.execution, end);
  const fingerprint = { proof, owner };
  need(!state.finalized && !state.finalizing, "capability finalized during incident read");
  if (state.verified > 0) {
    equal(fingerprint, state.fingerprint, "final fleet reread");
  }
  state.fingerprint = fingerprint;
  state.validityAdapters = adapters;
  state.verified += 1;
  state.lastTime = end;
  return pending(text(state.record["id"]));
}
export async function finishB304AdmissionRecovery(
  capability: B304Capability,
  suppliedExecution: unknown,
  asOf: string,
): Promise<B304Finalized> {
  const state = stateFor(capability, suppliedExecution);
  const now = time(asOf);
  need(
    state.verified >= 2 && now >= state.lastTime && now >= state.createdAt,
    "missing final verified fleet reread",
  );
  validateRecord(state.record, state.execution, now);
  const adapters = state.validityAdapters;
  need(adapters !== null, "missing verified final authorization adapters");
  // A failed final authorization consumes this process-local attempt too.
  // A caller must prepare and verify a fresh capability, never race finalizers.
  state.finalizing = true;
  const acceptedOwner = object(state.fingerprint)["owner"];
  equal(
    await ownerDecision(state.record, adapters),
    acceptedOwner,
    "final mutable owner authorization",
  );
  const end = time(await adapters.currentTime());
  need(end >= now && end >= state.lastTime, "backdated final owner reread");
  validateRecord(state.record, state.execution, end);
  state.finalized = true;
  const result = pending(text(state.record["id"]));
  const report = Object.freeze({
    authorization_id: result.incident_id,
    recovery_family: FAMILY,
    execution: structuredClone(state.execution),
    recovery_pending: Object.freeze([Object.freeze(result)]),
  });
  finalizedReports.set(report, result);
  return report;
}

// This view is solely for the unchanged legacy reconciliation. The caller keeps
// the original complete report; serialized/fabricated summaries cannot remove a row.
export function reconcileB304Pending(report: unknown, finalized: B304Finalized): Mapping {
  const expected = finalizedReports.get(finalized);
  need(expected !== undefined, "missing opaque finalized proof");
  const original = object(report);
  const rows = list(original["recovery_pending"]);
  const candidates = rows.filter(
    (row) =>
      object(row)["repository_id"] === RUNTIME_ID || object(row)["recovery_family"] === FAMILY,
  );
  equal(candidates, [expected], "exact finalized pending row");
  return { ...original, recovery_pending: rows.filter((row) => row !== candidates[0]) };
}
