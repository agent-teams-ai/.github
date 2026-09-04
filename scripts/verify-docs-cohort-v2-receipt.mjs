import { createHash } from "node:crypto";
import { lstat, opendir, readFile, realpath } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const SHA = /^(?!0{40}$)[0-9a-f]{40}$/u;
const DIGEST = /^sha256:(?!0{64}$)[0-9a-f]{64}$/u;
const SRI = /^sha512-[A-Za-z0-9+/]{86}==$/u;
const PACKAGE_AUTHORITY = Object.freeze([
  ["repositoryMutation", "@agent-teams/repository-mutation"],
  ["documentAuthoring", "@agent-teams/document-authoring"],
  ["docsProtocol", "@agent-teams/docs-protocol"],
  ["docsProtocolAgentTeams", "@agent-teams/docs-protocol-agent-teams"],
  ["engineeringFoundation", "@agent-teams/engineering-foundation"],
]);
const CHECKS = Object.freeze([
  "profile-v3",
  "cohort-v2",
  "five-package-closure",
  "exact-package-versions",
  "exact-package-integrities",
  "schema-bindings-3-2-1",
  "runtime-closure-digest",
]);

function fail(message) {throw new Error(message);}
function exactObject(value) {return value !== null && typeof value === "object" && !Array.isArray(value);}
function canonicalJson(value) {
  if (Array.isArray(value)) {return `[${value.map(canonicalJson).join(",")}]`;}
  if (exactObject(value)) {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function exactKeys(value, keys) {
  return exactObject(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}
function sha256(value) {return `sha256:${createHash("sha256").update(value).digest("hex")}`;}
function bodyDigest(body) {return sha256(canonicalJson(body));}
function envelopeDigest(body) {
  return sha256(canonicalJson({ domain: "agent-teams.docs-cohort-v2-execution-envelope/v1", body }));
}
function qualificationEventDigest(event) {
  const { event_digest: _ignored, ...body } = event;
  return sha256(canonicalJson({ domain: "agent-teams.docs-qualified-cohort-event/v1", body }));
}

/**
 * Verifies Cohort v2 qualification output only as supporting canary evidence.
 * Central hosted CANARY check evidence remains independently mandatory.
 */
export function verifyDocsCohortV2SupportingEvidence({ receipt, executionEnvelope, record, qualificationEvent }) {
  if (record?.cohort_generation !== 2) {fail("Supporting receipt requires an explicit Cohort v2 record.");}
  if (!exactObject(qualificationEvent) || qualificationEvent.state !== "QUALIFIED" ||
    qualificationEvent.cohort_id !== record.cohort_id ||
    !DIGEST.test(qualificationEvent.event_digest ?? "") ||
    qualificationEvent.event_digest !== qualificationEventDigest(qualificationEvent)) {
    fail("Supporting receipt requires the exact immutable QUALIFIED event.");
  }
  if (!exactKeys(receipt, ["schemaVersion", "receiptDigest", "cohortAdmissible",
    "profileSchemaVersion", "cohort", "packages", "schemas", "runtime", "checks"]) ||
    receipt.schemaVersion !== 3 || receipt.cohortAdmissible !== true ||
    receipt.profileSchemaVersion !== 3) {
    fail("Qualification receipt is not one closed admissible v3 receipt.");
  }
  const { receiptDigest, ...receiptBody } = receipt;
  if (!DIGEST.test(receiptDigest) || receiptDigest !== bodyDigest(receiptBody)) {
    fail("Qualification receipt v3 digest is invalid.");
  }
  if (!exactKeys(receipt.cohort, ["schemaVersion", "cohortId", "recordDigest",
    "qualificationEventDigest"]) || receipt.cohort.schemaVersion !== 2 ||
    receipt.cohort.cohortId !== record.cohort_id ||
    receipt.cohort.recordDigest !== record.record_digest ||
    receipt.cohort.qualificationEventDigest !== qualificationEvent.event_digest) {
    fail("Qualification receipt v3 differs from the exact Cohort v2 authority.");
  }
  if (!exactKeys(receipt.schemas, ["consumerIntegration", "managedState", "docsProtocol"]) ||
    canonicalJson(receipt.schemas) !== canonicalJson({
      consumerIntegration: 3,
      managedState: 2,
      docsProtocol: 1,
    }) || !exactKeys(receipt.runtime, ["runtimeClosureDigest"]) ||
    receipt.runtime.runtimeClosureDigest !== record.runtime_closure.digest ||
    canonicalJson(receipt.checks) !== canonicalJson(CHECKS)) {
    fail("Qualification receipt v3 schema/runtime checks differ from Cohort v2.");
  }
  if (!Array.isArray(receipt.packages) || receipt.packages.length !== PACKAGE_AUTHORITY.length) {
    fail("Qualification receipt v3 must contain exactly five coordinates.");
  }
  const packageByName = new Map(record.packages.map((entry) => [entry.name, entry]));
  for (const [index, [key, name]] of PACKAGE_AUTHORITY.entries()) {
    const actual = receipt.packages[index];
    const expected = packageByName.get(name);
    if (!exactKeys(actual, ["key", "name", "version", "integrity"]) || actual.key !== key ||
      actual.name !== name || actual.version !== expected?.version ||
      actual.integrity !== expected?.integrity || !SRI.test(actual.integrity ?? "")) {
      fail(`Qualification receipt v3 coordinate ${name} is not exact.`);
    }
  }
  if (!exactKeys(executionEnvelope, ["schemaVersion", "domain", "callerSha", "checkout",
    "workflow", "authorizationDigest", "installEvidenceDigest", "receiptDigest", "envelopeDigest"]) ||
    executionEnvelope.schemaVersion !== 1 ||
    executionEnvelope.domain !== "agent-teams.docs-cohort-v2-execution-envelope/v1") {
    fail("Cohort v2 execution envelope is not closed schema v1.");
  }
  const { envelopeDigest: claimedEnvelopeDigest, ...envelopeBody } = executionEnvelope;
  if (!SHA.test(executionEnvelope.callerSha) || !DIGEST.test(executionEnvelope.authorizationDigest) ||
    !DIGEST.test(executionEnvelope.installEvidenceDigest) ||
    executionEnvelope.receiptDigest !== receiptDigest ||
    claimedEnvelopeDigest !== envelopeDigest(envelopeBody)) {
    fail("Cohort v2 execution envelope digest binding is invalid.");
  }
  if (!exactKeys(executionEnvelope.checkout, ["repository", "repositoryId", "revision"]) ||
    executionEnvelope.checkout.revision !== executionEnvelope.callerSha ||
    !Number.isSafeInteger(executionEnvelope.checkout.repositoryId) ||
    executionEnvelope.checkout.repositoryId < 1 ||
    !/^agent-teams-ai\/[A-Za-z0-9_.-]+$/u.test(executionEnvelope.checkout.repository ?? "")) {
    fail("Cohort v2 execution envelope checkout identity is not immutable.");
  }
  if (!record.canary_repositories?.some(({ repository_id: id, repository }) =>
    id === executionEnvelope.checkout.repositoryId &&
    repository === executionEnvelope.checkout.repository)) {
    fail("Cohort v2 execution envelope checkout is not a declared canary repository.");
  }
  if (!exactKeys(executionEnvelope.workflow, ["repository", "path", "revision", "blobSha",
    "runId", "runAttempt"]) ||
    executionEnvelope.workflow.repository !== record.reusable_workflow.repository ||
    executionEnvelope.workflow.path !== record.reusable_workflow.path ||
    executionEnvelope.workflow.revision !== record.reusable_workflow.revision ||
    executionEnvelope.workflow.blobSha !== record.reusable_workflow.blob_sha ||
    !SHA.test(executionEnvelope.workflow.revision) || !SHA.test(executionEnvelope.workflow.blobSha) ||
    !Number.isSafeInteger(executionEnvelope.workflow.runId) || executionEnvelope.workflow.runId < 1 ||
    !Number.isSafeInteger(executionEnvelope.workflow.runAttempt) || executionEnvelope.workflow.runAttempt < 1) {
    fail("Cohort v2 execution envelope workflow identity differs from immutable authority.");
  }
  return Object.freeze({
    evidenceClass: "cohort-v2-supporting-canary",
    receiptDigest,
    envelopeDigest: claimedEnvelopeDigest,
    centralCanaryEvidenceSatisfied: false,
  });
}

export function docsCohortV2ExecutionEnvelopeDigest(envelopeBody) {
  return envelopeDigest(envelopeBody);
}

function authorizationDigest(authorization) {
  return sha256(canonicalJson({ domain: "agent-teams.docs-consumer-gate-authorization/v1", body: authorization }));
}

async function packageRoot(installRoot, expected) {
  const direct = join(installRoot, "node_modules", expected.name);
  try {
    const root = await realpath(direct);
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    if (manifest.name === expected.name && manifest.version === expected.version) {return root;}
  } catch (error) {
    if (error?.code !== "ENOENT") {throw error;}
  }
  const matches = [];
  const handle = await opendir(join(installRoot, "node_modules", ".pnpm"));
  for await (const entry of handle) {
    if (!entry.isDirectory()) {continue;}
    try {
      const root = await realpath(join(installRoot, "node_modules", ".pnpm", entry.name,
        "node_modules", expected.name));
      const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
      if (manifest.name === expected.name && manifest.version === expected.version) {matches.push(root);}
    } catch (error) {
      if (error?.code !== "ENOENT") {throw error;}
    }
  }
  if (new Set(matches).size !== 1) {fail(`${expected.name} does not have one exact installed root.`);}
  return matches[0];
}

async function packageTreeDigest(root, name) {
  const entries = [];
  async function visit(current) {
    const handle = await opendir(current);
    for await (const entry of handle) {
      if (entries.length >= 20_000) {fail(`${name} installed tree exceeds its entry bound.`);}
      const path = join(current, entry.name);
      const portable = relative(root, path).split(sep).join("/");
      if (entry.isSymbolicLink()) {fail(`${name} installed tree contains a symlink.`);}
      if (entry.isDirectory()) {entries.push({ kind: "directory", path: portable }); await visit(path);}
      else if (entry.isFile()) {entries.push({ kind: "file", path: portable, absolute: path });}
      else {fail(`${name} installed tree contains a non-file entry.`);}
    }
  }
  await visit(root);
  entries.sort((left, right) => Buffer.compare(
    Buffer.from(`${left.kind}\0${left.path}`), Buffer.from(`${right.kind}\0${right.path}`),
  ));
  const hash = createHash("sha256"); let total = 0;
  for (const entry of entries) {
    hash.update(entry.kind).update("\0").update(entry.path).update("\0");
    if (entry.kind === "file") {
      const metadata = await lstat(entry.absolute);
      if (!metadata.isFile() || metadata.size > 16 * 1024 * 1024) {
        fail(`${name} installed artifact exceeds its file bound.`);
      }
      const bytes = await readFile(entry.absolute); total += bytes.byteLength;
      if (total > 256 * 1024 * 1024) {fail(`${name} installed tree exceeds its byte bound.`);}
      hash.update(bytes).update("\0");
    }
  }
  return `sha256:${hash.digest("hex")}`;
}

function cliArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!["--consumer", "--install-root", "--authorization", "--install-evidence", "--receipt", "--caller-sha"].includes(key) ||
      typeof value !== "string") {fail("Cohort v2 receipt verifier arguments are invalid.");}
    values[key.slice(2)] = value;
  }
  if (Object.keys(values).length !== 6) {fail("Cohort v2 receipt verifier requires all exact evidence paths.");}
  return values;
}

async function verifyCommand(argv) {
  const args = cliArguments(argv);
  const [authorizationSource, installEvidenceSource, receiptSource] = await Promise.all([
    readFile(resolve(args.authorization), "utf8"),
    readFile(resolve(args["install-evidence"]), "utf8"),
    readFile(resolve(args.receipt), "utf8"),
  ]);
  let authorizationEnvelope; let installEvidence; let receipt;
  try {
    authorizationEnvelope = JSON.parse(authorizationSource);
    installEvidence = JSON.parse(installEvidenceSource);
    receipt = JSON.parse(receiptSource);
  } catch {fail("Cohort v2 verifier evidence is not strict JSON.");}
  const authorization = authorizationEnvelope?.authorization;
  if (!exactKeys(authorizationEnvelope, ["authorization", "authorizationDigest"]) ||
    authorizationEnvelope.authorizationDigest !== authorizationDigest(authorization) ||
    authorization?.qualificationProfile !== "cohort-v2" || authorization?.schemaVersion !== 2 ||
    authorization?.callerSha !== args["caller-sha"] || !SHA.test(args["caller-sha"])) {
    fail("Cohort v2 central authorization is not exact.");
  }
  const consumerRoot = await realpath(resolve(args.consumer));
  for (const [path, expectedDigest] of Object.entries(authorization.fileDigests ?? {})) {
    const absolute = resolve(consumerRoot, path);
    if (!absolute.startsWith(`${consumerRoot}${sep}`)) {fail(`Authorized path ${path} escapes checkout.`);}
    const metadata = await lstat(absolute);
    if (!metadata.isFile() || metadata.isSymbolicLink() || sha256(await readFile(absolute)) !== expectedDigest) {
      fail(`Authorized checkout file changed after qualification: ${path}.`);
    }
  }
  if (!exactKeys(installEvidence, ["schemaVersion", "authorizationDigest", "packages"]) ||
    installEvidence.schemaVersion !== 1 ||
    installEvidence.authorizationDigest !== authorizationEnvelope.authorizationDigest ||
    !Array.isArray(installEvidence.packages) || installEvidence.packages.length !== 5) {
    fail("Cohort v2 install evidence differs from central authorization.");
  }
  const authorizedPackages = new Map(authorization.expectedPackages.map((entry) => [entry.name, entry]));
  const installRoot = await realpath(resolve(args["install-root"]));
  const installedNames = new Set();
  for (const installed of installEvidence.packages) {
    const expected = authorizedPackages.get(installed.name);
    if (!exactKeys(installed, ["name", "version", "integrity", "role", "treeDigest"]) ||
      !DIGEST.test(installed.treeDigest ?? "") || installed.version !== expected?.version ||
      installed.integrity !== expected?.integrity || installed.role !== expected?.role) {
      fail("Cohort v2 installed package evidence is not the exact five-coordinate authority.");
    }
    if (installedNames.has(installed.name)) {fail("Cohort v2 install evidence contains duplicate coordinates.");}
    installedNames.add(installed.name);
    const root = await packageRoot(installRoot, expected);
    if (installed.treeDigest !== await packageTreeDigest(root, installed.name)) {
      fail("Cohort v2 installed package bytes changed after trusted verification.");
    }
  }
  if (installedNames.size !== authorizedPackages.size) {
    fail("Cohort v2 install evidence omits an authorized coordinate.");
  }
  const authority = authorization.qualificationAuthority;
  const record = {
    cohort_generation: authority?.cohortGeneration,
    cohort_id: authority?.cohortId,
    record_digest: authority?.recordDigest,
    packages: authorization.expectedPackages,
    reusable_workflow: authority?.reusableWorkflow,
    runtime_closure: authorization.expectedRuntimeClosure,
    canary_repositories: authority?.canaryRepositories,
  };
  const envelopeBody = {
    schemaVersion: 1,
    domain: "agent-teams.docs-cohort-v2-execution-envelope/v1",
    callerSha: authorization.callerSha,
    checkout: {
      repository: authorization.repository,
      repositoryId: authorization.repositoryId,
      revision: authorization.callerSha,
    },
    workflow: {
      repository: authority.reusableWorkflow.repository,
      path: authority.reusableWorkflow.path,
      revision: authority.reusableWorkflow.revision,
      blobSha: authority.reusableWorkflow.blob_sha,
      runId: Number(process.env.GITHUB_RUN_ID),
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    },
    authorizationDigest: authorizationEnvelope.authorizationDigest,
    installEvidenceDigest: sha256(installEvidenceSource),
    receiptDigest: receipt?.receiptDigest,
  };
  const verified = verifyDocsCohortV2SupportingEvidence({
    receipt,
    executionEnvelope: { ...envelopeBody, envelopeDigest: envelopeDigest(envelopeBody) },
    record,
    qualificationEvent: authority.qualificationEvent,
  });
  if (verified.centralCanaryEvidenceSatisfied !== false) {
    fail("Supporting receipt must never satisfy central CANARY evidence.");
  }
  console.log("Cohort v2 supporting qualification receipt is bound; central CANARY remains unsatisfied.");
}

const isEntrypoint = process.argv[1] !== undefined &&
  new URL(import.meta.url).pathname === resolve(process.argv[1]);
if (isEntrypoint) {
  verifyCommand(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
