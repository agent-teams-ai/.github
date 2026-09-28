#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { parseIncidentJson, verifiedTree, readEffectiveProtections } from './verify-docs-platform-recovery-installation-r317.mjs';
import { classifyPortableTransition, parsePortableJson, validatePortableRecord, verifyPortableBlob, verifyPortableProtections } from './docs-portable-authority-r322.mjs';

const exec = promisify(execFile);
const REPO = 'agent-teams-ai/.github';
const REPO_ID = 1316243981;
const SHA = /^(?!0{40}$)[a-f0-9]{40}$/u;
const DIGEST = /^sha256:(?!0{64}$)[a-f0-9]{64}$/u;
const G = [
  '.github/workflows/docs-portable-authority-r322.yml',
  'docs/node26-portable-authority-r322.md',
  'governance/docs-portable-authority-r322.json',
  'scripts/docs-portable-authority-r322.mjs',
  'scripts/docs-portable-authority-r322.test.mjs',
  'scripts/read-docs-portable-authority-r322.mjs',
  'scripts/read-docs-portable-authority-r322.test.mjs',
  'scripts/docs-legacy-admission-recovery.mjs',
  'scripts/verify-docs-platform-recovery-installation-r317.mjs',
];
const FIELDS = ['schema_version', 'repository', 'repository_id', 'pull_number', 'pull_id',
  'branch', 'head_ref', 'base', 'head', 'direction', 'manifest_digest', 'closure',
  'run_id', 'run_attempt', 'decision_comment_id', 'owner_id', 'owner_login',
  'review_comment_id', 'reviewer_id', 'reviewer_login', 'deadline',
  'expected_protections_digest', 'forward_decision_comment_id'];
const need = (yes, why) => { if (!yes) {throw new Error(`portable r322: ${why}`);} };
const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const tuple = (item) => JSON.stringify([item?.id, item?.number, item?.state, item?.merged,
  item?.draft, item?.base?.sha, item?.base?.ref, item?.base?.repo?.id,
  item?.head?.sha, item?.head?.ref, item?.head?.repo?.id, item?.changed_files,
  item?.commits, item?.updated_at]);
const json = (value) => JSON.stringify(value);
const closed = (value, fields) => need(value && typeof value === 'object' && !Array.isArray(value) &&
  json(Object.keys(value).toSorted()) === json(fields.toSorted()), 'record fields differ');
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const deadline = (value) => {
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace('Z', '.000Z'),
  'deadline is invalid');
  return Date.parse(value);
};
const reviewBody = (record, accepted) => json({ schema_version: 1,
  decision: 'accept-reviewed-corrected-portable-content',
  source_base: record.source_base, content_candidate: record.content_candidate,
  manifest_digest: accepted.manifest_digest, repository: REPO,
  pull_number: accepted.pull_number, pull_id: accepted.pull_id,
  base: accepted.base, head: accepted.head, direction: accepted.direction });

export function classifyPortableIntent(files, record) {
  need(Array.isArray(files), 'classification file inventory is missing');
  return files.some((file) => [file?.filename, file?.previous_filename].filter(Boolean)
    .some((path) => G.includes(path) || record.manifest.some((row) => row.path === path))) ?
    'portable' : 'legacy';
}

export function validatePortableAcceptance(value, record, now) {
  closed(value, FIELDS);
  need(value.schema_version === 1 && value.repository === REPO && value.repository_id === REPO_ID &&
    (value.direction === 'forward' ? value.pull_number === 322 :
      positive(value.pull_number) && value.pull_number !== 322) &&
    positive(value.pull_id) && value.branch === 'main' &&
    typeof value.head_ref === 'string' && /^[A-Za-z0-9_./-]+$/u.test(value.head_ref) &&
    SHA.test(value.base) && SHA.test(value.head) && value.base !== value.head &&
    ['forward', 'inverse'].includes(value.direction) &&
    value.manifest_digest === digest(json(record.manifest)) &&
    positive(value.run_id) && positive(value.run_attempt) &&
    positive(value.decision_comment_id) && positive(value.review_comment_id) &&
    value.decision_comment_id !== value.review_comment_id && positive(value.owner_id) &&
    /^[A-Za-z0-9-]+$/u.test(value.owner_login) &&
    positive(value.reviewer_id) && value.reviewer_id !== value.owner_id &&
    /^[A-Za-z0-9-]+$/u.test(value.reviewer_login) &&
    DIGEST.test(value.expected_protections_digest) &&
    (value.direction === 'inverse' ? positive(value.forward_decision_comment_id) :
      value.forward_decision_comment_id === null) &&
    deadline(value.deadline) > now && deadline(value.deadline) - now <= 86400_000,
  'accepted execution coordinates differ');
  need(Array.isArray(value.closure) && value.closure.length === G.length &&
    value.closure.every((entry, index) => {
      closed(entry, ['path', 'blob', 'bytes', 'sha256']);
      return entry.path === G[index] && SHA.test(entry.blob) &&
        Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && DIGEST.test(entry.sha256);
    }), 'execution closure differs');
  return value;
}


async function readTree(revision, api) {
  const raw = verifiedTree(revision, await api.getTree(revision));
  const entries = new Map();
  const rows = [...raw];
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const [path, item] = rows[cursor++];
      const bytes = await api.getBlob(item.sha);
      const identity = { type: item.type, mode: item.mode, blob: item.sha, bytes: item.size,
        sha256: digest(bytes) };
      verifyPortableBlob(bytes, identity);
      entries.set(path, identity);
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, rows.length) }, () => worker()));
  return entries;
}

export async function verifyPortableExecution(event, accepted, api, clock = Date.now) {
  const record = validatePortableRecord(await api.getInstalledRecord());
  validatePortableAcceptance(accepted, record, clock());
  need(event?.repository?.id === REPO_ID && event.repository.full_name === REPO &&
    ['opened', 'synchronize', 'reopened', 'edited', 'ready_for_review'].includes(event.action) &&
    event.run_id === accepted.run_id && event.run_attempt === accepted.run_attempt,
  'event identity or run attempt differs');
  const repo = await api.getRepository();
  const pull = await api.getPull(accepted.pull_number);
  need(repo?.id === REPO_ID && repo.full_name === REPO && repo.default_branch === 'main' &&
    repo.archived === false && repo.disabled === false && tuple(event.pull_request) === tuple(pull) &&
    pull.id === accepted.pull_id && pull.number === accepted.pull_number && pull.state === 'open' &&
    pull.merged === false && pull.draft === false && pull.base.repo?.id === REPO_ID &&
    pull.head.repo?.id === REPO_ID && pull.base.repo?.full_name === REPO &&
    pull.head.repo?.full_name === REPO && pull.base.ref === 'main' &&
    pull.base.sha === accepted.base && pull.head.sha === accepted.head &&
    pull.head.ref === accepted.head_ref && pull.changed_files === record.manifest.length &&
    positive(pull.commits), 'PR tuple is stale, forked or unsupported');
  need(event.execution_base === accepted.base && await api.getBranchHead('main') === accepted.base,
    'execution base is not live protected main');
  const ancestry = await api.compare(accepted.base, accepted.head);
  need(ancestry?.status === 'ahead' && ancestry.merge_base_commit?.sha === accepted.base &&
    ancestry.behind_by === 0 && ancestry.ahead_by > 0, 'head is not a same-base descendant');
  const protection = await api.getEffectiveProtections();
  verifyPortableProtections(protection);
  need(digest(json(protection)) === accepted.expected_protections_digest,
    'effective protections drifted');
  const owner = await api.getCollaboratorPermission(accepted.owner_login);
  need(owner?.permission === 'admin' && owner.user?.id === accepted.owner_id &&
    owner.user?.login === accepted.owner_login, 'owner is not current admin');
  const decision = await api.getDecisionComment(accepted.decision_comment_id);
  const review = await api.getDecisionComment(accepted.review_comment_id);
  for (const [comment, id, body, issue, actorId, actorLogin] of [
    [decision, accepted.decision_comment_id, json(accepted), accepted.pull_number,
      accepted.owner_id, accepted.owner_login],
    [review, accepted.review_comment_id, reviewBody(record, accepted), accepted.pull_number,
      accepted.reviewer_id, accepted.reviewer_login]]) {
    need(comment?.id === id && comment.user?.type === 'User' &&
      comment.user.id === actorId && comment.user.login === actorLogin &&
      comment.issue_url === `https://api.github.com/repos/${REPO}/issues/${issue}` &&
      comment.body === body, 'independent human comment differs');
  }
  const pages = await api.getPullFiles(accepted.pull_number);
  need(Array.isArray(pages) && pages.length <= 30 && pages.length > 0 &&
    pages.every((page) => Array.isArray(page) && page.length <= 100), 'file pages are incomplete');
  const files = pages.flat();
  need(files.length === 24 && new Set(files.map((file) => file.filename)).size === files.length,
    'file inventory differs');
  for (const row of record.manifest) {
    const file = files.find((item) => item.filename === row.path);
    const expected = accepted.direction === 'forward' ? row :
      { status: row.old === null ? 'removed' : 'modified', new: row.old };
    need(file?.status === expected.status && file.previous_filename === undefined &&
      (expected.new === null || file.sha === expected.new.blob), 'API file differs from manifest');
  }
  const base = await readTree(accepted.base, api), head = await readTree(accepted.head, api);
  need(classifyPortableTransition(base, head, record) === `portable-${accepted.direction}`,
    'immutable tree differs from complete portable tuple');
  for (const entry of accepted.closure) {
    const expected = { type: 'blob', mode: '100644', blob: entry.blob,
      bytes: entry.bytes, sha256: entry.sha256 };
    need(json(base.get(entry.path)) === json(expected) && json(head.get(entry.path)) === json(expected),
      'installed G or imported closure differs');
  }
  const data = accepted.closure.find((entry) => entry.path === 'governance/docs-portable-authority-r322.json');
  need(data.sha256 === digest(await api.getInstalledRecord()), 'installed record bytes differ');
  if (accepted.direction === 'inverse') {
    const retained = await api.getDecisionComment(accepted.forward_decision_comment_id);
    const forward = parsePortableJson(Buffer.from(retained?.body ?? ''), 'retained portable forward');
    validatePortableAcceptance(forward, record, deadline(forward.deadline) - 1000);
    need(forward.direction === 'forward' && forward.decision_comment_id === retained.id &&
      retained.user?.id === accepted.owner_id && retained.user?.login === accepted.owner_login &&
      forward.owner_id === accepted.owner_id && forward.owner_login === accepted.owner_login &&
      retained.issue_url === `https://api.github.com/repos/${REPO}/issues/${forward.pull_number}` &&
      retained.body === json(forward) && forward.manifest_digest === accepted.manifest_digest &&
      json(forward.closure) === json(accepted.closure), 'retained forward decision differs');
    const forwardReview = await api.getDecisionComment(forward.review_comment_id);
    need(forwardReview?.id === forward.review_comment_id &&
      forwardReview.user?.id === forward.reviewer_id &&
      forwardReview.user?.login === forward.reviewer_login &&
      forwardReview.user?.type === 'User' &&
      forwardReview.issue_url === `https://api.github.com/repos/${REPO}/issues/${forward.pull_number}` &&
      forwardReview.body === reviewBody(record, forward),
    'retained forward review differs');
    const merged = await api.getPull(forward.pull_number);
    need(merged?.id === forward.pull_id && merged.number === forward.pull_number &&
      merged.state === 'closed' && merged.merged === true && merged.draft === false &&
      merged.head?.sha === forward.head && merged.head.ref === forward.head_ref &&
      merged.head.repo?.id === REPO_ID && merged.head.repo.full_name === REPO &&
      merged.base?.sha === forward.base && merged.base.ref === 'main' &&
      merged.base.repo?.id === REPO_ID && merged.base.repo.full_name === REPO &&
      SHA.test(merged.merge_commit_sha) &&
      typeof merged.merged_at === 'string' && Number.isFinite(Date.parse(merged.merged_at)),
    'forward PR is not authentically merged');
    const mergedAt = Date.parse(merged.merged_at);
    need([retained, forwardReview].every((comment) =>
      typeof comment.created_at === 'string' && typeof comment.updated_at === 'string' &&
      Number.isFinite(Date.parse(comment.created_at)) &&
      Date.parse(comment.created_at) <= Date.parse(comment.updated_at) &&
      Date.parse(comment.updated_at) <= mergedAt),
    'retained forward decision or review postdates installation');
    const installed = merged.merge_commit_sha;
    const related = await api.compare(forward.base, installed);
    need(related?.status === 'ahead' && related.merge_base_commit?.sha === forward.base,
      'merged installation does not descend from forward base');
    if (installed !== accepted.base) {
      const later = await api.compare(installed, accepted.base);
      need(later?.status === 'ahead' && later.merge_base_commit?.sha === installed,
        'installed forward is not inverse base ancestor');
    }
    const original = await readTree(forward.base, api), mergedTree = await readTree(installed, api);
    need(classifyPortableTransition(original, mergedTree, record) === 'portable-forward',
      'squash-installed forward tree differs');
    for (const entry of accepted.closure) {
      const expected = { type: 'blob', mode: '100644', blob: entry.blob,
        bytes: entry.bytes, sha256: entry.sha256 };
      need(json(original.get(entry.path)) === json(expected) &&
        json(mergedTree.get(entry.path)) === json(expected),
      'retained forward installed G closure differs');
    }
    for (const row of record.manifest) {
      need(json(base.get(row.path)) === json(row.new), 'inverse base rewrote forward postimage');
    }
    need(json(await api.getPull(forward.pull_number)) === json(merged) &&
      json(await api.getDecisionComment(accepted.forward_decision_comment_id)) === json(retained),
    'retained forward provenance moved');
    need(json(await api.getDecisionComment(forward.review_comment_id)) === json(forwardReview),
      'retained forward review moved');
  }
  need(json(await api.getRepository()) === json(repo) &&
    tuple(await api.getPull(accepted.pull_number)) === tuple(pull) &&
    await api.getBranchHead('main') === accepted.base &&
    json(await api.getCollaboratorPermission(accepted.owner_login)) === json(owner) &&
    json(await api.getDecisionComment(accepted.decision_comment_id)) === json(decision) &&
    json(await api.getDecisionComment(accepted.review_comment_id)) === json(review) &&
    digest(json(await api.getEffectiveProtections())) === accepted.expected_protections_digest &&
    deadline(accepted.deadline) > clock(), 'final protected observations moved');
  return { status: 'exact_portable_candidate_verified', direction: accepted.direction,
    base: accepted.base, head: accepted.head };
}

async function gh(path) {
  const { stdout } = await exec('gh', ['api', path],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 60_000 });
  return JSON.parse(stdout);
}
export function makePortableApi(read = gh, recordPath = new URL('../governance/docs-portable-authority-r322.json', import.meta.url)) {
  const at = (path) => read(`repos/${REPO}/${path}`);
  return {
    getInstalledRecord: () => readFile(recordPath),
    getRepository: () => read(`repos/${REPO}`),
    getPull: (number) => at(`pulls/${number}`),
    getBranchHead: async (branch) => (await at(`branches/${branch}`)).commit.sha,
    compare: (base, head) => at(`compare/${base}...${head}`),
    getEffectiveProtections: () => readEffectiveProtections(async (path) => {
      try {return await read(path);}
      catch (error) {
        if (path === `repos/${REPO}/branches/main/protection` &&
          /HTTP 404\b/u.test(error?.stderr ?? '')) {error.status = 404;}
        throw error;
      }
    }),
    getCollaboratorPermission: (login) => at(`collaborators/${login}/permission`),
    getDecisionComment: (id) => at(`issues/comments/${id}`),
    getPullFiles: async (number) => {
      const pages = [];
      for (let page = 1; page <= 31; page++) {
        const rows = await at(`pulls/${number}/files?per_page=100&page=${page}`);
        need(Array.isArray(rows) && rows.length <= 100, 'invalid file API page');
        if (page === 31) {
          need(rows.length === 0, 'file pagination exceeded 3000');
          return pages;
        }
        pages.push(rows);
        if (rows.length < 100) {return pages;}
      }
      throw new Error('file pagination exceeded 3000');
    },
    getTree: async (revision) => {
      const commit = await at(`git/commits/${revision}`);
      need(commit.sha === revision && SHA.test(commit.tree?.sha), 'commit identity differs');
      return { commit, tree: await at(`git/trees/${commit.tree.sha}?recursive=1`) };
    },
    getBlob: async (sha) => {
      const item = await at(`git/blobs/${sha}`);
      need(item?.encoding === 'base64' && typeof item.content === 'string', 'blob response differs');
      return Buffer.from(item.content.replace(/\s/gu, ''), 'base64');
    },
  };
}

async function run() {
  const event = parseIncidentJson(await readFile(process.env.GITHUB_EVENT_PATH), 'event');
  event.execution_base = process.env.GITHUB_SHA;
  event.run_id = Number(process.env.GITHUB_RUN_ID);
  event.run_attempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  const api = makePortableApi();
  const record = validatePortableRecord(await api.getInstalledRecord());
  const pages = await api.getPullFiles(event.pull_request?.number);
  const files = pages.flat();
  const mode = classifyPortableIntent(files, record);
  if (process.argv[2] === '--classify') {
    need(files.length === event.pull_request?.changed_files && files.length <= 3000,
      'classification file inventory differs');
    process.stdout.write(`${mode}\n`);
    return;
  }
  need(mode === 'portable', 'portable branch selected for nonportable PR');
  const id = process.env.DOCS_PORTABLE_R322_ACCEPTED_COMMENT_ID;
  need(/^[1-9][0-9]{0,15}$/u.test(id ?? ''), 'accepted comment is unbound');
  const comment = await api.getDecisionComment(Number(id));
  const accepted = parsePortableJson(Buffer.from(comment?.body ?? ''), 'portable acceptance');
  need(accepted.decision_comment_id === Number(id), 'accepted comment ID differs');
  process.stdout.write(json(await verifyPortableExecution(event, accepted, api)) + '\n');
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {await run();}
