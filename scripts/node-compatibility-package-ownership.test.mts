import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const parserRoot = "tools/node-compatibility-tooling";
const legacyParserRoot = "scripts/node-compatibility-tooling";
const parserBoundaryId = "node-compatibility-tooling";
const foundationCli = join(repositoryRoot, "node_modules/@agent-teams/engineering-foundation/dist/cli.js");
const compilerCli = join(repositoryRoot, "node_modules/typescript/bin/tsc");

interface Boundary {
  id: string;
  dependencyMode: "runtime" | "development";
  roots: string[];
  entrypoints: string[];
  allow: {
    boundaries: string[];
    packages: string[];
    builtins: string[];
    runtimeReferences: string[];
  };
}
interface Policy {
  schemaVersion: 3;
  workspace: { kind: "pnpm"; manifest: "pnpm-workspace.yaml" };
  rootPackage: true;
  packageRoots: string[];
  governedRoots: string[];
  boundaries: Boundary[];
}
interface OwnershipCase {
  name: string;
  expectedStatus: 0 | 1 | 2;
  expectedOutput?: RegExp;
  parserLocation?: string;
  files?: ReadonlyArray<readonly [string, string]>;
  mutate: (policy: Policy) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry: unknown) => typeof entry === "string");
}
function isBoundary(value: unknown): value is Boundary {
  if (!isRecord(value) || !isRecord(value.allow)) { return false; }
  return typeof value.id === "string" &&
    (value.dependencyMode === "runtime" || value.dependencyMode === "development") &&
    isStrings(value.roots) && isStrings(value.entrypoints) &&
    isStrings(value.allow.boundaries) && isStrings(value.allow.packages) &&
    isStrings(value.allow.builtins) && isStrings(value.allow.runtimeReferences);
}
function isPolicy(value: unknown): value is Policy {
  return isRecord(value) && value.schemaVersion === 3 && value.rootPackage === true &&
    isRecord(value.workspace) && value.workspace.kind === "pnpm" &&
    value.workspace.manifest === "pnpm-workspace.yaml" &&
    isStrings(value.packageRoots) && isStrings(value.governedRoots) &&
    Array.isArray(value.boundaries) && value.boundaries.every(isBoundary);
}
function metadataBoundary(root: string): Boundary {
  return {
    id: parserBoundaryId, dependencyMode: "development", roots: [root], entrypoints: [],
    allow: { boundaries: [], packages: [], builtins: [], runtimeReferences: [] },
  };
}
function removeParserGovernance(policy: Policy): void {
  policy.governedRoots = policy.governedRoots.filter(root => root !== parserRoot);
  policy.boundaries = policy.boundaries.filter(boundary => boundary.id !== parserBoundaryId);
}
function legacyLayout(policy: Policy, selectPackage: boolean, governPackage: boolean): void {
  removeParserGovernance(policy);
  policy.packageRoots = selectPackage ? [legacyParserRoot] : [];
  if (governPackage) {
    policy.governedRoots.push(legacyParserRoot);
    policy.boundaries.push(metadataBoundary(legacyParserRoot));
  }
}
function outputOf(result: SpawnSyncReturns<string>): string {
  return result.stdout + result.stderr;
}

async function runFixture(t: TestContext, policy: Policy, scenario: OwnershipCase): Promise<SpawnSyncReturns<string>> {
  const disposable = join(repositoryRoot, ".quality-output/disposable");
  await mkdir(disposable, { recursive: true });
  const root = await mkdtemp(join(disposable, "parser-package-ownership-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file: string, source: string): Promise<void> => {
    const target = join(root, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, source);
  };
  await put("package.json", JSON.stringify({ name: "@agent-teams/ownership-fixture", private: true, type: "module" }));
  await put("pnpm-workspace.yaml", await readFile(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"));
  await put("foundation.config.yaml", await readFile(join(repositoryRoot, "foundation.config.yaml"), "utf8"));
  await put("docs/engineering-quality-source-policy.yaml", stringifyYaml(policy));
  await put("scripts/sample.mjs", "export const value = 1;\n");
  await put("tools/feature-module-standard/check.mjs", "export const value = 1;\n");
  const location = scenario.parserLocation ?? parserRoot;
  for (const name of ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"]) {
    await put(`${location}/${name}`, await readFile(join(repositoryRoot, parserRoot, name), "utf8"));
  }
  for (const [file, source] of scenario.files ?? []) { await put(file, source); }
  const typedFiles = (scenario.files ?? []).map(([file]) => file).filter(file => file.endsWith(".mts"));
  if (typedFiles.length > 0) {
    const typed = spawnSync(process.execPath, [compilerCli,
      "--target", "ES2024", "--module", "NodeNext", "--moduleResolution", "NodeNext",
      "--strict", "--noEmit", "--allowImportingTsExtensions", "--verbatimModuleSyntax",
      "--erasableSyntaxOnly", "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes",
      "--types", "node", ...typedFiles,
    ], { cwd: root, encoding: "utf8", timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
    assert.ifError(typed.error);
    assert.equal(typed.signal, null, outputOf(typed));
    assert.equal(typed.status, 0, outputOf(typed));
  }
  const result = spawnSync(process.execPath, [foundationCli, "check", "architecture.source-dependencies", "--format", "json"], {
    cwd: root, encoding: "utf8", timeout: 30000, maxBuffer: 2 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, outputOf(result));
  return result;
}

test("installed source boundary accepts the relocated passive parser and rejects ownership drift", async t => {
  const decoded: unknown = parseYaml(await readFile(join(repositoryRoot, "docs/engineering-quality-source-policy.yaml"), "utf8"));
  assert.ok(isPolicy(decoded), "fixture requires the checked-in v3 policy contract");
  const acceptedPolicy: Policy = decoded;
  assert.deepEqual(acceptedPolicy.packageRoots, [parserRoot]);
  assert.deepEqual(acceptedPolicy.governedRoots, ["scripts", "tools/feature-module-standard", parserRoot]);
  assert.deepEqual(acceptedPolicy.boundaries.find(boundary => boundary.id === parserBoundaryId), metadataBoundary(parserRoot));
  const cases: OwnershipCase[] = [
    { name: "relocated closed metadata package qualifies", expectedStatus: 0, mutate: () => {} },
    {
      name: "original nested manifest outside packageRoots rejects", expectedStatus: 2,
      parserLocation: legacyParserRoot, expectedOutput: /WORKSPACE_PACKAGE_OUTSIDE_PACKAGE_ROOTS/u,
      mutate: policy => legacyLayout(policy, false, false),
    },
    {
      name: "packageRoots-only repair leaves an uncovered package", expectedStatus: 1,
      parserLocation: legacyParserRoot, expectedOutput: /Workspace package root has no declared governed source root/u,
      mutate: policy => legacyLayout(policy, true, false),
    },
    {
      name: "nested governed parser root overlaps scripts", expectedStatus: 2,
      parserLocation: legacyParserRoot, expectedOutput: /governed roots overlap/iu,
      mutate: policy => legacyLayout(policy, true, true),
    },
    {
      name: "relocated packageRoot omission rejects", expectedStatus: 2,
      expectedOutput: /WORKSPACE_PACKAGE_OUTSIDE_PACKAGE_ROOTS/u,
      mutate: policy => { policy.packageRoots = []; },
    },
    {
      name: "relocated package without owned governance rejects", expectedStatus: 1,
      expectedOutput: /Workspace package root has no declared governed source root/u,
      mutate: removeParserGovernance,
    },
    {
      name: "exact packageRoot rejects neighboring package authority", expectedStatus: 2,
      expectedOutput: /WORKSPACE_PACKAGE_OUTSIDE_PACKAGE_ROOTS/u,
      files: [["tools/unexpected/package.json", JSON.stringify({ name: "unexpected-neighbor", version: "0.0.0", private: true })]],
      mutate: policy => {
        // Observe the same neighboring authority in both selector cases.
        policy.governedRoots.push("tools/unexpected");
        policy.boundaries.push({ ...metadataBoundary("tools/unexpected"), id: "unexpected-neighbor" });
      },
    },
    {
      name: "broadened packageRoot rejects newly selected uncovered neighboring authority", expectedStatus: 1,
      expectedOutput: /Workspace package root has no declared governed source root/u,
      files: [["tools/unexpected/package.json", JSON.stringify({ name: "unexpected-neighbor", version: "0.0.0", private: true })]],
      mutate: policy => { policy.packageRoots = ["tools"]; },
    },
    {
      name: "overlapping boundary roots reject before source evaluation", expectedStatus: 2,
      expectedOutput: /boundary roots overlap/iu,
      mutate: policy => {
        policy.boundaries.push({ ...metadataBoundary("scripts/nested"), id: "overlapping-tooling" });
      },
    },
    {
      name: "one boundary spanning root and parser packages rejects", expectedStatus: 2,
      expectedOutput: /SOURCE_BOUNDARY_SPANS_PACKAGES/u,
      mutate: policy => {
        policy.boundaries = policy.boundaries.filter(boundary => boundary.id !== parserBoundaryId);
        const governance = policy.boundaries.find(boundary => boundary.id === "governance-tooling");
        assert.ok(governance);
        governance.roots.push(parserRoot);
      },
    },
    {
      name: "pure module interpretation preserves the root package owner", expectedStatus: 0,
      files: [
        ["scripts/nested/package.json", JSON.stringify({ type: "module" })],
        ["scripts/nested/sample.mts", "export const value: number = 1;\n"],
      ],
      mutate: () => {},
    },
    {
      name: "nearest package authority fence rejects a root boundary spanning owners", expectedStatus: 2,
      expectedOutput: /SOURCE_BOUNDARY_SPANS_PACKAGES/u,
      files: [
        ["scripts/nested/package.json", JSON.stringify({ name: "nested-tooling-owner", version: "0.0.0", private: true, type: "module" })],
        ["scripts/nested/sample.mts", "export const value: number = 1;\n"],
      ],
      mutate: policy => { policy.packageRoots.push("scripts/nested"); },
    },
    {
      name: "unexpected direct child package remains covered by rejection", expectedStatus: 1,
      expectedOutput: /Workspace package root has no declared governed source root/u,
      files: [[`${parserRoot}/unexpected/package.json`, JSON.stringify({ name: "unexpected-passive-package", version: "0.0.0", private: true })]],
      mutate: () => {},
    },
    {
      name: "typed forbidden import in metadata scope reaches installed parser", expectedStatus: 1,
      expectedOutput: /node:net/u,
      files: [[`${parserRoot}/unexpected.mts`, 'import "node:net";\n']],
      mutate: () => {},
    },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async child => {
      const policy = structuredClone(acceptedPolicy);
      scenario.mutate(policy);
      const result = await runFixture(child, policy, scenario);
      assert.equal(result.status, scenario.expectedStatus, outputOf(result));
      if (scenario.expectedOutput !== undefined) { assert.match(outputOf(result), scenario.expectedOutput); }
    });
  }
});
