import { createHash } from 'node:crypto';
import { parseIncidentJson } from './verify-docs-platform-recovery-installation-r317.mjs';

const SHA1 = /^[a-f0-9]{40}$/u;
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const ZERO1 = '0'.repeat(40);
const ZERO256 = `sha256:${'0'.repeat(64)}`;
const PATH = /^(?!\/)(?!.*\/\/)[A-Za-z0-9._/-]+$/u;
const FIELDS = ['type', 'mode', 'blob', 'bytes', 'sha256'];
const ROW = ['path', 'status', 'old', 'new'];
const RECORD = ['schema_version', 'source_base', 'content_candidate', 'manifest'];
const REVIEWED_CANDIDATE_DIGEST = 'sha256:63f5a63d9a60dfd30d7d3c1d9ad3af024dd549188f4b6eef085923affff97491';
const validated = new WeakSet();
const need = (yes, message) => { if (!yes) {throw new Error(message);} };
const keys = (value, expected, label) => {
  need(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).toSorted()) === JSON.stringify([...expected].toSorted()),
  `${label} fields differ`);
};
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function preflight(bytes) {
  need(Buffer.isBuffer(bytes) && bytes.length <= 128 * 1024, 'portable record exceeds 128 KiB');
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const source = bytes.toString('utf8');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const char of source) {
    if (inString) {
      if (escaped) {escaped = false;}
      else if (char === '\\') {escaped = true;}
      else if (char === '"') {inString = false;}
    } else if (char === '"') {inString = true;}
    else if (char === '{' || char === '[') {need(++depth <= 16, 'portable record nesting exceeds 16');}
    else if (char === '}' || char === ']') {need(--depth >= 0, 'portable record nesting differs');}
  }
  need(depth === 0 && !inString, 'portable record is incomplete');
}

export function parsePortableJson(bytes, label) {
  preflight(bytes);
  return parseIncidentJson(bytes, label, 128 * 1024);
}

function validPath(path) {
  return typeof path === 'string' && PATH.test(path) &&
    path.split('/').every((part) => part !== '.' && part !== '..' && part.length > 0);
}
function side(value) {
  if (value === null) {return;}
  keys(value, FIELDS, 'portable side');
  need(value.type === 'blob' && value.mode === '100644' &&
    SHA1.test(value.blob) && value.blob !== ZERO1 &&
    Number.isSafeInteger(value.bytes) && value.bytes >= 0 &&
    SHA256.test(value.sha256) && value.sha256 !== ZERO256,
  'portable side identity differs');
}

export function validatePortableRecord(bytes, retainedReview = REVIEWED_CANDIDATE_DIGEST) {
  const record = parsePortableJson(bytes, 'portable record');
  need(retainedReview === REVIEWED_CANDIDATE_DIGEST && hash(bytes) === retainedReview,
    'portable candidate record differs from retained content review');
  keys(record, RECORD, 'portable record');
  need(record.schema_version === 1 && SHA1.test(record.source_base) &&
    record.source_base !== ZERO1 && SHA1.test(record.content_candidate) &&
    record.content_candidate !== ZERO1 && record.source_base !== record.content_candidate &&
    Array.isArray(record.manifest) && record.manifest.length === 24,
  'portable record identity differs');
  let previous = '';
  let additions = 0;
  for (const row of record.manifest) {
    keys(row, ROW, 'portable row');
    need(validPath(row.path) && previous < row.path, 'portable manifest path/order differs');
    previous = row.path;
    side(row.old); side(row.new);
    need((row.status === 'added' && row.old === null && row.new !== null) ||
      (row.status === 'modified' && row.old !== null && row.new !== null &&
        row.old.blob !== row.new.blob), 'portable row transition differs');
    if (row.status === 'added') {additions++;}
  }
  need(additions === 7, 'portable addition count differs');
  for (const row of record.manifest) {
    if (row.old) {Object.freeze(row.old);}
    Object.freeze(row.new);
    Object.freeze(row);
  }
  Object.freeze(record.manifest);
  Object.freeze(record);
  validated.add(record);
  return record;
}

function same(actual, expected) {
  return actual?.type === expected.type && actual.mode === expected.mode &&
    actual.blob === expected.blob && actual.bytes === expected.bytes &&
    actual.sha256 === expected.sha256;
}
function safeTree(map) {
  need(map instanceof Map && map.size <= 20000, 'portable tree map is invalid');
  for (const [path, entry] of map) {
    need(typeof path === 'string' && path.length > 0 && entry !== null &&
      Object.getPrototypeOf(entry) === Object.prototype &&
      JSON.stringify(Object.keys(entry).toSorted()) === JSON.stringify(FIELDS.toSorted()) &&
      Object.values(Object.getOwnPropertyDescriptors(entry)).every((field) =>
        Object.hasOwn(field, 'value')) && entry.type === 'blob' &&
      ['100644', '100755'].includes(entry.mode) && SHA1.test(entry.blob) &&
      entry.blob !== ZERO1 && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 &&
      SHA256.test(entry.sha256) && entry.sha256 !== ZERO256,
    'portable tree contains unsafe or incomplete entry');
  }
}
function sideMatches(actual, expected) {
  return expected === null ? actual === undefined : same(actual, expected);
}

// Inputs are complete verified immutable-tree maps with independently recomputed blob digests.
// Any partial or mixed portable tuple is fatal; unrelated changes go to the retained V8 path.
export function classifyPortableTransition(base, head, record) {
  need(base instanceof Map && head instanceof Map && validated.has(record),
    'portable tree evidence is missing');
  safeTree(base); safeTree(head);
  const changed = [...new Set([...base.keys(), ...head.keys()])]
    .filter((path) => {
      const before = base.get(path), after = head.get(path);
      return before === undefined || after === undefined || !same(before, after);
    }).toSorted();
  const paths = record.manifest.map((row) => row.path);
  const touched = changed.some((path) => paths.includes(path));
  if (!touched) {return 'legacy';}
  need(JSON.stringify(changed) === JSON.stringify(paths), 'portable change set is incomplete or mixed');
  const forward = record.manifest.every((row) =>
    sideMatches(base.get(row.path), row.old) && sideMatches(head.get(row.path), row.new));
  const inverse = record.manifest.every((row) =>
    sideMatches(base.get(row.path), row.new) && sideMatches(head.get(row.path), row.old));
  need(forward !== inverse, 'portable preimages or postimages differ');
  return forward ? 'portable-forward' : 'portable-inverse';
}

export function verifyPortableBlob(bytes, identity) {
  need(Buffer.isBuffer(bytes) && identity?.type === 'blob' && bytes.length === identity.bytes,
    'portable blob length differs');
  const git = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  need(git === identity.blob && hash(bytes) === identity.sha256,
    'portable blob digest differs');
  return true;
}

// Repository ruleset listing includes inherited rules for other branches. GitHub's
// ref_name selectors use fnmatch-style branch patterns; only selectors whose
// meaning for this exact ref is known may affect the cutover decision.
function selectorMatchesMain(selector) {
  need(typeof selector === 'string', 'ruleset branch selector is ambiguous');
  if (selector === '~ALL' || selector === '~DEFAULT_BRANCH') {return true;}
  need(/^refs\/heads\/[A-Za-z0-9._/*?-]+$/u.test(selector) &&
    (!selector.includes('**') ||
      (selector.indexOf('**') === selector.length - 2 && selector.at(-3) === '/')),
  'ruleset branch selector is ambiguous');
  const escaped = selector.replace(/[.+^${}()|[\]\\]/gu, '\\$&')
    .replace(/\*\*/gu, '#').replace(/\*/gu, '[^/]*')
    .replace(/\?/gu, '[^/]').replaceAll('#', '.*');
  return new RegExp(`^${escaped}$`, 'u').test('refs/heads/main');
}

function rulesetAppliesToMain(detail) {
  const scope = detail.conditions?.ref_name;
  need(scope && Array.isArray(scope.include) && scope.include.length > 0 &&
    Array.isArray(scope.exclude), 'ruleset branch scope is ambiguous');
  // Inspect every selector even when a previous include or exclude decides the
  // result. An unsupported selector cannot be treated as a safe exclusion.
  const includes = scope.include.map(selectorMatchesMain);
  const excludes = scope.exclude.map(selectorMatchesMain);
  return includes.some(Boolean) && !excludes.some(Boolean);
}

export function verifyPortableProtections(snapshot) {
  need(Array.isArray(snapshot?.rulesets) &&
    Object.hasOwn(snapshot, 'classic_branch_protection'), 'effective protections are incomplete');
  const matches = snapshot?.rulesets?.filter(({ detail }) => detail?.id === 19979783);
  need(matches?.length === 1, 'Protect main ruleset is missing');
  const { summary, detail } = matches[0];
  need(summary?.id === detail.id && summary.name === 'Protect main' &&
    summary.enforcement === 'active' &&
    detail.name === 'Protect main' && detail.target === 'branch' && detail.enforcement === 'active' &&
    detail.bypass_actors?.length === 0 && detail.conditions?.ref_name?.include?.includes('~DEFAULT_BRANCH') &&
    detail.conditions.ref_name.exclude?.length === 0 && Array.isArray(detail.rules),
  'Protect main scope differs');
  const rules = new Map(detail.rules.map((rule) => [rule.type, rule]));
  need(rules.size === detail.rules.length && ['deletion', 'non_fast_forward',
    'required_linear_history', 'pull_request', 'required_status_checks']
    .every((type) => rules.has(type)), 'Protect main rules differ');
  const status = rules.get('required_status_checks').parameters;
  const checks = status?.required_status_checks;
  need(status?.strict_required_status_checks_policy === true && Array.isArray(checks),
    'strict required checks differ');
  const contexts = new Map(checks.map((check) => [check.context, check.integration_id]));
  need(contexts.size === checks.length && ['check', 'trusted-admission-evidence',
    'trusted-authority-evolution', 'trusted-admission-authority-evolution-v1',
    'trusted-cohort-authority-portable-r322',
    'trusted-validation-portable-r322'].every((context) => contexts.get(context) === 15368) &&
    !contexts.has('trusted-cohort-authority-evolution-v8') && !contexts.has('trusted-validation'),
  'required context or integration differs');
  const superseded = new Set(['trusted-cohort-authority-evolution-v8', 'trusted-validation']);
  for (const { summary: otherSummary, detail: other } of snapshot.rulesets) {
    need(otherSummary?.id === other?.id && Array.isArray(other.rules),
      'effective ruleset detail differs');
    if (otherSummary.enforcement !== 'active' && other.enforcement !== 'active') {continue;}
    if (other.target !== 'branch') {continue;}
    if (!rulesetAppliesToMain(other)) {continue;}
    need(otherSummary.enforcement === 'active' && other.enforcement === 'active' &&
      Array.isArray(other.bypass_actors) && other.bypass_actors.length === 0,
    'active effective ruleset enforcement or bypass differs');
    for (const rule of other.rules.filter((item) => item.type === 'required_status_checks')) {
      const required = rule.parameters?.required_status_checks;
      need(Array.isArray(required) && required.every((item) =>
        typeof item?.context === 'string' && Number.isSafeInteger(item.integration_id)),
      'effective ruleset required checks are incomplete');
      need(required.every((item) => !superseded.has(item.context)),
        'superseded context remains in effective ruleset');
    }
  }
  const classic = snapshot.classic_branch_protection;
  if (classic !== null) {
    need(classic && typeof classic === 'object' && !Array.isArray(classic),
      'classic branch protection is incomplete');
    const statusChecks = classic.required_status_checks;
    if (statusChecks !== undefined && statusChecks !== null) {
      need(Array.isArray(statusChecks.contexts) && Array.isArray(statusChecks.checks),
        'classic required checks are incomplete');
      need(statusChecks.contexts.every((context) => typeof context === 'string' &&
        !superseded.has(context)) && statusChecks.checks.every((check) =>
        typeof check?.context === 'string' && !superseded.has(check.context)),
      'superseded context remains in classic protection');
    }
  }
}
