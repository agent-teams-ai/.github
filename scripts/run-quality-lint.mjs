import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { runCommand } from "stack-toolchain";
import {
  assertQualityAdoption,
  deriveLintPaths,
  readQualityAdoption,
} from "./check-quality-scope.mjs";
import {
  getQualityCommandOutput,
  runQualityCommand,
  QUALITY_COMMAND_TIMEOUT_MS,
} from "./quality-process.ts";

const root = new URL("../", import.meta.url);
const stackRequire = createRequire(import.meta.resolve("stack-toolchain/package.json"));
const oxlintEntrypoint = fileURLToPath(
  new URL("bin/oxlint", pathToFileURL(stackRequire.resolve("oxlint/package.json"))),
);
const cwd = fileURLToPath(root);

const commonArguments = (paths) => [
  "--config",
  "oxlint.json",
  "--no-ignore",
  "--disable-nested-config",
  ...paths,
];

function writeOutput(stream, output) {
  return new Promise((resolve, reject) => {
    stream.write(output, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export function parseOxlintDebugFiles(stdout) {
  return stdout.split(/\r?\n/u).filter(Boolean).toSorted();
}

export async function selectOxlintFiles(paths) {
  const { stdout } = await runQualityCommand({
    command: process.execPath,
    args: [oxlintEntrypoint, "--debug=files", ...commonArguments(paths)],
    cwd,
  });
  const selected = parseOxlintDebugFiles(stdout);
  assert.deepEqual(
    selected,
    paths.toSorted(),
    "Oxlint selected files differ from derived tooling paths",
  );
  return selected;
}

export async function runQualityLint() {
  const adoption = await readQualityAdoption(root);
  const census = assertQualityAdoption(adoption);
  const paths = deriveLintPaths(census, adoption.profile);
  await selectOxlintFiles(paths);
  const report = await runCommand({
    command: "lint",
    cwd,
    signal: new AbortController().signal,
    budgetMs: QUALITY_COMMAND_TIMEOUT_MS,
  });
  if (typeof report.details?.stdout === "string") {
    await writeOutput(process.stdout, report.details.stdout);
  }
  if (typeof report.details?.stderr === "string") {
    await writeOutput(process.stderr, report.details.stderr);
  }
  assert.equal(report.exitCode, 0, `Stack lint failed: ${report.status}`);
  assert.match(
    report.details.stdout,
    /^Found 0 warnings and 0 errors\.$/mu,
    "lint must retain the consumer's zero-warning policy",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await runQualityLint();
  } catch (error) {
    const output = getQualityCommandOutput(error);
    if (output !== null) {
      // An uncaught error exits immediately; flush asynchronous pipe writes first.
      await Promise.all([
        writeOutput(process.stdout, output.stdout),
        writeOutput(process.stderr, output.stderr),
      ]);
    }
    throw error;
  }
}
