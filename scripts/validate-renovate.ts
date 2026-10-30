import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { getQualityCommandOutput, runQualityCommand } from "./quality-process.ts";

const repository = fileURLToPath(new URL("../", import.meta.url));
const validator = new URL(
  "../tools/renovate-validation/node_modules/renovate/dist/config-validator.js",
  import.meta.url,
);

function writeOutput(stream: NodeJS.WritableStream, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(value, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

try {
  assert.equal(
    process.version,
    "v24.21.0",
    "Renovate must run through its exact managed Node 24 runtime",
  );
  const require = createRequire(await realpath(fileURLToPath(validator)));
  const metadata: unknown = require("../package.json");
  assert.ok(
    metadata &&
      typeof metadata === "object" &&
      "name" in metadata &&
      "version" in metadata &&
      metadata.name === "renovate" &&
      metadata.version === "44.24.2",
    "Renovate installation differs from the exact tool pin",
  );
  const nativeRegex: unknown = require("re2");
  assert.equal(
    typeof nativeRegex,
    "function",
    "Renovate requires its actual RE2 native implementation",
  );
  console.log(`Renovate runtime proved: ${process.version}; RE2 loaded`);
  const result = await runQualityCommand({
    command: process.execPath,
    args: [fileURLToPath(validator), "--strict", "renovate-config.json", "renovate.json"],
    cwd: repository,
  });
  await Promise.all([
    writeOutput(process.stdout, result.stdout),
    writeOutput(process.stderr, result.stderr),
  ]);
} catch (error) {
  const output = getQualityCommandOutput(error);
  if (output !== null) {
    await Promise.all([
      writeOutput(process.stdout, output.stdout),
      writeOutput(process.stderr, output.stderr),
    ]);
  }
  throw error;
}
