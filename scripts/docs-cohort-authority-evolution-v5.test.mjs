import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-cohort-authority-evolution-v5.yml";
const testPath = "scripts/docs-cohort-authority-evolution-v5.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const forward = [
  [".github/workflows/docs-cohort-append-only.yml", "modified", "3c7f54dc24a6a2cd8c1c124df242841cde46df87"],
  ["scripts/docs-cohort-policy.test.mjs", "modified", "464dd548ea0f32a8e7ff5c9c6df4a6f72adeacda"],
  ["scripts/verify-docs-cohort-evidence.mjs", "modified", "f4550a689e979f82f23843577dd303b739c3a7c9"],
].map(([filename, status, sha]) => ({ filename, status, sha }));
const rollback = [
  [".github/workflows/docs-cohort-append-only.yml", "modified", "f31a0e94be08cb023fe88fd01a0c32ba0256ce05"],
  ["scripts/docs-cohort-policy.test.mjs", "modified", "4e6e34f62b420cbc71f6ce8e47945066852bc172"],
  ["scripts/verify-docs-cohort-evidence.mjs", "modified", "bdccef70895d4f9df6e4510ea80b48e7f46bbe97"],
].map(([filename, status, sha]) => ({ filename, status, sha }));

async function classify(options = {}) {
  const files = options.files ?? forward;
  const failures = [];
  const outputs = new Map();
  const context = { repo: { owner: "agent-teams-ai", repo: ".github" }, payload: {
    pull_request: {
      number: 201,
      changed_files: options.changedFiles ?? files.length,
      head: { repo: options.missingHeadRepo ? null : { full_name: options.headRepo ?? repository } },
      base: { ref: options.baseRef ?? "main", sha: options.baseSha ?? baseSha },
    },
  } };
  const github = {
    paginate: async () => options.paginated ?? files,
    rest: {
      pulls: { listFiles: () => undefined },
      repos: {
        get: async () => ({ data: { default_branch: "main" } }),
        getBranch: async () => ({ data: { commit: { sha: options.branchSha ?? baseSha } } }),
      },
    },
  };
  const core = {
    setFailed: (message) => failures.push(message),
    setOutput: (name, value) => outputs.set(name, value),
  };
  await execute(context, github, core);
  return { failures, outputs };
}

test("accepts exactly the complete forward and rollback Cohort v2 evidence tuples", async () => {
  for (const files of [forward, rollback]) {
    const accepted = await classify({ files });
    assert.deepEqual(accepted.failures, []);
    assert.equal(accepted.outputs.get("mode"), "authority");
  }
});

test("pins each direction to one complete exact Git blob tuple", () => {
  assert.deepEqual(forward.map(({ filename }) => filename), rollback.map(({ filename }) => filename));
  for (const tuple of [forward, rollback]) {
    assert.equal(new Set(tuple.map(({ filename }) => filename)).size, tuple.length);
    assert.equal(new Set(tuple.map(({ sha }) => sha)).size, tuple.length);
    for (const { filename, status, sha } of tuple) {
      assert.match(sha, /^[0-9a-f]{40}$/u, filename);
      assert.equal(status, "modified");
      assert.notEqual(filename, workflowPath);
      assert.notEqual(filename, testPath);
    }
  }
});

test("rejects partial, mixed, renamed, extra, wrong-identity, and incomplete tuples", async () => {
  for (const candidate of [
    { files: forward.slice(1) },
    { files: rollback.slice(0, -1) },
    { files: forward.map((file, index) => index === 0 ? rollback[0] : file) },
    { files: rollback.map((file, index) => index === 2 ? forward[2] : file) },
    { files: forward.map((file, index) => index === 0 ? { ...file, sha: "f".repeat(40) } : file) },
    { files: forward.map((file, index) => index === 0 ? { ...file, status: "added" } : file) },
    { files: forward.map((file, index) => index === 1 ? { ...file, previous_filename: "OLD.mjs" } : file) },
    { files: [...forward, { filename: "scripts/extra.mjs", status: "added", sha: "f".repeat(40) }] },
    { files: forward, changedFiles: 0 },
    { files: forward, paginated: forward.slice(0, -1) },
    { files: forward, paginated: [...forward, forward[0]] },
  ]) {
    assert.notEqual((await classify(candidate)).failures.length, 0, JSON.stringify(candidate));
  }
});

test("rejects successor workflow and test self-modification", async () => {
  for (const filename of [workflowPath, testPath]) {
    const files = [...forward, { filename, status: "modified", sha: "f".repeat(40) }];
    assert.notEqual((await classify({ files })).failures.length, 0, filename);
  }
});

test("rejects forks, non-default bases, and stale heads", async () => {
  for (const candidate of [
    { headRepo: "attacker/fork" },
    { missingHeadRepo: true },
    { baseRef: "feature" },
    { branchSha: "b".repeat(40) },
  ]) {
    assert.notEqual((await classify(candidate)).failures.length, 0, JSON.stringify(candidate));
  }
});

test("treats non-authority data changes as noop", async () => {
  const result = await classify({ files: [{
    filename: "governance/docs-qualified-cohorts.json",
    status: "modified",
    sha: "e".repeat(40),
  }] });
  assert.deepEqual(result.failures, []);
  assert.equal(result.outputs.get("mode"), "noop");
});

test("is base-owned, read-only, and never executes PR-head code", () => {
  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:|secrets\.|pull_request\.head\.sha|getContent/u);
});
