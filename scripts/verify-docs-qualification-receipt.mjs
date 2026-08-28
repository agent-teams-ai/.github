#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, opendir, readFile, realpath } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

import { parseDocument } from "yaml";

const execute = promisify(execFile);
const SHA = /^(?!0{40}$)[0-9a-f]{40}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SRI = /^sha512-[A-Za-z0-9+/]{86}==$/u;
const RECEIPT_LIMIT = 4 * 1024 * 1024;
const FILE_LIMIT = 16 * 1024 * 1024;
const LOCKFILE_LIMIT = 64 * 1024 * 1024;
const TREE_ENTRY_LIMIT = 20_000;
const TREE_BYTES_LIMIT = 512 * 1024 * 1024;
const BUILD_FILE_LIMIT = 8 * 1024 * 1024;
const BUILD_FILE_COUNT_LIMIT = 4_096;
const BUILD_ENTRY_LIMIT = 16_384;
const BUILD_BYTES_LIMIT = 64 * 1024 * 1024;
const BUILD_DEPTH_LIMIT = 64;
const SOURCE_ROOT_EXCLUSIONS = new Set([".agent-teams-local", ".cache", ".git", "target"]);
const CACHE_TAG_SIGNATURE = "Signature: 8a477f597d28d172789f06886806bc55";
const REQUIRED_CHECKS = ["info", "find", "check", "doctor", "recover", "preview", "apply", "path", "reachability", "source-unchanged"];

function fail(message) { throw new Error(message); }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, keys) {
  return isRecord(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}
function requireKeys(value, keys, label) {
  if (!exactKeys(value, keys)) { fail(`${label} shape is not closed.`); }
}
function canonicalJson(value) {
  if (Array.isArray(value)) { return `[${value.map(canonicalJson).join(",")}]`; }
  if (isRecord(value)) {
    return `{${Object.entries(value).sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function digest(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function authorizationDigest(value) { return digest(canonicalJson({ domain: "agent-teams.docs-consumer-gate-authorization/v1", body: value })); }
function portable(root, path) { return relative(root, path).split(sep).join("/"); }
async function sourceExcluded(root, repositoryPath, governedRoots, entryKind) {
  const segments = repositoryPath.split("/");
  if (segments.some((segment) => segment === ".git" || segment === "node_modules")) { return true; }
  if (entryKind !== "directory") { return false; }
  if (governedRoots.some((governed) => repositoryPath === governed || repositoryPath.startsWith(`${governed}/`) || governed.startsWith(`${repositoryPath}/`))) { return false; }
  if (SOURCE_ROOT_EXCLUSIONS.has(segments[0])) { return true; }
  if (!["target", ".cache"].includes(segments.at(-1))) { return false; }
  const directoryPath = join(root, repositoryPath);
  const directoryBefore = await lstat(directoryPath);
  if (!directoryBefore.isDirectory() || directoryBefore.isSymbolicLink() || await realpath(directoryPath) !== directoryPath) { return false; }
  const tagPath = join(root, repositoryPath, "CACHEDIR.TAG");
  let before;
  try { before = await lstat(tagPath); } catch (error) { if (error?.code === "ENOENT") { return false; } throw error; }
  if (!before.isFile() || before.isSymbolicLink() || before.size > 1024 || await realpath(tagPath) !== tagPath) { return false; }
  const bytes = await readFile(tagPath); const after = await lstat(tagPath);
  const directoryAfter = await lstat(directoryPath);
  return directoryAfter.isDirectory() && !directoryAfter.isSymbolicLink() && directoryAfter.ino === directoryBefore.ino &&
    directoryAfter.dev === directoryBefore.dev && after.isFile() && after.ino === before.ino && after.dev === before.dev && after.size === before.size &&
    after.mtimeMs === before.mtimeMs && bytes.byteLength === after.size && bytes.toString("utf8").split("\n", 1)[0] === CACHE_TAG_SIGNATURE;
}
function canonicalRepositoryPath(repositoryPath, label) {
  if (typeof repositoryPath !== "string" || repositoryPath.length === 0 || repositoryPath.startsWith("/") ||
      repositoryPath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    fail(`${label} is not one canonical repository-relative path.`);
  }
  return repositoryPath;
}

async function boundedRegularFile(path, limit, label) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > limit) { fail(`${label} is not one bounded regular file.`); }
  if (await realpath(path) !== path) { fail(`${label} traverses a symlink.`); }
  const bytes = await readFile(path);
  const after = await lstat(path);
  if (!after.isFile() || after.size !== before.size || after.mtimeMs !== before.mtimeMs || bytes.byteLength !== after.size) {
    fail(`${label} changed during its bounded read.`);
  }
  return bytes;
}

async function consumerFile(root, repositoryPath, limit = FILE_LIMIT) {
  canonicalRepositoryPath(repositoryPath, "Receipt evidence path");
  const path = resolve(root, repositoryPath);
  if (!path.startsWith(`${root}${sep}`)) { fail(`Receipt evidence path escapes the consumer: ${repositoryPath}.`); }
  return boundedRegularFile(path, limit, `Receipt evidence ${repositoryPath}`);
}

async function consumerSnapshot(root, governedRoots) {
  if (!Array.isArray(governedRoots) || governedRoots.length > 32 || governedRoots.some((path) => typeof path !== "string" || path.startsWith("/") ||
      path.split("/").some((segment) => segment === "" || segment === "." || segment === ".."))) {
    fail("Qualification governed roots are not one bounded canonical path set.");
  }
  const policyRoots = [...new Set(governedRoots)].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const entries = [];
  async function visit(directory) {
    const handle = await opendir(directory);
    for await (const entry of handle) {
      const path = join(directory, entry.name);
      const repositoryPath = portable(root, path);
      const entryKind = entry.isDirectory() ? "directory" : entry.isFile() ? "file" : entry.isSymbolicLink() ? "symbolic-link" : "other";
      if (await sourceExcluded(root, repositoryPath, policyRoots, entryKind)) { continue; }
      if (entries.length >= TREE_ENTRY_LIMIT) { fail("Qualification source exceeds its bounded entry budget."); }
      if (entry.isSymbolicLink()) { fail(`Qualification source contains a symlink: ${repositoryPath}.`); }
      if (entry.isDirectory()) { entries.push({ kind: "directory", path: repositoryPath, absolute: path }); await visit(path); }
      else if (entry.isFile()) { entries.push({ kind: "file", path: repositoryPath, absolute: path }); }
      else { fail(`Qualification source contains a non-file entry: ${repositoryPath}.`); }
    }
  }
  await visit(root);
  entries.sort((left, right) => Buffer.compare(Buffer.from(`${left.kind}\0${left.path}`), Buffer.from(`${right.kind}\0${right.path}`)));
  const hash = createHash("sha256");
  let total = 0;
  for (const entry of entries) {
    hash.update(entry.kind).update("\0").update(entry.path).update("\0");
    if (entry.kind === "file") {
      const bytes = await boundedRegularFile(entry.absolute, FILE_LIMIT, `Qualification source ${entry.path}`);
      total += bytes.byteLength;
      if (total > TREE_BYTES_LIMIT) { fail("Qualification source exceeds its bounded byte budget."); }
      hash.update(bytes).update("\0");
    }
  }
  return `sha256:${hash.digest("hex")}`;
}

async function assertCheckoutHead(root, callerSha) {
  const { stdout: top } = await execute("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  const { stdout: head } = await execute("git", ["-C", root, "rev-parse", "--verify", "HEAD^{commit}"], { encoding: "utf8" });
  if (await realpath(top.trim()) !== root || head.trim() !== callerSha) { fail("Caller SHA does not match the exact consumer checkout HEAD."); }
}

async function packageRoot(installRoot, packageName) {
  const path = resolve(installRoot, "node_modules", ...packageName.split("/"));
  const root = await realpath(path);
  const metadata = await lstat(root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) { fail(`Installed package ${packageName} is not a real directory.`); }
  return root;
}

async function packageManifest(root, expectedName) {
  const manifest = JSON.parse((await boundedRegularFile(join(root, "package.json"), FILE_LIMIT, `${expectedName} manifest`)).toString("utf8"));
  if (!isRecord(manifest) || manifest.name !== expectedName || typeof manifest.version !== "string" || manifest.version.length === 0) {
    fail(`Installed package ${expectedName} identity is invalid.`);
  }
  return manifest;
}

async function packageTreeDigest(root, packageName) {
  const entries = [];
  async function visit(directory) {
    const handle = await opendir(directory);
    for await (const entry of handle) {
      const path = join(directory, entry.name); const repositoryPath = portable(root, path);
      if (entries.length >= TREE_ENTRY_LIMIT) { fail(`${packageName} installed tree exceeds its entry bound.`); }
      if (entry.isSymbolicLink()) { fail(`${packageName} installed tree contains a symlink.`); }
      if (entry.isDirectory()) { entries.push({ kind: "directory", path: repositoryPath }); await visit(path); }
      else if (entry.isFile()) { entries.push({ kind: "file", path: repositoryPath, absolute: path }); }
      else { fail(`${packageName} installed tree contains a non-file entry.`); }
    }
  }
  await visit(root);
  entries.sort((left, right) => Buffer.compare(Buffer.from(`${left.kind}\0${left.path}`), Buffer.from(`${right.kind}\0${right.path}`)));
  const hash = createHash("sha256"); let total = 0;
  for (const entry of entries) {
    hash.update(entry.kind).update("\0").update(entry.path).update("\0");
    if (entry.kind === "file") {
      const bytes = await boundedRegularFile(entry.absolute, FILE_LIMIT, `${packageName} installed artifact ${entry.path}`);
      total += bytes.byteLength;
      if (total > 256 * 1024 * 1024) { fail(`${packageName} installed tree exceeds its byte bound.`); }
      hash.update(bytes).update("\0");
    }
  }
  return `sha256:${hash.digest("hex")}`;
}

function hashLength(hash, length) {
  const encoded = Buffer.allocUnsafe(8);
  encoded.writeBigUInt64BE(BigInt(length));
  hash.update(encoded);
}

async function foundationBuildIdentity(root) {
  const files = [];
  let visited = 0;
  async function collect(directory, include, depth) {
    if (depth > BUILD_DEPTH_LIMIT) { fail("Installed Foundation build tree is too deep."); }
    const entries = [];
    const handle = await opendir(directory);
    for await (const entry of handle) {
      visited += 1;
      if (visited > BUILD_ENTRY_LIMIT) { fail("Installed Foundation build contains too many entries."); }
      entries.push(entry);
    }
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { await collect(path, include, depth + 1); }
      else if (!entry.isFile()) { fail(`Installed Foundation build contains a non-regular artifact: ${portable(root, path)}.`); }
      else if (include(path)) {
        files.push(path);
        if (files.length > BUILD_FILE_COUNT_LIMIT) { fail("Installed Foundation build contains too many artifacts."); }
      }
    }
  }
  for (const [name, include] of [["dist", (path) => path.endsWith(".js")], ["schemas", () => true], ["presets", () => true]]) {
    const directory = join(root, name);
    const metadata = await lstat(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) { fail(`Installed Foundation build directory is unsafe: ${name}.`); }
    await collect(directory, include, 0);
  }
  files.push(join(root, "package.json"));
  files.sort((left, right) => portable(root, left) < portable(root, right) ? -1 : portable(root, left) > portable(root, right) ? 1 : 0);
  const hash = createHash("sha256");
  let total = 0;
  for (const path of files) {
    const repositoryPath = portable(root, path);
    const bytes = await boundedRegularFile(path, BUILD_FILE_LIMIT, `Installed Foundation artifact ${repositoryPath}`);
    total += bytes.byteLength;
    if (total > BUILD_BYTES_LIMIT) { fail("Installed Foundation build artifacts exceed the byte limit."); }
    const pathBytes = Buffer.from(repositoryPath, "utf8");
    hashLength(hash, pathBytes.byteLength); hash.update(pathBytes);
    hashLength(hash, bytes.byteLength); hash.update(bytes);
  }
  return `sha256:${hash.digest("hex")}`;
}

function validateReceiptShape(receipt) {
  requireKeys(receipt, ["schemaVersion", "receiptDigest", "cohortAdmissible", "evidenceClass", "projectId", "scenarios", "checks", "derived", "evidence"], "Qualification receipt");
  requireKeys(receipt.derived, ["contractPath", "gateCommand", "packageVersions", "profilePath"], "Qualification derived evidence");
  requireKeys(receipt.derived.packageVersions, ["docsProtocol", "engineeringFoundation"], "Qualification package versions");
  requireKeys(receipt.evidence, ["sourceDigest", "integration", "contract", "profile", "skill", "packageManifestDigest", "lockfileDigest", "executingDocsProtocol", "executingFoundation", "cohort"], "Qualification evidence");
  for (const [label, value] of [["integration", receipt.evidence.integration], ["contract", receipt.evidence.contract], ["profile", receipt.evidence.profile], ["skill", receipt.evidence.skill]]) {
    requireKeys(value, ["path", "digest"], `Qualification ${label} evidence`);
  }
  requireKeys(receipt.evidence.executingDocsProtocol, ["version", "buildDigest"], "Executing Docs Protocol evidence");
  requireKeys(receipt.evidence.executingFoundation, ["version", "buildIdentity"], "Executing Foundation evidence");
  if (!Array.isArray(receipt.scenarios) || receipt.scenarios.some((scenario) => !exactKeys(scenario, ["id", "type", "documentPath", "outputDigest"]))) {
    fail("Qualification scenarios shape is not closed.");
  }
  if (!Array.isArray(receipt.checks) || typeof receipt.projectId !== "string" || receipt.projectId.length === 0 ||
      ![receipt.receiptDigest, receipt.evidence.sourceDigest, receipt.evidence.packageManifestDigest, receipt.evidence.lockfileDigest,
        receipt.evidence.executingDocsProtocol.buildDigest, receipt.evidence.executingFoundation.buildIdentity,
        ...receipt.scenarios.map(({ outputDigest }) => outputDigest)].every((value) => typeof value === "string" && DIGEST.test(value))) {
    fail("Qualification receipt contains an invalid identity digest.");
  }
}

export async function verifyQualificationReceipt({ consumerRoot, installRoot, authorizationPath, installEvidencePath, receiptPath, callerSha }) {
  if (!SHA.test(callerSha)) { fail("Qualification receipt lacks an immutable caller SHA context."); }
  const root = await realpath(resolve(consumerRoot));
  const installedAt = await realpath(resolve(installRoot));
  const authorizationBytes = await boundedRegularFile(await realpath(resolve(authorizationPath)), RECEIPT_LIMIT, "Central gate authorization");
  let authorizationEnvelope;
  try { authorizationEnvelope = JSON.parse(authorizationBytes.toString("utf8")); } catch { fail("Central gate authorization is not strict JSON."); }
  requireKeys(authorizationEnvelope, ["authorization", "authorizationDigest"], "Central gate authorization envelope");
  const authorization = authorizationEnvelope.authorization;
  if (authorizationEnvelope.authorizationDigest !== authorizationDigest(authorization) || authorization.callerSha !== callerSha ||
      !Array.isArray(authorization.expectedPackages) || authorization.expectedPackages.length !== 2) {
    fail("Central gate authorization package authority is invalid.");
  }
  const expectedPackages = new Map();
  for (const expected of authorization.expectedPackages) {
    if (!exactKeys(expected, ["name", "version", "integrity"]) ||
        !["@agent-teams/docs-protocol", "@agent-teams/engineering-foundation"].includes(expected.name) ||
        typeof expected.version !== "string" || expected.version.length === 0 || !SRI.test(expected.integrity) || expectedPackages.has(expected.name)) {
      fail("Central gate authorization contains an invalid exact package authority.");
    }
    expectedPackages.set(expected.name, expected);
  }
  const installEvidenceBytes = await boundedRegularFile(await realpath(resolve(installEvidencePath)), RECEIPT_LIMIT, "Trusted install evidence");
  let installEvidence;
  try { installEvidence = JSON.parse(installEvidenceBytes.toString("utf8")); } catch { fail("Trusted install evidence is not strict JSON."); }
  requireKeys(installEvidence, ["schemaVersion", "authorizationDigest", "packages"], "Trusted install evidence");
  if (installEvidence.schemaVersion !== 1 || installEvidence.authorizationDigest !== authorizationEnvelope.authorizationDigest ||
      !Array.isArray(installEvidence.packages) || installEvidence.packages.length !== 2) {
    fail("Trusted install evidence differs from central package authority.");
  }
  const installedEvidence = new Map();
  for (const entry of installEvidence.packages) {
    if (!exactKeys(entry, ["name", "version", "integrity", "treeDigest"]) || !DIGEST.test(entry.treeDigest) || installedEvidence.has(entry.name)) {
      fail("Trusted install package evidence shape is invalid.");
    }
    installedEvidence.set(entry.name, entry);
  }
  const receiptRequested = resolve(receiptPath);
  if ((await lstat(receiptRequested)).isSymbolicLink()) { fail("Qualification receipt path must not be a symlink."); }
  const receiptAbsolute = await realpath(receiptRequested);
  const receiptRelative = relative(root, receiptAbsolute);
  if (receiptRelative !== ".." && !receiptRelative.startsWith(`..${sep}`)) { fail("Qualification receipt must be outside the consumer root."); }
  await assertCheckoutHead(root, callerSha);
  const receiptBytes = await boundedRegularFile(receiptAbsolute, RECEIPT_LIMIT, "Qualification receipt");
  let envelope;
  try { envelope = JSON.parse(receiptBytes.toString("utf8")); } catch { fail("Qualification command envelope is not strict JSON."); }
  requireKeys(envelope, ["schemaVersion", "protocol", "command", "outcome", "diagnostics", "result"], "Qualification command envelope");
  requireKeys(envelope.protocol, ["id", "version"], "Qualification command protocol");
  if (envelope.schemaVersion !== 2 || canonicalJson(envelope.protocol) !== canonicalJson({ id: "agent-teams.docs-protocol", version: 1 }) ||
      envelope.command !== "docs.qualify" || envelope.outcome !== "success" || !Array.isArray(envelope.diagnostics) || envelope.diagnostics.length !== 0) {
    fail("Qualification command envelope is not one successful closed docs.qualify v2 result.");
  }
  const receipt = envelope.result;
  validateReceiptShape(receipt);
  if (receipt.schemaVersion !== 2 || receipt.evidenceClass !== "released-cohort" || receipt.cohortAdmissible !== true) {
    fail("Qualification receipt is not released-cohort admissible v2 evidence.");
  }
  const { receiptDigest, ...body } = receipt;
  if (receiptDigest !== digest(canonicalJson(body))) { fail("Qualification receipt digest is invalid."); }
  const integrationPath = receipt.evidence.integration.path;
  const integrationBytes = await consumerFile(root, integrationPath);
  const integration = JSON.parse(integrationBytes.toString("utf8"));
  if (integration.schemaVersion !== 2 || integration.qualification?.contractPath !== receipt.derived.contractPath ||
      integration.qualification?.gateCommand !== receipt.derived.gateCommand || integration.profilePath !== receipt.derived.profilePath ||
      canonicalJson(integration.cohort) !== canonicalJson(receipt.evidence.cohort)) {
    fail("Qualification receipt differs from the exact managed integration authority.");
  }
  if (receipt.evidence.sourceDigest !== await consumerSnapshot(root, integration.governedDocsRoots ?? [])) {
    fail("Qualification source digest differs from the exact consumer checkout.");
  }
  const evidence = [
    [integrationPath, receipt.evidence.integration.digest, FILE_LIMIT],
    [receipt.evidence.contract.path, receipt.evidence.contract.digest, FILE_LIMIT],
    [receipt.evidence.profile.path, receipt.evidence.profile.digest, FILE_LIMIT],
    [receipt.evidence.skill.path, receipt.evidence.skill.digest, FILE_LIMIT],
    ["package.json", receipt.evidence.packageManifestDigest, FILE_LIMIT],
    ["pnpm-lock.yaml", receipt.evidence.lockfileDigest, LOCKFILE_LIMIT],
  ];
  for (const [path, expected, limit] of evidence) {
    if (typeof expected !== "string" || !DIGEST.test(expected) || digest(await consumerFile(root, path, limit)) !== expected) {
      fail(`Qualification receipt evidence digest differs at ${path}.`);
    }
  }

  const docsRoot = await packageRoot(installedAt, "@agent-teams/docs-protocol");
  const foundationRoot = await packageRoot(installedAt, "@agent-teams/engineering-foundation");
  const installLockSource = (await boundedRegularFile(join(installedAt, "pnpm-lock.yaml"), LOCKFILE_LIMIT, "Trusted install lockfile")).toString("utf8");
  const installLockDocument = parseDocument(installLockSource, { strict: true, uniqueKeys: true });
  if (installLockDocument.errors.length !== 0) { fail("Trusted install lockfile is not strict duplicate-free YAML."); }
  const installLock = installLockDocument.toJS();
  const [docsManifest, foundationManifest] = await Promise.all([
    packageManifest(docsRoot, "@agent-teams/docs-protocol"), packageManifest(foundationRoot, "@agent-teams/engineering-foundation"),
  ]);
  for (const [name, packageRootPath] of [["@agent-teams/docs-protocol", docsRoot], ["@agent-teams/engineering-foundation", foundationRoot]]) {
    const expected = expectedPackages.get(name); const evidence = installedEvidence.get(name);
    if (canonicalJson({ name: evidence?.name, version: evidence?.version, integrity: evidence?.integrity }) !== canonicalJson(expected) ||
        evidence.treeDigest !== await packageTreeDigest(packageRootPath, name)) {
      fail("Installed package bytes changed after central SRI-bound pre-execution verification.");
    }
  }
  const packages = integration.cohort?.packages;
  for (const [name, cohortKey] of [["@agent-teams/docs-protocol", "docsProtocol"], ["@agent-teams/engineering-foundation", "engineeringFoundation"]]) {
    const expected = expectedPackages.get(name);
    const cohortPackage = packages?.[cohortKey];
    const lockPackage = installLock.packages?.[`${name}@${expected.version}`];
    if (cohortPackage?.version !== expected.version || cohortPackage?.integrity !== expected.integrity ||
        lockPackage?.resolution?.integrity !== expected.integrity) {
      fail("Installed Cohort package graph differs from central expectedPackages SRI authority.");
    }
  }
  const executingModuleDigest = digest(await boundedRegularFile(
    join(docsRoot, "dist/qualification/qualification-v2-runner.js"),
    BUILD_FILE_LIMIT,
    "Executing Docs Protocol qualification v2 runner",
  ));
  const installedFoundationIdentity = await foundationBuildIdentity(foundationRoot);
  if (receipt.derived.packageVersions.docsProtocol !== packages?.docsProtocol?.version ||
      receipt.derived.packageVersions.engineeringFoundation !== packages?.engineeringFoundation?.version ||
      receipt.evidence.executingDocsProtocol.version !== docsManifest.version || docsManifest.version !== packages?.docsProtocol?.version ||
      receipt.evidence.executingDocsProtocol.buildDigest !== executingModuleDigest ||
      receipt.evidence.executingFoundation.version !== foundationManifest.version || foundationManifest.version !== packages?.engineeringFoundation?.version ||
      receipt.evidence.executingFoundation.buildIdentity !== installedFoundationIdentity) {
    fail("Qualification receipt execution identity differs from the exact installed Cohort packages.");
  }

  const contract = JSON.parse((await consumerFile(root, receipt.evidence.contract.path)).toString("utf8"));
  const expectedScenarios = [];
  if (Array.isArray(contract.scenarios)) {
    for (const scenario of contract.scenarios) {
      const goldenDigest = scenario.expected?.goldenDigest ?? (scenario.expected?.goldenFile === undefined
        ? undefined
        : digest(await consumerFile(root, scenario.expected.goldenFile)));
      expectedScenarios.push({ id: scenario.id, type: scenario.type, documentPath: scenario.expected?.documentPath,
        ...(goldenDigest === undefined ? {} : { outputDigest: goldenDigest }) });
    }
  }
  if (!Array.isArray(expectedScenarios) || expectedScenarios.length === 0 || receipt.scenarios.length !== expectedScenarios.length ||
      expectedScenarios.some((expected, index) => {
        const actual = receipt.scenarios[index];
        return actual.id !== expected.id || actual.type !== expected.type || actual.documentPath !== expected.documentPath ||
          (expected.outputDigest !== undefined && actual.outputDigest !== expected.outputDigest);
      })) {
    fail("Qualification receipt scenarios differ from the exact qualification contract.");
  }
  const hasGolden = contract.scenarios.some(({ expected }) => expected?.goldenFile !== undefined || expected?.goldenDigest !== undefined);
  const exactChecks = [...REQUIRED_CHECKS.slice(0, -1), ...(hasGolden ? ["golden"] : []), REQUIRED_CHECKS.at(-1)];
  if (canonicalJson(receipt.checks) !== canonicalJson(exactChecks)) { fail("Qualification receipt checks differ from the exact protocol contract."); }
  return Object.freeze({ callerSha, cohortId: integration.cohort.cohortId, receiptDigest });
}

function options(argv) {
  const allowed = new Set(["--consumer", "--install-root", "--authorization", "--install-evidence", "--receipt", "--caller-sha"]);
  if (argv.length !== 12) { fail("Exactly --consumer, --install-root, --authorization, --install-evidence, --receipt, and --caller-sha are required."); }
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]; const value = argv[index + 1];
    if (!allowed.has(name) || typeof value !== "string" || value.length === 0 || name in result) { fail(`Invalid qualification verifier option: ${name}.`); }
    result[name] = value;
  }
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const parsed = options(process.argv.slice(2));
  const verified = await verifyQualificationReceipt({
    consumerRoot: parsed["--consumer"], installRoot: parsed["--install-root"], authorizationPath: parsed["--authorization"], installEvidencePath: parsed["--install-evidence"],
    receiptPath: parsed["--receipt"], callerSha: parsed["--caller-sha"],
  });
  process.stdout.write(`Verified released-cohort qualification receipt ${verified.receiptDigest} for ${verified.cohortId} at ${verified.callerSha}.\n`);
}
