import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { findPackageJSON } from "node:module";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isProcessRuntimeError, PROCESS_CAPTURE_LIMIT_BYTES } from "node-or-bun";
import {
  getQualityCommandOutput,
  QUALITY_COMMAND_TIMEOUT_MS,
  QualityCommandExitError,
  runQualityCommand,
} from "./quality-process.ts";

const repository = fileURLToPath(new URL("../", import.meta.url));
const testOptions = { timeout: 15_000 };
const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const fixtureConfiguration = (
  value: unknown,
): value is { lint: { paths: string[] }; format: { paths: string[] } } =>
  value !== null &&
  typeof value === "object" &&
  "lint" in value &&
  "format" in value &&
  value.lint !== null &&
  typeof value.lint === "object" &&
  "paths" in value.lint &&
  Array.isArray(value.lint.paths) &&
  value.lint.paths.every((path) => typeof path === "string") &&
  value.format !== null &&
  typeof value.format === "object" &&
  "paths" in value.format &&
  Array.isArray(value.format.paths) &&
  value.format.paths.every((path) => typeof path === "string");

// This timer is independent of the executor's timeout and Node's test timeout.
async function deadline<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("independent process fixture deadline exceeded")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

async function assertDead(pid: number): Promise<void> {
  const until = Date.now() + 2_000;
  while (isAlive(pid) && Date.now() < until) {
    await delay(20);
  }
  assert.equal(isAlive(pid), false, `owned child ${pid} is still alive`);
}

async function killOwnedChild(pid: number): Promise<void> {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
      throw error;
    }
  }
  await assertDead(pid);
}

interface Fixture {
  root: string;
  ready: string;
  signal: AbortSignal;
  run(
    source: string,
    args?: readonly string[],
    options?: Partial<Parameters<typeof runQualityCommand>[0]>,
  ): ReturnType<typeof runQualityCommand>;
  waitReady(): Promise<number>;
}

async function fixture(
  work: (value: Fixture) => Promise<void>,
  budgetMs = 9_000,
  parentSignal?: AbortSignal,
): Promise<void> {
  const root = await mkdtemp(join(await realpath(tmpdir()), "central-quality-process-"));
  const ready = join(root, "child-ready.json");
  const lifecycle = new AbortController();
  const signal =
    parentSignal === undefined
      ? lifecycle.signal
      : AbortSignal.any([lifecycle.signal, parentSignal]);
  let ownedPid: number | undefined;
  const readPid = async (): Promise<number | undefined> => {
    try {
      const data: unknown = JSON.parse(await readFile(ready, "utf8"));
      assert.ok(data && typeof data === "object" && "pid" in data);
      assert.ok(
        typeof data.pid === "number" &&
          Number.isInteger(data.pid) &&
          data.pid > 0 &&
          data.pid !== process.pid,
      );
      ownedPid = data.pid;
      return ownedPid;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  };
  const value: Fixture = {
    root,
    ready,
    signal,
    run(source, args = [], options = {}) {
      const command = runQualityCommand({
        command: process.execPath,
        args: ["--input-type=module", "-e", source, "--", ready, ...args],
        cwd: root,
        ...options,
        signal: options.signal === undefined ? signal : AbortSignal.any([signal, options.signal]),
      });
      // A readiness wait must never leave an early executor rejection unhandled.
      void command.catch(() => {});
      return command;
    },
    async waitReady() {
      const until = Date.now() + 5_000;
      while (Date.now() < until) {
        signal.throwIfAborted();
        const pid = await readPid();
        if (pid !== undefined) {
          return pid;
        }
        await delay(20);
      }
      throw new Error("owned child did not publish its atomic PID handshake");
    },
  };
  const pending = Promise.resolve().then(() => work(value));
  try {
    await deadline(pending, budgetMs);
  } finally {
    // Cleanup follows assertions; it cannot turn failed executor custody into a pass.
    lifecycle.abort();
    // Settle the final owned filesystem/process operation before the single cleanup owner removes paths.
    await pending.catch(() => {});
    await readPid();
    if (ownedPid !== undefined && isAlive(ownedPid)) {
      await killOwnedChild(ownedPid);
    }
    await rm(root, { recursive: true, force: true });
  }
}

const handshake = `
import { writeFileSync, renameSync } from "node:fs";
const ready = process.argv[1];
writeFileSync(ready + ".tmp", JSON.stringify({ pid: process.pid }));
renameSync(ready + ".tmp", ready);
`;
const stayAlive = "setInterval(() => {}, 1_000);";
const rejected = (command: ReturnType<typeof runQualityCommand>): Promise<unknown> =>
  command.then(
    () => assert.fail("quality command unexpectedly succeeded"),
    (error) => error,
  );

void test(
  "real process preserves exact argv and the physical cwd without a shell",
  testOptions,
  async () => {
    await fixture(async (value) => {
      assert.equal(QUALITY_COMMAND_TIMEOUT_MS, 120_000);
      const args = [
        "space value",
        "single'quote",
        'double"quote',
        "$HOME $(echo unsafe)",
        "модель 日本語 🦊",
        "",
      ];
      const result = await value.run(
        handshake +
          "process.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));",
        args,
      );
      assert.equal(result.exitCode, 0);
      assert.equal(result.signal, null);
      assert.deepEqual(JSON.parse(result.stdout), { args, cwd: value.root });
      assert.equal(result.stderr, "");
      assert.equal(result.facts.incompleteCustody, false);
      await assertDead(await value.waitReady());
    });
  },
);

void test(
  "real process distinguishes inherited environment from exact replacement",
  testOptions,
  async () => {
    const key = "CENTRAL_QUALITY_PROCESS_PARENT_TEST";
    const previous = process.env[key];
    process.env[key] = "parent sentinel";
    try {
      await fixture(async (value) => {
        const source =
          handshake +
          `process.stdout.write(JSON.stringify({ inherited: process.env.${key} ?? null, exact: process.env.CENTRAL_QUALITY_PROCESS_EXACT_TEST ?? null }));`;
        const inherited = await value.run(source);
        assert.deepEqual(JSON.parse(inherited.stdout), {
          inherited: "parent sentinel",
          exact: null,
        });
        await assertDead(await value.waitReady());
        const exact = await value.run(source, [], {
          environment: { CENTRAL_QUALITY_PROCESS_EXACT_TEST: "exact sentinel" },
        });
        assert.deepEqual(JSON.parse(exact.stdout), { inherited: null, exact: "exact sentinel" });
        await assertDead(await value.waitReady());
      });
    } finally {
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  },
);

void test(
  "real nonzero exit retains both streams as frozen non-enumerable output",
  testOptions,
  async () => {
    await fixture(async (value) => {
      const error = await rejected(
        value.run(
          handshake +
            'process.stdout.write("out-23\\n"); process.stderr.write("err-23\\n"); process.exitCode = 23;',
        ),
      );
      assert.ok(error instanceof QualityCommandExitError);
      assert.equal(error.exitCode, 23);
      assert.deepEqual(getQualityCommandOutput(error), { stdout: "out-23\n", stderr: "err-23\n" });
      assert.equal(Object.getOwnPropertyDescriptor(error, "output")?.enumerable, false);
      assert.ok(Object.isFrozen(getQualityCommandOutput(error)));
      assert.ok(!JSON.stringify(error).includes("out-23"));
      await assertDead(await value.waitReady());
    });
  },
);

void test(
  "real POSIX signal exit rejects with the observed signal",
  { ...testOptions, skip: process.platform === "win32" },
  async () => {
    await fixture(async (value) => {
      const error = await rejected(value.run(handshake + 'process.kill(process.pid, "SIGTERM");'));
      assert.ok(error instanceof QualityCommandExitError);
      assert.equal(error.exitCode, null);
      assert.equal(error.signal, "SIGTERM");
      await assertDead(await value.waitReady());
    });
  },
);

void test("missing absolute executable reports a real launch error", testOptions, async () => {
  await fixture(async (value) => {
    const error = await rejected(
      runQualityCommand({
        command: join(value.root, "missing-executable"),
        args: [],
        cwd: value.root,
        timeoutMs: 1_500,
        signal: value.signal,
      }),
    );
    assert.ok(isProcessRuntimeError(error));
    assert.equal(error.code, "launch");
    assert.equal(getQualityCommandOutput(error), null);
    assert.equal(error.facts.observedExit, null);
    assert.equal(getQualityCommandOutput(new Error("unknown failure")), null);
    await assert.rejects(readFile(value.ready), { code: "ENOENT" });
  });
});

void test(
  "real timeout cleans up its child and escalates an ignored POSIX SIGTERM",
  testOptions,
  async () => {
    await fixture(async (value) => {
      const ignored = join(value.root, "ignored-sigterm");
      const source =
        `import { writeFileSync as recordSignal } from "node:fs"; process.on("SIGTERM", () => recordSignal(${JSON.stringify(ignored)}, "ignored"));\n` +
        handshake +
        'process.stdout.write("timeout-stdout-marker\\n");' +
        stayAlive;
      const outcome = rejected(value.run(source, [], { timeoutMs: 1_500 }));
      const pid = await value.waitReady();
      const error = await outcome;
      assert.ok(isProcessRuntimeError(error));
      assert.equal(error.code, "timeout");
      if (process.platform !== "win32") {
        assert.equal(await readFile(ignored, "utf8"), "ignored");
        assert.equal(error.facts.observedExit?.signal, "SIGKILL");
      }
      assert.match(getQualityCommandOutput(error)?.stdout ?? "", /timeout-stdout-marker/u);
      assert.equal(error.facts.incompleteCustody, false);
      await assertDead(pid);
    });
  },
);

void test("real cancellation after readiness cleans up its owned child", testOptions, async () => {
  await fixture(async (value) => {
    const controller = new AbortController();
    const outcome = rejected(
      value.run('process.stderr.write("cancel-stderr-marker\\n");' + handshake + stayAlive, [], {
        signal: controller.signal,
      }),
    );
    const pid = await value.waitReady();
    controller.abort();
    const error = await outcome;
    assert.ok(isProcessRuntimeError(error));
    assert.equal(error.code, "cancelled");
    assert.match(getQualityCommandOutput(error)?.stderr ?? "", /cancel-stderr-marker/u);
    assert.equal(error.facts.incompleteCustody, false);
    await assertDead(pid);
  });
});

void test(
  "real stdout overflow keeps bounded capture and stderr while cleaning up",
  testOptions,
  async () => {
    await fixture(async (value) => {
      const source =
        handshake +
        `process.stderr.write("overflow-stderr-marker\\n"); setTimeout(() => process.stdout.write(Buffer.alloc(4 * 1024 * 1024 + 64 * 1024, 120)), 100);` +
        stayAlive;
      const outcome = rejected(value.run(source));
      const pid = await value.waitReady();
      const error = await outcome;
      assert.ok(isProcessRuntimeError(error));
      assert.equal(error.code, "output-limit");
      assert.equal(PROCESS_CAPTURE_LIMIT_BYTES, 4 * 1024 * 1024);
      const output = getQualityCommandOutput(error);
      assert.ok(output);
      assert.equal(Buffer.byteLength(output.stdout), 4 * 1024 * 1024);
      assert.ok(Buffer.byteLength(output.stderr) <= 4 * 1024 * 1024);
      assert.match(output.stderr, /overflow-stderr-marker/u);
      assert.equal(error.facts.incompleteCustody, false);
      await assertDead(pid);
    });
  },
);

void test(
  "real invalid UTF-8 on either stream fails closed without exposing output",
  testOptions,
  async () => {
    for (const stream of ["stdout", "stderr"] as const) {
      await fixture(async (value) => {
        const outcome = rejected(
          value.run(handshake + `process.${stream}.write(Buffer.from([0xc3, 0x28]));`),
        );
        const pid = await value.waitReady();
        const error = await outcome;
        assert.ok(isProcessRuntimeError(error));
        assert.equal(error.code, "invalid-output");
        assert.equal(getQualityCommandOutput(error), null);
        assert.equal(error.facts.incompleteCustody, false);
        await assertDead(pid);
      });
    }
  },
);

// Test-only physical copies of the actual CLI startup closure; no installer or lifecycle scripts.
async function copyLintFixturePackages(root: string, signal: AbortSignal) {
  const installation = await realpath(join(repository, "node_modules"));
  const modules = join(root, "node_modules");
  const copies = new Map<string, string>();
  const packages: {
    name: string;
    version: string;
    files: { source: string; target: string; sha256: string; bytes: number }[];
  }[] = [];
  const digest = async (filename: string) => {
    signal.throwIfAborted();
    const bytes = await readFile(filename, { signal });
    signal.throwIfAborted();
    return createHash("sha256").update(bytes).digest("hex");
  };
  const copyPackage = async (
    name: string,
    from: string,
    optional = false,
  ): Promise<string | undefined> => {
    signal.throwIfAborted();
    let metadataPath: string;
    try {
      const found = findPackageJSON(name, pathToFileURL(join(from, "package.json")));
      if (found === undefined && optional) {
        return undefined;
      }
      assert.ok(found, `Missing installed package metadata: ${name}`);
      metadataPath = found;
    } catch (error) {
      if (
        optional &&
        error instanceof Error &&
        "code" in error &&
        ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(String(error.code))
      ) {
        return undefined;
      }
      throw error;
    }
    const source = await realpath(dirname(metadataPath));
    signal.throwIfAborted();
    const sourceRelative = relative(installation, source);
    assert.ok(
      sourceRelative !== ".." &&
        !sourceRelative.startsWith(`..${sep}`) &&
        !isAbsolute(sourceRelative),
    );
    const prior = copies.get(source);
    if (prior !== undefined) {
      return prior;
    }
    const target = join(modules, ".fixture-packages", String(copies.size));
    copies.set(source, target);
    signal.throwIfAborted();
    await mkdir(dirname(target), { recursive: true });
    const metadata: unknown = JSON.parse(
      await readFile(join(source, "package.json"), { encoding: "utf8", signal }),
    );
    assert.ok(metadata !== null && typeof metadata === "object" && !Array.isArray(metadata));
    const packageName: unknown = Reflect.get(metadata, "name");
    const version: unknown = Reflect.get(metadata, "version");
    assert.ok(typeof packageName === "string" && typeof version === "string");
    const files: { source: string; target: string; sha256: string; bytes: number }[] = [];
    const manifest = { name: packageName, version, files };
    packages.push(manifest);
    const materialize = async (entry: string, destination: string): Promise<void> => {
      signal.throwIfAborted();
      if (entry === join(source, "node_modules")) {
        return;
      }
      const info = await lstat(entry);
      signal.throwIfAborted();
      if (info.isDirectory()) {
        await mkdir(destination, { recursive: true });
        signal.throwIfAborted();
        for (const child of await readdir(entry)) {
          await materialize(join(entry, child), join(destination, child));
        }
      } else {
        assert.ok(
          info.isFile() && !info.isSymbolicLink(),
          "fixture packages contain only regular files",
        );
        const sha256 = await digest(entry);
        signal.throwIfAborted();
        try {
          await link(entry, destination);
        } catch (error) {
          if (
            !(
              error instanceof Error &&
              "code" in error &&
              ["EXDEV", "EPERM", "ENOTSUP"].includes(String(error.code))
            )
          ) {
            throw error;
          }
          signal.throwIfAborted();
          await copyFile(entry, destination, constants.COPYFILE_FICLONE);
        }
        manifest.files.push({ source: entry, target: destination, sha256, bytes: info.size });
      }
      signal.throwIfAborted();
    };
    await materialize(source, target);
    for (const field of ["dependencies", "optionalDependencies"]) {
      const declarations: unknown = Reflect.get(metadata, field);
      if (declarations === undefined) {
        continue;
      }
      assert.ok(
        declarations !== null && typeof declarations === "object" && !Array.isArray(declarations),
      );
      for (const dependency of Object.keys(declarations)) {
        signal.throwIfAborted();
        const copied = await copyPackage(dependency, source, field === "optionalDependencies");
        if (copied === undefined) {
          continue;
        }
        const dependencyLink = join(target, "node_modules", dependency);
        signal.throwIfAborted();
        await mkdir(dirname(dependencyLink), { recursive: true });
        signal.throwIfAborted();
        await symlink(copied, dependencyLink, process.platform === "win32" ? "junction" : "dir");
      }
    }
    return target;
  };
  for (const name of [
    "stack-toolchain",
    "node-or-bun",
    "yaml",
    "@types/node",
    "@agent-teams/ci-input-proof",
  ]) {
    const copied = await copyPackage(name, repository);
    assert.ok(copied);
    signal.throwIfAborted();
    await mkdir(dirname(join(modules, name)), { recursive: true });
    signal.throwIfAborted();
    await symlink(copied, join(modules, name), process.platform === "win32" ? "junction" : "dir");
  }
  signal.throwIfAborted();
  assert.equal(await realpath(modules), modules);
  signal.throwIfAborted();
  return { packages, digest };
}

void test(
  "actual quality lint CLI accepts its disposable repository and preserves a large real diagnostic batch",
  { timeout: 25_000 },
  async (context) => {
    const work = async (value: Fixture) => {
      value.signal.throwIfAborted();
      const tracked = spawnSync("git", ["ls-files", "-z"], {
        cwd: repository,
        encoding: "utf8",
        timeout: 3_000,
        maxBuffer: 1024 * 1024,
      });
      assert.ifError(tracked.error);
      assert.equal(tracked.status, 0, tracked.stderr);
      const sources = tracked.stdout
        .split("\0")
        .filter((path) => /^(?:scripts|tools)\/.*\.(?:mjs|mts|ts)$/u.test(path));
      assert.ok(sources.length > 0);
      for (const source of sources) {
        value.signal.throwIfAborted();
        const target = join(value.root, source);
        await mkdir(dirname(target), { recursive: true });
        value.signal.throwIfAborted();
        await copyFile(join(repository, source), target, constants.COPYFILE_FICLONE);
      }
      const inputs = [
        "tsconfig.json",
        "toolchain.config.json",
        "package.json",
        "pnpm-workspace.yaml",
        "oxlint.json",
        "tsconfig.tooling.json",
        "foundation.config.yaml",
        ".node-version",
        ".github/workflows/ci.yml",
        "docs/engineering-quality-profile.json",
        "docs/engineering-quality-source-policy.yaml",
        "docs/engineering-quality-required-tests.json",
      ];
      for (const input of inputs) {
        value.signal.throwIfAborted();
        const target = join(value.root, input);
        await mkdir(dirname(target), { recursive: true });
        value.signal.throwIfAborted();
        await copyFile(join(repository, input), target, constants.COPYFILE_FICLONE);
      }
      const closure = await copyLintFixturePackages(value.root, value.signal);
      await writeFile(join(value.root, ".gitignore"), "node_modules/\n");
      const init = spawnSync("git", ["init", "--quiet"], {
        cwd: value.root,
        encoding: "utf8",
        timeout: 3_000,
        maxBuffer: 1024 * 1024,
      });
      assert.ifError(init.error);
      assert.equal(init.status, 0, init.stderr);
      const preload = join(value.root, "scripts/quality-process-cli-handshake.mjs");
      await writeFile(
        preload,
        `import { writeFileSync, renameSync } from "node:fs"; const ready = ${JSON.stringify(value.ready)}; writeFileSync(ready + ".tmp", JSON.stringify({ pid: process.pid })); renameSync(ready + ".tmp", ready);\n`,
      );
      const configPath = join(value.root, "toolchain.config.json");
      const config: unknown = JSON.parse(await readFile(configPath, "utf8"));
      assert.ok(
        fixtureConfiguration(config),
        "the actual disposable lint configuration must have string-only scopes",
      );
      config.lint.paths.push("scripts/quality-process-cli-handshake.mjs");
      config.lint.paths.sort();
      config.format.paths.push("scripts/quality-process-cli-handshake.mjs");
      config.format.paths.sort();
      await writeFile(configPath, JSON.stringify(config));
      const request = {
        command: process.execPath,
        args: [
          "--import",
          pathToFileURL(preload).href,
          join(value.root, "scripts/run-quality-lint.mjs"),
        ],
        cwd: value.root,
        timeoutMs: 6_000,
        signal: value.signal,
      };
      const positive = await runQualityCommand(request).catch((error) => {
        const output = getQualityCommandOutput(error);
        assert.fail(output === null ? String(error) : output.stdout + output.stderr);
      });
      assert.equal(positive.exitCode, 0);
      await assertDead(await value.waitReady());
      const violation = `scripts/quality-process-lint-TEST-${"diagnostic-".repeat(15)}.mjs`;
      const diagnosticCount = 2_000;
      await writeFile(
        join(value.root, violation),
        Array.from(
          { length: diagnosticCount },
          (_unused, index) => `export const forbidden${index} = eval("case-${index}");\n`,
        ).join(""),
      );
      config.lint.paths.push(violation);
      config.lint.paths.sort();
      config.format.paths.push(violation);
      config.format.paths.sort();
      await writeFile(configPath, JSON.stringify(config));
      const error = await rejected(runQualityCommand(request));
      assert.ok(error instanceof QualityCommandExitError);
      const output = getQualityCommandOutput(error);
      assert.ok(output);
      const diagnostics = output.stdout + output.stderr;
      assert.equal(diagnostics.match(/eslint\(no-eval\)/gu)?.length, diagnosticCount);
      assert.ok(
        Buffer.byteLength(diagnostics) > 512 * 1024,
        "the real diagnostic batch must exceed pipe buffering",
      );
      assert.ok(
        Buffer.byteLength(diagnostics) < 2 * 1024 * 1024,
        "the fixture must stay comfortably within the capture limit",
      );
      assert.ok(
        diagnostics.lastIndexOf(`${violation}:${diagnosticCount}:`) > 131_072,
        "the final source-line diagnostic must survive after the first 128 KiB",
      );
      await assertDead(await value.waitReady());
      const retainedAuthority = "scripts/check-docs-source-successor-v1.mts";
      await rm(join(value.root, retainedAuthority));
      await symlink(join(repository, retainedAuthority), join(value.root, retainedAuthority));
      const symlinkError = await rejected(runQualityCommand(request));
      const symlinkOutput = getQualityCommandOutput(symlinkError);
      assert.ok(symlinkOutput);
      assert.match(
        symlinkOutput.stdout + symlinkOutput.stderr,
        /retained authority source must be a regular file/u,
      );
      await assertDead(await value.waitReady());
      for (const entry of closure.packages) {
        for (const file of entry.files) {
          value.signal.throwIfAborted();
          assert.equal(
            await closure.digest(file.source),
            file.sha256,
            "original dependency bytes must not change",
          );
          assert.equal(
            await closure.digest(file.target),
            file.sha256,
            "fixture dependency bytes must not change",
          );
        }
        context.diagnostic(
          `physical fixture package ${JSON.stringify({ name: entry.name, version: entry.version, fileCount: entry.files.length })}`,
        );
        for (const file of entry.files) {
          context.diagnostic(
            `physical fixture file ${JSON.stringify({ name: entry.name, version: entry.version, ...file })}`,
          );
        }
      }
    };
    await fixture(work, 20_000, context.signal);
  },
);
