import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse, stringify } from "yaml";
import { assertVerifierAuthority, assertVerifierDependencies } from "./check-docs-verifier-authority.mts";

const manifestBytes = readFileSync("package.json"), lockBytes = readFileSync("pnpm-lock.yaml");
const reviewedG = "66d6d3d2c2643edac414ded48c0ee0586774dd07";
const gitBytes = (...args: string[]) => execFileSync("git", args, { cwd: new URL("../", import.meta.url) });
const historicalManifestBytes = gitBytes("show", `${reviewedG}:package.json`);
const historicalLockBytes = gitBytes("show", `${reviewedG}:pnpm-lock.yaml`);
type Manifest = { devDependencies: Record<string, string>; [key: string]: unknown };
type Lock = { packages: Record<string, { resolution: { integrity?: string; tarball?: string } }>;
  snapshots: Record<string, { dependencies?: Record<string, string> }>;
  importers: { ".": { devDependencies: Record<string, { specifier: string; version: string }> } };
  [key: string]: unknown };
function dependencyFixture() {
  const manifest = JSON.parse(manifestBytes.toString()) as Manifest;
  const lock = parse(lockBytes.toString()) as Lock;
  manifest.devDependencies["s4-test-only"] = "1.2.3";
  lock.importers["."].devDependencies["s4-test-only"] = { specifier: "1.2.3", version: "1.2.3" };
  lock.packages["s4-test-only@1.2.3"] = { resolution: { integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}` } };
  lock.snapshots["s4-test-only@1.2.3"] = {};
  return { manifest, lock };
}
const compare = ({ manifest, lock }: ReturnType<typeof dependencyFixture>) =>
  assertVerifierDependencies(manifestBytes.toString(), lockBytes.toString(), JSON.stringify(manifest), stringify(lock));

test("allows unrelated root registry devDependencies and corresponding lock records", () => {
  compare(dependencyFixture());
  const update = dependencyFixture();
  delete update.manifest.devDependencies.renovate;
  delete update.lock.importers["."].devDependencies.renovate;
  compare(update);
});

test("rejects integrity, dependency-edge and missing-record drift for all six verifier packages", () => {
  for (const key of ["ajv@8.20.0", "yaml@2.9.0", "fast-deep-equal@3.1.3", "fast-uri@3.1.5",
    "json-schema-traverse@1.0.0", "require-from-string@2.0.2"]) {
    for (const change of ["integrity", "edge", "missing-package", "missing-snapshot"]) {
      const fixture = dependencyFixture();
      if (change === "integrity") {fixture.lock.packages[key]!.resolution.integrity = `sha512-${Buffer.alloc(64).toString("base64")}`;}
      if (change === "edge") {fixture.lock.snapshots[key]!.dependencies = { "s4-test-only": "1.2.3" };}
      if (change === "missing-package") {delete fixture.lock.packages[key];}
      if (change === "missing-snapshot") {delete fixture.lock.snapshots[key];}
      assert.throws(() => compare(fixture), `${key}: ${change}`);
    }
  }
});

test("rejects verifier bindings, install globals, module-resolution policy and native command changes", () => {
  const mutations: ((fixture: ReturnType<typeof dependencyFixture>) => void)[] = [
    f => { f.manifest.devDependencies.ajv = "8.21.0"; },
    f => { f.lock.importers["."].devDependencies.yaml!.version = "2.8.0"; },
    f => { delete f.lock.importers["."].devDependencies.ajv; },
    f => { f.lock.settings = {}; }, f => { f.lock.overrides = {}; },
    ...["scripts", "type", "imports", "exports", "main", "pnpm", "packageManager", "engines", "dependencies"].map(key =>
      (f: ReturnType<typeof dependencyFixture>) => { f.manifest[key] = {}; }),
  ];
  for (const mutate of mutations) { const fixture = dependencyFixture(); mutate(fixture); assert.throws(() => compare(fixture)); }
});

test("rejects unbound or non-registry dependency metadata rather than expanding installation authority", () => {
  for (const specifier of ["file:../TEST", "link:../TEST", "workspace:*", "npm:yaml@2.9.0", "https://example.invalid/a.tgz", "git+ssh://example.invalid/a"]) {
    const fixture = dependencyFixture(); fixture.manifest.devDependencies["s4-test-only"] = specifier;
    assert.throws(() => compare(fixture));
  }
  const fixture = dependencyFixture(); delete fixture.lock.importers["."].devDependencies["s4-test-only"];
  assert.throws(() => compare(fixture));
  const tarball = dependencyFixture(); tarball.lock.packages["s4-test-only@1.2.3"]!.resolution.tarball = "https://example.invalid/a.tgz";
  assert.throws(() => compare(tarball));
  assert.throws(() => assertVerifierDependencies(manifestBytes.toString(), "packages: {}", manifestBytes.toString(), "packages: {}"));
  assert.throws(() => assertVerifierDependencies(manifestBytes.toString(), lockBytes.toString(), manifestBytes.toString(), "packages: {}\npackages: {}"));
});

function authorityFixture() {
  const tree = execFileSync("git", ["ls-tree", "-r", "-t", reviewedG], { encoding: "utf8" }).trim().split("\n").map(line => {
    const [header, path] = line.split("\t"); const [mode, type, sha] = header!.split(" ");
    return { path: path!, mode: mode!, type: type!, sha: sha! };
  });
  for (const path of ["scripts/check-docs-verifier-authority.mts", "scripts/check-docs-verifier-authority.test.mts"]) {
    if (!tree.some(entry => entry.path === path)) {tree.push({ path, mode: "100644", type: "blob", sha: "e".repeat(40) });}
  }
  const files = [{ filename: "README.md", status: "modified", sha: "d".repeat(40), previous_filename: undefined as string | undefined }];
  const headTree = structuredClone(tree); headTree.find(entry => entry.path === "README.md")!.sha = files[0]!.sha;
  const headData = Object.fromEntries(["package.json", "pnpm-lock.yaml"].map(path => [path, {
    encoding: "base64", content: gitBytes("show", `${reviewedG}:${path}`).toString("base64"), sha: tree.find(entry => entry.path === path)!.sha,
  }]));
  return { changedFiles: 1, files, baseTree: { tree, truncated: false }, headTree: { tree: headTree, truncated: false }, headData };
}
const check = (evidence: unknown) => assertVerifierAuthority(evidence, historicalManifestBytes, historicalLockBytes);
const node26DefaultBlobs = [
  [".node-version", "df6ae3370f9f89272d88629c442cf554d6c1f9fb", "d8750199bbef3481a89eaf452088c384f4025508"],
  ["AGENTS.md", "5103769cb5f5f26438b15c5ce11b1234f505a748", "d31e50aa17c1cb2008fd87191ffceec5d421ab0a"],
  ["docs/engineering-quality-profile.json", "3a7f60d0af07bbbdf9b742bba39894f7deaf078e", "93a1b876c19153c51fad0a03d9fa331034cd8cea"],
  ["docs/engineering-quality.md", "7edd8695a2e06d609336e73e1f861d46b2b65b46", "2368570df3db82c664ad59426a40b7f832191ab2"],
  ["package.json", "75e4d98b44aa0f777cc03c57857e1e023ec6c1b0", "51f9bfb4bf250acd795f4bb2384f9b58132e24ae"],
  ["scripts/check-quality-scope.mjs", "3dc6329177e56aea18c13fe8e59ad8e4c6a671e3", "18588dc80475e459ccd784c9af25312585ce4c40"],
  ["scripts/check-quality-scope.test.mjs", "3a025636bcfd0e1796695b5b0ad0b5f398b2709b", "4e7a343ddddcda2326ad761c056a1ba61059f9ab"],
  ["scripts/merge-owner-pr.test.mjs", "34adcaee7d8bc85698fecdeb59cb882bccdcdaaa", "e3afa253f69e77021bce4f77a7e5bee70064653c"],
] as const;

function node26DefaultFixture() {
  const fixture = authorityFixture();
  const manifest = JSON.parse(historicalManifestBytes.toString()) as Manifest;
  manifest.engines = { ...(manifest.engines as Record<string, string>), node: ">=24.18.0 <25 || >=26.10.0 <27" };
  const packageBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  fixture.files = node26DefaultBlobs.map(([filename, before, after]) => {
    assert.equal(fixture.baseTree.tree.find(entry => entry.path === filename)?.sha, before, filename);
    Object.assign(fixture.headTree.tree.find(entry => entry.path === filename)!,
      { mode: "100644", type: "blob", sha: after });
    return { filename, status: "modified", sha: after, previous_filename: undefined };
  });
  fixture.headTree.tree.find(entry => entry.path === "README.md")!.sha =
    fixture.baseTree.tree.find(entry => entry.path === "README.md")!.sha;
  fixture.headData["package.json"] = {
    encoding: "base64", content: packageBytes.toString("base64"),
    sha: node26DefaultBlobs.find(([path]) => path === "package.json")![2],
  };
  fixture.changedFiles = fixture.files.length;
  return fixture;
}

test("admits only the exact reviewed PR359 Node26-default transition", () => {
  assert.equal(check(node26DefaultFixture()), "node26-default");
});

test("rejects partial, extra, reversed, replacement and dependency-drift variants of the finite transition", () => {
  const partial = node26DefaultFixture();
  const omitted = partial.files.pop()!;
  Object.assign(partial.headTree.tree.find(entry => entry.path === omitted.filename)!,
    partial.baseTree.tree.find(entry => entry.path === omitted.filename)!);
  partial.changedFiles = partial.files.length;
  assert.throws(() => check(partial), /Protected authority path/u);

  const extra = node26DefaultFixture(), extraSha = "b".repeat(40);
  extra.headTree.tree.find(entry => entry.path === "README.md")!.sha = extraSha;
  extra.files.unshift({ filename: "README.md", status: "modified", sha: extraSha, previous_filename: undefined });
  extra.changedFiles = extra.files.length;
  assert.throws(() => check(extra), /Protected authority path/u);

  const reverse = node26DefaultFixture();
  for (const [path, before, after] of node26DefaultBlobs) {
    Object.assign(reverse.baseTree.tree.find(entry => entry.path === path)!, { mode: "100644", type: "blob", sha: after });
    Object.assign(reverse.headTree.tree.find(entry => entry.path === path)!, { mode: "100644", type: "blob", sha: before });
    reverse.files.find(file => file.filename === path)!.sha = before;
  }
  assert.throws(() => check(reverse), /Protected authority path/u);

  for (const replacement of [{ mode: "120000", type: "blob" }, { mode: "160000", type: "commit" }]) {
    const fixture = node26DefaultFixture();
    Object.assign(fixture.headTree.tree.find(entry => entry.path === ".node-version")!, replacement);
    assert.throws(() => check(fixture), /Protected authority path/u);
  }

  const dependency = node26DefaultFixture();
  const manifest = JSON.parse(historicalManifestBytes.toString()) as Manifest;
  manifest.engines = { ...(manifest.engines as Record<string, string>), node: ">=24.18.0 <25 || >=26.10.0 <27" };
  manifest.devDependencies.ajv = "8.21.0";
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const sha = execFileSync("git", ["hash-object", "--stdin"], { input: bytes, encoding: "utf8" }).trim();
  dependency.headData["package.json"] = { encoding: "base64", content: bytes.toString("base64"), sha };
  Object.assign(dependency.headTree.tree.find(entry => entry.path === "package.json")!, { sha });
  dependency.files.find(file => file.filename === "package.json")!.sha = sha;
  assert.throws(() => check(dependency));
});

test("rejects an installed-validator edit even alongside the exact transition", () => {
  const fixture = node26DefaultFixture(), path = "scripts/check-docs-verifier-authority.mts", sha = "c".repeat(40);
  fixture.headTree.tree.find(entry => entry.path === path)!.sha = sha;
  fixture.files.unshift({ filename: path, status: "modified", sha, previous_filename: undefined });
  fixture.changedFiles = fixture.files.length;
  assert.throws(() => check(fixture), /Protected authority path/u);
});

test("rejects an unlisted directory-to-blob replacement with declared descendant removal", () => {
  const fixture = authorityFixture(), path = "ordinary-TEST", child = `${path}/leaf.md`;
  fixture.baseTree.tree.push({ path, mode: "040000", type: "tree", sha: "e".repeat(40) },
    { path: child, mode: "100644", type: "blob", sha: "f".repeat(40) });
  fixture.headTree.tree.push({ path, mode: "100644", type: "blob", sha: "c".repeat(40) });
  fixture.files.push({ filename: child, status: "removed", sha: "f".repeat(40), previous_filename: undefined });
  fixture.changedFiles = fixture.files.length;
  assert.throws(() => check(fixture), /Unlisted changed Git leaf: ordinary-TEST$/u);
});

test("rejects an unlisted blob-to-directory replacement with declared descendant addition", () => {
  const fixture = authorityFixture(), path = "ordinary-TEST", child = `${path}/leaf.md`;
  fixture.baseTree.tree.push({ path, mode: "100644", type: "blob", sha: "c".repeat(40) });
  fixture.headTree.tree.push({ path, mode: "040000", type: "tree", sha: "e".repeat(40) },
    { path: child, mode: "100644", type: "blob", sha: "f".repeat(40) });
  fixture.files.push({ filename: child, status: "added", sha: "f".repeat(40), previous_filename: undefined });
  fixture.changedFiles = fixture.files.length;
  assert.throws(() => check(fixture), /Unlisted changed Git leaf: ordinary-TEST$/u);
});

test("allows ancestor tree SHA changes when all changed leaves are declared", () => {
  const fixture = authorityFixture(), path = "docs/ordinary-TEST.md", sha = "b".repeat(40);
  fixture.headTree.tree.find(entry => entry.path === "docs")!.sha = "c".repeat(40);
  fixture.headTree.tree.push({ path, mode: "100644", type: "blob", sha });
  fixture.files.push({ filename: path, status: "added", sha, previous_filename: undefined });
  fixture.changedFiles = fixture.files.length;
  assert.equal(check(fixture), "noop");
});

// Independent safety contract: the six required checks, identity routes and reusable Docs gate.
const guardWorkflows = ["ci", "docs-authority-evolution", "docs-cohort-authority-evolution-v8",
  "docs-cohort-append-only", "docs-admission-evidence", "docs-admission-authority-evolution-v1",
  "commit-author-identity", "commit-author-identity-check", "docs-protocol-check"]
  .map(name => `.github/workflows/${name}.yml`);

test("rejects declared changes to every required guard and reusable workflow", () => {
  for (const path of guardWorkflows) {
    const fixture = authorityFixture(), sha = "b".repeat(40);
    fixture.headTree.tree.find(entry => entry.path === path)!.sha = sha;
    fixture.files.push({ filename: path, status: "modified", sha, previous_filename: undefined });
    fixture.changedFiles = fixture.files.length;
    assert.throws(() => check(fixture), /Protected authority path/u, path);
  }
});

test("rejects rename origins for every required guard and reusable workflow", () => {
  for (const path of guardWorkflows) {
    const fixture = authorityFixture(), target = ".github/workflows/ordinary-TEST.yml";
    const original = fixture.baseTree.tree.find(entry => entry.path === path)!;
    fixture.headTree.tree = fixture.headTree.tree.filter(entry => entry.path !== path);
    fixture.headTree.tree.push({ ...original, path: target });
    fixture.files.push({ filename: target, status: "renamed", sha: original.sha, previous_filename: path });
    fixture.changedFiles = fixture.files.length;
    assert.throws(() => check(fixture), /Protected authority path/u, path);
  }
});

test("requires every required guard and reusable workflow even when absent from both trees", () => {
  for (const path of guardWorkflows) {
    const fixture = authorityFixture();
    fixture.baseTree.tree = fixture.baseTree.tree.filter(entry => entry.path !== path);
    fixture.headTree.tree = fixture.headTree.tree.filter(entry => entry.path !== path);
    assert.throws(() => check(fixture), /Missing protected input/u, path);
  }
});

test("allows declared unrelated workflow changes and their ancestor tree SHA changes", () => {
  const fixture = authorityFixture(), path = ".github/workflows/reviewrouter-interaction.yml", sha = "b".repeat(40);
  fixture.headTree.tree.find(entry => entry.path === path)!.sha = sha;
  for (const ancestor of [".github", ".github/workflows"]) {
    fixture.headTree.tree.find(entry => entry.path === ancestor)!.sha = "c".repeat(40);
  }
  fixture.files.push({ filename: path, status: "modified", sha, previous_filename: undefined });
  fixture.changedFiles = fixture.files.length;
  assert.equal(check(fixture), "noop");
});

test("allows ordinary tooling changes but rejects recovery, receipt, guard and installer authority including rename origins", () => {
  assert.equal(check(authorityFixture()), "noop");
  for (const path of ["scripts/docs-platform-admission-recovery.mjs", "scripts/docs-legacy-admission-recovery.mjs",
    "scripts/verify-docs-qualification-receipt.mjs", "scripts/verify-docs-cohort-v2-receipt.mjs",
    "scripts/check-docs-verifier-authority.mts", ".github/workflows/ci.yml", "scripts/package.json",
    "scripts/node_modules/yaml/index.js", "node_modules/ajv/package.json", ".pnpmfile.cjs", "tools/.npmrc"]) {
    const fixture = authorityFixture(); fixture.files[0]!.previous_filename = path; fixture.files[0]!.status = "renamed";
    if (!fixture.baseTree.tree.some(entry => entry.path === path)) {fixture.baseTree.tree.push({ path, mode: "100644", type: "blob", sha: "e".repeat(40) });}
    assert.throws(() => check(fixture), /Protected authority path/u, path);
  }
  const ordinary = authorityFixture(); ordinary.files[0]!.filename = "scripts/ordinary-TEST.mjs"; ordinary.files[0]!.status = "added";
  ordinary.headTree.tree.push({ path: ordinary.files[0]!.filename, mode: "100644", type: "blob", sha: ordinary.files[0]!.sha });
  ordinary.headTree.tree.find(e => e.path === "README.md")!.sha = ordinary.baseTree.tree.find(e => e.path === "README.md")!.sha;
  assert.equal(check(ordinary), "noop");
});

test("rejects mode drift, omitted authority, incomplete trees/pagination and data whose Git identity is unbound", () => {
  const mutations: ((f: ReturnType<typeof authorityFixture>) => void)[] = [
    f => { f.headTree.tree.find(e => e.path === "package.json")!.mode = "120000"; },
    f => { f.headTree.tree.find(e => e.path === "scripts/docs-platform-admission-recovery.mjs")!.sha = "b".repeat(40); },
    f => { f.headTree.tree.push({ path: "scripts/node_modules/TEST.js", mode: "100644", type: "blob", sha: "b".repeat(40) }); },
    f => { f.headTree.truncated = true; }, f => { f.files = []; },
    f => { f.files[0]!.sha = "f".repeat(40); }, f => { f.files[0]!.status = "renamed"; },
    f => { f.headData["package.json"]!.content = Buffer.from("{}").toString("base64"); },
    f => { delete f.headData["pnpm-lock.yaml"]; },
  ];
  for (const mutate of mutations) { const fixture = authorityFixture(); mutate(fixture); assert.throws(() => check(fixture)); }
  assert.throws(() => assertVerifierAuthority(authorityFixture(), Buffer.from("{}"), historicalLockBytes), /Trusted checkout/u);
});

test("copy origins do not declare an omitted source modification", () => {
  const fixture = authorityFixture(), source = "ordinary-source-TEST.md", target = "ordinary-copy-TEST.md", sha = "c".repeat(40);
  fixture.baseTree.tree.push({ path: source, mode: "100644", type: "blob", sha });
  fixture.headTree.tree.push({ path: source, mode: "100644", type: "blob", sha },
    { path: target, mode: "100644", type: "blob", sha });
  fixture.files.push({ filename: target, status: "copied", sha, previous_filename: source });
  fixture.changedFiles = fixture.files.length;
  assert.equal(check(fixture), "noop");
  fixture.headTree.tree.find(entry => entry.path === source)!.sha = "f".repeat(40);
  assert.throws(() => check(fixture), /Unlisted changed Git leaf: ordinary-source-TEST\.md$/u);
  fixture.files.push({ filename: source, status: "modified", sha: "f".repeat(40), previous_filename: undefined });
  fixture.changedFiles = fixture.files.length;
  assert.equal(check(fixture), "noop");
});
