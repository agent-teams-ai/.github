import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { getQualityCommandOutput, runQualityCommand } from "./quality-process.ts";

const repository = fileURLToPath(new URL("../", import.meta.url));
const tool = join(repository, "tools/renovate-validation");

function pnpm(args: string[], cwd = repository): ReturnType<typeof runQualityCommand> {
  // These fixtures model fresh top-level commands. pnpm disables recursive dependency
  // checks in its child environment after validating its own invocation.
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && entry[0].toLowerCase() !== "pnpm_config_verify_deps_before_run",
    ),
  );
  const entrypoint = process.env.npm_execpath;
  if (typeof entrypoint === "string" && /\.(?:cjs|mjs|js)$/u.test(entrypoint)) {
    return runQualityCommand({
      command: process.execPath,
      args: [entrypoint, ...args],
      cwd,
      environment,
    });
  }
  return runQualityCommand({ command: "pnpm", args, cwd, environment });
}

async function disposable(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(await realpath(tmpdir()), "central-renovate-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

void test("pnpm 11 reads the actual engine, peer and exact-save policies from workspace YAML", async () => {
  assert.equal((await pnpm(["--version"])).stdout.trim(), "11.18.0");
  for (const cwd of [repository, tool]) {
    for (const setting of ["engineStrict", "strictPeerDependencies", "saveExact"]) {
      const result = await pnpm(["config", "get", setting], cwd);
      assert.equal(result.stdout.trim(), "true", `${setting} must be effective in ${cwd}`);
    }
    assert.equal(
      (await pnpm(["config", "get", "verifyDepsBeforeRun"], cwd)).stdout.trim(),
      "error",
    );
  }
});

void test("the launcher fails before validation when native RE2 is missing", async (t) => {
  const root = await disposable(t);
  const managed = (
    await pnpm(["--dir", tool, "exec", "node", "-p", "process.execPath"])
  ).stdout.trim();
  const fakeValidator = join(root, "tools/renovate-validation/node_modules/renovate");
  const fakeRegex = join(fakeValidator, "node_modules/re2");
  await mkdir(join(root, "scripts"));
  await mkdir(join(fakeValidator, "dist"), { recursive: true });
  await mkdir(join(fakeRegex, "build/Release"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await symlink(join(repository, "node_modules"), join(root, "node_modules"), "junction");
  for (const file of ["validate-renovate.ts", "quality-process.ts"]) {
    await copyFile(join(repository, "scripts", file), join(root, "scripts", file));
  }
  await copyFile(
    join(tool, "node_modules/renovate/package.json"),
    join(fakeValidator, "package.json"),
  );
  const actualRegex = join(dirname(await realpath(join(tool, "node_modules/renovate"))), "re2");
  for (const file of ["package.json", "re2.js"]) {
    await copyFile(join(actualRegex, file), join(fakeRegex, file));
  }
  const marker = join(root, "validator-ran");
  await writeFile(
    join(fakeValidator, "dist/config-validator.js"),
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "unexpected");`,
  );
  const invoke = () =>
    runQualityCommand({
      command: managed,
      args: [join(root, "scripts/validate-renovate.ts")],
      cwd: root,
    });
  await assert.rejects(invoke(), (error) => {
    const output = getQualityCommandOutput(error);
    assert.ok(output !== null);
    assert.match(output.stdout + output.stderr, /Cannot find module.*re2\.node/u);
    return true;
  });
  await assert.rejects(readFile(marker), { code: "ENOENT" });
});

void test("check-time dependency drift fails without an implicit installation", async (t) => {
  const root = await disposable(t);
  for (const [directory, version] of [
    ["dependency", "1.0.0"],
    ["replacement", "2.0.0"],
  ] as const) {
    await mkdir(join(root, directory));
    await writeFile(
      join(root, directory, "package.json"),
      JSON.stringify({ name: "dependency-drift-witness", version }),
    );
  }
  const manifest = {
    name: "missing-bootstrap-witness",
    version: "0.0.0",
    private: true,
    packageManager: "pnpm@11.18.0",
    scripts: { proof: "node -e \"throw Error('must not run')\"" },
    dependencies: { "dependency-drift-witness": "file:./dependency" },
  };
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(root, "pnpm-workspace.yaml"),
    await readFile(join(repository, "pnpm-workspace.yaml")),
  );
  await pnpm(
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--cache-dir",
      join(root, "empty-cache"),
      "--store-dir",
      join(root, "empty-store"),
    ],
    root,
  );
  const originalLock = await readFile(join(root, "pnpm-lock.yaml"));
  const installed = await readFile(
    join(root, "node_modules/dependency-drift-witness/package.json"),
  );
  const metadata: unknown = JSON.parse(installed.toString("utf8"));
  assert.ok(metadata && typeof metadata === "object" && "version" in metadata);
  assert.equal(metadata.version, "1.0.0");
  const invoke = () =>
    pnpm(
      [
        `--config.cache-dir=${join(root, "empty-cache")}`,
        `--config.store-dir=${join(root, "empty-store")}`,
        "run",
        "proof",
      ],
      root,
    );
  await assert.rejects(invoke(), (error) => {
    const output = getQualityCommandOutput(error);
    assert.ok(output !== null);
    assert.match(output.stdout + output.stderr, /must not run/u);
    assert.doesNotMatch(output.stdout + output.stderr, /ERR_PNPM_VERIFY_DEPS_BEFORE_RUN/u);
    return true;
  });
  manifest.dependencies["dependency-drift-witness"] = "file:./replacement";
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await assert.rejects(invoke(), (error) => {
    const output = getQualityCommandOutput(error);
    assert.ok(output !== null);
    assert.match(output.stdout + output.stderr, /ERR_PNPM_VERIFY_DEPS_BEFORE_RUN/u);
    assert.doesNotMatch(output.stdout + output.stderr, /must not run/u);
    return true;
  });
  assert.deepEqual(await readFile(join(root, "pnpm-lock.yaml")), originalLock);
  assert.deepEqual(
    await readFile(join(root, "node_modules/dependency-drift-witness/package.json")),
    installed,
  );
});

void test("real incompatible dependency rejects only when the adopted engine policy is effective", async (t) => {
  const root = await disposable(t);
  await mkdir(join(root, "incompatible"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "engine-policy-witness",
      version: "0.0.0",
      private: true,
      packageManager: "pnpm@11.18.0",
      dependencies: { "incompatible-engine-witness": "file:./incompatible" },
    }),
  );
  await writeFile(
    join(root, "incompatible/package.json"),
    JSON.stringify({
      name: "incompatible-engine-witness",
      version: "1.0.0",
      engines: { node: "<1" },
    }),
  );
  const policy = await readFile(join(repository, "pnpm-workspace.yaml"), "utf8");
  await writeFile(join(root, "pnpm-workspace.yaml"), policy);
  await assert.rejects(
    pnpm(["install", "--offline", "--ignore-scripts", "--ignore-pnpmfile"], root),
    (error) => {
      const output = getQualityCommandOutput(error);
      assert.ok(output !== null);
      assert.match(output.stdout + output.stderr, /ERR_PNPM_UNSUPPORTED_ENGINE/u);
      return true;
    },
  );
  // The dependency itself installs when this disposable negative control turns off enforcement.
  await writeFile(
    join(root, "pnpm-workspace.yaml"),
    policy.replace("engineStrict: true", "engineStrict: false"),
  );
  await pnpm(["install", "--offline", "--ignore-scripts", "--ignore-pnpmfile"], root);
});

void test("isolated Renovate executes with actual pinned Node 24 and a usable native RE2", async () => {
  const result = await pnpm(["--dir", tool, "run", "validate"]);
  assert.match(result.stdout, /Renovate runtime proved: v24\.21\.0; RE2 loaded/u);
  assert.match(result.stdout + result.stderr, /Config validated successfully against 2 file\(s\)/u);
  assert.doesNotMatch(result.stdout + result.stderr, /RE2 not usable|falling back to RegExp/u);
});

void test("the actual pinned Renovate validator rejects an invalid configuration", async (t) => {
  const root = await disposable(t);
  const invalid = join(root, "renovate.json");
  await writeFile(invalid, JSON.stringify({ definitelyUnknownCentralOption: true }));
  await assert.rejects(
    pnpm(["--dir", tool, "exec", "renovate-config-validator", "--strict", invalid]),
    (error) => {
      const output = getQualityCommandOutput(error);
      assert.ok(output !== null);
      assert.match(output.stdout + output.stderr, /definitelyUnknownCentralOption/u);
      assert.doesNotMatch(output.stdout + output.stderr, /RE2 not usable|falling back to RegExp/u);
      return true;
    },
  );
});
