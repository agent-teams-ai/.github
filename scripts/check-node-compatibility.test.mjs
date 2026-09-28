import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertNodeRuntime } from "./assert-node-runtime.mjs";
import { checkNodeCompatibility } from "./check-node-compatibility.mjs";

const strictFlags = "--config.engine-strict=true --config.strict-peer-dependencies=true";
const workflowSource = async (name) => readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");
const ciWorkflow = await workflowSource("ci.yml");
const compatibilityWorkflow = await workflowSource("reviewrouter-codex.yml");

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "node-compatibility-"));
  const paths = {
    "scripts/node-compatibility-tooling/package.json": await readFile(new URL("./node-compatibility-tooling/package.json", import.meta.url), "utf8"),
    "scripts/node-compatibility-tooling/pnpm-workspace.yaml": await readFile(new URL("./node-compatibility-tooling/pnpm-workspace.yaml", import.meta.url), "utf8"),
    "scripts/node-compatibility-tooling/pnpm-lock.yaml": await readFile(new URL("./node-compatibility-tooling/pnpm-lock.yaml", import.meta.url), "utf8"),
    "package.json": JSON.stringify({
      engines: { node: ">=24.18.0 <25 || >=26.10.0 <27" },
    }),
    ".node-version": "24.18.0\n",
    ".npmrc": "engine-strict=true\nstrict-peer-dependencies=true\n",
    "pnpm-workspace.yaml": "minimumReleaseAge: 0\n",
    ".github/workflows/ci.yml": ciWorkflow,
    ".github/workflows/docs-protocol-check.yml": await workflowSource("docs-protocol-check.yml"),
    ".github/workflows/reviewrouter-codex.yml": compatibilityWorkflow,
    ".github/workflows/reviewrouter-interaction.yml": await workflowSource("reviewrouter-interaction.yml"),
    ".github/workflows/docs-fleet-audit.yml": await workflowSource("docs-fleet-audit.yml"),
    ".github/workflows/docs-platform-recovery-installation-r317.yml": await workflowSource("docs-platform-recovery-installation-r317.yml"),
    ".github/workflows/docs-admission-evidence.yml": await workflowSource("docs-admission-evidence.yml"),
    ".github/workflows/docs-cohort-append-only.yml": await workflowSource("docs-cohort-append-only.yml"),
    ".github/workflows/organization-inventory-drift.yml": await workflowSource("organization-inventory-drift.yml"),
  };
  for (const [path, source] of Object.entries(paths)) {
    const target = join(root, path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, source);
  }
  return root;
}

test("accepts explicit Node 24 and Node 26 lanes with strict installs", async () => {
  const root = await makeFixture();
  try {
    assert.deepEqual(await checkNodeCompatibility(root), {
      productionDefault: "24.18.0",
      compatibility: "26.10.0",
      skippedMajor: 25,
      strictInstall: true,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a workflow that loses the Node 26 compatibility lane", async () => {
  const root = await makeFixture();
  try {
    await writeFile(
      join(root, ".github/workflows/ci.yml"),
      ciWorkflow.replace("  node26-compatibility:", "  removed-compatibility:"),
    );
    await assert.rejects(checkNodeCompatibility(root), /retain its node26-compatibility compatibility job/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a runtime comparison disabled by a shell comment", async () => {
  const root = await makeFixture();
  try {
    await writeFile(
      join(root, ".github/workflows/ci.yml"),
      ciWorkflow.replace(
        "throw Error('Node runtime mismatch')",
        "console.log('Node runtime mismatch')",
      ),
    );
    await assert.rejects(checkNodeCompatibility(root), /execute the selected Node version comparison/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a strict-install regression", async () => {
  const root = await makeFixture();
  try {
    await writeFile(join(root, ".npmrc"), "engine-strict=false\n");
    await assert.rejects(checkNodeCompatibility(root), /strict engine enforcement/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an install that relies on ignored npmrc strictness flags", async () => {
  const root = await makeFixture();
  try {
    await writeFile(
      join(root, ".github/workflows/ci.yml"),
      ciWorkflow.replace(`pnpm install --frozen-lockfile ${strictFlags}`, "pnpm install --frozen-lockfile --config.engine-strict=true"),
    );
    await assert.rejects(checkNodeCompatibility(root), /CI must use a frozen strict install/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a matrix-coupled ReviewRouter interaction compatibility lane", async () => {
  const root = await makeFixture();
  try {
    await writeFile(
      join(root, ".github/workflows/reviewrouter-interaction.yml"),
      compatibilityWorkflow,
    );
    await assert.rejects(
      checkNodeCompatibility(root),
      /retain its node26-compatibility compatibility job/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime proof rejects Node 25 and version mismatches", () => {
  assert.throws(() => assertNodeRuntime("25.0.0", "v25.0.0"), /Unsupported Node compatibility version/u);
  assert.throws(() => assertNodeRuntime("26.10.0", "v24.21.0"), /Expected Node v26\.10\.0/u);
  assert.equal(assertNodeRuntime("26.10.0", "v26.10.0").lane, "node26-compatibility");
});

test("rejects a proof run with a shell override that suppresses failure", async () => {
  const root = await makeFixture();
  try {
    await writeFile(
      join(root, ".github/workflows/ci.yml"),
      ciWorkflow.replace("      - name: Prove selected Node runtime", "      - name: Prove selected Node runtime\n        shell: bash {0}"),
    );
    await assert.rejects(checkNodeCompatibility(root), /execute the selected Node version comparison/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects job defaults that remove the runtime proof failure shell", async () => {
  const root = await makeFixture();
  try {
    await writeFile(
      join(root, ".github/workflows/ci.yml"),
      ciWorkflow.replace("  check:\n", "  check:\n    defaults:\n      run:\n        shell: bash {0}\n"),
    );
    await assert.rejects(checkNodeCompatibility(root), /must not override the job run shell/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects skipped Node setup and proof steps", async () => {
  const root = await makeFixture();
  try {
    await writeFile(
      join(root, ".github/workflows/ci.yml"),
      ciWorkflow.replace("      - uses: actions/setup-node@", "      - if: false\n        uses: actions/setup-node@")
        .replace("      - name: Prove selected Node runtime", "      - name: Prove selected Node runtime\n        if: false"),
    );
    await assert.rejects(checkNodeCompatibility(root), /must not skip Node setup/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects proof steps allowed to continue after failure", async () => {
  const root = await makeFixture();
  try {
    await writeFile(
      join(root, ".github/workflows/ci.yml"),
      ciWorkflow.replace("      - name: Prove selected Node runtime", "      - name: Prove selected Node runtime\n        continue-on-error: true"),
    );
    await assert.rejects(checkNodeCompatibility(root), /execute the selected Node version comparison/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a fresh compatibility job without its isolated parser install", async () => {
  const root = await makeFixture();
  try {
    const source = await readFile(new URL("../.github/workflows/reviewrouter-codex.yml", import.meta.url), "utf8");
    await writeFile(
      join(root, ".github/workflows/reviewrouter-codex.yml"),
      source.replace("      - name: Install isolated compatibility parser\n        run: pnpm --dir scripts/node-compatibility-tooling install --frozen-lockfile --ignore-scripts --ignore-pnpmfile --config.engine-strict=true --config.strict-peer-dependencies=true\n", ""),
    );
    await assert.rejects(checkNodeCompatibility(root), /install its pinned isolated parser/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a compatibility job that omits its parser check", async () => {
  const root = await makeFixture();
  try {
    const path = join(root, ".github/workflows/reviewrouter-codex.yml");
    const source = await readFile(path, "utf8");
    await writeFile(path, source.replace("      - name: Check bounded Node compatibility contract", "      - name: Skipped Node compatibility contract"));
    await assert.rejects(checkNodeCompatibility(root), /install its pinned isolated parser before checking/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a parser check whose shell can hide the first command failure", async () => {
  const root = await makeFixture();
  try {
    const path = join(root, ".github/workflows/reviewrouter-codex.yml");
    const source = await readFile(path, "utf8");
    await writeFile(path, source.replace("      - name: Check bounded Node compatibility contract", "      - name: Check bounded Node compatibility contract\n        shell: bash {0}"));
    await assert.rejects(checkNodeCompatibility(root), /install its pinned isolated parser before checking/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a strict lockgraph step whose shell can hide a failed peer check", async () => {
  const root = await makeFixture();
  try {
    const path = join(root, ".github/workflows/ci.yml");
    await writeFile(path, ciWorkflow.replace("      - run: |\n          pnpm install --frozen-lockfile", "      - shell: bash {0}\n        run: |\n          pnpm install --frozen-lockfile"));
    await assert.rejects(checkNodeCompatibility(root), /CI must use a frozen strict install/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a parser tool that loses the exact package manager pin", async () => {
  const root = await makeFixture();
  try {
    const manifestPath = join(root, "scripts/node-compatibility-tooling/package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.packageManager = "pnpm@11.17.0";
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(checkNodeCompatibility(root), /exact pnpm and YAML pins/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
