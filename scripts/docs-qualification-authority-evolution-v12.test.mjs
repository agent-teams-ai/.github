import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-qualification-authority-evolution-v12.yml";
const testPath = "scripts/docs-qualification-authority-evolution-v12.test.mjs";
const reviewedFiles = Object.freeze([
  Object.freeze({
    filename: "governance/docs-protocol-policy-v2.json",
    status: "modified",
    sha: "5550538789d730d076f0ba9a0d4395a5bf202a18",
  }),
  Object.freeze({
    filename: "scripts/governance-policy.test.mjs",
    status: "modified",
    sha: "696bce0d92f2d93b8ded77a4611166423a54e1a1",
  }),
]);
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);

async function classify(options = {}) {
  const files = options.files ?? reviewedFiles;
  const paginated = options.paginated ?? files;
  const changedFiles = Object.hasOwn(options, "changedFiles")
    ? options.changedFiles
    : files.length;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 179,
      changed_files: changedFiles,
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

test("accepts the exact reviewed stable10 admission and rollout-fixture slice", async () => {
  for (const reviewed of reviewedFiles) {
    assert.match(source, new RegExp(reviewed.sha, "u"));
  }
  const accepted = await classify();
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.outputs.get("mode"), "authority");
});

test("rejects wrong blobs, status, rename metadata, extras, and missing files", async () => {
  for (const files of [
    [{ ...reviewedFiles[0], sha: "f".repeat(40) }, reviewedFiles[1]],
    [reviewedFiles[0], { ...reviewedFiles[1], status: "added" }],
    [reviewedFiles[0], { ...reviewedFiles[1], previous_filename: "scripts/retired.test.mjs" }],
    [...reviewedFiles, { filename: "docs/extra.md", status: "added", sha: "e".repeat(40) }],
    [reviewedFiles[1]],
  ]) {
    const result = await classify({ files });
    assert.notEqual(result.failures.length, 0, JSON.stringify(files));
    assert.equal(result.outputs.size, 0);
  }

  const incomplete = await classify({ paginated: [], changedFiles: 2 });
  assert.match(incomplete.failures[0], /incomplete or duplicated/u);
});

test("rejects duplicate pagination and every invalid changed_files bound", async () => {
  const duplicate = await classify({
    paginated: [reviewedFiles[0], reviewedFiles[0]],
    changedFiles: 2,
  });
  assert.match(duplicate.failures[0], /incomplete or duplicated/u);

  for (const changedFiles of [undefined, null, -1, 0, 1.5, 101, Number.MAX_SAFE_INTEGER + 1]) {
    const result = await classify({ changedFiles });
    assert.match(result.failures[0], /within 1\.\.100/u, String(changedFiles));
    assert.equal(result.outputs.size, 0);
  }
});

test("rejects forks, missing head repositories, wrong bases, and stale bases", async () => {
  for (const candidate of [
    { headRepo: "attacker/fork" },
    { missingHeadRepo: true },
    { baseRef: "feature" },
    { branchSha: "b".repeat(40) },
  ]) {
    const result = await classify(candidate);
    assert.notEqual(result.failures.length, 0, JSON.stringify(candidate));
    assert.equal(result.outputs.size, 0);
  }
});

test("treats policy-only and unrelated governance data as noop", async () => {
  for (const filename of [
    "docs/repository-admission.md",
    "governance/docs-qualified-cohorts.json",
    "governance/docs-protocol-policy-v2.json",
    "governance/docs-runtime-closures/sha256-example.json",
  ]) {
    const result = await classify({
      files: [{ filename, status: "modified", sha: "e".repeat(40) }],
    });
    assert.deepEqual(result.failures, [], filename);
    assert.equal(result.outputs.get("mode"), "noop", filename);
  }
});

test("rejects workflow and test self-modification", async () => {
  for (const filename of [workflowPath, testPath]) {
    const result = await classify({
      files: [{ filename, status: "modified", sha: "e".repeat(40) }],
    });
    assert.match(result.failures[0], /exact reviewed/u, filename);
    assert.equal(result.outputs.size, 0);
  }
});

test("protects the full workflow, script, schema, and install-authority union", async () => {
  for (const filename of [
    ".github/workflows/unrelated.yml",
    "scripts/unrelated.mjs",
    "governance/unrelated.schema.json",
    ".node-version",
    ".npmrc",
    ".pnpmfile.cjs",
    "nested/package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "renovate-config.json",
    "renovate.json",
  ]) {
    const result = await classify({
      files: [{ filename, status: "modified", sha: "e".repeat(40) }],
    });
    assert.match(result.failures[0], /exact reviewed/u, filename);
    assert.equal(result.outputs.size, 0);
  }
});

test("keeps the successor base-owned, pinned, read-only, and non-executing", () => {
  assert.match(workflow, /^name: Trusted Docs Qualification Authority Evolution V12$/mu);
  assert.match(workflow, /pull_request_target:\n    types: \[opened, synchronize, reopened, edited\]/u);
  assert.match(
    workflow,
    /permissions:\n  contents: read\n  pull-requests: read\n\njobs:/u,
  );
  assert.match(
    workflow,
    /trusted-qualification-authority-evolution-v12:\n    name: trusted-qualification-authority-evolution-v12/u,
  );
  assert.deepEqual(
    [...workflow.matchAll(/^\s+- uses: (?<action>\S+)/gmu)].map((match) => match.groups.action),
    ["actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd"],
  );
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:|:\s*write\b/u);
  assert.doesNotMatch(
    workflow,
    /secrets\.|pull_request\.head\.sha|github\.event\.pull_request\.head|getContent/u,
  );
});
