import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { assertCompilerFloor, CompilerFloorError } from "./compiler-floor.ts";

const foundationPath = "node_modules/@agent-teams/engineering-foundation";
const extractorPath = `${foundationPath}/node_modules/@microsoft/api-extractor`;
type Manifest = { name: string; version: string; dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>; exports?: Record<string, string> };

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "central-compiler-floor-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (relative: string, value: Manifest): Promise<void> => {
    const path = join(root, relative, "package.json");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({ ...value, main: "index.js" }));
    // A JavaScript module trap proves that metadata validation never executes a dependency.
    await writeFile(join(dirname(path), "index.js"), 'throw new Error("implementation must not execute");\n');
  };
  await writeFile(join(root, "package.json"), '{"private":true}\n');
  await put("node_modules/typescript", { name: "typescript", version: "7.0.2" });
  await put(foundationPath, { name: "@agent-teams/engineering-foundation", version: "1.7.2",
    dependencies: { "@microsoft/api-extractor": "7.58.12" } });
  await put(extractorPath, { name: "@microsoft/api-extractor", version: "7.58.12", dependencies: { typescript: "7.0.2" } });
  await put(`${extractorPath}/node_modules/typescript`, { name: "typescript", version: "7.0.2" });
  return { root, put };
}

async function nativeFixture(root: string, put: (relative: string, value: Manifest) => Promise<void>): Promise<void> {
  const compilerPath = `${foundationPath}/node_modules/typescript`;
  const nativeName = `@typescript/typescript-${process.platform}-${process.arch}`;
  await put(foundationPath, { name: "@agent-teams/engineering-foundation", version: "1.7.2",
    dependencies: { typescript: "7.0.2", "@microsoft/api-extractor-model": "7.33.10", "@microsoft/tsdoc": "0.16.0" } });
  await put(compilerPath, { name: "typescript", version: "7.0.2",
    optionalDependencies: { [nativeName]: "7.0.2" },
    exports: { "./package.json": "./package.json", "./unstable/async": "./async.js", "./unstable/ast": "./ast.js" } });
  for (const entry of ["async", "ast"]) {
    await writeFile(join(root, compilerPath, `${entry}.js`), 'throw new Error("implementation must not execute");\n');
  }
  await put(`${compilerPath}/node_modules/${nativeName}`, { name: nativeName, version: "7.0.2" });
  await put(`${foundationPath}/node_modules/@microsoft/api-extractor-model`, { name: "@microsoft/api-extractor-model", version: "7.33.10" });
  await put(`${foundationPath}/node_modules/@microsoft/tsdoc`, { name: "@microsoft/tsdoc", version: "0.16.0" });
}

function rejects(root: string, role: string, reason: string, observedVersion?: string): void {
  assert.throws(() => assertCompilerFloor(root), cause => {
    assert.ok(cause instanceof CompilerFloorError);
    assert.equal(cause.diagnostic.code, "TYPESCRIPT_COMPILER_FLOOR_BLOCKED");
    assert.equal(cause.diagnostic.minimumVersion, "7.0.2");
    assert.equal(cause.diagnostic.role, role);
    assert.equal(cause.diagnostic.reason, reason);
    if (observedVersion !== undefined) { assert.equal(cause.diagnostic.observedVersion, observedVersion); }
    return true;
  });
}

test("compiler preflight reads inert owner manifests without executing dependency modules", async t => {
  const { root, put } = await fixture(t);
  await nativeFixture(root, put);
  assert.doesNotThrow(() => assertCompilerFloor(root));
});

for (const version of ["5.9.3", "7.0.1"]) {
  test(`compiler preflight rejects workspace TypeScript ${version}`, async t => {
    const { root, put } = await fixture(t);
    await put("node_modules/typescript", { name: "typescript", version });
    rejects(root, "repository.compiler", "compiler-below-floor", version);
  });
}

test("compiler preflight follows the extractor owner instead of substituting the workspace compiler", async t => {
  const { root, put } = await fixture(t);
  await put(`${extractorPath}/node_modules/typescript`, { name: "typescript", version: "5.9.3" });
  rejects(root, "foundation.api-extractor.compiler", "compiler-below-floor", "5.9.3");
});

test("compiler preflight checks a Foundation-owned compiler when declared", async t => {
  const { root, put } = await fixture(t);
  await put(foundationPath, { name: "@agent-teams/engineering-foundation", version: "1.7.2",
    dependencies: { "@microsoft/api-extractor": "7.58.12", typescript: "5.9.3" } });
  await put(`${foundationPath}/node_modules/typescript`, { name: "typescript", version: "5.9.3" });
  rejects(root, "foundation.compiler", "compiler-below-floor", "5.9.3");
});

for (const version of ["7.0.2-rc.1", "7.0", "not-a-version", "9007199254740992.0.0"]) {
  test(`compiler preflight refuses unsupported compiler metadata ${version}`, async t => {
    const { root, put } = await fixture(t);
    await put("node_modules/typescript", { name: "typescript", version });
    rejects(root, "repository.compiler", version.includes("9007") ? "compiler-below-floor" : "manifest-identity-invalid");
  });
}

for (const version of ["7.0.3", "7.1.0", "8.0.0"]) {
  test(`compiler preflight admits stable compiler ${version}`, async t => {
    const { root, put } = await fixture(t);
    await nativeFixture(root, put);
    await put("node_modules/typescript", { name: "typescript", version });
    assert.doesNotThrow(() => assertCompilerFloor(root));
  });
}

test("compiler preflight rejects compiler identity substitution", async t => {
  const { root, put } = await fixture(t);
  await put("node_modules/typescript", { name: "different-package", version: "7.0.2" });
  rejects(root, "repository.compiler", "manifest-identity-invalid");
});

test("compiler preflight fails closed on a missing or malformed owner manifest", async t => {
  const { root } = await fixture(t);
  const path = join(root, extractorPath, "package.json");
  await writeFile(path, "{broken");
  rejects(root, "foundation.api-extractor", "manifest-unavailable");
  await rm(path);
  rejects(root, "foundation.api-extractor", "manifest-unavailable");
});

test("compiler preflight retains exact dependency-owner pins", async t => {
  const { root, put } = await fixture(t);
  await put(extractorPath, { name: "@microsoft/api-extractor", version: "7.59.4", dependencies: { typescript: "7.0.2" } });
  rejects(root, "foundation", "dependency-pin-mismatch", "7.59.4");
  await put(extractorPath, { name: "@microsoft/api-extractor", version: "7.58.12", dependencies: { typescript: "^7.0.2" } });
  rejects(root, "foundation.api-extractor", "dependency-pin-mismatch", "7.0.2");
});

test("compiler preflight refuses a legacy extractor even when its compiler satisfies the floor", async t => {
  const { root } = await fixture(t);
  rejects(root, "foundation.api-extractor", "legacy-extractor-dependency");
});

test("compiler preflight binds the native compiler and compiler-free model closure", async t => {
  const nativeName = `@typescript/typescript-${process.platform}-${process.arch}`;
  const compilerPath = `${foundationPath}/node_modules/typescript`;
  const modelPath = `${foundationPath}/node_modules/@microsoft/api-extractor-model`;
  const cases: readonly [string, string, Manifest, string, string][] = [
    ["overridden direct compiler", compilerPath, { name: "typescript", version: "7.1.0" }, "foundation", "dependency-pin-mismatch"],
    ["platform version mismatch", `${compilerPath}/node_modules/${nativeName}`, { name: nativeName, version: "7.1.0" }, "foundation.native.compiler", "native-compiler-pin-mismatch"],
    ["platform alias", `${compilerPath}/node_modules/${nativeName}`, { name: "typescript", version: "7.0.2" }, "foundation.native.compiler", "manifest-identity-invalid"],
    ["missing platform pin", compilerPath, { name: "typescript", version: "7.0.2" }, "foundation.native.compiler", "native-compiler-pin-mismatch"],
    ["missing direct compiler pin", foundationPath, { name: "@agent-teams/engineering-foundation", version: "1.7.2",
      dependencies: { "@microsoft/api-extractor-model": "7.33.10", "@microsoft/tsdoc": "0.16.0" } }, "foundation", "dependency-pin-mismatch"],
    ["aliased direct compiler", foundationPath, { name: "@agent-teams/engineering-foundation", version: "1.7.2",
      dependencies: { typescript: "npm:typescript@7.0.2" } }, "foundation", "dependency-pin-mismatch"],
    ["model alias", modelPath, { name: "other", version: "7.33.10" }, "foundation.api-model", "manifest-identity-invalid"],
    ["overridden model", modelPath, { name: "@microsoft/api-extractor-model", version: "7.34.0" }, "foundation", "dependency-pin-mismatch"],
    ["model compiler", modelPath, { name: "@microsoft/api-extractor-model", version: "7.33.10", dependencies: { typescript: "5.9.3" } }, "foundation.api-model", "mixed-model-compiler-dependency"],
    ["model extractor", modelPath, { name: "@microsoft/api-extractor-model", version: "7.33.10", dependencies: { "@microsoft/api-extractor": "7.58.12" } }, "foundation.api-model", "mixed-model-compiler-dependency"],
  ];
  for (const [name, path, manifest, role, reason] of cases) {
    await t.test(name, async context => {
      const { root, put } = await fixture(context);
      await nativeFixture(root, put);
      await put(path, manifest);
      rejects(root, role, reason);
    });
  }
  for (const entry of ["async", "ast"]) {
    await t.test(`missing native ${entry} API`, async context => {
      const { root, put } = await fixture(context);
      await nativeFixture(root, put);
      await rm(join(root, compilerPath, `${entry}.js`));
      rejects(root, "foundation.compiler", "native-compiler-api-unavailable");
    });
  }
  await t.test("missing native platform package", async context => {
    const { root, put } = await fixture(context);
    await nativeFixture(root, put);
    await rm(join(root, compilerPath, "node_modules", nativeName), { recursive: true });
    rejects(root, "foundation.native.compiler", "manifest-unavailable");
  });
});

test("compiler preflight precedes every existing public Foundation command route", async () => {
  const value: unknown = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(typeof value === "object" && value !== null && "scripts" in value);
  const scripts = value.scripts;
  assert.ok(typeof scripts === "object" && scripts !== null);
  for (const name of ["precheck", "quality:boundaries", "test:critical"]) {
    assert.ok(name in scripts);
    const command: unknown = Reflect.get(scripts, name);
    assert.ok(typeof command === "string" && command.startsWith("node scripts/compiler-floor.ts && "));
  }
});
