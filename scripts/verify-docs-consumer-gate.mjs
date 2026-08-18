#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { isAlias, isNode, parseDocument, visit } from "yaml";

import {
  docsRuntimeClosureAuthority,
  docsRuntimeClosureEvidence,
  docsCohortTransitionKind,
  isDocsCohortSelectableForRepository,
  isDocsCohortSupportedForExistingBinding,
  validateDocsProtocolExceptions,
  validateDocsQualifiedCohorts,
} from "./docs-cohort-policy.mjs";

const CONTROLLER_REPOSITORY = "agent-teams-ai/.github";
const REUSABLE_WORKFLOW_PATH = ".github/workflows/docs-protocol-check.yml";
const INTEGRATION_PROFILE_PATH = "architecture/foundation/docs-consumer-integration.json";
const MANAGED_PROJECTION_PATH = "architecture/foundation/docs-protocol-managed-state.json";
const CALLER_WORKFLOW_PATH = ".github/workflows/docs-protocol.yml";
const PNPM_WORKSPACE_PATH = "pnpm-workspace.yaml";
const MANAGED_PACKAGES = Object.freeze([
  "@agent-teams/engineering-foundation",
  "@agent-teams/docs-protocol",
]);
export const CURRENT_CONTROLLER_DATA_PATHS = Object.freeze([
  "governance/docs-protocol-exceptions.json",
  "governance/docs-protocol-policy.json",
  "governance/docs-qualified-cohorts.json",
]);
const JSON_LIMITS = Object.freeze({
  [INTEGRATION_PROFILE_PATH]: 128 * 1024,
  [MANAGED_PROJECTION_PATH]: 64 * 1024,
  "package.json": 512 * 1024,
});
const LOCKFILE_LIMIT = 8 * 1024 * 1024;
const WORKSPACE_LIMIT = 512 * 1024;
const CALLER_LIMIT = 32 * 1024;
const SHA = /^(?!0{40}$)[0-9a-f]{40}$/u;
const SRI = /^sha512-[A-Za-z0-9+/]{86}==$/u;
const EXACT_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u;
const ALWAYS_FORBIDDEN_LOCK_KEYS = new Set([
  "packageExtensions",
  "patchedDependencies",
  "patchedDependenciesMeta",
]);
const ROOT_LOCK_POLICY_KEYS = new Set(["overrides", "packageExtensionsChecksum"]);
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const PACKAGE_EXTENSION_CHECKSUM = /^sha256-[A-Za-z0-9+/]{43}=$/u;

export class GatePolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = "GatePolicyError";
  }
}

export class GateInfrastructureError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "GateInfrastructureError";
  }
}

function assert(condition, message) {
  if (!condition) {throw new GatePolicyError(message);}
}

export function gateErrorCode(error) {
  return error instanceof GatePolicyError
    ? "DOCS_GATE_POLICY_REJECTED"
    : "DOCS_GATE_INFRASTRUCTURE_FAILURE";
}

export function shouldRunDocsGate(eventName, refName, defaultBranch) {
  return eventName !== "push" || refName === defaultBranch;
}

function sha256(source) {
  return `sha256:${createHash("sha256").update(source).digest("hex")}`;
}

function gitBlobSha(source) {
  const bytes = Buffer.from(source);
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    assert(Number.isSafeInteger(value), "Canonical JSON accepts only safe integers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {return `[${value.map(canonicalJson).join(",")}]`;}
  assert(typeof value === "object" && value !== undefined, "Value is not canonical JSON.");
  return `{${Object.entries(value)
    .toSorted(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}

class JsonDuplicateScanner {
  constructor(source, label) {
    this.source = source;
    this.label = label;
    this.offset = 0;
  }

  scan() {
    this.#value();
    this.#space();
    assert(this.offset === this.source.length, `${this.label} has trailing JSON input.`);
  }

  #space() {
    while (/\s/u.test(this.source[this.offset] ?? "")) {this.offset += 1;}
  }

  #value() {
    this.#space();
    const character = this.source[this.offset];
    if (character === "{") {this.#object(); return;}
    if (character === "[") {this.#array(); return;}
    if (character === '"') {this.#string(); return;}
    const tail = this.source.slice(this.offset);
    const literal = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/u.exec(tail)?.[0];
    assert(literal !== undefined, `${this.label} is not valid JSON near byte ${this.offset}.`);
    this.offset += literal.length;
  }

  #object() {
    this.offset += 1;
    const keys = new Set();
    this.#space();
    if (this.source[this.offset] === "}") {this.offset += 1; return;}
    while (true) {
      this.#space();
      assert(this.source[this.offset] === '"', `${this.label} object key is not a JSON string.`);
      const key = this.#string();
      assert(!keys.has(key), `${this.label} contains duplicate JSON key ${JSON.stringify(key)}.`);
      keys.add(key);
      this.#space();
      assert(this.source[this.offset] === ":", `${this.label} object key has no value.`);
      this.offset += 1;
      this.#value();
      this.#space();
      if (this.source[this.offset] === "}") {this.offset += 1; return;}
      assert(this.source[this.offset] === ",", `${this.label} object entries are not comma-separated.`);
      this.offset += 1;
    }
  }

  #array() {
    this.offset += 1;
    this.#space();
    if (this.source[this.offset] === "]") {this.offset += 1; return;}
    while (true) {
      this.#value();
      this.#space();
      if (this.source[this.offset] === "]") {this.offset += 1; return;}
      assert(this.source[this.offset] === ",", `${this.label} array entries are not comma-separated.`);
      this.offset += 1;
    }
  }

  #string() {
    const start = this.offset;
    this.offset += 1;
    while (this.offset < this.source.length) {
      const character = this.source[this.offset];
      if (character === '"') {
        this.offset += 1;
        return JSON.parse(this.source.slice(start, this.offset));
      }
      if (character === "\\") {
        this.offset += 2;
      } else {
        assert(character.charCodeAt(0) >= 0x20, `${this.label} contains a control character.`);
        this.offset += 1;
      }
    }
    throw new Error(`${this.label} contains an unterminated JSON string.`);
  }
}

export function parseJsonStrict(source, label, limit) {
  assert(Buffer.byteLength(source) <= limit, `${label} exceeds its ${limit}-byte safety bound.`);
  new JsonDuplicateScanner(source, label).scan();
  return JSON.parse(source);
}

export function parseYamlStrict(source, label, limit) {
  assert(Buffer.byteLength(source) <= limit, `${label} exceeds its ${limit}-byte safety bound.`);
  const document = parseDocument(source, {
    maxAliasCount: 0,
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  assert(document.errors.length === 0,
    `${label} is not strict duplicate-free YAML: ${document.errors.map(({ message }) => message).join("; ")}`);
  visit(document, (_key, node) => {
    assert(!isAlias(node), `${label} must not contain YAML aliases.`);
    if (isNode(node)) {
      assert(node.anchor === undefined, `${label} must not contain YAML anchors.`);
      assert(node.tag === undefined, `${label} must not contain explicit YAML tags.`);
    }
  });
  return document.toJS({ maxAliasCount: 0 });
}

function exactObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return exactObject(value) && canonicalJson(Object.keys(value).toSorted()) === canonicalJson([...keys].toSorted());
}

function assertRepositoryAuthority(policyEntry, repository) {
  assert(policyEntry !== undefined, "Caller repository is absent from central Docs admission.");
  const ownership = policyEntry.governance_ownership ?? policyEntry.ownership;
  const role = policyEntry.docs_role ?? policyEntry.role;
  const lifecycle = policyEntry.repository_lifecycle ?? "active";
  assert(policyEntry.repository_id === repository.id && policyEntry.repository === repository.fullName,
    "Caller immutable repository ID/name differs from central admission.");
  const admitted = policyEntry.admission_status === "admitted" &&
    ["bound", "rollout_pending"].includes(policyEntry.cohort_binding_status ?? "bound") &&
    policyEntry.observed_cohort_id !== null;
  const bootstrap = policyEntry.admission_status === "admission_candidate" &&
    policyEntry.cohort_binding_status === "bootstrap_pending" &&
    policyEntry.desired_cohort_id !== null &&
    policyEntry.observed_cohort_id === null;
  assert(ownership === "organization_owned" && role === "consumer" && lifecycle === "active" &&
    (admitted || bootstrap) && policyEntry.protocol_required === true,
  "Caller is not an active admitted or bootstrap-candidate organization-owned Docs consumer.");
}

function stateFor(lifecycle, repositoryEntry, record, repositoryId, asOf) {
  const cohortId = record.cohort_id;
  const desired = repositoryEntry.desired_cohort_id;
  const observed = repositoryEntry.observed_cohort_id;
  assert(cohortId === desired || cohortId === observed,
    "Requested Cohort is neither the central desired nor observed state for this repository.");
  const registryState = lifecycle.stateById.get(cohortId);
  let selectable = cohortId === desired &&
    isDocsCohortSelectableForRepository(record, registryState, repositoryId);
  if (cohortId === desired && desired !== observed) {
    if (repositoryEntry.cohort_binding_status === "bootstrap_pending" && observed === null) {
      assert(repositoryEntry.admission_status === "admission_candidate" && selectable,
        "Bootstrap candidate does not select an eligible desired Cohort.");
    } else {
      const observedRecord = lifecycle.cohortById.get(observed);
      const transitionKind = docsCohortTransitionKind(observedRecord, record);
      assert(transitionKind !== undefined,
        "Central desired/observed Cohorts lack an explicit migration edge.");
      selectable = transitionKind === "upgrade"
        ? selectable
        : isDocsCohortSupportedForExistingBinding(
          registryState,
          lifecycle.supportUntilById.get(cohortId),
          Date.parse(asOf),
          record,
          repositoryId,
        );
    }
  }
  const supported = cohortId === observed && isDocsCohortSupportedForExistingBinding(
    registryState,
    lifecycle.supportUntilById.get(cohortId),
    Date.parse(asOf),
    record,
    repositoryId,
  );
  assert(selectable || supported,
    `Requested Cohort state ${registryState} is neither selectable nor supported for this repository.`);
}

function packagesFor(record) {
  const packages = new Map(record.packages.map((entry) => [entry.name, entry]));
  return MANAGED_PACKAGES.map((name) => {
    const value = packages.get(name);
    assert(value !== undefined && EXACT_VERSION.test(value.version) && SRI.test(value.integrity),
      `${name} Cohort package authority is invalid.`);
    return { name, version: value.version, integrity: value.integrity };
  });
}

export function managedStateDigest(body) {
  return sha256(canonicalJson({
    domain: "agent-teams.docs-protocol.managed-state/v1",
    body,
  }));
}

export function canonicalManagedProjection(profile, cohort, repositoryIdentity) {
  const derivedAssets = {
    ...cohort.assets,
    agentsRouteDigest: sha256(`<!-- agent-teams-docs:route/v1 begin -->\nUse [${profile.skillPath}](${profile.skillPath}) for documentation.\n<!-- agent-teams-docs:route/v1 end -->`),
    docsScriptsDigest: sha256(canonicalJson(Object.fromEntries(
      ["check", "doctor", "find", "info", "new", "recover"].map((command) => [
        `docs:${command}`,
        `agent-teams-docs ${command} --consumer . --profile ${profile.profilePath}`,
      ]),
    ))),
  };
  const body = {
    schemaVersion: 1,
    cohortId: cohort.cohortId,
    cohortAuthority: {
      channel: cohort.channel,
      recordDigest: cohort.recordDigest,
      qualificationEventDigest: cohort.qualificationEventDigest,
      eligibleAfter: cohort.eligibleAfter,
      upgradeFrom: cohort.upgradeFrom,
      rollbackTo: cohort.rollbackTo,
    },
    repository: repositoryIdentity,
    packages: cohort.packages,
    schemas: cohort.schemas,
    runtime: cohort.runtime,
    profilePath: profile.profilePath,
    skillPath: profile.skillPath,
    callerWorkflowPath: profile.callerWorkflowPath,
    managedStatePath: profile.managedStatePath,
    assets: derivedAssets,
  };
  return Object.freeze({
    ...body,
    stateDigest: managedStateDigest(body),
  });
}

export function trustedInstallWorkspaceConfig(expectedPackages) {
  assert(Array.isArray(expectedPackages) && expectedPackages.length === MANAGED_PACKAGES.length,
    "Trusted install must select exactly the managed Cohort packages.");
  const exactVersions = new Map(expectedPackages.map(({ name, version }) => [name, version]));
  assert(exactVersions.size === MANAGED_PACKAGES.length && MANAGED_PACKAGES.every((name) =>
    EXACT_VERSION.test(exactVersions.get(name) ?? "")),
  "Trusted install package exclusions must be exact managed package versions.");
  return [
    "packages: []",
    "minimumReleaseAgeExclude:",
    ...MANAGED_PACKAGES.map((name) => `  - '${name}@${exactVersions.get(name)}'`),
    "",
  ].join("\n");
}

function assertProjection(projection, profile, expected, repository) {
  const repositoryIdentity = {
    provider: "github",
    id: String(repository.id),
    nameWithOwner: repository.fullName,
  };

  assert(profile.schemaVersion === 1 && profile.integrationRoot === "." &&
    profile.packageManager === "pnpm" && profile.profilePath === "architecture/foundation/docs-protocol.yaml" &&
    profile.skillPath === ".agents/skills/docs-authoring/SKILL.md" &&
    profile.callerWorkflowPath === CALLER_WORKFLOW_PATH &&
    profile.managedStatePath === MANAGED_PROJECTION_PATH,
  "Consumer integration profile has a non-canonical managed topology.");
  assert(canonicalJson(profile.repository) === canonicalJson(repositoryIdentity),
    "Consumer integration profile repository identity is forged.");
  assert(canonicalJson(profile.cohort) === canonicalJson(expected.cohort),
    "Consumer integration profile differs from the exact central immutable Cohort projection.");

  const expectedManagedProjection = canonicalManagedProjection(
    profile,
    expected.cohort,
    repositoryIdentity,
  );
  assert(canonicalJson(projection) === canonicalJson(expectedManagedProjection),
    "Managed projection differs from the exact central immutable Cohort projection.");
}

function assertCallerWorkflow(workflow, source, expected) {
  assert(sha256(source) === expected.callerWorkflowDigest,
    "Caller workflow bytes differ from the Cohort-qualified rendered asset.");
  assert(exactKeys(workflow, ["name", "on", "permissions", "jobs"]) &&
    workflow.name === "Documentation Protocol" &&
    canonicalJson(workflow.permissions) === canonicalJson({ contents: "read", "id-token": "write" }) &&
    exactKeys(workflow.jobs, ["docs-protocol"]),
  "Caller workflow root is not the canonical inputless shape.");
  assert(exactKeys(workflow.on, ["merge_group", "pull_request", "push"]) &&
    workflow.on.pull_request === null && workflow.on.merge_group === null && workflow.on.push === null,
  "Caller workflow must use identical inputless PR, merge queue, and unfiltered push triggers.");
  const job = workflow.jobs["docs-protocol"];
  assert(exactKeys(job, ["uses"]) && job.uses ===
    `${expected.workflow.repository}/${expected.workflow.path}@${expected.workflow.revision}`,
  "Caller workflow must be inputless and bind the exact reusable workflow revision.");
}

function assertManifest(manifest, expectedPackages) {
  assert(/^pnpm@11\.[0-9]+\.[0-9]+$/u.test(manifest.packageManager ?? ""),
    "Consumer packageManager must pin pnpm 11 exactly.");
  const pnpm = manifest.pnpm;
  assert(!exactObject(pnpm) || !["overrides", "packageExtensions", "patchedDependencies"]
    .some((key) => Object.hasOwn(pnpm, key)),
  "Consumer package.json contains forbidden pnpm mutation policy.");
  assert(manifest.resolutions === undefined, "Consumer package.json contains forbidden resolutions.");
  for (const expected of expectedPackages) {
    assert(manifest.devDependencies?.[expected.name] === expected.version,
      `${expected.name} must be one exact root devDependency.`);
    for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      assert(manifest[section]?.[expected.name] === undefined,
        `${expected.name} must not appear in ${section}.`);
    }
  }
}

function managedEntries(container, name) {
  return ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
    .flatMap((section) => container?.[section]?.[name] === undefined ? [] : [container[section][name]]);
}

function assertNoForbiddenLockPolicy(value, path = "pnpm-lock.yaml") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenLockPolicy(entry, `${path}/${index}`));
    return;
  }
  if (!exactObject(value)) {return;}
  for (const [key, entry] of Object.entries(value)) {
    assert(!ALWAYS_FORBIDDEN_LOCK_KEYS.has(key), `${path} contains forbidden lock policy ${key}.`);
    assert(!ROOT_LOCK_POLICY_KEYS.has(key) || path === "pnpm-lock.yaml",
      `${path} contains nested lock policy ${key}.`);
    assertNoForbiddenLockPolicy(entry, `${path}/${key}`);
  }
}

function packageSelectorPart(value, label) {
  assert(typeof value === "string" && value.length > 0 && value.length <= 214,
    `${label} is not a bounded package selector.`);
  const separator = value.startsWith("@")
    ? value.indexOf("@", value.indexOf("/") + 1)
    : value.indexOf("@");
  const name = separator === -1 ? value : value.slice(0, separator);
  const range = separator === -1 ? null : value.slice(separator + 1);
  assert(PACKAGE_NAME.test(name) && (range === null || (range.length > 0 && !/[>\s]/u.test(range))),
    `${label} is not a supported package selector.`);
  return { name, range };
}

function overrideSelector(value) {
  assert(typeof value === "string" && value.split(">").length <= 2,
    `pnpm override selector ${String(value)} is not a supported single-edge selector.`);
  const parts = value.split(">");
  const child = packageSelectorPart(parts.at(-1), `pnpm override selector ${value}`);
  const parent = parts.length === 2
    ? packageSelectorPart(parts[0], `pnpm override parent ${value}`)
    : null;
  return { child, parent };
}

function locatorPackage(locator) {
  const separator = locator.startsWith("@")
    ? locator.indexOf("@", locator.indexOf("/") + 1)
    : locator.indexOf("@");
  assert(separator > 0, `Qualified runtime closure locator ${locator} is malformed.`);
  return {
    name: locator.slice(0, separator),
    version: locator.slice(separator + 1).split("(", 1)[0],
  };
}

function qualifiedVersionsByName(qualifiedRuntimeClosureLock) {
  const result = new Map();
  for (const locator of Object.keys(qualifiedRuntimeClosureLock?.packages ?? {})) {
    const { name, version } = locatorPackage(locator);
    const versions = result.get(name) ?? new Set();
    versions.add(version);
    result.set(name, versions);
  }
  return result;
}

function assertExactSecurityOverrides(workspace, lock, qualifiedRuntimeClosureLock) {
  const workspaceOverrides = workspace?.overrides;
  const lockOverrides = lock.overrides;
  assert((workspaceOverrides === undefined) === (lockOverrides === undefined),
    "pnpm overrides must be present identically in root workspace policy and lockfile metadata.");
  if (workspaceOverrides === undefined) {return;}
  assert(exactObject(workspaceOverrides) && exactObject(lockOverrides) &&
    Object.keys(workspaceOverrides).length <= 64 &&
    canonicalJson(workspaceOverrides) === canonicalJson(lockOverrides),
  "pnpm overrides must be one bounded exact root policy projection.");
  const qualifiedVersions = qualifiedVersionsByName(qualifiedRuntimeClosureLock);
  for (const [selector, target] of Object.entries(workspaceOverrides)) {
    const { child } = overrideSelector(selector);
    assert(!MANAGED_PACKAGES.includes(child.name),
      `pnpm override ${selector} must not target a managed Cohort package.`);
    assert(typeof target === "string" && EXACT_VERSION.test(target),
      `pnpm override ${selector} must select one exact registry version.`);
    const qualified = qualifiedVersions.get(child.name);
    assert(qualified === undefined || (qualified.size === 1 && qualified.has(target)),
      `pnpm override ${selector} changes a Cohort-qualified runtime package.`);
  }
}

function assertSafePackageExtensions(workspace, lock, qualifiedRuntimeClosureLock) {
  const extensions = workspace?.packageExtensions;
  const checksum = lock.packageExtensionsChecksum;
  assert((extensions === undefined) === (checksum === undefined),
    "pnpm package extensions must have one lockfile checksum projection.");
  if (extensions === undefined) {return;}
  assert(exactObject(extensions) && Object.keys(extensions).length <= 32 &&
    typeof checksum === "string" && PACKAGE_EXTENSION_CHECKSUM.test(checksum),
  "pnpm package extensions or their checksum exceed the safe policy shape.");
  const qualifiedNames = qualifiedVersionsByName(qualifiedRuntimeClosureLock);
  for (const [selector, extension] of Object.entries(extensions)) {
    const selected = packageSelectorPart(selector, `pnpm package extension selector ${selector}`);
    assert(!MANAGED_PACKAGES.includes(selected.name) && !qualifiedNames.has(selected.name),
      `pnpm package extension ${selector} must not target the qualified Docs runtime.`);
    assert(exactKeys(extension, ["peerDependencies"]) && exactObject(extension.peerDependencies) &&
      Object.keys(extension.peerDependencies).length <= 32,
    `pnpm package extension ${selector} may declare only bounded peerDependencies.`);
    for (const [name, range] of Object.entries(extension.peerDependencies)) {
      assert(PACKAGE_NAME.test(name) && !MANAGED_PACKAGES.includes(name) &&
        typeof range === "string" && range.length > 0 && range.length <= 128 &&
        !/[:/\\$]/u.test(range),
      `pnpm package extension ${selector} contains an unsafe peer dependency.`);
    }
  }
}

function assertSafeWorkspacePolicy(workspace, lock, qualifiedRuntimeClosureLock) {
  assert(workspace === undefined || exactObject(workspace), "pnpm-workspace.yaml must be one mapping.");
  assert(workspace?.patchedDependencies === undefined && workspace?.hooks === undefined,
    "pnpm workspace contains forbidden patches or hooks.");
  assertExactSecurityOverrides(workspace, lock, qualifiedRuntimeClosureLock);
  assertSafePackageExtensions(workspace, lock, qualifiedRuntimeClosureLock);
}

export function validateExactPnpmLock(manifest, lock, expectedPackages, options = {}) {
  assertNoForbiddenLockPolicy(lock);
  assert(exactObject(lock.importers) && exactObject(lock.importers["."]) && exactObject(lock.packages),
    "Consumer pnpm lockfile is missing its root importer or packages map.");
  const root = lock.importers["."];
  const rawByName = new Map();
  for (const expected of expectedPackages) {
    const rootValues = managedEntries(root, expected.name);
    assert(rootValues.length === 1 && exactObject(rootValues[0]),
      `${expected.name} root lock binding must be exact and unique.`);
    const binding = rootValues[0];
    assert(binding.specifier === expected.version && typeof binding.version === "string" &&
      !binding.version.startsWith("npm:") && binding.version.split("(", 1)[0] === expected.version,
    `${expected.name} root lock binding differs from its exact Cohort version.`);
    rawByName.set(expected.name, binding.version);
    for (const [importerName, importer] of Object.entries(lock.importers)) {
      if (importerName === ".") {continue;}
      assert(managedEntries(importer, expected.name).length === 0,
        `${expected.name} is forbidden in nested importer ${importerName}.`);
    }
    const physicalKey = `${expected.name}@${expected.version}`;
    const physicalKeys = Object.keys(lock.packages).filter((key) => key.startsWith(`${expected.name}@`));
    assert(physicalKeys.length === 1 && physicalKeys[0] === physicalKey,
      `${expected.name} must have one exact physical package resolution.`);
    assert(lock.packages[physicalKey]?.resolution?.integrity === expected.integrity,
      `${expected.name} physical resolution integrity differs from the Cohort.`);
    const snapshotKeys = Object.keys(lock.snapshots ?? {}).filter((key) => key.startsWith(`${expected.name}@`));
    assert(snapshotKeys.length === 1 && snapshotKeys[0] === `${expected.name}@${binding.version}`,
      `${expected.name} must have one root-bound physical snapshot.`);
  }
  const docsSnapshot = lock.snapshots?.[
    `@agent-teams/docs-protocol@${rawByName.get("@agent-teams/docs-protocol")}`
  ];
  const foundationRaw = rawByName.get("@agent-teams/engineering-foundation");
  assert(docsSnapshot?.dependencies?.["@agent-teams/engineering-foundation"] === foundationRaw,
    "Docs Protocol lock snapshot has the wrong exact Foundation dependency.");
  assertManifest(manifest, expectedPackages);
  assertSafeWorkspacePolicy(options.workspace, lock, options.qualifiedRuntimeClosureLock);
}

function assertRepositoryTree(paths) {
  assert(Array.isArray(paths) && paths.length <= 100_000, "Caller Git tree is missing or exceeds its safety bound.");
  const normalized = paths.map(({ path, type, mode }) => ({ path, type, mode }));
  const files = new Map(normalized.map((entry) => [entry.path, entry]));
  for (const required of [INTEGRATION_PROFILE_PATH, MANAGED_PROJECTION_PATH, CALLER_WORKFLOW_PATH,
    "package.json", "pnpm-lock.yaml"]) {
    const entry = files.get(required);
    assert(entry?.type === "blob" && entry.mode !== "120000", `${required} must be one regular committed file.`);
  }
  const workspace = files.get(PNPM_WORKSPACE_PATH);
  assert(workspace === undefined || (workspace.type === "blob" && workspace.mode !== "120000"),
    `${PNPM_WORKSPACE_PATH} must be one regular committed file when present.`);
  for (const { path } of normalized) {
    assert(path !== ".pnpmfile.cjs" && !path.endsWith("/.pnpmfile.cjs"),
      "Consumer tree contains forbidden .pnpmfile.cjs.");
    assert(path === "pnpm-lock.yaml" || !path.endsWith("/pnpm-lock.yaml"),
      `Consumer tree contains unsupported nested lockfile ${path}.`);
    assert(path === PNPM_WORKSPACE_PATH || !path.endsWith(`/${PNPM_WORKSPACE_PATH}`),
      `Consumer tree contains unsupported nested workspace policy ${path}.`);
  }
}

export function authorizeConsumerGate(input) {
  const workflow = input.workflowIdentity;
  assert(SHA.test(input.callerSha) && SHA.test(input.controllerSnapshotSha),
    "Caller or controller snapshot is not an immutable commit SHA.");
  assert(workflow.repository === CONTROLLER_REPOSITORY && workflow.filePath === REUSABLE_WORKFLOW_PATH &&
    SHA.test(workflow.sha) && workflow.ref === `${workflow.repository}/${workflow.filePath}@${workflow.sha}`,
  "Called reusable workflow identity is not the exact trusted controller workflow.");
  if (input.policySchema !== undefined) {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(input.policySchema);
    assert(validate(input.policy), `Central Docs policy schema validation failed: ${(validate.errors ?? [])
      .map(({ instancePath, message }) => `${instancePath || "/"} ${message}`).join("; ")}`);
  }
  if (input.exceptions !== undefined && input.exceptionsSchema !== undefined) {
    validateDocsProtocolExceptions(input.exceptions, input.exceptionsSchema, {
      asOf: input.asOf.slice(0, 10),
    });
  }
  const lifecycle = validateDocsQualifiedCohorts(input.registry, input.registrySchema ?? {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
  }, { asOf: input.asOf });
  const policyEntry = input.policy.repositories.find(({ repository_id: id }) => id === input.repository.id);
  assertRepositoryAuthority(policyEntry, input.repository);
  assertRepositoryTree(input.tree);

  const managed = parseJsonStrict(input.files[MANAGED_PROJECTION_PATH], MANAGED_PROJECTION_PATH,
    JSON_LIMITS[MANAGED_PROJECTION_PATH]);
  const profile = parseJsonStrict(input.files[INTEGRATION_PROFILE_PATH], INTEGRATION_PROFILE_PATH,
    JSON_LIMITS[INTEGRATION_PROFILE_PATH]);
  const manifest = parseJsonStrict(input.files["package.json"], "package.json", JSON_LIMITS["package.json"]);
  const lock = parseYamlStrict(input.files["pnpm-lock.yaml"], "pnpm-lock.yaml", LOCKFILE_LIMIT);
  const workspace = input.files[PNPM_WORKSPACE_PATH] === undefined
    ? undefined
    : parseYamlStrict(input.files[PNPM_WORKSPACE_PATH], PNPM_WORKSPACE_PATH, WORKSPACE_LIMIT);
  const callerSource = input.files[CALLER_WORKFLOW_PATH];
  const caller = parseYamlStrict(callerSource, CALLER_WORKFLOW_PATH, CALLER_LIMIT);
  const record = lifecycle.cohortById.get(managed.cohortId);
  assert(record !== undefined, "Managed projection selects an unknown central Cohort.");
  const state = lifecycle.stateById.get(record.cohort_id);
  stateFor(lifecycle, policyEntry, record, input.repository.id, input.asOf);
  if (["QUALIFIED", "CANARY"].includes(state)) {
    assert(record.canary_repositories.some(({ repository_id: id }) => id === input.repository.id),
      "Pre-recommendation Cohort is restricted to its exact canary repository IDs.");
  }
  assert(record.reusable_workflow.revision === workflow.sha && record.reusable_workflow.path === workflow.filePath &&
    record.reusable_workflow.repository === workflow.repository,
  "Cohort reusable workflow authority differs from the executing job identity.");
  assert(input.calledWorkflowBlobSha === record.reusable_workflow.blob_sha,
    "Executing workflow blob differs from the Cohort authority.");

  const qualification = lifecycle.qualificationEventById.get(record.cohort_id);
  assert(qualification !== undefined, "Requested Cohort never reached QUALIFIED.");
  const packageByName = new Map(record.packages.map((entry) => [entry.name, entry]));
  if (policyEntry.observed_cohort_id === record.cohort_id) {
    assert(policyEntry.observed_cohort_record_digest === undefined ||
      policyEntry.observed_cohort_record_digest === record.record_digest,
    "Central observed repository state has the wrong Cohort record digest.");
    assert(policyEntry.observed_cohort_event_digest === undefined ||
      policyEntry.observed_cohort_event_digest === qualification.event_digest,
    "Central observed repository state has the wrong QUALIFIED event digest.");
    assert(policyEntry.exact_package_version === undefined ||
      policyEntry.exact_package_version === packageByName.get("@agent-teams/docs-protocol")?.version,
    "Central observed repository state has the wrong Docs Protocol version.");
    assert(policyEntry.exact_foundation_version === undefined ||
      policyEntry.exact_foundation_version === packageByName.get("@agent-teams/engineering-foundation")?.version,
    "Central observed repository state has the wrong Foundation version.");
    assert(policyEntry.reusable_workflow_revision === undefined ||
      policyEntry.reusable_workflow_revision === record.reusable_workflow.revision,
    "Central observed repository state has the wrong reusable workflow revision.");
  }
  const cohortProjection = {
    schemaVersion: 1,
    cohortId: record.cohort_id,
    channel: record.channel,
    recordDigest: record.record_digest,
    qualificationEventDigest: qualification.event_digest,
    eligibleAfter: record.eligible_after,
    upgradeFrom: record.upgrade_from,
    rollbackTo: record.rollback_to,
    packages: {
      docsProtocol: {
        version: packageByName.get("@agent-teams/docs-protocol")?.version,
        integrity: packageByName.get("@agent-teams/docs-protocol")?.integrity,
      },
      engineeringFoundation: {
        version: packageByName.get("@agent-teams/engineering-foundation")?.version,
        integrity: packageByName.get("@agent-teams/engineering-foundation")?.integrity,
      },
    },
    workflow: {
      repository: record.reusable_workflow.repository,
      path: record.reusable_workflow.path,
      revision: record.reusable_workflow.revision,
      blobSha: record.reusable_workflow.blob_sha,
    },
    assets: {
      skillDigest: record.assets.skill.digest,
      callerWorkflowDigest: record.assets.caller_workflow.rendered_digest,
      assetCatalogDigest: record.assets.asset_catalog.digest,
      transitionCatalogDigest: record.assets.transition_catalog.digest,
    },
    schemas: {
      consumerIntegration: record.schemas.consumer_integration,
      managedState: record.schemas.managed_state,
      docsProtocol: record.schemas.docs_protocol,
    },
    runtime: {
      node: record.runtime.node,
      pnpm: record.runtime.pnpm,
      runtimeClosureDigest: record.runtime_closure.digest,
    },
  };
  const expectedPackages = packagesFor(record);
  const expected = {
    cohort: cohortProjection,
    callerWorkflowDigest: cohortProjection.assets.callerWorkflowDigest,
    workflow: cohortProjection.workflow,
  };
  assertProjection(managed, profile, expected, input.repository);
  assert(policyEntry.profile_path === profile.profilePath &&
    policyEntry.caller_workflow_path === profile.callerWorkflowPath,
  "Consumer profile/caller paths differ from central repository authority.");
  assertCallerWorkflow(caller, callerSource, expected);
  const runtimeClosureSource = input.runtimeClosureSources?.[record.runtime_closure.projection_path];
  assert(typeof runtimeClosureSource === "string" &&
    sha256(runtimeClosureSource) === record.runtime_closure.digest,
  "Qualified runtime closure evidence is missing or has the wrong content digest.");
  const runtimeClosureEvidence = parseJsonStrict(
    runtimeClosureSource,
    record.runtime_closure.projection_path,
    2 * 1024 * 1024,
  );
  const regeneratedRuntimeClosure = docsRuntimeClosureEvidence(
    runtimeClosureEvidence.pnpmLock,
    expectedPackages,
  );
  assert(regeneratedRuntimeClosure.source === runtimeClosureSource &&
    canonicalJson(regeneratedRuntimeClosure.authority) === canonicalJson(record.runtime_closure),
  "Qualified runtime closure evidence is not the canonical exact Cohort projection.");
  validateExactPnpmLock(manifest, lock, expectedPackages, {
    workspace,
    qualifiedRuntimeClosureLock: runtimeClosureEvidence.pnpmLock,
  });
  return Object.freeze({
    schemaVersion: 1,
    repositoryId: input.repository.id,
    repository: input.repository.fullName,
    callerSha: input.callerSha,
    controllerSnapshotSha: input.controllerSnapshotSha,
    workflowIdentity: workflow,
    cohortId: record.cohort_id,
    profilePath: profile.profilePath,
    expectedPackages,
    expectedRuntimeClosure: record.runtime_closure,
    expectedRuntimeClosureLock: runtimeClosureEvidence.pnpmLock,
    controllerDataDigests: Object.fromEntries(Object.entries(input.controllerDataSources ?? {})
      .map(([path, source]) => [path, sha256(source)])),
    fileDigests: Object.fromEntries(Object.entries(input.files).map(([path, source]) => [path, sha256(source)])),
  });
}

function authorizationDigest(authorization) {
  return sha256(canonicalJson({ domain: "agent-teams.docs-consumer-gate-authorization/v1", body: authorization }));
}

async function githubJson(path, token) {
  let response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "agent-teams-docs-consumer-gate/1",
        "x-github-api-version": "2022-11-28",
      },
    });
  } catch (error) {
    throw new GateInfrastructureError(`GitHub API ${path} could not be reached.`, { cause: error });
  }
  if (!response.ok) {
    const transient = response.status === 408 || response.status === 429 || response.status >= 500 ||
      (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
    const ErrorType = transient ? GateInfrastructureError : GatePolicyError;
    throw new ErrorType(`GitHub API ${path} failed with ${response.status}.`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new GateInfrastructureError(`GitHub API ${path} returned invalid JSON.`, { cause: error });
  }
}

async function fetchBlob(repository, sha, token, limit, label) {
  const blob = await githubJson(`/repos/${repository}/git/blobs/${sha}`, token);
  assert(blob.encoding === "base64" && typeof blob.content === "string", `${label} is not a base64 Git blob.`);
  const bytes = Buffer.from(blob.content.replaceAll("\n", ""), "base64");
  assert(bytes.length <= limit, `${label} exceeds its ${limit}-byte safety bound.`);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new GatePolicyError(`${label} is not valid UTF-8.`);
  }
}

async function fetchRepositoryText(repository, path, ref, token, limit, label) {
  const response = await githubJson(`/repos/${repository}/contents/${path}?ref=${ref}`, token);
  assert(!Array.isArray(response) && response.type === "file" && response.encoding === "base64" &&
    typeof response.content === "string" && SHA.test(response.sha ?? ""),
  `${label} is not one immutable base64 repository file.`);
  const bytes = Buffer.from(response.content.replaceAll("\n", ""), "base64");
  assert(bytes.length <= limit, `${label} exceeds its ${limit}-byte safety bound.`);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new GatePolicyError(`${label} is not valid UTF-8.`);
  }
}

async function authorizeCommand() {
  const root = process.env.TRUSTED_GOVERNANCE_ROOT;
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const callerSha = process.env.GITHUB_SHA;
  assert(root && token && repository && SHA.test(callerSha ?? ""), "Gate authorization environment is incomplete.");
  const metadata = await githubJson(`/repos/${repository}`, token);
  assert(metadata.id === Number(process.env.CALLER_REPOSITORY_ID) && metadata.full_name === repository,
    "Live caller repository identity differs from the workflow context.");
  const tree = await githubJson(`/repos/${repository}/git/trees/${callerSha}?recursive=1`, token);
  assert(tree.truncated === false && Array.isArray(tree.tree), "Caller Git tree response is truncated or invalid.");
  const entryByPath = new Map(tree.tree.map((entry) => [entry.path, entry]));
  const limits = {
    ...JSON_LIMITS,
    [CALLER_WORKFLOW_PATH]: CALLER_LIMIT,
    "pnpm-lock.yaml": LOCKFILE_LIMIT,
  };
  if (entryByPath.has(PNPM_WORKSPACE_PATH)) {
    limits[PNPM_WORKSPACE_PATH] = WORKSPACE_LIMIT;
  }
  const files = {};
  for (const [path, limit] of Object.entries(limits)) {
    const entry = entryByPath.get(path);
    assert(entry?.type === "blob" && entry.mode !== "120000" && SHA.test(entry.sha),
      `${path} is not one regular file at the caller SHA.`);
    files[path] = await fetchBlob(repository, entry.sha, token, limit, path);
  }
  const workflowSource = await fetchRepositoryText(
    CONTROLLER_REPOSITORY,
    REUSABLE_WORKFLOW_PATH,
    process.env.JOB_WORKFLOW_SHA,
    token,
    256 * 1024,
    "called reusable workflow",
  );
  const controllerDataSources = Object.fromEntries(await Promise.all(
    CURRENT_CONTROLLER_DATA_PATHS.map(async (path) => [path, await fetchRepositoryText(
      CONTROLLER_REPOSITORY,
      path,
      process.env.CONTROLLER_SNAPSHOT_SHA,
      token,
      4 * 1024 * 1024,
      `current controller data ${path}`,
    )]),
  ));
  const [registrySchemaSource, policySchemaSource, exceptionsSchemaSource] = await Promise.all([
    readFile(join(root, "governance/docs-qualified-cohorts.schema.json"), "utf8"),
    readFile(join(root, "governance/docs-protocol-policy.schema.json"), "utf8"),
    readFile(join(root, "governance/docs-protocol-exceptions.schema.json"), "utf8"),
  ]);
  const registry = parseJsonStrict(controllerDataSources["governance/docs-qualified-cohorts.json"],
    "central Cohort registry", 4 * 1024 * 1024);
  const managedProjection = parseJsonStrict(files[MANAGED_PROJECTION_PATH],
    MANAGED_PROJECTION_PATH, JSON_LIMITS[MANAGED_PROJECTION_PATH]);
  const runtimeClosurePath = registry.cohorts.find(
    ({ cohort_id: cohortId }) => cohortId === managedProjection.cohortId,
  )?.runtime_closure?.projection_path;
  assert(typeof runtimeClosurePath === "string",
    "Managed Cohort has no central runtime closure evidence path.");
  const runtimeClosureSource = await fetchRepositoryText(
    CONTROLLER_REPOSITORY,
    runtimeClosurePath,
    process.env.CONTROLLER_SNAPSHOT_SHA,
    token,
    2 * 1024 * 1024,
    "qualified runtime closure evidence",
  );
  const authorization = authorizeConsumerGate({
    registry,
    registrySchema: parseJsonStrict(registrySchemaSource, "central Cohort schema", 4 * 1024 * 1024),
    policy: parseJsonStrict(controllerDataSources["governance/docs-protocol-policy.json"],
      "central Docs policy", 4 * 1024 * 1024),
    policySchema: parseJsonStrict(policySchemaSource, "central Docs policy schema", 4 * 1024 * 1024),
    exceptions: parseJsonStrict(controllerDataSources["governance/docs-protocol-exceptions.json"],
      "central Docs exceptions", 4 * 1024 * 1024),
    exceptionsSchema: parseJsonStrict(exceptionsSchemaSource,
      "central Docs exceptions schema", 4 * 1024 * 1024),
    controllerDataSources,
    runtimeClosureSources: { [runtimeClosurePath]: runtimeClosureSource },
    repository: {
      id: metadata.id,
      fullName: metadata.full_name,
      defaultBranch: metadata.default_branch,
    },
    workflowIdentity: {
      sha: process.env.JOB_WORKFLOW_SHA,
      ref: process.env.JOB_WORKFLOW_REF,
      repository: process.env.JOB_WORKFLOW_REPOSITORY,
      filePath: process.env.JOB_WORKFLOW_FILE_PATH,
    },
    calledWorkflowBlobSha: gitBlobSha(Buffer.from(workflowSource, "utf8")),
    callerSha,
    controllerSnapshotSha: process.env.CONTROLLER_SNAPSHOT_SHA,
    tree: tree.tree,
    files,
    asOf: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
  });
  const envelope = { authorization, authorizationDigest: authorizationDigest(authorization) };
  await writeFile(process.env.AUTHORIZATION_PATH, `${canonicalJson(envelope)}\n`, { mode: 0o600 });
  console.log(`Authorized ${authorization.repository} at ${authorization.callerSha} for ${authorization.cohortId}.`);
}

async function readAuthorization() {
  const source = await readFile(process.env.AUTHORIZATION_PATH, "utf8");
  const envelope = parseJsonStrict(source, "gate authorization", 4 * 1024 * 1024);
  assert(envelope.authorizationDigest === authorizationDigest(envelope.authorization),
    "Gate authorization digest is invalid.");
  return envelope.authorization;
}

async function verifyCheckoutCommand() {
  const authorization = await readAuthorization();
  const checkout = resolve(process.env.CONSUMER_CHECKOUT);
  assert(authorization.repositoryId === Number(process.env.CALLER_REPOSITORY_ID) &&
    authorization.repository === process.env.GITHUB_REPOSITORY && authorization.callerSha === process.env.GITHUB_SHA,
  "Checkout verification context differs from the authorization.");
  for (const [path, digest] of Object.entries(authorization.fileDigests)) {
    const absolute = resolve(checkout, path);
    assert(absolute.startsWith(`${checkout}${sep}`), `Authorized path ${path} escapes the checkout.`);
    const stat = await lstat(absolute);
    assert(stat.isFile() && !stat.isSymbolicLink(), `${path} is not a regular checkout file.`);
    assert(sha256(await readFile(absolute)) === digest, `${path} changed after central authorization.`);
  }
  console.log("Consumer checkout matches the centrally authorized immutable caller snapshot.");
}

async function verifyControllerSnapshotCommand() {
  const authorization = await readAuthorization();
  const token = process.env.GITHUB_TOKEN;
  assert(typeof token === "string" && token.length > 0,
    "Controller stability verification lacks a GitHub token.");
  const controller = await githubJson(`/repos/${CONTROLLER_REPOSITORY}`, token);
  assert(controller.id === 1316243981 && controller.full_name === CONTROLLER_REPOSITORY &&
    !controller.archived && !controller.disabled,
  "Live controller repository identity changed after authorization.");
  const branch = await githubJson(
    `/repos/${CONTROLLER_REPOSITORY}/branches/${encodeURIComponent(controller.default_branch)}`,
    token,
  );
  if (branch.commit?.sha !== authorization.controllerSnapshotSha) {
    throw new GateInfrastructureError(
      "Current controller authority moved during this run; retry against one fresh snapshot."
    );
  }
  console.log("Current controller data authority remained on the authorized exact snapshot.");
}

async function prepareInstallCommand() {
  const authorization = await readAuthorization();
  const directory = resolve(process.env.TRUSTED_INSTALL_ROOT);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const devDependencies = Object.fromEntries(authorization.expectedPackages.map(({ name, version }) => [name, version]));
  await Promise.all([
    writeFile(join(directory, "package.json"), `${JSON.stringify({
      name: "agent-teams-docs-trusted-gate",
      version: "0.0.0",
      private: true,
      packageManager: "pnpm@11.18.0",
      devDependencies,
    }, null, 2)}\n`, { mode: 0o600 }),
    writeFile(join(directory, ".npmrc"), [
      "registry=https://registry.npmjs.org/",
      "@agent-teams:registry=https://registry.npmjs.org/",
      "ignore-scripts=true",
      "verify-store-integrity=true",
      "strict-peer-dependencies=true",
      "",
    ].join("\n"), { mode: 0o600 }),
    writeFile(join(directory, "pnpm-workspace.yaml"),
      trustedInstallWorkspaceConfig(authorization.expectedPackages), { mode: 0o600 }),
    writeFile(join(directory, "pnpm-lock.yaml"),
      `${canonicalJson(authorization.expectedRuntimeClosureLock)}\n`, { mode: 0o600 }),
  ]);
}

async function verifyInstallCommand() {
  const authorization = await readAuthorization();
  const directory = resolve(process.env.TRUSTED_INSTALL_ROOT);
  const manifest = parseJsonStrict(await readFile(join(directory, "package.json"), "utf8"),
    "trusted install package.json", JSON_LIMITS["package.json"]);
  const lock = parseYamlStrict(await readFile(join(directory, "pnpm-lock.yaml"), "utf8"),
    "trusted install pnpm-lock.yaml", LOCKFILE_LIMIT);
  validateExactPnpmLock(manifest, lock, authorization.expectedPackages);
  assert(canonicalJson(docsRuntimeClosureAuthority(lock, authorization.expectedPackages)) ===
    canonicalJson(authorization.expectedRuntimeClosure),
  "Trusted install runtime closure differs from the qualified Cohort authority.");
  for (const expected of authorization.expectedPackages) {
    const installed = parseJsonStrict(await readFile(join(directory, "node_modules", expected.name, "package.json"), "utf8"),
      `${expected.name} installed package.json`, JSON_LIMITS["package.json"]);
    assert(installed.name === expected.name && installed.version === expected.version,
      `${expected.name} installed identity differs from the authorized Cohort.`);
  }
  const docs = authorization.expectedPackages.find(({ name }) => name === "@agent-teams/docs-protocol");
  const foundation = authorization.expectedPackages.find(({ name }) => name === "@agent-teams/engineering-foundation");
  const docsManifest = parseJsonStrict(await readFile(join(directory, "node_modules", docs.name, "package.json"), "utf8"),
    "installed Docs Protocol package.json", JSON_LIMITS["package.json"]);
  assert(docsManifest.dependencies?.[foundation.name] === foundation.version,
    "Installed Docs Protocol has the wrong exact Foundation dependency.");
  const cli = await realpath(join(directory, "node_modules", docs.name, "dist", "cli.js"));
  const packageRoot = await realpath(join(directory, "node_modules", docs.name));
  assert(cli.startsWith(`${packageRoot}${sep}`) && (await lstat(cli)).isFile(),
    "Trusted Docs CLI does not resolve to a regular file inside the exact package.");
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT,
      `cli=${cli}\nprofile_path=${authorization.profilePath}\n`, { flag: "a" });
  }
  console.log("Trusted isolated Docs Protocol installation matches the Cohort.");
}

async function verifyInstallLockCommand() {
  const authorization = await readAuthorization();
  const directory = resolve(process.env.TRUSTED_INSTALL_ROOT);
  const manifest = parseJsonStrict(await readFile(join(directory, "package.json"), "utf8"),
    "trusted install package.json", JSON_LIMITS["package.json"]);
  const lock = parseYamlStrict(await readFile(join(directory, "pnpm-lock.yaml"), "utf8"),
    "trusted install pnpm-lock.yaml", LOCKFILE_LIMIT);
  validateExactPnpmLock(manifest, lock, authorization.expectedPackages,
    authorization.expectedRuntimeClosure);
  console.log("Trusted isolated install lock matches the exact Cohort before package execution.");
}

const isEntrypoint = process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  const commands = new Map([
    ["authorize", authorizeCommand],
    ["verify-checkout", verifyCheckoutCommand],
    ["verify-controller-snapshot", verifyControllerSnapshotCommand],
    ["prepare-install", prepareInstallCommand],
    ["verify-install-lock", verifyInstallLockCommand],
    ["verify-install", verifyInstallCommand],
  ]);
  const command = commands.get(process.argv[2]);
  if (command === undefined) {
    console.error("Usage: verify-docs-consumer-gate.mjs <authorize|verify-checkout|verify-controller-snapshot|prepare-install|verify-install-lock|verify-install>");
    process.exitCode = 2;
  } else {
    try {
      await command();
    } catch (error) {
      console.error(`${gateErrorCode(error)}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}
