import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/docs-qualification-authority-evolution-v2.yml";
const testPath = "scripts/docs-qualification-authority-evolution-v2.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);
const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const canonical = [
  [".github/workflows/docs-admission-evidence.yml", "modified", "a9e9e806d2ceabec63b30f1587209bb76982ae47"],
  [".github/workflows/docs-protocol-check.yml", "modified", "d813b28bf4574fa9bca16abab8725d9ee10f9e1f"],
  [".github/workflows/organization-inventory-drift.yml", "added", "454895d3558437b884299e9e23402a4dca59ca19"],
  ["GOVERNANCE.md", "modified", "1c519ccca2cb2d8cb5f392bd858f71e1a9405f6e"],
  ["README.md", "modified", "114acb6eddf85c7ed8d7e39786bd3bdf8a9dc430"],
  ["docs/repository-admission.md", "modified", "a40279016009489d9bfe85a1a4c5f1b040d84a6d"],
  ["governance/docs-protocol-exceptions.json", "modified", "227ff02acba7de7a53a563ae2e93fa0322a1672a"],
  ["governance/docs-protocol-exceptions.schema.json", "modified", "b38e37acaa5f238f0000dcab581a3f9f69b33873"],
  ["governance/docs-protocol-policy-v2.json", "added", "2b0cb39bbb6f090a3d4febc143d39023999efe51"],
  ["governance/docs-protocol-policy-v2.schema.json", "added", "e1ed08c5e442572bb4bb19bc73804bbe4e1017e8"],
  ["governance/organization-repository-inventory.json", "modified", "39292f445d8e7a6f900421c2e1e0e35121d6af58"],
  ["governance/organization-repository-inventory.schema.json", "modified", "7d965016cd10a03df67b2c83fb9bd0366b14c779"],
  ["package.json", "modified", "b908c9a336c726e003f3f73fbbf33f9ff3fd90fb"],
  ["scripts/check-community-files.mjs", "modified", "e5b1217f466565494605be0f2eae17d1e65b878c"],
  ["scripts/check-community-files.test.mjs", "modified", "e16c0e58bcf82c16bb5e6e833cf4f2024c0f3e78"],
  ["scripts/docs-cohort-policy.test.mjs", "modified", "30a9a6e1d951fb4ee28ab649c0c7319e57882f6f"],
  ["scripts/governance-policy.mjs", "modified", "a6e6066101b043636d6a497bc9c5c0674da418d3"],
  ["scripts/governance-policy.test.mjs", "modified", "2e7c76454cb45de233c95029d3d3a92956d4a4c3"],
  ["scripts/observe-org-repository-inventory.mjs", "modified", "63e6697e586698d88c49f0f70add173e3c92dd47"],
  ["scripts/observe-org-repository-inventory.test.mjs", "added", "4e232469de5a11e4d940df222aabc0e8f81ff80a"],
  ["scripts/validate-governance.mjs", "modified", "990b2397c561846b64bdcec8cf4164df4bc9c154"],
  ["scripts/verify-docs-admission-change.mjs", "modified", "5703b7bdc63eac7570e3313255af2f33d7a5faf8"],
  ["scripts/verify-docs-consumer-gate.mjs", "modified", "98841e872e8e32fcc9301b2ff4ffc14042d7fb51"],
  ["scripts/verify-docs-consumer-gate.test.mjs", "modified", "2b0316a86ffd90d800a9990d709215d41c25b553"],
  ["scripts/verify-docs-qualification-receipt.mjs", "added", "bce2bae1df8c13fc35835bdb22fb4af1fa56637e"],
  ["scripts/verify-docs-qualification-receipt.test.mjs", "added", "39820cd47a6e5b9b76b187dc3ddf2c5b663e0ef8"],
].map(([filename, status, sha]) => ({ filename, status, sha }));

async function classify(options = {}) {
  const files = options.files ?? canonical;
  const paginated = options.paginated ?? files;
  const failures = [];
  const outputs = new Map();
  const context = {
    repo: { owner: "agent-teams-ai", repo: ".github" },
    payload: { pull_request: {
      number: 121,
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

test("accepts only the exact qualification-v2 authority slice", async () => {
  const accepted = await classify();
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.outputs.get("mode"), "authority");

  const cases = [
    { files: [...canonical, { filename: "docs/extra.md", status: "added" }] },
    { files: canonical.map((file, index) => index === 0 ? { ...file, status: "deleted" } : file) },
    { files: canonical.map((file, index) => index === 0 ? { ...file, previous_filename: "old.yml" } : file) },
    { headRepo: "attacker/fork" },
    { baseRef: "feature" },
    { branchSha: "b".repeat(40) },
    { paginated: canonical.slice(1), changedFiles: canonical.length },
    { paginated: [...canonical.slice(0, -1), canonical[0]], changedFiles: canonical.length },
    { files: [{ filename: workflowPath, status: "modified" }] },
    { files: [{ filename: testPath, status: "modified" }] },
    { files: [{ filename: "governance/unreviewed-authority.schema.json", status: "added" }] },
    { files: [{ filename: "pnpm-workspace.yaml", status: "modified" }] },
  ];
  for (const candidate of cases) {
    assert.notEqual((await classify(candidate)).failures.length, 0, JSON.stringify(candidate));
  }

  for (const [index, file] of canonical.entries()) {
    assert.notEqual(
      (await classify({ files: [{ ...file }] })).failures.length,
      0,
      `partial ${file.filename}`,
    );

    const incomplete = canonical.filter((_, candidateIndex) => candidateIndex !== index);
    assert.notEqual((await classify({ files: incomplete })).failures.length, 0, `missing ${file.filename}`);

    const wrongBlob = canonical.map((candidate, candidateIndex) => candidateIndex === index
      ? { ...candidate, sha: candidate.sha === "f".repeat(40) ? "e".repeat(40) : "f".repeat(40) }
      : candidate);
    assert.notEqual((await classify({ files: wrongBlob })).failures.length, 0, `wrong blob ${file.filename}`);
  }

  const unrelated = await classify({ files: [{ filename: "docs/notes.md", status: "modified" }] });
  assert.deepEqual(unrelated.failures, []);
  assert.equal(unrelated.outputs.get("mode"), "noop");

});

test("keeps the successor base-owned and non-executing", () => {
  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:/u);
  assert.doesNotMatch(workflow, /secrets\.|pull_request\.head\.sha|getContent/u);
});
