#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const NEGATIVE_STATES = new Set(["SUPPORT_ENDED", "SUSPENDED", "WITHDRAWN"]);
const NEXT_STATES = new Map([
  ["PUBLISHED_UNQUALIFIED", new Set(["VERIFIED", "WITHDRAWN"])],
  ["VERIFIED", new Set(["COOLDOWN", "QUALIFIED", "WITHDRAWN"])],
  ["COOLDOWN", new Set(["QUALIFIED", "WITHDRAWN"])],
  ["QUALIFIED", new Set(["CANARY", "SUSPENDED", "WITHDRAWN"])],
  ["CANARY", new Set(["RECOMMENDED", "SUSPENDED", "WITHDRAWN"])],
  ["RECOMMENDED", new Set(["SUPERSEDED", "SUSPENDED", "WITHDRAWN"])],
  ["SUPERSEDED", new Set(["SUPPORT_ENDED", "SUSPENDED", "WITHDRAWN"])],
  ["SUSPENDED", new Set(["WITHDRAWN"])],
]);
const EVENT_KEYS = [
  "canary_evidence", "cohort_id", "effective_at", "event_digest",
  "evidence_references", "previous_event_digest", "sequence", "state", "support_until",
];
const ALL_STATES = new Set([
  "PUBLISHED_UNQUALIFIED", "VERIFIED", "COOLDOWN", "QUALIFIED", "CANARY", "RECOMMENDED",
  "SUPERSEDED", "SUPPORT_ENDED", "SUSPENDED", "WITHDRAWN",
]);
const COHORT_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const REPOSITORY = /^agent-teams-ai\/[A-Za-z0-9_.-]+$/u;
const CHECK_URL = /^https:\/\/github\.com\/agent-teams-ai\/[A-Za-z0-9_.-]+\/actions\/runs\/[1-9][0-9]+(?:\/job\/[1-9][0-9]+)?$/u;
const CALLER_PATH = /^\.github\/workflows\/[^/]+\.ya?ml$/u;
const CANARY_KEYS = [
  "caller_workflow_digest", "caller_workflow_path", "check_run_id", "check_run_url",
  "conclusion", "integration_id", "merge_revision", "observed_cohort_id",
  "observed_event_digest", "observed_record_digest", "repository", "repository_id",
  "required_context", "workflow_id", "workflow_run_id",
];
const REGISTRY_PATH = "governance/docs-qualified-cohorts.json";
const EVIDENCE_PATH = /^governance\/evidence\/docs-cohorts\/[a-z0-9][a-z0-9._/-]*\.(?:json|md)$/u;
const RUNTIME_CLOSURE_PATH = /^governance\/docs-runtime-closures\/sha256-[0-9a-f]{64}\.json$/u;

function assert(condition, message) {
  if (!condition) {throw new Error(message);}
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    assert(Number.isSafeInteger(value), "Emergency canonical JSON accepts only safe integers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {return `[${value.map(canonicalJson).join(",")}]`;}
  assert(value !== undefined && typeof value === "object", "Invalid emergency JSON value.");
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
}

function eventDigest(event) {
  const { event_digest: _ignored, ...body } = event;
  return `sha256:${createHash("sha256").update(canonicalJson({
    domain: "agent-teams.docs-qualified-cohort-event/v1", body,
  })).digest("hex")}`;
}

class DuplicateKeyScanner {
  constructor(source, label) {this.source = source; this.label = label; this.offset = 0;}
  scan() {this.#value(); this.#space(); assert(this.offset === this.source.length, `${this.label} has trailing input.`);}
  #space() {while (/\s/u.test(this.source[this.offset] ?? "")) {this.offset += 1;}}
  #value() {
    this.#space();
    const c = this.source[this.offset];
    if (c === "{") {this.#object(); return;}
    if (c === "[") {this.#array(); return;}
    if (c === '"') {this.#string(); return;}
    const literal = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/u
      .exec(this.source.slice(this.offset))?.[0];
    assert(literal !== undefined, `${this.label} is invalid JSON near byte ${this.offset}.`);
    this.offset += literal.length;
  }
  #object() {
    this.offset += 1; const keys = new Set(); this.#space();
    if (this.source[this.offset] === "}") {this.offset += 1; return;}
    while (true) {
      this.#space(); assert(this.source[this.offset] === '"', `${this.label} has an invalid object key.`);
      const key = this.#string(); assert(!keys.has(key), `${this.label} contains duplicate key ${key}.`); keys.add(key);
      this.#space(); assert(this.source[this.offset] === ":", `${this.label} object key has no value.`); this.offset += 1;
      this.#value(); this.#space();
      if (this.source[this.offset] === "}") {this.offset += 1; return;}
      assert(this.source[this.offset] === ",", `${this.label} object entries are invalid.`); this.offset += 1;
    }
  }
  #array() {
    this.offset += 1; this.#space();
    if (this.source[this.offset] === "]") {this.offset += 1; return;}
    while (true) {
      this.#value(); this.#space();
      if (this.source[this.offset] === "]") {this.offset += 1; return;}
      assert(this.source[this.offset] === ",", `${this.label} array entries are invalid.`); this.offset += 1;
    }
  }
  #string() {
    const start = this.offset; this.offset += 1;
    while (this.offset < this.source.length) {
      const c = this.source[this.offset];
      if (c === '"') {this.offset += 1; return JSON.parse(this.source.slice(start, this.offset));}
      if (c === "\\") {this.offset += 2;} else {
        assert(c.charCodeAt(0) >= 0x20, `${this.label} contains a control character.`); this.offset += 1;
      }
    }
    throw new Error(`${this.label} has an unterminated string.`);
  }
}

export function parseEmergencyJson(source, label) {
  assert(Buffer.byteLength(source) <= 4 * 1024 * 1024, `${label} exceeds the emergency size limit.`);
  new DuplicateKeyScanner(source, label).scan();
  return JSON.parse(source);
}

export function validateCohortLifecycleChangedFiles(files) {
  assert(Array.isArray(files) && files.length > 0, "Lifecycle PR changed-file evidence is missing.");
  for (const file of files) {
    const paths = [file.filename, file.previous_filename].filter(Boolean);
    const allowedPath = (entry) => entry === REGISTRY_PATH ||
      ((EVIDENCE_PATH.test(entry) || RUNTIME_CLOSURE_PATH.test(entry)) &&
        !entry.split("/").some((part) => part === "." || part === ".."));
    assert(paths.every(allowedPath),
      `Lifecycle PR changes forbidden authority or dependency path ${paths.join(" -> ")}.`);
    if (file.filename === REGISTRY_PATH) {
      assert(["added", "modified"].includes(file.status) && file.previous_filename === undefined,
        "Lifecycle registry cannot be renamed or deleted.");
    } else {
      assert(file.status === "added" && file.previous_filename === undefined,
        "Cohort evidence must be a newly added inert file, never renamed or rewritten.");
    }
  }
}

function timestamp(value, label) {
  const milliseconds = Date.parse(value);
  assert(Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString().replace(".000", "") === value,
  `${label} must be canonical UTC seconds.`);
  return milliseconds;
}

function validateCanaryEvidenceShape(evidence, label) {
  assert(evidence !== null && typeof evidence === "object" && !Array.isArray(evidence) &&
    canonicalJson(Object.keys(evidence).sort()) === canonicalJson(CANARY_KEYS),
  `${label} fields are invalid.`);
  assert(Number.isSafeInteger(evidence.repository_id) && evidence.repository_id >= 1 &&
    REPOSITORY.test(evidence.repository) && SHA.test(evidence.merge_revision) &&
    COHORT_ID.test(evidence.observed_cohort_id) &&
    SHA256.test(evidence.observed_record_digest) && SHA256.test(evidence.observed_event_digest) &&
    typeof evidence.required_context === "string" && evidence.required_context.length >= 1 &&
    evidence.required_context.length <= 256 && Number.isSafeInteger(evidence.integration_id) &&
    evidence.integration_id >= 1 && evidence.conclusion === "success" &&
    Number.isSafeInteger(evidence.check_run_id) && evidence.check_run_id >= 1 &&
    CHECK_URL.test(evidence.check_run_url) && Number.isSafeInteger(evidence.workflow_run_id) &&
    evidence.workflow_run_id >= 1 && Number.isSafeInteger(evidence.workflow_id) &&
    evidence.workflow_id >= 1 && CALLER_PATH.test(evidence.caller_workflow_path) &&
    SHA256.test(evidence.caller_workflow_digest), `${label} values are invalid.`);
}

export function validateEmergencyCohortAppend(previous, current, asOf = Date.now()) {
  const { events: previousEvents, ...previousAuthority } = previous;
  const { events: currentEvents, ...currentAuthority } = current;
  assert(canonicalJson(previousAuthority) === canonicalJson(currentAuthority),
    "Emergency append cannot change Cohort policy or immutable records.");
  assert(Array.isArray(previousEvents) && Array.isArray(currentEvents) &&
    currentEvents.length > previousEvents.length,
  "Emergency validation requires at least one appended event.");
  assert(canonicalJson(currentEvents.slice(0, previousEvents.length)) === canonicalJson(previousEvents),
    "Emergency append cannot rewrite existing events.");

  const stateById = new Map();
  const supportUntilById = new Map();
  const timeById = new Map();
  let priorDigest = null;
  for (const [index, event] of currentEvents.entries()) {
    assert(canonicalJson(Object.keys(event).sort()) === canonicalJson(EVENT_KEYS),
      `Cohort event ${index + 1} has unexpected fields.`);
    assert(Number.isSafeInteger(event.sequence) && event.sequence === index + 1 &&
      COHORT_ID.test(event.cohort_id) && ALL_STATES.has(event.state) &&
      (event.previous_event_digest === null || SHA256.test(event.previous_event_digest)) &&
      SHA256.test(event.event_digest) && event.previous_event_digest === priorDigest &&
      event.event_digest === eventDigest(event),
    `Cohort event ${index + 1} breaks the trusted append chain.`);
    const eventTime = timestamp(event.effective_at, `Cohort event ${index + 1} effective_at`);
    assert(eventTime <= asOf, `Cohort event ${index + 1} cannot be future-effective.`);
    assert(eventTime >= (timeById.get(event.cohort_id) ?? Number.NEGATIVE_INFINITY),
      `${event.cohort_id} lifecycle effective_at cannot move backwards.`);
    assert(Array.isArray(event.evidence_references) && event.evidence_references.length >= 1 &&
      event.evidence_references.length <= 64 &&
      new Set(event.evidence_references).size === event.evidence_references.length &&
      event.evidence_references.every((entry) =>
        typeof entry === "string" && entry.length >= 1 && entry.length <= 2048),
    `Cohort event ${index + 1} evidence references are invalid.`);
    assert(Array.isArray(event.canary_evidence) && event.canary_evidence.length <= 32 &&
      (event.state === "CANARY" ? event.canary_evidence.length >= 1 : event.canary_evidence.length === 0),
    `Cohort event ${index + 1} canary evidence cardinality is invalid.`);
    event.canary_evidence.forEach((entry, evidenceIndex) =>
      validateCanaryEvidenceShape(entry, `Cohort event ${index + 1} canary evidence ${evidenceIndex + 1}`));
    assert(event.state === "SUPERSEDED"
      ? typeof event.support_until === "string"
      : event.support_until === null,
    `Cohort event ${index + 1} support_until is invalid.`);
    const priorState = stateById.get(event.cohort_id);
    if (priorState === undefined) {
      assert(event.state === "PUBLISHED_UNQUALIFIED", `${event.cohort_id} has no initial publication event.`);
    } else {
      assert(NEXT_STATES.get(priorState)?.has(event.state),
        `${event.cohort_id} transition ${priorState} -> ${event.state} is invalid.`);
    }
    if (event.state === "SUPERSEDED") {
      const supportUntil = timestamp(event.support_until, `${event.cohort_id} support_until`);
      assert(supportUntil > eventTime, `${event.cohort_id} support_until must follow SUPERSEDED.`);
      supportUntilById.set(event.cohort_id, supportUntil);
    }
    if (event.state === "SUPPORT_ENDED") {
      assert(eventTime >= supportUntilById.get(event.cohort_id),
        `${event.cohort_id} cannot end support before support_until.`);
    }
    if (index >= previousEvents.length) {
      assert(NEGATIVE_STATES.has(event.state),
        `Cohort event ${index + 1} is not eligible for offline emergency validation.`);
      assert(event.support_until === null && event.canary_evidence.length === 0,
      `Cohort event ${index + 1} emergency evidence shape is invalid.`);
    }
    stateById.set(event.cohort_id, event.state);
    timeById.set(event.cohort_id, eventTime);
    priorDigest = event.event_digest;
  }
  return currentEvents.length - previousEvents.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const basePath = process.env.DOCS_COHORT_BASE_PATH;
  const currentPath = process.env.DOCS_COHORT_CURRENT_PATH;
  const changedFilesPath = process.env.DOCS_COHORT_CHANGED_FILES_PATH;
  assert(basePath && currentPath, "Emergency validator paths are missing.");
  const [baseSource, currentSource, changedFilesSource] = await Promise.all([
    readFile(basePath, "utf8"), readFile(currentPath, "utf8"),
    changedFilesPath === undefined ? undefined : readFile(changedFilesPath, "utf8"),
  ]);
  if (changedFilesSource !== undefined) {
    validateCohortLifecycleChangedFiles(
      parseEmergencyJson(changedFilesSource, "lifecycle changed files"),
    );
  }
  const count = validateEmergencyCohortAppend(
    parseEmergencyJson(baseSource, "base Cohort registry"),
    parseEmergencyJson(currentSource, "current Cohort registry"),
  );
  console.log(`Offline emergency Cohort append verified: ${count} event(s).`);
}
