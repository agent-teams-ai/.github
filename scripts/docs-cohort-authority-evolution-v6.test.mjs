import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-cohort-authority-evolution-v6.yml";
const testPath = "scripts/docs-cohort-authority-evolution-v6.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const forward = [
  ["governance/docs-qualified-cohorts.schema.json", "modified", "99ead31926964965e9061d5f3097f1beef1c31e8"],
  ["scripts/docs-cohort-policy.test.mjs", "modified", "bc64b1aed3013cf901196f7cbc69c8e049ed4f22"],
  ["scripts/docs-cohort-v2.test.mjs", "modified", "f129e6b73b0c3c274cc5eb52b05725747a96c768"],
].map(([filename, status, sha]) => ({ filename, status, sha }));
const rollback = [
  ["governance/docs-qualified-cohorts.schema.json", "modified", "cddbc867f15c5fb3c238a348f49c970a1a21ee06"],
  ["scripts/docs-cohort-policy.test.mjs", "modified", "464dd548ea0f32a8e7ff5c9c6df4a6f72adeacda"],
  ["scripts/docs-cohort-v2.test.mjs", "modified", "7f70c74c8cff84f214054f6e36cb1aca02f60c37"],
].map(([filename, status, sha]) => ({ filename, status, sha }));

async function classify(options = {}) {
  const files = options.files ?? forward;
  const failures = [];
  const outputs = new Map();
  const context = { repo: { owner: "agent-teams-ai", repo: ".github" }, payload: {
    pull_request: {
      number: 201,
      changed_files: Object.hasOwn(options, "changedFiles") ? options.changedFiles : files.length,
      head: { repo: options.missingHeadRepo ? null : { full_name: options.headRepo ?? repository } },
      base: { ref: options.baseRef ?? "main", sha: options.baseSha ?? baseSha },
    },
  } };
  const github = {
    paginate: async (method, args) => {
      assert.equal(method, github.rest.pulls.listFiles);
      assert.deepEqual(args, { owner: "agent-teams-ai", repo: ".github", pull_number: 201, per_page: 100 });
      if (options.apiError === "paginate") throw new Error("API unavailable");
      return Object.hasOwn(options, "paginated") ? options.paginated : files;
    },
    rest: {
      pulls: { listFiles: () => undefined },
      repos: {
        get: async () => {
          if (options.apiError === "get") throw new Error("API unavailable");
          return { data: { default_branch: Object.hasOwn(options, "defaultBranch") ? options.defaultBranch : "main" } };
        },
        getBranch: async (args) => {
          assert.deepEqual(args, { owner: "agent-teams-ai", repo: ".github", branch: "main" });
          if (options.apiError === "getBranch") throw new Error("API unavailable");
          return { data: { commit: { sha: options.branchSha ?? baseSha } } };
        },
      },
    },
  };
  const core = {
    setFailed: (message) => failures.push(message),
    setOutput: (name, value) => outputs.set(name, value),
  };
  if (options.missingHead) delete context.payload.pull_request.head;
  await execute(context, github, core);
  return { failures, outputs };
}

test("accepts exactly the complete forward and rollback Cohort v2 publication-reconciliation schema tuples", async () => {
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
  assert.match(workflow, /permissions:\n  contents: read\n  pull-requests: read\n\njobs:/u);
  assert.equal((workflow.match(/uses:/gu) ?? []).length, 1);
  assert.match(workflow, /actions\/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd/u);
  assert.doesNotMatch(workflow, /: write|permissions: write-all/u);
  assert.match(workflow, /name: trusted-cohort-authority-evolution-v6/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:|secrets\.|pull_request\.head\.sha|getContent/u);
});

test("rejects malformed counts and incomplete or malformed pagination before noop", async () => {
  for (const changedFiles of [undefined, null, "3", -1, 0, 1.5, NaN, Infinity, 3001, Number.MAX_SAFE_INTEGER + 1]) {
    assert.notEqual((await classify({ changedFiles })).failures.length, 0);
  }
  for (const paginated of [null, {}, [null], [{ filename: 1 }], [forward[0], forward[0], forward[2]]]) {
    assert.notEqual((await classify({ paginated })).failures.length, 0);
  }
  const files = Array.from({ length: 3000 }, (_, i) => ({ filename: `docs/data-${i}.md`, status: "modified", sha: baseSha }));
  assert.equal((await classify({ files })).outputs.get("mode"), "noop");
  assert.notEqual((await classify({ files, paginated: files.slice(0, 100) })).failures.length, 0);
});

test("rejects new authority and install files, including renames out of authority", async () => {
  for (const filename of [workflowPath, testPath, ".github/actions/new/action.yml", "tools/new.mjs",
    "scripts/new.mjs", "governance/new.schema.json", "nested/package.json", "nested/.npmrc",
    ".pnpmfile.cjs", ".node-version", "pnpm-lock.yaml", "pnpm-workspace.yaml", "renovate.json"]) {
    for (const file of [{ filename, status: "added", sha: baseSha },
      { filename: "docs/data.md", previous_filename: filename, status: "renamed", sha: baseSha }]) {
      const result = await classify({ files: [file] });
      assert.notEqual(result.failures.length, 0, filename);
      assert.equal(result.outputs.size, 0);
    }
  }
});

test("fails closed on missing identity, malformed live base, and API errors", async () => {
  for (const candidate of [{ missingHead: true }, { defaultBranch: undefined }, { defaultBranch: "" },
    { defaultBranch: null }, { baseSha: "invalid", branchSha: "invalid" }]) {
    assert.notEqual((await classify(candidate)).failures.length, 0);
  }
  for (const apiError of ["paginate", "get", "getBranch"]) {
    await assert.rejects(classify({ apiError }), /API unavailable/u);
  }
});

test("rejects each tuple member with a wrong status, blob, or rename", async () => {
  for (const tuple of [forward, rollback]) {
    for (let index = 0; index < tuple.length; index++) {
      for (const mutation of [{ status: "removed" }, { status: "renamed" },
        { sha: baseSha }, { previous_filename: "docs/old.md" }]) {
        const files = tuple.map((file, i) => i === index ? { ...file, ...mutation } : file);
        const result = await classify({ files });
        assert.notEqual(result.failures.length, 0);
        assert.equal(result.outputs.size, 0);
      }
    }
  }
});
