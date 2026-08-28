import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-governance-authority-evolution-v11.yml";
const testPath = "scripts/docs-governance-authority-evolution-v11.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const canonical = [
  ["docs/decisions/0001-qualified-docs-cohorts.md", "a008dd8f0247d4e34f93e74f6341db43ab32547d"],
  ["docs/repository-admission.md", "36c0df5b89f6c6bacc8bc357028a7ea2b73fdf46"],
  ["scripts/docs-cohort-policy.mjs", "99713591f07e22644bc2708133cc9eb599a5e5a1"],
  ["scripts/docs-cohort-policy.test.mjs", "9dbbe5f7ff4fb7f19fef0631f718b5beea15fb95"],
  ["scripts/governance-policy.mjs", "d2cc7628050f91b638525ac3d95073ed01dde7bd"],
  ["scripts/governance-policy.test.mjs", "b14ad3c00ae9b5b322bccede3b01558555ef779a"],
  ["scripts/verify-docs-cohort-evidence.mjs", "bdccef70895d4f9df6e4510ea80b48e7f46bbe97"],
].map(([filename, sha]) => ({ filename, status: "modified", sha }));

async function classify(options = {}) {
  const files = options.files ?? canonical;
  const paginated = options.paginated ?? files;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 170,
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

test("accepts only the exact Docs governance bottleneck-fix slice", async () => {
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
