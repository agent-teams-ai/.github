import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

// Central policy: fixed current verifier inputs, not a package graph or merge authority.
const protectedPaths = [
  ...["ci", "commit-author-identity", "commit-author-identity-check", "docs-authority-evolution",
    "docs-cohort-authority-evolution-v8", "docs-cohort-append-only", "docs-admission-evidence",
    "docs-admission-authority-evolution-v1", "docs-protocol-check"].map(name => `.github/workflows/${name}.yml`),
  ...["check-docs-verifier-authority.mts", "check-docs-verifier-authority.test.mts",
    "docs-cohort-authority-evolution-v8.test.mjs", "check-cohort-append-only.mjs",
    "check-cohort-emergency-append.mjs", "check-community-files.mjs", "docs-cohort-policy.mjs",
    "governance-policy.mjs", "validate-governance.mjs", "verify-docs-cohort-evidence.mjs",
    "verify-docs-admission-change.mjs", "verify-docs-consumer-gate.mjs",
    "verify-docs-qualification-receipt.mjs", "verify-docs-cohort-v2-receipt.mjs",
    "docs-legacy-admission-recovery.mjs", "docs-platform-admission-recovery.mjs",
    "verify-docs-platform-recovery-installation-r317.mjs", "check-quality-scope.mjs",
    "run-quality-lint.mjs"].map(name => `scripts/${name}`),
  ...["actions-policy", "code-security-defaults", "docs-protocol-policy", "docs-protocol-policy-v2",
    "docs-protocol-exceptions", "docs-qualified-cohorts", "executable-spec-qualification",
    "organization-repository-inventory"].map(name => `governance/${name}.schema.json`),
  "governance/docs-protocol-policy.json", "governance/docs-admission-recovery.json",
  "governance/docs-platform-admission-recovery.json", "governance/commit-author-identity.json",
  ".node-version", ".npmrc", "pnpm-workspace.yaml", "foundation.config.yaml", "oxlint.json",
  "tsconfig.tooling.json", "docs/engineering-quality-profile.json",
  "docs/engineering-quality-source-policy.yaml", "docs/engineering-quality-required-tests.json",
];
// New authority introduced after the historical fixtures. Its addition, removal
// or mutation still requires a reviewed source cutover; old trees may lack it.
const laterProtectedPaths = ["governance/repository-registration-supplements.schema.json",
  "scripts/governance-schema.ts", "scripts/repository-registration.ts", "scripts/repository-bootstrap-observation.ts",
  "scripts/check-repository-admission.ts", "scripts/observe-org-repository-inventory.mjs",
  ".github/workflows/organization-inventory-drift.yml", "scripts/fixtures/commit-author-identity-caller.yml",
  ".github/workflows/repository-admission-check.yml", "scripts/compiler-floor.ts",
  "scripts/validate-renovate.ts", ".github/workflows/node24-compatibility.yml"];
const installerNames = new Set(["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc",
  ".pnpmfile.cjs", ".pnpmfile.mjs", ".node-version", ".nvmrc", ".yarnrc", ".yarnrc.yml",
  "yarn.lock", "package-lock.json", "npm-shrinkwrap.json"]);
const closure = ["ajv@8.20.0", "yaml@2.9.0", "fast-deep-equal@3.1.3", "fast-uri@3.1.5",
  "json-schema-traverse@1.0.0", "require-from-string@2.0.2"];
// Operator binding: agent-teams-ai/.github#359, reviewed head 2a443681de099040f744f3cb28c35722bb97f2b1.
// The installer's rebased commit SHA is intentionally not authority; these reviewed blobs bind content.
const node26DefaultTransition = Object.freeze({
  source: Object.freeze({ repository: "agent-teams-ai/.github", pullRequest: 359, reviewedHead: "2a443681de099040f744f3cb28c35722bb97f2b1" }),
  changes: Object.freeze([
    [".node-version", "df6ae3370f9f89272d88629c442cf554d6c1f9fb", "d8750199bbef3481a89eaf452088c384f4025508"],
    ["AGENTS.md", "5103769cb5f5f26438b15c5ce11b1234f505a748", "d31e50aa17c1cb2008fd87191ffceec5d421ab0a"],
    ["docs/engineering-quality-profile.json", "3a7f60d0af07bbbdf9b742bba39894f7deaf078e", "93a1b876c19153c51fad0a03d9fa331034cd8cea"],
    ["docs/engineering-quality.md", "7edd8695a2e06d609336e73e1f861d46b2b65b46", "2368570df3db82c664ad59426a40b7f832191ab2"],
    ["package.json", "75e4d98b44aa0f777cc03c57857e1e023ec6c1b0", "51f9bfb4bf250acd795f4bb2384f9b58132e24ae"],
    ["scripts/check-quality-scope.mjs", "3dc6329177e56aea18c13fe8e59ad8e4c6a671e3", "18588dc80475e459ccd784c9af25312585ce4c40"],
    ["scripts/check-quality-scope.test.mjs", "3a025636bcfd0e1796695b5b0ad0b5f398b2709b", "4e7a343ddddcda2326ad761c056a1ba61059f9ab"],
    ["scripts/merge-owner-pr.test.mjs", "34adcaee7d8bc85698fecdeb59cb882bccdcdaaa", "e3afa253f69e77021bce4f77a7e5bee70064653c"],
  ] as const),
});
const oid = /^(?!0{40}$)[0-9a-f]{40}$/u;
const validPath = (value: unknown): value is string => typeof value === "string" && value.length <= 4096 &&
  !/[\\\0]/u.test(value) && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
const object = (value: unknown): Record<string, unknown> => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected a complete mapping");
  return value as Record<string, unknown>;
};
const without = (value: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const gitBlob = (bytes: Buffer): string => createHash("sha1")
  .update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

function assertVerifierDependencyPolicy(baseManifest: string, baseLock: string, headManifest: string, headLock: string,
  node26Default: boolean): void {
  const manifest = [baseManifest, headManifest].map(text => object(JSON.parse(text)));
  const locks = [baseLock, headLock].map(text => {
    const doc = parseDocument(text, { uniqueKeys: true });
    assert.equal(doc.errors.length, 0, "Malformed lockfile");
    return object(doc.toJS({ maxAliasCount: 0 }));
  });
  const [before, after] = manifest;
  const [oldLock, newLock] = locks;
  assert.ok(before && after && oldLock && newLock);
  if (node26Default) {
    const oldEngines = object(before.engines), newEngines = object(after.engines);
    assert.deepEqual(without(after, ["devDependencies", "engines"]), without(before, ["devDependencies", "engines"]),
      "Node26-default manifest policy changed");
    assert.deepEqual(without(newEngines, ["node"]), without(oldEngines, ["node"]), "Node26-default engine policy changed");
    assert.equal(oldEngines.node, ">=24.18.0 <25", "Unexpected Node26-default source engine");
    assert.equal(newEngines.node, ">=24.18.0 <25 || >=26.10.0 <27", "Unexpected Node26-default target engine");
    assert.deepEqual(after.devDependencies, before.devDependencies, "Node26-default verifier dependencies changed");
    assert.equal(headLock, baseLock, "Node26-default lock changed");
    assert.deepEqual(newLock, oldLock, "Node26-default lock changed");
  } else {
    assert.deepEqual(without(after, ["devDependencies"]), without(before, ["devDependencies"]), "Manifest policy/native routes changed");
  }
  assert.deepEqual(without(newLock, ["importers", "packages", "snapshots"]),
    without(oldLock, ["importers", "packages", "snapshots"]), "Lock globals changed");
  const importers = locks.map(lock => object(lock.importers));
  for (const importer of importers) {assert.deepEqual(Object.keys(importer), ["."], "Only the root importer is admitted");}
  const roots = importers.map(importer => object(importer["."]));
  assert.deepEqual(without(roots[1]!, ["devDependencies"]), without(roots[0]!, ["devDependencies"]), "Importer policy changed");
  for (const name of ["ajv", "yaml"]) {
    assert.equal(object(after.devDependencies)[name], object(before.devDependencies)[name], "Verifier manifest binding changed");
    assert.ok(object(before.devDependencies)[name], "Missing verifier manifest binding");
    const binding = object(roots[0]!.devDependencies)[name];
    assert.ok(binding, "Missing verifier importer binding");
    assert.deepEqual(object(roots[1]!.devDependencies)[name], binding, "Verifier importer binding changed");
    assert.deepEqual(binding, { specifier: name === "ajv" ? "8.20.0" : "2.9.0", version: name === "ajv" ? "8.20.0" : "2.9.0" });
  }
  for (const key of closure) {for (const section of ["packages", "snapshots"]) {
    const original: unknown = object(oldLock[section])[key];
    object(original); // Missing records must not compare equal to other missing records.
    assert.deepEqual(object(newLock[section])[key], original, `Verifier ${section} record changed: ${key}`);
  }}
  const deps = object(after.devDependencies), bindings = object(roots[1]!.devDependencies);
  assert.deepEqual(Object.keys(deps).toSorted(), Object.keys(bindings).toSorted(), "Unbound development dependency");
  for (const [name, specifier] of Object.entries(deps)) {
    assert.match(name, /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u, "Invalid registry package name");
    assert.ok(typeof specifier === "string" && /^[~^]?\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/u.test(specifier), "Only registry development dependencies are admitted");
    const binding = object(bindings[name]);
    assert.deepEqual(Object.keys(binding).toSorted(), ["specifier", "version"], "Unsupported importer binding policy");
    assert.equal(binding.specifier, specifier, "Manifest/importer mismatch");
    assert.ok(typeof binding.version === "string" && Object.hasOwn(object(newLock.snapshots), `${name}@${binding.version}`), "Missing root snapshot");
    assert.ok(Object.hasOwn(object(newLock.packages), `${name}@${binding.version.split("(")[0]}`), "Missing root package record");
  }
  // No local paths, tarballs or alternate transports may enter the future base install.
  for (const [key, value] of Object.entries(object(newLock.packages))) {
    assert.match(key, /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+@\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\(.+\))?$/u, "Non-registry package");
    const resolution = object(object(value).resolution);
    assert.deepEqual(Object.keys(resolution), ["integrity"], "Non-registry resolution");
    assert.ok(typeof resolution.integrity === "string" && /^sha512-[A-Za-z0-9+/]{86}==$/u.test(resolution.integrity), "Missing registry integrity");
  }
}

export function assertVerifierDependencies(baseManifest: string, baseLock: string, headManifest: string, headLock: string): void {
  assertVerifierDependencyPolicy(baseManifest, baseLock, headManifest, headLock, false);
}

const exactEntry = (entry: Record<string, unknown> | undefined, path: string, sha: string) =>
  entry?.path === path && entry.mode === "100644" && entry.type === "blob" && entry.sha === sha;

function matchesNode26DefaultTransition(base: Map<string, Record<string, unknown>>, head: Map<string, Record<string, unknown>>,
  files: Record<string, unknown>[], changedLeaves: Set<string>): boolean {
  const expectedPaths = node26DefaultTransition.changes.map(([path]) => path);
  if (files.length !== expectedPaths.length || changedLeaves.size !== expectedPaths.length ||
      expectedPaths.some(path => !changedLeaves.has(path))) {return false;}
  return node26DefaultTransition.changes.every(([path, before, after]) => {
    const file = files.find(candidate => candidate.filename === path);
    return file !== undefined && file.status === "modified" && file.previous_filename === undefined &&
      file.sha === after && exactEntry(base.get(path), path, before) && exactEntry(head.get(path), path, after);
  });
}

export function assertVerifierAuthority(raw: unknown, baseManifest: Buffer, baseLock: Buffer):
  "noop" | "dependencies" | "node26-default" {
  const evidence = object(raw);
  assert.ok(Number.isSafeInteger(evidence.changedFiles) && Number(evidence.changedFiles) >= 1 && Number(evidence.changedFiles) <= 3000, "Invalid changed_files");
  const trees = [evidence.baseTree, evidence.headTree].map(rawTree => {
    const tree = object(rawTree);
    assert.equal(tree.truncated, false, "Incomplete Git tree");
    assert.ok(Array.isArray(tree.tree), "Missing Git tree");
    const entries = new Map<string, Record<string, unknown>>();
    for (const rawEntry of tree.tree) {
      const entry = object(rawEntry);
      assert.ok(validPath(entry.path) && typeof entry.sha === "string" && oid.test(entry.sha) &&
        typeof entry.type === "string" && typeof entry.mode === "string" &&
        (entry.type === "blob" ? ["100644", "100755", "120000"].includes(entry.mode) :
          entry.type === "tree" ? entry.mode === "040000" : entry.type === "commit" && entry.mode === "160000"), "Malformed Git entry");
      assert.ok(!entries.has(entry.path), "Duplicate Git entry");
      entries.set(entry.path, entry);
    }
    return entries;
  });
  const [base, head] = trees;
  assert.ok(base && head);
  assert.ok(Array.isArray(evidence.files) && evidence.files.length === evidence.changedFiles, "Incomplete pagination");
  const changedLeaves = new Set<string>();
  for (const path of new Set([...base.keys(), ...head.keys()])) {
    const oldEntry = base.get(path), newEntry = head.get(path);
    const oldLeaf = oldEntry?.type === "tree" ? undefined : oldEntry;
    const newLeaf = newEntry?.type === "tree" ? undefined : newEntry;
    if (oldLeaf?.sha !== newLeaf?.sha || oldLeaf?.mode !== newLeaf?.mode || oldLeaf?.type !== newLeaf?.type) {
      changedLeaves.add(path);
    }
  }
  const node26Default = matchesNode26DefaultTransition(base, head, evidence.files.map(rawFile => object(rawFile)), changedLeaves);
  const node26Paths = new Set<string>(node26DefaultTransition.changes.map(([path]) => path));
  const filenames = new Set<string>();
  const declared = new Set<string>();
  for (const rawFile of evidence.files) {
    const file = object(rawFile);
    assert.ok(validPath(file.filename) && !filenames.has(file.filename) &&
      typeof file.sha === "string" && oid.test(file.sha), "Malformed or duplicate changed file");
    filenames.add(file.filename);
    assert.ok(["added", "modified", "removed", "renamed", "copied", "changed"].includes(String(file.status)), "Missing file status");
    assert.ok(file.previous_filename === undefined || validPath(file.previous_filename), "Invalid rename origin");
    assert.ok(file.status !== "renamed" || file.previous_filename !== undefined, "Missing rename origin");
    const origin = String(file.previous_filename ?? file.filename);
    declared.add(file.filename); if (file.status === "renamed") {declared.add(origin);}
    for (const path of [file.filename, origin]) {
      assert.ok((node26Default && node26Paths.has(path)) || (!protectedPaths.includes(path) && !laterProtectedPaths.includes(path) &&
        !path.split("/").includes("node_modules") &&
        (!(installerNames.has(path.split("/").at(-1)!)) || ["package.json", "pnpm-lock.yaml"].includes(path))),
      `Protected authority path: ${path}`);
    }
    const oldEntry = base.get(origin), newEntry = head.get(file.filename);
    assert.ok(file.status === "added" || oldEntry, "Missing base file");
    assert.ok(file.status === "removed" ? oldEntry?.sha === file.sha && !newEntry : newEntry?.sha === file.sha, "Unbound changed-file blob");
    if (file.status === "added") {assert.ok(!base.has(file.filename) && file.previous_filename === undefined, "Inconsistent added-file metadata");}
    if (["modified", "removed", "changed"].includes(String(file.status))) {assert.equal(file.previous_filename, undefined, "Unexpected rename metadata");}
    if (file.status === "renamed") {assert.ok(origin !== file.filename && !head.has(origin), "Incomplete rename metadata");}
  }
  for (const path of changedLeaves) {assert.ok(declared.has(path), `Unlisted changed Git leaf: ${path}`);}
  for (const path of protectedPaths) {
    assert.ok(base.has(path), `Missing protected input: ${path}`);
    if (!node26Default || !node26Paths.has(path)) {
      assert.deepEqual(head.get(path), base.get(path), `Protected input changed: ${path}`);
    }
    assert.equal(base.get(path)!.mode, "100644", `Protected input must be regular: ${path}`);
  }
  for (const path of laterProtectedPaths) {
    assert.deepEqual(head.get(path), base.get(path), `Protected input changed: ${path}`);
    if (base.has(path)) {
      assert.equal(base.get(path)!.type, "blob", `Protected input must be a blob: ${path}`);
      assert.equal(base.get(path)!.mode, "100644", `Protected input must be regular: ${path}`);
    }
  }
  // Optional installer controls and shadow paths are protected even if pagination omits them.
  for (const path of new Set([...base.keys(), ...head.keys()])) {
    if (path.split("/").includes("node_modules") || installerNames.has(path.split("/").at(-1)!)) {
      if (!["package.json", "pnpm-lock.yaml"].includes(path) && !(node26Default && path === ".node-version")) {
        assert.deepEqual(head.get(path), base.get(path), `Install authority changed: ${path}`);
      }
    }
  }
  const sources = [baseManifest, baseLock];
  const headSources = ["package.json", "pnpm-lock.yaml"].map((path, i) => {
    for (const tree of trees) {assert.ok(tree.get(path)?.type === "blob" && tree.get(path)?.mode === "100644", "Install data must be regular");}
    assert.equal(gitBlob(sources[i]!), base.get(path)!.sha, "Trusted checkout does not match base");
    const blob = object(object(evidence.headData)[path]);
    assert.ok(typeof blob.content === "string" && blob.content.length <= 3 * 1024 * 1024 && blob.encoding === "base64", "Missing or oversized head data");
    const bytes = Buffer.from(blob.content, "base64");
    assert.ok(bytes.length <= (i === 0 ? 65536 : 2 * 1024 * 1024), "Oversized head install data");
    assert.equal(gitBlob(bytes), head.get(path)!.sha, "Head Git blob mismatch");
    assert.equal(blob.sha, head.get(path)!.sha, "Unbound head data");
    return bytes.toString("utf8");
  });
  assertVerifierDependencyPolicy(baseManifest.toString("utf8"), baseLock.toString("utf8"), headSources[0]!, headSources[1]!, node26Default);
  if (node26Default) {return "node26-default";}
  return ["package.json", "pnpm-lock.yaml"].some(path => base.get(path)!.sha !== head.get(path)!.sha) ? "dependencies" : "noop";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [evidence, manifest, lock] = await Promise.all([
    readFile(process.argv[2]!, "utf8"), readFile("package.json"), readFile("pnpm-lock.yaml"),
  ]);
  console.log(`Docs verifier authority: ${assertVerifierAuthority(JSON.parse(evidence), manifest, lock)}`);
}
