import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-platform-exception-review-v1.yml";
const testPath = "scripts/docs-platform-exception-review-v1.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const canonical = [
  ["governance/docs-protocol-exceptions.json", "ac336b865d697b62c938623f2960864e85f7698a"],
].map(([filename, sha]) => ({ filename, status: "modified", sha }));

async function classify(options = {}) {
  const files = options.files ?? canonical;
  const paginated = options.paginated ?? files;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 279,
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
        get: async ({ repo }) => ({ data: repo === ".github"
          ? { default_branch: "main" }
          : { id: options.platformId ?? 1319378484,
            full_name: options.platformName ?? "agent-teams-ai/agent-teams-platform",
            private: options.platformPrivate ?? true,
            archived: options.platformArchived ?? false,
            disabled: options.platformDisabled ?? false } }),
        getBranch: async () => ({ data: { commit: { sha: options.branchSha ?? baseSha } } }),
      },
    },
    request: async () => {
      if (options.rulesetsAvailable) return { data: [] };
      const error = new Error(options.rulesetsMessage ??
        "Upgrade to GitHub Pro or make this repository public to enable this feature.");
      error.status = options.rulesetsStatus ?? 403;
      throw error;
    },
  };
  const core = {
    setFailed: (message) => failures.push(message),
    setOutput: (name, value) => outputs.set(name, value),
  };
  await execute(context, github, core);
  return { failures, outputs };
}

test("accepts only the exact Platform exception renewal", async () => {
  const accepted = await classify();
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.outputs.get("mode"), "exception-review");
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

test("rejects changed Platform identity or newly available rulesets", async () => {
  for (const candidate of [
    { platformId: 1 },
    { platformName: "agent-teams-ai/other" },
    { platformPrivate: false },
    { platformArchived: true },
    { platformDisabled: true },
    { rulesetsAvailable: true },
  ]) {
    assert.notEqual((await classify(candidate)).failures.length, 0, JSON.stringify(candidate));
  }
  await assert.rejects(classify({ rulesetsStatus: 500 }), /Upgrade/u);
  await assert.rejects(classify({ rulesetsMessage: "Forbidden" }), /Forbidden/u);
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
  assert.match(workflow, /github-token: \$\{\{ secrets\.DOCS_GOVERNANCE_READ_TOKEN \}\}/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:/u);
  assert.doesNotMatch(workflow, /pull_request\.head\.sha|getContent/u);
});
