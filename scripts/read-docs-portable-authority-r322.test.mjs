import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { parsePortableJson, validatePortableRecord, verifyPortableProtections } from './docs-portable-authority-r322.mjs';
import { classifyPortableIntent, makePortableApi, validatePortableAcceptance, verifyPortableExecution } from './read-docs-portable-authority-r322.mjs';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const record = validatePortableRecord(Buffer.from(read('governance/docs-portable-authority-r322.json')));
const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
function candidateBlob(blob) {
  try {return execFileSync('git', ['cat-file', 'blob', blob], { stdio: ['ignore', 'pipe', 'pipe'] });}
  catch {
    const ref = 'refs/heads/chore/node26-compat-workflows';
    execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', ref]);
    assert.equal(execFileSync('git', ['rev-parse', 'FETCH_HEAD'], { encoding: 'utf8' }).trim(),
      record.content_candidate, 'fetched corrected candidate ref moved');
    return execFileSync('git', ['cat-file', 'blob', blob]);
  }
}
const G = ['.github/workflows/docs-portable-authority-r322.yml', 'docs/node26-portable-authority-r322.md',
  'governance/docs-portable-authority-r322.json', 'scripts/docs-portable-authority-r322.mjs',
  'scripts/docs-portable-authority-r322.test.mjs', 'scripts/read-docs-portable-authority-r322.mjs',
  'scripts/read-docs-portable-authority-r322.test.mjs', 'scripts/docs-legacy-admission-recovery.mjs',
  'scripts/verify-docs-platform-recovery-installation-r317.mjs'];
const now = Date.parse('2026-09-28T12:00:00Z');
const accepted = () => ({
  schema_version: 1, repository: 'agent-teams-ai/.github', repository_id: 1316243981,
  pull_number: 322, pull_id: 1, branch: 'main', head_ref: 'portable-r322',
  base: '1'.repeat(40), head: '2'.repeat(40), direction: 'forward',
  manifest_digest: sha(JSON.stringify(record.manifest)),
  closure: G.map((path) => ({ path, blob: '3'.repeat(40), bytes: 1,
    sha256: `sha256:${'4'.repeat(64)}` })),
  run_id: 1, run_attempt: 1, decision_comment_id: 1, owner_id: 1, owner_login: 'owner',
  review_comment_id: 2, reviewer_id: 2, reviewer_login: 'reviewer',
  deadline: '2026-09-29T00:00:00Z',
  expected_protections_digest: `sha256:${'5'.repeat(64)}`,
  forward_decision_comment_id: null,
});
const reviewedCoordinates = (value) => Object.fromEntries(Object.entries(value)
  .filter(([key]) => !['decision_comment_id', 'review_comment_id'].includes(key)));
test('acceptance is closed, current, exact, and direction-specific', () => {
  assert.throws(() => parsePortableJson(Buffer.from('{"id":1,"id":2}'), 'acceptance'));
  assert.throws(() => parsePortableJson(Buffer.from('['.repeat(17) + '0' + ']'.repeat(17)), 'acceptance'));
  assert.equal(validatePortableAcceptance(accepted(), record, now).pull_number, 322);
  for (const mutation of [
    { extra: true }, { run_id: 0 }, { run_id: Number.MAX_SAFE_INTEGER + 1 },
    { pull_number: 321 }, { head: '0'.repeat(40) }, { owner_id: 0 },
    { manifest_digest: `sha256:${'6'.repeat(64)}` },
    { deadline: '2026-09-30T00:00:00Z' },
    { review_comment_id: 1 }, { reviewer_id: 1 },
    { expected_protections_digest: `sha256:${'0'.repeat(64)}` },
  ]) {assert.throws(() => validatePortableAcceptance({ ...accepted(), ...mutation }, record, now));}
  const inverse = { ...accepted(), direction: 'inverse', pull_number: 323,
    forward_decision_comment_id: 3 };
  assert.equal(validatePortableAcceptance(inverse, record, now).direction, 'inverse');
  assert.throws(() => validatePortableAcceptance({ ...inverse, forward_decision_comment_id: null }, record, now));
  assert.throws(() => validatePortableAcceptance(accepted(), record, now + 86400_000));
});
test('unbound reviewer identity refuses before API authority observations', async () => {
  const api = { getInstalledRecord: async () => Buffer.from(read('governance/docs-portable-authority-r322.json')),
    getRepository: () => {throw Error('must not read repository');} };
  await assert.rejects(verifyPortableExecution({}, { ...accepted(), reviewer_id: 0 }, api,
    () => now), /accepted execution coordinates differ/u);
});
test('seven G paths select portable while imported and historical paths retain V8', () => {
  assert.equal(classifyPortableIntent([{ filename: 'docs/ordinary.md' }], record), 'legacy');
  const pair = record.manifest.map((row) => ({ filename: row.path }));
  for (const files of [pair, [...pair, { filename: 'extra.md' }]]) {assert.equal(classifyPortableIntent(files, record), 'portable');}
  for (const path of G.slice(0, 7)) {
    assert.equal(classifyPortableIntent([{ filename: path }], record), 'portable');
    assert.equal(classifyPortableIntent([{ filename: 'renamed.md', previous_filename: path }], record),
      'portable');
  }
  for (const path of [...G.slice(7), ...record.manifest.map((row) => row.path)]) {
    assert.equal(classifyPortableIntent([{ filename: path }], record), 'legacy', path);
  }
});
test('protected check cutover requires the two exact new App contexts', () => {
  const detail = { id: 19979783, name: 'Protect main', target: 'branch',
    enforcement: 'active', bypass_actors: [],
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: ['deletion', 'non_fast_forward', 'required_linear_history', 'pull_request']
      .map((type) => ({ type })).concat([{ type: 'required_status_checks', parameters: {
        strict_required_status_checks_policy: true, required_status_checks: [
          'check', 'trusted-admission-evidence', 'trusted-authority-evolution',
          'trusted-admission-authority-evolution-v1', 'trusted-cohort-authority-evolution-v8',
          'trusted-validation'].map((context) => ({ context, integration_id: 15368 })),
      } }]),
  };
  const snapshot = { rulesets: [{ summary: { id: detail.id, name: detail.name,
    enforcement: detail.enforcement }, detail }], classic_branch_protection: null };
  assert.throws(() => verifyPortableProtections(snapshot));
  const checks = detail.rules.find((rule) => rule.type === 'required_status_checks')
    .parameters.required_status_checks;
  checks.find((check) => check.context === 'trusted-cohort-authority-evolution-v8').context =
    'trusted-cohort-authority-portable-r322';
  checks.find((check) => check.context === 'trusted-validation').context =
    'trusted-validation-portable-r322';
  verifyPortableProtections(snapshot);
  checks.push({ context: 'trusted-validation', integration_id: 15368 }); assert.throws(() => verifyPortableProtections(snapshot)); checks.pop();
  snapshot.rulesets[0].summary.id = 1;
  assert.throws(() => verifyPortableProtections(snapshot));
  snapshot.rulesets[0].summary.id = detail.id;
  checks[0].integration_id = 1;
  assert.throws(() => verifyPortableProtections(snapshot));
});
test('read port completes pages and decodes blobs without publishing or writing', async () => {
  const calls = [];
  const api = makePortableApi(async (path) => {
    calls.push(path);
    if (path.includes('/files?')) {
      return path.endsWith('page=1') ? Array.from({ length: 100 }, (_, index) => ({ filename: `f${index}` })) : [];
    }
    if (path.includes('/git/blobs/')) {return { encoding: 'base64', content: 'YWJj' };}
    throw Error('unexpected read');
  });
  assert.equal((await api.getPullFiles(322)).flat().length, 100);
  assert.equal((await api.getBlob('1'.repeat(40))).toString(), 'abc');
  assert.deepEqual(calls, [
    'repos/agent-teams-ai/.github/pulls/322/files?per_page=100&page=1',
    'repos/agent-teams-ai/.github/pulls/322/files?per_page=100&page=2',
    `repos/agent-teams-ai/.github/git/blobs/${'1'.repeat(40)}`]);
});
test('file port accepts exactly 3000 entries only with an empty terminal page', async () => {
  const page = Array.from({ length: 100 }, (_, index) => ({ filename: `f${index}` }));
  const api = makePortableApi(async (path) => path.endsWith('page=31') ? [] : page);
  assert.equal((await api.getPullFiles(322)).flat().length, 3000);
  const extra = makePortableApi(async () => page);
  await assert.rejects(extra.getPullFiles(322), /exceeded 3000/u);
});
function gitTree(files, revision) {
  const root = new Map(), entries = [];
  for (const [path, value] of files) {
    const parts = path.split('/'); let parent = root;
    for (const part of parts.slice(0, -1)) {
      if (!parent.has(part)) {parent.set(part, new Map());}
      parent = parent.get(part);
    }
    parent.set(parts.at(-1), value);
  }
  function directory(children, prefix) {
    const rows = [];
    for (const [name, value] of children) {
      const path = prefix ? `${prefix}/${name}` : name;
      const entry = value instanceof Map ? { path, type: 'tree', mode: '040000',
        sha: directory(value, path) } : { path, type: 'blob', mode: value.mode,
        sha: value.blob, size: value.bytes };
      entries.push(entry); rows.push({ ...entry, name });
    }
    rows.sort((a, b) => Buffer.compare(Buffer.from(a.name + (a.type === 'tree' ? '/' : '')),
      Buffer.from(b.name + (b.type === 'tree' ? '/' : ''))));
    const bytes = Buffer.concat(rows.flatMap((entry) => [
      Buffer.from(`${entry.mode.replace(/^0/u, '')} ${entry.name}\0`), Buffer.from(entry.sha, 'hex')]));
    return createHash('sha1').update(`tree ${bytes.length}\0`).update(bytes).digest('hex');
  }
  const treeSha = directory(root, '');
  return { commit: { sha: revision, tree: { sha: treeSha } },
    tree: { sha: treeSha, truncated: false, tree: entries } };
}
function executionFixture() {
  const repo = { id: 1316243981, full_name: 'agent-teams-ai/.github', default_branch: 'main',
    archived: false, disabled: false };
  const bodies = new Map();
  const identity = (bytes) => {
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    bodies.set(blob, bytes);
    return { type: 'blob', mode: '100644', blob, bytes: bytes.length, sha256: sha(bytes) };
  };
  const baseFiles = new Map(), headFiles = new Map();
  const closure = G.map((path) => {
    const value = identity(Buffer.from(read(path)));
    baseFiles.set(path, value); headFiles.set(path, value);
    return { path, blob: value.blob, bytes: value.bytes, sha256: value.sha256 };
  });
  for (const row of record.manifest) {
    if (row.old) {
      const bytes = candidateBlob(row.old.blob);
      assert.deepEqual(identity(bytes), row.old);
      baseFiles.set(row.path, row.old);
    }
    const bytes = candidateBlob(row.new.blob);
    assert.deepEqual(identity(bytes), row.new);
    headFiles.set(row.path, row.new);
  }
  const contextNames = ['check', 'trusted-admission-evidence', 'trusted-authority-evolution',
    'trusted-admission-authority-evolution-v1', 'trusted-cohort-authority-portable-r322',
    'trusted-validation-portable-r322'];
  const detail = { id: 19979783, name: 'Protect main', target: 'branch', enforcement: 'active',
    bypass_actors: [], conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: ['deletion', 'non_fast_forward', 'required_linear_history', 'pull_request']
      .map((type) => ({ type })).concat([{ type: 'required_status_checks', parameters: {
        strict_required_status_checks_policy: true,
        required_status_checks: contextNames.map((context) => ({ context, integration_id: 15368 })),
      } }]),
  };
  const protections = { rulesets: [{ summary: { id: detail.id, name: detail.name,
    enforcement: detail.enforcement }, detail }], classic_branch_protection: null };
  const decision = { ...accepted(), closure, expected_protections_digest: sha(JSON.stringify(protections)) };
  const pull = { id: decision.pull_id, number: 322, state: 'open', merged: false, draft: false,
    changed_files: 24, commits: 1, updated_at: '2026-09-28T11:00:00Z',
    base: { sha: decision.base, ref: 'main', repo },
    head: { sha: decision.head, ref: decision.head_ref, repo } };
  const event = { action: 'synchronize', repository: repo, pull_request: structuredClone(pull),
    execution_base: decision.base, run_id: decision.run_id, run_attempt: decision.run_attempt };
  const url = 'https://api.github.com/repos/agent-teams-ai/.github/issues/322';
  const api = {
    getInstalledRecord: async () => Buffer.from(read('governance/docs-portable-authority-r322.json')),
    getRepository: async () => repo,
    getPull: async () => pull,
    getBranchHead: async () => decision.base,
    compare: async (from) => ({ status: 'ahead', merge_base_commit: { sha: from },
      behind_by: 0, ahead_by: 1 }),
    getEffectiveProtections: async () => protections,
    getCollaboratorPermission: async () => ({ permission: 'admin',
      user: { id: 1, login: 'owner' } }),
    getDecisionComment: async (id) => id === 1 ? { id, user: { id: 1, login: 'owner', type: 'User' },
      created_at: '2026-09-28T11:00:00Z', updated_at: '2026-09-28T11:00:00Z',
      issue_url: url, body: JSON.stringify(decision) } : { id, user: {
      id: 2, login: 'reviewer', type: 'User' }, issue_url: url,
      created_at: '2026-09-28T10:59:00Z', updated_at: '2026-09-28T10:59:00Z',
      body: JSON.stringify({ decision: 'accept-reviewed-corrected-portable-content',
        source_base: record.source_base, content_candidate: record.content_candidate,
        ...reviewedCoordinates(decision) }) },
    getPullFiles: async () => [record.manifest.map((row) => ({ filename: row.path,
      status: row.status, sha: row.new.blob }))],
    getTree: async (revision) => gitTree(revision === decision.base ? baseFiles : headFiles, revision),
    getBlob: async (blob) => bodies.get(blob),
  };
  return { decision, event, api, protections, baseFiles, headFiles, bodies };
}
test('complete reviewed forward passes reconstructed tree and all final rereads', async () => {
  const fixture = executionFixture();
  fixture.event.pull_request.updated_at = '2026-09-28T10:50:00Z';
  assert.equal((await verifyPortableExecution(fixture.event, fixture.decision, fixture.api,
    () => now)).status, 'exact_portable_candidate_verified');
});
test('provider, owner, review, closure and protection mutations fail', async () => {
  for (const mutate of [
    (f) => {f.event.run_attempt++;},
    (f) => {f.event.pull_request.head.sha = 'f'.repeat(40);},
    (f) => {f.decision.closure[0].blob = '9'.repeat(40);},
    (f) => {f.api.getCollaboratorPermission = async () => ({ permission: 'write',
      user: { id: 1, login: 'owner' } });},
    (f) => {f.api.getDecisionComment = async () => null;},
    (f) => {const readComment = f.api.getDecisionComment;
      f.api.getDecisionComment = async (id) => {
        const comment = await readComment(id);
        return id === 2 ? { ...comment, body: comment.body.replace(f.decision.head, 'f'.repeat(40)) } :
          comment;
      };},
    (f) => {f.protections.rulesets[0].detail.bypass_actors.push({ actor_id: 1 });},
    (f) => {f.api.getPullFiles = async () => [[]];},
    (f) => {f.api.getPullFiles = async () => [[{ filename: record.manifest[0].path,
      status: 'renamed', previous_filename: 'old.txt' }]];},
    (f) => {f.api.getPullFiles = async () => [record.manifest.map((row) => ({
      filename: row.path, status: row.status, sha: 'f'.repeat(40) }))];},
    (f) => {f.api.getBlob = async () => Buffer.from('wrong');},
    (f) => {f.headFiles.set('extra.txt', f.headFiles.get('README.md'));},
    (f) => {f.headFiles.set(G[3], f.headFiles.get(record.manifest[0].path));},
    (f) => {f.api.getTree = async (revision) => ({ ...gitTree(f.baseFiles, revision),
      tree: { ...gitTree(f.baseFiles, revision).tree, truncated: true } });},
    (f) => {f.api.compare = async () => ({ status: 'diverged',
      merge_base_commit: { sha: 'f'.repeat(40) } });},
  ]) {
    const fixture = executionFixture(); mutate(fixture);
    await assert.rejects(verifyPortableExecution(fixture.event, fixture.decision, fixture.api,
      () => now));
  }
});
test('independent review binds the full execution and precedes admin acceptance', async () => {
  for (const mutate of [
    (body) => {body.run_attempt++;},
    (body) => {body.expected_protections_digest = `sha256:${'6'.repeat(64)}`;},
    (body) => {body.closure[0].sha256 = `sha256:${'6'.repeat(64)}`;},
  ]) {
    const fixture = executionFixture();
    const review = await fixture.api.getDecisionComment(2), body = JSON.parse(review.body);
    mutate(body); review.body = JSON.stringify(body);
    const original = fixture.api.getDecisionComment;
    fixture.api.getDecisionComment = async (id) => id === 2 ? review : original(id);
    await assert.rejects(verifyPortableExecution(fixture.event, fixture.decision, fixture.api,
      () => now), /independent human comment differs/u);
  }
  for (const [id, field, value] of [
    [2, 'updated_at', '2026-09-28T11:01:00Z'], [1, 'created_at', '2026-09-28T10:58:00Z'],
    [1, 'updated_at', '2026-09-28T12:01:00Z'],
  ]) {
    const fixture = executionFixture();
    const original = fixture.api.getDecisionComment;
    fixture.api.getDecisionComment = async (commentId) => {
      const comment = await original(commentId);
      return commentId === id ? { ...comment, [field]: value } : comment;
    };
    await assert.rejects(verifyPortableExecution(fixture.event, fixture.decision, fixture.api,
      () => now), /chronology/u);
  }
});
test('final rereads reject admin revocation, comment movement and protection drift', async () => {
  for (const method of ['getCollaboratorPermission', 'getDecisionComment',
    'getEffectiveProtections', 'getPull', 'getBranchHead']) {
    const fixture = executionFixture();
    const original = fixture.api[method];
    let calls = 0;
    fixture.api[method] = async (...args) => {
      const result = await original(...args);
      calls++;
      if (method === 'getDecisionComment' && calls <= 2) {return result;}
      if (method !== 'getDecisionComment' && calls === 1) {return result;}
      if (method === 'getBranchHead') {return 'f'.repeat(40);}
      if (method === 'getPull') {return { ...result, updated_at: '2026-09-28T12:01:00Z' };}
      if (method === 'getEffectiveProtections') {return { ...result, classic_branch_protection: {} };}
      if (method === 'getCollaboratorPermission') {return { ...result, permission: 'write' };}
      return { ...result, body: 'revoked' };
    };
    await assert.rejects(verifyPortableExecution(fixture.event, fixture.decision, fixture.api,
      () => now), `final movement: ${method}`);
  }
});
function inverseFixture() {
  const fixture = executionFixture();
  const forward = { ...fixture.decision, decision_comment_id: 3 };
  const inverse = { ...fixture.decision, direction: 'inverse', pull_number: 323,
    pull_id: 2, base: '3'.repeat(40), head: '4'.repeat(40), head_ref: 'inverse-r322',
    decision_comment_id: 4, review_comment_id: 5, forward_decision_comment_id: 3 };
  const currentPull = { ...fixture.event.pull_request, id: 2, number: 323,
    base: { ...fixture.event.pull_request.base, sha: inverse.base },
    head: { ...fixture.event.pull_request.head, sha: inverse.head, ref: inverse.head_ref } };
  const mergedPull = { ...fixture.event.pull_request, state: 'closed', merged: true,
    merge_commit_sha: '5'.repeat(40), merged_at: '2026-09-28T11:20:00Z' };
  const oldFiles = fixture.baseFiles, newFiles = fixture.headFiles;
  fixture.event.pull_request = structuredClone(currentPull);
  fixture.event.execution_base = inverse.base;
  fixture.api.getPull = async (number) => number === 323 ? currentPull : mergedPull;
  fixture.api.getBranchHead = async () => inverse.base;
  fixture.api.getTree = async (revision) => gitTree([
    inverse.base, mergedPull.merge_commit_sha, forward.head].includes(revision) ?
    newFiles : oldFiles, revision);
  fixture.api.getPullFiles = async () => [record.manifest.map((row) => ({
    filename: row.path, status: row.old === null ? 'removed' : 'modified',
    sha: row.old?.blob }))];
  fixture.api.getDecisionComment = async (id) => {
    const issue = id === 4 || id === 5 ? 323 : 322;
    const isReview = id === 2 || id === 5;
    const reviewed = id === 2 ? forward : inverse;
    return { id, issue_url: `https://api.github.com/repos/agent-teams-ai/.github/issues/${issue}`,
      created_at: '2026-09-28T11:10:00Z', updated_at: '2026-09-28T11:10:00Z',
      user: isReview ? { id: 2, login: 'reviewer', type: 'User' } :
        { id: 1, login: 'owner', type: 'User' },
      body: isReview ? JSON.stringify({ decision: 'accept-reviewed-corrected-portable-content',
        source_base: record.source_base, content_candidate: record.content_candidate,
        ...reviewedCoordinates(reviewed) }) :
        JSON.stringify(id === 3 ? forward : inverse) };
  };
  return { fixture, inverse, forward, mergedPull, newFiles };
}
test('inverse accepts distinct squash commit and restores all preimages', async () => {
  const { fixture, inverse } = inverseFixture();
  assert.equal((await verifyPortableExecution(fixture.event, inverse, fixture.api,
    () => now)).direction, 'inverse');
});
test('inverse rejects rewritten installed postimage and unrelated merge', async () => {
  const rewritten = inverseFixture();
  rewritten.newFiles.set(record.manifest[0].path, rewritten.fixture.baseFiles.get(record.manifest[0].path));
  await assert.rejects(verifyPortableExecution(rewritten.fixture.event, rewritten.inverse,
    rewritten.fixture.api, () => now));
  const unrelated = inverseFixture();
  unrelated.fixture.api.compare = async () => ({ status: 'diverged', merge_base_commit: { sha: 'f'.repeat(40) } });
  await assert.rejects(verifyPortableExecution(unrelated.fixture.event, unrelated.inverse,
    unrelated.fixture.api, () => now));
});
test('inverse refuses a forward decision or review created or edited after merge', async () => {
  for (const id of [2, 3]) for (const field of ['created_at', 'updated_at']) {
    const { fixture, inverse } = inverseFixture();
    const original = fixture.api.getDecisionComment;
    fixture.api.getDecisionComment = async (commentId) => {
      const comment = await original(commentId);
      return commentId === id ? { ...comment, [field]: '2026-09-28T11:25:00Z' } : comment;
    };
    await assert.rejects(verifyPortableExecution(fixture.event, inverse, fixture.api,
      () => now), /postdates installation/u);
  }
});
const workflow = YAML.parse(read('.github/workflows/docs-portable-authority-r322.yml'));
const oldV8 = YAML.parse(read('.github/workflows/docs-cohort-authority-evolution-v8.yml'));
const oldValidation = YAML.parse(read('.github/workflows/docs-cohort-append-only.yml'));
const finalIds = ['trusted_cohort_authority_portable_r322', 'trusted_validation_portable_r322'];
function verifyValidation(steps) {
  const before = structuredClone(oldValidation.jobs['trusted-validation'].steps), after = structuredClone(steps);
  const proof = after.find((step) => step.name === 'Prove selected Node runtime');
  assert.deepEqual(proof, { name: 'Prove selected Node runtime', if: "steps.materialize.outputs.mode == 'full'", env: { EXPECTED_NODE_VERSION: '24.18.0' },
    run: `node -e "if (process.version !== 'v' + process.env.EXPECTED_NODE_VERSION) throw Error('Node runtime mismatch')"` });
  if (!before.some((step) => step.name === proof.name)) {before.splice(before.findIndex((step) => step.id === 'pnpm-v2'), 0, proof);}
  const install = after.find((step) => step.name === 'Install trusted base dependencies with Cohort v1 pnpm');
  for (const rule of [/--config\.engine-strict=true/u, /--config\.strict-peer-dependencies=true/u, /"\$DOCS_COHORT_PNPM_V1_BIN" peers check/u]) {assert.match(install.run, rule);}
  install.run = before.find((step) => step.name === install.name).run; assert.deepEqual(after, before);
}
test('copied legacy branches retain real predecessor bodies and strict install', () => {
  assert.deepEqual(workflow.jobs.legacy_v8.steps, oldV8.jobs['trusted-cohort-authority-evolution-v8'].steps);
  verifyValidation(workflow.jobs.legacy_validation.steps);
  assert.equal(workflow.jobs.legacy_v8.if, "needs.route.outputs.mode == 'legacy'");
  assert.equal(workflow.jobs.legacy_validation.if, "needs.route.outputs.mode == 'legacy'");
});
test('both final contexts require exactly the successful selected branch', () => {
  for (const id of finalIds) {
    const job = workflow.jobs[id];
    assert.equal(job.if, 'always()');
    assert.deepEqual(job.needs, id.startsWith('trusted_cohort') ?
      ['route', 'portable', 'legacy_v8'] : ['route', 'portable', 'legacy_validation']);
    const script = job.steps[0].run;
    for (const [mode, portable, legacy, success] of [
      ['portable', 'success', 'skipped', true], ['legacy', 'skipped', 'success', true],
      ['portable', 'skipped', 'skipped', false], ['portable', 'cancelled', 'skipped', false],
      ['portable', 'failure', 'skipped', false], ['legacy', 'skipped', 'failure', false],
      ['legacy', 'success', 'success', false], ['', 'skipped', 'skipped', false],
    ]) {
      let passed = true;
      try {execFileSync('bash', ['-euo', 'pipefail', '-c', script], {
        env: { ...process.env, ROUTE: 'success', MODE: mode, PORTABLE: portable, LEGACY: legacy },
        stdio: 'ignore',
      });} catch {passed = false;}
      assert.equal(passed, success, `${id}: ${mode}/${portable}/${legacy}`);
    }
  }
});
function auditWorkflow(candidate) {
  assert.deepEqual(candidate.on.pull_request_target.types,
    ['opened', 'synchronize', 'reopened', 'edited', 'ready_for_review']);
  assert.deepEqual(candidate.permissions, {
    actions: 'read', checks: 'read', contents: 'read', 'pull-requests': 'read' });
  assert.deepEqual(candidate.jobs.legacy_v8.steps,
    oldV8.jobs['trusted-cohort-authority-evolution-v8'].steps);
  assert.equal(candidate.jobs.legacy_v8.if, "needs.route.outputs.mode == 'legacy'");
  assert.equal(candidate.jobs.legacy_validation.if, "needs.route.outputs.mode == 'legacy'");
  assert.equal(candidate.jobs.portable.if, "needs.route.outputs.mode == 'portable'");
  assert.equal(Object.hasOwn(candidate.jobs.route, 'needs'), false);
  assert.equal(candidate.jobs.route.outputs.mode, '${{ steps.classify.outputs.mode }}');
  for (const job of Object.values(candidate.jobs)) {
    assert.notEqual(job['continue-on-error'], true);
    for (const step of job.steps) {
      assert.notEqual(step['continue-on-error'], true);
      if (step.uses) {assert.match(step.uses, /@[a-f0-9]{40}$/u);}
      if (step.uses?.startsWith('actions/checkout@')) {
        assert.equal(step.with.ref, '${{ github.event.pull_request.base.sha }}');
        assert.equal(step.with['persist-credentials'], false);
      }
      if (step.uses?.startsWith('actions/setup-node@')) {
        assert.equal(step.with['node-version'], '24.18.0');
      }
    }
  }
  verifyValidation(candidate.jobs.legacy_validation.steps);
  for (const id of finalIds) {
    assert.equal(candidate.jobs[id].if, 'always()');
    assert.deepEqual(candidate.jobs[id].needs, workflow.jobs[id].needs);
    assert.equal(candidate.jobs[id].steps[0].run, workflow.jobs[id].steps[0].run);
  }
}
test('workflow disablements, head checkout and changed legacy body fail audit', () => {
  auditWorkflow(workflow);
  for (const mutate of [
    (w) => {w.jobs.trusted_cohort_authority_portable_r322.if = 'false';},
    (w) => {w.jobs.trusted_validation_portable_r322.needs = ['route'];},
    (w) => {w.jobs.portable['continue-on-error'] = true;},
    (w) => {w.jobs.legacy_validation.steps.pop();},
    (w) => {w.jobs.route.steps[0].with.ref = '${{ github.event.pull_request.head.sha }}';},
    (w) => {w.jobs.portable.steps[1].with['node-version'] = '26.10.0';},
    (w) => {w.jobs.route.steps[0].uses = 'actions/checkout@main';},
    (w) => {w.permissions.contents = 'write';},
    (w) => {w.jobs.legacy_v8.steps[0].with.script += '\ncore.setFailed("changed");';},
    (w) => {w.jobs.route.outputs.mode = '${{ steps.classify.outcome }}';},
    (w) => {w.jobs.legacy_validation.steps.find((step) => step.name ===
      'Install trusted base dependencies with Cohort v1 pnpm').run = 'true';},
  ]) {
    const changed = structuredClone(workflow);
    mutate(changed);
    assert.throws(() => auditWorkflow(changed));
  }
});
