import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const workflowPath = ".github/workflows/docs-central-pr224-inverse-v1.yml";
const testPath = "scripts/docs-central-pr224-inverse-v1.test.mjs";
const workflow = await readFile(new URL(`../${workflowPath}`, import.meta.url), "utf8");
const [header, block, ...extra] = workflow.split("          script: |\n");
assert.equal(extra.length, 0);
assert.ok(block.trimEnd().split("\n").every((line) => line.startsWith("            ")));
const source = block.split("\n").map((line) => line.slice(12)).join("\n");
const tupleText = /^const tuple = (.+);$/mu.exec(source)[1];
const production = JSON.parse(tupleText);
const digest = (bytes, kind = "sha256") => createHash(kind).update(bytes).digest("hex");
const objectHash = (kind, bytes) => createHash("sha1").update(`${kind} ${bytes.length}\0`).update(bytes).digest("hex");
const clone = (value) => structuredClone(value);
const other = "f".repeat(40);
const pr = 424242; // Offline fixture only: not a future authorized PR.
const identity = { id: 1316243981, name: ".github", full_name: "agent-teams-ai/.github",
  owner: { login: "agent-teams-ai" }, default_branch: "main" };
const bodies = new Map();
function body(text) {
  const bytes = Buffer.from(text), sha = objectHash("blob", bytes);
  bodies.set(sha, bytes); return sha;
}
// Replace ONLY base-owned constant data for offline fixtures. Execute the complete
// extracted orchestration without stubbing any guard function or decision.
const tuple = production.map((row) => {
  const result = { ...row };
  for (const side of ["old", "new"]) {
    const bytes = Buffer.from(`independent inverse fixture ${side} ${row.path}\n`);
    result[side + "_blob"] = body(bytes);
    result[side + "_bytes"] = bytes.length;
    result[side + "_sha256"] = digest(bytes);
  }
  return result;
});
const manifestDigest = (rows, number) => digest(JSON.stringify(["central-pr224-inverse-manifest-v1",
  identity.full_name, identity.id, number, "main", [...rows].sort((a,b) => a.path.localeCompare(b.path)).map(
    row => [row.path, ...["old", "new"].flatMap(side => ["mode", "type", "blob", "bytes", "sha256"].map(
      field => row[side + "_" + field]))])]));
const productionPRLine = /^const inversePR = (.+);$/mu.exec(source)[0];
const productionPR = JSON.parse(/^const inversePR = (.+);$/mu.exec(source)[1]);
assert.ok(productionPR === "UNBOUND" || (Number.isSafeInteger(productionPR) && productionPR > 0));
const boundSource = source.replace(productionPRLine, `const inversePR = ${pr};`)
  .replace(`const tuple = ${tupleText};`, `const tuple = ${JSON.stringify(tuple)};`);
function compile(code) { return new vm.Script(`(async () => {\n${code}\n})()`, { filename: workflowPath }); }
const bound = compile(boundSource);
const unbound = compile(source.replace(productionPRLine, 'const inversePR = "UNBOUND";'));
function gitTree(leaves) {
  const entries = clone(leaves), directories = new Set([""]);
  for (const leaf of leaves) {
    const parts = leaf.path.split("/");
    while (parts.length > 1) { parts.pop(); directories.add(parts.join("/")); }
  }
  let root;
  for (const path of [...directories].sort((a, b) => b.length - a.length)) {
    const children = entries.filter((entry) => entry.path.split("/").slice(0, -1).join("/") === path);
    const key = (entry) => Buffer.from(entry.path.split("/").at(-1) + (entry.type === "tree" ? "/" : ""));
    children.sort((a, b) => Buffer.compare(key(a), key(b)));
    const bytes = Buffer.concat(children.flatMap((entry) => [
      Buffer.from(`${Number(entry.mode)} ${entry.path.split("/").at(-1)}\0`), Buffer.from(entry.sha, "hex") ]));
    const sha = objectHash("tree", bytes);
    if (path) entries.push({ path, mode: "040000", type: "tree", sha }); else root = sha;
  }
  return { sha: root, truncated: false, tree: entries };
}
function fixture(base = "a".repeat(40), head = "b".repeat(40)) {
  const pull = { id: 1234, number: pr, state: "open", draft: false, merged: false,
    changed_files: 3, commits: 2, updated_at: "2026-09-08T12:00:00Z",
    base: { ref: "main", sha: base, repo: clone(identity) },
    head: { ref: "synthetic-recovery", sha: head, repo: clone(identity) } };
  const leaves = (side) => [...tuple.filter((row) => row[side] !== null).map((row) => ({ path: row.path, sha: row[side] })),
    ...[workflowPath, testPath, "README.md", "governance/docs-qualified-cohorts.json"].map((path) => ({ path, sha: body(`inert ${path}\n`) }))
  ].map((entry) => ({ ...entry, mode: "100644", type: "blob", size: bodies.get(entry.sha).length }));
  return { base, head, context: { eventName: "pull_request_target", sha: base, ref: "refs/heads/main",
    repo: { owner: "agent-teams-ai", repo: ".github" }, payload: { action: "synchronize", number: pr,
      repository: clone(identity), pull_request: clone(pull) } },
    pulls: [clone(pull), clone(pull)], controllers: [clone(identity), clone(identity)],
    branches: [0, 1].map(() => ({ name: "main", commit: { sha: base } })),
    pages: [tuple.map((row) => ({ filename: row.path, status: row.status, sha: row.new_blob })), []],
    comparison: { status: "ahead", base_commit: { sha: base }, merge_base_commit: { sha: base },
      ahead_by: 2, behind_by: 0, total_commits: 2 }, old: leaves("old_blob"), next: leaves("new_blob"), calls: [], outputs: [], logs: [] };
}
async function run(f = fixture(), alter = () => {}, script = bound) {
  const trees = { [f.base]: gitTree(f.old), [f.head]: gitTree(f.next) }, counts = new Map();
  const api = (name, data) => async (args) => {
    assert.equal(args.owner, "agent-teams-ai"); assert.equal(args.repo, ".github");
    assert.equal(args.headers["Cache-Control"], "no-cache");
    const n = counts.get(name) ?? 0; counts.set(name, n + 1);
    assert.deepEqual(f.outputs, [], "no evidence before final read completes");
    assert.deepEqual(f.logs, [], "no success log before final read completes");
    f.calls.push({ name, args: clone(args) });
    const response = { status: 200, headers: { "content-type": "application/json; charset=utf-8" }, data: clone(data(args, n)) };
    await alter(name, response, n, f.calls.length); return response;
  };
  const github = { rest: {
    pulls: {
      get: api("pulls.get", (args, n) => { assert.equal(args.pull_number, f.context.payload.number); return f.pulls[n]; }),
      listFiles: api("pulls.listFiles", (args) => {
        assert.equal(args.pull_number, f.context.payload.number); assert.equal(args.per_page, 100); return f.pages[args.page - 1]; })
    }, repos: {
      get: api("repos.get", (_, n) => f.controllers[n]),
      getBranch: api("repos.getBranch", (args, n) => { assert.equal(args.branch, "main"); return f.branches[n]; }),
      compareCommits: api("repos.compareCommits", (args) => {
        assert.equal(args.base, f.base); assert.equal(args.head, f.head); return f.comparison; })
    }, git: {
      getCommit: api("git.getCommit", (args) => {
        assert.ok(trees[args.commit_sha]); return { sha: args.commit_sha, tree: { sha: trees[args.commit_sha].sha } }; }),
      getTree: api("git.getTree", (args) => {
        assert.equal(args.recursive, "1"); const tree = Object.values(trees).find((entry) => entry.sha === args.tree_sha);
        assert.ok(tree); return tree; }),
      getBlob: api("git.getBlob", (args) => {
        const bytes = bodies.get(args.file_sha); assert.ok(bytes, "fixture blob exists");
        return { sha: args.file_sha, size: bytes.length, encoding: "base64", content: bytes.toString("base64") }; })
    }
  } };
  await script.runInNewContext({ context: f.context, github, Buffer,
    require: (name) => { assert.equal(name, "node:crypto"); return { createHash }; },
    core: { setOutput: (name, value) => f.outputs.push([name, value]), info: (value) => f.logs.push(value) }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return f;
}
async function rejected(f, alter, pattern = /./u, script = bound) {
  await assert.rejects(run(f, alter, script), pattern);
  assert.deepEqual(f.outputs, []); assert.deepEqual(f.logs, []);
}
function rejectCase(name, change) { test(name, async () => { const f = fixture(); change(f); await rejected(f); }); }

test("production pins PR224 and all three exact old/new regular-file tuples", async () => {
  assert.equal(productionPR, 226);
  assert.equal(digest(tupleText), "4e25b6bfec3659a2d21ad5e22e744c1ebb9bb7821d44e127d954c0198ebcc624");
  assert.equal(production.length, 3);
  assert.deepEqual(production.map(row => row.path), ["scripts/docs-admission-change.test.mjs", "scripts/docs-admission-recovery.test.mjs", "scripts/verify-docs-cohort-evidence.mjs"]);
  assert.ok(production.every(row => row.status === "modified" && ["old", "new"].every(side =>
    row[side + "_mode"] === "100644" && row[side + "_type"] === "blob")));
  assert.doesNotMatch(source, /patchSHA256/);
  const f = fixture(); await rejected(f, undefined, /UNBOUND/u, unbound); assert.deepEqual(f.calls, []);
});
for (const invalid of ['"UNBOUND"', 'null', '0', '-1', '1.5', '"424242"', '9007199254740992']) {
  test(`invalid/unbound PR constant ${invalid} fails before IO`, async () => {
    const f = fixture(); await rejected(f, undefined, /UNBOUND/u,
      compile(boundSource.replace(`const inversePR = ${pr};`, `const inversePR = ${invalid};`)));
    assert.equal(f.calls.length, 0);
  });
}
test("complete synthetic three-file modified tuple emits exact evidence only after final reread", async () => {
  const f = await run();
  assert.equal(f.outputs.length, 1); assert.equal(f.outputs[0][0], "evidence");
  const evidence = JSON.parse(f.outputs[0][1]);
  assert.deepEqual(evidence, { repository: identity.full_name, repositoryId: identity.id, pr, base: f.base, head: f.head,
    baseTree: gitTree(f.old).sha, headTree: gitTree(f.next).sha,
    manifestSHA256: manifestDigest(tuple, pr), guardPath: workflowPath,
    guardBlob: f.old.find((row) => row.path === workflowPath).sha, testBlob: f.old.find((row) => row.path === testPath).sha,
    result: "exact_inverse_transition", files: tuple });
  assert.deepEqual(f.logs, [f.outputs[0][1]]);
  assert.deepEqual(f.calls.slice(-3).map((row) => row.name), ["pulls.get", "repos.get", "repos.getBranch"]);
  assert.equal(f.calls.filter((row) => row.name === "git.getBlob").length, 8);
});
test("fresh context/event/live tuple after staging/rebase is evaluated anew, external cutover must rebind", async () => {
  const f = await run(fixture("c".repeat(40), "d".repeat(40)));
  assert.equal(JSON.parse(f.outputs[0][1]).base, "c".repeat(40));
  assert.equal(JSON.parse(f.outputs[0][1]).head, "d".repeat(40));
});
for (const row of tuple) {
  for (const side of ["old", "next"]) rejectCase(`${side} wrong blob/absence ${row.path}`, (f) => {
    const entry = f[side].find((entry) => entry.path === row.path);
    if (entry) entry.sha = other; else f[side].push(clone(f.next.find((entry) => entry.path === row.path)));
  });
  rejectCase(`wrong file-list blob ${row.path}`, (f) => { f.pages[0].find((entry) => entry.filename === row.path).sha = other; });
  rejectCase(`wrong file status ${row.path}`, (f) => { f.pages[0].find((entry) => entry.filename === row.path).status = "renamed"; });
  rejectCase(`missing tree addition/modification ${row.path}`, (f) => { f.next = f.next.filter((entry) => entry.path !== row.path); });
  rejectCase(`executable mode ${row.path}`, (f) => { f.next.find((entry) => entry.path === row.path).mode = "100755"; });
}
for (const field of ["id", "full_name", "name", "owner"]) {
  for (const target of ["event", "base", "head", "controller-start", "controller-end"]) {
    rejectCase(`wrong repository ${field} on ${target}`, (f) => {
      const object = target === "event" ? f.context.payload.repository : target.startsWith("controller")
        ? f.controllers[target.endsWith("end") ? 1 : 0] : f.context.payload.pull_request[target].repo;
      object[field] = field === "id" ? identity.id + 1 : field === "owner" ? null : "renamed/fork";
    });
  }
}
for (const phase of [0, 1]) {
  for (const field of ["base.sha", "head.sha", "base.ref", "head.ref", "updated_at", "id", "commits", "changed_files", "state", "draft", "merged", "head.repo", "base.repo"]) {
    rejectCase(`stale/malformed pull ${field} at snapshot ${phase}`, (f) => {
      const parts = field.split("."), parent = parts.length === 2 ? f.pulls[phase][parts[0]] : f.pulls[phase];
      parent[parts.at(-1)] = field.endsWith(".repo") ? null : field.endsWith(".sha") ? other : "changed";
    });
  }
  rejectCase(`changed default branch at snapshot ${phase}`, (f) => { f.controllers[phase].default_branch = "elsewhere"; });
  rejectCase(`changed live branch SHA at snapshot ${phase}`, (f) => { f.branches[phase].commit.sha = other; });
}
for (const path of [workflowPath, testPath, "README.md", "governance/docs-qualified-cohorts.json", "unprotected/new.txt"]) {
  rejectCase(`extra file ${path}`, (f) => { f.pages[0].push({ filename: path, sha: other, status: "modified" }); });
  rejectCase(`hidden full-tree edit ${path}`, (f) => {
    const entry = f.next.find((entry) => entry.path === path);
    if (entry) entry.sha = other; else f.next.push({ path, type: "blob", mode: "100644", size: 1, sha: other });
  });
}
const mutations = {
  "wrong event PR": (f) => { f.context.payload.number = 203; },
  "historical PR203 in every snapshot": (f) => {
    f.context.payload.number = f.context.payload.pull_request.number = 203; f.pulls.forEach((p) => { p.number = 203; }); },
  "historical two-file tuple": (f) => { f.pages[0] = [
    { filename: "scripts/verify-docs-consumer-gate.mjs", status: "modified", sha: "c416a963f83078cb5016c9693a65ce5f3a7bfe4d" },
    { filename: "scripts/verify-docs-consumer-gate.test.mjs", status: "modified", sha: "35bccd46a95f28697fc6b3183c148008aaee7c47" } ]; },
  "wrong event": (f) => { f.context.eventName = "pull_request"; },
  "wrong action": (f) => { f.context.payload.action = "closed"; },
  "wrong context owner": (f) => { f.context.repo.owner = "fork"; },
  "wrong context repo": (f) => { f.context.repo.repo = "fork"; },
  "stale execution SHA": (f) => { f.context.sha = other; },
  "wrong execution ref": (f) => { f.context.ref = `refs/pull/${pr}/merge`; },
  "zero head": (f) => { f.context.payload.pull_request.head.sha = "0".repeat(40); },
  "all fork snapshots": (f) => { f.context.payload.pull_request.head.repo.id = 99; f.pulls.forEach((p) => { p.head.repo.id = 99; }); },
  "missing pull": (f) => { delete f.context.payload.pull_request; },
  "missing repository": (f) => { delete f.context.payload.repository; },
  "subset": (f) => { f.pages[0].pop(); },
  "duplicate": (f) => { f.pages[0][1] = f.pages[0][0]; },
  "split pages": (f) => { f.pages[1] = f.pages[0].splice(1); },
  "second page": (f) => { f.pages[1] = [f.pages[0][0]]; },
  "null file": (f) => { f.pages[0][0] = null; },
  "non-array page": (f) => { f.pages[0] = {}; },
  "rename source": (f) => { f.pages[0][0].previous_filename = workflowPath; },
  "null rename": (f) => { f.pages[0][0].previous_filename = null; },
  "both executable modes": (f) => { f.old[0].mode = f.next[0].mode = "100755"; },
  "symlink": (f) => { f.next[0].mode = "120000"; },
  "submodule": (f) => { f.next[0].mode = "160000"; f.next[0].type = "commit"; },
  "hidden deletion": (f) => { f.next.pop(); },
  "guard absent from both trees": (f) => { f.old = f.old.filter((r) => r.path !== workflowPath); f.next = f.next.filter((r) => r.path !== workflowPath); },
  "tests absent from both trees": (f) => { f.old = f.old.filter((r) => r.path !== testPath); f.next = f.next.filter((r) => r.path !== testPath); },
  "diverged": (f) => { f.comparison.status = "diverged"; },
  "wrong merge base": (f) => { f.comparison.merge_base_commit.sha = other; },
  "wrong comparison base": (f) => { f.comparison.base_commit.sha = other; },
  "head behind": (f) => { f.comparison.behind_by = 1; },
  "wrong commit count": (f) => { f.comparison.total_commits = 1; }
};
for (const [name, change] of Object.entries(mutations)) rejectCase(`rejects ${name}`, change);
for (const [name, alter] of Object.entries({
  truncated: (r) => { r.data.truncated = true; },
  "missing truncation": (r) => { delete r.data.truncated; },
  duplicate: (r) => { r.data.tree.push(r.data.tree[0]); },
  omitted: (r) => { r.data.tree.pop(); },
  null: (r) => { r.data.tree[0] = null; },
  traversal: (r) => { r.data.tree[0].path = "../escape"; },
  "wrong root": (r) => { r.data.sha = other; },
  "inconsistent subtree": (r) => { r.data.tree.find((entry) => entry.type === "tree").sha = other; },
  "missing parent": (r) => { r.data.tree = r.data.tree.filter((entry) => entry.path !== "scripts"); },
  "empty extra directory": (r) => { r.data.tree.push({ path: "unrelated-empty", type: "tree", mode: "040000", sha: objectHash("tree", Buffer.alloc(0)) }); }
})) {
  for (const phase of [0, 1]) test(`rejects ${name} tree ${phase}`, async () => {
    await rejected(fixture(), (method, r, n) => { if (method === "git.getTree" && n === phase) alter(r); });
  });
}
for (const [name, alter] of Object.entries({
  "wrong blob": (r) => { r.data.sha = other; },
  "wrong size": (r) => { r.data.size++; },
  "wrong encoding": (r) => { r.data.encoding = "utf8"; },
  "bad base64": (r) => { r.data.content += "!"; },
  "body substitution": (r) => { r.data.content = Buffer.alloc(r.data.size, 65).toString("base64"); },
  "missing body": (r) => { delete r.data.content; },
  "oversize": (r) => { r.data.size = 1048577; }
})) {
  for (let occurrence = 0; occurrence < 8; occurrence++) test(`rejects ${name} blob ${occurrence}`, async () => {
    await rejected(fixture(), (method, r, n) => { if (method === "git.getBlob" && n === occurrence) alter(r); });
  });
}
test("rejects incorrect SHA256 with correct Git blob", async () => {
  const badTuple = clone(tuple); badTuple[0].new_sha256 = "0".repeat(64);
  await rejected(fixture(), undefined, /SHA256/u,
    compile(boundSource.replace(`const tuple = ${JSON.stringify(tuple)};`, `const tuple = ${JSON.stringify(badTuple)};`)));
});
test("accepts GitHub LF-wrapped base64 without evaluating bytes", async () => {
  await run(fixture(), (method, r) => { if (method === "git.getBlob") r.data.content = r.data.content.match(/.{1,20}/gu).join("\n") + "\n"; });
});
const calls = (await run()).calls.length;
for (let call = 1; call <= calls; call++) {
  for (const failure of ["exception", "status", "content-type", "missing-data"]) {
    test(`fails closed on API ${failure} call ${call}`, async () => {
      await rejected(fixture(), (_, r, __, index) => {
        if (index !== call) return;
        if (failure === "exception") throw new Error("API unavailable");
        if (failure === "status") r.status = 403;
        if (failure === "content-type") r.headers["content-type"] = "text/html";
        if (failure === "missing-data") r.data = null;
      });
    });
  }
}
const terminal = (link) => (method, r, n) => { if (method === "pulls.listFiles" && n === 1) r.headers.link = link; };
for (const route of ["repositories/1316243981", "repos/agent-teams-ai/.github"]) {
  for (const query of ["per_page=100&page=1", "page=1&per_page=100"]) test(`backlinks accepted ${route} ${query}`, async () => {
    const url = `https://api.github.com/${route}/pulls/${pr}/files?${query}`;
    const f = await run(fixture(), terminal(["prev", "last", "first"].map((rel) => `<${url}>; rel="${rel}"`).join(", ")));
    assert.deepEqual(f.calls.filter((row) => row.name === "pulls.listFiles").map((row) => row.args.page), [1, 2]);
  });
}
const pageOne = `https://api.github.com/repositories/1316243981/pulls/${pr}/files?per_page=100&page=1`;
for (const link of [null, 3, "", "malformed", `<${pageOne}>; rel="next"`,
  ...[pageOne.replace("api.github.com", "evil.example"), pageOne.replace("1316243981", "2"),
    pageOne.replace(String(pr), "203"), pageOne.replace("page=1", "page=2"), pageOne + "&extra=1",
    pageOne.replace("https:", "http:"), pageOne.replace("api.github.com", "user@api.github.com"),
    pageOne.replace("api.github.com", "api.github.com:443")].map((url) => `<${url}>; rel="prev"`)]) {
  test(`rejects terminal pagination ${link}`, async () => { await rejected(fixture(), terminal(link), /continuation/u); });
}
test("rejects any first-page continuation", async () => {
  await rejected(fixture(), (method, r, n) => { if (method === "pulls.listFiles" && n === 0) r.headers.link = `<${pageOne}>; rel="next"`; });
});
test("PR text is inert and workflow is a single unconditional pinned base-owned read-only step", async () => {
  const f = fixture(), poison = '${{ secrets.TOKEN }} $(touch /unsafe) `id`; throw new Error("executed")';
  f.context.payload.pull_request.title = f.context.payload.pull_request.body = poison;
  for (const file of f.pages[0]) file.patch = file.raw_url = file.content = poison;
  await run(f);
  assert.equal(header, `name: Trusted Central PR224 Inverse v1\n\non:\n  pull_request_target:\n    types: [opened, synchronize, reopened, edited, ready_for_review]\n\npermissions:\n  contents: read\n  pull-requests: read\n\njobs:\n  trusted-central-pr224-inverse-v1:\n    name: trusted-central-pr224-inverse-v1\n    runs-on: ubuntu-24.04\n    timeout-minutes: 3\n    steps:\n      - uses: actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd # v8.0.0\n        with:\n`);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:|\bif:|secrets\.|write-all|id-token|\$\{\{/u);
  assert.doesNotMatch(source, /\beval\s*\(|\bFunction\s*\(|\bimport\s*\(|\bprocess\b|child_process|fetch\s*\(/u);
});

rejectCase("rejects a correctly hashed unrelated empty directory", (f) => {
  f.next.push({ path: "unrelated-empty", type: "tree", mode: "040000", sha: objectHash("tree", Buffer.alloc(0)) });
});
for (const count of [0, -1, 1, 2, 4, 3.5, "3", null, Number.MAX_SAFE_INTEGER + 1]) {
  rejectCase(`invalid event file count ${count}`, (f) => { f.context.payload.pull_request.changed_files = count; });
}
for (const phase of [0, 1]) {
  test(`rejects wrong immutable commit SHA at phase ${phase}`, async () => {
    await rejected(fixture(), (method, r, n) => { if (method === "git.getCommit" && n === phase) r.data.sha = other; });
  });
}

// Both-side extension: correct immutable Git objects alone are insufficient.
for (const side of ["old", "new"]) {
  for (let index = 0; index < tuple.length; index++) {
    test(`rejects ${side} SHA256 with correct Git object at path ${index}`, async () => {
      const bad = clone(tuple); bad[index][side + "_sha256"] = "0".repeat(64);
      await rejected(fixture(), undefined, /SHA256/u,
        compile(boundSource.replace(`const tuple = ${JSON.stringify(tuple)};`, `const tuple = ${JSON.stringify(bad)};`)));
    });
    for (const field of ["mode", "type", "size"]) rejectCase(`${side} wrong tree ${field} path ${index}`, f => {
      const entry = f[side === "old" ? "old" : "next"][index];
      entry[field] = field === "mode" ? "100755" : field === "type" ? "commit" : entry.size + 1;
    });
    test(`rejects ${side} expected length mismatch at path ${index}`, async () => {
      const bad = clone(tuple); bad[index][side + "_bytes"]++;
      await rejected(fixture(), undefined, /size/u,
        compile(boundSource.replace(`const tuple = ${JSON.stringify(tuple)};`, `const tuple = ${JSON.stringify(bad)};`)));
    });
  }
}
for (const status of ["removed", "added", "copied", "unchanged"]) rejectCase(`rejects status ${status}`, f => {
  f.pages[0][0].status = status;
});
rejectCase("rejects forward old-to-new tuple even on bound PR", f => {
  [f.old, f.next] = [f.next, f.old];
  f.pages[0].forEach((file, i) => { file.sha = tuple[i].old_blob; });
});
rejectCase("rejects identical tree/no-op", f => { f.next = clone(f.old); });
for (const number of [210, 209, 224, 0, null, "UNBOUND", "424242"]) {
  rejectCase(`rejects other or malformed PR ${number} in every snapshot`, f => {
    f.context.payload.number = f.context.payload.pull_request.number = number;
    f.pulls.forEach(pull => { pull.number = number; });
  });
}
for (const [field, value] of [["draft", true], ["state", "closed"], ["merged", true]]) {
  rejectCase(`rejects consistently ${field}=${value}`, f => {
    f.context.payload.pull_request[field] = value; f.pulls.forEach(pull => { pull[field] = value; });
  });
}
for (const path of [workflowPath, testPath, ".github/workflows/docs-central-recovery-transition.yml",
  "scripts/docs-central-recovery-transition.test.mjs", ".github/workflows/docs-cohort-authority-evolution-v5.yml"]) {
  rejectCase(`rejects hidden guard addition/change ${path}`, f => {
    f.next = f.next.filter(row => row.path !== path);
    f.next.push({ path, type: "blob", mode: "100644", size: 1, sha: other });
  });
  if ([workflowPath, testPath].includes(path)) {
    rejectCase(`rejects guard deletion ${path}`, f => { f.next = f.next.filter(row => row.path !== path); });
    rejectCase(`rejects guard rename ${path}`, f => { f.next.find(row => row.path === path).path += ".renamed"; });
  }
}
for (const phase of [0, 1]) test(`rejects tree pagination ${phase}`, async () => {
  await rejected(fixture(), (method, r, n) => { if (method === "git.getTree" && n === phase) r.headers.link = "next"; });
});
for (const link of [null, false, 0, "", "malformed"]) test(`rejects malformed first-page link ${link}`, async () => {
  await rejected(fixture(), (method, r, n) => { if (method === "pulls.listFiles" && n === 0) r.headers.link = link; });
});
for (const content of ["A===", "AB==", "AAA", "AAAA\r\n", "AAAA ", "-_=="]) {
  test(`rejects noncanonical base64 ${JSON.stringify(content)}`, async () => {
    await rejected(fixture(), (method, r, n) => { if (method === "git.getBlob" && n === 0) r.data.content = content; });
  });
}
test("production PR constant rejects synthetic PR before IO without constant replacement", async () => {
  const f = fixture(); await rejected(f, undefined, /PR/u, compile(source)); assert.deepEqual(f.calls, []);
});
test("manifest covers both sides and lengths and is independent of tuple order", () => {
  const original = manifestDigest(production, 226);
  assert.equal(original, manifestDigest([...production].reverse(), 226));
  for (const side of ["old", "new"]) for (const field of ["mode", "type", "blob", "bytes", "sha256"]) {
    const changed = clone(production); changed[0][side + "_" + field] = "different";
    assert.notEqual(original, manifestDigest(changed, 226));
  }
  assert.notEqual(original, manifestDigest(production, 210));
});

test("production PR226 binding accepts the exact synthetic tuple through final reread", async () => {
  const f = fixture();
  f.context.payload.number = f.context.payload.pull_request.number = 226;
  f.pulls.forEach(pull => { pull.number = 226; });
  await run(f, undefined, compile(source.replace(`const tuple = ${tupleText};`, `const tuple = ${JSON.stringify(tuple)};`)));
  assert.equal(JSON.parse(f.outputs[0][1]).pr, 226);
  assert.equal(JSON.parse(f.outputs[0][1]).manifestSHA256, manifestDigest(tuple, 226));
  assert.deepEqual(f.calls.slice(-3).map(row => row.name), ["pulls.get", "repos.get", "repos.getBranch"]);
});
for (const value of ["nonsense", "2026-02-30T12:00:00Z", "2026-09-09", "", null]) {
  rejectCase(`rejects consistently malformed timestamp ${value}`, f => {
    f.context.payload.pull_request.updated_at = value;
    f.pulls.forEach(pull => { pull.updated_at = value; });
  });
}

rejectCase("rejects entire original PR210 implementation file tuple on bound PR", f => {
  f.pages[0] = [{"filename":".github/workflows/docs-admission-evidence.yml","status":"modified","sha":"5ad526fd141a572e34c22209e49f124005b7401b"},{"filename":"docs/decisions/0006-bounded-central-admission-recovery.md","status":"added","sha":"84c190236e76c58855d297d47ef253307519396d"},{"filename":"scripts/docs-admission-change.test.mjs","status":"added","sha":"883a4190103ee798368e1470c44d3f83124b6073"},{"filename":"scripts/docs-admission-recovery.test.mjs","status":"added","sha":"4b2d479f00286bfc266d565c5ab84f833ed56ebc"},{"filename":"scripts/docs-admission-workflow.test.mjs","status":"added","sha":"da21e160af7fcd3c4a004b97739f0756774139ed"},{"filename":"scripts/docs-cohort-policy.test.mjs","status":"modified","sha":"77effa8d9495cc9dd153a97a187c37fc595fc7dc"},{"filename":"scripts/docs-legacy-admission-recovery.mjs","status":"added","sha":"123adee6f039d45c22ae6e8ded98585ed6a46e3f"},{"filename":"scripts/docs-legacy-admission-recovery.test.mjs","status":"added","sha":"0de232fe1af305fdef74769fb931d581bd069d83"},{"filename":"scripts/verify-docs-admission-change.mjs","status":"modified","sha":"e0448f06d34ea0cb308083dc07380252e4bfd3df"},{"filename":"scripts/verify-docs-cohort-evidence.mjs","status":"modified","sha":"6543f425fe424170909bfe7a71dbfbbdbf475bdf"}];
});

// Independently sealed approved tuple; no derivation by reversing production data.
const approvedInverse = [
  {
    "path": "scripts/docs-admission-change.test.mjs",
    "status": "modified",
    "old_mode": "100644",
    "old_type": "blob",
    "old_blob": "2269c2fb4cf386d1af4d122fafc6e369c519137d",
    "old_bytes": 45871,
    "old_sha256": "bbf22491384cf81c968de08f9c9676113c6e722fc0b178322b6b1f98606abfa4",
    "new_mode": "100644",
    "new_type": "blob",
    "new_blob": "7b8e02bf0a0de0a6a9159051b23c690056674262",
    "new_bytes": 32914,
    "new_sha256": "41c74d48f3d7478094f7a1f320f10953a9b8217de229d48320cc19c823dbc860"
  },
  {
    "path": "scripts/docs-admission-recovery.test.mjs",
    "status": "modified",
    "old_mode": "100644",
    "old_type": "blob",
    "old_blob": "46d6a9f55c2691d180b0289c4e4fa2cc19f293ed",
    "old_bytes": 16446,
    "old_sha256": "88d70f4be27fb4d5e80f5387d228d5396e1889b1295166cf841a8a36ce8fb59b",
    "new_mode": "100644",
    "new_type": "blob",
    "new_blob": "e16072215f6ad987a4e203486bbc803b10331cdb",
    "new_bytes": 13733,
    "new_sha256": "478ad12d6bd8f75c06c2c1527d00073353dba15f31f09296ede149a069b255ec"
  },
  {
    "path": "scripts/verify-docs-cohort-evidence.mjs",
    "status": "modified",
    "old_mode": "100644",
    "old_type": "blob",
    "old_blob": "0088e8cd6e5631ad2382faf53c01a5d31c90e443",
    "old_bytes": 61532,
    "old_sha256": "8fb6c804c9465a5aed38fd5e0e47471d0c37505f0f221f97e2ce8b9274341204",
    "new_mode": "100644",
    "new_type": "blob",
    "new_blob": "ca7b1e1590063f2d32630c9f1adc160fed9edc3b",
    "new_bytes": 60020,
    "new_sha256": "9948b8ae334c7e263eef5b21232b8a96446404dcf6467dbf38d19483f813e531"
  }
];
test("production equals independently approved inverse tuple and distinct manifest", () => {
  assert.deepEqual(production, approvedInverse);
  assert.notEqual(manifestDigest(production, 226), "1834849c57d679b4e2d2ee34aa8fee34379d7fe01ae28a1e84d2038aa0ef17ac");
});
for (const draft of [true, false]) test(`allocated wrong-base rollback rejects with draft=${draft}`, async () => {
  const f = fixture();
  for (const pull of [f.context.payload.pull_request, ...f.pulls]) {
    pull.number = 226; pull.draft = draft; pull.base.ref = "basefix/docs-v2-executed-step";
  }
  f.context.payload.number = 226;
  await rejected(f, undefined, draft ? /metadata/u : /Default branch/u,
    compile(source.replace(`const tuple = ${tupleText};`, `const tuple = ${JSON.stringify(tuple)};`)));
  if (draft) assert.deepEqual(f.calls, []);
});
for (const path of [".github/workflows/docs-central-pr224-transition-v1.yml", "scripts/docs-central-pr224-transition-v1.test.mjs"]) {
  test(`preserves staged forward authority ${path} and unrelated later changes`, async () => {
    const f = fixture();
    const bytes = Buffer.from(`later main authority ${path}\n`);
    const entry = {path, mode: "100644", type: "blob", sha: body(bytes), size: bytes.length};
    f.old.push(entry); f.next.push(clone(entry));
    await run(f);
    const bad = fixture(); bad.old.push(clone(entry)); bad.next.push({...entry, sha: other});
    await rejected(bad, undefined, /Tree diff/u);
  });
}
