import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import test from "node:test";
import { Script } from "node:vm";
import { parse } from "yaml";
import type { AdmissionV1Mode, AdmissionV1Snapshot } from "./runtime-admission-source-successor-v6-owners.ts";
import { requireTargetBinding } from "./runtime-admission-source-successor-v6-target.ts";

const git = (...args: string[]): Buffer =>
  execFileSync("git", args, {
    cwd: new URL("../", import.meta.url),
    maxBuffer: 16 * 1024 * 1024,
  });
type Entry = { path: string; mode: string; type: string; sha: string; size?: number };
type RawTree = { sha: string; truncated: boolean; tree: Entry[] };
type Changed = { filename: string; status: string; sha: string; previous_filename?: string };
const hash = (kind: string, bytes: Buffer): string =>
  createHash("sha1").update(`${kind} ${bytes.length}\0`).update(bytes).digest("hex");
function treeAt(revision: string): RawTree {
  return {
    sha: git("rev-parse", `${revision}^{tree}`).toString().trim(),
    truncated: false,
    tree: git("ls-tree", "-r", "-t", "-l", revision)
      .toString()
      .trimEnd()
      .split("\n")
      .map((line) => {
        const [metadata, path] = line.split("\t");
        assert.ok(metadata && path);
        const [mode, type, sha, size] = metadata.trim().split(/\s+/u);
        assert.ok(mode && type && sha);
        return { path, mode, type, sha, ...(size === "-" ? {} : { size: Number(size) }) };
      }),
  };
}
const isMapping = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const mapping = (value: unknown): Record<string, unknown> => {
  assert.ok(isMapping(value));
  return value;
};
const frozenSources = [
  [
    ".github/workflows/docs-admission-authority-evolution-v1.yml",
    "8437f647e1ea0ea2f4778427cb09446b837c8af7"
  ],
  [
    "scripts/check-docs-source-successor-v1.mts",
    "36cb752a50b8a0d7f83c813ed17cec775cdd79bb"
  ],
  [
    "scripts/check-docs-verifier-authority.mts",
    "55c462acdc808bff8b032dce9819de48a02e5e3b"
  ],
  [
    "scripts/docs-quality-source-successor-v2.ts",
    "767e4c4b530fdfad8356e299709be08f3237fdb0"
  ],
  [
    "scripts/docs-quality-source-successor-v3.ts",
    "bd0072b49306a78069be10bbe34bacff5ac457cc"
  ],
  [
    "scripts/runtime-admission-source-successor-v2.ts",
    "989db73819975b12d672fe9da994748dcba6c8be"
  ],
  [
    "scripts/runtime-admission-source-successor-v4.ts",
    "ef337dd70d45e6ca645050d5a5a31b12f1fa3658"
  ]
] as const;
for (const [path, blob] of frozenSources) {
  const url = new URL(`../${path}`, import.meta.url);
  assert.ok(lstatSync(url).isFile(), `Frozen source must remain regular: ${path}`);
  assert.equal(hash("blob", readFileSync(url)), blob, `Frozen source byte drift: ${path}`);
}
// Import only after the exact retained executable owners have been checked.
const {
  FROZEN_ADMISSION_V1,
  checkAdmissionV1Owner,
  checkOrdinarySourceOwners,
  OrdinarySourceOwnersRefused,
} = await import("./runtime-admission-source-successor-v6-owners.ts");

const literalWorkflow = readFileSync(new URL(`../${FROZEN_ADMISSION_V1.path}`, import.meta.url), "utf8");
const workflow: unknown = parse(literalWorkflow);
const steps = mapping(mapping(mapping(workflow).jobs)["trusted-admission-authority-evolution-v1"]).steps;
assert.ok(Array.isArray(steps));
const literalScript = mapping(mapping(steps[0]).with).script;
assert.equal(typeof literalScript, "string");
assert.ok(typeof literalScript === "string");

function v1Fixture() {
  const files: Changed[] = [{
    filename: FROZEN_ADMISSION_V1.target,
    status: "modified",
    sha: "1bf455f2ca5bf97440e62b2ff4eaa6c36aa2212b",
  }];
  return {
    pull: {
      number: 77,
      changed_files: 1,
      head: { sha: "b".repeat(40), repo: { full_name: "agent-teams-ai/.github" } },
      base: { ref: "main", sha: "a".repeat(40) },
    },
    files,
    repository: { full_name: "agent-teams-ai/.github", default_branch: "main" },
    defaultBranch: { commit: { sha: "a".repeat(40) } },
  };
}
type V1Fixture = ReturnType<typeof v1Fixture>;
async function literalV1Outcome(snapshot: AdmissionV1Snapshot) {
  const outputs = new Map<string, unknown>();
  let failed = false;
  const result: unknown = new Script(`(async () => {\n${literalScript}\n})()`).runInNewContext({
    context: {
      payload: { pull_request: snapshot.pull },
      repo: { owner: "agent-teams-ai", repo: ".github" },
    },
    github: {
      paginate: async () => snapshot.files,
      rest: {
        pulls: { listFiles: () => undefined },
        repos: {
          get: async () => ({ data: snapshot.repository }),
          getBranch: async () => ({ data: snapshot.defaultBranch }),
        },
      },
    },
    core: {
      setFailed: () => { failed = true; },
      setOutput: (name: string, value: unknown) => { outputs.set(name, value); },
    },
  }, { timeout: 1000 });
  await result;
  return { failed, mode: outputs.get("mode") };
}
function typedV1Outcome(snapshot: AdmissionV1Snapshot) {
  try {
    return { failed: false, mode: checkAdmissionV1Owner(snapshot) };
  } catch {
    return { failed: true, mode: undefined };
  }
}

void test("unbound composite target cannot select a collection or publication target", () => {
  assert.throws(() => requireTargetBinding(null), /target is unbound; collection and publication are forbidden/u);
});

void test("typed admission owner preserves the literal frozen V1 algorithm", async (t) => {
  const cases: readonly [string, (snapshot: V1Fixture) => void, AdmissionV1Mode | undefined][] = [
    ["forward", () => {}, "forward"],
    ["rollback", (s) => { s.files[0]!.sha = "e3f0f3d2e065b7c0ae324481a3056b7955a0702d"; }, "rollback"],
    ["ordinary data", (s) => { s.files[0]!.filename = "governance/docs-b304-registry-recovery.json"; }, "noop"],
    ["ordinary owner does not inspect target-only metadata", (s) => {
      s.files[0]!.filename = "README.md";
      s.pull.head.repo.full_name = "fixture/fork";
      s.defaultBranch.commit.sha = "c".repeat(40);
    }, "noop"],
    ["zero changed count", (s) => { s.pull.changed_files = 0; }, undefined],
    ["incomplete file census", (s) => { s.pull.changed_files = 2; }, undefined],
    ["duplicate filename", (s) => { s.files.push({ ...s.files[0]! }); s.pull.changed_files = 2; }, undefined],
    ["foreign target", (s) => { s.pull.head.repo.full_name = "fixture/fork"; }, undefined],
    ["unreviewed target blob", (s) => { s.files[0]!.sha = "d".repeat(40); }, undefined],
    ["added verifier", (s) => { s.files[0]!.status = "added"; }, undefined],
    ["target rename", (s) => { s.files[0]!.previous_filename = "scripts/prior.mjs"; }, undefined],
    ["rename away from target", (s) => {
      s.files[0]!.previous_filename = FROZEN_ADMISSION_V1.target;
      s.files[0]!.filename = "scripts/other.mjs";
      s.files[0]!.status = "renamed";
    }, undefined],
    ["mixed verifier change", (s) => {
      s.files.push({ filename: "README.md", status: "modified", sha: "c".repeat(40) });
      s.pull.changed_files = 2;
    }, undefined],
    ["wrong default branch", (s) => { s.pull.base.ref = "other"; }, undefined],
    ["stale default head", (s) => { s.defaultBranch.commit.sha = "c".repeat(40); }, undefined],
  ];
  for (const [name, mutate, mode] of cases) {
    await t.test(name, async () => {
      const snapshot = v1Fixture();
      mutate(snapshot);
      const before = structuredClone(snapshot);
      const literal = await literalV1Outcome(snapshot);
      assert.deepEqual(literal, { failed: mode === undefined, mode });
      assert.deepEqual(typedV1Outcome(snapshot), literal);
      assert.deepEqual(snapshot, before);
    });
  }
});

const legacyInputs = [
  "scripts/check-docs-source-successor-v1.mts",
  "scripts/check-docs-source-successor-v1.test.mts",
  ".github/workflows/docs-source-successor-v1.yml",
  "docs/decisions/0009-bounded-docs-source-successor.md",
  "tsconfig.docs-source-successor.json",
];
const inputEvidence = (tree: RawTree): Record<string, Entry | null> =>
  Object.fromEntries(legacyInputs.map((path) => [path, tree.tree.find((entry) => entry.path === path) ?? null]));
const encoded = (bytes: Buffer) => ({
  sha: hash("blob", bytes), size: bytes.length, encoding: "base64", content: bytes.toString("base64"),
});
function ordinaryFixture() {
  // Real immutable baseline bytes; later synthetic leaves are comparator TEST data,
  // never provider proof, finite target coordinates or publication authority.
  const revision = "b88a08c8131b8c98650318eb374a5fd2840bed46";
  const baseTree = treeAt(revision);
  const headTree = structuredClone(baseTree);
  const files: Changed[] = [];
  const baseManifest = git("show", `${revision}:package.json`);
  const baseLock = git("show", `${revision}:pnpm-lock.yaml`);
  const coordinates = {
    pullRequest: 77, repository: "agent-teams-ai/.github", baseSHA: revision,
    headSHA: revision, sourceSHA: revision, baseRef: "main", defaultBranch: "main",
    headRepository: "agent-teams-ai/.github", changedFiles: 0,
  };
  const envelope = {
    ...coordinates,
    base: "5abed741aff64506d0e9f87f76541a4e93af7e4a",
    reviewTarget: "96cb95a89ca4a133fbb626133eb3ac6289938ff7",
    paginationComplete: true, files, baseTree, headTree,
    baseInputs: inputEvidence(baseTree), headInputs: inputEvidence(headTree),
    headData: { "package.json": encoded(baseManifest), "pnpm-lock.yaml": encoded(baseLock) },
    live: { ...coordinates, state: "open" },
  };
  return { envelope, baseManifest, baseLock };
}
type OrdinaryFixture = ReturnType<typeof ordinaryFixture>;
const fixtureLeafName = (entry: Entry): string => entry.path.split("/").at(-1)!;
/** Comparator TEST setup only: recompute complete tree hashes after synthetic leaf changes. */
function rehashTree(tree: RawTree): void {
  const directories = new Set([
    "",
    ...tree.tree.filter((entry) => entry.type === "tree").map((entry) => entry.path),
  ]);
  for (const entry of tree.tree) {
    let parent = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
    while (parent !== "") {
      if (!directories.has(parent)) {
        directories.add(parent);
        tree.tree.push({ path: parent, type: "tree", mode: "040000", sha: "b".repeat(40) });
      }
      parent = parent.includes("/") ? parent.slice(0, parent.lastIndexOf("/")) : "";
    }
  }
  for (const directory of [...directories].toSorted(
    (left, right) => right.split("/").length - left.split("/").length || right.length - left.length,
  )) {
    const direct = tree.tree.filter(
      (entry) =>
        (entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "") ===
        directory,
    );
    direct.sort((left, right) =>
      Buffer.compare(
        Buffer.from(fixtureLeafName(left) + (left.type === "tree" ? "/" : "")),
        Buffer.from(fixtureLeafName(right) + (right.type === "tree" ? "/" : "")),
      ),
    );
    const bytes = Buffer.concat(
      direct.flatMap((entry) => [
        Buffer.from(`${entry.mode.replace(/^0/u, "")} ${fixtureLeafName(entry)}\0`),
        Buffer.from(entry.sha, "hex"),
      ]),
    );
    const sha = hash("tree", bytes);
    if (directory === "") {
      tree.sha = sha;
    } else {
      tree.tree.find((entry) => entry.path === directory)!.sha = sha;
    }
  }
}
function change(f: OrdinaryFixture, path: string, bytes: Buffer): void {
  const sha = hash("blob", bytes);
  const before = f.envelope.baseTree.tree.find((entry) => entry.path === path);
  const next = { path, type: "blob", mode: "100644", sha, size: bytes.length };
  const prior = f.envelope.headTree.tree.find((entry) => entry.path === path);
  if (prior) {
    Object.assign(prior, next);
  } else {
    f.envelope.headTree.tree.push(next);
  }
  f.envelope.files.push({ filename: path, status: before ? "modified" : "added", sha });
  f.envelope.headSHA = "b".repeat(40);
  f.envelope.sourceSHA = f.envelope.headSHA;
  f.envelope.changedFiles = f.envelope.files.length;
  Object.assign(f.envelope.live, {
    headSHA: f.envelope.headSHA, sourceSHA: f.envelope.headSHA, changedFiles: f.envelope.changedFiles,
  });
  rehashTree(f.envelope.headTree);
  f.envelope.headInputs = inputEvidence(f.envelope.headTree);
}
function admissionFor(f: OrdinaryFixture): AdmissionV1Snapshot {
  const e = f.envelope;
  return {
    pull: {
      number: e.pullRequest, changed_files: e.changedFiles,
      head: { sha: e.headSHA, repo: { full_name: e.headRepository } },
      base: { ref: e.baseRef, sha: e.baseSHA },
    },
    files: e.files,
    repository: { full_name: e.repository, default_branch: e.defaultBranch },
    defaultBranch: { commit: { sha: e.baseSHA } },
  };
}
const checkBoth = (f: OrdinaryFixture, admission = admissionFor(f)) =>
  checkOrdinarySourceOwners(f.envelope, f.baseManifest, f.baseLock, "a".repeat(40), admission);

void test("frozen owners leave isolated B304 data to its separately qualified staging owner", async () => {
  for (const path of [
    "governance/docs-b304-registry-recovery.json",
    "governance/evidence/docs-b304-registry-recovery/test-proof.json",
  ]) {
    const f = ordinaryFixture();
    change(f, path, Buffer.from('{"comparator_test_only":true}\n'));
    const before = structuredClone(f.envelope);
    assert.deepEqual(await checkBoth(f), { runtime: "noop", admission: "noop" });
    assert.deepEqual(f.envelope, before);
  }
});

void test("runtime protected-input control rejects while V1 independently observes noop", async () => {
  const f = ordinaryFixture();
  change(f, "governance/commit-author-identity.json", Buffer.concat([
    git("show", "b88a08c8131b8c98650318eb374a5fd2840bed46:governance/commit-author-identity.json"),
    Buffer.from("\n"),
  ]));
  assert.equal(checkAdmissionV1Owner(admissionFor(f)), "noop");
  await assert.rejects(checkBoth(f), (error: unknown) =>
    error instanceof OrdinarySourceOwnersRefused &&
      JSON.stringify(error.owners) === JSON.stringify(["runtime-v4"]));
});

void test("admission protected-input control evaluates both rejecting owners", async () => {
  const f = ordinaryFixture();
  change(f, FROZEN_ADMISSION_V1.target, Buffer.concat([
    git("show", `b88a08c8131b8c98650318eb374a5fd2840bed46:${FROZEN_ADMISSION_V1.target}`),
    Buffer.from("\n"),
  ]));
  assert.throws(() => checkAdmissionV1Owner(admissionFor(f)), /exact reviewed verifier/u);
  await assert.rejects(checkBoth(f), (error: unknown) =>
    error instanceof OrdinarySourceOwnersRefused &&
      JSON.stringify(error.owners) === JSON.stringify(["runtime-v4", "admission-v1"]));
});

void test("ordinary owner evidence cannot borrow a different head or a benign file census", async () => {
  const f = ordinaryFixture();
  change(f, FROZEN_ADMISSION_V1.target, Buffer.from("unreviewed TEST verifier\n"));
  for (const field of ["head", "files"]) {
    let mismatched = structuredClone(admissionFor(f));
    if (field === "head") {
      mapping(mapping(mismatched.pull).head).sha = "c".repeat(40);
    } else {
      mismatched = { ...mismatched, files: [{ filename: "README.md", status: "modified", sha: "c".repeat(40) }] };
    }
    await assert.rejects(checkBoth(f, mismatched), /different heads|different files/u);
  }
});
