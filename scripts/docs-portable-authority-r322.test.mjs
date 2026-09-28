import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { classifyPortableTransition, validatePortableRecord, verifyPortableBlob } from './docs-portable-authority-r322.mjs';

const bytes = readFileSync(new URL('../governance/docs-portable-authority-r322.json', import.meta.url));
const record = validatePortableRecord(bytes);
const base = '18b7e22f7247a85181516a7bbb989c9d5fad7be3';
const corrected = '6e77efe7ef0c686c9e95d4d361578c8c594aad13';
const reviewedPairs = [
  [".github/workflows/ci.yml", "4036cdaa2a5b7eadf1ca96f737944851361e9361", "c818fd484abc6204f05540cdd0143cfeaf66cf40"],
  [".github/workflows/docs-admission-evidence.yml", "6de75ea253f021c255216862283400ef22c35a13", "b0cd6bcf796b33511b34390247586d536573d8c9"],
  [".github/workflows/docs-cohort-append-only.yml", "3c7f54dc24a6a2cd8c1c124df242841cde46df87", "a56dd6f9a502edbe4db219dbe160ee5fccbf78bd"],
  [".github/workflows/docs-fleet-audit.yml", "cd2cfee3713da2669b7a414a26d57aceff0038ba", "5946623a2d44b4f0a08bddd7fea48052db605ebb"],
  [".github/workflows/docs-platform-recovery-installation-r317.yml", "3e07551ab95719b62c67595e7bb2819ae01670b3", "e7d0ee8d5b383c31a4c0a6a0d0433dbf714ca38f"],
  [".github/workflows/docs-protocol-check.yml", "9bcbe54dfec6280045ac596e55c1f14ce5f176e1", "ddb69a618290eb48cfe41a59a8821c61524c912a"],
  [".github/workflows/organization-inventory-drift.yml", "454895d3558437b884299e9e23402a4dca59ca19", "8db7aa268f3258de991e565e3723d7c27bfa4f43"],
  [".github/workflows/reviewrouter-codex.yml", "546f044775de26e7fefb91246848beae5a9451b0", "9d979fe54f0ba99b075ee39355c6eb5975e33794"],
  [".github/workflows/reviewrouter-interaction.yml", "6d99f10230e1cb202237db160722dbfe7515a9e3", "9955e97bcdfde5d174614ef2694542d1b5072102"],
  ["README.md", "b5a95cbdb375432362daeec43431f9ecc02a6f35", "b54f82af80c1f9a129ce58955088399353fdd3a7"],
  ["docs/node-runtime-compatibility.md", null, "9a5f74f37a1835b50a1f1b6f86eb97e561351ddd"],
  ["package.json", "b4bee381c864b24ee01f3da9a47582f304a61514", "de9749b18a8a6ad1213390a7bfe10d6e3e4e10d5"],
  ["scripts/assert-node-runtime.mjs", null, "9c8f8752d7ad682c51436f28beb07984a72eb97f"],
  ["scripts/check-community-files.mjs", "b43b247a4b727974ef878ff09abc05cd17f22d0e", "5bdc09cb663ec16f99ca07244b3a1fa5e847bf4d"],
  ["scripts/check-community-files.test.mjs", "fe25fc2080ed470098208c7753793e8c1b144e4f", "3194e9671988778be721c3368081c2e577decc7e"],
  ["scripts/check-node-compatibility.mjs", null, "55905e0cdbbbdb002ce696554263687b2c410d5d"],
  ["scripts/check-node-compatibility.test.mjs", null, "63a3f0737fd417ae6602c2d25902d1cb0f9dc979"],
  ["scripts/check-quality-scope.mjs", "105403b63038c5a1076c6754abe66a75275e2915", "07f348a77b5c4426c8347f453970c75d893001c0"],
  ["scripts/check-quality-scope.test.mjs", "2cacbca6acaebe64d57adbdcee367b9e595f6f83", "323513b857e6bce43a6838222741f87180cbdd57"],
  ["scripts/check-reviewrouter-workflow.mjs", "675e24a4664a81eb78066ed0cae87ebd82e6cc75", "82152737a6cf7ee8486e42b92a71c08c44dfa775"],
  ["scripts/docs-cohort-policy.test.mjs", "7543006ded770545dc1525e0aa199bdd52aaffe2", "34245bf55f050fb51d5ef911d2518cbcfd983462"],
  ["scripts/node-compatibility-tooling/package.json", null, "989fae201c9a26b1818cdd87ca6a2219e7a5563c"],
  ["scripts/node-compatibility-tooling/pnpm-lock.yaml", null, "0b4c5c00ce52a31c4e94b1033f7efd1f8e82be1c"],
  ["scripts/node-compatibility-tooling/pnpm-workspace.yaml", null, "c74cbd3f354fa9538c0eeceb4c87249e4b15cb9f"],
];
const original = new Map(record.manifest.filter((row) => row.old !== null)
  .map((row) => [row.path, row.old]));
const repaired = new Map(record.manifest.map((row) => [row.path, row.new]));
const clone = (map) => new Map(map);

test('independent literals bind the complete corrected forward and inverse', () => {
  assert.equal(record.source_base, base);
  assert.equal(record.content_candidate, corrected);
  assert.deepEqual(record.manifest.map((row) => [row.path, row.old?.blob ?? null, row.new.blob]),
    reviewedPairs);
  assert.equal(record.manifest.filter((row) => row.status === 'added').length, 7);
  assert.equal(classifyPortableTransition(original, repaired, record), 'portable-forward');
  assert.equal(classifyPortableTransition(repaired, original, record), 'portable-inverse');
  assert.equal(classifyPortableTransition(original, original, record), 'legacy');
});

test('complete set is required in either direction', () => {
  for (const row of record.manifest) {
    const missing = clone(repaired);
    if (row.old) {missing.set(row.path, row.old);}
    else {missing.delete(row.path);}
    assert.throws(() => classifyPortableTransition(original, missing, record));
    const inverse = clone(original);
    inverse.set(row.path, repaired.get(row.path));
    assert.throws(() => classifyPortableTransition(repaired, inverse, record));
  }
  const extra = clone(repaired);
  extra.set('unexpected.txt', { ...repaired.get('README.md') });
  assert.throws(() => classifyPortableTransition(original, extra, record));
});

test('mode, size and content identities cannot drift', () => {
  const path = record.manifest[0].path;
  for (const change of [{ mode: '100755' }, { bytes: 7 },
    { blob: '1'.repeat(40) }, { sha256: `sha256:${'1'.repeat(64)}` }]) {
    const changed = clone(repaired);
    changed.set(path, { ...changed.get(path), ...change });
    assert.throws(() => classifyPortableTransition(original, changed, record));
  }
  assert.throws(() => verifyPortableBlob(Buffer.from('wrong'), record.manifest[0].new));
});

test('record boundary rejects duplicates, depth, unknown fields and unsafe identities', () => {
  const raw = bytes.toString();
  assert.throws(() => validatePortableRecord(Buffer.from(raw.replace('"schema_version": 1',
    '"schema_version": 1, "schema_version": 1'))));
  assert.throws(() => validatePortableRecord(Buffer.from(raw.replace('"schema_version": 1',
    '"schema_version": 1, "extra": true'))));
  assert.throws(() => validatePortableRecord(Buffer.from(raw.replace('"schema_version": 1',
    '"schema_version": 9007199254740993'))));
  assert.throws(() => validatePortableRecord(Buffer.from('['.repeat(17) + '0' + ']'.repeat(17))));
  assert.throws(() => validatePortableRecord(Buffer.from([0xff])));
  assert.throws(() => validatePortableRecord(Buffer.alloc(128 * 1024 + 1)));
});
