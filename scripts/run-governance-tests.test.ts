import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getQualityCommandOutput, runQualityCommand } from "./quality-process.ts";
import {
  createHistoricalTestCwd,
  discoverGovernanceTests,
  FROZEN_SUCCESSOR_TEST,
  GOVERNANCE_TEST_TIMEOUT_MS,
  HISTORICAL_INSTALL_REVISION,
  partitionGovernanceTests,
} from "./run-governance-tests.ts";

const repository = fileURLToPath(new URL("../", import.meta.url));
const featureTest = "tools/feature-module-standard/check.test.mjs";

async function fixture(): Promise<{
  root: string;
  cleanup: () => Promise<void>;
  put: (path: string, source: string) => Promise<void>;
}> {
  const root = await mkdtemp(join(await realpath(tmpdir()), "central-test-runner-"));
  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
    async put(path, source) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source);
    },
  };
}

void test("complete test discovery and partition retain mjs, mts and ts exactly once", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const expected = [
    featureTest,
    FROZEN_SUCCESSOR_TEST,
    "scripts/current.test.mjs",
    "scripts/typed.test.ts",
    "scripts/nested/another.test.mts",
  ].toSorted();
  for (const path of [...expected, "scripts/helper.ts", "scripts/data.test.mjs.gz"]) {
    await f.put(path, "");
  }
  const discovered = await discoverGovernanceTests(f.root);
  assert.deepEqual(discovered, expected);
  const partition = partitionGovernanceTests(discovered);
  assert.deepEqual(partition.historical, [FROZEN_SUCCESSOR_TEST]);
  assert.deepEqual(
    partition.current,
    expected.filter((path) => path !== FROZEN_SUCCESSOR_TEST),
  );
  assert.deepEqual([...partition.current, ...partition.historical].toSorted(), expected);
  assert.throws(
    () => partitionGovernanceTests(expected.filter((path) => path !== FROZEN_SUCCESSOR_TEST)),
    /Frozen source-successor test is missing/u,
  );
  assert.throws(
    () => partitionGovernanceTests([...expected, FROZEN_SUCCESSOR_TEST]),
    /duplicates/u,
  );
  assert.throws(
    () => partitionGovernanceTests([...expected, "other/unowned.test.ts"]),
    /Unexpected governance test path/u,
  );
  assert.throws(
    () => partitionGovernanceTests(expected.filter((path) => path !== featureTest)),
    /Feature Module Standard test is missing/u,
  );
  await symlink(join(f.root, "scripts/helper.ts"), join(f.root, "scripts/symlink.test.ts"));
  await assert.rejects(discoverGovernanceTests(f.root), /regular file/u);
});

void test("frozen successor runs from its original file with exact historical install and current workflow bytes", async (t) => {
  const historical = await createHistoricalTestCwd();
  t.after(historical.cleanup);
  assert.equal(HISTORICAL_INSTALL_REVISION, "5abed741aff64506d0e9f87f76541a4e93af7e4a");
  const frozenBytes = await readFile(join(repository, FROZEN_SUCCESSOR_TEST));
  assert.deepEqual(
    frozenBytes,
    execFileSync("git", ["cat-file", "blob", "281032ebb0afecd5bb425f7f4018c99b20ee6635"], {
      cwd: repository,
      timeout: 5_000,
    }),
  );
  for (const path of ["package.json", "pnpm-lock.yaml"]) {
    const expected = execFileSync(
      "git",
      ["show", `5abed741aff64506d0e9f87f76541a4e93af7e4a:${path}`],
      { cwd: repository, timeout: 5_000 },
    );
    assert.deepEqual(await readFile(join(historical.cwd, path)), expected);
  }
  for (const path of [
    ".github/workflows/docs-cohort-authority-evolution-v8.yml",
    ".github/workflows/docs-source-successor-v1.yml",
  ]) {
    assert.deepEqual(
      await readFile(join(historical.cwd, path)),
      await readFile(join(repository, path)),
    );
  }
  await assert.rejects(readFile(join(historical.cwd, FROZEN_SUCCESSOR_TEST)), { code: "ENOENT" });
  const discovered = await discoverGovernanceTests();
  assert.equal(discovered.filter((path) => path === FROZEN_SUCCESSOR_TEST).length, 1);
  assert.ok(discovered.includes("scripts/quality-process.test.ts"));
  assert.ok(discovered.includes("scripts/run-governance-tests.test.ts"));
  assert.equal(GOVERNANCE_TEST_TIMEOUT_MS, 600_000);
});

void test(
  "real native test batches preserve distinct cwd, original imports, exactly-once execution and failure",
  { timeout: 15_000 },
  async (t) => {
    const f = await fixture();
    t.after(f.cleanup);
    await f.put("source.ts", 'export const marker = "original-import";\n');
    for (const [path, name] of [
      ["first.test.mjs", "first"],
      ["second.test.ts", "second"],
      ["frozen.test.mts", "historical"],
    ]) {
      await f.put(
        path!,
        `import test from "node:test"; import { appendFileSync } from "node:fs"; import { marker } from "./source.ts"; test(${JSON.stringify(name)}, () => appendFileSync("visits", ${JSON.stringify(name + ":")} + marker + "\\n"));\n`,
      );
    }
    await f.put(
      "failure.test.ts",
      'import test from "node:test"; import assert from "node:assert/strict"; test("actual rejecting test", () => assert.fail("runner-negative-control"));\n',
    );
    await mkdir(join(f.root, "current"));
    await mkdir(join(f.root, "historical"));
    const source = `import assert from "node:assert/strict"; import { runGovernanceTestBatch } from ${JSON.stringify(pathToFileURL(join(repository, "scripts/run-governance-tests.ts")).href)};
const signal = AbortSignal.timeout(10_000);
assert.equal(await runGovernanceTestBatch(${JSON.stringify([join(f.root, "first.test.mjs"), join(f.root, "second.test.ts")])}, ${JSON.stringify(join(f.root, "current"))}, signal), true);
assert.equal(await runGovernanceTestBatch(${JSON.stringify([join(f.root, "frozen.test.mts")])}, ${JSON.stringify(join(f.root, "historical"))}, signal), true);
assert.equal(await runGovernanceTestBatch(${JSON.stringify([join(f.root, "failure.test.ts")])}, ${JSON.stringify(f.root)}, signal), false);`;
    await f.put("driver.mjs", source);
    // Model an ordinary CLI launch with an exact synthetic environment. Production
    // leaves its environment intact and rejects recursive Node test-worker calls.
    const result = await runQualityCommand({
      command: process.execPath,
      args: [join(f.root, "driver.mjs")],
      cwd: f.root,
      environment: {
        PATH: process.env.PATH ?? "",
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      },
      timeoutMs: 12_000,
    }).catch((error) => {
      const output = getQualityCommandOutput(error);
      assert.fail(output === null ? String(error) : output.stdout + output.stderr);
    });
    assert.deepEqual(
      (await readFile(join(f.root, "current/visits"), "utf8")).trim().split("\n").toSorted(),
      ["first:original-import", "second:original-import"],
    );
    assert.equal(
      await readFile(join(f.root, "historical/visits"), "utf8"),
      "historical:original-import\n",
    );
    assert.match(result.stdout, /not ok.*actual rejecting test/u);
  },
);
