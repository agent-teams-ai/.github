import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const workflowPath = ".github/workflows/docs-consumer-receipt-cutover-v1.yml";
const testPath = "scripts/docs-consumer-receipt-cutover-v1.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const [header, block, ...extra] = workflow.split("          script: |\n");
assert.equal(extra.length, 0);
assert.ok(block);
assert.ok(block.trimEnd().split("\n").every((line) => line.startsWith("            ")));
const source = block.split("\n").map((line) => line.slice(12)).join("\n");
const script = new vm.Script(`(async () => {\n${source}\n})()`, { filename: workflowPath });
const tuple = [
  [".github/workflows/docs-protocol-check.yml", "c30e87dabf7dda27c60d2d688b1ed9446fc2c23e", "9bcbe54dfec6280045ac596e55c1f14ce5f176e1"],
  ["scripts/check-community-files.mjs", "15d424cc6e6c65094111b48ada7d228178dafb5e", "5a21286b881c83a6ab2203731ec17411f12f6ca8"],
  ["scripts/check-community-files.test.mjs", "78d52b974ff4cd72f44579b09d0bfd509ed6f755", "fe25fc2080ed470098208c7753793e8c1b144e4f"],
  ["scripts/verify-docs-cohort-v2-receipt.mjs", "63e86f01863b2a31d73c22d1d1419e9828e9b131", "91aa50e8a5773f063d49199c2c2fedacc34a2b0e"],
  ["scripts/verify-docs-consumer-gate.test.mjs", "0d3977cde703a02f18ee7dd8d11ecea29e7068ff", "d0bea695cdacd7556267c491bd09afb97adc84b1"]
];
const hash = (text) => createHash("sha1").update(text).digest("hex");
const other = "f".repeat(40);
const clone = (value) => structuredClone(value);
const identity = { id: 1316243981, name: ".github", full_name: "agent-teams-ai/.github",
  owner: { login: "agent-teams-ai" }, default_branch: "main" };

// Independent Git-object fixtures; no checked-out or fetched PR source is evaluated.
function gitTree(leaves) {
  const entries = clone(leaves);
  const directories = new Set([""]);
  for (const leaf of leaves) {
    const parts = leaf.path.split("/");
    while (parts.length > 1) { parts.pop(); directories.add(parts.join("/")); }
  }
  let root;
  for (const directory of [...directories].sort((a, b) => b.length - a.length)) {
    const children = entries.filter((entry) => entry.path.split("/").slice(0, -1).join("/") === directory);
    const key = (entry) => Buffer.from(entry.path.split("/").at(-1) + (entry.type === "tree" ? "/" : ""));
    children.sort((a, b) => Buffer.compare(key(a), key(b)));
    const bytes = Buffer.concat(children.map((entry) => Buffer.concat([
      Buffer.from(`${Number(entry.mode)} ${entry.path.split("/").at(-1)}\0`), Buffer.from(entry.sha, "hex")
    ])));
    const sha = createHash("sha1").update(Buffer.from(`tree ${bytes.length}\0`)).update(bytes).digest("hex");
    if (directory) entries.push({ path: directory, mode: "040000", type: "tree", sha });
    else root = sha;
  }
  return { sha: root, truncated: false, tree: entries };
}
function fixture(base = "a".repeat(40), head = "b".repeat(40)) {
  const pull = { id: 1234, number: 192, state: "open", draft: false, merged: false,
    changed_files: 5, commits: 2, updated_at: "2026-09-05T12:00:00Z",
    base: { ref: "main", sha: base, repo: clone(identity) },
    head: { ref: "fix/receipt", sha: head, repo: clone(identity) } };
  const leaves = (index) => [...tuple.map((row) => ({ path: row[0], sha: row[index] })),
    ...[workflowPath, testPath, "README.md", "governance/docs-qualified-cohorts.json"].map((path) => ({ path, sha: hash(path) }))
  ].map((entry) => ({ ...entry, mode: "100644", type: "blob", size: 32 }));
  return { base, head, context: { eventName: "pull_request_target", sha: base, ref: "refs/heads/main",
    repo: { owner: "agent-teams-ai", repo: ".github" }, payload: { action: "synchronize", number: 192,
      repository: clone(identity), pull_request: clone(pull) } },
    pulls: [clone(pull), clone(pull)], controllers: [clone(identity), clone(identity)],
    branches: [0, 1].map(() => ({ name: "main", commit: { sha: base } })),
    pages: [tuple.map(([filename, , sha]) => ({ filename, status: "modified", sha })), []],
    comparison: { status: "ahead", base_commit: { sha: base }, merge_base_commit: { sha: base },
      ahead_by: 2, behind_by: 0, total_commits: 2 }, old: leaves(1), next: leaves(2), calls: [], outputs: [], logs: [] };
}
async function run(f = fixture(), alter = () => {}) {
  const trees = { [f.base]: gitTree(f.old), [f.head]: gitTree(f.next) };
  const counts = new Map();
  const api = (name, data) => async (args) => {
    assert.equal(args.owner, "agent-teams-ai"); assert.equal(args.repo, ".github");
    const occurrence = counts.get(name) ?? 0; counts.set(name, occurrence + 1);
    f.calls.push({ name, args: clone(args) });
    const response = { status: 200, headers: { "content-type": "application/json; charset=utf-8" },
      data: clone(data(args, occurrence)) };
    await alter(name, response, occurrence, f.calls.length);
    return response;
  };
  const github = { rest: {
    pulls: {
      get: api("pulls.get", (args, n) => { assert.equal(args.pull_number, 192); return f.pulls[n]; }),
      listFiles: api("pulls.listFiles", (args) => {
        assert.equal(args.pull_number, 192); assert.equal(args.per_page, 100); return f.pages[args.page - 1];
      })
    },
    repos: {
      get: api("repos.get", (_, n) => f.controllers[n]),
      getBranch: api("repos.getBranch", (args, n) => { assert.equal(args.branch, "main"); return f.branches[n]; }),
      compareCommits: api("repos.compareCommits", (args) => {
        assert.equal(args.base, f.base); assert.equal(args.head, f.head); return f.comparison;
      })
    },
    git: {
      getCommit: api("git.getCommit", (args) => {
        assert.ok(trees[args.commit_sha]); return { sha: args.commit_sha, tree: { sha: trees[args.commit_sha].sha } };
      }),
      getTree: api("git.getTree", (args) => {
        assert.equal(args.recursive, "1");
        const tree = Object.values(trees).find((entry) => entry.sha === args.tree_sha);
        assert.ok(tree); return tree;
      })
    }
  } };
  await script.runInNewContext({ context: f.context, github, Buffer,
    require: (name) => { assert.equal(name, "node:crypto"); return { createHash }; },
    core: { setOutput: (name, value) => f.outputs.push([name, value]), info: (value) => f.logs.push(value) }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return f;
}
async function rejected(f, alter, pattern = /./u) {
  await assert.rejects(run(f, alter), pattern);
  assert.deepEqual(f.outputs, []); assert.deepEqual(f.logs, []);
}
function rejectCase(name, change) {
  test(name, async () => { const f = fixture(); change(f); await rejected(f); });
}

test("accepts the complete tuple at refreshed immutable base/head and emits exact evidence", async () => {
  for (const [base, head] of [["a".repeat(40), "b".repeat(40)], ["c".repeat(40), "d".repeat(40)]]) {
    const f = await run(fixture(base, head));
    assert.equal(f.outputs.length, 1); assert.equal(f.outputs[0][0], "evidence");
    assert.deepEqual(JSON.parse(f.outputs[0][1]), { repository: identity.full_name, repositoryId: identity.id,
      pr: 192, base, head, files: tuple.map(([path, oldBlob, newBlob]) => ({ path, oldBlob, newBlob, status: "modified", mode: "100644" })) });
    assert.deepEqual(f.logs, [f.outputs[0][1]]);
    assert.deepEqual(f.calls.map(({ name }) => name), ["pulls.get", "repos.get", "repos.getBranch",
      "pulls.listFiles", "pulls.listFiles", "repos.compareCommits", "git.getCommit", "git.getTree",
      "git.getCommit", "git.getTree", "pulls.get", "repos.get", "repos.getBranch"]);
  }
});
test("accepts backward-only links on an empty out-of-range confirmation page", async () => {
  await run(fixture(), (method, response, occurrence) => {
    if (method === "pulls.listFiles" && occurrence === 1) response.headers.link =
      '<https://api.github.com/repos/agent-teams-ai/.github/pulls/192/files?per_page=100&page=1>; rel="prev", ' +
      '<https://api.github.com/repos/agent-teams-ai/.github/pulls/192/files?per_page=100&page=1>; rel="first"';
  });
});
for (const [i, [path]] of tuple.entries()) {
  rejectCase(`rejects old blob mutation: ${path}`, (f) => { f.old[i].sha = other; });
  rejectCase(`rejects new tree blob mutation: ${path}`, (f) => { f.next[i].sha = other; });
  rejectCase(`rejects list blob mutation: ${path}`, (f) => { f.pages[0][i].sha = other; });
  rejectCase(`rejects mixed rollback blob: ${path}`, (f) => { f.pages[0][i].sha = tuple[i][1]; f.next[i].sha = tuple[i][1]; });
}
for (const field of ["id", "full_name", "name", "owner"]) {
  for (const target of ["event", "base", "head", "controller-start", "controller-end"]) {
    rejectCase(`rejects missing/wrong ${field} on ${target} repository`, (f) => {
      const object = target === "event" ? f.context.payload.repository : target.startsWith("controller")
        ? f.controllers[target.endsWith("end") ? 1 : 0] : f.context.payload.pull_request[target].repo;
      object[field] = field === "id" ? identity.id + 1 : field === "owner" ? null : "renamed/fork";
    });
  }
}
for (const phase of [0, 1]) {
  for (const field of ["base.sha", "head.sha", "base.ref", "head.ref", "updated_at", "id", "commits", "changed_files", "state", "draft", "merged", "head.repo", "base.repo"]) {
    rejectCase(`rejects stale/malformed pull ${field} at snapshot ${phase}`, (f) => {
      const parts = field.split("."); const parent = parts.length === 2 ? f.pulls[phase][parts[0]] : f.pulls[phase];
      parent[parts.at(-1)] = field.endsWith(".repo") ? null : field.endsWith(".sha") ? other : "changed";
    });
  }
  rejectCase(`rejects changed default branch at snapshot ${phase}`, (f) => { f.controllers[phase].default_branch = "elsewhere"; });
  rejectCase(`rejects changed live branch SHA at snapshot ${phase}`, (f) => { f.branches[phase].commit.sha = other; });
}
for (const count of [0, -1, 4, 6, 1.5, "5", null, Number.MAX_SAFE_INTEGER + 1]) {
  rejectCase(`rejects invalid event file count ${count}`, (f) => { f.context.payload.pull_request.changed_files = count; });
}
for (const status of ["added", "removed", "renamed", "copied", "changed", null]) {
  rejectCase(`rejects file status ${status}`, (f) => { f.pages[0][0].status = status; });
}
for (const path of [workflowPath, testPath, "governance/docs-qualified-cohorts.json", "README.md", "scripts/extra.mjs"]) {
  rejectCase(`rejects extra/self/data file: ${path}`, (f) => { f.pages[0].push({ filename: path, status: "modified", sha: other }); });
  rejectCase(`rejects hidden tree change: ${path}`, (f) => {
    const entry = f.next.find((entry) => entry.path === path);
    if (entry) entry.sha = other; else f.next.push({ path, type: "blob", mode: "100644", size: 1, sha: other });
  });
  rejectCase(`rejects unrelated PR: ${path}`, (f) => { f.pages[0] = [{ filename: path, status: "modified", sha: other }]; });
}
const mutations = {
  "wrong PR": (f) => { f.context.payload.pull_request.number = 193; },
  "wrong event PR": (f) => { f.context.payload.number = 193; },
  "wrong event": (f) => { f.context.eventName = "pull_request"; },
  "wrong action": (f) => { f.context.payload.action = "closed"; },
  "wrong context repo": (f) => { f.context.repo.repo = "fork"; },
  "stale execution SHA": (f) => { f.context.sha = other; },
  "wrong execution ref": (f) => { f.context.ref = "refs/pull/192/merge"; },
  "zero head SHA": (f) => { f.context.payload.pull_request.head.sha = "0".repeat(40); },
  "missing pull": (f) => { delete f.context.payload.pull_request; },
  "missing repository": (f) => { delete f.context.payload.repository; },
  "subset": (f) => { f.pages[0].pop(); },
  "duplicate": (f) => { f.pages[0][1] = f.pages[0][0]; },
  "split pages": (f) => { f.pages[1] = f.pages[0].splice(3); },
  "unexpected second page": (f) => { f.pages[1] = [f.pages[0][0]]; },
  "null file": (f) => { f.pages[0][0] = null; },
  "non-array page": (f) => { f.pages[0] = {}; },
  "wrong filename type": (f) => { f.pages[0][0].filename = [tuple[0][0]]; },
  "missing SHA": (f) => { delete f.pages[0][0].sha; },
  "rename source": (f) => { f.pages[0][0].previous_filename = workflowPath; },
  "null rename field": (f) => { f.pages[0][0].previous_filename = null; },
  "mode-only tree change": (f) => { f.next[0].mode = "100755"; },
  "both executable modes": (f) => { f.old[0].mode = f.next[0].mode = "100755"; },
  "symlink": (f) => { f.next[0].mode = "120000"; },
  "submodule": (f) => { f.next[0].mode = "160000"; f.next[0].type = "commit"; },
  "hidden deletion": (f) => { f.next.pop(); },
  "diverged head": (f) => { f.comparison.status = "diverged"; },
  "wrong merge base": (f) => { f.comparison.merge_base_commit.sha = other; },
  "wrong comparison base": (f) => { f.comparison.base_commit.sha = other; },
  "head behind": (f) => { f.comparison.behind_by = 1; },
  "wrong commit count": (f) => { f.comparison.total_commits = 1; }
};
for (const [name, change] of Object.entries(mutations)) rejectCase(`rejects ${name}`, change);
for (const [name, alter] of Object.entries({
  "truncated tree": (r) => { r.data.truncated = true; },
  "missing truncation evidence": (r) => { delete r.data.truncated; },
  "duplicate tree entry": (r) => { r.data.tree.push(r.data.tree[0]); },
  "omitted tree entry": (r) => { r.data.tree.pop(); },
  "null tree entry": (r) => { r.data.tree[0] = null; },
  "wrong tree path": (r) => { r.data.tree[0].path = "../escape"; },
  "wrong tree root": (r) => { r.data.sha = other; },
  "inconsistent subtree": (r) => { r.data.tree.find((entry) => entry.type === "tree").sha = other; }
})) {
  for (const phase of [0, 1]) test(`rejects ${name} at tree ${phase}`, async () => {
    await rejected(fixture(), (method, r, n) => { if (method === "git.getTree" && n === phase) alter(r); });
  });
}
for (let call = 1; call <= 13; call++) {
  for (const failure of ["exception", "status", "content-type", "missing-data"]) {
    test(`fails closed on API ${failure} at call ${call}`, async () => {
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
for (const method of ["git.getCommit", "pulls.listFiles"]) {
  test(`rejects inconsistent ${method} metadata`, async () => {
    await rejected(fixture(), (name, r) => {
      if (name === method) { if (method === "git.getCommit") r.data.sha = other; else r.headers.link = '<next>; rel="next"'; }
    });
  });
}
test("PR text/content is inert and no content endpoint or execution capability is available", async () => {
  const f = fixture(); const poison = '${{ secrets.TOKEN }} $(touch /unsafe) `id`; throw new Error("PR executed")';
  f.context.payload.pull_request.title = poison; f.context.payload.pull_request.body = poison;
  for (const page of f.pages) for (const file of page) { file.patch = poison; file.raw_url = poison; file.content = poison; }
  await run(f); assert.equal(f.outputs.length, 1);
  assert.doesNotMatch(source, /\$\{\{|\beval\s*\(|\bFunction\s*\(|\bimport\s*\(|\bprocess\b|child_process|fetch\s*\(/u);
});
test("workflow has one unconditional base-owned pinned read-only step and no secrets/shell", () => {
  assert.equal(header, `name: Trusted Docs Consumer Receipt Cutover V1\n\non:\n  pull_request_target:\n    types: [opened, synchronize, reopened, edited, ready_for_review]\n\npermissions:\n  contents: read\n  pull-requests: read\n\njobs:\n  trusted-consumer-receipt-cutover-v1:\n    name: trusted-consumer-receipt-cutover-v1\n    runs-on: ubuntu-24.04\n    timeout-minutes: 3\n    steps:\n      - uses: actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd # v8.0.0\n        with:\n`);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:|\bif:|secrets\.|write-all|id-token|\$\{\{/u);
});

for (const link of ['<https://api.github.com/next>; rel="next"', '<https://api.github.com/last>; rel="last"', 'malformed', 3]) {
  test(`rejects unsupported terminal pagination link ${link}`, async () => {
    await rejected(fixture(), (method, response, occurrence) => {
      if (method === "pulls.listFiles" && occurrence === 1) response.headers.link = link;
    }, /Unexpected file continuation/u);
  });
}
for (const phase of [0, 1]) {
  test(`rehash rejects an omitted blob at tree ${phase} even with truncated=false`, async () => {
    await rejected(fixture(), (method, response, occurrence) => {
      if (method === "git.getTree" && occurrence === phase)
        response.data.tree = response.data.tree.filter((entry) => entry.path !== "README.md");
    }, /Tree metadata hash mismatch/u);
  });
  for (const field of ["id", "name", "full_name", "owner"]) {
    rejectCase(`rejects missing live repository ${field} at snapshot ${phase}`, (f) => { delete f.controllers[phase][field]; });
  }
}
rejectCase("rejects synchronized non-PR192 snapshots", (f) => {
  f.context.payload.number = f.context.payload.pull_request.number = 193;
  for (const pull of f.pulls) pull.number = 193;
});
rejectCase("rejects an ordinary one-file data PR", (f) => {
  f.context.payload.pull_request.changed_files = 1; for (const pull of f.pulls) pull.changed_files = 1;
  f.pages[0] = [{ filename: "governance/docs-qualified-cohorts.json", sha: other, status: "modified" }];
});

const pageOne = "https://api.github.com/repositories/1316243981/pulls/192/files?per_page=100&page=1";
// Exact header observed in GitHub's empty page 2 response on 2026-09-05.
const capturedBackLinks = ["prev", "last", "first"].map((rel) => `<${pageOne}>; rel="${rel}"`).join(", ");
const terminalLink = (link) => (method, response, occurrence) => {
  if (method === "pulls.listFiles" && occurrence === 1) response.headers.link = link;
};
for (const route of ["repositories/1316243981", "repos/agent-teams-ai/.github"]) {
  for (const query of ["per_page=100&page=1", "page=1&per_page=100"]) {
    test(`accepts empty page 2 with prev/last/first to ${route}?${query} without following links`, async () => {
      const link = capturedBackLinks.replaceAll("repositories/1316243981", route).replaceAll("per_page=100&page=1", query);
      const f = await run(fixture(), terminalLink(link));
      assert.equal(f.outputs.length, 1); assert.deepEqual(f.logs, [f.outputs[0][1]]);
      assert.equal(f.calls.length, 13);
      assert.deepEqual(f.calls.filter(({ name }) => name === "pulls.listFiles").map(({ args }) => args.page), [1, 2]);
    });
  }
}
for (const rel of ["prev", "last", "first"]) {
  test(`accepts a single backward ${rel} to the fixed page 1`, async () => {
    await run(fixture(), terminalLink(`<${pageOne}>; rel="${rel}"`));
  });
}
const foreignTargets = {
  "foreign host": pageOne.replace("api.github.com", "example.com"),
  "host suffix": pageOne.replace("api.github.com", "api.github.com.example.com"),
  "credentials": pageOne.replace("api.github.com", "user@api.github.com"),
  "port": pageOne.replace("api.github.com", "api.github.com:443"),
  "HTTP": pageOne.replace("https:", "http:"),
  "foreign repository ID": pageOne.replace("1316243981", "1316243982"),
  "foreign repository name": pageOne.replace("repositories/1316243981", "repos/agent-teams-ai/elsewhere"),
  "foreign owner": pageOne.replace("repositories/1316243981", "repos/elsewhere/.github"),
  "wrong PR": pageOne.replace("pulls/192", "pulls/193"),
  "wrong endpoint": pageOne.replace("/files?", "/commits?"),
  "extra path": pageOne.replace("/files?", "/files/extra?"),
  "path traversal": pageOne.replace("/files?", "/../files?"),
  "encoded path": pageOne.replace("/files?", "/%66iles?"),
  "page 0": pageOne.replace("&page=1", "&page=0"),
  "page 2": pageOne.replace("&page=1", "&page=2"),
  "page 3": pageOne.replace("&page=1", "&page=3"),
  "wrong page size": pageOne.replace("per_page=100", "per_page=99"),
  "missing page size": pageOne.replace("per_page=100&", ""),
  "missing page": pageOne.replace("&page=1", ""),
  "duplicate page": `${pageOne}&page=2`,
  "duplicate page size": `${pageOne}&per_page=100`,
  "extra query": `${pageOne}&extra=1`,
  "fragment": `${pageOne}#page=2`
};
for (const [name, target] of Object.entries(foreignTargets)) {
  for (const rel of ["prev", "last", "first"]) {
    test(`rejects terminal ${rel} with ${name}`, async () => {
      const f = fixture();
      await rejected(f, terminalLink(`<${target}>; rel="${rel}"`), /Unexpected file continuation/u);
      assert.equal(f.calls.length, 5);
    });
  }
}
const malformedLinks = {
  "next to page 1": `<${pageOne}>; rel="next"`,
  "unknown relation": `<${pageOne}>; rel="alternate"`,
  "mixed backward and forward": `${capturedBackLinks}, <${pageOne}>; rel="next"`,
  "mixed backward and foreign": `${capturedBackLinks}, <${foreignTargets["foreign host"]}>; rel="prev"`,
  "multiple relations": `<${pageOne}>; rel="prev next"`,
  "duplicate rel attribute": `<${pageOne}>; rel="prev"; rel="next"`,
  "missing relation": `<${pageOne}>`,
  "unquoted relation": `<${pageOne}>; rel=prev`,
  "unclosed URL": `<${pageOne}; rel="prev"`,
  "extra angle bracket": `<<${pageOne}>; rel="prev"`,
  "trailing junk": `${capturedBackLinks} junk`,
  "trailing comma": `${capturedBackLinks},`,
  "empty link between commas": `${capturedBackLinks},,${capturedBackLinks}`,
  "line break": `${capturedBackLinks}\n`,
  "non-ASCII whitespace": `\u00a0${capturedBackLinks}`,
  "Unicode line separator": `${capturedBackLinks}\u2028`,
  "header injection": `${capturedBackLinks}\r\nLink: <${pageOne}>; rel="next"`,
  "empty string": "", "whitespace": " ", "null": null, "array": [capturedBackLinks], "object": {}
};
for (const [name, link] of Object.entries(malformedLinks)) {
  test(`rejects malformed/forward terminal header: ${name}`, async () => {
    const f = fixture();
    await rejected(f, terminalLink(link), /Unexpected file continuation/u);
    assert.equal(f.calls.length, 5);
  });
}
test("backward links never excuse nonempty or non-array second-page data", async () => {
  for (const data of [[fixture().pages[0][0]], {}, null]) {
    const f = fixture(); f.pages[1] = data;
    await rejected(f, terminalLink(capturedBackLinks), /Unexpected file continuation|Invalid API response/u);
    assert.equal(f.calls.length, 5);
  }
});
test("backward links remain forbidden on the complete first page", async () => {
  await rejected(fixture(), (method, response, occurrence) => {
    if (method === "pulls.listFiles" && occurrence === 0) response.headers.link = capturedBackLinks;
  }, /Incomplete\/duplicate file page/u);
});
