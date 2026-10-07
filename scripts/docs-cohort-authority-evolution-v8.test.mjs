import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";
import { assertVerifierAuthority } from "./check-docs-verifier-authority.mts";

const workflow = parse(await readFile(new URL("../.github/workflows/docs-cohort-authority-evolution-v8.yml", import.meta.url), "utf8"));
const steps = workflow.jobs["trusted-cohort-authority-evolution-v8"].steps;
const source = steps.find(step => step.with?.script)?.with.script;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", "require", "process", source);
const baseSha = "a".repeat(40), headSha = "b".repeat(40), treeSha = "c".repeat(40), headTreeSha = "d".repeat(40);
const manifest = await readFile("package.json"), lock = await readFile("pnpm-lock.yaml");
const blob = bytes => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

async function classify(mutate = () => {}, script = execute) {
  const tree = execFileSync("git", ["ls-tree", "-r", "HEAD"], { encoding: "utf8" }).trim().split("\n").map(line => {
    const [header, filePath] = line.split("\t"), [mode, type, sha] = header.split(" ");
    return { path: filePath, mode, type, sha };
  });
  for (const filePath of ["scripts/check-docs-verifier-authority.mts", "scripts/check-docs-verifier-authority.test.mts"]) {
    if (!tree.some(entry => entry.path === filePath)) tree.push({ path: filePath, sha: treeSha, mode: "100644", type: "blob" });
  }
  const state = { pull: { number: 303, changed_files: 1, state: "open", head: { sha: headSha, repo: { full_name: "agent-teams-ai/.github" } }, base: { ref: "main", sha: baseSha } },
    branch: baseSha, defaultBranch: "main", files: [], baseTree: { sha: treeSha, truncated: false, tree },
    headTree: { sha: headTreeSha, truncated: false, tree: structuredClone(tree) }, data: {}, contentCalls: 0, apiError: "" };
  const nextManifest = JSON.parse(manifest), nextLock = parse(lock.toString());
  nextManifest.devDependencies["s4-test-only"] = "1.2.3";
  nextLock.importers["."].devDependencies["s4-test-only"] = { specifier: "1.2.3", version: "1.2.3" };
  nextLock.packages["s4-test-only@1.2.3"] = { resolution: { integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}` } };
  nextLock.snapshots["s4-test-only@1.2.3"] = {};
  for (const [filePath, bytes] of [["package.json", Buffer.from(JSON.stringify(nextManifest))], ["pnpm-lock.yaml", Buffer.from(stringify(nextLock))]]) {
    const entry = state.headTree.tree.find(item => item.path === filePath); entry.sha = blob(bytes); entry.size = bytes.length;
    state.data[entry.sha] = { sha: entry.sha, size: bytes.length, encoding: "base64", content: bytes.toString("base64") };
    state.files.push({ filename: filePath, status: "modified", sha: entry.sha });
  }
  state.pull.changed_files = state.files.length;
  state.live = structuredClone(state.pull);
  mutate(state);
  const failures = [], outputs = new Map(), writes = new Map();
  const github = { paginate: async () => { if (state.apiError === "paginate") throw new Error("API unavailable"); return state.files; }, rest: {
    pulls: { listFiles: () => {}, get: async () => ({ data: state.live }) },
    repos: { get: async () => ({ data: { default_branch: state.defaultBranch } }), getBranch: async () => ({ data: { commit: { sha: state.branch } } }) },
    git: { getCommit: async ({ commit_sha }) => {
      assert.ok([baseSha, headSha].includes(commit_sha));
      return { data: { sha: commit_sha, tree: { sha: commit_sha === baseSha ? treeSha : headTreeSha } } };
    },
      getTree: async ({ tree_sha }) => {
        if (state.apiError === "getTree") throw new Error("API unavailable");
        assert.ok([treeSha, headTreeSha].includes(tree_sha));
        return { data: tree_sha === treeSha ? state.baseTree : state.headTree };
      },
      getBlob: async ({ file_sha }) => { state.contentCalls++; return { data: state.data[file_sha] }; } },
  } };
  const requireFixture = name => name === "node:path" ? path : { writeFile: async (target, bytes, options) => {
    assert.equal(options.flag, "wx"); assert.equal(writes.has(target), false); writes.set(target, bytes);
  } };
  try {
    await script({ repo: { owner: "agent-teams-ai", repo: ".github" }, payload: { pull_request: state.pull } }, github,
      { setFailed: message => failures.push(message), setOutput: (key, value) => outputs.set(key, value) }, requireFixture, { env: { RUNNER_TEMP: "/TEST-runner" } });
    if (outputs.has("evidence-path")) state.mode = assertVerifierAuthority(JSON.parse(writes.get(outputs.get("evidence-path"))), manifest, lock);
  } catch (error) { failures.push(error.message); }
  return { ...state, failures, outputs, writes };
}

test("actual v8 materializes Git-bound head data and base-owned comparator admits an ordinary devDependency", async () => {
  const result = await classify(); assert.deepEqual(result.failures, []); assert.equal(result.mode, "dependencies");
  assert.equal(result.contentCalls, 2); assert.equal(result.writes.size, 1);
});

test("v8 retains complete pagination, same-repository identity and live current-base enforcement before installation", async () => {
  for (const mutate of [
    s => { s.pull.changed_files = 0; }, s => { s.pull.changed_files = 3001; }, s => { s.files.pop(); },
    s => { s.files[1] = s.files[0]; }, s => { s.pull.head = undefined; },
    s => { s.pull.head.repo.full_name = "attacker/TEST-fork"; }, s => { s.defaultBranch = undefined; },
    s => { s.branch = "f".repeat(40); }, s => { s.pull.base.ref = "feature"; },
    s => { s.live.head.sha = "f".repeat(40); }, s => { s.headTree.truncated = true; },
    s => { s.headTree.sha = "f".repeat(40); }, s => { s.apiError = "paginate"; }, s => { s.apiError = "getTree"; },
  ]) {
    const result = await classify(mutate); assert.ok(result.failures.length > 0); assert.equal(result.writes.size, 0);
  }
});

test("v8 refuses missing metadata and oversized or Git-mismatched install data", async () => {
  for (const mutate of [
    s => { s.files[0].sha = "f".repeat(40); }, s => { s.files[0].status = undefined; },
    s => { s.files[0].previous_filename = "scripts/docs-platform-admission-recovery.mjs"; s.files[0].status = "renamed"; },
    s => { s.headTree.tree.find(e => e.path === "package.json").size = 65537; },
    s => { s.headTree.tree.find(e => e.path === "package.json").mode = "120000"; },
    s => { const data = Object.values(s.data)[0]; data.content = Buffer.from("{}").toString("base64"); },
    s => { Object.values(s.data)[0].sha = "f".repeat(40); },
  ]) assert.ok((await classify(mutate)).failures.length > 0);
});

test("v8 binds base checkout and native tools and its actual command propagates gate rejection", async () => {
  assert.deepEqual(workflow.on.pull_request_target.types, ["opened", "synchronize", "reopened", "edited"]);
  assert.deepEqual(workflow.permissions, { contents: "read", "pull-requests": "read" });
  assert.equal(workflow.jobs["trusted-cohort-authority-evolution-v8"].name, "trusted-cohort-authority-evolution-v8");
  const checkout = steps.find(step => step.uses?.startsWith("actions/checkout@"));
  assert.deepEqual(checkout.with, { ref: "${{ github.event.pull_request.base.sha }}", "persist-credentials": false });
  assert.equal(steps.find(step => step.uses?.startsWith("pnpm/action-setup@")).with.version, "11.18.0");
  assert.equal(steps.find(step => step.uses?.startsWith("actions/setup-node@")).with["node-version"], "24.21.0");
  for (const step of steps.filter(step => step.uses)) assert.match(step.uses, /@[0-9a-f]{40}$/u);
  const result = await classify(); assert.deepEqual(result.failures, []);
  const scratch = await mkdtemp(path.join(tmpdir(), "s4-v8-command-TEST-"));
  try {
    const evidencePath = path.join(scratch, "head-DATA.json");
    await writeFile(evidencePath, result.writes.get(result.outputs.get("evidence-path")));
    const command = () => promisify(execFile)("bash", ["-eu", "-c", steps.at(-1).run], {
      env: { ...process.env, AUTHORITY_EVIDENCE: evidencePath },
    });
    await command();
    await writeFile(evidencePath, "{}");
    await assert.rejects(command());
    assert.deepEqual(await readFile("package.json"), manifest);
    assert.deepEqual(await readFile("pnpm-lock.yaml"), lock);
  } finally { await rm(scratch, { recursive: true, force: true }); }
});

if (process.env.S4_OLD_V8) {
  test("accepted ordinary dependency scenario fails against historical v8", async () => {
    const old = parse(await readFile(process.env.S4_OLD_V8, "utf8"));
    const script = new AsyncFunction("context", "github", "core", old.jobs["trusted-cohort-authority-evolution-v8"].steps[0].with.script);
    const result = await classify(() => {}, script);
    assert.ok(result.failures.some(message => message.includes("exact forward or rollback")));
  });
}
