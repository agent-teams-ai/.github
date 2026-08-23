import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-cohort-authority-evolution-v2.yml";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const canonical = [
  ["scripts/docs-cohort-policy.mjs", "modified"],
  ["scripts/verify-docs-cohort-evidence.mjs", "modified"],
  ["scripts/verify-docs-consumer-gate.mjs", "modified"],
  ["scripts/docs-cohort-policy.test.mjs", "modified"],
  ["docs/decisions/README.md", "modified"],
  ["docs/decisions/0002-fix-forward-cohort-deployability.md", "added"],
].map(([filename, status]) => ({ filename, status }));

async function classify(options = {}) {
  const files = options.files ?? canonical;
  const paginated = options.paginated ?? files;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 89,
      changed_files: options.changedFiles ?? files.length,
      head: { repo: { full_name: options.headRepo ?? repository } },
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

test("stages only the exact fix-forward Cohort authority slice", async () => {
  const accepted = await classify();
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.outputs.get("mode"), "authority");

  const cases = [
    { files: canonical.slice(1) },
    { files: [...canonical, { filename: "README.md", status: "modified" }] },
    { files: canonical.map((file, index) => index === 0 ? { ...file, status: "deleted" } : file) },
    { files: canonical.map((file, index) => index === 0 ? { ...file, previous_filename: "old.mjs" } : file) },
    { headRepo: "attacker/fork" },
    { baseRef: "feature" },
    { branchSha: "b".repeat(40) },
    { paginated: canonical.slice(1), changedFiles: canonical.length },
    { paginated: [...canonical.slice(0, -1), canonical[0]], changedFiles: canonical.length },
    { files: [{ filename: workflowPath, status: "modified" }] },
    { files: [{ filename: workflowPath, status: "deleted" }] },
  ];
  for (const candidate of cases) {
    assert.notEqual((await classify(candidate)).failures.length, 0, JSON.stringify(candidate));
  }

  const unrelated = await classify({ files: [{ filename: "README.md", status: "modified" }] });
  assert.deepEqual(unrelated.failures, []);
  assert.equal(unrelated.outputs.get("mode"), "noop");
});

test("keeps the successor check base-owned and non-executing", () => {
  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:/u);
  assert.doesNotMatch(workflow, /secrets\.|pull_request\.head\.sha/u);
});
