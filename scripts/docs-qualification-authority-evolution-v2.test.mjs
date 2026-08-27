import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  ".github/workflows/docs-qualification-authority-evolution-v2.yml",
  "utf8",
);
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);

async function classify(options = {}) {
  const files = options.files ?? [
    { filename: "governance/docs-protocol-policy-v2.json", status: "modified" },
  ];
  const paginated = options.paginated ?? files;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 123,
      changed_files: options.changedFiles ?? files.length,
    } },
  };
  const github = {
    paginate: async () => paginated,
    rest: { pulls: { listFiles: () => undefined } },
  };
  const core = {
    setFailed: (message) => failures.push(message),
    setOutput: (name, value) => outputs.set(name, value),
  };
  await execute(context, github, core);
  return { failures, outputs };
}

test("treats policy-v2 data and unrelated documentation as noop", async () => {
  for (const filename of [
    "governance/docs-protocol-policy-v2.json",
    "docs/repository-admission.md",
  ]) {
    const result = await classify({ files: [{ filename, status: "modified" }] });
    assert.deepEqual(result.failures, []);
    assert.equal(result.outputs.get("mode"), "noop");
  }
});

test("fails closed for workflow, script, schema, and install authority", async () => {
  for (const filename of [
    ".github/workflows/docs-qualification-authority-evolution-v2.yml",
    "scripts/governance-policy.mjs",
    "governance/docs-protocol-policy-v2.schema.json",
    "package.json",
  ]) {
    const result = await classify({ files: [{ filename, status: "modified" }] });
    assert.match(result.failures[0], /separately staged/u, filename);
    assert.equal(result.outputs.size, 0);
  }
});

test("detects renamed authority and rejects incomplete or duplicate pagination", async () => {
  const renamed = await classify({ files: [{
    filename: "docs/retired-script.md",
    previous_filename: "scripts/authority.mjs",
    status: "renamed",
  }] });
  assert.match(renamed.failures[0], /separately staged/u);

  const data = [{ filename: "governance/docs-protocol-policy-v2.json", status: "modified" }];
  const incomplete = await classify({ files: data, paginated: [], changedFiles: 1 });
  assert.match(incomplete.failures[0], /incomplete or duplicated/u);
  const duplicate = await classify({ files: data, paginated: [...data, ...data], changedFiles: 2 });
  assert.match(duplicate.failures[0], /incomplete or duplicated/u);
});

test("keeps the steady-state barrier base-owned and non-executing", () => {
  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:/u);
  assert.doesNotMatch(workflow, /secrets\.|pull_request\.head\.sha|getContent/u);
});
