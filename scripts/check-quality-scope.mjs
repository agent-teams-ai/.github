import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { runCommand } from "stack-toolchain";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const SOURCE_SUFFIXES = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"];
const FOUNDATION_PRESET = "./node_modules/stack-toolchain/presets/oxlint/node.json";
const EXPECTED_SCRIPTS = {
  precheck: "node scripts/check-quality-scope.mjs",
  check:
    "pnpm quality:lint && pnpm quality:boundaries && pnpm quality:typecheck && pnpm format:check && pnpm renovate:validate && pnpm governance:validate && pnpm governance:cohorts:append-only && node scripts/check-community-files.mjs && node scripts/check-reviewrouter-workflow.mjs && pnpm test:critical && pnpm test",
  "quality:scope": "node --test scripts/check-quality-scope.test.mjs",
  "quality:lint": "node scripts/run-quality-lint.mjs",
  "quality:check":
    "pnpm quality:scope && pnpm quality:boundaries && pnpm quality:lint && pnpm quality:typecheck && pnpm format:check && pnpm test:input-proof && pnpm test:critical",
  "quality:boundaries": "agent-teams-foundation check architecture.source-dependencies",
  "test:critical":
    "agent-teams-node-test --contract docs/engineering-quality-required-tests.json -- scripts/check-quality-scope.test.mjs tools/feature-module-standard/check.test.mjs",
  "quality:typecheck": "stack-toolchain typecheck",
  "format:check": "stack-toolchain format:check",
  "quality:doctor": "stack-toolchain doctor --json",
  "test:input-proof": "node --test scripts/qualification-input-proof.test.mts",
  test: "node scripts/run-governance-tests.ts",
};

const isTrackedSource = (relativePath) =>
  SOURCE_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));

export function classifySourcePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!isTrackedSource(normalized)) {
    return "non-source";
  }
  if (
    /^scripts\/[^/]+\.test\.(?:mjs|mts|ts)$/u.test(normalized) ||
    normalized === "tools/feature-module-standard/check.test.mjs"
  ) {
    return "test";
  }
  if (
    /^scripts\/[^/]+\.(?:mjs|mts|ts)$/u.test(normalized) ||
    normalized === "tools/feature-module-standard/check.mjs"
  ) {
    return "tooling";
  }
  return null;
}

export function classifyTrackedPaths(trackedPaths) {
  const classified = [];
  const unclassified = [];
  for (const relativePath of [...new Set(trackedPaths)].toSorted((left, right) =>
    String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
  )) {
    const role = classifySourcePath(relativePath);
    if (role === null) {
      unclassified.push(relativePath);
    } else if (role !== "non-source") {
      classified.push({ path: relativePath, role });
    }
  }
  return { classified, unclassified };
}

export function deriveLintPaths(census, profile) {
  return census.classified
    .filter(
      (entry) =>
        !profile.retainedAuthoritySources.some((authority) => authority.path === entry.path) &&
        (profile.lint.includedRoles.includes(entry.role) ||
          profile.lint.includedExtensions.some((suffix) => entry.path.endsWith(suffix))),
    )
    .map((entry) => entry.path)
    .toSorted((left, right) =>
      String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
    );
}

const RETAINED_AUTHORITY_SOURCES = [
  {
    path: "scripts/check-docs-source-successor-v1.mts",
    gitBlob: "36cb752a50b8a0d7f83c813ed17cec775cdd79bb",
  },
  {
    path: "scripts/check-docs-source-successor-v1.test.mts",
    gitBlob: "281032ebb0afecd5bb425f7f4018c99b20ee6635",
  },
  {
    path: "scripts/check-docs-verifier-authority.mts",
    gitBlob: "55c462acdc808bff8b032dce9819de48a02e5e3b",
  },
  {
    path: "scripts/check-docs-verifier-authority.test.mts",
    gitBlob: "c34697abc079e0a161fb3872a8a9acb07e951ded",
  },
];

const FORMAT_RETAINED_AUTHORITY_SOURCES = [
  {
    path: "scripts/verify-docs-admission-change.mjs",
    gitBlob: "f3db341a5d9fc5ec74c9c3379153940db99177c0",
  },
];

export function deriveFormatPaths(trackedPaths) {
  const source = trackedPaths.filter(
    (relativePath) =>
      !RETAINED_AUTHORITY_SOURCES.some((entry) => entry.path === relativePath) &&
      !FORMAT_RETAINED_AUTHORITY_SOURCES.some((entry) => entry.path === relativePath) &&
      (/^scripts\/[^/]+\.(?:mjs|mts|ts)$/u.test(relativePath) ||
        /^tools\/feature-module-standard\/[^/]+\.(?:mjs|mts|ts)$/u.test(relativePath)),
  );
  return [
    ...new Set([
      ...source,
      "package.json",
      "toolchain.config.json",
      "oxlint.json",
      "tsconfig.json",
      "tsconfig.tooling.json",
      "foundation.config.yaml",
      "pnpm-workspace.yaml",
      "docs/engineering-quality-profile.json",
      "docs/engineering-quality-source-policy.yaml",
      "docs/engineering-quality.md",
      ".github/workflows/docs-protocol-check.yml",
      "docs/governance/docs-gen3-current-policy-mapping.md",
      "governance/docs-protocol-policy-v2.schema.json",
    ]),
  ].toSorted((left, right) =>
    String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
  );
}

function assertLintPolicy(config) {
  assert.deepEqual(
    Object.keys(config).toSorted((left, right) =>
      String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
    ),
    ["extends", "options"].toSorted((left, right) =>
      String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
    ),
    "Oxlint config must contain only one public preset and suppression options",
  );
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
  assert.equal(
    steps.filter((step) => step?.with?.["node-version-file"] === ".node-version").length,
    1,
    "CI must select the owning Node test tooling pin",
  );
  const requiredSteps = steps.filter((step) => step?.run === "pnpm check");
  assert.equal(requiredSteps.length, 1, "CI check job must contain exactly one pnpm check step");
  assert.deepEqual(
    requiredSteps[0],
    { run: "pnpm check" },
    "pnpm check step cannot be conditional or continue on error",
  );
}

const STACK_TOOLS = ["typescript", "bun", "tsrs", "oxlint", "oxlint-tsgolint", "oxfmt"];

function insideInstallation(directory, filename) {
  const relative = path.relative(directory, filename);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function assertStackBinding(manifest, installed, doctor) {
  const pin = manifest.devDependencies?.["stack-toolchain"];
  assert.equal(typeof pin, "string", "Stack requires one root development pin");
  assert.match(
    pin,
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u,
    "Stack pin must be a canonical stable registry triplet",
  );
  for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    assert.ok(
      !Object.hasOwn(manifest[section] ?? {}, "stack-toolchain"),
      "duplicate Stack dependency declaration",
    );
  }
  for (const section of ["bundledDependencies", "bundleDependencies"]) {
    assert.ok(
      !manifest[section]?.includes("stack-toolchain"),
      "bundled Stack declaration is unsupported",
    );
  }
  assert.ok(
    installed &&
      installed.nodeModulesRoot === path.join(installed.consumerRoot, "node_modules") &&
      insideInstallation(installed.nodeModulesRoot, installed.packagePath),
    "Stack package must resolve inside physical consumer node_modules",
  );
  assert.ok(
    insideInstallation(path.dirname(installed.packagePath), installed.manifestPath),
    "Stack manifest escaped its package",
  );
  assert.equal(
    installed.package?.name,
    "stack-toolchain",
    "installed Stack package identity changed",
  );
  assert.equal(installed.package.version, pin, "installed Stack differs from the root pin");
  const tools = installed.toolManifest;
  assert.deepEqual(
    Object.keys(tools ?? {}).toSorted(),
    ["schemaVersion", ...STACK_TOOLS].toSorted(),
    "unsupported Stack manifest fields",
  );
  assert.equal(tools.schemaVersion, 1, "unsupported Stack manifest schema");
  for (const tool of STACK_TOOLS) {
    assert.equal(typeof tools[tool], "string", "Stack manifest tool pin is absent");
    assert.match(
      tools[tool],
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u,
      "invalid Stack manifest tool pin",
    );
  }
  assert.equal(doctor?.command, "doctor", "Stack doctor observation is absent");
  assert.equal(doctor.exitCode, 0, "Stack doctor rejected the installed companion graph");
  assert.equal(doctor.status, "passed", "Stack doctor must succeed");
  assert.equal(doctor.details?.schemaVersion, 1, "unsupported Stack doctor schema");
  assert.equal(doctor.details.packageVersion, pin, "Stack doctor observed another package");
  assert.deepEqual(doctor.versions, tools, "Stack doctor observed another manifest");
  assert.ok(
    Array.isArray(doctor.details.findings) &&
      !doctor.details.findings.some((finding) => finding.severity === "error"),
    "Stack doctor reported companion errors",
  );
}

export async function readStackInstallation(base = root) {
  const require = createRequire(new URL("package.json", base));
  const consumerRoot = await realpath(fileURLToPath(base));
  const nodeModulesRoot = path.join(consumerRoot, "node_modules");
  assert.equal(
    await realpath(nodeModulesRoot),
    nodeModulesRoot,
    "consumer node_modules root must be physical",
  );
  const packagePath = await realpath(require.resolve("stack-toolchain/package.json"));
  const manifestPath = await realpath(require.resolve("stack-toolchain/toolchain-manifest.json"));
  assert.ok(
    insideInstallation(nodeModulesRoot, packagePath),
    "Stack resolved outside consumer node_modules",
  );
  assert.ok(
    insideInstallation(path.dirname(packagePath), manifestPath),
    "Stack manifest escaped its package",
  );
  return {
    consumerRoot,
    nodeModulesRoot,
    packagePath,
    manifestPath,
    package: JSON.parse(await readFile(packagePath, "utf8")),
    toolManifest: JSON.parse(await readFile(manifestPath, "utf8")),
  };
}

export function assertQualityAdoption({
  manifest,
  workspacePolicy,
  stackInstallation,
  stackDoctor,
  profile,
  lintConfig,
  trackedPaths,
  workflow,
  requiredTests,
  sourcePolicy,
  foundationConfig,
  nodeVersion,
  toolingTsconfig,
  toolchainConfig,
  lintTsconfig,
  formatterIgnores,
  gitignore,
  retainedAuthorityBlobs,
  formatRetainedAuthorityBlobs,
}) {
  assert.equal(
    manifest.devDependencies?.["@agent-teams/engineering-foundation"],
    "3.0.0",
    "Foundation dependency must use the exact released pin",
  );
  assertStackBinding(manifest, stackInstallation, stackDoctor);
  assert.deepEqual(
    workspacePolicy.allowBuilds,
    { bun: false, "core-js-pure": false, "dtrace-provider": false, re2: true },
    "Bun build must be explicitly denied; retain existing build decisions",
  );
  for (const field of [
    "ignoreScripts",
    "dangerouslyAllowAllBuilds",
    "strictDepBuilds",
    "onlyBuiltDependencies",
    "ignoredBuiltDependencies",
  ]) {
    assert.equal(
      workspacePolicy[field],
      undefined,
      "Do not bypass or replace explicit dependency build policy",
    );
  }
  assert.equal(manifest.devDependencies?.oxlint, undefined, "Stack owns the installed linter pin");
  assert.equal(
    manifest.devDependencies?.["node-or-bun"],
    "0.2.1",
    "process runtime dependency must use the exact released pin",
  );
  assert.equal(
    manifest.devDependencies?.typescript,
    undefined,
    "Stack owns the installed compiler pin",
  );
  assert.equal(
    manifest.devDependencies?.["@types/node"],
    "24.19.1",
    "tooling types must stay in the Node 24 family",
  );
  for (const [name, command] of Object.entries(EXPECTED_SCRIPTS)) {
    assert.equal(manifest.scripts?.[name], command, `${name} route must stay canonical`);
  }
  assert.deepEqual(
    profile,
    {
      schemaVersion: "consumer-quality-profile-v1",
      status: "active-foundation",
      languages: ["javascript", "typescript"],
      sourceRoots: {
        tooling: [
          "scripts/**/*.mjs",
          "scripts/**/*.mts",
          "scripts/**/*.ts",
          "tools/feature-module-standard/check.mjs",
        ],
        tests: [
          "scripts/**/*.test.mjs",
          "scripts/**/*.test.mts",
          "scripts/**/*.test.ts",
          "tools/feature-module-standard/check.test.mjs",
        ],
      },
      typedCoverage: false,
      retainedAuthoritySources: RETAINED_AUTHORITY_SOURCES,
      formatRetainedAuthoritySources: FORMAT_RETAINED_AUTHORITY_SOURCES,
      requiredRoute: "pnpm check",
      foundation: { version: "3.0.0", publicPreset: FOUNDATION_PRESET },
      lint: {
        configPath: "oxlint.json",
        includedRoles: ["tooling"],
        includedExtensions: [".mts", ".ts"],
      },
      typedTooling: {
        configPath: "tsconfig.tooling.json",
        command: "pnpm quality:typecheck",
        compilerManifest: "stack-toolchain/toolchain-manifest.json",
        nodeTypes: "24.19.1",
        entryFiles: [
          "scripts/qualification-input-proof.mts",
          "scripts/qualification-input-proof.test.mts",
          "scripts/check-docs-verifier-authority.mts",
          "scripts/check-docs-verifier-authority.test.mts",
          "scripts/npm-publish.test.mts",
          "scripts/quality-process.ts",
          "scripts/quality-process.test.ts",
          "scripts/run-governance-tests.ts",
          "scripts/run-governance-tests.test.ts",
        ],
      },
      toolchain: {
        node: "26.11.1",
        pnpm: "11.18.0",
        package: "stack-toolchain",
        dependencyPath: "devDependencies.stack-toolchain",
        configPath: "toolchain.config.json",
      },
    },
    "quality profile changed",
  );
  assert.deepEqual(
    toolingTsconfig,
    {
      compilerOptions: {
        target: "ES2024",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        erasableSyntaxOnly: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        types: ["node"],
      },
      include: [
        "scripts/qualification-input-proof.mts",
        "scripts/qualification-input-proof.test.mts",
        "scripts/check-docs-verifier-authority.mts",
        "scripts/check-docs-verifier-authority.test.mts",
        "scripts/npm-publish.test.mts",
        "scripts/quality-process.ts",
        "scripts/quality-process.test.ts",
        "scripts/run-governance-tests.ts",
        "scripts/run-governance-tests.test.ts",
      ],
    },
    "strict compiler scope and settings must stay exact",
  );
  assert.deepEqual(
    requiredTests,
    {
      schemaVersion: 1,
      required: [
        {
          file: "scripts/check-quality-scope.test.mjs",
          names: ["actual repository adopts the Foundation preset through the canonical route"],
          kind: "test",
        },
        {
          file: "scripts/check-quality-scope.test.mjs",
          names: ["actual tracked source census distinguishes tooling, tests, and authority data"],
          kind: "test",
        },
        {
          file: "scripts/check-quality-scope.test.mjs",
          names: ["actual derived tooling paths exactly match Oxlint debug selection"],
          kind: "test",
        },
        {
          file: "tools/feature-module-standard/check.test.mjs",
          names: ["accepts the checked-in immutable Feature Module Standard"],
          kind: "test",
        },
        {
          file: "tools/feature-module-standard/check.test.mjs",
          names: ["rejects digest, path, marker, and manifest-shape drift"],
          kind: "test",
        },
        {
          file: "tools/feature-module-standard/check.test.mjs",
          names: ["allows append-only successors but rejects mutation or removal"],
          kind: "test",
        },
        {
          file: "scripts/check-quality-scope.test.mjs",
          names: ["installed source boundary rejects missing inputs and governed dist source"],
          kind: "test",
        },
        {
          file: "scripts/check-quality-scope.test.mjs",
          names: [
            "installed mandatory runner rejects omitted and skipped identities with exact OS exceptions",
          ],
          kind: "test",
        },
      ],
      exceptions: [],
    },
    "mandatory test inventory must retain exact identities and files",
  );
  assert.deepEqual(
    sourcePolicy,
    {
      schemaVersion: 3,
      workspace: {
        kind: "pnpm",
        manifest: "pnpm-workspace.yaml",
      },
      rootPackage: true,
      packageRoots: [],
      governedRoots: ["scripts", "tools/feature-module-standard"],
      boundaries: [
        {
          id: "governance-tooling",
          dependencyMode: "development",
          roots: ["scripts"],
          entrypoints: [],
          allow: {
            boundaries: ["feature-module-standard"],
            packages: [
              "@agent-teams/ci-input-proof",
              "ajv",
              "node-or-bun",
              "stack-toolchain",
              "yaml",
            ],
            builtins: [
              "node:assert/strict",
              "node:child_process",
              "node:crypto",
              "node:fs",
              "node:fs/promises",
              "node:module",
              "node:os",
              "node:path",
              "node:test",
              "node:test/reporters",
              "node:url",
              "node:util",
              "node:vm",
              "node:zlib",
            ],
            runtimeReferences: ["commonjs", "dynamic"],
          },
        },
        {
          id: "feature-module-standard",
          dependencyMode: "development",
          roots: ["tools/feature-module-standard"],
          entrypoints: ["tools/feature-module-standard/check.mjs"],
          allow: {
            boundaries: [],
            packages: [],
            builtins: [
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
            ],
            runtimeReferences: [],
          },
        },
      ],
    },
    "source boundaries must retain every declared tooling root",
  );
  assert.deepEqual(
    foundationConfig,
    {
      schemaVersion: 2,
      project: {
        id: "organization-governance",
      },
      capabilities: {
        "architecture.source-dependencies": {
          configPath: "docs/engineering-quality-source-policy.yaml",
        },
      },
    },
    "installed source gate configuration changed",
  );
  assert.equal(nodeVersion.trim(), "26.11.1", "owning test tooling lane must use Node 26.11.1");
  assert.equal(
    manifest.engines?.node,
    ">=24.18.0 <25 || >=26.10.0 <27",
    "package engines must keep Node 24 compatibility and admit the Node 26 default",
  );
  assertLintPolicy(lintConfig);
  assertWorkflow(workflow);
  const census = classifyTrackedPaths(trackedPaths);
  assert.deepEqual(
    census.unclassified,
    [],
    `unclassified executable source: ${census.unclassified.join(", ")}`,
  );
  assert.ok(
    census.classified.some((entry) => entry.role === "tooling"),
    "tooling census is empty",
  );
  assert.ok(
    census.classified.some((entry) => entry.role === "test"),
    "test census is empty",
  );
  assert.deepEqual(
    retainedAuthorityBlobs,
    RETAINED_AUTHORITY_SOURCES,
    "retained authority sources must keep exact independent blobs",
  );
  assert.deepEqual(
    formatRetainedAuthorityBlobs,
    FORMAT_RETAINED_AUTHORITY_SOURCES,
    "format-only retained authority must keep exact independent blobs",
  );
  assert.equal(
    gitignore,
    "node_modules/\n",
    "review formatter scope before changing repository ignores",
  );
  assert.deepEqual(
    trackedPaths
      .filter((source) =>
        /(?:^|\/)(?:\.gitignore|\.oxlintignore|\.prettierignore|\.oxfmtignore)$/u.test(source),
      )
      .toSorted(),
    [".gitignore"],
    "nested ignores must not hide lint or formatter inputs",
  );
  assert.deepEqual(
    formatterIgnores,
    [undefined, undefined],
    "formatter ignores must not hide maintained inputs",
  );
  assert.deepEqual(
    lintTsconfig,
    { extends: "./tsconfig.tooling.json" },
    "typed lint must discover the same strict program",
  );
  assert.deepEqual(
    toolchainConfig,
    {
      schemaVersion: 1,
      profile: "typescript-node",
      typecheck: { projects: ["tsconfig.tooling.json"] },
      lint: { config: "oxlint.json", paths: deriveLintPaths(census, profile) },
      format: { paths: deriveFormatPaths(trackedPaths) },
    },
    "Stack must retain the independent checked census and exact compiler project",
  );
  return census;
}

async function readRetainedAuthorityBlobs(entries, base) {
  return Promise.all(
    entries.map(async ({ path: sourcePath }) => {
      const source = new URL(sourcePath, base);
      const info = await lstat(source);
      assert.ok(
        info.isFile() && !info.isSymbolicLink(),
        "retained authority source must be a regular file",
      );
      const bytes = await readFile(source);
      return {
        path: sourcePath,
        gitBlob: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"),
      };
    }),
  );
}

export async function readQualityAdoption(base = root) {
  const readJson = async (relativePath) =>
    JSON.parse(await readFile(new URL(relativePath, base), "utf8"));
  const cwd = path.dirname(fileURLToPath(new URL("package.json", base)));
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd, encoding: "utf8" },
  );
  return {
    manifest: await readJson("package.json"),
    workspacePolicy: parseYaml(await readFile(new URL("pnpm-workspace.yaml", base), "utf8")),
    stackInstallation: await readStackInstallation(base),
    stackDoctor: await runCommand({
      command: "doctor",
      cwd,
      signal: new AbortController().signal,
      budgetMs: 30_000,
    }),
    profile: await readJson("docs/engineering-quality-profile.json"),
    lintConfig: await readJson("oxlint.json"),
    toolingTsconfig: await readJson("tsconfig.tooling.json"),
    toolchainConfig: await readJson("toolchain.config.json"),
    lintTsconfig: await readJson("tsconfig.json"),
    gitignore: await readFile(new URL(".gitignore", base), "utf8"),
    retainedAuthorityBlobs: await readRetainedAuthorityBlobs(RETAINED_AUTHORITY_SOURCES, base),
    formatRetainedAuthorityBlobs: await readRetainedAuthorityBlobs(
      FORMAT_RETAINED_AUTHORITY_SOURCES,
      base,
    ),
    formatterIgnores: await Promise.all(
      [".prettierignore", ".oxfmtignore"].map((name) =>
        readFile(new URL(name, base), "utf8").catch((error) => {
          if (error.code === "ENOENT") {
            return;
          }
          throw error;
        }),
      ),
    ),
    requiredTests: await readJson("docs/engineering-quality-required-tests.json"),
    sourcePolicy: parseYaml(
      await readFile(new URL("docs/engineering-quality-source-policy.yaml", base), "utf8"),
    ),
    foundationConfig: parseYaml(await readFile(new URL("foundation.config.yaml", base), "utf8")),
    trackedPaths: stdout.split("\0").filter(Boolean),
    nodeVersion: await readFile(new URL(".node-version", base), "utf8"),
    workflow: await readFile(new URL(".github/workflows/ci.yml", base), "utf8"),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const census = assertQualityAdoption(await readQualityAdoption());
  const counts = Object.fromEntries(
    ["tooling", "test"].map((role) => [
      role,
      census.classified.filter((entry) => entry.role === role).length,
    ]),
  );
  process.stdout.write(`central quality scope verified: ${JSON.stringify(counts)}\n`);
}
