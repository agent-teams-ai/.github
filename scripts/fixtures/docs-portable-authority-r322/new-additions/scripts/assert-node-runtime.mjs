import { fileURLToPath } from "node:url";

export const supportedNodeVersions = Object.freeze(["24.18.0", "26.10.0"]);

export function assertNodeRuntime(expectedVersion, actualVersion = process.version) {
  if (!supportedNodeVersions.includes(expectedVersion)) {
    throw new Error(`Unsupported Node compatibility version: ${expectedVersion}`);
  }

  const expectedTag = `v${expectedVersion}`;
  if (actualVersion !== expectedTag) {
    throw new Error(`Expected Node ${expectedTag}, selected ${actualVersion}`);
  }

  return Object.freeze({
    expectedVersion,
    actualVersion,
    lane: expectedVersion === "24.18.0" ? "production-default" : "node26-compatibility",
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const expectedVersion = process.argv[2];
  if (!expectedVersion) {
    throw new Error("Expected a Node version argument.");
  }

  const result = assertNodeRuntime(expectedVersion);
  console.log(`Node runtime proved: ${result.actualVersion} (${result.lane})`);
}
