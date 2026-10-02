import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script, createContext } from "node:vm";

const workflowPath = ".github/workflows/docs-node24-launcher-v1.yml";
const testPath = "scripts/docs-node24-launcher-v1.test.mjs";
const workflowSource = await readFile(new URL(`../${workflowPath}`, import.meta.url), "utf8");
// Execute the real metadata program. YAML/Actions execution remains a separate hosted gate.
const block = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflowSource)?.groups?.source;
assert.notEqual(block, undefined);
const program = new Script(`(async () => {\n${block.split("\n").map(line => line.slice(12)).join("\n")}\n})()`, { filename: workflowPath });
const base = "a".repeat(40), head = "b".repeat(40);
const roots = { [base]: "c".repeat(40), [head]: "d".repeat(40) };
const repo = { id: 1316243981, full_name: "agent-teams-ai/.github", default_branch: "main", archived: false, disabled: false };
const apiRepo = { owner: "agent-teams-ai", repo: ".github" };
const actions = ["opened", "synchronize", "reopened", "edited", "ready_for_review"];
// Independent oracle: measured candidate bytes, never extracted from the workflow program.
const expectedTuple = [
  {
    "path": ".github/workflows/docs-protocol-check.yml",
    "status": "modified",
    "old_blob": "9bcbe54dfec6280045ac596e55c1f14ce5f176e1",
    "old_mode": "100644",
    "old_type": "blob",
    "old_bytes": 16954,
    "old_sha256": "ddee57a5e685407548ad8eebaa6f1e934600104af192dcd542160915c24fd1d6",
    "new_blob": "f1492257de281f40a262042eb989291558147d5f",
    "new_mode": "100644",
    "new_type": "blob",
    "new_bytes": 16954,
    "new_sha256": "f3a1e7bba95a8d309f6f4a97377d1c68fd2b956f2659e9576fc1350599cb514d"
  },
  {
    "path": ".github/workflows/docs-cohort-append-only.yml",
    "status": "modified",
    "old_blob": "3c7f54dc24a6a2cd8c1c124df242841cde46df87",
    "old_mode": "100644",
    "old_type": "blob",
    "old_bytes": 13538,
    "old_sha256": "9d30a19b9a22022a3ee5e2ce4e56ad52b636c4693f1b03eb2b275f18cc838c02",
    "new_blob": "71983165ef4da0bb745fcecfe2ace29fe75f6d41",
    "new_mode": "100644",
    "new_type": "blob",
    "new_bytes": 13538,
    "new_sha256": "b669ce8769d763046d3d8690fd8a0abf721eff14324d748048480749231db527"
  },
  {
    "path": ".github/workflows/docs-admission-evidence.yml",
    "status": "modified",
    "old_blob": "6de75ea253f021c255216862283400ef22c35a13",
    "old_mode": "100644",
    "old_type": "blob",
    "old_bytes": 17756,
    "old_sha256": "c307850dd7bc47f7d89f07dc4ccf09085f81bf01ec7ad29e8070a9b54620c0d2",
    "new_blob": "a95efa08ae173554e1c82b6e5460ee8160810c44",
    "new_mode": "100644",
    "new_type": "blob",
    "new_bytes": 17756,
    "new_sha256": "cc0cf40eeb124c1a3d002a789519e3879c67735289b7cf61829ce31547991a72"
  },
  {
    "path": ".github/workflows/docs-fleet-audit.yml",
    "status": "modified",
    "old_blob": "cd2cfee3713da2669b7a414a26d57aceff0038ba",
    "old_mode": "100644",
    "old_type": "blob",
    "old_bytes": 1094,
    "old_sha256": "82f18b83c81fc31912bebce38f87771219070ebcc82d07a35480451be3145623",
    "new_blob": "40788593a0a9252baee5fe1c88c712cf2f541864",
    "new_mode": "100644",
    "new_type": "blob",
    "new_bytes": 1094,
    "new_sha256": "f40a83b857ca9e7b67e8c62ba71260650994256d6a6532a70cb04cbbb6752bae"
  },
  {
    "path": "scripts/verify-docs-consumer-gate.test.mjs",
    "status": "modified",
    "old_blob": "fbc9075057abae2c26af82d0cb704b7d54a85753",
    "old_mode": "100644",
    "old_type": "blob",
    "old_bytes": 64532,
    "old_sha256": "cb787cb2763ee344c4d53f1681d71239949e6daa8c230e7369816421074bcce4",
    "new_blob": "46e0ecb4621749d5a82a3cc5d85d830a57b72e39",
    "new_mode": "100644",
    "new_type": "blob",
    "new_bytes": 69475,
    "new_sha256": "cc088aa9d2b098331888cd7417a7ec7001428d448eb13b3da7a6f41776e2df5d"
  }
];
const expectedIdentity = `sha256:${createHash("sha256").update(JSON.stringify(expectedTuple)).digest("hex")}`;
const clone = value => structuredClone(value);

function fixture() {
  const pull = {
    id: 12327336, number: 327, state: "open", draft: false, merged: false, changed_files: 5,
    base: { ref: "main", sha: base, repo: clone(repo) },
    head: { ref: "fix/selected-clock", sha: head, repo: clone(repo) },
  };
  const trees = Object.fromEntries([[base, "old"], [head, "new"]].map(([revision, side]) => [roots[revision], {
    sha: roots[revision], truncated: false,
    tree: [
      ...expectedTuple.map(item => ({ path: item.path, mode: "100644", type: "blob", sha: item[`${side}_blob`], size: item[`${side}_bytes`] })),
      ...[workflowPath, testPath].map((path, index) => ({ path, mode: "100644", type: "blob", sha: (index ? "f" : "e").repeat(40) })),
    ],
  }]));
  return {
    context: { eventName: "pull_request_target", repo: clone(apiRepo), issue: { number: 327 }, sha: base, ref: "refs/heads/main",
      payload: { action: "synchronize", number: 327, repository: clone(repo), pull_request: clone(pull) } },
    pulls: [clone(pull), clone(pull)], repositories: [clone(repo), clone(repo)],
    branches: [0, 1].map(() => ({ name: "main", commit: { sha: base } })),
    pages: [expectedTuple.map(item => ({ filename: item.path, status: "modified", sha: item.new_blob }))],
    comparison: { status: "ahead", ahead_by: 1, behind_by: 0, total_commits: 1, base_commit: { sha: base }, merge_base_commit: { sha: base } },
    commits: Object.fromEntries([base, head].map(sha => [sha, { sha, tree: { sha: roots[sha] } }])), trees,
  };
}

async function execute(f) {
  const calls = [], failures = [], evidence = [], outputs = [], effects = [], counts = new Map();
  const answer = async (endpoint, params, expected, data) => {
    assert.deepEqual(clone(params), expected, `Exact immutable read parameters for ${endpoint}`);
    const count = (counts.get(endpoint) ?? 0) + 1;
    counts.set(endpoint, count);
    calls.push({ endpoint, params: clone(params) });
    if (f.reject === `${endpoint}:${count}`) throw new Error("Disposable API rejection");
    return { data: clone(data(count)) };
  };
  const forbidden = name => { effects.push(name); throw new Error(`Forbidden capability: ${name}`); };
  const closed = (name, methods) => new Proxy(methods, { get: (target, key) => {
    if (Object.hasOwn(target, key)) return target[key];
    return forbidden(`${name}.${String(key)}`);
  } });
  const listFiles = params => answer("pulls.listFiles", params,
    { ...apiRepo, pull_number: 327, per_page: 100, page: params.page }, () => f.pages[params.page - 1]);
  const rest = closed("rest", {
    pulls: closed("pulls", {
      get: params => answer("pulls.get", params, { ...apiRepo, pull_number: 327 }, count => f.pulls[count - 1]), listFiles,
    }),
    repos: closed("repos", {
      get: params => answer("repos.get", params, apiRepo, count => f.repositories[count - 1]),
      getBranch: params => answer("repos.getBranch", params, { ...apiRepo, branch: "main" }, count => f.branches[count - 1]),
      compareCommitsWithBasehead: params => answer("repos.compareCommitsWithBasehead", params,
        { ...apiRepo, basehead: `${base}...${head}` }, () => f.comparison),
    }),
    git: closed("git", {
      getCommit: params => {
        assert.ok([base, head].includes(params.commit_sha));
        return answer("git.getCommit", params, { ...apiRepo, commit_sha: params.commit_sha }, () => f.commits[params.commit_sha]);
      },
      getTree: params => {
        assert.ok(Object.values(roots).includes(params.tree_sha));
        return answer("git.getTree", params, { ...apiRepo, tree_sha: params.tree_sha, recursive: "true" }, () => f.trees[params.tree_sha]);
      },
    }),
  });
  const github = closed("github", { rest, paginate: async (method, params) => {
    assert.equal(method, listFiles);
    await answer("paginate", params, { ...apiRepo, pull_number: 327, per_page: 100 }, () => null);
    const files = [];
    for (let page = 1; page <= f.pages.length; page++) {
      const result = await method({ ...params, page });
      if (!Array.isArray(result.data)) return result.data;
      files.push(...result.data);
    }
    return files;
  } });
  const sandbox = createContext({ github, context: clone(f.context),
    core: closed("core", { setFailed: message => failures.push(message), info: message => evidence.push(message),
      setOutput: (...args) => outputs.push(args) }),
    require: name => name === "node:crypto" ? { createHash } : forbidden(`require:${name}`),
  });
  await program.runInContext(sandbox, { timeout: 1000 });
  assert.deepEqual(effects, [], "No writable API, source download or head execution capability may be accessed");
  assert.deepEqual(outputs, [], "No alternate successful mode or output");
  return { calls, failures, evidence };
}

test("workflow declares only the read-only metadata step and no caller API", () => {
  // Source characterization only; no claim of YAML or hosted Actions execution.
  assert.match(workflowSource, /permissions:\n  contents: read\n  pull-requests: read\n/u);
  assert.match(workflowSource, /trusted-node24-launcher-v1:\n    name: trusted-node24-launcher-v1/u);
  assert.equal((workflowSource.match(/uses:/gu) ?? []).length, 1);
  assert.match(workflowSource, /uses: actions\/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd/u);
  assert.doesNotMatch(workflowSource, /workflow_call:|workflow_dispatch:|secrets:|\n        run:|actions\/checkout/u);
});

for (const action of actions) test(`accepts only the independent complete repair tuple on ${action}`, async () => {
  const f = fixture();
  f.context.payload.action = action;
  // Split/reverse the five files across pages: ordering is not authority.
  f.pages = f.pages[0].toReversed().map(file => [file]);
  const result = await execute(f);
  assert.deepEqual(result.failures, []);
  assert.equal(result.evidence.length, 1);
  assert.deepEqual(JSON.parse(result.evidence[0]), { guard: "trusted-node24-launcher-v1", repository: repo.full_name,
    direction: "forward", pr: 327, base, head, tuple_identity: expectedIdentity, tuple: expectedTuple });
  assert.deepEqual(result.calls.slice(-3).map(call => call.endpoint), ["pulls.get", "repos.get", "repos.getBranch"]);
  assert.equal(result.calls.filter(call => call.endpoint === "pulls.listFiles").length, 5);
});

// Each row names the authorization bug it would expose if the relevant refusal disappeared.
const cases = [
  ["unrelated PR payload", f => { f.context.payload.number = 328; }, /identified PR/],
  ["unrelated execution PR", f => { f.context.issue.number = 328; }, /identified PR/],
  ["unrelated PR object", f => { f.context.payload.pull_request.number = 328; }, /identified PR/],
  ["missing PR", f => { delete f.context.payload.pull_request; }, /identified PR/],
  ["wrong event", f => { f.context.eventName = "pull_request"; }, /event or action/],
  ["caller authority via dispatch", f => { f.context.eventName = "workflow_dispatch"; }, /event or action/],
  ["unsupported action", f => { f.context.payload.action = "closed"; }, /event or action/],
  ["missing action", f => { delete f.context.payload.action; }, /event or action/],
  ["wrong event repo id", f => { f.context.payload.repository.id++; }, /repository identity/],
  ["wrong event repo name", f => { f.context.payload.repository.full_name = "foreign/.github"; }, /repository identity/],
  ["wrong execution owner", f => { f.context.repo.owner = "foreign"; }, /repository identity/],
  ["wrong execution repository", f => { f.context.repo.repo = "other"; }, /repository identity/],
  ["wrong event default", f => { f.context.payload.repository.default_branch = "other"; }, /default branch/],
  ["wrong execution SHA", f => { f.context.sha = head; }, /Execution/],
  ["wrong execution ref", f => { f.context.ref = "refs/pull/327/merge"; }, /Execution/],
  ["missing execution SHA", f => { delete f.context.sha; }, /Execution/],
  ["draft event", f => { f.context.payload.pull_request.draft = true; }, /ready for review/],
  ["closed event", f => { f.context.payload.pull_request.state = "closed"; }, /open, unmerged/],
  ["merged event", f => { f.context.payload.pull_request.merged = true; }, /unmerged/],
  ["wrong PR base branch", f => { f.context.payload.pull_request.base.ref = "other"; }, /default branch/],
  ["empty head branch", f => { f.context.payload.pull_request.head.ref = ""; }, /head branch/],
  ["empty comparison", f => { f.comparison.ahead_by = f.comparison.total_commits = 0; }, /descendant/],
  ["diverged comparison", f => { f.comparison.status = "diverged"; f.comparison.behind_by = 1; }, /descendant/],
  ["behind comparison", f => { f.comparison.status = "behind"; }, /descendant/],
  ["identical comparison", f => { f.comparison.status = "identical"; }, /descendant/],
  ["wrong comparison base", f => { f.comparison.base_commit.sha = head; }, /descendant/],
  ["wrong merge base", f => { f.comparison.merge_base_commit.sha = head; }, /descendant/],
  ["inconsistent comparison count", f => { f.comparison.total_commits = 2; }, /descendant/],
  ["missing comparison", f => { f.comparison = null; }, /descendant/],
  ["malformed pagination", f => { f.pages = [null]; }, /changed-file tuple/],
  ["malformed file", f => { f.pages[0][0] = null; }, /changed-file tuple/],
  ["duplicate pagination", f => { f.pages = [[f.pages[0][0]], [f.pages[0][0]]]; }, /changed-file tuple/],
  ["missing list entry", f => { f.pages[0].pop(); }, /changed-file tuple/],
  ["empty list", f => { f.pages = []; }, /changed-file tuple/],
  ["extra list entry", f => { f.pages[0].push({ filename: "package.json", status: "modified", sha: head }); }, /changed-file tuple/],
  ["unrelated path", f => { f.pages[0][0].filename = "governance/docs-qualified-cohorts.json"; }, /changed-file tuple/],
  ["mixed old/new list", f => { f.pages[0][0].sha = expectedTuple[0].old_blob; }, /changed-file tuple/],
  ["wrong list blob", f => { f.pages[0][1].sha = head; }, /changed-file tuple/],
  ["rename source", f => { f.pages[0][0].previous_filename = "old.mjs"; }, /changed-file tuple/],
];
for (const count of [0, 1, 2, 3, 4, 6, "5", null, 5.5]) cases.push([`changed_files ${count}`, f => { f.context.payload.pull_request.changed_files = count; }, /five changed files/]);
for (const status of ["added", "removed", "renamed", "copied", "changed", "unchanged", undefined]) {
  cases.push([`ineligible status ${status}`, f => { f.pages[0][0].status = status; }, /changed-file tuple/]);
}
for (const side of ["base", "head"]) {
  for (const invalid of [undefined, null, "", "0".repeat(40), "z".repeat(40), "A".repeat(40), "a".repeat(39)]) {
    cases.push([`malformed ${side} SHA ${invalid}`, f => { f.context.payload.pull_request[side].sha = invalid; }, /exact base\/head/]);
  }
  for (const foreign of [null, { ...repo, id: 7 }, { ...repo, full_name: "foreign/.github" }]) {
    cases.push([`missing/forked ${side} repo ${JSON.stringify(foreign)}`, f => { f.context.payload.pull_request[side].repo = foreign; }, /foreign PR repository/]);
  }
}
cases.push(["equal base/head", f => { f.context.payload.pull_request.head.sha = base; }, /distinct/]);
for (const phase of [0, 1]) {
  const when = phase ? "final reread" : "initial read";
  cases.push(
    [`head movement at ${when}`, f => { f.pulls[phase].head.sha = "1".repeat(40); }, /Live PR moved/],
    [`base movement at ${when}`, f => { f.pulls[phase].base.sha = "1".repeat(40); }, /Live PR moved/],
    [`head ref movement at ${when}`, f => { f.pulls[phase].head.ref = "other"; }, /Live PR moved/],
    [`foreign live head at ${when}`, f => { f.pulls[phase].head.repo.id++; }, /foreign PR repository/],
    [`retargeted live PR at ${when}`, f => { f.pulls[phase].base.ref = "other"; }, /default branch/],
    [`extra live changes at ${when}`, f => { f.pulls[phase].changed_files++; }, /five changed files/],
    [`draft at ${when}`, f => { f.pulls[phase].draft = true; }, /ready for review/],
    [`closed at ${when}`, f => { f.pulls[phase].state = "closed"; }, /open, unmerged/],
    [`PR identity movement at ${when}`, f => { f.pulls[phase].id++; }, /Live PR moved/],
    [`live repo movement at ${when}`, f => { f.repositories[phase].id++; }, /Live repository identity/],
    [`default movement at ${when}`, f => { f.repositories[phase].default_branch = "other"; }, /default branch changed/],
    [`stale live base at ${when}`, f => { f.branches[phase].commit.sha = head; }, /base is stale/],
    [`wrong live branch at ${when}`, f => { f.branches[phase].name = "other"; }, /default branch moved/],
  );
}
for (const revision of [base, head]) {
  const side = revision === base ? "base" : "head";
  const tree = f => f.trees[roots[revision]];
  cases.push(
    [`wrong ${side} commit`, f => { f.commits[revision].sha = "1".repeat(40); }, /commit\/tree binding/],
    [`missing ${side} tree root`, f => { delete f.commits[revision].tree; }, /commit\/tree binding/],
    [`zero ${side} tree root`, f => { f.commits[revision].tree.sha = "0".repeat(40); }, /commit\/tree binding/],
    [`wrong ${side} tree response`, f => { tree(f).sha = "1".repeat(40); }, /immutable tree/],
    [`truncated ${side} tree`, f => { tree(f).truncated = true; }, /immutable tree/],
    [`missing ${side} truncation proof`, f => { delete tree(f).truncated; }, /immutable tree/],
    [`malformed ${side} tree`, f => { tree(f).tree = null; }, /immutable tree/],
    [`ambiguous ${side} tree`, f => { tree(f).tree.push(clone(tree(f).tree[0])); }, /immutable tree/],
    [`malformed ${side} tree entry`, f => { tree(f).tree.push(null); }, /immutable tree/],
  );
  for (const path of [...expectedTuple.map(item => item.path), workflowPath, testPath]) {
    const entry = f => tree(f).tree.find(item => item.path === path);
    cases.push([`absent ${side} ${path}`, f => { tree(f).tree = tree(f).tree.filter(item => item.path !== path); }, /unique regular/]);
    for (const [mode, type] of [["120000", "blob"], ["100755", "blob"], ["160000", "commit"], ["040000", "tree"]]) {
      cases.push([`${side} ${path} becomes ${mode}/${type}`, f => { Object.assign(entry(f), { mode, type }); }, /regular 100644 blob/]);
    }
    cases.push([`wrong ${side} blob ${path}`, f => { entry(f).sha = "1".repeat(40); }, /candidate old\/new|remain unchanged/]);
    if (expectedTuple.some(item => item.path === path)) {
      cases.push([`wrong ${side} byte size ${path}`, f => { entry(f).size++; }, /byte tuple/]);
      cases.push([`mixed ${side} blob ${path}`, f => {
        const item = expectedTuple.find(item => item.path === path);
        entry(f).sha = item[revision === base ? "new_blob" : "old_blob"];
      }, /candidate old\/new/]);
    }
  }
}
for (const endpoint of ["pulls.get", "repos.get", "repos.getBranch", "paginate", "pulls.listFiles", "repos.compareCommitsWithBasehead", "git.getCommit", "git.getTree"]) {
  for (const count of [1, ...(["pulls.get", "repos.get", "repos.getBranch", "git.getCommit", "git.getTree"].includes(endpoint) ? [2] : [])]) {
    cases.push([`API rejection ${endpoint}:${count}`, f => { f.reject = `${endpoint}:${count}`; }, /API or metadata failure/]);
  }
}
for (const [name, breakContract, reason] of cases) test(`refuses ${name} without positive evidence`, async () => {
  const f = fixture();
  breakContract(f);
  const result = await execute(f);
  assert.equal(result.failures.length, 1, "Every refusal must fail the check");
  assert.match(result.failures[0], reason);
  assert.deepEqual(result.evidence, [], "Refusal must emit no success evidence");
  if (f.reject) {
    const [endpoint, count] = f.reject.split(":");
    assert.equal(result.calls.at(-1).endpoint, endpoint, "Reach the rejected API read");
    assert.equal(result.calls.filter(call => call.endpoint === endpoint).length, Number(count));
  }
});


test("accepts only the complete exact inverse with unchanged base-owned guard", async () => {
  const f = fixture();
  f.pages[0].forEach((file, index) => { file.sha = expectedTuple[index].old_blob; });
  for (const [revision, side] of [[base, "new"], [head, "old"]]) {
    for (const item of expectedTuple) Object.assign(f.trees[roots[revision]].tree.find(entry => entry.path === item.path),
      { sha: item[`${side}_blob`], size: item[`${side}_bytes`] });
  }
  const result = await execute(f);
  assert.deepEqual(result.failures, []);
  assert.equal(JSON.parse(result.evidence[0]).direction, "rollback");
});

for (const [name, mutate, reason] of [
  ["guard introduction", f => { f.trees[roots[base]].tree = f.trees[roots[base]].tree.filter(entry => entry.path !== workflowPath); }, /unique regular/],
  ["mixed forward and inverse", f => { f.pages[0][0].sha = expectedTuple[0].old_blob; }, /changed-file tuple/],
  ["silent unrelated tree edit", f => {
    for (const revision of [base, head]) f.trees[roots[revision]].tree.push({ path: "package.json", mode: "100644", type: "blob",
      sha: revision === base ? "1".repeat(40) : "2".repeat(40) });
  }, /Complete immutable trees/],
  ["silent unrelated addition", f => { f.trees[roots[head]].tree.push({ path: "unexpected.txt", mode: "100644", type: "blob", sha: "1".repeat(40) }); }, /Complete immutable trees/],
  ["archived controller", f => { f.repositories[1].archived = true; }, /Live repository identity/],
  ["disabled controller", f => { f.repositories[0].disabled = true; }, /Live repository identity/],
]) test(`refuses ${name}`, async () => {
  const f = fixture(); mutate(f);
  const result = await execute(f);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], reason);
  assert.deepEqual(result.evidence, []);
});
