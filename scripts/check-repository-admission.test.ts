import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseDocument } from "yaml";
import {
  ADMISSION_CALLER,
  BOOTSTRAP_GUIDE,
  checkRepositoryAdmission,
  directCommands,
  expandAdmissionScript,
  IDENTITY_REVISION,
  localAdmissionSource,
  MAX_FILE_BYTES,
  renderRepositoryAdmissionCaller,
} from "./check-repository-admission.ts";
import type { AdmissionSource } from "./check-repository-admission.ts";

const revision = "1".repeat(40);
const json = (value: unknown): string => `${JSON.stringify(value)}\n`;
const isData = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const data = (value: unknown): Record<string, unknown> => {
  assert.ok(isData(value));
  return value;
};
const records = (value: unknown): Record<string, unknown>[] => {
  assert.ok(Array.isArray(value));
  return value.map(data);
};
const manifestFrom = (
  files: Map<string, string>,
): Record<string, unknown> & { scripts: Record<string, string> } => {
  const manifest = data(JSON.parse(files.get("package.json") ?? "{}"));
  const scripts = Object.fromEntries(
    Object.entries(data(manifest.scripts)).map(([name, value]) => {
      assert.ok(typeof value === "string");
      return [name, value];
    }),
  );
  return { ...manifest, scripts };
};

void test("reusable workflow executes the exact published central implementation on inert consumer files", async () => {
  const workflow = data(
    parseDocument(
      await readFile(
        new URL("../.github/workflows/repository-admission-check.yml", import.meta.url),
        "utf8",
      ),
    ).toJS({ maxAliasCount: 0 }),
  );
  assert.deepEqual(workflow.on, { workflow_call: null });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const steps = records(data(data(workflow.jobs).admission).steps);
  assert.deepEqual(
    steps.filter((step) => step.run !== undefined).map((step) => step.run),
    [
      "pnpm --dir central install --frozen-lockfile --ignore-scripts --ignore-pnpmfile",
      "node central/scripts/check-repository-admission.ts --root consumer",
    ],
  );
  assert.deepEqual(
    steps
      .filter((step) => typeof step.uses === "string" && step.uses.startsWith("actions/checkout@"))
      .map((step) => step.with),
    [
      { path: "consumer", "persist-credentials": false },
      {
        repository: "${{ job.workflow_repository }}",
        ref: "${{ job.workflow_sha }}",
        path: "central",
        "persist-credentials": false,
      },
    ],
  );
  for (const actionStep of steps.filter((step) => step.uses !== undefined)) {
    assert.ok(typeof actionStep.uses === "string");
    assert.match(actionStep.uses, /@(?!0{40}$)[a-f0-9]{40}$/u);
  }
});

async function fixture(): Promise<{ files: Map<string, string>; source: AdmissionSource }> {
  const files = new Map<string, string>([
    [ADMISSION_CALLER, renderRepositoryAdmissionCaller(revision)],
    [
      ".github/workflows/commit-author-identity.yml",
      (
        await readFile(
          new URL("./fixtures/commit-author-identity-caller.yml", import.meta.url),
          "utf8",
        )
      ).replaceAll("CENTRAL_REVISION", IDENTITY_REVISION),
    ],
    ["AGENTS.md", `Follow ${BOOTSTRAP_GUIDE}\n`],
    ["CLAUDE.md", "@AGENTS.md\n"],
    ["README.md", "Read architecture/profile.json\n"],
    ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"],
    ["docs/adoption.md", "Owner decision: adopt all production modules including this SDK.\n"],
    [
      "package.json",
      json({
        packageManager: "pnpm@11.25.0",
        devDependencies: {
          "@agent-teams/engineering-foundation": "2.1.1",
          "@agent-teams/feature-module-standard": "0.2.3",
        },
        scripts: {
          check:
            "pnpm architecture:features:check && pnpm quality:scope && pnpm quality:typed && pnpm typecheck && pnpm foundation:check && pnpm foundation:dev && pnpm foundation:registry && pnpm test",
          "architecture:features:check": "node tools/check-feature-modules.ts",
          "quality:scope": "agent-teams-foundation quality check --consumer . --scope-only",
          "quality:typed": "agent-teams-foundation quality check --consumer .",
          typecheck: "tsc --project packages/sdk/tsconfig.json",
          "foundation:check": "agent-teams-foundation check",
          "foundation:dev": "agent-teams-foundation assert-dev-only",
          "foundation:registry": "agent-teams-foundation assert-registry",
          test: "node --test packages/sdk/test/features.test.ts",
        },
      }),
    ],
    [
      "foundation.config.yaml",
      json({
        schemaVersion: 2,
        capabilities: {
          "architecture.source-dependencies": { configPath: "architecture/source.yaml" },
          "quality.source-coverage": { configPath: "architecture/coverage.yaml" },
          "quality.suppression-governance": { configPath: "architecture/suppressions.yaml" },
        },
      }),
    ],
    ["architecture/source.yaml", json({ governedRoots: ["packages/sdk/src"] })],
    ["architecture/suppressions.yaml", json({ schemaVersion: 1, suppressions: [] })],
    [
      "architecture/coverage.yaml",
      json({
        sourcePolicyPath: "architecture/source.yaml",
        suppressionPolicyPath: "architecture/suppressions.yaml",
        lintConfigPath: "oxlint.json",
        featureProfilePath: "architecture/profile.json",
        compilerProjects: ["packages/sdk/tsconfig.json"],
        scripts: { full: "check", scope: "quality:scope", typed: "quality:typed" },
      }),
    ],
    [
      "oxlint.json",
      json({
        extends: [
          "./node_modules/@agent-teams/engineering-foundation/presets/oxlint/type-aware.json",
        ],
      }),
    ],
    [
      "packages/sdk/tsconfig.json",
      json({ extends: "../../tsconfig.base.json", include: ["src/**/*.ts"] }),
    ],
    [
      "tsconfig.base.json",
      json({
        compilerOptions: {
          strict: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
        },
      }),
    ],
    [
      "architecture/profile.json",
      json({
        status: "adopted",
        standard: {
          id: "agent-teams.feature-module-standard",
          version: "v1.1",
          repository: "agent-teams-ai/.github",
          commit: revision,
          path: "docs/architecture/feature-module-standard/v1.1.md",
          digest: "sha256:cfa088ef7396139554fe5e3bcc839271b23299c6b60c569a3a7f1cd7c9f0bc6c",
        },
        architectureDocument: "docs/adoption.md",
        decisionRecords: ["docs/adoption.md#decision"],
        productionRoots: ["packages"],
        applicationRoots: [],
        excludedRoots: [],
        extensions: [],
        deviations: [],
        modules: [
          {
            id: "sdk",
            role: "sdk",
            root: "packages/sdk",
            sourceRoot: "packages/sdk/src",
            features: [
              {
                id: "evidence",
                root: "packages/sdk/src/features/evidence",
                layers: [
                  { role: "application", root: "packages/sdk/src/features/evidence/application" },
                ],
              },
            ],
          },
        ],
        enforcementCommands: [
          "pnpm architecture:features:check",
          "pnpm quality:scope",
          "pnpm quality:typed",
          "pnpm check",
        ],
      }),
    ],
    [
      ".github/workflows/checks.yaml",
      json({
        on: { pull_request: null },
        jobs: { check: { "runs-on": "ubuntu-24.04", steps: [{ run: "pnpm check" }] } },
      }),
    ],
  ]);
  return {
    files,
    source: {
      read: async (path) => files.get(path),
      workflows: async () =>
        [...files.keys()].filter((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(path)),
    },
  };
}

void test("complete explicit SDK bootstrap reports configuration only without executing consumer code", async () => {
  const { source } = await fixture();
  const result = await checkRepositoryAdmission(source);
  assert.deepEqual(result.issues, []);
  assert.equal(result.status, "configured_not_qualified");
  assert.equal(result.guide, BOOTSTRAP_GUIDE);
  assert.ok(result.inspected_paths.includes("tsconfig.base.json"));
});

const fixtureDocument = (files: Map<string, string>, path: string) =>
  data(JSON.parse(files.get(path) ?? "{}"));
const fixtureDigest = (files: Map<string, string>, path: string) => {
  const text = files.get(path);
  assert.ok(text !== undefined, `Missing fixture input: ${path}`);
  return createHash("sha256").update(text).digest("hex");
};

function refreshTopologyInputs(files: Map<string, string>): void {
  const topology = fixtureDocument(files, "architecture/topology.json");
  const derivedFrom = records(topology.derivedFrom).map((entry) => {
    assert.ok(typeof entry.path === "string");
    const path = entry.path;
    return { path, sha256: fixtureDigest(files, path) };
  });
  files.set("architecture/topology.json", json({ ...topology, derivedFrom }));
}

async function modernFixture() {
  const original = await fixture();
  const { files } = original;
  const manifest = manifestFrom(files);
  files.set(
    "package.json",
    json({
      ...manifest,
      devDependencies: {
        "@agent-teams/engineering-foundation": "4.0.2",
        "@agent-teams/feature-module-standard": "0.4.3",
        "stack-toolchain": "0.3.1",
      },
      scripts: {
        ...manifest.scripts,
        typecheck: "stack-toolchain typecheck",
        "foundation:check": "agent-teams-foundation check --consumer .",
      },
    }),
  );
  files.set(
    "foundation.config.yaml",
    json({ ...fixtureDocument(files, "foundation.config.yaml"), schemaVersion: 3 }),
  );
  files.set(
    "architecture/coverage.yaml",
    json({
      schemaVersion: 5,
      sourcePolicyPath: "architecture/source.yaml",
      suppressionPolicyPath: "architecture/suppressions.yaml",
      lintConfigPath: "oxlint.json",
      topologyPath: "architecture/topology.json",
      toolchainConfigPath: "toolchain.config.json",
      scripts: { full: "check", scope: "quality:scope", typed: "quality:typed" },
    }),
  );
  files.set(
    "oxlint.json",
    json({ extends: ["./node_modules/stack-toolchain/presets/oxlint/type-aware.json"] }),
  );
  files.set(
    "toolchain.config.json",
    json({
      schemaVersion: 1,
      typecheck: { projects: ["tsconfig.quality.json"] },
      lint: { config: "oxlint.json" },
    }),
  );
  files.set(
    "tsconfig.quality.json",
    json({
      extends: "stack-toolchain/presets/typescript/node.json",
      include: ["packages/**/*.ts"],
    }),
  );
  files.set(
    "architecture/topology.json",
    json({
      schemaVersion: 1,
      censusRoots: ["packages"],
      packageRoots: [".", "packages/sdk"],
      sourceRoots: ["packages/sdk/src"],
      testRoots: ["packages/sdk/test"],
      excludedRoots: [],
      toolingFiles: [],
      derivedFrom: [{ path: "architecture/profile.json" }, { path: "architecture/coverage.yaml" }],
    }),
  );
  refreshTopologyInputs(files);
  return original;
}

void test("reviewed coverage v5 uses one digest-bound FMS profile and Stack-owned aggregate compiler authority", async () => {
  const { files, source } = await modernFixture();
  const accepted = await checkRepositoryAdmission(source);
  assert.deepEqual(accepted.issues, []);
  assert.equal(accepted.status, "configured_not_qualified");
  assert.ok(accepted.inspected_paths.includes("tsconfig.quality.json"));
  assert.ok(!accepted.inspected_paths.includes("packages/sdk/tsconfig.json"));
  const manifest = manifestFrom(files);
  files.set(
    "package.json",
    json({
      ...manifest,
      scripts: {
        ...manifest.scripts,
        typecheck: "stack-toolchain compile --project tsconfig.quality.json",
      },
    }),
  );
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
  files.set(
    "package.json",
    json({
      ...manifest,
      scripts: {
        ...manifest.scripts,
        typecheck: "stack-toolchain typecheck --json --config toolchain.config.json",
      },
    }),
  );
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
  files.set("architecture/profile.json", "\uFEFF" + files.get("architecture/profile.json"));
  assert.ok(
    (await checkRepositoryAdmission(source)).issues.some((entry) =>
      entry.message.includes("derivation bytes do not match"),
    ),
    "A leading BOM changes digest-bound bytes even though JSON parsing accepts it",
  );
  refreshTopologyInputs(files);
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
});

void test("coverage v5 refuses stale, ambiguous or incomplete topology without legacy duplicate authorities", async () => {
  const cases: readonly [string, (files: Map<string, string>) => void, string][] = [
    [
      "stale profile bytes",
      (files) =>
        files.set("architecture/profile.json", files.get("architecture/profile.json") + "\n"),
      "derivation bytes do not match",
    ],
    [
      "stale coverage bytes",
      (files) =>
        files.set("architecture/coverage.yaml", files.get("architecture/coverage.yaml") + "\n"),
      "derivation bytes do not match",
    ],
    [
      "missing FMS binding",
      (files) => {
        const topology = fixtureDocument(files, "architecture/topology.json");
        files.set(
          "architecture/topology.json",
          json({
            ...topology,
            derivedFrom: records(topology.derivedFrom).filter(
              (entry) => entry.path !== "architecture/profile.json",
            ),
          }),
        );
      },
      "exactly one owned FMS",
    ],
    [
      "ambiguous FMS binding",
      (files) => {
        files.set("architecture/second-profile.json", files.get("architecture/profile.json") ?? "");
        const topology = fixtureDocument(files, "architecture/topology.json");
        files.set(
          "architecture/topology.json",
          json({
            ...topology,
            derivedFrom: [
              ...records(topology.derivedFrom),
              {
                path: "architecture/second-profile.json",
                sha256: fixtureDigest(files, "architecture/second-profile.json"),
              },
            ],
          }),
        );
      },
      "exactly one owned FMS",
    ],
    [
      "dropped source root",
      (files) =>
        files.set(
          "architecture/topology.json",
          json({
            ...fixtureDocument(files, "architecture/topology.json"),
            sourceRoots: ["packages/other/src"],
          }),
        ),
      "Each real production module",
    ],
    [
      "dropped package root",
      (files) =>
        files.set(
          "architecture/topology.json",
          json({ ...fixtureDocument(files, "architecture/topology.json"), packageRoots: ["."] }),
        ),
      "Each real production module",
    ],
    [
      "narrowed production census",
      (files) =>
        files.set(
          "architecture/topology.json",
          json({
            ...fixtureDocument(files, "architecture/topology.json"),
            censusRoots: ["packages/sdk"],
          }),
        ),
      "census omits",
    ],
    [
      "excluded production subtree",
      (files) =>
        files.set(
          "architecture/topology.json",
          json({
            ...fixtureDocument(files, "architecture/topology.json"),
            excludedRoots: ["packages/sdk/src/features"],
          }),
        ),
      "Each real production module",
    ],
    [
      "duplicate old compiler authority",
      (files) => {
        files.set(
          "architecture/coverage.yaml",
          json({
            ...fixtureDocument(files, "architecture/coverage.yaml"),
            compilerProjects: ["packages/sdk/tsconfig.json"],
          }),
        );
        refreshTopologyInputs(files);
      },
      "legacy duplicate",
    ],
    [
      "duplicate old FMS authority",
      (files) => {
        files.set(
          "architecture/coverage.yaml",
          json({
            ...fixtureDocument(files, "architecture/coverage.yaml"),
            featureProfilePath: "architecture/profile.json",
          }),
        );
        refreshTopologyInputs(files);
      },
      "legacy duplicate",
    ],
    [
      "different lint authority",
      (files) =>
        files.set(
          "toolchain.config.json",
          json({
            ...fixtureDocument(files, "toolchain.config.json"),
            lint: { config: "unrelated.json" },
          }),
        ),
      "same type-aware",
    ],
  ];
  for (const [label, mutate, diagnostic] of cases) {
    const { files, source } = await modernFixture();
    mutate(files);
    const rejected = await checkRepositoryAdmission(source);
    assert.equal(rejected.status, "incomplete", label);
    assert.ok(
      rejected.issues.some((entry) => entry.message.includes(diagnostic)),
      label,
    );
  }
});

function stackCompileRoute(projects: readonly string[]): string {
  return projects.map((path) => `stack-toolchain compile --project ${path}`).join(" && ");
}

void test("coverage v5 accepts the exact newer LMU graph with all standalone compiler projects", async () => {
  const { files, source } = await modernFixture();
  const manifest = manifestFrom(files);
  const projects = [
    "tsconfig.quality.json",
    "tsconfig.portable.json",
    "tsconfig.tools.json",
    "tsconfig.tests.json",
  ];
  const devDependencies = {
    "@agent-teams/engineering-foundation": "4.0.3",
    "@agent-teams/feature-module-standard": "0.4.4",
    "stack-toolchain": "0.4.0",
  };
  files.set(
    "toolchain.config.json",
    json({
      ...fixtureDocument(files, "toolchain.config.json"),
      typecheck: { projects },
    }),
  );
  for (const path of projects.slice(1)) {
    files.set(path, json({ extends: "./tsconfig.quality.json", include: ["packages/**/*.ts"] }));
  }
  const setManifest = (typecheck: string, graph = devDependencies) => {
    files.set(
      "package.json",
      json({ ...manifest, devDependencies: graph, scripts: { ...manifest.scripts, typecheck } }),
    );
  };
  setManifest(stackCompileRoute(projects));
  const accepted = await checkRepositoryAdmission(source);
  assert.deepEqual(accepted.issues, []);
  assert.equal(accepted.status, "configured_not_qualified");
  for (const path of projects) {
    assert.ok(accepted.inspected_paths.includes(path));
  }
  setManifest("stack-toolchain typecheck");
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
  setManifest(stackCompileRoute(projects.slice(0, -1)));
  assert.ok(
    (await checkRepositoryAdmission(source)).issues.some((entry) =>
      entry.message.includes("actual strict compiler/build"),
    ),
  );

  // Reject every partial upgrade/downgrade, not only an unknown Stack pin.
  const previous = {
    "@agent-teams/engineering-foundation": "4.0.2",
    "@agent-teams/feature-module-standard": "0.4.3",
    "stack-toolchain": "0.3.1",
  };
  const names = [
    "@agent-teams/engineering-foundation",
    "@agent-teams/feature-module-standard",
    "stack-toolchain",
  ] as const;
  for (let mask = 1; mask < 7; mask += 1) {
    const mixed = { ...devDependencies };
    for (const [index, name] of names.entries()) {
      if ((mask & (1 << index)) !== 0) {
        mixed[name] = previous[name];
      }
    }
    setManifest(stackCompileRoute(projects), mixed);
    const rejected = await checkRepositoryAdmission(source);
    assert.equal(rejected.status, "incomplete", JSON.stringify(mixed));
    assert.ok(
      rejected.issues.some((entry) => entry.message.includes("reviewed Foundation")),
      JSON.stringify(mixed),
    );
  }
});

void test("coverage v5 requires the reviewed development graph and effective native compiler route", async () => {
  for (const [name, version] of [
    ["@agent-teams/engineering-foundation", "4.0.1"],
    ["@agent-teams/feature-module-standard", "0.4.2"],
    ["stack-toolchain", "0.1.1"],
    ["stack-toolchain", "^0.3.1"],
    ["stack-toolchain", "0.4.0"],
  ]) {
    assert.ok(name !== undefined);
    const { files, source } = await modernFixture();
    const manifest = manifestFrom(files);
    files.set(
      "package.json",
      json({
        ...manifest,
        devDependencies: { ...data(manifest.devDependencies), [name]: version },
      }),
    );
    assert.ok(
      (await checkRepositoryAdmission(source)).issues.some((entry) =>
        entry.message.includes("reviewed Foundation"),
      ),
    );
  }
  for (const command of [
    "stack-toolchain typecheck --help",
    "stack-toolchain typecheck --config unrelated.json",
    "stack-toolchain compile --project packages/sdk/tsconfig.json",
    "stack-toolchain compile --build tsconfig.build.json",
    "node tools/pretend-build.ts",
  ]) {
    const { files, source } = await modernFixture();
    const manifest = manifestFrom(files);
    files.set(
      "package.json",
      json({ ...manifest, scripts: { ...manifest.scripts, typecheck: command } }),
    );
    assert.ok(
      (await checkRepositoryAdmission(source)).issues.some((entry) =>
        entry.message.includes("actual strict compiler/build"),
      ),
      command,
    );
  }
  for (const compiler of [
    { include: [] },
    { files: [], references: [] },
    { include: ["packages/**/*.ts"], compilerOptions: { skipLibCheck: true } },
    { include: ["packages/**/*.ts"], compilerOptions: { noCheck: true } },
    { include: ["packages/**/*.ts"], compilerOptions: { strict: false } },
  ]) {
    const { files, source } = await modernFixture();
    files.set(
      "tsconfig.quality.json",
      json({ extends: "stack-toolchain/presets/typescript/node.json", ...compiler }),
    );
    assert.ok(
      (await checkRepositoryAdmission(source)).issues.some(
        (entry) => entry.path === "tsconfig.quality.json",
      ),
    );
  }
});

void test("qualified Stack 0.1.1 presets preserve strict admission; spoofed, unpinned or weakened variants fail", async () => {
  const { files, source } = await fixture();
  const manifest = data(JSON.parse(files.get("package.json") ?? "{}"));
  const acceptedManifest = {
    ...manifest,
    devDependencies: { ...data(manifest.devDependencies), "stack-toolchain": "0.1.1" },
  };
  const lint = { extends: ["./node_modules/stack-toolchain/presets/oxlint/type-aware.json"] };
  const compiler = { extends: "stack-toolchain/presets/typescript/node.json" };
  files.set("package.json", json(acceptedManifest));
  files.set("oxlint.json", json(lint));
  files.set("tsconfig.base.json", json(compiler));
  const accepted = await checkRepositoryAdmission(source);
  assert.deepEqual(accepted.issues, []);
  assert.equal(accepted.status, "configured_not_qualified");

  for (const version of [undefined, "0.1.0", "^0.1.1", "0.1.2"]) {
    files.set(
      "package.json",
      json({
        ...acceptedManifest,
        devDependencies: {
          ...data(manifest.devDependencies),
          ...(version === undefined ? {} : { "stack-toolchain": version }),
        },
      }),
    );
    const rejected = await checkRepositoryAdmission(source);
    assert.equal(rejected.status, "incomplete");
    assert.ok(rejected.issues.some((entry) => entry.path === "oxlint.json"));
    assert.ok(rejected.issues.some((entry) => entry.path === "tsconfig.base.json"));
  }
  files.set("package.json", json(acceptedManifest));
  for (const spoof of [
    "./node_modules/stack-toolchain/presets/oxlint/type-aware.json/other",
    "./node_modules/unreviewed-stack/presets/oxlint/type-aware.json",
  ]) {
    files.set("oxlint.json", json({ extends: [spoof] }));
    assert.ok(
      (await checkRepositoryAdmission(source)).issues.some((entry) => entry.path === "oxlint.json"),
    );
  }
  files.set("oxlint.json", json(lint));
  files.set(
    "tsconfig.base.json",
    json({ ...compiler, compilerOptions: { strictNullChecks: false } }),
  );
  assert.ok(
    (await checkRepositoryAdmission(source)).issues.some(
      (entry) => entry.path === "packages/sdk/tsconfig.json",
    ),
  );
  files.set(
    "tsconfig.base.json",
    json({ extends: "stack-toolchain/presets/typescript/unreviewed.json" }),
  );
  assert.ok(
    (await checkRepositoryAdmission(source)).issues.some(
      (entry) => entry.path === "tsconfig.base.json",
    ),
  );
  files.set("tsconfig.base.json", json(compiler));
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    files.set(
      "package.json",
      json({ ...acceptedManifest, [field]: { "stack-toolchain": "0.1.2" } }),
    );
    assert.ok(
      (await checkRepositoryAdmission(source)).issues.some((entry) => entry.path === "oxlint.json"),
      `${field} cannot override a development-only approved Stack pin`,
    );
  }
});

void test("accepted alias policy requires its reviewed caller and rejects broader, predecessor or unreviewed identity pins", async () => {
  const path = ".github/workflows/commit-author-identity.yml";
  const template = await readFile(
    new URL("./fixtures/commit-author-identity-caller.yml", import.meta.url),
    "utf8",
  );
  const reviewed = "77a0f46cbfc7688cbabbe12ee819e50ba6f64234";
  assert.equal(IDENTITY_REVISION, reviewed);
  assert.equal(
    execFileSync(
      "git",
      ["show", `${reviewed}:.github/workflows/commit-author-identity-check.yml`],
      { encoding: "utf8" },
    ),
    await readFile(
      new URL("../.github/workflows/commit-author-identity-check.yml", import.meta.url),
      "utf8",
    ),
  );
  const { files, source } = await fixture();
  files.set(path, template.replaceAll("CENTRAL_REVISION", reviewed));
  const accepted = await checkRepositoryAdmission(source);
  assert.deepEqual(accepted.issues, []);
  assert.equal(accepted.status, "configured_not_qualified");
  for (const pin of [
    "1f8dc7a2ee33e3cc3810f0c4c2d5e9f3f20241d0",
    "6d843f3a2c3f616aa2f4b902a866b1ff1a18f9c6",
    revision,
    "0".repeat(40),
    "main",
  ]) {
    files.set(path, template.replaceAll("CENTRAL_REVISION", pin));
    const rejected = await checkRepositoryAdmission(source);
    assert.equal(rejected.status, "incomplete", pin);
    assert.equal(rejected.guide, BOOTSTRAP_GUIDE);
    assert.ok(
      rejected.issues.some(
        (issue) => issue.path === path && issue.message.includes("trusted implementation pin"),
      ),
      pin,
    );
  }
  files.delete(path);
  const absent = await checkRepositoryAdmission(source);
  assert.equal(absent.status, "incomplete");
  assert.ok(
    absent.issues.some((issue) => issue.path === path && issue.message.includes("missing")),
  );
});

void test("missing root foundation and wholly absent admission caller fail with the canonical guide", async () => {
  const { files, source } = await fixture();
  files.delete("foundation.config.yaml");
  files.delete(ADMISSION_CALLER);
  const result = await checkRepositoryAdmission(source);
  assert.equal(result.status, "incomplete");
  assert.equal(result.guide, BOOTSTRAP_GUIDE);
  assert.ok(
    result.issues.some(
      (issue) => issue.path === "foundation.config.yaml" && issue.message.includes("missing"),
    ),
  );
  assert.ok(
    result.issues.some(
      (issue) => issue.path === ADMISSION_CALLER && issue.message.includes("missing"),
    ),
  );
});

void test("Bun native tests are leaves while explicit bun run references expand package scripts", async () => {
  assert.deepEqual(
    [...expandAdmissionScript("check", { check: "bun run test", test: "bun test" }, "bun")],
    ["bun test"],
  );
  const { files, source } = await fixture();
  const manifest = manifestFrom(files);
  Object.assign(manifest, { packageManager: "bun@1.0.0" });
  for (const [name, command] of Object.entries(manifest.scripts)) {
    manifest.scripts[name] = command.replaceAll("pnpm ", "bun run ");
  }
  manifest.scripts.test = "bun test";
  files.set("package.json", json(manifest));
  const profile = data(JSON.parse(files.get("architecture/profile.json") ?? "{}"));
  assert.ok(Array.isArray(profile.enforcementCommands));
  profile.enforcementCommands = profile.enforcementCommands.map((command) => {
    assert.ok(typeof command === "string");
    return command.replaceAll("pnpm ", "bun run ");
  });
  files.set("architecture/profile.json", json(profile));
  files.set(
    ".github/workflows/checks.yaml",
    json({
      on: { pull_request: null },
      jobs: { check: { "runs-on": "ubuntu-24.04", steps: [{ run: "bun run check" }] } },
    }),
  );
  files.set("bun.lock", "{}\n");
  files.delete("pnpm-lock.yaml");
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
});

void test("known non-main default branches remain explicitly unsupported", async () => {
  const { source } = await fixture();
  const result = await checkRepositoryAdmission({ ...source, defaultBranch: "master" });
  assert.equal(result.status, "unsupported_stack_pending");
  assert.ok(result.issues.some((issue) => issue.message.includes("branch layout")));
});

void test("native no-op, comments and quoted command text cannot establish a gate", async () => {
  for (const command of [
    "# pnpm check\nexit 0",
    "echo pnpm check",
    "true && pnpm check",
    "pnpm check || true",
    "echo 'pnpm check'",
    "if true; then pnpm check; fi",
  ]) {
    assert.deepEqual(directCommands(command), []);
    const { files, source } = await fixture();
    files.set(
      ".github/workflows/checks.yaml",
      json({
        on: { pull_request: null },
        jobs: { check: { "runs-on": "ubuntu-24.04", steps: [{ run: command }] } },
      }),
    );
    assert.ok(
      (await checkRepositoryAdmission(source)).issues.some(
        (issue) => issue.path === ".github/workflows",
      ),
      command,
    );
  }
  assert.deepEqual(directCommands("# documentation\npnpm check"), ["pnpm check"]);
});

void test("conditional PRs, conditional dependencies, absent needs and cycles cannot cover native gates", async () => {
  const setup = { "runs-on": "ubuntu-24.04", steps: [{ run: "node --version" }] };
  const check = { "runs-on": "ubuntu-24.04", needs: "setup", steps: [{ run: "pnpm check" }] };
  const baseline = { on: { pull_request: null }, jobs: { setup, check } };
  const { files, source } = await fixture();
  files.set(".github/workflows/checks.yaml", json(baseline));
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
  const cases = [
    { ...baseline, on: { pull_request: { paths: ["src/**"] } } },
    { ...baseline, jobs: { setup, check: { ...check, if: "github.event_name == 'push'" } } },
    { ...baseline, jobs: { setup: { ...setup, if: "false" }, check } },
    { ...baseline, jobs: { setup, check: { ...check, needs: "missing" } } },
    { ...baseline, jobs: { setup: { ...setup, needs: "check" }, check } },
    {
      ...baseline,
      jobs: { setup, check: { ...check, steps: [{ if: "false", run: "pnpm check" }] } },
    },
    { ...baseline, jobs: { setup, check: { ...check, "continue-on-error": true } } },
    {
      ...baseline,
      jobs: {
        setup,
        check: { ...check, steps: [{ "continue-on-error": true, run: "pnpm check" }] },
      },
    },
  ];
  for (const workflow of cases) {
    files.set(".github/workflows/checks.yaml", json(workflow));
    const result = await checkRepositoryAdmission(source);
    assert.equal(result.status, "incomplete");
    assert.ok(result.issues.some((issue) => issue.path === ".github/workflows"));
  }
});

void test("custom shells and non-failing package-script newlines never count as native gates", async () => {
  const shellFixture = await fixture();
  shellFixture.files.set(
    ".github/workflows/checks.yaml",
    json({
      on: { pull_request: null },
      jobs: {
        check: { "runs-on": "ubuntu-24.04", steps: [{ shell: "echo {0}", run: "pnpm check" }] },
      },
    }),
  );
  assert.equal((await checkRepositoryAdmission(shellFixture.source)).status, "incomplete");
  const newlineFixture = await fixture();
  const manifest = manifestFrom(newlineFixture.files);
  manifest.scripts.check = manifest.scripts.check?.replaceAll(" && ", "\n") ?? "";
  newlineFixture.files.set("package.json", json(manifest));
  assert.equal((await checkRepositoryAdmission(newlineFixture.source)).status, "incomplete");
  for (const [path, text] of [
    [".npmrc", "script-shell=/bin/echo\n"],
    ["pnpm-workspace.yaml", "scriptShell: /bin/echo\n"],
    ["pnpm-workspace.yaml", "shellEmulator: true\n"],
  ]) {
    assert.ok(path !== undefined && text !== undefined);
    const managerFixture = await fixture();
    managerFixture.files.set(path, text);
    assert.ok(
      (await checkRepositoryAdmission(managerFixture.source)).issues.some(
        (issue) => issue.path === path,
      ),
    );
  }
});

void test("compiler probes and disabled checking cannot substitute for production compilation", async () => {
  for (const command of [
    "tsc --version",
    "tsc --help",
    "tsc --showConfig",
    "tsc --listFilesOnly",
    "tsc --build --dry",
    "tsc --build --clean",
    "tsc --noCheck",
    "tsc --project packages/sdk/tsconfig.json --strict false",
  ]) {
    const { files, source } = await fixture();
    const manifest = manifestFrom(files);
    manifest.scripts.typecheck = command;
    files.set("package.json", json(manifest));
    assert.ok(
      (await checkRepositoryAdmission(source)).issues.some((issue) =>
        issue.message.includes("compiler/build"),
      ),
      command,
    );
  }
});

void test("native test and feature help probes cannot replace their actual gates", async () => {
  const { files, source } = await fixture();
  const manifest = manifestFrom(files);
  manifest.scripts.test = "node --test --help";
  manifest.scripts["architecture:features:check"] = "feature-module-standard check --help";
  files.set("package.json", json(manifest));
  const result = await checkRepositoryAdmission(source);
  assert.ok(result.issues.some((issue) => issue.message.includes("actual native tests")));
  assert.ok(result.issues.some((issue) => issue.message.includes("actual deterministic FMS")));
});

void test("duplicate script and needs DAGs have bounded memoized traversal", async () => {
  const moduleUrl = new URL("./check-repository-admission.ts", import.meta.url).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { expandAdmissionScript } from ${JSON.stringify(moduleUrl)};
    const scripts = {};
    for (let i = 0; i < 28; i++) scripts['s' + i] = i === 27 ? 'tsc --project tsconfig.json' : 'pnpm s' + (i + 1) + ' && pnpm s' + (i + 1);
    if (expandAdmissionScript('s0', scripts, 'pnpm').size !== 1) process.exit(1);`,
    ],
    { timeout: 2000, stdio: "pipe" },
  );
  const { files, source } = await fixture();
  const jobs: Record<string, unknown> = {};
  for (let i = 0; i < 28; i++) {
    jobs[`job${i}`] = {
      "runs-on": "ubuntu-24.04",
      ...(i === 0 ? {} : { needs: [`job${i - 1}`, `job${i - 1}`] }),
      steps: i === 27 ? [{ run: "pnpm check" }] : [],
    };
  }
  files.set(".github/workflows/checks.yaml", json({ on: { pull_request: null }, jobs }));
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
});

void test("a legitimate single-package root module maps to its root compiler project", async () => {
  const { files, source } = await fixture();
  const profile = data(JSON.parse(files.get("architecture/profile.json") ?? "{}"));
  const modules = records(profile.modules);
  assert.ok(modules[0]);
  modules[0].root = ".";
  files.set("architecture/profile.json", json(profile));
  assert.deepEqual((await checkRepositoryAdmission(source)).issues, []);
});

void test("canonical callers reject secrets, moving pins and identity template drift", async () => {
  for (const replacement of [
    renderRepositoryAdmissionCaller(revision).replace(revision, "main"),
    `${renderRepositoryAdmissionCaller(revision)}    secrets: inherit\n`,
    renderRepositoryAdmissionCaller(revision).replace(
      "  admission:",
      "  admission:\n    if: false",
    ),
  ]) {
    const { files, source } = await fixture();
    files.set(ADMISSION_CALLER, replacement);
    assert.ok(
      (await checkRepositoryAdmission(source)).issues.some(
        (issue) => issue.path === ADMISSION_CALLER,
      ),
    );
  }
  const { files, source } = await fixture();
  files.set(
    ".github/workflows/commit-author-identity.yml",
    files
      .get(".github/workflows/commit-author-identity.yml")
      ?.replace(IDENTITY_REVISION, revision) ?? "",
  );
  assert.ok(
    (await checkRepositoryAdmission(source)).issues.some(
      (issue) => issue.path === ".github/workflows/commit-author-identity.yml",
    ),
  );
});

void test("compiler weakening and an empty SDK profile remain incomplete", async () => {
  const { files, source } = await fixture();
  files.set("tsconfig.base.json", json({ compilerOptions: { strict: false } }));
  const result = await checkRepositoryAdmission(source);
  assert.ok(
    result.issues.some(
      (issue) => issue.path === "packages/sdk/tsconfig.json" && issue.message.includes("strict"),
    ),
  );
  for (const overrides of [{ noCheck: true }, { strictNullChecks: false }]) {
    files.set(
      "tsconfig.base.json",
      json({
        compilerOptions: {
          strict: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
          ...overrides,
        },
      }),
    );
    assert.ok(
      (await checkRepositoryAdmission(source)).issues.some(
        (issue) =>
          issue.path === "packages/sdk/tsconfig.json" && issue.message.includes("weakening"),
      ),
    );
  }
  files.set("architecture/profile.json", json({ modules: [] }));
  assert.ok(
    (await checkRepositoryAdmission(source)).issues.some((issue) =>
      issue.message.includes("every production module"),
    ),
  );
  assert.throws(
    () => expandAdmissionScript("check", { check: "pnpm alias", alias: "pnpm check" }, "pnpm"),
    /cyclic/u,
  );
});

void test("local reader rejects symlinks, oversized files, invalid UTF-8 and traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "repository-admission-reader-"));
  try {
    await writeFile(join(root, "target"), "inert");
    await writeFile(join(root, "bom"), "\uFEFFinert");
    await symlink(join(root, "target"), join(root, "link"));
    await writeFile(join(root, "large"), Buffer.alloc(MAX_FILE_BYTES + 1));
    await writeFile(join(root, "invalid"), Buffer.from([0xc3, 0x28]));
    execFileSync("mkfifo", [join(root, "fifo")]);
    const source = await localAdmissionSource(root);
    assert.equal(await source.read("target"), "inert");
    assert.equal(
      await source.read("bom"),
      "\uFEFFinert",
      "Byte identity retains a leading UTF-8 BOM",
    );
    for (const path of ["link", "large", "invalid", "../target"]) {
      await assert.rejects(source.read(path));
    }
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { localAdmissionSource } from ${JSON.stringify(new URL("./check-repository-admission.ts", import.meta.url).href)};
      const source = await localAdmissionSource(${JSON.stringify(root)});
      try { await source.read('fifo'); process.exit(1); } catch {}`,
      ],
      { timeout: 2000, stdio: "pipe" },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
