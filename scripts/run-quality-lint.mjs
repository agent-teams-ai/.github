import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assertQualityAdoption, deriveLintPaths, readQualityAdoption } from "./check-quality-scope.mjs";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const oxlintEntrypoint = fileURLToPath(new URL("node_modules/oxlint/bin/oxlint", root));
const maxBuffer = 2 * 1024 * 1024;

const commonArguments = paths => [
  "--config", "oxlint.json",
  "--no-ignore",
  "--disable-nested-config",
  ...paths,
];

export function parseOxlintDebugFiles(stdout) {
  return stdout.split(/\r?\n/u).filter(Boolean).toSorted();
}

export async function selectOxlintFiles(paths) {
  const { stdout } = await execFileAsync(process.execPath, [
    oxlintEntrypoint,
    "--debug=files",
    ...commonArguments(paths),
  ], { cwd: root, encoding: "utf8", maxBuffer });
  const selected = parseOxlintDebugFiles(stdout);
  assert.deepEqual(selected, paths.toSorted(), "Oxlint selected files differ from derived tooling paths");
  return selected;
}

export async function runQualityLint() {
  const adoption = await readQualityAdoption(root);
  const census = assertQualityAdoption(adoption);
  const paths = deriveLintPaths(census, adoption.profile);
  await selectOxlintFiles(paths);
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    oxlintEntrypoint,
    "--deny-warnings",
    ...commonArguments(paths),
  ], { cwd: root, encoding: "utf8", maxBuffer });
  process.stdout.write(stdout);
  process.stderr.write(stderr);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {await runQualityLint();}
