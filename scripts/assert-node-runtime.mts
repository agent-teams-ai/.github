import { fileURLToPath } from "node:url";

export const supportedNodeVersions = Object.freeze(["24.21.0", "26.10.0"] as const);
export type SupportedNodeVersion = (typeof supportedNodeVersions)[number];

export interface NodeRuntimeProof {
  readonly expectedVersion: SupportedNodeVersion;
  readonly actualVersion: string;
  readonly lane: "production-default" | "node26-compatibility";
}

function isSupportedNodeVersion(version: string): version is SupportedNodeVersion {
  return supportedNodeVersions.some(supported => supported === version);
}

export function assertNodeRuntime(
  expectedVersion: string,
  actualVersion: string = process.version,
): Readonly<NodeRuntimeProof> {
  if (!isSupportedNodeVersion(expectedVersion)) {
    throw new Error(`Unsupported Node compatibility version: ${expectedVersion}`);
  }
  const expectedTag = `v${expectedVersion}`;
  if (actualVersion !== expectedTag) {
    throw new Error(`Expected Node ${expectedTag}, selected ${actualVersion}`);
  }
  const lane: NodeRuntimeProof["lane"] = expectedVersion === "24.21.0"
    ? "production-default" : "node26-compatibility";
  return Object.freeze({ expectedVersion, actualVersion, lane });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const expectedVersion = process.argv[2];
  if (!expectedVersion) { throw new Error("Expected a Node version argument."); }
  const result = assertNodeRuntime(expectedVersion);
  console.log(`Node runtime proved: ${result.actualVersion} (${result.lane})`);
}
