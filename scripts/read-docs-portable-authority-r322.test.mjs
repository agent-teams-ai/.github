import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as filesystem from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import YAML from 'yaml';
import { classifyPortableTransition, parsePortableJson, portableRecordDigest, validatePortableRecord, verifyPortableBlob, verifyPortableProtections } from './docs-portable-authority-r322.mjs';
import { classifyPortableIntent, makePortableApi, portableReviewBody, validatePortableAcceptance, verifyPortableExecution } from './read-docs-portable-authority-r322.mjs';
import { assertQualityAdoption, deriveLintPaths, readQualityAdoption } from './check-quality-scope.mjs';
import { selectOxlintFiles } from './run-quality-lint.mjs';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const record = validatePortableRecord(Buffer.from(read('governance/docs-portable-authority-r322.json')));
const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const additionBodies = JSON.parse(read('scripts/fixtures/docs-portable-authority-r322/new-additions.json'));
const addedRows = record.manifest.filter((row) => row.old === null);
assert.equal(addedRows.length, 7);
assert.deepEqual(Object.keys(additionBodies).sort(), addedRows.map((row) => row.path).sort());
const historical = JSON.parse(read('scripts/fixtures/docs-portable-authority-r322/old-overrides.json'));
assert.deepEqual(historical.historical_sources, record.historical_sources);
const oldOverrides = new Map(historical.old_overrides.map((entry) => [entry.path, entry]));
const oldBodies = JSON.parse(read('scripts/fixtures/docs-portable-authority-r322/historical-old-bodies.json'));
assert.equal(oldOverrides.size, historical.old_overrides.length);
assert.deepEqual([...oldOverrides.keys()].sort(), record.manifest.filter((row) => row.old)
  .map((row) => row.path).sort());
assert.deepEqual(Object.keys(oldBodies).sort(), [...oldOverrides.keys()].sort());
const forward = JSON.parse(read('scripts/fixtures/docs-portable-authority-r322/new-overrides.json'));
assert.deepEqual(forward.historical_sources, record.historical_sources);
const newOverrides = new Map(forward.new_overrides.map((entry) => [entry.path, entry]));
assert.equal(newOverrides.size, forward.new_overrides.length);
assert.deepEqual([...newOverrides.keys()].sort(), [...oldOverrides.keys()].sort());
function applyEdits(body, edits, path) {
  const lines = body.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  for (const { start, delete: count, insert } of [...edits].reverse()) {
    assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(count) &&
      start >= 0 && count >= 0 && start + count <= lines.length,
    `invalid line edit for ${path}`);
    assert.equal(typeof insert, 'string');
    lines.splice(start, count, insert);
  }
  return lines.join('');
}
function historicalBody(row, side) {
  assert.ok(side === 'old' || side === 'new');
  if (row.old === null) {
    assert.equal(side, 'new');
    const added = Buffer.from(additionBodies[row.path], 'utf8');
    verifyPortableBlob(added, row.new);
    return added;
  }
  const original = Buffer.from(oldBodies[row.path], 'utf8');
  verifyPortableBlob(original, row.old);
  if (side === 'old') {return original;}
  const candidate = Buffer.from(applyEdits(original.toString('utf8'),
    newOverrides.get(row.path).edits, row.path));
  verifyPortableBlob(candidate, row.new);
  const override = oldOverrides.get(row.path);
  let inverse = applyEdits(candidate.toString('utf8'), override.edits, row.path);
  if (override.omit_final_newline) {
    assert.ok(inverse.endsWith('\n'), `expected final newline in ${row.path}`);
    inverse = inverse.slice(0, -1);
  }
  assert.deepEqual(Buffer.from(inverse), original, `historical inverse differs: ${row.path}`);
  return candidate;
}
const G = ['.github/workflows/docs-portable-authority-r322.yml', 'docs/node26-portable-authority-r322.md',
  'governance/docs-portable-authority-r322.json', 'scripts/docs-portable-authority-r322.mjs',
  'scripts/docs-portable-authority-r322.test.mjs', 'scripts/read-docs-portable-authority-r322.mjs',
  'scripts/read-docs-portable-authority-r322.test.mjs', 'scripts/docs-legacy-admission-recovery.mjs',
  'scripts/verify-docs-platform-recovery-installation-r317.mjs'];
test('consolidated additions preserve all seven candidate blob identities and final newlines', () => {
  for (const row of addedRows) {
    assert.equal(typeof additionBodies[row.path], 'string', row.path);
    assert.ok(additionBodies[row.path].endsWith('\n'), row.path);
    const bytes = historicalBody(row, 'new');
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(bytes.length, row.new.bytes, row.path);
    assert.equal(blob, row.new.blob, row.path);
    assert.equal(sha(bytes), row.new.sha256, row.path);
    assert.equal(row.new.mode, '100644', row.path);
  }
});
test('all 21 content paths retain byte-authenticated old and candidate bodies', () => {
  assert.equal(record.manifest.length, 21);
  for (const row of record.manifest) {
    for (const side of ['old', 'new']) {
      if (row[side] === null) {continue;}
      const bytes = historicalBody(row, side);
      const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      assert.equal(bytes.length, row[side].bytes, `${row.path} ${side} bytes`);
      assert.equal(blob, row[side].blob, `${row.path} ${side} blob`);
      assert.equal(sha(bytes), row[side].sha256, `${row.path} ${side} sha256`);
    }
  }
});
const now = Date.parse('2026-09-28T12:00:00Z');
const accepted = () => ({
  schema_version: 2, repository: 'agent-teams-ai/.github', repository_id: 1316243981,
  pull_number: 322, pull_id: 1, branch: 'main', head_ref: 'portable-r322',
  base: '1'.repeat(40), head: '2'.repeat(40), direction: 'forward',
  source_digest: portableRecordDigest(record), manifest_digest: sha(JSON.stringify(record.manifest)),
  closure: G.map((path) => ({ path, blob: '3'.repeat(40), bytes: 1,
    sha256: `sha256:${'4'.repeat(64)}` })),
  run_id: 1, run_attempt: 1, decision_comment_id: 1, owner_id: 1, owner_login: 'owner',
  review_comment_id: 2, reviewer_id: 2, reviewer_login: 'reviewer',
  deadline: '2026-09-29T00:00:00Z',
  expected_protections_digest: `sha256:${'5'.repeat(64)}`,
  forward_decision_comment_id: null,
});
test('acceptance is closed, current, exact, and direction-specific', () => {
  assert.throws(() => parsePortableJson(Buffer.from('{"id":1,"id":2}'), 'acceptance'));
  assert.throws(() => parsePortableJson(Buffer.from('['.repeat(17) + '0' + ']'.repeat(17)), 'acceptance'));
  assert.equal(validatePortableAcceptance(accepted(), record, now).pull_number, 322);
  for (const mutation of [
    { extra: true }, { schema_version: 1 }, { source_digest: sha('unreviewed') }, { run_id: 0 }, { run_id: Number.MAX_SAFE_INTEGER + 1 },
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
test('native review serialization binds historical sources and reviewed v2 bytes together', () => {
  const coordinates = accepted();
  const body = JSON.parse(portableReviewBody(record, coordinates));
  assert.equal(body.source_digest, 'sha256:e9babac407a8fcdbcf177cb5b2e74ca79f8678ab5e86389684dea508b602635f');
  assert.equal(body.manifest_digest, 'sha256:8ee791b1321937633f43d3aa8773f29cbde6ddf8dd093ddecf921bc444561c3d');
  assert.deepEqual(body.historical_sources, record.historical_sources);
  assert.equal(body.base, coordinates.base);
  assert.equal(body.head, coordinates.head);
  assert.ok(!Object.hasOwn(body, 'decision_comment_id'));
  assert.ok(!Object.hasOwn(body, 'review_comment_id'));
  assert.ok(!Object.hasOwn(body, 'source_base'));
  assert.ok(!Object.hasOwn(body, 'content_candidate'));
  assert.throws(() => portableReviewBody(record, { ...coordinates, source_digest: sha('changed') }),
    /review source digest differs/u);
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
test('unqualified alternative protection shape requires the two exact App contexts', () => {
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
test('historical execution port binds one attempt and complete job inventory', async () => {
  const calls = [];
  const run = { id: 11, run_attempt: 2 };
  const jobs = [{ id: 21 }, { id: 22 }];
  const api = makePortableApi(async (path) => {
    calls.push(path);
    return path.endsWith('/jobs?per_page=100') ? { total_count: 2, jobs } : run;
  });
  assert.deepEqual(await api.getRunAttempt(11, 2), run);
  assert.deepEqual(await api.getRunAttemptJobs(11, 2), jobs);
  assert.deepEqual(calls, [
    'repos/agent-teams-ai/.github/actions/runs/11/attempts/2',
    'repos/agent-teams-ai/.github/actions/runs/11/attempts/2/jobs?per_page=100',
  ]);
  const incomplete = makePortableApi(async () => ({ total_count: 3, jobs }));
  await assert.rejects(incomplete.getRunAttemptJobs(11, 2), /inventory is incomplete/u);
});
test('installed G content fails closed without qualifying either Actions head association', async () => {
  for (const direction of ['forward', 'inverse']) for (const headSha of ['1'.repeat(40), '2'.repeat(40)]) {
    let observations = 0;
    const api = new Proxy({ getInstalledRecord: async () => Buffer.from(read('governance/docs-portable-authority-r322.json')) }, {
      get(target, key) {
        if (key in target) {return target[key];}
        return async () => {observations++; return { head_sha: headSha, conclusion: 'success' };};
      },
    });
    const decision = direction === 'forward' ? accepted() : { ...accepted(),
      direction, pull_number: 324, forward_decision_comment_id: 3 };
    await assert.rejects(verifyPortableExecution({ execution_base: decision.base }, decision, api,
      () => now), /G_ACTIVATION_UNQUALIFIED/u);
    assert.equal(observations, 0, 'unqualified source cannot observe authority or issue success');
  }
});

const identity = (bytes) => ({ type: 'blob', mode: '100644',
  blob: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
  bytes: bytes.length, sha256: sha(bytes) });
const reconstructed = (side) => new Map(record.manifest.filter((row) => row[side] !== null)
  .map((row) => [row.path, identity(historicalBody(row, side))]));
test('independent byte reconstruction admits only the complete 21-path pair and its inverse', () => {
  const before = reconstructed('old'), after = reconstructed('new');
  for (const p of G) {
    assert.ok(!record.manifest.some((row) => row.path === p), p);
    const descriptor = identity(Buffer.from(read(p)));
    before.set(p, descriptor); after.set(p, descriptor);
  }
  assert.equal(classifyPortableTransition(before, after, record), 'portable-forward');
  assert.equal(classifyPortableTransition(after, before, record), 'portable-inverse');
  for (const p of ['.github/workflows/docs-protocol-check.yml',
    'scripts/check-community-files.mjs', 'scripts/check-community-files.test.mjs']) {
    assert.ok(!record.manifest.some((row) => row.path === p));
    const descriptor = identity(Buffer.from(read(p)));
    before.set(p, descriptor); after.set(p, descriptor);
    const changed = new Map(after); changed.set(p, identity(Buffer.from('rewritten frozen authority')));
    assert.throws(() => classifyPortableTransition(before, changed, record), /incomplete or mixed/u);
  }
  for (const p of ['package.json', 'scripts/check-quality-scope.test.mjs']) {
    const changed = new Map(after); changed.set(p, identity(Buffer.from('stale or widened runtime')));
    assert.throws(() => classifyPortableTransition(before, changed, record), /preimages or postimages/u);
  }
  const selfInstall = new Map(before); selfInstall.delete(G[0]);
  assert.throws(() => classifyPortableTransition(selfInstall, after, record), /incomplete or mixed/u);
});

test('current G census is independently pinned and agrees with actual Oxlint selection', async () => {
  const adoption = await readQualityAdoption();
  const pre = deriveLintPaths(assertQualityAdoption(adoption), adoption.profile);
  const censusRow = record.manifest.find((r) => r.path === 'scripts/check-quality-scope.test.mjs');
  const live = Buffer.from(read(censusRow.path));
  // Reviewed 17b48d5 current source is distinct from either historical descriptor.
  const current = { type: 'blob', mode: '100644', blob: '5088e9d03570bd092984a468be45b0e63bd82f5c',
    bytes: 12923, sha256: 'sha256:503b90d00c67d5b9750708aabc777e5833c3a6bfcffdfa1ec8f708e0b0c71d74' };
  verifyPortableBlob(live, current);
  assert.equal(pre.length, 26);
  for (const p of ['scripts/docs-portable-authority-r322.mjs', 'scripts/read-docs-portable-authority-r322.mjs',
    'scripts/qualification-input-proof.mts', 'scripts/qualification-input-proof.test.mts']) {assert.ok(pre.includes(p));}
  assert.deepEqual(await selectOxlintFiles(pre), pre);
  for (const side of ['old', 'new']) {
    const historical = historicalBody(censusRow, side);
    verifyPortableBlob(historical, censusRow[side]);
    assert.throws(() => verifyPortableBlob(historical, current), /length|digest/u);
    assert.throws(() => verifyPortableBlob(live, censusRow[side]), /length|digest/u);
  }
});

const workflow = YAML.parse(read('.github/workflows/docs-portable-authority-r322.yml'));
const oldV8 = YAML.parse(read('.github/workflows/docs-cohort-authority-evolution-v8.yml'));
const oldValidation = YAML.parse(historicalBody(record.manifest.find((row) =>
  row.path === '.github/workflows/docs-cohort-append-only.yml'), 'old').toString('utf8'));
const currentValidation = YAML.parse(read('.github/workflows/docs-cohort-append-only.yml'));
test('protected-base trusted-validation accepts the G-only tree after consolidation', async () => {
  const source = currentValidation.jobs['trusted-validation'].steps.find((step) =>
    step.id === 'materialize').with.script;
  const materialize = new Script(`(async () => {\n${source}\n})()`, {
    filename: '.github/workflows/docs-cohort-append-only.yml',
  });
  const paths = [
    ...G.slice(0, 7),
    'scripts/fixtures/docs-portable-authority-r322/README.md',
    'scripts/fixtures/docs-portable-authority-r322/new-additions.json',
    'scripts/fixtures/docs-portable-authority-r322/new-overrides.json',
    'scripts/fixtures/docs-portable-authority-r322/old-overrides.json',
    'scripts/fixtures/docs-portable-authority-r322/historical-old-bodies.json',
    'governance/docs-current-composition-source-r322-e4.json',
  ];
  async function probe(filenames) {
    const failures = [], outputs = [];
    const files = filenames.map((filename) => ({ filename, status: 'added' }));
    const github = { paginate: async () => files,
      rest: { pulls: { listFiles: () => {} }, repos: { get: () => {
        throw Error('G-only no-op must not fetch registry authority');
      } } } };
    const context = { payload: { pull_request: { changed_files: files.length, number: 323 } },
      repo: { owner: 'agent-teams-ai', repo: '.github' } };
    const core = { setFailed: (message) => failures.push(message),
      setOutput: (name, value) => outputs.push([name, value]) };
    await materialize.runInNewContext({ require: (specifier) => {
      if (specifier === 'node:fs/promises') {return filesystem;}
      if (specifier === 'node:path') {return path;}
      throw Error(`unexpected predecessor import: ${specifier}`);
    },
      context, github, core });
    return { failures, outputs };
  }
  assert.deepEqual(await probe([...paths, "scripts/check-quality-scope.test.mjs"]), { failures: [], outputs: [['mode', 'noop']] });
  for (const basename of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
    const collision = `scripts/fixtures/docs-portable-authority-r322/new-additions/scripts/node-compatibility-tooling/${basename}`;
    const result = await probe([...paths, collision]);
    assert.equal(result.outputs.length, 0, basename);
    assert.match(result.failures[0], /Authority files require a separately staged successor check/u,
      basename);
  }
});
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
  assert.equal(candidate.jobs.route.steps.find((step) =>
    step.name === 'Prove protected-base Node runtime').run,
  `node -e "if (process.version !== 'v24.21.0') throw Error('Node runtime mismatch')"`);
  assert.equal(candidate.jobs.portable.steps.find((step) =>
    step.name === 'Verify exact portable authority with current admin decision').run,
  `node -e "if (process.version !== 'v24.21.0') throw Error('Node runtime mismatch')"\nnode scripts/read-docs-portable-authority-r322.mjs\n`);
  for (const [jobId, job] of Object.entries(candidate.jobs)) {
    assert.notEqual(job['continue-on-error'], true);
    for (const step of job.steps) {
      assert.notEqual(step['continue-on-error'], true);
      if (step.uses) {assert.match(step.uses, /@[a-f0-9]{40}$/u);}
      if (step.uses?.startsWith('actions/checkout@')) {
        assert.equal(step.with.ref, '${{ github.event.pull_request.base.sha }}');
        assert.equal(step.with['persist-credentials'], false);
      }
      if (step.uses?.startsWith('actions/setup-node@')) {
        assert.equal(step.with['node-version'], ['route', 'portable'].includes(jobId) ? '24.21.0' : '24.18.0');
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
    (w) => {w.jobs.route.steps.find((step) => step.name ===
      'Prove protected-base Node runtime').run = 'true';},
    (w) => {w.jobs.portable.steps.find((step) => step.name ===
      'Verify exact portable authority with current admin decision').run =
      w.jobs.portable.steps.find((step) => step.name ===
        'Verify exact portable authority with current admin decision').run.replace('v24.21.0', 'v24.18.0');},
    (w) => {w.jobs.legacy_validation.steps.find((step) =>
      step.uses?.startsWith('actions/setup-node@')).with['node-version'] = '24.21.0';},
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
