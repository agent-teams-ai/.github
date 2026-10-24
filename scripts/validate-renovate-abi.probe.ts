import assert from "node:assert/strict";
import { access, copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getQualityCommandOutput, runQualityCommand } from "./quality-process.ts";

assert.equal(process.platform, "linux", "This explicit native ABI probe supports Linux only; use a C++20 compiler and the managed Node 24 headers");
const repository = fileURLToPath(new URL("../", import.meta.url));
const tool = join(repository, "tools/renovate-validation");
const root = await mkdtemp(join(await realpath(tmpdir()), "central-renovate-abi-probe-"));

try {
  const selected = await runQualityCommand({ command: "pnpm", args: ["--dir", tool, "exec", "node", "-p", "process.execPath"], cwd: repository });
  const managed = selected.stdout.trim();
  const includes = join(dirname(dirname(await realpath(managed))), "include/node");
  await access(join(includes, "node.h"));
  const validator = join(root, "tools/renovate-validation/node_modules/renovate");
  const regex = join(validator, "node_modules/re2");
  await mkdir(join(root, "scripts"));
  await mkdir(join(validator, "dist"), { recursive: true });
  await mkdir(join(regex, "build/Release"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await symlink(join(repository, "node_modules"), join(root, "node_modules"), "junction");
  for (const file of ["validate-renovate.ts", "quality-process.ts"]) {
    await copyFile(join(repository, "scripts", file), join(root, "scripts", file));
  }
  await copyFile(join(tool, "node_modules/renovate/package.json"), join(validator, "package.json"));
  const actualRegex = join(dirname(await realpath(join(tool, "node_modules/renovate"))), "re2");
  for (const file of ["package.json", "re2.js"]) { await copyFile(join(actualRegex, file), join(regex, file)); }
  const marker = join(root, "validator-ran");
  await writeFile(join(validator, "dist/config-validator.js"),
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "unexpected");`);
  const link = join(root, "validation-link.ts");
  await symlink(join(root, "scripts/validate-renovate.ts"), link, "file");
  const invoke = () => runQualityCommand({ command: managed, args: [link], cwd: root });
  await assert.rejects(invoke(), error => {
    const output = getQualityCommandOutput(error); assert.ok(output !== null);
    assert.match(output.stdout + output.stderr, /Cannot find module.*re2\.node/u); return true;
  });
  const source = join(root, "wrong-abi.cc"), binary = join(regex, "build/Release/re2.node");
  await writeFile(source, '#include <node.h>\n#undef NODE_MODULE_VERSION\n#define NODE_MODULE_VERSION 1\nvoid Initialize(v8::Local<v8::Object>) {}\nNODE_MODULE(wrong_abi_witness, Initialize)\n');
  await runQualityCommand({ command: "c++", args: ["-std=c++20", "-shared", "-fPIC", "-I", includes, source, "-o", binary], cwd: root });
  await assert.rejects(invoke(), error => {
    const output = getQualityCommandOutput(error); assert.ok(output !== null);
    assert.match(output.stdout + output.stderr, /NODE_MODULE_VERSION 1/u);
    assert.match(output.stdout + output.stderr, /ERR_DLOPEN_FAILED/u); return true;
  });
  await assert.rejects(readFile(marker), { code: "ENOENT" });
  console.log(JSON.stringify({ platform: process.platform, arch: process.arch, managedRuntime: "24.21.0",
    missingNativeRejected: true, wrongAbiRejected: true, symlinkInvocationRejected: true, validatorReached: false }));
} catch (error) {
  const output = getQualityCommandOutput(error);
  if (output !== null) { console.error(output.stdout + output.stderr); }
  throw error;
} finally {
  await rm(root, { recursive: true, force: true });
}
