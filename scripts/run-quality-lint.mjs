import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { assertQualityAdoption, deriveLintPaths, readQualityAdoption } from "./check-quality-scope.mjs";
import { getQualityCommandOutput, runQualityCommand } from "./quality-process.mts";

const root = new URL("../", import.meta.url);
const oxlintEntrypoint = fileURLToPath(new URL("node_modules/oxlint/bin/oxlint", root));
const cwd = fileURLToPath(root);

const commonArguments = paths => [
  "--config", "oxlint.json",
  "--no-ignore",
  "--disable-nested-config",
  ...paths,
];

function writeOutput(stream, output) {
  return new Promise((resolve, reject) => {
    stream.write(output, error => {
      if (error) {reject(error);}
      else {resolve();}
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
  assert.deepEqual(selected, paths.toSorted(), "Oxlint selected files differ from derived tooling paths");
  return selected;
}

export async function runQualityLint() {
  const adoption = await readQualityAdoption(root);
  const census = assertQualityAdoption(adoption);
  const paths = deriveLintPaths(census, adoption.profile);
  await selectOxlintFiles(paths);
  const { stdout, stderr } = await runQualityCommand({
    command: process.execPath,
    args: [oxlintEntrypoint, "--deny-warnings", ...commonArguments(paths)],
    cwd,
  });
  await Promise.all([writeOutput(process.stdout, stdout), writeOutput(process.stderr, stderr)]);
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
