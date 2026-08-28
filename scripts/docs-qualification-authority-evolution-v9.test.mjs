import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-qualification-authority-evolution-v9.yml";
const testPath = "scripts/docs-qualification-authority-evolution-v9.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const canonical = [{
  filename: "scripts/governance-policy.test.mjs",
  status: "modified",
  sha: "d1a244d5fa5899ffc84d6cc9485a8742c7133a21",
}];

async function classify(options = {}) {
  const files = options.files ?? canonical;
  const paginated = options.paginated ?? files;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 148,
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

test("accepts only the exact adopted-v2-coordinates test authority slice", async () => {
  const accepted = await classify();
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.outputs.get("mode"), "authority");
});

test("fails closed for partial, wrong-identity, renamed, extra, and incomplete slices", async () => {
  const [exact] = canonical;
  for (const candidate of [
    { files: [{ ...exact, status: "added" }] },
    { files: [{ ...exact, status: "deleted" }] },
    { files: [{ ...exact, sha: "f".repeat(40) }] },
    { files: [{ ...exact, previous_filename: "scripts/old-governance-policy.test.mjs" }] },
    { files: [...canonical, { filename: "docs/extra.md", status: "added", sha: "e".repeat(40) }] },
    { files: [{ filename: workflowPath, status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: testPath, status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: "scripts/unrelated.test.mjs", status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: ".github/workflows/unrelated.yml", status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: "governance/unrelated.schema.json", status: "modified", sha: "e".repeat(40) }] },
    { files: [{ filename: "package.json", status: "modified", sha: "e".repeat(40) }] },
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

test("treats non-authority policy and documentation data as noop", async () => {
  for (const filename of [
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
