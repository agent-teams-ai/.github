import assert from "node:assert/strict";
import { glob, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { run } from "node:test";
import { tap } from "node:test/reporters";
import { fileURLToPath } from "node:url";
import { runQualityCommand } from "./quality-process.ts";

const repository = fileURLToPath(new URL("../", import.meta.url));
export const FROZEN_SUCCESSOR_TEST = "scripts/check-docs-source-successor-v1.test.mts";
export const HISTORICAL_INSTALL_REVISION = "5abed741aff64506d0e9f87f76541a4e93af7e4a";
export const GOVERNANCE_TEST_TIMEOUT_MS = 600_000;
const featureTest = "tools/feature-module-standard/check.test.mjs";
const scriptTest = /^scripts\/(?:[^/]+\/)*[^/]+\.test\.(?:mjs|mts|ts)$/u;
const workflows = [
  ".github/workflows/docs-cohort-authority-evolution-v8.yml",
  ".github/workflows/docs-source-successor-v1.yml",
];

export async function discoverGovernanceTests(root = repository): Promise<string[]> {
  const files: string[] = [];
  for await (const path of glob(
    ["scripts/**/*.test.mjs", "scripts/**/*.test.mts", "scripts/**/*.test.ts"],
    { cwd: root },
  )) {
    assert.ok(
      (await lstat(join(root, path))).isFile(),
      `Governance test must be a regular file: ${path}`,
    );
    files.push(path.replaceAll("\\", "/"));
  }
  assert.ok(
    (await lstat(join(root, featureTest))).isFile(),
    "Feature Module Standard test must be a regular file",
  );
  return [...files, featureTest].toSorted();
}

export function partitionGovernanceTests(files: readonly string[]): {
  current: string[];
  historical: string[];
} {
  assert.equal(new Set(files).size, files.length, "Governance test census contains duplicates");
  assert.ok(
    files.includes(FROZEN_SUCCESSOR_TEST),
    "Frozen source-successor test is missing from the complete census",
  );
  assert.ok(
    files.includes(featureTest),
    "Feature Module Standard test is missing from the complete census",
  );
  assert.ok(
    files.every((file) => scriptTest.test(file) || file === featureTest),
    "Unexpected governance test path",
  );
  return {
    current: files.filter((file) => file !== FROZEN_SUCCESSOR_TEST),
    historical: [FROZEN_SUCCESSOR_TEST],
  };
}

export async function createHistoricalTestCwd(
  root = repository,
): Promise<{ cwd: string; cleanup: () => Promise<void> }> {
  const cwd = await mkdtemp(join(await realpath(tmpdir()), "central-frozen-successor-test-"));
  const cleanup = () => rm(cwd, { recursive: true, force: true });
  try {
    for (const path of ["package.json", "pnpm-lock.yaml"]) {
      const { stdout } = await runQualityCommand({
        command: "git",
        args: ["show", `${HISTORICAL_INSTALL_REVISION}:${path}`],
        cwd: root,
      });
      await writeFile(join(cwd, path), stdout);
    }
    for (const path of workflows) {
      const target = join(cwd, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await readFile(join(root, path)));
    }
    return { cwd, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export async function runGovernanceTestBatch(
  files: readonly string[],
  cwd: string,
  signal: AbortSignal,
): Promise<boolean> {
  assert.equal(
    process.env.NODE_TEST_CONTEXT,
    undefined,
    "Run the governance runner as an ordinary Node CLI, outside a test worker",
  );
  assert.ok(
    files.length > 0 && files.every((file) => file === resolvePath(file)),
    "Test batch requires absolute file paths",
  );
  const completed: string[] = [];
  const lifecycle = new AbortController();
  let success = true;
  const tests = run({
    files,
    cwd,
    concurrency: true,
    execArgv: [],
    signal: AbortSignal.any([signal, lifecycle.signal]),
    timeout: GOVERNANCE_TEST_TIMEOUT_MS,
  });
  tests.on("test:summary", (summary) => {
    if (summary.file !== undefined) {
      completed.push(resolvePath(cwd, summary.file));
    }
    if (!summary.success) {
      success = false;
    }
  });
  try {
    for await (const chunk of tests.compose(tap)) {
      const output: unknown = chunk;
      assert.ok(typeof output === "string");
      await new Promise<void>((resolve, reject) => {
        process.stdout.write(output, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    assert.deepEqual(
      completed.toSorted(),
      [...files].toSorted(),
      "Every selected governance test file must complete exactly once",
    );
    return success;
  } finally {
    lifecycle.abort();
  }
}

export async function runGovernanceTests(): Promise<void> {
  const partition = partitionGovernanceTests(await discoverGovernanceTests());
  const signal = AbortSignal.timeout(GOVERNANCE_TEST_TIMEOUT_MS);
  const currentPassed = await runGovernanceTestBatch(
    partition.current.map((file) => join(repository, file)),
    repository,
    signal,
  );
  const historical = await createHistoricalTestCwd();
  try {
    const historicalPassed = await runGovernanceTestBatch(
      partition.historical.map((file) => join(repository, file)),
      historical.cwd,
      signal,
    );
    assert.ok(
      currentPassed && historicalPassed,
      "Governance tests failed; both current and frozen partitions were executed",
    );
  } finally {
    await historical.cleanup();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runGovernanceTests();
}
