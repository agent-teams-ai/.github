import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const minimumVersion = "7.0.2";
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
type Diagnostic = {
  readonly code: "TYPESCRIPT_COMPILER_FLOOR_BLOCKED";
  readonly minimumVersion: string;
  readonly role: string;
  readonly manifestPath: string | null;
  readonly reason: string;
  readonly observedVersion?: string;
  readonly dependency?: string;
};
type PackageInfo = {
  readonly role: string;
  readonly manifestPath: string;
  readonly version: string;
  readonly dependencies: Readonly<Record<string, unknown>>;
  readonly optionalDependencies: Readonly<Record<string, unknown>>;
};

export class CompilerFloorError extends Error {
  readonly diagnostic: Diagnostic;
  constructor(diagnostic: Diagnostic) {
    super(JSON.stringify(diagnostic));
    this.name = "CompilerFloorError";
    this.diagnostic = Object.freeze(diagnostic);
  }
}

function blocked(role: string, manifestPath: string | null, reason: string,
  details: Pick<Diagnostic, "observedVersion" | "dependency"> = {}): never {
  throw new CompilerFloorError({
    code: "TYPESCRIPT_COMPILER_FLOOR_BLOCKED", minimumVersion, role, manifestPath, reason, ...details,
  });
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readPackage(owner: NodeRequire, name: string, role: string): PackageInfo {
  let manifestPath: string | null = null;
  let value: unknown;
  try {
    manifestPath = realpathSync(owner.resolve(`${name}/package.json`));
    value = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch { blocked(role, manifestPath, "manifest-unavailable", { dependency: name }); }
  if (!isRecord(value) || value.name !== name || typeof value.version !== "string" || !stableVersion.test(value.version)) {
    blocked(role, manifestPath, "manifest-identity-invalid", { dependency: name });
  }
  return { role, manifestPath, version: value.version,
    dependencies: isRecord(value.dependencies) ? value.dependencies : {},
    optionalDependencies: isRecord(value.optionalDependencies) ? value.optionalDependencies : {} };
}
function compiler(owner: NodeRequire, role: string): PackageInfo {
  const found = readPackage(owner, "typescript", role);
  const parts = found.version.split(".").map(Number);
  const [major = 0, minor = 0, patch = 0] = parts;
  if (!parts.every(Number.isSafeInteger) || !(major > 7 || major === 7 && (minor > 0 || patch >= 2))) {
    blocked(role, found.manifestPath, "compiler-below-floor", { observedVersion: found.version });
  }
  return found;
}
function exactDependency(owner: PackageInfo, name: string, version: string): void {
  if (owner.dependencies[name] !== version) {
    blocked(owner.role, owner.manifestPath, "dependency-pin-mismatch", { dependency: name, observedVersion: version });
  }
}

/** Read only JSON through each owner's real resolution path; never import a tooling implementation. */
export function assertCompilerFloor(workspace: string = repositoryRoot): void {
  const repository = createRequire(join(resolve(workspace), "package.json"));
  compiler(repository, "repository.compiler");
  const foundation = readPackage(repository, "@agent-teams/engineering-foundation", "foundation");
  const foundationRequire = createRequire(foundation.manifestPath);
  const ownCompiler = compiler(foundationRequire, "foundation.compiler");
  if (Object.hasOwn(foundation.dependencies, "typescript")) {
    exactDependency(foundation, "typescript", ownCompiler.version);
  }
  if (Object.hasOwn(foundation.dependencies, "@microsoft/api-extractor")) {
    // Retain the actual legacy owner's compiler refusal before rejecting even
    // floor-compatible legacy wrappers; a native release has no extractor engine.
    const extractor = readPackage(foundationRequire, "@microsoft/api-extractor", "foundation.api-extractor");
    exactDependency(foundation, "@microsoft/api-extractor", extractor.version);
    const extractorCompiler = compiler(createRequire(extractor.manifestPath), "foundation.api-extractor.compiler");
    exactDependency(extractor, "typescript", extractorCompiler.version);
    blocked(extractor.role, extractor.manifestPath, "legacy-extractor-dependency");
  }
  exactDependency(foundation, "typescript", ownCompiler.version);
  const nativeName = `@typescript/typescript-${process.platform}-${process.arch}`;
  const native = readPackage(createRequire(ownCompiler.manifestPath), nativeName, "foundation.native.compiler");
  if (ownCompiler.optionalDependencies[nativeName] !== ownCompiler.version || native.version !== ownCompiler.version) {
    blocked(native.role, native.manifestPath, "native-compiler-pin-mismatch", { observedVersion: native.version });
  }
  for (const entry of ["typescript/unstable/async", "typescript/unstable/ast"]) {
    try { realpathSync(foundationRequire.resolve(entry)); }
    catch { blocked(ownCompiler.role, ownCompiler.manifestPath, "native-compiler-api-unavailable", { dependency: entry }); }
  }
  for (const name of ["@microsoft/api-extractor-model", "@microsoft/tsdoc"]) {
    const model = readPackage(foundationRequire, name, "foundation.api-model");
    exactDependency(foundation, name, model.version);
    if (["typescript", "@microsoft/api-extractor"].some(dependency => Object.hasOwn(model.dependencies, dependency))) {
      blocked(model.role, model.manifestPath, "mixed-model-compiler-dependency", { dependency: name });
    }
  }
}

if (process.argv[1] !== undefined && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    assertCompilerFloor();
    console.log(`TypeScript compiler metadata satisfies >=${minimumVersion}.`);
  } catch (cause) {
    if (!(cause instanceof CompilerFloorError)) { throw cause; }
    console.error(cause.message);
    process.exitCode = 1;
  }
}
