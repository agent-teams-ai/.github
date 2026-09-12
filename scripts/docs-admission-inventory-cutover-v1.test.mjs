import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-admission-inventory-cutover-v1.yml";
const testPath = "scripts/docs-admission-inventory-cutover-v1.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const canonical = [
  [".github/workflows/docs-admission-evidence.yml", "91de7bbd7bf4188c86d78bc0aaa62f7d444fdf7d"],
  ["scripts/docs-admission-workflow.test.mjs", "d1a906bb77cd03e6ce9a5734349bb14ffd19d6af"],
  ["scripts/verify-docs-admission-change.mjs", "e3f0f3d2e065b7c0ae324481a3056b7955a0702d"],
].map(([filename, sha]) => ({ filename, status: "modified", sha }));

async function classify(options = {}) {
  const files = options.files ?? canonical;
  const paginated = options.paginated ?? files;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 261,
      changed_files: options.changedFiles ?? files.length,
      head: { repo: options.missingHeadRepo ? null : {
        full_name: options.headRepo ?? repository,
      } },
      base: { ref: options.baseRef ?? "main", sha: options.baseSha ?? baseSha },
    } },
  };
  const github = {
    paginate: async () => paginated,
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

test("accepts only the exact admission inventory-allowlist slice", async () => {
  const accepted = await classify();
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.outputs.get("mode"), "authority");
});

test("fails closed for partial, wrong-identity, renamed, extra, and incomplete slices", async () => {
  for (const [index, exact] of canonical.entries()) {
    for (const files of [
      canonical.filter((_, candidateIndex) => candidateIndex !== index),
      canonical.map((file, candidateIndex) => candidateIndex === index
        ? { ...exact, status: "added" }
        : file),
      canonical.map((file, candidateIndex) => candidateIndex === index
        ? { ...exact, sha: "f".repeat(40) }
        : file),
      canonical.map((file, candidateIndex) => candidateIndex === index
        ? { ...exact, previous_filename: `old/${exact.filename}` }
        : file),
    ]) {
      assert.notEqual((await classify({ files })).failures.length, 0, JSON.stringify(files));
    }
  }
  for (const candidate of [
    { files: [...canonical, { filename: "docs/extra.md", status: "added", sha: "e".repeat(40) }] },
    { files: [{ filename: workflowPath, status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: testPath, status: "modified", sha: "e".repeat(40) }] },
    { files: canonical, changedFiles: 0 },
    { paginated: [], changedFiles: canonical.length },
    { paginated: [...canonical, canonical[0]], changedFiles: canonical.length },
  ]) {
    assert.notEqual((await classify(candidate)).failures.length, 0, JSON.stringify(candidate));
  }
});

test("rejects forks, non-default bases, and stale default-branch heads", async () => {
  for (const candidate of [
    { headRepo: "attacker/fork" },
    { missingHeadRepo: true },
    { baseRef: "feature" },
    { branchSha: "b".repeat(40) },
  ]) {
    assert.notEqual((await classify(candidate)).failures.length, 0, JSON.stringify(candidate));
  }
});

test("treats documentation-only data as noop", async () => {
  const result = await classify({
    files: [{ filename: "docs/repository-admission.md", status: "modified", sha: "e".repeat(40) }],
  });
  assert.deepEqual(result.failures, []);
  assert.equal(result.outputs.get("mode"), "noop");
});

test("keeps the additive successor base-owned and non-executing", () => {
  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:/u);
  assert.doesNotMatch(workflow, /secrets\.|pull_request\.head\.sha|getContent/u);
});
