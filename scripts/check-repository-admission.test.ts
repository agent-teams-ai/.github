import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ADMISSION_CALLER, BOOTSTRAP_GUIDE, checkRepositoryAdmission, directCommands, expandAdmissionScript, IDENTITY_REVISION, localAdmissionSource, MAX_FILE_BYTES, renderRepositoryAdmissionCaller } from "./check-repository-admission.ts";
import type { AdmissionSource } from "./check-repository-admission.ts";

const revision = "1".repeat(40);
const json = (value: unknown): string => `${JSON.stringify(value)}\n`;

async function fixture(): Promise<{ files: Map<string, string>; source: AdmissionSource }> {
  const files = new Map<string, string>([
    [ADMISSION_CALLER, renderRepositoryAdmissionCaller(revision)],
    [".github/workflows/commit-author-identity.yml", (await readFile(new URL("./fixtures/commit-author-identity-caller.yml", import.meta.url), "utf8")).replaceAll("CENTRAL_REVISION", IDENTITY_REVISION)],
    ["AGENTS.md", `Follow ${BOOTSTRAP_GUIDE}\n`],
    ["CLAUDE.md", "@AGENTS.md\n"],
    ["README.md", "Read architecture/profile.json\n"],
    ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"],
    ["docs/adoption.md", "Owner decision: adopt all production modules including this SDK.\n"],
    ["package.json", json({ packageManager: "pnpm@11.25.0", devDependencies: { "@agent-teams/engineering-foundation": "2.1.1", "@agent-teams/feature-module-standard": "0.2.3" }, scripts: {
      check: "pnpm architecture:features:check && pnpm quality:scope && pnpm quality:typed && pnpm typecheck && pnpm foundation:check && pnpm foundation:dev && pnpm foundation:registry && pnpm test",
      "architecture:features:check": "node tools/check-feature-modules.ts",
      "quality:scope": "agent-teams-foundation quality check --consumer . --scope-only",
      "quality:typed": "agent-teams-foundation quality check --consumer .",
      typecheck: "tsc --project packages/sdk/tsconfig.json",
      "foundation:check": "agent-teams-foundation check",
      "foundation:dev": "agent-teams-foundation assert-dev-only",
      "foundation:registry": "agent-teams-foundation assert-registry",
      test: "node --test packages/sdk/test/features.test.ts",
    } })],
    ["foundation.config.yaml", json({ schemaVersion: 2, capabilities: {
      "architecture.source-dependencies": { configPath: "architecture/source.yaml" },
      "quality.source-coverage": { configPath: "architecture/coverage.yaml" },
      "quality.suppression-governance": { configPath: "architecture/suppressions.yaml" },
    } })],
    ["architecture/source.yaml", json({ governedRoots: ["packages/sdk/src"] })],
    ["architecture/suppressions.yaml", json({ schemaVersion: 1, suppressions: [] })],
    ["architecture/coverage.yaml", json({ sourcePolicyPath: "architecture/source.yaml", suppressionPolicyPath: "architecture/suppressions.yaml", lintConfigPath: "oxlint.json", featureProfilePath: "architecture/profile.json", compilerProjects: ["packages/sdk/tsconfig.json"], scripts: { full: "check", scope: "quality:scope", typed: "quality:typed" } })],
    ["oxlint.json", json({ extends: ["./node_modules/@agent-teams/engineering-foundation/presets/oxlint/type-aware.json"] })],
    ["packages/sdk/tsconfig.json", json({ extends: "../../tsconfig.base.json", include: ["src/**/*.ts"] })],
    ["tsconfig.base.json", json({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true } })],
    ["architecture/profile.json", json({ status: "adopted", standard: { id: "agent-teams.feature-module-standard", version: "v1.1", repository: "agent-teams-ai/.github", commit: revision, path: "docs/architecture/feature-module-standard/v1.1.md", digest: "sha256:cfa088ef7396139554fe5e3bcc839271b23299c6b60c569a3a7f1cd7c9f0bc6c" }, architectureDocument: "docs/adoption.md", decisionRecords: ["docs/adoption.md#decision"], productionRoots: ["packages"], applicationRoots: [], excludedRoots: [], extensions: [], deviations: [], modules: [{ id: "sdk", role: "sdk", root: "packages/sdk", sourceRoot: "packages/sdk/src", features: [{ id: "evidence", root: "packages/sdk/src/features/evidence", layers: [{ role: "application", root: "packages/sdk/src/features/evidence/application" }] }] }], enforcementCommands: ["pnpm architecture:features:check", "pnpm quality:scope", "pnpm quality:typed", "pnpm check"] })],
    [".github/workflows/checks.yaml", json({ on: { pull_request: null }, jobs: { check: { "runs-on": "ubuntu-24.04", steps: [{ run: "pnpm check" }] } } })],
  ]);
  return { files, source: { read: async path => files.get(path), workflows: async () => [...files.keys()].filter(path => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(path)) } };
}

test("complete explicit SDK bootstrap reports configuration only without executing consumer code", async () => {
  const { source } = await fixture();
  const result = await checkRepositoryAdmission(source);
  assert.deepEqual(result.issues, []);
  assert.equal(result.status, "configured_not_qualified");
  assert.equal(result.guide, BOOTSTRAP_GUIDE);
  assert.ok(result.inspected_paths.includes("tsconfig.base.json"));
});

test("missing root foundation and wholly absent admission caller fail with the canonical guide", async () => {
  const { files, source } = await fixture();
  files.delete("foundation.config.yaml");
  files.delete(ADMISSION_CALLER);
  const result = await checkRepositoryAdmission(source);
  assert.equal(result.status, "incomplete");
  assert.equal(result.guide, BOOTSTRAP_GUIDE);
  assert.ok(result.issues.some(issue => issue.path === "foundation.config.yaml" && issue.message.includes("missing")));
  assert.ok(result.issues.some(issue => issue.path === ADMISSION_CALLER && issue.message.includes("missing")));
});

test("native no-op, comments and quoted command text cannot establish a gate", async () => {
  for (const command of ["# pnpm check\nexit 0", "echo pnpm check", "true && pnpm check", "pnpm check || true", "echo 'pnpm check'", "if true; then pnpm check; fi"]) {
    assert.deepEqual(directCommands(command), []);
    const { files, source } = await fixture();
    files.set(".github/workflows/checks.yaml", json({ on: { pull_request: null }, jobs: { check: { steps: [{ run: command }] } } }));
    assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.path === ".github/workflows"), command);
  }
  assert.deepEqual(directCommands("# documentation\npnpm check"), ["pnpm check"]);
});

test("conditional PRs, conditional dependencies, absent needs and cycles cannot cover native gates", async () => {
  const cases = [
    { on: { pull_request: { paths: ["src/**"] } }, jobs: { check: { steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { check: { if: "github.event_name == 'push'", steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { setup: { if: "false", steps: [] }, check: { needs: "setup", steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { check: { needs: "missing", steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { setup: { needs: "check", steps: [] }, check: { needs: "setup", steps: [{ run: "pnpm check" }] } } },
    { on: { pull_request: null }, jobs: { check: { steps: [{ if: "false", run: "pnpm check" }] } } },
  ];
  for (const workflow of cases) {
    const { files, source } = await fixture();
    files.set(".github/workflows/checks.yaml", json(workflow));
    assert.equal((await checkRepositoryAdmission(source)).status, "incomplete");
  }
});

test("canonical callers reject secrets, moving pins and identity template drift", async () => {
  for (const replacement of [renderRepositoryAdmissionCaller(revision).replace(revision, "main"), `${renderRepositoryAdmissionCaller(revision)}    secrets: inherit\n`, renderRepositoryAdmissionCaller(revision).replace("  admission:", "  admission:\n    if: false")]) {
    const { files, source } = await fixture();
    files.set(ADMISSION_CALLER, replacement);
    assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.path === ADMISSION_CALLER));
  }
  const { files, source } = await fixture();
  files.set(".github/workflows/commit-author-identity.yml", files.get(".github/workflows/commit-author-identity.yml")?.replace(IDENTITY_REVISION, revision) ?? "");
  assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.path === ".github/workflows/commit-author-identity.yml"));
});

test("compiler weakening and an empty SDK profile remain incomplete", async () => {
  const { files, source } = await fixture();
  files.set("tsconfig.base.json", json({ compilerOptions: { strict: false } }));
  const result = await checkRepositoryAdmission(source);
  assert.ok(result.issues.some(issue => issue.path === "packages/sdk/tsconfig.json" && issue.message.includes("strict")));
  files.set("architecture/profile.json", json({ modules: [] }));
  assert.ok((await checkRepositoryAdmission(source)).issues.some(issue => issue.message.includes("every production module")));
  assert.throws(() => expandAdmissionScript("check", { check: "pnpm alias", alias: "pnpm check" }, "pnpm"), /cyclic/u);
});

test("local reader rejects symlinks, oversized files, invalid UTF-8 and traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "repository-admission-reader-"));
  try {
    await writeFile(join(root, "target"), "inert");
    await symlink(join(root, "target"), join(root, "link"));
    await writeFile(join(root, "large"), Buffer.alloc(MAX_FILE_BYTES + 1));
    await writeFile(join(root, "invalid"), Buffer.from([0xc3, 0x28]));
    const source = await localAdmissionSource(root);
    assert.equal(await source.read("target"), "inert");
    for (const path of ["link", "large", "invalid", "../target"]) { await assert.rejects(source.read(path)); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
