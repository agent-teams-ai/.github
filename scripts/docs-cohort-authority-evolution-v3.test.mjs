import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-cohort-authority-evolution-v3.yml";
const testPath = "scripts/docs-cohort-authority-evolution-v3.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const canonical = [
  {
    filename: ".github/workflows/docs-cohort-append-only.yml",
    status: "modified",
    sha: "f31a0e94be08cb023fe88fd01a0c32ba0256ce05",
  },
  {
    filename: "scripts/docs-cohort-policy.test.mjs",
    status: "modified",
    sha: "d008f02209cdaf51412a046904d27778d7e35699",
  },
];

async function classify(options = {}) {
  const files = options.files ?? canonical;
  const paginated = options.paginated ?? files;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 152,
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

test("accepts only the exact private-canary-evidence Cohort authority slice", async () => {
  const accepted = await classify();
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.outputs.get("mode"), "authority");
});

test("fails closed for partial, wrong-identity, renamed, extra, and incomplete slices", async () => {
  const [workflowTarget] = canonical;
  for (const candidate of [
    { files: canonical.slice(0, 1) },
    { files: canonical.slice(1) },
    { files: canonical.map((file, index) => index === 0 ? { ...file, status: "added" } : file) },
    { files: canonical.map((file, index) => index === 1 ? { ...file, status: "deleted" } : file) },
    { files: canonical.map((file, index) => index === 0 ? { ...file, sha: "f".repeat(40) } : file) },
    { files: canonical.map((file, index) => index === 1 ? { ...file, sha: "f".repeat(40) } : file) },
    { files: canonical.map((file, index) => index === 0 ? { ...file, previous_filename: ".github/workflows/old.yml" } : file) },
    { files: [...canonical, { filename: "docs/extra.md", status: "added", sha: "e".repeat(40) }] },
    { files: [{ filename: workflowPath, status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: testPath, status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: "scripts/unrelated.test.mjs", status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: ".github/workflows/unrelated.yml", status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: "governance/unrelated.schema.json", status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: "package.json", status: "modified", sha: "e".repeat(40) }] },
    { files: canonical, changedFiles: 0 },
    { paginated: [workflowTarget], changedFiles: canonical.length },
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

test("treats non-authority registry, policy, and documentation data as noop", async () => {
  for (const filename of [
    "governance/docs-protocol-cohorts.json",
    "governance/docs-protocol-policy-v2.json",
    "governance/unrelated.json",
    "docs/notes.md",
  ]) {
    const result = await classify({ files: [{ filename, status: "modified", sha: "e".repeat(40) }] });
    assert.deepEqual(result.failures, [], filename);
    assert.equal(result.outputs.get("mode"), "noop", filename);
  }
});

test("keeps the additive successor base-owned and non-executing", () => {
  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:/u);
  assert.doesNotMatch(workflow, /secrets\.|pull_request\.head\.sha|getContent/u);
});
