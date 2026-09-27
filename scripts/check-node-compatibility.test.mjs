import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertNodeRuntime } from "./assert-node-runtime.mjs";
import { checkNodeCompatibility } from "./check-node-compatibility.mjs";

const proof = (expected = "24.18.0") => `
      - name: Prove selected Node runtime
        env:
          EXPECTED_NODE_VERSION: ${expected}
        run: |
          selected="$(node --version)"
          test "$selected" = "v$EXPECTED_NODE_VERSION"
`;

const compatibilityWorkflow = `jobs:
  check:
    strategy:
      matrix:
        node-version: ["24.18.0", "26.10.0"]
    steps:
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with:
          node-version: \${{ matrix.node-version }}
${proof("${{ matrix.node-version }}")}
      - run: pnpm install --dir .node-compatibility --frozen-lockfile
`;

const literalWorkflow = `jobs:
  check:
    steps:
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with:
          node-version: 24.18.0
${proof()}
`;

const docsCompatibilityWorkflow =
  compatibilityWorkflow.replace("jobs:\n  check:", "jobs:\n  node-compatibility:") +
  literalWorkflow.slice("jobs:\n".length).replace("  check:", "  docs-protocol-check:");

const splitInteractionWorkflow = `jobs:
  node-compatibility:
    steps:
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with:
          node-version: 24.18.0
${proof()}
  node26-compatibility:
    steps:
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with:
          node-version: 26.10.0
${proof("26.10.0")}
`;

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "node-compatibility-"));
  const paths = {
    "package.json": JSON.stringify({
      engines: { node: ">=24.18.0 <25 || >=26.10.0 <27" },
    }),
    ".node-version": "24.18.0\n",
    ".npmrc": "engine-strict=true\nstrict-peer-dependencies=true\n",
    "pnpm-workspace.yaml": "minimumReleaseAge: 0\n",
    ".github/workflows/ci.yml": compatibilityWorkflow,
    ".github/workflows/docs-protocol-check.yml": docsCompatibilityWorkflow,
    ".github/workflows/reviewrouter-codex.yml": compatibilityWorkflow,
    ".github/workflows/reviewrouter-interaction.yml": splitInteractionWorkflow,
    ".github/workflows/docs-fleet-audit.yml": docsCompatibilityWorkflow,
    ".github/workflows/docs-platform-recovery-installation-r317.yml": docsCompatibilityWorkflow,
    ".github/workflows/docs-admission-evidence.yml": docsCompatibilityWorkflow,
    ".github/workflows/docs-cohort-append-only.yml": docsCompatibilityWorkflow,
    ".github/workflows/organization-inventory-drift.yml": docsCompatibilityWorkflow,
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
      compatibilityWorkflow.replace('"24.18.0", "26.10.0"', '"24.18.0"'),
    );
    await assert.rejects(checkNodeCompatibility(root), /Node 24 and Node 26 compatibility lanes/u);
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

test("rejects a matrix-coupled ReviewRouter interaction compatibility lane", async () => {
  const root = await makeFixture();
  try {
    await writeFile(
      join(root, ".github/workflows/reviewrouter-interaction.yml"),
      compatibilityWorkflow,
    );
    await assert.rejects(
      checkNodeCompatibility(root),
      /independent literal Node 24 and Node 26 compatibility lanes/u,
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
