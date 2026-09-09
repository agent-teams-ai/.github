import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { recoveryBlob, POLICY_PATH, EXCEPTIONS_PATH, RECOVERY_AUTHORITY_PATH } from "./docs-legacy-admission-recovery.mjs";

const workflow = await readFile(new URL("../.github/workflows/docs-admission-evidence.yml", import.meta.url), "utf8");
const block = workflow.split("          script: |\n")[1].split("      - uses: actions/checkout@")[0];
const source = block.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", "require", "process", source);


function gitTree(files) {
  const root = new Map(); const entries = [];
  for (const [filePath, content] of Object.entries(files)) {
    const parts = filePath.split("/"); let parent = root;
    for (const name of parts.slice(0, -1)) { if (!parent.has(name)) parent.set(name, new Map()); parent = parent.get(name); }
    parent.set(parts.at(-1), Buffer.from(content));
  }
  function directory(node, prefix) {
    const children = [];
    for (const [name, value] of node) {
      const filePath = prefix ? `${prefix}/${name}` : name;
      const entry = value instanceof Map ? { path: filePath, type: "tree", mode: "040000", sha: directory(value, filePath) }
        : { path: filePath, type: "blob", mode: "100644", sha: recoveryBlob(value), size: value.length };
      entries.push(entry); children.push({ ...entry, name });
    }
    children.sort((a, b) => Buffer.compare(Buffer.from(a.name + (a.type === "tree" ? "/" : "")), Buffer.from(b.name + (b.type === "tree" ? "/" : ""))));
    const bytes = Buffer.concat(children.flatMap((entry) => [Buffer.from(`${entry.mode.replace(/^0/u, "")} ${entry.name}\0`), Buffer.from(entry.sha, "hex")]));
    return createHash("sha1").update(`tree ${bytes.length}\0`).update(bytes).digest("hex");
  }
  return { sha: directory(root, ""), tree: entries, truncated: false };
}

async function fixture(mutate = () => {}) {
  const identity = { id: 1316243981, full_name: "agent-teams-ai/.github" };
  const pull = { id: 55, number: 88, state: "open", merged: false, changed_files: 1, commits: 1, updated_at: "2026-09-08T12:00:00Z",
    base: { repo: identity, sha: "a".repeat(40), ref: "main" },
    head: { repo: identity, sha: "b".repeat(40), ref: "synthetic-selection" } };
  const context = { eventName: "pull_request_target", sha: pull.base.sha, ref: "refs/heads/main",
    repo: { owner: "agent-teams-ai", repo: ".github" }, payload: { pull_request: pull } };
  const state = { context, files: [{ filename: POLICY_PATH, status: "modified", sha: recoveryBlob(Buffer.from(`synthetic:${POLICY_PATH}`)) }],
    live: structuredClone(pull), branch: pull.base.sha, contentShaWrong: false, contentCalls: 0,
    headFiles: { [POLICY_PATH]: `synthetic:${POLICY_PATH}`, [EXCEPTIONS_PATH]: `synthetic:${EXCEPTIONS_PATH}`, "README.md": "unchanged" },
    mutateTree: () => {}, comparisonStatus: "ahead",
    afterMaterialize: () => {}, controller: { ...identity, default_branch: "main", archived: false, disabled: false } };
  const oldTree = gitTree({ ...state.headFiles, [POLICY_PATH]: "prior-policy" });
  mutate(state);
  const newTree = gitTree(state.headFiles);
  state.mutateTree(newTree);
  const writes = new Map(); const outputs = new Map(); const failures = [];
  const github = { paginate: async () => state.files, rest: {
    pulls: { listFiles: () => {}, get: async () => ({ data: state.live }) },
    git: { getCommit: async ({ commit_sha }) => ({ data: { sha: commit_sha, tree: { sha: commit_sha === pull.base.sha ? oldTree.sha : newTree.sha } } }),
      getTree: async ({ tree_sha }) => ({ data: tree_sha === oldTree.sha ? oldTree : newTree }) },
    repos: { compareCommits: async () => ({ data: { status: state.comparisonStatus, base_commit: { sha: pull.base.sha },
      merge_base_commit: { sha: pull.base.sha }, behind_by: 0, ahead_by: 1, total_commits: 1 } }), get: async () => ({ data: state.controller }), getBranch: async () => ({ data: { commit: { sha: state.branch } } }),
      getContent: async ({ path: filePath, ref }) => {
        assert.equal(ref, pull.head.sha); assert.ok([POLICY_PATH, EXCEPTIONS_PATH].includes(filePath));
        state.contentCalls++;
        const content = Buffer.from(`synthetic:${filePath}`);
        if (state.contentCalls === 2) state.afterMaterialize();
        return { data: { type: "file", encoding: "base64", content: content.toString("base64"),
          sha: state.contentShaWrong ? "f".repeat(40) : recoveryBlob(content) } };
      } },
  } };
  const requireMock = (name) => {
    if (name === "node:path") return path;
    if (name === "node:crypto") return { createHash };
    assert.equal(name, "node:fs/promises");
    return { writeFile: async (filename, content, options) => {
      assert.equal(options.flag, "wx"); assert.equal(writes.has(filename), false); writes.set(filename, content);
    } };
  };
  try {
    await execute(context, github, { setFailed: (message) => failures.push(message), setOutput: (key, value) => outputs.set(key, value) },
      requireMock, { env: { RUNNER_TEMP: "/synthetic-runner" } });
  } catch (error) { failures.push(error.message); }
  return { ...state, writes, outputs, failures };
}

test("materializes only exact data and binds live central/base/head execution", async () => {
  const result = await fixture();
  assert.deepEqual(result.failures, []);
  assert.equal(result.outputs.get("mode"), "admission");
  assert.equal(result.writes.size, 3);
  const execution = JSON.parse(result.writes.get(result.outputs.get("execution-path")));
  assert.deepEqual(execution.changed_files, [POLICY_PATH]);
  assert.equal(execution.execution_base, "a".repeat(40));
  assert.equal(execution.head, "b".repeat(40));
  assert.equal(execution.pull_number, 88);
});

for (const mutation of [
  (s) => { s.files[0] = { filename: RECOVERY_AUTHORITY_PATH, status: "added" }; },
  (s) => { s.files[0] = { filename: RECOVERY_AUTHORITY_PATH, status: "modified" }; },
  (s) => { s.files[0] = { filename: "README.md", previous_filename: RECOVERY_AUTHORITY_PATH, status: "renamed" }; },
  (s) => { s.files[0] = { filename: "governance/evidence/docs-admission-recovery/incident.json", status: "added" }; },
]) {
  test("operative incident authority/proof changes never take the code-only no-op route", async () => {
    const result = await fixture(mutation);
    assert.match(result.failures.join("\n"), /separately trusted exact staging/u);
    assert.equal(result.outputs.has("mode"), false);
    assert.equal(result.contentCalls, 0);
  });
}

const mutations = {
  "head without live-base ancestry": (s) => { s.comparisonStatus = "diverged"; },
  "truncated recursive tree": (s) => { s.mutateTree = (tree) => { tree.truncated = true; }; },
  "omitted recursive tree entry": (s) => { s.mutateTree = (tree) => { tree.tree.pop(); }; },
  "symlink policy": (s) => { s.mutateTree = (tree) => { tree.tree.find((e) => e.path === POLICY_PATH).mode = "120000"; }; },
  "mode-changed data": (s) => { s.mutateTree = (tree) => { tree.tree.find((e) => e.path === POLICY_PATH).mode = "100755"; }; },
  "extra change hidden from file pages": (s) => { s.headFiles["README.md"] = "unreported"; },
  "extra new file hidden from file pages": (s) => { s.headFiles["unrelated/new.txt"] = "unreported"; },
  "file page lying about blob": (s) => { s.files[0].sha = "c".repeat(40); },

  "mixed executable authority": (s) => { s.files.push({ filename: "scripts/docs-legacy-admission-recovery.mjs", status: "modified" }); s.context.payload.pull_request.changed_files++; },
  "fork": (s) => { s.context.payload.pull_request.head.repo = { id: 99, full_name: "fork/central" }; },
  "stale event head": (s) => { s.live.head.sha = "c".repeat(40); },
  "wrong central identity": (s) => { s.controller.id = 99; },
  "wrong execution base": (s) => { s.context.sha = s.context.payload.pull_request.head.sha; },
  "wrong event": (s) => { s.context.eventName = "pull_request"; },
  "moving default branch": (s) => { s.afterMaterialize = () => { s.branch = "c".repeat(40); }; },
  "moving PR head": (s) => { s.afterMaterialize = () => { s.live.head.sha = "c".repeat(40); }; },
  "wrong materialized blob": (s) => { s.contentShaWrong = true; },
  "incomplete file page": (s) => { s.context.payload.pull_request.changed_files = 2; },
  "duplicate filenames": (s) => { s.files.push(s.files[0]); s.context.payload.pull_request.changed_files = 2; },
  "renamed policy": (s) => { s.files[0].previous_filename = "README.md"; },
  "deleted policy": (s) => { s.files[0].status = "removed"; },
  "unrelated collateral file": (s) => { s.files.push({ filename: "README.md", status: "modified" }); s.context.payload.pull_request.changed_files = 2; },
};
for (const [label, mutate] of Object.entries(mutations)) {
  test(`materializer rejects ${label}`, async () => {
    const result = await fixture(mutate);
    assert.ok(result.failures.length, label);
    assert.equal(result.outputs.has("mode"), false);
    assert.equal(result.writes.size, 0);
  });
}

test("ordinary code-only no-op is not reported as trusted recovery", async () => {
  const result = await fixture((s) => { s.files = [{ filename: "scripts/docs-legacy-admission-recovery.mjs", status: "added" }]; });
  assert.deepEqual(result.failures, []);
  assert.equal(result.outputs.get("mode"), "noop");
  assert.equal(result.writes.size, 0);
  assert.equal(result.contentCalls, 0);
  assert.match(workflow, /ref: \$\{\{ github.event.pull_request.base.sha \}\}/u);
  assert.match(workflow, /DOCS_ADMISSION_EXECUTION_PATH:/u);
});
