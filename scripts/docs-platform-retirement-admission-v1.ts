import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  validateActionsPolicy,
  validateCodeSecurityDefaults,
  validateDocsProtocolCompatibilitySnapshot,
  validateDocsProtocolPolicy,
  validateExecutableSpecLedger,
  validateGovernanceReferences,
  validateOrganizationRepositoryInventory,
} from "./governance-policy.mjs";
import {
  validateDocsGovernanceReferences,
  validateDocsProtocolExceptions,
  validateDocsQualifiedCohorts,
} from "./docs-cohort-policy.mjs";
import { verifyDocsAdmissionEvidence } from "./verify-docs-cohort-evidence.mjs";
import type {
  ProtectedExecutor,
  RetirementTarget,
  RetirementAdmissionDocuments,
} from "./docs-quality-runtime-transition-v1.ts";
import {
  assertLocalSource,
  collectRetirementEvidence,
  createGitHubReadApi,
  executorFromEnvironment,
  HOSTED_PROTECTION_OBSERVATION,
} from "./docs-quality-runtime-transition-v1.ts";

/** The staged, independently reviewed retirement validator; never loaded from PR head. */
export const RETIREMENT_VALIDATOR_SOURCES = Object.freeze({
  "scripts/governance-policy.mjs": "5a1b3166f8f087a9a13e53f2493d579298771f2b",
  "scripts/docs-cohort-policy.mjs": "2c4e03cab43606abf1214cd6403618de00c52e27",
  "scripts/verify-docs-cohort-evidence.mjs": "f9858bc2bf5846cd2cbf5b41a1b7762c9ce27ffd",
});

const POLICY = "governance/docs-protocol-policy-v2.json";
const EXCEPTIONS = "governance/docs-protocol-exceptions.json";
const REGISTRY = "governance/docs-qualified-cohorts.json";
export const RETIREMENT_ADMISSION_DOCUMENT_PATHS = Object.freeze([
  "basePolicy", POLICY, EXCEPTIONS, REGISTRY,
  "governance/docs-protocol-policy-v2.schema.json",
  "governance/docs-protocol-exceptions.schema.json",
  "governance/docs-qualified-cohorts.schema.json",
  "governance/organization-repository-inventory.json",
  "governance/organization-repository-inventory.schema.json",
  "governance/executable-spec-qualification.json",
  "governance/executable-spec-qualification.schema.json",
  "governance/code-security-defaults.json",
  "governance/code-security-defaults.schema.json",
  "governance/actions-policy.json",
  "governance/actions-policy.schema.json",
  "governance/docs-protocol-policy.json",
  "governance/docs-protocol-policy.schema.json",
]);

type JsonRecord = Record<string, unknown>;
type AsyncJson = (...args: never[]) => Promise<unknown>;
/** Only read boundaries may be injected; validation and fleet selection are fixed. */
export type RetirementFleetApi = Partial<{
  getRepository: (repository: string) => Promise<unknown>;
  getDefaultBranch: (repository: string, branch: string) => Promise<unknown>;
  getDefaultBranchHead: (repository: string, branch: string) => Promise<string>;
  isCommitAncestor: (repository: string, base: string, head: string) => Promise<boolean>;
  getCheckRuns: (repository: string, revision: string) => Promise<unknown[]>;
  getWorkflowRun: (repository: string, runId: number) => Promise<unknown>;
  getWorkflowJobs: (repository: string, runId: number, attempt: number) => Promise<unknown[]>;
  getJobLog: (repository: string, jobId: number) => Promise<Buffer>;
  readRepositoryFile: (repository: string, path: string, revision: string) => Promise<Buffer>;
  readGitFile: (repository: string, path: string, revision: string) => Promise<Buffer>;
}>;
const READ_BOUNDARIES = new Set([
  "getRepository", "getDefaultBranch", "getDefaultBranchHead", "isCommitAncestor",
  "getCheckRuns", "getWorkflowRun", "getWorkflowJobs", "getJobLog",
  "readRepositoryFile", "readGitFile",
]);
export interface RetirementAdmissionInput {
  readonly target: RetirementTarget;
  readonly executor: ProtectedExecutor;
  readonly protectionObservation: typeof HOSTED_PROTECTION_OBSERVATION;
  readonly documents: RetirementAdmissionDocuments;
  readonly recheck: () => Promise<void>;
}
export interface RetirementAdmissionReport {
  readonly target: RetirementTarget;
  readonly executor: ProtectedExecutor;
  readonly protectionObservation: typeof HOSTED_PROTECTION_OBSERVATION;
  readonly asOf: string;
  readonly fullFleetCurrent: true;
  readonly historical_verified: readonly number[];
  readonly current_verified: readonly JsonRecord[];
  readonly current_not_evaluated: readonly never[];
  readonly recovery_pending: readonly never[];
}

const gitBlob = (bytes: Buffer): string => createHash("sha1")
  .update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const now = (): string => new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
const sorted = (ids: number[]): number[] => ids.toSorted((left, right) => left - right);
const record = (value: unknown, label: string): JsonRecord => {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonRecord;
};
function boundDocuments(input: RetirementAdmissionInput): Map<string, Buffer> {
  assert.deepEqual([...input.documents.keys()].toSorted(), [...RETIREMENT_ADMISSION_DOCUMENT_PATHS].toSorted(),
    "Retirement admission requires the complete closed document inventory");
  const result = new Map<string, Buffer>();
  for (const path of RETIREMENT_ADMISSION_DOCUMENT_PATHS) {
    const document = input.documents.get(path);
    assert.ok(document && Buffer.isBuffer(document.bytes) && document.bytes.length > 0 &&
      document.bytes.length <= 8 * 1024 * 1024, `Invalid bounded document bytes: ${path}`);
    const revision = [POLICY, EXCEPTIONS].includes(path) ? input.target.headSHA : input.target.baseSHA;
    assert.equal(document.revision, revision, `Document is not from its actual target revision: ${path}`);
    assert.equal(gitBlob(document.bytes), document.blob, `Unbound retirement document: ${path}`);
    result.set(path, Buffer.from(document.bytes));
  }
  return result;
}
async function assertTrustedValidators(): Promise<void> {
  for (const [path, blob] of Object.entries(RETIREMENT_VALIDATOR_SOURCES)) {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    assert.equal(gitBlob(bytes), blob, `Unreviewed staged validator source: ${path}`);
  }
}
function validateDocuments(documents: ReadonlyMap<string, Buffer>, asOf: string): {
  policy: JsonRecord; basePolicy: JsonRecord; registry: JsonRecord; registrySchema: JsonRecord;
  candidateIds: number[];
} {
  const bytes = (path: string): Buffer => {
    const value = documents.get(path); assert.ok(value, `Missing admission document: ${path}`); return value;
  };
  const json = (path: string): JsonRecord => record(JSON.parse(bytes(path).toString("utf8")), path);
  const policy = json(POLICY), basePolicy = json("basePolicy"), registry = json(REGISTRY);
  const registrySchema = json("governance/docs-qualified-cohorts.schema.json");
  const exceptions = json(EXCEPTIONS), inventory = json("governance/organization-repository-inventory.json");
  const security = json("governance/code-security-defaults.json");
  const ledger = json("governance/executable-spec-qualification.json"), actions = json("governance/actions-policy.json");
  validateDocsProtocolPolicy(policy, json("governance/docs-protocol-policy-v2.schema.json"));
  validateDocsProtocolPolicy(basePolicy, json("governance/docs-protocol-policy-v2.schema.json"));
  validateDocsProtocolExceptions(exceptions, json("governance/docs-protocol-exceptions.schema.json"), { asOf: asOf.slice(0, 10) });
  validateDocsQualifiedCohorts(registry, registrySchema, { asOf });
  validateOrganizationRepositoryInventory(inventory, json("governance/organization-repository-inventory.schema.json"));
  validateExecutableSpecLedger(ledger, json("governance/executable-spec-qualification.schema.json"));
  validateCodeSecurityDefaults(security, json("governance/code-security-defaults.schema.json"));
  validateActionsPolicy(actions, json("governance/actions-policy.schema.json"));
  validateDocsProtocolCompatibilitySnapshot(bytes("governance/docs-protocol-policy.json").toString("utf8"),
    bytes("governance/docs-protocol-policy.schema.json").toString("utf8"), policy);
  validateDocsGovernanceReferences(registry, exceptions, policy, security, { asOf });
  validateGovernanceReferences(ledger, security, actions, inventory, policy);
  assert.ok(Array.isArray(policy.repositories), "Missing fleet repository inventory");
  const candidates = policy.repositories.map(value => record(value, "fleet row")).filter(entry =>
    entry.repository_lifecycle === "active" && entry.docs_role === "consumer" &&
    ["bound", "rollout_pending"].includes(String(entry.cohort_binding_status)));
  const candidateIds = candidates.map(entry => {
    assert.ok(Number.isSafeInteger(entry.repository_id) && Number(entry.repository_id) > 0, "Invalid fleet repository identity");
    return Number(entry.repository_id);
  });
  assert.ok(candidateIds.length > 0 && new Set(candidateIds).size === candidateIds.length, "Empty or duplicate full fleet");
  return { policy, basePolicy, registry, registrySchema, candidateIds };
}

/** Run the unchanged full-fleet verifier with real time and no recovery capability. */
export async function verifyPlatformRetirementAdmission(
  input: RetirementAdmissionInput,
  fleetApi: RetirementFleetApi = {},
): Promise<RetirementAdmissionReport> {
  assert.ok(typeof input.recheck === "function", "Fresh live binding check is required");
  assert.equal(input.target.repository, "agent-teams-ai/.github");
  assert.equal(input.target.repositoryId, 1316243981);
  assert.equal(input.target.pullRequest, 367, "This admission adapter owns only retirement PR367");
  assert.equal(input.executor.repository, input.target.repository);
  assert.equal(input.executor.event, "push");
  assert.notEqual(input.executor.sourceSHA, input.target.headSHA, "PR-head execution cannot qualify retirement");
  assert.notEqual(input.executor.sourceSHA, input.target.baseSHA, "Staging execution must not masquerade as target base");
  assert.deepEqual(input.protectionObservation, HOSTED_PROTECTION_OBSERVATION,
    "Hosted admission must disclose its read-only protection visibility");
  for (const [key, value] of Object.entries(fleetApi) as [string, AsyncJson][]) {
    assert.ok(READ_BOUNDARIES.has(key) && typeof value === "function", `Unsupported fleet override: ${key}`);
  }
  const target = structuredClone(input.target), executor = structuredClone(input.executor);
  const documents = boundDocuments(input);
  await input.recheck();
  await assertTrustedValidators();
  const asOf = now();
  const validated = validateDocuments(documents, asOf);
  await input.recheck();
  const raw: unknown = await verifyDocsAdmissionEvidence(validated.policy, validated.registry, validated.registrySchema, {
    ...fleetApi,
    asOf, basePolicy: validated.basePolicy, fullFleetCurrent: true, requireCredential: true,
  });
  const report = record(raw, "Fleet admission report");
  assert.ok(Array.isArray(report.historical_verified) && Array.isArray(report.current_verified), "Incomplete full-fleet report");
  assert.deepEqual(report.current_not_evaluated, [], "Every current fleet member must be evaluated");
  assert.deepEqual(report.recovery_pending, [], "Retirement cannot bypass a failing fleet member through recovery");
  assert.deepEqual(sorted(report.historical_verified as number[]), sorted(validated.candidateIds), "Incomplete historical fleet verification");
  const current = report.current_verified.map(value => record(value, "verified fleet row"));
  assert.deepEqual(sorted(current.map(row => Number(row.repository_id))), sorted(validated.candidateIds), "Incomplete current fleet verification");
  await input.recheck();
  assert.deepEqual(input.target, target, "Target binding changed during fleet verification");
  assert.deepEqual(input.executor, executor, "Executor binding changed during fleet verification");
  assert.deepEqual(boundDocuments(input), documents, "Admission document bytes changed during verification");
  // Recheck time-dependent support and exception rules after the complete asynchronous audit.
  validateDocuments(documents, now());
  return Object.freeze({ target, executor, protectionObservation: HOSTED_PROTECTION_OBSERVATION, asOf, fullFleetCurrent: true,
    historical_verified: Object.freeze([...report.historical_verified] as number[]),
    current_verified: Object.freeze(current), current_not_evaluated: Object.freeze([]) as readonly never[],
    recovery_pending: Object.freeze([]) as readonly never[] });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, "The retirement admission entrypoint accepts no alternate target or clock");
  const executor = executorFromEnvironment();
  const api = createGitHubReadApi(process.env.GITHUB_TOKEN ?? "");
  const evidence = await collectRetirementEvidence(api, executor);
  await assertLocalSource(evidence.sourceTree);
  const report = await verifyPlatformRetirementAdmission(evidence);
  console.log(JSON.stringify(report));
}
