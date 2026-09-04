import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-cohort-authority-evolution-v4.yml";
const testPath = "scripts/docs-cohort-authority-evolution-v4.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const canonical = [
  [".github/workflows/docs-protocol-check.yml", "modified", "c30e87dabf7dda27c60d2d688b1ed9446fc2c23e"],
  ["GOVERNANCE.md", "modified", "e4976d350b7f7099c9293f6584c37da80fed8377"],
  ["README.md", "modified", "3b3945ad01573724c402928e6e5b734351355002"],
  ["docs/decisions/0005-qualified-docs-cohort-v2.md", "added", "149e70804d573375dd25d9fc1e26fafb4c2b708d"],
  ["docs/decisions/README.md", "modified", "270596a12937390e9cb3b2b18f52634ec19b2c34"],
  ["governance/docs-protocol-policy-v2.schema.json", "modified", "d45b368c2967f6347236b978971c6c0545f60b10"],
  ["governance/docs-qualified-cohorts.schema.json", "modified", "cddbc867f15c5fb3c238a348f49c970a1a21ee06"],
  ["renovate-config.json", "modified", "fc73e4c544e4e76b6d5c87bf5b007752b297bc68"],
  ["scripts/check-community-files.mjs", "modified", "15d424cc6e6c65094111b48ada7d228178dafb5e"],
  ["scripts/check-community-files.test.mjs", "modified", "78d52b974ff4cd72f44579b09d0bfd509ed6f755"],
  ["scripts/docs-cohort-policy.mjs", "modified", "4d05735b16bdb4dd06eb75712a356fc98376edc2"],
  ["scripts/docs-cohort-policy.test.mjs", "modified", "4e6e34f62b420cbc71f6ce8e47945066852bc172"],
  ["scripts/docs-cohort-v2.test.mjs", "added", "fa1de91ff6b4296fa055731f02c5bef7bf4c89ec"],
  ["scripts/verify-docs-cohort-v2-receipt.mjs", "added", "63e86f01863b2a31d73c22d1d1419e9828e9b131"],
  ["scripts/verify-docs-consumer-gate.mjs", "modified", "002f5b5841768426b11529679a2962a6860e94fc"],
  ["scripts/verify-docs-consumer-gate.test.mjs", "modified", "0d3977cde703a02f18ee7dd8d11ecea29e7068ff"],
].map(([filename, status, sha]) => ({ filename, status, sha }));

async function classify(options = {}) {
  const files = options.files ?? canonical;
  const failures = [];
  const outputs = new Map();
  const context = { repo: { owner: "agent-teams-ai", repo: ".github" }, payload: {
    pull_request: {
      number: 200,
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

test("accepts only the exact base-owned Cohort v2 substrate", async () => {
  const accepted = await classify();
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.outputs.get("mode"), "authority");
});

test("pins every allowed file to its exact current Git blob", async () => {
  for (const { filename, sha } of canonical) {
    const bytes = await readFile(filename);
    const actual = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    assert.equal(actual, sha, filename);
  }
});

test("rejects partial, renamed, extra, wrong-blob, and incomplete authority slices", async () => {
  for (const candidate of [
    { files: canonical.slice(1) },
    { files: canonical.map((file, index) => index === 0 ? { ...file, sha: "f".repeat(40) } : file) },
    { files: canonical.map((file, index) => index === 1 ? { ...file, previous_filename: "OLD.md" } : file) },
    { files: [...canonical, { filename: "scripts/extra.mjs", status: "added", sha: "f".repeat(40) }] },
    { files: [{ filename: workflowPath, status: "modified", sha: "f".repeat(40) }] },
    { files: [{ filename: testPath, status: "modified", sha: "f".repeat(40) }] },
    { files: canonical, changedFiles: 0 },
    { files: canonical, paginated: canonical.slice(0, -1) },
    { files: canonical, paginated: [...canonical, canonical[0]] },
  ]) {
    assert.notEqual((await classify(candidate)).failures.length, 0, JSON.stringify(candidate));
  }
});

test("rejects v4 workflow and test self-modification", async () => {
  for (const filename of [workflowPath, testPath]) {
    const files = [...canonical, { filename, status: "modified", sha: "f".repeat(40) }];
    const result = await classify({ files });
    assert.notEqual(result.failures.length, 0, filename);
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

test("treats non-authority data-only changes as noop", async () => {
  for (const filename of ["governance/docs-qualified-cohorts.json", "docs/notes.md"]) {
    const result = await classify({ files: [{ filename, status: "modified", sha: "e".repeat(40) }] });
    assert.deepEqual(result.failures, []);
    assert.equal(result.outputs.get("mode"), "noop");
  }
});

test("is base-owned, read-only, and never executes PR-head code", () => {
  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:|secrets\.|pull_request\.head\.sha|getContent/u);
});
