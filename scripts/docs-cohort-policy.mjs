import { createHash } from "node:crypto";

import Ajv2020 from "ajv/dist/2020.js";

const TERMINAL_STATES = new Set(["SUPPORT_ENDED", "WITHDRAWN"]);
const BLOCKED_STATES = new Set(["SUPPORT_ENDED", "SUSPENDED", "WITHDRAWN"]);
const RUNTIME_CLOSURE_PACKAGE_MANAGER = "pnpm@11.18.0";
const RUNTIME_CLOSURE_LOCKFILE_VERSION = "9.0";
const RUNTIME_CLOSURE_MAX_PACKAGES = 2048;
const RUNTIME_CLOSURE_MAX_DEPTH = 64;
const RUNTIME_CLOSURE_MAX_BYTES = 2 * 1024 * 1024;
const REGISTRY_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u;
const SHA512_SRI = /^sha512-[A-Za-z0-9+/]{86}==$/u;
const NEXT_STATES = new Map([
  ["PUBLISHED_UNQUALIFIED", new Set(["VERIFIED", "WITHDRAWN"])],
  ["VERIFIED", new Set(["COOLDOWN", "QUALIFIED", "WITHDRAWN"])],
  ["COOLDOWN", new Set(["QUALIFIED", "WITHDRAWN"])],
  ["QUALIFIED", new Set(["CANARY", "SUSPENDED", "WITHDRAWN"])],
  ["CANARY", new Set(["RECOMMENDED", "SUSPENDED", "WITHDRAWN"])],
  ["RECOMMENDED", new Set(["SUPERSEDED", "SUSPENDED", "WITHDRAWN"])],
  ["SUPERSEDED", new Set(["SUPPORT_ENDED", "SUSPENDED", "WITHDRAWN"])],
  ["SUSPENDED", new Set(["WITHDRAWN"])]
]);

function assert(condition, message) {
  if (!condition) {throw new Error(message);}
}

function validateSchema(value, schema, label) {
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (validate(value)) {return;}
  const details = (validate.errors ?? [])
    .map(({ instancePath, message }) => `${instancePath || "/"} ${message}`)
    .join("; ");
  throw new Error(`${label} does not satisfy its JSON Schema: ${details}`);
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    assert(Number.isSafeInteger(value), "Cohort canonical JSON supports only safe integers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  assert(typeof value === "object" && value !== undefined, "Cohort value is not canonical JSON.");
  return `{${Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}

function digest(domain, body) {
  return `sha256:${createHash("sha256")
    .update(canonicalJson({ domain, body }))
    .digest("hex")}`;
}

function dependencyBinding(container, name) {
  return ["dependencies", "devDependencies", "optionalDependencies"]
    .flatMap((section) => container?.[section]?.[name] === undefined ? [] : [container[section][name]]);
}

function registrySnapshotLocator(name, raw, label) {
  assert(typeof raw === "string" && raw.length <= 1024 && !/[\s\\:#]/u.test(raw),
    `${label} is not one bounded registry resolution.`);
  const version = raw.split("(", 1)[0];
  assert(REGISTRY_VERSION.test(version) && !raw.startsWith("npm:"),
    `${label} uses a non-registry or aliased resolution.`);
  return `${name}@${raw}`;
}

function sortedEdges(snapshot, section, label) {
  const source = snapshot?.[section] ?? {};
  assert(source !== null && typeof source === "object" && !Array.isArray(source),
    `${label} ${section} must be one dependency map.`);
  return Object.entries(source)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([name, raw]) => ({
      name,
      locator: registrySnapshotLocator(name, raw, `${label} ${section}.${name}`),
    }));
}

export function docsRuntimeClosureProjection(lock, expectedPackages) {
  assert(lock !== null && typeof lock === "object" && !Array.isArray(lock) &&
    String(lock.lockfileVersion) === RUNTIME_CLOSURE_LOCKFILE_VERSION &&
    lock.importers !== null && typeof lock.importers === "object" &&
    lock.packages !== null && typeof lock.packages === "object" &&
    lock.snapshots !== null && typeof lock.snapshots === "object",
  "Runtime closure requires one pnpm lockfile v9 with importers, packages, and snapshots.");
  const root = lock.importers["."];
  assert(root !== null && typeof root === "object" && !Array.isArray(root),
    "Runtime closure lockfile is missing its root importer.");
  assert(Array.isArray(expectedPackages) && expectedPackages.length === 2,
    "Runtime closure requires the exact two-package Cohort root.");

  const roots = expectedPackages.map((entry) => {
    const bindings = dependencyBinding(root, entry.name);
    assert(bindings.length === 1 && bindings[0] !== null && typeof bindings[0] === "object" &&
      bindings[0].specifier === entry.version && typeof bindings[0].version === "string",
    `${entry.name} runtime closure root binding is not exact.`);
    const locator = registrySnapshotLocator(entry.name, bindings[0].version,
      `${entry.name} runtime closure root`);
    assert(locator.split("(", 1)[0] === `${entry.name}@${entry.version}`,
      `${entry.name} runtime closure root version differs from the Cohort.`);
    const packageEntry = lock.packages[`${entry.name}@${entry.version}`];
    assert(packageEntry?.resolution?.integrity === entry.integrity,
      `${entry.name} runtime closure root integrity differs from the Cohort.`);
    return { name: entry.name, locator };
  }).sort(({ name: left }, { name: right }) => left < right ? -1 : left > right ? 1 : 0);

  const pending = roots.map(({ locator }) => ({ locator, depth: 0 }));
  const visited = new Set();
  const packages = [];
  while (pending.length > 0) {
    const { locator, depth } = pending.shift();
    if (visited.has(locator)) {continue;}
    assert(depth <= RUNTIME_CLOSURE_MAX_DEPTH,
      `Runtime closure exceeds maximum dependency depth ${RUNTIME_CLOSURE_MAX_DEPTH}.`);
    visited.add(locator);
    assert(visited.size <= RUNTIME_CLOSURE_MAX_PACKAGES,
      `Runtime closure exceeds maximum package count ${RUNTIME_CLOSURE_MAX_PACKAGES}.`);
    const physicalLocator = locator.split("(", 1)[0];
    const packageEntry = lock.packages[physicalLocator];
    const snapshot = lock.snapshots[locator];
    assert(packageEntry !== null && typeof packageEntry === "object" && !Array.isArray(packageEntry) &&
      snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot),
    `Runtime closure locator ${locator} is missing its package or snapshot.`);
    const integrity = packageEntry.resolution?.integrity;
    assert(SHA512_SRI.test(integrity ?? ""),
      `Runtime closure locator ${locator} has no exact registry SRI.`);
    const dependencies = sortedEdges(snapshot, "dependencies", locator);
    const optionalDependencies = sortedEdges(snapshot, "optionalDependencies", locator);
    const edgeByName = new Map();
    for (const edge of [...dependencies, ...optionalDependencies]) {
      const prior = edgeByName.get(edge.name);
      assert(prior === undefined || prior === edge.locator,
        `Runtime closure locator ${locator} has ambiguous dependency ${edge.name}.`);
      edgeByName.set(edge.name, edge.locator);
      pending.push({ locator: edge.locator, depth: depth + 1 });
    }
    packages.push({ locator, integrity, dependencies, optionalDependencies });
  }
  packages.sort(({ locator: left }, { locator: right }) => left < right ? -1 : left > right ? 1 : 0);
  const projection = {
    schemaVersion: 1,
    packageManager: RUNTIME_CLOSURE_PACKAGE_MANAGER,
    lockfileVersion: RUNTIME_CLOSURE_LOCKFILE_VERSION,
    packageCount: packages.length,
    roots,
    packages,
  };
  assert(Buffer.byteLength(canonicalJson(projection), "utf8") <= RUNTIME_CLOSURE_MAX_BYTES,
    `Runtime closure projection exceeds ${RUNTIME_CLOSURE_MAX_BYTES} bytes.`);
  return projection;
}

export function docsRuntimeClosureAuthority(lock, expectedPackages) {
  return docsRuntimeClosureEvidence(lock, expectedPackages).authority;
}

export function docsRuntimeClosureEvidence(lock, expectedPackages) {
  const projection = docsRuntimeClosureProjection(lock, expectedPackages);
  const physicalLocators = [...new Set(projection.packages.map(({ locator }) => locator.split("(", 1)[0]))]
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const pnpmLock = {
    lockfileVersion: RUNTIME_CLOSURE_LOCKFILE_VERSION,
    settings: { autoInstallPeers: true, excludeLinksFromLockfile: false },
    importers: { ".": { devDependencies: Object.fromEntries(projection.roots.map(({ name, locator }) => [
      name,
      {
        specifier: expectedPackages.find((entry) => entry.name === name).version,
        version: locator.slice(`${name}@`.length),
      },
    ])) } },
    packages: Object.fromEntries(physicalLocators.map((locator) => [locator, lock.packages[locator]])),
    snapshots: Object.fromEntries(projection.packages.map(({ locator }) => [locator, lock.snapshots[locator]])),
  };
  const evidence = {
    domain: "agent-teams.docs-runtime-closure/v1",
    schemaVersion: 1,
    packageManager: RUNTIME_CLOSURE_PACKAGE_MANAGER,
    packageCount: projection.packageCount,
    pnpmLock,
  };
  const source = `${canonicalJson(evidence)}\n`;
  assert(Buffer.byteLength(source, "utf8") <= RUNTIME_CLOSURE_MAX_BYTES,
    `Runtime closure evidence exceeds ${RUNTIME_CLOSURE_MAX_BYTES} bytes.`);
  const contentDigest = `sha256:${createHash("sha256").update(source).digest("hex")}`;
  return {
    evidence,
    source,
    authority: {
      schema_version: projection.schemaVersion,
      package_manager: projection.packageManager,
      lockfile_version: projection.lockfileVersion,
      package_count: projection.packageCount,
      projection_path: `governance/docs-runtime-closures/${contentDigest.replace(":", "-")}.json`,
      digest: contentDigest,
    },
  };
}

function timestampMilliseconds(value, label) {
  const milliseconds = Date.parse(value);
  assert(Number.isFinite(milliseconds), `${label} must be a real UTC timestamp.`);
  assert(new Date(milliseconds).toISOString().replace(".000", "") === value,
    `${label} must use canonical UTC seconds.`);
  return milliseconds;
}

export function cohortRecordDigest(record) {
  const { record_digest: _ignored, ...body } = record;
  return digest("agent-teams.docs-qualified-cohort/v1", body);
}

export function cohortEventDigest(event) {
  const { event_digest: _ignored, ...body } = event;
  return digest("agent-teams.docs-qualified-cohort-event/v1", body);
}

function validateCohortRecord(record) {
  assert(record.record_digest === cohortRecordDigest(record), `${record.cohort_id} record digest is invalid.`);
  assert(record.runtime_closure.projection_path ===
    `governance/docs-runtime-closures/${record.runtime_closure.digest.replace(":", "-")}.json`,
  `${record.cohort_id} runtime closure path is not content-addressed by its exact digest.`);
  assert(
    record.packages[0].name === "@agent-teams/engineering-foundation" &&
      record.packages[1].name === "@agent-teams/docs-protocol",
    `${record.cohort_id} package order must preserve the release dependency order.`
  );
  const publishedTimes = record.packages.map((entry) => timestampMilliseconds(
    entry.published_at,
    `${record.cohort_id} ${entry.name} published_at`,
  ));
  assert(publishedTimes[0] <= publishedTimes[1],
    `${record.cohort_id} Foundation must be published no later than Docs Protocol.`);
  const assetPaths = Object.values(record.assets).map((asset) => asset.path);
  assert(new Set(assetPaths).size === assetPaths.length,
    `${record.cohort_id} published asset paths must be unique.`);
  const canaryIds = record.canary_repositories.map(({ repository_id: id }) => id);
  const canaryNames = record.canary_repositories.map(({ repository }) => repository);
  assert(new Set(canaryIds).size === canaryIds.length &&
    new Set(canaryNames).size === canaryNames.length,
  `${record.cohort_id} immutable canary repository identities must be unique.`);
  for (const entry of record.packages) {
    assert(entry.provenance.source_repository_id === 1316243988,
      `${record.cohort_id} ${entry.name} source repository ID is not the immutable producer.`);
    const encodedName = entry.name.replace("/", "%2f");
    assert(entry.provenance.registry_attestation_url ===
      `https://registry.npmjs.org/-/npm/v1/attestations/${encodedName}@${entry.version}`,
    `${record.cohort_id} ${entry.name} attestation URL does not bind its exact package.`);
    assert(entry.provenance.workflow_run_url ===
      `https://github.com/agent-teams-ai/engineering-foundation/actions/runs/${entry.provenance.workflow_run_id}`,
    `${record.cohort_id} ${entry.name} workflow run URL does not bind its run ID.`);
  }
  assert(record.reusable_workflow.repository_id === 1316243981,
    `${record.cohort_id} reusable workflow repository ID is not the immutable controller.`);
  const latestPublication = Math.max(...publishedTimes);
  timestampMilliseconds(record.eligible_after, `${record.cohort_id} eligible_after`);
  return { latestPublication };
}

export function validateDocsConsumerLock(manifest, lock, expectedPackages) {
  assert(lock !== null && typeof lock === "object" &&
    lock.importers !== null && typeof lock.importers === "object" &&
    lock.packages !== null && typeof lock.packages === "object",
  "Consumer pnpm lockfile is missing importers or packages.");
  const root = lock.importers["."];
  assert(root !== null && typeof root === "object", "Consumer pnpm lockfile is missing the root importer.");
  const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"];
  const dependencyValues = (container, name) => dependencySections
    .map((section) => container?.[section]?.[name])
    .filter((value) => value !== undefined);
  for (const { name, version, integrity } of expectedPackages) {
    assert(dependencyValues(manifest, name).length === 1 &&
      dependencyValues(manifest, name)[0] === version,
    `${name} manifest dependency must be exact and unique.`);
    const rootBindings = dependencyValues(root, name);
    assert(rootBindings.length === 1 && rootBindings[0] !== null &&
      typeof rootBindings[0] === "object",
    `${name} root lock importer binding must be exact and unique.`);
    const rootBinding = rootBindings[0];
    assert(rootBinding.specifier === version && typeof rootBinding.version === "string",
      `${name} root lock importer specifier/version is invalid.`);
    const rawVersion = rootBinding.version.replace(/^npm:/u, "");
    assert(rawVersion.split("(", 1)[0] === version,
      `${name} root lock importer version differs.`);
    const physicalKey = `${name}@${rawVersion}`;
    for (const [importerName, importer] of Object.entries(lock.importers)) {
      for (const binding of dependencyValues(importer, name)) {
        assert(binding !== null && typeof binding === "object" &&
          binding.specifier === version &&
          binding.version?.replace(/^npm:/u, "") === rawVersion,
        `${name} managed pin in importer ${importerName} differs from the root physical resolution.`);
      }
    }
    const physicalKeys = Object.keys(lock.packages).filter((key) => key.startsWith(`${name}@`));
    assert(physicalKeys.length === 1 && physicalKeys[0] === physicalKey,
      `${name} must have exactly one root-bound physical lock resolution.`);
    assert(lock.packages[physicalKey]?.resolution?.integrity === integrity,
      `${name} root-bound lock integrity differs.`);
  }
}

function validateCanaryEvidence(event, record, qualifiedEvent) {
  const observedIds = event.canary_evidence.map(({ repository_id: id }) => id);
  const declaredIds = record.canary_repositories.map(({ repository_id: id }) => id);
  assert(new Set(observedIds).size === observedIds.length,
    `${record.cohort_id} CANARY evidence repository IDs must be unique.`);
  assert(canonicalJson([...observedIds].sort((left, right) => left - right)) ===
    canonicalJson([...declaredIds].sort((left, right) => left - right)),
  `${record.cohort_id} CANARY evidence must cover the exact declared canary set.`);
  for (const evidence of event.canary_evidence) {
    const declared = record.canary_repositories.find(
      ({ repository_id: id }) => id === evidence.repository_id,
    );
    assert(declared?.repository === evidence.repository,
      `${record.cohort_id} CANARY evidence repository identity differs from the immutable declaration.`);
    assert(evidence.observed_cohort_id === record.cohort_id,
      `${record.cohort_id} CANARY evidence binds the wrong Cohort.`);
    assert(evidence.observed_record_digest === record.record_digest,
      `${record.cohort_id} CANARY evidence binds the wrong record digest.`);
    assert(evidence.observed_event_digest === qualifiedEvent?.event_digest,
      `${record.cohort_id} CANARY evidence must bind the QUALIFIED event digest.`);
  }
}

function validateEventChain(registry, cohortById, asOf) {
  const lastState = new Map();
  const lastEventById = new Map();
  const qualifiedEventById = new Map();
  const supportUntilById = new Map();
  const lastTimeById = new Map();
  let previousDigest = null;
  for (const [index, event] of registry.events.entries()) {
    const eventTime = timestampMilliseconds(
      event.effective_at,
      `Cohort event ${event.sequence} effective_at`
    );
    assert(eventTime <= asOf, `Cohort event ${event.sequence} cannot be effective in the future.`);
    assert(event.sequence === index + 1, "Cohort event sequence must be contiguous and append-only.");
    assert(event.previous_event_digest === previousDigest, `Cohort event ${event.sequence} chain predecessor is invalid.`);
    assert(event.event_digest === cohortEventDigest(event), `Cohort event ${event.sequence} digest is invalid.`);
    assert(cohortById.has(event.cohort_id), `Cohort event ${event.sequence} references an unknown cohort.`);
    const prior = lastState.get(event.cohort_id);
    assert(eventTime >= (lastTimeById.get(event.cohort_id) ?? Number.NEGATIVE_INFINITY),
      `${event.cohort_id} lifecycle effective_at cannot move backwards.`);
    if (prior === undefined) {
      assert(event.state === "PUBLISHED_UNQUALIFIED", `${event.cohort_id} must begin as PUBLISHED_UNQUALIFIED.`);
      const record = cohortById.get(event.cohort_id);
      const publication = validateCohortRecord(record);
      assert(eventTime === publication.latestPublication,
        `${event.cohort_id} first event must equal the latest real package publication time.`);
    } else {
      assert(!TERMINAL_STATES.has(prior), `${event.cohort_id} has an event after terminal state ${prior}.`);
      assert(NEXT_STATES.get(prior)?.has(event.state), `${event.cohort_id} transition ${prior} -> ${event.state} is invalid.`);
    }
    if (event.state === "QUALIFIED") {
      qualifiedEventById.set(event.cohort_id, event);
    }
    if (event.state === "CANARY") {
      validateCanaryEvidence(
        event,
        cohortById.get(event.cohort_id),
        qualifiedEventById.get(event.cohort_id),
      );
    }
    if (event.state === "SUPERSEDED") {
      const supportUntil = timestampMilliseconds(
        event.support_until,
        `${event.cohort_id} support_until`,
      );
      assert(supportUntil > eventTime,
        `${event.cohort_id} support window must end after SUPERSEDED takes effect.`);
      supportUntilById.set(event.cohort_id, supportUntil);
    } else if (event.state === "SUPPORT_ENDED") {
      assert(eventTime >= supportUntilById.get(event.cohort_id),
        `${event.cohort_id} cannot end support before its support_until boundary.`);
    }
    lastState.set(event.cohort_id, event.state);
    lastTimeById.set(event.cohort_id, eventTime);
    lastEventById.set(event.cohort_id, event);
    previousDigest = event.event_digest;
  }
  const recommended = [...lastState.values()].filter((state) => state === "RECOMMENDED");
  assert(recommended.length <= 1, "At most one Docs Cohort may be RECOMMENDED.");
  return {
    lastEventById,
    qualificationEventById: qualifiedEventById,
    stateById: lastState,
    supportUntilById,
  };
}

export function validateDocsQualifiedCohorts(registry, schema, options = {}) {
  validateSchema(registry, schema, "Qualified Docs Cohort registry");
  const ids = registry.cohorts.map(({ cohort_id: cohortId }) => cohortId);
  assert(new Set(ids).size === ids.length, "Qualified Docs Cohort IDs must be unique.");
  assert(ids.every((id, index) => index === 0 || ids[index - 1] < id),
    "Qualified Docs Cohorts must use stable binary ID order.");
  registry.cohorts.forEach(validateCohortRecord);
  const cohortById = new Map(registry.cohorts.map((record) => [record.cohort_id, record]));
  for (const [index, record] of registry.cohorts.entries()) {
    for (const edge of [...record.upgrade_from, ...record.rollback_to]) {
      assert(cohortById.has(edge), `${record.cohort_id} references unknown migration Cohort ${edge}.`);
      assert(edge !== record.cohort_id, `${record.cohort_id} cannot migrate to itself.`);
      assert(registry.cohorts.findIndex(({ cohort_id: id }) => id === edge) < index,
        `${record.cohort_id} migration edges must reference an earlier immutable Cohort.`);
    }
    if (index === 0) {
      assert(record.upgrade_from.length === 0 && record.rollback_to.length === 0,
        `${record.cohort_id} initial Cohort cannot declare migration edges.`);
    } else {
      assert(record.upgrade_from.length > 0 && record.rollback_to.length > 0,
        `${record.cohort_id} successor requires explicit upgrade and rollback edges.`);
      assert(record.rollback_to.every((id) => record.upgrade_from.includes(id)),
        `${record.cohort_id} rollback targets must be declared upgrade origins.`);
    }
  }
  const asOf = timestampMilliseconds(
    options.asOf ?? new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    "Qualified Docs Cohort validation time"
  );
  const { lastEventById, qualificationEventById, stateById, supportUntilById } =
    validateEventChain(registry, cohortById, asOf);
  assert(registry.cohorts.every(({ cohort_id: cohortId }) => stateById.has(cohortId)),
    "Every immutable Cohort record requires lifecycle evidence.");
  return { cohortById, lastEventById, qualificationEventById, stateById, supportUntilById };
}

export function isDocsCohortSelectableForRepository(record, state, repositoryId) {
  if (state === "RECOMMENDED") {return true;}
  return ["QUALIFIED", "CANARY"].includes(state) &&
    Number.isSafeInteger(repositoryId) &&
    record.canary_repositories.some(({ repository_id: id }) => id === repositoryId);
}

export function isDocsCohortSupportedForExistingBinding(
  state,
  supportUntil,
  asOf,
  record,
  repositoryId,
) {
  if (BLOCKED_STATES.has(state)) {return false;}
  if (state === "SUPERSEDED") {
    return Number.isFinite(supportUntil) && asOf < supportUntil;
  }
  if (["QUALIFIED", "CANARY"].includes(state)) {
    return record !== undefined && Number.isSafeInteger(repositoryId) &&
      record.canary_repositories.some(({ repository_id: id }) => id === repositoryId);
  }
  return state === "RECOMMENDED";
}

export function docsCohortTransitionKind(observed, desired) {
  if (desired?.upgrade_from.includes(observed?.cohort_id)) {return "upgrade";}
  if (observed?.rollback_to.includes(desired?.cohort_id)) {return "rollback";}
  return undefined;
}

export function recommendedDocsCohort(registry, options = {}) {
  const { cohortById, stateById } = validateDocsQualifiedCohorts(registry, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object"
  }, options);
  return [...cohortById.values()]
    .find(({ cohort_id: cohortId }) => stateById.get(cohortId) === "RECOMMENDED");
}

export function qualifiedCohortProjection(registry, cohortId, options = {}) {
  const { cohortById, qualificationEventById } = validateDocsQualifiedCohorts(registry, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
  }, options);
  const record = cohortById.get(cohortId);
  const event = qualificationEventById.get(cohortId);
  assert(record !== undefined && event !== undefined,
    `${cohortId} has no immutable QUALIFIED projection.`);
  const packageByName = new Map(record.packages.map((entry) => [entry.name, entry]));
  return {
    schemaVersion: 1,
    cohortId: record.cohort_id,
    channel: record.channel,
    recordDigest: record.record_digest,
    qualificationEventDigest: event.event_digest,
    eligibleAfter: record.eligible_after,
    upgradeFrom: record.upgrade_from,
    rollbackTo: record.rollback_to,
    packages: {
      docsProtocol: {
        version: packageByName.get("@agent-teams/docs-protocol").version,
        integrity: packageByName.get("@agent-teams/docs-protocol").integrity,
      },
      engineeringFoundation: {
        version: packageByName.get("@agent-teams/engineering-foundation").version,
        integrity: packageByName.get("@agent-teams/engineering-foundation").integrity,
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
    schemas: { consumerIntegration: 1, managedState: 1, docsProtocol: 1 },
    runtime: {
      node: record.runtime.node,
      pnpm: record.runtime.pnpm,
      runtimeClosureDigest: record.runtime_closure.digest,
    },
  };
}

export function validateDocsProtocolExceptions(value, schema, options = {}) {
  validateSchema(value, schema, "Docs Protocol exceptions");
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  const ids = value.exceptions.map(({ id }) => id);
  assert(new Set(ids).size === ids.length, "Docs Protocol exception IDs must be unique.");
  const scopes = value.exceptions.map(({ repository_id: repositoryId, scope }) => `${repositoryId}:${scope}`);
  assert(new Set(scopes).size === scopes.length, "Docs Protocol exception scopes must not overlap.");
  for (const exception of value.exceptions) {
    timestampMilliseconds(`${exception.last_reviewed_at}T00:00:00Z`, `${exception.id} last_reviewed_at`);
    timestampMilliseconds(`${exception.review_after}T00:00:00Z`, `${exception.id} review_after`);
    timestampMilliseconds(`${exception.expires_at}T00:00:00Z`, `${exception.id} expires_at`);
    assert(exception.review_after < exception.expires_at,
      `${exception.id} review date must precede expiry.`);
    assert(asOf <= exception.expires_at, `${exception.id} expired and must be reviewed or removed.`);
    assert(asOf < exception.review_after, `${exception.id} review is due before continued use.`);
  }
}

function assertBoundRepository(
  repository,
  cohortById,
  qualificationEventById,
  stateById,
  supportUntilById,
  asOf,
) {
  const desired = cohortById.get(repository.desired_cohort_id);
  const observed = cohortById.get(repository.observed_cohort_id);
  const qualification = qualificationEventById.get(repository.observed_cohort_id);
  assert(observed !== undefined && qualification !== undefined,
    `${repository.repository} observed Cohort never reached QUALIFIED.`);
  assert(repository.observed_cohort_record_digest === observed.record_digest,
    `${repository.repository} observed Cohort record digest differs.`);
  assert(repository.observed_cohort_event_digest === qualification.event_digest,
    `${repository.repository} observed qualification event digest differs.`);
  const observedState = stateById.get(observed.cohort_id);
  const observedSupported = isDocsCohortSupportedForExistingBinding(
    observedState,
    supportUntilById.get(observed.cohort_id),
    asOf,
    observed,
    repository.repository_id,
  );
  if (repository.cohort_binding_status === "bound") {
    assert(repository.desired_cohort_id === repository.observed_cohort_id,
      `${repository.repository} bound desired and observed Cohort IDs differ.`);
  } else {
    const transitionKind = docsCohortTransitionKind(observed, desired);
    assert(repository.cohort_binding_status === "rollout_pending" &&
      transitionKind !== undefined,
    `${repository.repository} staged rollout lacks an explicit migration edge.`);
    assert(observedSupported || (transitionKind === "rollback" && observedState === "SUSPENDED"),
      `${repository.repository} rollout source is no longer supported and is not a suspended rollback source.`);
    const targetAllowed = transitionKind === "upgrade"
      ? isDocsCohortSelectableForRepository(
        desired,
        stateById.get(desired.cohort_id),
        repository.repository_id,
      )
      : isDocsCohortSupportedForExistingBinding(
        stateById.get(desired.cohort_id),
        supportUntilById.get(desired.cohort_id),
        asOf,
        desired,
        repository.repository_id,
      );
    assert(targetAllowed,
      `${repository.repository} rollout target is not currently selectable or supported for rollback.`);
  }
  const packageByName = new Map(observed.packages.map((entry) => [entry.name, entry]));
  assert(repository.exact_package_version === packageByName.get("@agent-teams/docs-protocol")?.version,
    `${repository.repository} Docs Protocol version differs from its Cohort.`);
  assert(repository.exact_foundation_version === packageByName.get("@agent-teams/engineering-foundation")?.version,
    `${repository.repository} Foundation version differs from its Cohort.`);
  assert(repository.reusable_workflow_revision === observed.reusable_workflow.revision,
    `${repository.repository} reusable workflow revision differs from its Cohort.`);
  assert(repository.required_check_context !== null && repository.required_check_context.length > 0,
    `${repository.repository} requires its observed Docs check context.`);
  assert(repository.profile_path !== null && repository.caller_workflow_path !== null &&
    repository.qualification_evidence_path !== null,
  `${repository.repository} is missing committed consumer authority evidence.`);
}

export function validateDocsGovernanceReferences(
  registry,
  exceptions,
  docsPolicy,
  securityPolicy,
  options = {},
) {
  const exceptionById = new Map(exceptions.exceptions.map((entry) => [entry.id, entry]));
  const securityExceptionById = new Map(
    securityPolicy.required_check_exceptions.map((entry) => [entry.id, entry]),
  );
  const referenced = new Set();
  for (const repository of docsPolicy.repositories) {
    const id = repository.required_check_exception_id;
    if (id === null) {continue;}
    const exception = exceptionById.get(id);
    assert(exception !== undefined, `${repository.repository} references an unknown Docs Protocol exception.`);
    assert(exception.repository_id === repository.repository_id,
      `${repository.repository} exception repository ID does not match.`);
    assert(exception.scope === "required_docs_check",
      `${repository.repository} required-check exception has the wrong scope.`);
    assert(exception.authority_exception_id === id && securityExceptionById.has(id),
      `${repository.repository} Docs exception does not bind central security authority.`);
    assert(securityExceptionById.get(id).repository === repository.repository,
      `${repository.repository} security exception repository differs.`);
    referenced.add(id);
  }
  assert(referenced.size === exceptions.exceptions.length,
    "Every Docs Protocol exception must be referenced exactly by fleet admission policy.");
  const validationAsOf = timestampMilliseconds(
    options.asOf ?? new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    "Docs governance reference validation time",
  );
  const { cohortById, qualificationEventById, stateById, supportUntilById } =
    validateDocsQualifiedCohorts(registry, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
  }, options);
  for (const repository of docsPolicy.repositories.filter(
    ({ protocol_required: required, repository_lifecycle: lifecycle }) =>
      required && lifecycle === "active",
  )) {
    if (["bound", "rollout_pending"].includes(repository.cohort_binding_status)) {
      assert(repository.admission_status === "admitted" &&
        repository.observed_default_branch_evidence !== null,
      `${repository.repository} cannot be admitted or bound before exact default-branch green evidence.`);
      assertBoundRepository(
        repository,
        cohortById,
        qualificationEventById,
        stateById,
        supportUntilById,
        validationAsOf,
      );
    } else if (repository.cohort_binding_status === "bootstrap_pending") {
      const desired = cohortById.get(repository.desired_cohort_id);
      assert(repository.admission_status === "admission_candidate" &&
        desired !== undefined &&
        isDocsCohortSelectableForRepository(
          desired,
          stateById.get(desired.cohort_id),
          repository.repository_id,
        ) &&
        repository.observed_cohort_id === null &&
        repository.observed_cohort_record_digest === null &&
        repository.observed_cohort_event_digest === null &&
        repository.exact_package_version === null &&
        repository.exact_foundation_version === null &&
        repository.reusable_workflow_revision === null &&
        repository.observed_default_branch_evidence === null,
      `${repository.repository} bootstrap candidate must select one eligible desired Cohort without claiming observed state.`);
    } else {
      assert(repository.cohort_binding_status === "legacy_pre_cohort" &&
        repository.desired_cohort_id === null &&
        repository.observed_cohort_id === null &&
        repository.observed_cohort_record_digest === null &&
        repository.observed_cohort_event_digest === null,
      `${repository.repository} unbound state must be explicit legacy_pre_cohort.`);
    }
  }
}

export function assertDocsCohortAppendOnly(previous, current) {
  assert(canonicalJson(previous.policy) === canonicalJson(current.policy),
    "Qualified Docs Cohort policy cannot change in an append-only lifecycle PR.");
  assert(current.cohorts.length >= previous.cohorts.length,
    "Qualified Docs Cohort records cannot be deleted.");
  assert(current.events.length >= previous.events.length,
    "Qualified Docs Cohort events cannot be deleted.");
  assert(canonicalJson(current.cohorts.slice(0, previous.cohorts.length)) === canonicalJson(previous.cohorts),
    "Existing Qualified Docs Cohort records are immutable.");
  assert(canonicalJson(current.events.slice(0, previous.events.length)) === canonicalJson(previous.events),
    "Existing Qualified Docs Cohort events are immutable.");
}

export async function collectRepositoryInventoryPages(fetchPage, options = {}) {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 100;
  const repositories = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const entries = await fetchPage({ page, perPage: pageSize });
    assert(Array.isArray(entries) && entries.length <= pageSize,
      `Repository inventory page ${page} is invalid.`);
    if (entries.length === 0) {return repositories;}
    repositories.push(...entries);
    const ids = repositories.map(({ id }) => id);
    assert(new Set(ids).size === ids.length,
      `Repository inventory page ${page} repeats a repository ID.`);
  }
  throw new Error(`Repository inventory exceeded the ${maxPages}-page safety bound.`);
}

export async function observeStableRepositoryInventory(fetchPage, options = {}) {
  const stable = (repositories) => [...repositories]
    .map((entry) => structuredClone(entry))
    .sort(({ id: left }, { id: right }) => left - right);
  const first = stable(await collectRepositoryInventoryPages(fetchPage, options));
  const replay = stable(await collectRepositoryInventoryPages(fetchPage, options));
  assert(canonicalJson(first) === canonicalJson(replay),
    "Organization inventory changed during observation; retry for one stable snapshot.");
  return first;
}
