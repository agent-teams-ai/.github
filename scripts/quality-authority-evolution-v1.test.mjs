import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/quality-authority-evolution-v1.yml";
const testPath = "scripts/quality-authority-evolution-v1.test.mjs";
const workflow = await readFile(workflowPath, "utf8");
const scriptBlock = /\n          script: \|\n(?<source>[\s\S]+)$/u.exec(workflow)?.groups?.source;
assert.notEqual(scriptBlock, undefined);
const source = scriptBlock.split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("context", "github", "core", source);

const repository = "agent-teams-ai/.github";
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const successorSha = "c".repeat(40);
const candidate = [
  ["docs/engineering-quality-profile.json", "added", "49dbc437d164d08247cb9db7860384e4bd980bc8", null],
  ["docs/engineering-quality.md", "added", "0c36b59b105d3d2d6fd9431b344bbdbd8519130d", null],
  ["oxlint.json", "added", "84f173d395b7e25bf4acf3f22be12338e2f2d554", null],
  ["package.json", "modified", "b4bee381c864b24ee01f3da9a47582f304a61514", "b908c9a336c726e003f3f73fbbf33f9ff3fd90fb"],
  ["pnpm-lock.yaml", "modified", "df452a9eb24ed934162c830410245ef35731ee26", "ce5fec0e9365f41ed2888d233d1903ea4a991358"],
  ["scripts/check-cohort-emergency-append.mjs", "modified", "7c734f158a352e4089adebb389fa1ac3e515eb43", "162474538dbc3dcb9f754994e553288ad06fb5e8"],
  ["scripts/check-community-files.mjs", "modified", "b43b247a4b727974ef878ff09abc05cd17f22d0e", "5a21286b881c83a6ab2203731ec17411f12f6ca8"],
  ["scripts/check-quality-scope.mjs", "added", "105403b63038c5a1076c6754abe66a75275e2915", null],
  ["scripts/check-quality-scope.test.mjs", "added", "d15245de99c00f3acdaef128922e718c12314ab9", null],
  ["scripts/check-reviewrouter-workflow.mjs", "modified", "675e24a4664a81eb78066ed0cae87ebd82e6cc75", "6ee7a0610b2b16c6fd189035debb42ae38481f66"],
  ["scripts/docs-admission-recovery.test.mjs", "modified", "18012acf474757f593bf9ff393bee3503dd724d2", "46d6a9f55c2691d180b0289c4e4fa2cc19f293ed"],
  ["scripts/docs-cohort-policy.mjs", "modified", "27ea96fe6822ffd806875086d8b59e4178e278d1", "a4068654c6966158cd4b64f45011a0479d640a32"],
  ["scripts/docs-legacy-admission-recovery.mjs", "modified", "46928e5809c07913d95aa5d44cd3b5b7e7bee7d4", "7a700471d2064c60b27685d4cd41f605ee56db17"],
  ["scripts/governance-policy.mjs", "modified", "2785168e13065fd6ade4927550ddfed1f2029ff9", "45f80438e050431cea6c9f589b04dc14b1b3ca63"],
  ["scripts/observe-org-repository-inventory.mjs", "modified", "79b40e076243caab7126395c501814d7231c8d73", "63e6697e586698d88c49f0f70add173e3c92dd47"],
  ["scripts/run-quality-lint.mjs", "added", "f9fb7c5b846f37af42928636db8e58a0961d75c7", null],
  ["scripts/verify-docs-admission-change.mjs", "modified", "d09d970050c2f970b5a1f373b0f360f9551deb95", "1bf455f2ca5bf97440e62b2ff4eaa6c36aa2212b"],
  ["scripts/verify-docs-cohort-evidence.mjs", "modified", "3d23f26f13fd3d9ad0e80d12f807d933b7991878", "fba985a230c710aba355b15a0360f464ad961ff0"],
  ["scripts/verify-docs-cohort-v2-receipt.mjs", "modified", "9f947073bb3bc1a0f1b5c9aa59eeba6e0f4add7c", "96f4600e06bcb0b9c7fbf51da2bfe06c6e968489"],
  ["scripts/verify-docs-consumer-gate.mjs", "modified", "ef293a0d0098b8bd7c700ddd8c98968d10a8e9d9", "48f326515fb47ce0b41e49596bc2467020e9655b"],
  ["scripts/verify-docs-qualification-receipt.mjs", "modified", "f8e857b5d52fde3f313a396fdbc2342e050a054b", "bbeedf26d12dd3b4b6c8ab681d37f348069a0e37"],
  ["tools/feature-module-standard/check.mjs", "modified", "0cba631b8e97947144760ce7b2b74398fcd60569", "7cff11712708cccf01fb37be586a801156b78963"],
].map(([filename, status, sha, baseBlob]) => ({ filename, status, sha, baseBlob }));

const treeEntry = (path, sha, mutation = {}) => ({ path, sha, type: "blob", mode: "100644", ...mutation });
const canonicalTree = (side) => [
  ...candidate.flatMap((file) => {
    const sha = side === "base" ? file.baseBlob : file.sha;
    return sha === null ? [] : [treeEntry(file.filename, sha)];
  }),
  treeEntry(workflowPath, successorSha),
  treeEntry(testPath, successorSha),
];

async function classify(options = {}) {
  const failures = [];
  const outputs = new Map();
  const eventRepository = options.eventRepository ?? repository;
  const [eventOwner, eventRepo] = eventRepository.split("/");
  const pull = {
    number: Object.hasOwn(options, "number") ? options.number : 401,
    base: {
      ref: options.baseRef ?? "main",
      sha: options.eventBaseSha ?? baseSha,
      repo: options.missingBaseRepo ? null : { full_name: options.baseRepo ?? repository },
    },
    head: {
      sha: options.eventHeadSha ?? headSha,
      repo: options.missingHeadRepo ? null : { full_name: options.headRepo ?? repository },
    },
  };
  if (options.missingPull) delete pull.head;
  const live = {
    base: {
      ref: options.liveBaseRef ?? pull.base.ref,
      sha: options.liveBaseSha ?? pull.base.sha,
      repo: options.missingLiveBaseRepo ? null : { full_name: options.liveBaseRepo ?? repository },
    },
    head: {
      sha: options.liveHeadSha ?? pull.head?.sha,
      repo: options.missingLiveHeadRepo ? null : { full_name: options.liveHeadRepo ?? repository },
    },
  };
  const lateLive = {
    base: {
      ref: options.lateBaseRef ?? live.base.ref,
      sha: options.lateBaseSha ?? live.base.sha,
      repo: options.missingLateBaseRepo ? null : { full_name: options.lateBaseRepo ?? live.base.repo?.full_name },
    },
    head: {
      sha: options.lateHeadSha ?? live.head.sha,
      repo: options.missingLateHeadRepo ? null : { full_name: options.lateHeadRepo ?? live.head.repo?.full_name },
    },
  };
  const trees = {
    base: options.baseTree ?? canonicalTree("base"),
    head: options.headTree ?? canonicalTree("head"),
  };
  const context = { repo: { owner: eventOwner, repo: eventRepo }, payload: {
    pull_request: options.missingPull ? undefined : pull,
  } };
  let pullReads = 0;
  let repoReads = 0;
  let branchReads = 0;
  let listReads = 0;
  const github = {
    paginate: async () => { listReads++; return options.mutableListing ?? []; },
    rest: {
      git: { getTree: async (args) => {
        if (options.apiError === "getTree") throw new Error("API unavailable");
        const side = args.tree_sha === pull.base.sha ? "base" : "head";
        assert.deepEqual(args, { owner: "agent-teams-ai", repo: ".github", tree_sha: pull[side].sha, recursive: "true" });
        return { data: Object.hasOwn(options, `${side}TreeResponse`)
          ? options[`${side}TreeResponse`]
          : { truncated: false, tree: trees[side] } };
      } },
      pulls: {
        get: async (args) => {
          assert.deepEqual(args, { owner: "agent-teams-ai", repo: ".github", pull_number: 401 });
          if (options.apiError === "get") throw new Error("API unavailable");
          return { data: pullReads++ === 0 ? live : lateLive };
        },
        listFiles: () => { listReads++; return undefined; },
      },
      repos: {
        get: async (args) => {
          assert.deepEqual(args, { owner: "agent-teams-ai", repo: ".github" });
          if (options.apiError === "repo") throw new Error("API unavailable");
          const initialDefaultBranch = Object.hasOwn(options, "defaultBranch") ? options.defaultBranch : "main";
          return { data: { default_branch: repoReads++ === 0
            ? initialDefaultBranch
            : options.lateDefaultBranch ?? initialDefaultBranch } };
        },
        getBranch: async (args) => {
          assert.deepEqual(args, { owner: "agent-teams-ai", repo: ".github", branch: "main" });
          if (options.apiError === "branch") throw new Error("API unavailable");
          const initialSha = options.branchSha ?? pull.base.sha;
          return { data: { commit: { sha: branchReads++ === 0 ? initialSha : options.lateBranchSha ?? initialSha } } };
        },
      },
    },
  };
  const core = {
    setFailed: (message) => failures.push(message),
    setOutput: (name, value) => outputs.set(name, value),
  };
  await execute(context, github, core);
  return { failures, outputs, listReads };
}

const rejected = async (options) => {
  const result = await classify(options);
  assert.notEqual(result.failures.length, 0, JSON.stringify(options));
  assert.equal(result.outputs.size, 0);
};

test("accepts the complete exact activation candidate", async () => {
  const result = await classify();
  assert.deepEqual(result.failures, []);
  assert.equal(result.outputs.get("mode"), "authority");
  assert.equal(candidate.length, 22);
  assert.equal(new Set(candidate.map(({ filename }) => filename)).size, candidate.length);
  assert.ok(candidate.every(({ filename }) => filename !== workflowPath && filename !== testPath));
});

const activationTrees = (selected = candidate) => {
  const baseTree = canonicalTree("base");
  const headTree = baseTree.map((entry) => ({ ...entry }));
  for (const file of selected) {
    const index = headTree.findIndex(({ path }) => path === file.filename);
    const replacement = treeEntry(file.filename, file.sha);
    if (index === -1) headTree.push(replacement);
    else headTree[index] = replacement;
  }
  return { baseTree, headTree };
};

const singleChangeTrees = (path, baseEntry, headEntry) => ({
  baseTree: [treeEntry(workflowPath, successorSha), treeEntry(testPath, successorSha), ...(baseEntry ? [{ path, ...baseEntry }] : [])],
  headTree: [treeEntry(workflowPath, successorSha), treeEntry(testPath, successorSha), ...(headEntry ? [{ path, ...headEntry }] : [])],
});

test("rejects singleton partial activation for every allowed path", async () => {
  for (const file of candidate) await rejected(activationTrees([file]));
});

test("rejects every partial activation and every extra or mixed immutable slice", async () => {
  for (let index = 0; index < candidate.length; index++) {
    await rejected(activationTrees(candidate.filter((_, candidateIndex) => candidateIndex !== index)));
  }
  const extra = activationTrees();
  extra.headTree.push(treeEntry("docs/extra.md", "d".repeat(40)));
  await rejected(extra);
  const mixed = activationTrees([candidate[5]]);
  mixed.headTree.push(treeEntry("docs/unrelated.md", "d".repeat(40)));
  await rejected(mixed);
});

test("rejects wrong immutable activation identities", async () => {
  const base = canonicalTree("base");
  const head = canonicalTree("head");
  const modified = candidate.find(({ baseBlob }) => baseBlob !== null);
  const baseIndex = base.findIndex(({ path }) => path === modified.filename);
  const headIndex = head.findIndex(({ path }) => path === modified.filename);
  for (const options of [
    { baseTree: base.map((entry, index) => index === baseIndex ? { ...entry, sha: "d".repeat(40) } : entry), headTree: head },
    { baseTree: base, headTree: head.map((entry, index) => index === headIndex ? { ...entry, sha: "d".repeat(40) } : entry) },
    { baseTree: base, headTree: head.map((entry, index) => index === headIndex ? { ...entry, mode: "100755" } : entry) },
    { baseTree: base, headTree: head.map((entry, index) => index === headIndex ? { ...entry, type: "commit", mode: "160000" } : entry) },
  ]) await rejected(options);
});

test("rejects forks, wrong bases, stale default branches, and stale live revisions", async () => {
  for (const options of [
    { headRepo: "attacker/fork" }, { missingHeadRepo: true },
    { baseRepo: "attacker/fork" }, { missingBaseRepo: true },
    { liveHeadRepo: "attacker/fork" }, { missingLiveHeadRepo: true },
    { liveBaseRepo: "attacker/fork" }, { missingLiveBaseRepo: true },
    { baseRef: "release" }, { branchSha: "d".repeat(40) },
    { liveBaseSha: "d".repeat(40) }, { liveHeadSha: "d".repeat(40) },
    { liveBaseRef: "release" }, { eventRepository: "attacker/repository" },
  ]) await rejected(options);
});

test("rejects malformed, truncated, and duplicate immutable trees", async () => {
  const base = canonicalTree("base");
  const head = canonicalTree("head");
  for (const options of [
    { headTree: [...head, { ...head[0] }] },
    { baseTree: [...base, { path: "bad", type: "tree", mode: "100644", sha: "d".repeat(40) }] },
    { headTree: [...head, { path: "bad", type: "commit", mode: "100644", sha: "d".repeat(40) }] },
    { headTree: [...head, { path: "bad", type: "blob", mode: "040000", sha: "d".repeat(40) }] },
    { headTree: [...head, { path: "bad//path", type: "blob", mode: "100644", sha: "d".repeat(40) }] },
    { headTree: [...head, { path: "bad", type: "blob", mode: "100644", sha: "bad" }] },
    { headTree: [...head, null] },
    { headTreeResponse: { truncated: true, tree: head } },
    { baseTreeResponse: { truncated: false } },
  ]) await rejected(options);
});

test("rejects the A-to-B-to-A mutable listing race", async () => {
  const trees = activationTrees([candidate[0]]);
  const result = await classify({ ...trees, mutableListing: [{ filename: "docs/unrelated.md", status: "modified" }] });
  assert.notEqual(result.failures.length, 0);
  assert.equal(result.outputs.size, 0);
  assert.equal(result.listReads, 0);
});

test("derives terminal add, remove, type, mode, and blob changes", async () => {
  const path = "scripts/unrelated.mjs";
  const regularD = { type: "blob", mode: "100644", sha: "d".repeat(40) };
  const regularE = { type: "blob", mode: "100644", sha: "e".repeat(40) };
  for (const trees of [
    singleChangeTrees(path, null, regularD),
    singleChangeTrees(path, regularD, null),
    singleChangeTrees(path, regularD, { type: "commit", mode: "160000", sha: "e".repeat(40) }),
    singleChangeTrees(path, regularD, { ...regularD, mode: "100755" }),
    singleChangeTrees(path, regularD, regularE),
  ]) await rejected(trees);
});

test("rejects successor self-modification and byte or mode drift", async () => {
  const head = canonicalTree("head");
  for (const mutation of [{ sha: "d".repeat(40) }, { mode: "100755" }, { mode: "120000" }]) {
    await rejected({ headTree: head.map((entry) => entry.path === workflowPath ? { ...entry, ...mutation } : entry) });
  }
});

test("uses noop only for an immutable unrelated terminal change", async () => {
  const trees = singleChangeTrees("docs/unrelated.md",
    { type: "blob", mode: "100644", sha: "d".repeat(40) },
    { type: "blob", mode: "100644", sha: "e".repeat(40) });
  const result = await classify(trees);
  assert.deepEqual(result.failures, []);
  assert.equal(result.outputs.get("mode"), "noop");
  assert.equal(result.listReads, 0);
  await rejected({ ...trees, headRepo: "attacker/fork" });
  await rejected({ ...trees, branchSha: "d".repeat(40) });
  await rejected({ baseTree: trees.baseTree, headTree: trees.baseTree });
});

test("rejects workflow, script, tooling, schema, and install authority outside the exact tuple", async () => {
  for (const filename of [
    ".github/workflows/unrelated.yml",
    "scripts/unrelated.mjs",
    "tools/unrelated/check.mjs",
    "governance/unrelated.schema.json",
    "nested/package.json",
  ]) {
    await rejected(singleChangeTrees(filename,
      { type: "blob", mode: "100644", sha: "d".repeat(40) },
      { type: "blob", mode: "100644", sha: "e".repeat(40) }));
  }
});

test("rejects moves out of every authority class from immutable trees", async () => {
  for (const previous_filename of [
    ".github/workflows/unrelated.yml",
    "scripts/unrelated.mjs",
    "tools/unrelated/check.mjs",
    "governance/unrelated.schema.json",
    "nested/.npmrc",
  ]) {
    const baseTree = [treeEntry(workflowPath, successorSha), treeEntry(testPath, successorSha),
      treeEntry(previous_filename, "d".repeat(40))];
    const headTree = [treeEntry(workflowPath, successorSha), treeEntry(testPath, successorSha),
      treeEntry("docs/unrelated.md", "d".repeat(40))];
    await rejected({ baseTree, headTree });
  }
});

test("rejects late pull-request and default-branch movement on noop and authority routes", async () => {
  const noopTrees = singleChangeTrees("docs/unrelated.md",
    { type: "blob", mode: "100644", sha: "d".repeat(40) },
    { type: "blob", mode: "100644", sha: "e".repeat(40) });
  for (const trees of [{}, noopTrees]) {
    for (const movement of [
      { lateHeadSha: "d".repeat(40) },
      { lateBaseSha: "d".repeat(40) },
      { lateBaseRef: "release" },
      { lateDefaultBranch: "release" },
      { lateBranchSha: "d".repeat(40) },
      { lateHeadRepo: "attacker/fork" },
      { lateBaseRepo: "attacker/fork" },
    ]) await rejected({ ...trees, ...movement });
  }
});

test("is a bounded base-owned, read-only, non-executing workflow", () => {
  assert.match(workflow, /^on:\n  pull_request_target:/mu);
  assert.doesNotMatch(workflow, /^  (push|pull_request|workflow_dispatch|schedule):/mu);
  assert.match(workflow, /permissions:\n  contents: read\n  pull-requests: read\n\njobs:/u);
  assert.match(workflow, /name: trusted-quality-authority-evolution-v1/u);
  assert.match(workflow, /runs-on: ubuntu-24\.04/u);
  assert.match(workflow, /timeout-minutes: 3/u);
  assert.equal((workflow.match(/uses:/gu) ?? []).length, 1);
  assert.match(workflow, /actions\/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd/u);
  assert.doesNotMatch(workflow, /actions\/checkout|\brun:|secrets\.|getContent|listFiles|paginate\s*\(|eval\s*\(|permissions:\s*\$\{/u);
});

test("fails closed when required event fields or API reads are unavailable", async () => {
  for (const options of [
    { missingPull: true }, { number: "401" }, { eventBaseSha: "bad" },
    { eventHeadSha: "bad" }, { defaultBranch: "" },
  ]) await rejected(options);
  for (const apiError of ["get", "repo", "branch", "getTree"]) {
    await assert.rejects(classify({ apiError }), /API unavailable/u);
  }
});
