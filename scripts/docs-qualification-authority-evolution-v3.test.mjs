import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-qualification-authority-evolution-v3.yml";
const testPath = "scripts/docs-qualification-authority-evolution-v3.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const canonical = [
  [".github/workflows/docs-qualification-authority-evolution-v2.yml", "modified", "6018aaeacb4ce5d4bdfa703e3ea8035e7f522dfe"],
  ["governance/docs-protocol-policy-v2.schema.json", "modified", "0fc9bca363f13a2de67960c9ecdb8bb3516d8a16"],
  ["scripts/docs-qualification-authority-evolution-v2.test.mjs", "modified", "7ad8c0a2be49700508869e8cbd5a70e153023e12"],
  ["scripts/governance-policy.mjs", "modified", "b3d2e7455d3b41556074f7de2b550a3040905415"],
  ["scripts/governance-policy.test.mjs", "modified", "6c726e9d63703285b38d254a943da4942c0f156d"],
].map(([filename, status, sha]) => ({ filename, status, sha }));

async function classify(options = {}) {
  const files = options.files ?? canonical;
  const paginated = options.paginated ?? files;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 124,
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

test("accepts only the exact bootstrap-candidate authority slice", async () => {
  const accepted = await classify();
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.outputs.get("mode"), "authority");

  for (const candidate of [
    { files: [...canonical, { filename: "docs/extra.md", status: "added" }] },
    { files: canonical.map((file, index) => index === 0 ? { ...file, status: "deleted" } : file) },
    { files: canonical.map((file, index) => index === 0 ? { ...file, previous_filename: "old.yml" } : file) },
    { headRepo: "attacker/fork" },
    { missingHeadRepo: true },
    { baseRef: "feature" },
    { branchSha: "b".repeat(40) },
    { paginated: canonical.slice(1), changedFiles: canonical.length },
    { paginated: [...canonical.slice(0, -1), canonical[0]], changedFiles: canonical.length },
    { files: [{ filename: workflowPath, status: "modified" }] },
    { files: [{ filename: testPath, status: "modified" }] },
    { files: [{ filename: "scripts/unrelated.test.mjs", status: "modified" }] },
    { files: [{ filename: ".github/workflows/unrelated.yml", status: "modified" }] },
    { files: [{ filename: "governance/unrelated.schema.json", status: "modified" }] },
    { files: [{ filename: "package.json", status: "modified" }] },
  ]) {
    assert.notEqual((await classify(candidate)).failures.length, 0, JSON.stringify(candidate));
  }
});

test("rejects every partial, missing, or wrong-blob authority slice", async () => {
  for (const [index, file] of canonical.entries()) {
    assert.notEqual((await classify({ files: [{ ...file }] })).failures.length, 0);
    const incomplete = canonical.filter((_, candidateIndex) => candidateIndex !== index);
    assert.notEqual((await classify({ files: incomplete })).failures.length, 0);
    const wrongBlob = canonical.map((candidate, candidateIndex) => candidateIndex === index
      ? { ...candidate, sha: "f".repeat(40) }
      : candidate);
    assert.notEqual((await classify({ files: wrongBlob })).failures.length, 0);
  }
});

test("does not claim unrelated policy or documentation data authority", async () => {
  for (const filename of [
    "governance/docs-protocol-policy-v2.json",
    "governance/unrelated.json",
    "docs/notes.md",
  ]) {
    const result = await classify({ files: [{ filename, status: "modified" }] });
    assert.deepEqual(result.failures, [], filename);
    assert.equal(result.outputs.get("mode"), "noop", filename);
  }
});

test("keeps the exact-slice successor base-owned and non-executing", () => {
  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:/u);
  assert.doesNotMatch(workflow, /secrets\.|pull_request\.head\.sha|getContent/u);
});
