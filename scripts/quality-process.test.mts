import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isProcessRuntimeError, PROCESS_CAPTURE_LIMIT_BYTES } from "node-or-bun";
import { getQualityCommandOutput, QUALITY_COMMAND_TIMEOUT_MS, QualityCommandExitError, runQualityCommand } from "./quality-process.mts";

const repository = fileURLToPath(new URL("../", import.meta.url));
const testOptions = { timeout: 15_000 };
const delay = (milliseconds: number) => new Promise<void>(resolve => { setTimeout(resolve, milliseconds); });

// This timer is independent of the executor's timeout and Node's test timeout.
async function deadline<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("independent process fixture deadline exceeded")), milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") { return false; }
    throw error;
  }
}

async function assertDead(pid: number): Promise<void> {
  const until = Date.now() + 2_000;
  while (isAlive(pid) && Date.now() < until) { await delay(20); }
  assert.equal(isAlive(pid), false, `owned child ${pid} is still alive`);
}

async function killOwnedChild(pid: number): Promise<void> {
  try { process.kill(pid, "SIGKILL"); }
  catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) { throw error; }
  }
  await assertDead(pid);
}

interface Fixture {
  root: string;
  ready: string;
  signal: AbortSignal;
  run(source: string, args?: readonly string[], options?: Partial<Parameters<typeof runQualityCommand>[0]>): ReturnType<typeof runQualityCommand>;
  waitReady(): Promise<number>;
}

async function fixture(work: (value: Fixture) => Promise<void>, budgetMs = 9_000): Promise<void> {
  const root = await mkdtemp(join(await realpath(tmpdir()), "central-quality-process-"));
  const ready = join(root, "child-ready.json");
  const lifecycle = new AbortController();
  let ownedPid: number | undefined;
  const readPid = async (): Promise<number | undefined> => {
    try {
      const data: unknown = JSON.parse(await readFile(ready, "utf8"));
      assert.ok(data && typeof data === "object" && "pid" in data);
      assert.ok(typeof data.pid === "number" && Number.isInteger(data.pid) && data.pid > 0 && data.pid !== process.pid);
      ownedPid = data.pid;
      return ownedPid;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") { return undefined; }
      throw error;
    }
  };
  const value: Fixture = {
    root, ready, signal: lifecycle.signal,
    run(source, args = [], options = {}) {
      const command = runQualityCommand({
        command: process.execPath,
        args: ["--input-type=module", "-e", source, "--", ready, ...args],
        cwd: root,
        ...options,
        signal: options.signal === undefined ? lifecycle.signal : AbortSignal.any([lifecycle.signal, options.signal]),
      });
      // A readiness wait must never leave an early executor rejection unhandled.
      void command.catch(() => {});
      return command;
    },
    async waitReady() {
      const until = Date.now() + 5_000;
      while (Date.now() < until) {
        const pid = await readPid();
        if (pid !== undefined) { return pid; }
        await delay(20);
      }
      throw new Error("owned child did not publish its atomic PID handshake");
    },
  };
  try { await deadline(work(value), budgetMs); }
  finally {
    // Cleanup follows assertions; it cannot turn failed executor custody into a pass.
    lifecycle.abort();
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
  command.then(() => assert.fail("quality command unexpectedly succeeded"), error => error);

test("real process preserves exact argv and the physical cwd without a shell", testOptions, async () => {
  await fixture(async value => {
    assert.equal(QUALITY_COMMAND_TIMEOUT_MS, 120_000);
    const args = ["space value", "single'quote", 'double"quote', "$HOME $(echo unsafe)", "модель 日本語 🦊", ""];
    const result = await value.run(handshake + "process.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));", args);
    assert.equal(result.exitCode, 0);
    assert.equal(result.signal, null);
    assert.deepEqual(JSON.parse(result.stdout), { args, cwd: value.root });
    assert.equal(result.stderr, "");
    assert.equal(result.facts.incompleteCustody, false);
    await assertDead(await value.waitReady());
  });
});

test("real process distinguishes inherited environment from exact replacement", testOptions, async () => {
  const key = "CENTRAL_QUALITY_PROCESS_PARENT_TEST";
  const previous = process.env[key];
  process.env[key] = "parent sentinel";
  try {
    await fixture(async value => {
      const source = handshake + `process.stdout.write(JSON.stringify({ inherited: process.env.${key} ?? null, exact: process.env.CENTRAL_QUALITY_PROCESS_EXACT_TEST ?? null }));`;
      const inherited = await value.run(source);
      assert.deepEqual(JSON.parse(inherited.stdout), { inherited: "parent sentinel", exact: null });
      await assertDead(await value.waitReady());
      const exact = await value.run(source, [], { environment: { CENTRAL_QUALITY_PROCESS_EXACT_TEST: "exact sentinel" } });
      assert.deepEqual(JSON.parse(exact.stdout), { inherited: null, exact: "exact sentinel" });
      await assertDead(await value.waitReady());
    });
  } finally {
    if (previous === undefined) { delete process.env[key]; }
    else { process.env[key] = previous; }
  }
});

test("real nonzero exit retains both streams as frozen non-enumerable output", testOptions, async () => {
  await fixture(async value => {
    const error = await rejected(value.run(handshake + 'process.stdout.write("out-23\\n"); process.stderr.write("err-23\\n"); process.exitCode = 23;'));
    assert.ok(error instanceof QualityCommandExitError);
    assert.equal(error.exitCode, 23);
    assert.deepEqual(getQualityCommandOutput(error), { stdout: "out-23\n", stderr: "err-23\n" });
    assert.equal(Object.getOwnPropertyDescriptor(error, "output")?.enumerable, false);
    assert.ok(Object.isFrozen(getQualityCommandOutput(error)));
    assert.ok(!JSON.stringify(error).includes("out-23"));
    await assertDead(await value.waitReady());
  });
});

test("real POSIX signal exit rejects with the observed signal", { ...testOptions, skip: process.platform === "win32" }, async () => {
  await fixture(async value => {
    const error = await rejected(value.run(handshake + 'process.kill(process.pid, "SIGTERM");'));
    assert.ok(error instanceof QualityCommandExitError);
    assert.equal(error.exitCode, null);
    assert.equal(error.signal, "SIGTERM");
    await assertDead(await value.waitReady());
  });
});

test("missing absolute executable reports a real launch error", testOptions, async () => {
  await fixture(async value => {
    const error = await rejected(runQualityCommand({ command: join(value.root, "missing-executable"), args: [], cwd: value.root, timeoutMs: 1_500, signal: value.signal }));
    assert.ok(isProcessRuntimeError(error));
    assert.equal(error.code, "launch");
    assert.equal(getQualityCommandOutput(error), null);
    assert.equal(error.facts.observedExit, null);
    assert.equal(getQualityCommandOutput(new Error("unknown failure")), null);
    await assert.rejects(readFile(value.ready), { code: "ENOENT" });
  });
});

test("real timeout cleans up its child and escalates an ignored POSIX SIGTERM", testOptions, async () => {
  await fixture(async value => {
    const ignored = join(value.root, "ignored-sigterm");
    const source = `import { writeFileSync as recordSignal } from "node:fs"; process.on("SIGTERM", () => recordSignal(${JSON.stringify(ignored)}, "ignored"));\n` + handshake + 'process.stdout.write("timeout-stdout-marker\\n");' + stayAlive;
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
});

test("real cancellation after readiness cleans up its owned child", testOptions, async () => {
  await fixture(async value => {
    const controller = new AbortController();
    const outcome = rejected(value.run('process.stderr.write("cancel-stderr-marker\\n");' + handshake + stayAlive, [], { signal: controller.signal }));
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

test("real stdout overflow keeps bounded capture and stderr while cleaning up", testOptions, async () => {
  await fixture(async value => {
    const source = handshake + `process.stderr.write("overflow-stderr-marker\\n"); setTimeout(() => process.stdout.write(Buffer.alloc(4 * 1024 * 1024 + 64 * 1024, 120)), 100);` + stayAlive;
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
});

test("real invalid UTF-8 on either stream fails closed without exposing output", testOptions, async () => {
  for (const stream of ["stdout", "stderr"] as const) {
    await fixture(async value => {
      const outcome = rejected(value.run(handshake + `process.${stream}.write(Buffer.from([0xc3, 0x28]));`));
      const pid = await value.waitReady();
      const error = await outcome;
      assert.ok(isProcessRuntimeError(error));
      assert.equal(error.code, "invalid-output");
      assert.equal(getQualityCommandOutput(error), null);
      assert.equal(error.facts.incompleteCustody, false);
      await assertDead(pid);
    });
  }
});

test("actual quality lint CLI accepts its disposable repository and preserves a large real diagnostic batch", { timeout: 25_000 }, async () => {
  await fixture(async value => {
    for (const directory of ["scripts", "tools"]) {
      await cp(join(repository, directory), join(value.root, directory), { recursive: true });
    }
    const inputs = ["package.json", "pnpm-workspace.yaml", "oxlint.json", "tsconfig.tooling.json", "foundation.config.yaml", ".node-version", ".github/workflows/ci.yml", "docs/engineering-quality-profile.json", "docs/engineering-quality-source-policy.yaml", "docs/engineering-quality-required-tests.json"];
    for (const input of inputs) {
      const target = join(value.root, input);
      await mkdir(dirname(target), { recursive: true });
      await cp(join(repository, input), target);
    }
    await symlink(await realpath(join(repository, "node_modules")), join(value.root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    await writeFile(join(value.root, ".gitignore"), "node_modules/\n");
    const init = spawnSync("git", ["init", "--quiet"], { cwd: value.root, encoding: "utf8", timeout: 3_000, maxBuffer: 1024 * 1024 });
    assert.ifError(init.error);
    assert.equal(init.status, 0, init.stderr);
    const preload = join(value.root, "scripts/quality-process-cli-handshake.mjs");
    await writeFile(preload, `import { writeFileSync, renameSync } from "node:fs"; const ready = ${JSON.stringify(value.ready)}; writeFileSync(ready + ".tmp", JSON.stringify({ pid: process.pid })); renameSync(ready + ".tmp", ready);\n`);
    const request = { command: process.execPath, args: ["--import", pathToFileURL(preload).href, join(value.root, "scripts/run-quality-lint.mjs")], cwd: value.root, timeoutMs: 6_000, signal: value.signal };
    const positive = await runQualityCommand(request).catch(error => {
      const output = getQualityCommandOutput(error);
      assert.fail(output === null ? String(error) : output.stdout + output.stderr);
    });
    assert.equal(positive.exitCode, 0);
    await assertDead(await value.waitReady());
    const violation = `scripts/quality-process-lint-TEST-${"diagnostic-".repeat(15)}.mjs`;
    const diagnosticCount = 2_000;
    await writeFile(join(value.root, violation), Array.from({ length: diagnosticCount }, (_unused, index) =>
      `export const forbidden${index} = eval("case-${index}");\n`).join(""));
    const error = await rejected(runQualityCommand(request));
    assert.ok(error instanceof QualityCommandExitError);
    const output = getQualityCommandOutput(error);
    assert.ok(output);
    const diagnostics = output.stdout + output.stderr;
    assert.equal(diagnostics.match(/eslint\(no-eval\)/gu)?.length, diagnosticCount);
    assert.ok(Buffer.byteLength(diagnostics) > 512 * 1024, "the real diagnostic batch must exceed pipe buffering");
    assert.ok(Buffer.byteLength(diagnostics) < 2 * 1024 * 1024, "the fixture must stay comfortably within the capture limit");
    assert.ok(diagnostics.lastIndexOf(`${violation}:${diagnosticCount}:`) > 131_072,
      "the final source-line diagnostic must survive after the first 128 KiB");
    await assertDead(await value.waitReady());
  }, 20_000);
});
