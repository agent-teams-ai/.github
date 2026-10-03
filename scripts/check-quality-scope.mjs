import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const SOURCE_SUFFIXES = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"];
const FOUNDATION_PRESET = "./node_modules/@agent-teams/engineering-foundation/presets/oxlint/node.json";
const EXPECTED_SCRIPTS = {
  precheck: "node scripts/check-quality-scope.mjs",
  check: "pnpm quality:lint && pnpm quality:boundaries && pnpm renovate:validate && pnpm governance:validate && pnpm governance:cohorts:append-only && node scripts/check-community-files.mjs && node scripts/check-reviewrouter-workflow.mjs && pnpm test:critical && pnpm test",
  "quality:scope": "node --test scripts/check-quality-scope.test.mjs",
  "quality:lint": "node scripts/run-quality-lint.mjs",
  "quality:check": "pnpm quality:scope && pnpm quality:boundaries && pnpm quality:lint && pnpm test:critical",
  "quality:boundaries": "agent-teams-foundation check architecture.source-dependencies",
  "test:critical": "agent-teams-node-test --contract docs/engineering-quality-required-tests.json -- scripts/check-quality-scope.test.mjs tools/feature-module-standard/check.test.mjs",
  test: "node --test scripts/*.test.mjs tools/feature-module-standard/check.test.mjs",
};

const isTrackedSource = relativePath => SOURCE_SUFFIXES.some(suffix => relativePath.endsWith(suffix));

export function classifySourcePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!isTrackedSource(normalized)) {return "non-source";}
  if (/^scripts\/[^/]+\.test\.mjs$/u.test(normalized) ||
      normalized === "tools/feature-module-standard/check.test.mjs") {return "test";}
  if (/^scripts\/[^/]+\.mjs$/u.test(normalized) ||
      normalized === "tools/feature-module-standard/check.mjs") {return "tooling";}
  return null;
}

export function classifyTrackedPaths(trackedPaths) {
  const classified = [];
  const unclassified = [];
  for (const relativePath of [...new Set(trackedPaths)].toSorted()) {
    const role = classifySourcePath(relativePath);
    if (role === null) {unclassified.push(relativePath);}
    else if (role !== "non-source") {classified.push({ path: relativePath, role });}
  }
  return { classified, unclassified };
}

export function deriveLintPaths(census, profile) {
  return census.classified
    .filter(entry => profile.lint.includedRoles.includes(entry.role))
    .map(entry => entry.path)
    .toSorted();
}

function assertLintPolicy(config) {
  assert.deepEqual(Object.keys(config).toSorted(), ["$schema", "extends", "options"].toSorted(),
    "Oxlint config must contain only schema, one public preset, and suppression options");
  assert.equal(config.$schema, "./node_modules/oxlint/configuration_schema.json");
  assert.deepEqual(config.extends, [FOUNDATION_PRESET], "Foundation public Node preset changed");
  assert.deepEqual(config.options, {
    reportUnusedDisableDirectives: "error",
    respectEslintDisableDirectives: false,
  });
}

function assertWorkflow(workflowText) {
  const workflow = parseYaml(workflowText);
  const steps = workflow?.jobs?.check?.steps;
  assert.ok(Array.isArray(steps), "CI check job steps are missing");
  assert.equal(steps.filter(step => step?.with?.["node-version-file"] === ".node-version").length, 1, "CI must select the owning Node test tooling pin");
  const requiredSteps = steps.filter(step => step?.run === "pnpm check");
  assert.equal(requiredSteps.length, 1, "CI check job must contain exactly one pnpm check step");
  assert.deepEqual(requiredSteps[0], { run: "pnpm check" },
    "pnpm check step cannot be conditional or continue on error");
}

export function assertQualityAdoption({ manifest, profile, lintConfig, trackedPaths, workflow, requiredTests, sourcePolicy, foundationConfig, nodeVersion }) {
  assert.equal(manifest.devDependencies?.["@agent-teams/engineering-foundation"], "1.7.2",
    "Foundation dependency must use the exact released pin");
  assert.equal(manifest.devDependencies?.oxlint, "1.85.0", "Oxlint dependency must use the exact pin");
  for (const [name, command] of Object.entries(EXPECTED_SCRIPTS)) {
    assert.equal(manifest.scripts?.[name], command, `${name} route must stay canonical`);
  }
  assert.deepEqual(profile, {
    schemaVersion: "consumer-quality-profile-v1",
    status: "active-foundation",
    languages: ["javascript"],
    sourceRoots: {
      tooling: ["scripts/**/*.mjs", "tools/feature-module-standard/check.mjs"],
      tests: ["scripts/**/*.test.mjs", "tools/feature-module-standard/check.test.mjs"],
    },
    typedCoverage: false,
    requiredRoute: "pnpm check",
    foundation: { version: "1.7.2", publicPreset: FOUNDATION_PRESET },
    lint: { configPath: "oxlint.json", includedRoles: ["tooling"] },
    toolchain: { node: "24.21.0", pnpm: "11.18.0", oxlint: "1.85.0" },
  }, "quality profile changed");
  assert.deepEqual(requiredTests, {
  "schemaVersion": 1,
  "required": [
    {
      "file": "scripts/check-quality-scope.test.mjs",
      "names": [
        "actual repository adopts the Foundation preset through the canonical route"
      ],
      "kind": "test"
    },
    {
      "file": "scripts/check-quality-scope.test.mjs",
      "names": [
        "actual tracked source census distinguishes tooling, tests, and authority data"
      ],
      "kind": "test"
    },
    {
      "file": "scripts/check-quality-scope.test.mjs",
      "names": [
        "actual derived tooling paths exactly match Oxlint debug selection"
      ],
      "kind": "test"
    },
    {
      "file": "tools/feature-module-standard/check.test.mjs",
      "names": [
        "accepts the checked-in immutable Feature Module Standard"
      ],
      "kind": "test"
    },
    {
      "file": "tools/feature-module-standard/check.test.mjs",
      "names": [
        "rejects digest, path, marker, and manifest-shape drift"
      ],
      "kind": "test"
    },
    {
      "file": "tools/feature-module-standard/check.test.mjs",
      "names": [
        "allows append-only successors but rejects mutation or removal"
      ],
      "kind": "test"
    },
    {
      "file": "scripts/check-quality-scope.test.mjs",
      "names": [
        "installed source boundary rejects missing inputs and governed dist source"
      ],
      "kind": "test"
    },
    {
      "file": "scripts/check-quality-scope.test.mjs",
      "names": [
        "installed mandatory runner rejects omitted and skipped identities with exact OS exceptions"
      ],
      "kind": "test"
    }
  ],
  "exceptions": []
}, "mandatory test inventory must retain exact identities and files");
  assert.deepEqual(sourcePolicy, {
  "schemaVersion": 3,
  "workspace": {
    "kind": "pnpm",
    "manifest": "pnpm-workspace.yaml"
  },
  "rootPackage": true,
  "packageRoots": [],
  "governedRoots": [
    "scripts",
    "tools/feature-module-standard"
  ],
  "boundaries": [
    {
      "id": "governance-tooling",
      "dependencyMode": "development",
      "roots": [
        "scripts"
      ],
      "entrypoints": [],
      "allow": {
        "boundaries": [
          "feature-module-standard"
        ],
        "packages": [
          "ajv",
          "yaml"
        ],
        "builtins": [
          "node:assert/strict",
          "node:child_process",
          "node:crypto",
          "node:fs",
          "node:fs/promises",
          "node:os",
          "node:path",
          "node:test",
          "node:url",
          "node:util",
          "node:vm",
          "node:zlib"
        ],
        "runtimeReferences": [
          "commonjs",
          "dynamic"
        ]
      }
    },
    {
      "id": "feature-module-standard",
      "dependencyMode": "development",
      "roots": [
        "tools/feature-module-standard"
      ],
      "entrypoints": [
        "tools/feature-module-standard/check.mjs"
      ],
      "allow": {
        "boundaries": [],
        "packages": [],
        "builtins": [
          "node:assert/strict",
          "node:child_process",
          "node:crypto",
          "node:fs",
          "node:fs/promises",
          "node:os",
          "node:path",
          "node:test",
          "node:url",
          "node:util"
        ],
        "runtimeReferences": []
      }
    }
  ]
}, "source boundaries must retain every declared tooling root");
  assert.deepEqual(foundationConfig, {
  "schemaVersion": 2,
  "project": {
    "id": "organization-governance"
  },
  "capabilities": {
    "architecture.source-dependencies": {
      "configPath": "docs/engineering-quality-source-policy.yaml"
    }
  }
}, "installed source gate configuration changed");
  assert.equal(nodeVersion.trim(), "24.21.0", "owning test tooling lane must use Node 24.21.0");
  assert.equal(manifest.engines?.node, ">=24.18.0 <25", "general Node 24 compatibility must remain independent of critical execution tooling");
  assertLintPolicy(lintConfig);
  assertWorkflow(workflow);
  const census = classifyTrackedPaths(trackedPaths);
  assert.deepEqual(census.unclassified, [], `unclassified executable source: ${census.unclassified.join(", ")}`);
  assert.ok(census.classified.some(entry => entry.role === "tooling"), "tooling census is empty");
  assert.ok(census.classified.some(entry => entry.role === "test"), "test census is empty");
  return census;
}

export async function readQualityAdoption(base = root) {
  const readJson = async relativePath => JSON.parse(await readFile(new URL(relativePath, base), "utf8"));
  const cwd = path.dirname(fileURLToPath(new URL("package.json", base)));
  const { stdout } = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd, encoding: "utf8" });
  return {
    manifest: await readJson("package.json"),
    profile: await readJson("docs/engineering-quality-profile.json"),
    lintConfig: await readJson("oxlint.json"),
    requiredTests: await readJson("docs/engineering-quality-required-tests.json"),
    sourcePolicy: parseYaml(await readFile(new URL("docs/engineering-quality-source-policy.yaml", base), "utf8")),
    foundationConfig: parseYaml(await readFile(new URL("foundation.config.yaml", base), "utf8")),
    trackedPaths: stdout.split("\0").filter(Boolean),
    nodeVersion: await readFile(new URL(".node-version", base), "utf8"),
    workflow: await readFile(new URL(".github/workflows/ci.yml", base), "utf8"),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const census = assertQualityAdoption(await readQualityAdoption());
  const counts = Object.fromEntries(["tooling", "test"].map(role => [
    role,
    census.classified.filter(entry => entry.role === role).length,
  ]));
  process.stdout.write(`central quality scope verified: ${JSON.stringify(counts)}\n`);
}
