import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse, stringify } from "yaml";
import { assertVerifierAuthority, assertVerifierDependencies } from "./check-docs-verifier-authority.mts";

const manifestBytes = readFileSync("package.json"), lockBytes = readFileSync("pnpm-lock.yaml");
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
  const tree = execFileSync("git", ["ls-tree", "-r", "HEAD"], { encoding: "utf8" }).trim().split("\n").map(line => {
    const [header, path] = line.split("\t"); const [mode, type, sha] = header!.split(" ");
    return { path: path!, mode: mode!, type: type!, sha: sha! };
  });
  for (const path of ["scripts/check-docs-verifier-authority.mts", "scripts/check-docs-verifier-authority.test.mts"]) {
    if (!tree.some(entry => entry.path === path)) {tree.push({ path, mode: "100644", type: "blob", sha: "e".repeat(40) });}
  }
  const files = [{ filename: "README.md", status: "modified", sha: "d".repeat(40), previous_filename: undefined as string | undefined }];
  const headTree = structuredClone(tree); headTree.find(entry => entry.path === "README.md")!.sha = files[0]!.sha;
  const headData = Object.fromEntries(["package.json", "pnpm-lock.yaml"].map(path => [path, {
    encoding: "base64", content: readFileSync(path).toString("base64"), sha: tree.find(entry => entry.path === path)!.sha,
  }]));
  return { changedFiles: 1, files, baseTree: { tree, truncated: false }, headTree: { tree: headTree, truncated: false }, headData };
}
const check = (evidence: unknown) => assertVerifierAuthority(evidence, manifestBytes, lockBytes);
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
  assert.throws(() => assertVerifierAuthority(authorityFixture(), Buffer.from("{}"), lockBytes), /Trusted checkout/u);
});
