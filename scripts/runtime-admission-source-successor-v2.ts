import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

// Exact reviewed integration candidate; publication and protection installation remain separate.
export const TARGET = Object.freeze({
  repository: "agent-teams-ai/.github",
  repositoryId: 1316243981,
  pullRequest: 389,
  pullId: 4996927699,
  baseSHA: "c8f3e7ba220241f79292c84c72712653019aa1df",
  headSHA: "680192aed6f7c377bb639c637e0f29f09a2e20ec",
  baseTreeSHA: "c3c61b8fd179a1cd203e6c893002a3fc127085e1",
  headTreeSHA: "07bc1fee012e0068701f0810611938b3b0591eae",
  commits: 40,
} as const);
export const SOURCE_REF = "refs/heads/governance/runtime-admission-source-successor-v2";
export const SOURCE_WORKFLOW = ".github/workflows/runtime-admission-source-successor-v2.yml";
export const SOURCE_CONTEXT = "runtime-admission-source-successor-v2";
export const CALLER_WORKFLOW = ".github/workflows/runtime-admission-source-successor-v2-caller.yml";
export const ADR_PATH = "docs/decisions/0016-bounded-runtime-admission-source-successor-v2.md";
export const EVIDENCE_PATH =
  "governance/evidence/docs-source-successor/runtime-admission-source-successor-v2-installation.md";
export const PREVIOUS_INSTALL_PATHS = Object.freeze([
  ".github/workflows/docs-quality-source-successor-v3-caller.yml",
  "docs/decisions/0013-bounded-quality-source-successor-v3.md",
  "governance/evidence/docs-source-successor/quality-source-successor-v3-installation.md",
  ".github/workflows/docs-quality-source-successor-v2-caller.yml",
  "docs/decisions/0012-bounded-quality-source-successor-v2.md",
  "governance/evidence/docs-source-successor/quality-source-successor-v2-installation.md",
]);
export const PREVIOUS_SOURCE_REF = "refs/heads/governance/quality-source-successor-v3";
export const PREVIOUS_SOURCE_SHA = "c364ab2b82ad6250500110345982c3f1fa82181f";
export const PREVIOUS_SOURCE_INPUTS = Object.freeze([
  "scripts/docs-quality-source-successor-v3.ts",
  "scripts/docs-quality-source-successor-v3.test.ts",
  "scripts/docs-quality-source-successor-v3-target.ts",
  ".github/workflows/docs-quality-source-successor-v3.yml",
  "tsconfig.docs-quality-source-successor-v3.json",
  "scripts/docs-quality-source-successor-v2.ts",
  "scripts/docs-quality-source-successor-v2.test.ts",
  ".github/workflows/docs-quality-source-successor-v2.yml",
  "tsconfig.docs-quality-source-successor-v2.json",
]);
export const CANARY_WORKFLOW = ".github/workflows/runtime-admission-source-v2-canary.yml";
export const CANARY_REFS = Object.freeze([
  "refs/heads/qualification/runtime-admission-positive-v2",
  "refs/heads/qualification/runtime-admission-negative-v2",
]);
export const INSTALL_PATHS = Object.freeze([CALLER_WORKFLOW, ADR_PATH, EVIDENCE_PATH]);
export const LEGACY_INPUTS = Object.freeze([
  "scripts/check-docs-source-successor-v1.mts",
  "scripts/check-docs-source-successor-v1.test.mts",
  ".github/workflows/docs-source-successor-v1.yml",
  "docs/decisions/0009-bounded-docs-source-successor.md",
  "tsconfig.docs-source-successor.json",
]);
export const QUALITY_INPUTS = Object.freeze([
  "toolchain.config.json",
  "tsconfig.json",
  "scripts/quality-process.ts",
  "scripts/quality-process.test.ts",
  "scripts/run-governance-tests.ts",
  "scripts/run-governance-tests.test.ts",
]);
export const ADMISSION_INPUTS = Object.freeze([
  "governance/repository-registration-supplements.schema.json",
  "scripts/governance-schema.ts",
  "scripts/repository-registration.ts",
  "scripts/repository-bootstrap-observation.ts",
  "scripts/check-repository-admission.ts",
  "scripts/observe-org-repository-inventory.mjs",
  ".github/workflows/organization-inventory-drift.yml",
  "scripts/fixtures/commit-author-identity-caller.yml",
  ".github/workflows/repository-admission-check.yml",
  "scripts/compiler-floor.ts",
  "scripts/validate-renovate.ts",
  "scripts/validate-renovate-abi.probe.ts",
  ".github/workflows/node24-compatibility.yml",
]);
const ownerId = 13103045;
export const TARGET_TUPLE: readonly (readonly [string, string | null, string])[] = Object.freeze([
  [
    ".github/PULL_REQUEST_TEMPLATE.md",
    "077c1ee67ea7799c13d1c8743bdd04eff55a143d",
    "1761ed39d2ab23d847773ad43b7d96062b069b48",
  ],
  [
    ".github/workflows/ci.yml",
    "4036cdaa2a5b7eadf1ca96f737944851361e9361",
    "e42685135114b09ec026d542f30747ec9d8dddfe",
  ],
  [".github/workflows/node24-compatibility.yml", null, "f3950ece63fa24b20c105c534b1ea8af4b3d7182"],
  [
    ".github/workflows/repository-admission-check.yml",
    null,
    "1efa4642eec43744345ea7035bff514115a88f05",
  ],
  [
    "AGENTS.md",
    "7e14c60169c78bdfc2814d14d8344ad498f04a3c",
    "356dded05601dc8cd5bb24d4202c256f3a718345",
  ],
  [
    "CLAUDE.md",
    "0940ad807cad603f51e1265a0a51b91a8212ec0a",
    "408b249fded00c4c0b5415485d4f53c0db607b83",
  ],
  [
    "CONTRIBUTING.md",
    "27d1734fb72cc35992c515c142c05e065defadd0",
    "abd115f4b4c6257549b59c450a801b4502b46ad1",
  ],
  [
    "GOVERNANCE.md",
    "c85e3a23b4f8635e7c1b29adba2363042653af11",
    "15252712d578c18da12792101dbe0b5b319366bd",
  ],
  [
    "README.md",
    "d707550854ddabace25eaaf90444b77ed564e211",
    "4f11150d1037669bbc28997266c564531fe921cf",
  ],
  [
    "docs/development-tools.md",
    "f45a01e3d05ef14616e6753f9e7484bccb39a72d",
    "cd6f3943fa68ebe60287490cb7d35fe53b7da847",
  ],
  [
    "docs/engineering-quality-profile.json",
    "b9b9d47ade25f89ae4cfa473a7e8bf04059d7a1d",
    "b35b10ccab73a5c3f32fa2b15e49d3229b06922e",
  ],
  [
    "docs/engineering-quality-source-policy.yaml",
    "6bd6e5642447e7c9ddc10a657cfb4713377e6d49",
    "3150bc15964ee236be256020829e3f8c26279345",
  ],
  [
    "docs/engineering-quality-standard.md",
    "5b29203935881c3be8d7148a00a11ea9b77542cb",
    "615fdee6b71f1b5701e13221f22e7cce67a1e583",
  ],
  [
    "docs/engineering-quality.md",
    "463f176bf5a5160937085aab69e27fec152b2b1d",
    "a131069abf0f9f20d2236772aa327f910d580d28",
  ],
  ["docs/node-runtime-compatibility.md", null, "acb83a75d241f2baa0bbbaab767ee0627f6a3c64"],
  [
    "docs/repository-admission.md",
    "717d71ca05db1e52b60121ce2f1f7e8a0b73a331",
    "46301616f8fc03b0442db40bb4761411c6ea0c62",
  ],
  ["docs/repository-registration.md", null, "08561be2ad32a03e21fde7f048fb8b986ec1a974"],
  [
    "governance/repository-registration-supplements.json",
    null,
    "7a12afeea20faea98c1e5312cb37b916d23bb422",
  ],
  [
    "governance/repository-registration-supplements.schema.json",
    null,
    "d29d3df1f1cc63fc715ba58ae4859b7a16faf6a7",
  ],
  [
    "package.json",
    "9542bf9f5211ae8a89acf290a82d2b553e142fb2",
    "5ab4bcd5e495d684c9a235c90272b94689dca154",
  ],
  [
    "pnpm-lock.yaml",
    "2340d60ebb35b201ec9fe750c80c5a4c27286fcc",
    "c624f55d7ef1820c3c176eb2c228f2be7342fb68",
  ],
  [
    "pnpm-workspace.yaml",
    "9a05a3273fb51937da187364cfcb2825fe3725e4",
    "429c32263b08f411ed32384be6d2b4e3642638d8",
  ],
  [
    "scripts/check-community-files.mjs",
    "c8916d102d06c0712c66d7ffa691049550e4131e",
    "0d33a4af1a60df54f60a1252cbaff243b193594b",
  ],
  [
    "scripts/check-quality-scope.mjs",
    "d05b343016b84ca8f8edfe2914a856a06cfb8f76",
    "d3301c4392b140ce2fd601c91842ebfeff77e24d",
  ],
  [
    "scripts/check-quality-scope.test.mjs",
    "220da62c5f41f8d1cfa417f927e665d441c855b9",
    "f634839b047f37d92d23ffbfb16e4957774d24dd",
  ],
  ["scripts/check-repository-admission.test.ts", null, "e1e4471feaa9a2cdc29560ccfc384015c40ed947"],
  ["scripts/check-repository-admission.ts", null, "2029bb28d6ecf3a0d7f97cb35443fc67455a6b94"],
  ["scripts/compiler-floor.test.ts", null, "4ee4e481f7855cc1b39f8ac0d09f11181bd80336"],
  ["scripts/compiler-floor.ts", null, "ad1ea2749bf2f2b86f61ba9cbecd2e26249ba3cd"],
  [
    "scripts/governance-policy.mjs",
    "ec63503abb1a00e83debfc24c50653fefb486db7",
    "a0120e03d9f3cdae19231b7b8944b056186f59fd",
  ],
  [
    "scripts/governance-policy.test.mjs",
    "2c2eee38af7a6fa58fea0689d3ab31f3d866378d",
    "122d58e1dc4008c0189eb8e714bbb86e3f981acd",
  ],
  ["scripts/governance-schema.ts", null, "c7d518f82eee34285e9bb3830c27c6c013381a07"],
  [
    "scripts/observe-org-repository-inventory.mjs",
    "a0e250e5dace0b9780aa2d77cedada7eec498115",
    "062a10731e553c5f87cbc4ee9e6c84543a8e0ab0",
  ],
  [
    "scripts/read-docs-portable-authority-r322.test.mjs",
    "9553f1e3a1d4dbed08656cd54a6a574601657cb8",
    "21c0553b84f5dd53cbcfc8740745d8b4005450a3",
  ],
  [
    "scripts/repository-bootstrap-observation.test.ts",
    null,
    "23ac00152931e34eb20549d149ba811ee63d4d13",
  ],
  ["scripts/repository-bootstrap-observation.ts", null, "ebb56e1681ecad0f478d58977e9092961dcfea6e"],
  ["scripts/repository-registration.test.ts", null, "d0f460c7405bd46f3cc7a885bd309e3b31450e16"],
  ["scripts/repository-registration.ts", null, "65faa0a6b366df2c88a39ac2b8faffde7f037820"],
  [
    "scripts/validate-governance.mjs",
    "293f5e56669f1d7391090574dc0c310f022e2e41",
    "d538afbc586aadaaee764e06286365463dddd58b",
  ],
  ["scripts/validate-renovate-abi.probe.ts", null, "faf755c326c67646aa0a251ce046f08687841b54"],
  ["scripts/validate-renovate.test.ts", null, "d8f2bf2ac9b29b51c132bdd4e8e223a3e52e0767"],
  ["scripts/validate-renovate.ts", null, "aaa39084a054cc7f6c046d2f458bbf6b768dad5e"],
  [
    "toolchain.config.json",
    "6c5344d3a65b53afb10d4bb577498996f6d9bde8",
    "97b068b1b96227d9ef6bfd719a2aaa60ffb4e4b1",
  ],
  ["tools/renovate-validation/package.json", null, "e3d0a775c8bf28678afa9cd2ca2e9e7eedd131eb"],
  ["tools/renovate-validation/pnpm-lock.yaml", null, "822e84110f87b46576f72fce566469b94f989603"],
  [
    "tools/renovate-validation/pnpm-workspace.yaml",
    null,
    "2071f8a20fe474b01c1abd99cb1e3c1b638d6fd9",
  ],
  [
    "tsconfig.tooling.json",
    "9681b6ffc130db30c44558daa3d68d605f938f09",
    "0c9248ca92cdebdfcdf2b63a0a65f51ce5112226",
  ],
]);

export const TARGET_COMMITS: readonly string[] = Object.freeze([
  "0744eca43ce2134afaacda30700ef915fce464be",
  "0962931855b6b10bc9fd271f8bf69b33b82370cf",
  "242443d71d1188e1a4a8c52912c6957b4accf8ee",
  "25f8704e5727ee90477bd7b673382edb03d054d4",
  "2d709799de28543e791613982bc8a002a1d15402",
  "328815e3522d9183db61516284c890d5429c4a6d",
  "3ba63d1f28ccd6aac891173bf0f55e4337a24156",
  "3d0b2be14b1eda315dc71a1bcdfbf1885445cf86",
  "40198f2d9cf674374b3edf90a7c91cb3f2972370",
  "40cb631a65c901cd2a761cc9694f3c35be18f54b",
  "4cc3367ec06b97524371f780ffc42abe020f5fbf",
  "54d53d19f8e8bc89f6eb75049d84f62518d16d23",
  "578f822b36f3623cfee3c29f90510afe7facb131",
  "5ad75e5f327603923ec8a3a8d71a91d24b5b50e9",
  "62e3152199657a29d09d652a064c21abad0e32e7",
  "67a44ddbdbf1421c5a08cfdb4ae2d10591111c0d",
  "680192aed6f7c377bb639c637e0f29f09a2e20ec",
  "6d1fa7740d84cdf810b7c30f821c6e2ab1fd7b29",
  "6e77efe7ef0c686c9e95d4d361578c8c594aad13",
  "7064e4c57143d7caef963383b73294ea50f037e9",
  "71c8d476d83e5c0e60f94e118deb97a8d7c89f34",
  "75970f0095e96641f469f334e3220b3bf1d2ba72",
  "8142769da51f62b56468f4c04f46ee0b660dd802",
  "8417c5a35c62c14afb325dfefef2c4daa13ad03c",
  "8aa705402417a69a674bb461d1378a7e4c785b0e",
  "8e2e6f7be2473343d3956a9b95839392b5b36b72",
  "9d4e77100f356e91a397fe720f9e723757cbc928",
  "9ea1532af2d8abcf2b83f5ede207318a90cca83a",
  "9f5cb97e15b600e1c2a94655277be91a6e3f538d",
  "a00d63cf2a4c236edc486c7c17688c2bed00f9c0",
  "a33b2c4a43b6ef0d1fb6457c534575a82e80493e",
  "a5035495279c0cb750a2c9b898acab89cf94edbb",
  "aa314060b140314ad6513a9032efc28636bf7474",
  "c121401b90f76c6bed77ca7d0be86839726437c3",
  "d99e6aa92041a077d681b3c7cb8044c37b799ffa",
  "e3fe857020fe0f0112471f0f07c1d1605e27d3e8",
  "e4d301a3bf554957e5f75d5b90bf02a880085a64",
  "e4ff81a422e80dbed7dcf4b1771c57d529365bc5",
  "ec790f9e12c29c32c7dad1ad683a7d56476cacd3",
  "f0728e3338bdca470a10703cfd874f1bbebfa9af",
]);

export interface SourceTarget {
  readonly repository: string;
  readonly repositoryId: number;
  readonly pullRequest: number;
  readonly pullId: number;
  readonly baseSHA: string;
  readonly headSHA: string;
  readonly baseTreeSHA: string;
  readonly headTreeSHA: string;
}
export interface ProtectedExecutor {
  readonly repository: string;
  readonly sourceRef: string;
  readonly sourceSHA: string;
  readonly sourceTreeSHA: string;
  readonly workflowPath: string;
  readonly runId: number;
  readonly runAttempt: number;
  readonly event: "push" | "pull_request_target";
  readonly mode: "push" | "reusable" | "canary";
  readonly callerWorkflowRef: string;
  readonly callerWorkflowSHA: string;
  readonly pullRequest: number;
  readonly targetBaseSHA: string;
  readonly targetHeadSHA: string;
}
export interface CanaryExecutor extends Omit<
  ProtectedExecutor,
  "sourceTreeSHA" | "mode" | "pullRequest" | "targetBaseSHA"
> {
  readonly mode: "canary";
}
export type ExecutorInput = Omit<ProtectedExecutor, "sourceTreeSHA"> | CanaryExecutor;
export interface VerifiedDocument {
  readonly revision: string;
  readonly blob: string;
  readonly bytes: Buffer;
}
export type SourceDocuments = ReadonlyMap<string, VerifiedDocument>;
export interface GitHubReadApi {
  get(path: string): Promise<unknown>;
}
export interface GitHubStatusApi extends GitHubReadApi {
  postStatus(
    head: string,
    value: Readonly<{
      context: string;
      state: "pending" | "success" | "failure";
      target_url: string;
      description: string;
    }>,
  ): Promise<unknown>;
}
export interface GitEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: string;
  readonly sha: string;
  readonly size?: number;
}
export interface CompleteTree {
  readonly sha: string;
  readonly revision?: string;
  readonly entries: ReadonlyMap<string, GitEntry>;
}
export type ProtectionVisibility = "public_read" | "owner_full";
export const HOSTED_PROTECTION_OBSERVATION = Object.freeze({
  mode: "public_read",
  privateBypass: "not_attested",
  ownerFullReadRequiredForCutover: true,
} as const);

const repositoryRoot = "repos/agent-teams-ai/.github";
const oid = /^(?!0{40}$)[0-9a-f]{40}$/u;
const isMapping = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const object = (value: unknown): Record<string, unknown> => {
  assert.ok(isMapping(value), "Expected a mapping");
  return value;
};
const array = (value: unknown): unknown[] => {
  assert.ok(Array.isArray(value), "Expected an array");
  return value;
};
const positive = (value: unknown): number => {
  assert.ok(Number.isSafeInteger(value) && Number(value) > 0, "Expected a positive safe integer");
  return Number(value);
};
const sha = (value: unknown): string => {
  assert.ok(typeof value === "string" && oid.test(value), "Invalid Git identity");
  return value;
};
const pathValid = (value: unknown): value is string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4096 ||
    value.includes("\\")
  ) {
    return false;
  }
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code <= 31 || code === 127) {
      return false;
    }
  }
  return (
    Buffer.from(value).toString("utf8") === value &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
};
const gitHash = (kind: "blob" | "tree", bytes: Buffer): string =>
  createHash("sha1").update(`${kind} ${bytes.length}\0`).update(bytes).digest("hex");
const sameEntry = (left: GitEntry | undefined, right: GitEntry | undefined): boolean =>
  left === undefined
    ? right === undefined
    : right !== undefined &&
      left.path === right.path &&
      left.type === right.type &&
      left.mode === right.mode &&
      left.sha === right.sha;

const gitEntryName = (entry: GitEntry): string => entry.path.split("/").at(-1)!;

/** Rehash every directory, not only the API's declared root, to reject omissions. */
export function parseCompleteTree(raw: unknown, expectedSHA: string): CompleteTree {
  const data = object(raw);
  assert.equal(data.sha, sha(expectedSHA), "Unbound Git tree");
  assert.equal(data.truncated, false, "Truncated Git tree");
  const rawEntries = array(data.tree);
  assert.ok(rawEntries.length > 0 && rawEntries.length <= 20_000, "Invalid Git tree size");
  const entries = new Map<string, GitEntry>();
  for (const value of rawEntries) {
    const entry = object(value);
    assert.ok(pathValid(entry.path) && !entries.has(entry.path), "Invalid or duplicate Git path");
    const hash = sha(entry.sha);
    assert.ok(
      (entry.type === "tree" && entry.mode === "040000" && entry.size === undefined) ||
        (entry.type === "commit" && entry.mode === "160000" && entry.size === undefined) ||
        (entry.type === "blob" &&
          ["100644", "100755", "120000"].includes(String(entry.mode)) &&
          Number.isSafeInteger(entry.size) &&
          Number(entry.size) >= 0),
      "Invalid Git type, mode or size",
    );
    const normalized: GitEntry = {
      path: entry.path,
      type: entry.type,
      mode: String(entry.mode),
      sha: hash,
      ...(entry.size === undefined ? {} : { size: Number(entry.size) }),
    };
    entries.set(entry.path, normalized);
  }
  const children = new Map<string, GitEntry[]>([["", []]]);
  for (const entry of entries.values()) {
    if (entry.type === "tree") {
      children.set(entry.path, []);
    }
  }
  for (const entry of entries.values()) {
    const parent = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
    const siblings = children.get(parent);
    assert.ok(siblings, "Missing Git tree parent");
    siblings.push(entry);
  }
  for (const [path, direct] of children) {
    const sortKey = (entry: GitEntry): Buffer =>
      Buffer.from(gitEntryName(entry) + (entry.type === "tree" ? "/" : ""));
    direct.sort((left, right) => Buffer.compare(sortKey(left), sortKey(right)));
    const bytes = Buffer.concat(
      direct.flatMap((entry) => [
        Buffer.from(`${entry.mode.replace(/^0/u, "")} ${gitEntryName(entry)}\0`),
        Buffer.from(entry.sha, "hex"),
      ]),
    );
    assert.equal(
      gitHash("tree", bytes),
      path === "" ? expectedSHA : entries.get(path)!.sha,
      "Git tree metadata hash mismatch",
    );
  }
  return { sha: expectedSHA, entries };
}

export function assertSourceTuple(
  base: CompleteTree,
  head: CompleteTree,
  pages: readonly (readonly unknown[])[],
): void {
  assert.equal(base.sha, TARGET.baseTreeSHA, "Runtime/admission source base tree drift");
  assert.equal(head.sha, TARGET.headTreeSHA, "Runtime/admission source head tree drift");
  assert.ok(
    pages.length >= 1 &&
      pages.length <= 32 &&
      pages.every(
        (page, index) =>
          page.length <= 100 &&
          (index === pages.length - 1 ? page.length < 100 : page.length === 100),
      ),
    "Incomplete file pagination",
  );
  const files = pages.flat();
  assert.equal(files.length, TARGET_TUPLE.length, "Incomplete quality source file count");
  const observed = new Set<string>();
  for (const raw of files) {
    const file = object(raw);
    assert.ok(
      pathValid(file.filename) && !observed.has(file.filename),
      "Duplicate or invalid changed file",
    );
    observed.add(file.filename);
    const tuple = TARGET_TUPLE.find(([path]) => path === file.filename);
    assert.ok(tuple, "Unreviewed quality source file");
    const [path, before, after] = tuple;
    assert.equal(file.previous_filename, undefined, "Rename or copy metadata is forbidden");
    assert.equal(
      file.status,
      before === null ? "added" : "modified",
      "Wrong quality source file status",
    );
    assert.equal(file.sha, after, "Changed-file blob drift");
    const oldEntry = base.entries.get(path),
      newEntry = head.entries.get(path);
    assert.ok(
      before === null
        ? oldEntry === undefined
        : oldEntry?.mode === "100644" && oldEntry.type === "blob" && oldEntry.sha === before,
      `Quality source old regular blob mismatch: ${path}`,
    );
    assert.ok(
      newEntry?.mode === "100644" && newEntry.type === "blob" && newEntry.sha === after,
      `Quality source new regular blob mismatch: ${path}`,
    );
  }
  const changed = [...new Set([...base.entries.keys(), ...head.entries.keys()])].filter((path) => {
    const before = base.entries.get(path),
      after = head.entries.get(path);
    return !sameEntry(before, after) && before?.type !== "tree" && after?.type !== "tree";
  });
  assert.deepEqual(
    changed.toSorted(),
    [...observed].toSorted(),
    "Hidden or omitted quality source leaf",
  );
}

async function arrayPages(api: GitHubReadApi, endpoint: string): Promise<unknown[][]> {
  const pages: unknown[][] = [];
  for (let page = 1; page <= 32; page += 1) {
    const values = array(
      await api.get(`${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`),
    );
    assert.ok(values.length <= 100, "Oversized API page");
    pages.push(values);
    if (values.length < 100) {
      return pages;
    }
  }
  throw new Error("API pagination exceeded its finite bound");
}
async function readTree(api: GitHubReadApi, revision: string): Promise<CompleteTree> {
  const commit = object(await api.get(`${repositoryRoot}/git/commits/${sha(revision)}`));
  assert.equal(commit.sha, revision, "Unbound Git commit");
  const treeSHA = sha(object(commit.tree).sha);
  return {
    ...parseCompleteTree(
      await api.get(`${repositoryRoot}/git/trees/${treeSHA}?recursive=1`),
      treeSHA,
    ),
    revision,
  };
}
export async function readVerifiedDocument(
  api: GitHubReadApi,
  tree: CompleteTree,
  revision: string,
  path: string,
): Promise<VerifiedDocument> {
  const entry = tree.entries.get(path);
  assert.ok(
    entry?.type === "blob" &&
      entry.mode === "100644" &&
      entry.size !== undefined &&
      entry.size <= 8 * 1024 * 1024,
    `Required document is not a bounded regular blob: ${path}`,
  );
  const blob = object(await api.get(`${repositoryRoot}/git/blobs/${entry.sha}`));
  assert.ok(
    blob.sha === entry.sha &&
      blob.encoding === "base64" &&
      typeof blob.content === "string" &&
      blob.size === entry.size &&
      blob.content.length <= 12 * 1024 * 1024 &&
      /^[A-Za-z0-9+/=\r\n]*$/u.test(blob.content),
    "Unbound Git blob response",
  );
  const encoded = blob.content.replace(/[\r\n]/gu, ""),
    bytes = Buffer.from(encoded, "base64");
  assert.ok(
    bytes.toString("base64") === encoded &&
      bytes.length === entry.size &&
      gitHash("blob", bytes) === entry.sha,
    "Git blob content/length mismatch",
  );
  return { revision, blob: entry.sha, bytes };
}

function assertBypassObservation(
  rule: Record<string, unknown>,
  visibility: ProtectionVisibility,
): void {
  assert.ok(
    visibility === "public_read" || visibility === "owner_full",
    "Unknown protection observation mode",
  );
  // GitHub withholds bypass_actors from callers without ruleset write access.
  // Its absence is not an empty-list attestation. The owner must read it separately.
  if (visibility === "owner_full" || Object.hasOwn(rule, "bypass_actors")) {
    assert.deepEqual(
      rule.bypass_actors,
      [],
      "Protection rule permits bypass or private bypass evidence is missing",
    );
  }
  if (visibility === "owner_full" || Object.hasOwn(rule, "current_user_can_bypass")) {
    assert.equal(
      rule.current_user_can_bypass,
      "never",
      "Execution can bypass protection or caller evidence is missing",
    );
  }
}
function assertSourceLock(
  rulesets: readonly unknown[],
  refName: string,
  visibility: ProtectionVisibility,
): number {
  const matches = rulesets.map(object).filter((rule) => {
    if (rule.target !== "branch" || rule.enforcement !== "active") {
      return false;
    }
    const ref = object(object(rule.conditions).ref_name);
    return (
      JSON.stringify(ref.include) === JSON.stringify([refName]) &&
      JSON.stringify(ref.exclude) === "[]"
    );
  });
  assert.equal(matches.length, 1, "Exactly one dedicated active staging lock is required");
  const lock = matches[0]!;
  assert.equal(lock.source, TARGET.repository, "Staging lock must be repository-owned");
  assert.equal(lock.source_type, "Repository", "Staging lock ownership drift");
  assertBypassObservation(lock, visibility);
  const rules = array(lock.rules).map(object);
  assert.deepEqual(
    rules
      .map((rule) => rule.type)
      .toSorted((left, right) =>
        String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
      ),
    ["deletion", "non_fast_forward", "update"],
    "Incomplete staging source lock",
  );
  for (const rule of rules) {
    if (rule.type === "update") {
      // GitHub normalizes the explicit false parameter to a bare update rule.
      // Both documented forms forbid updates; the repository must also be non-fork.
      if (Object.hasOwn(rule, "parameters")) {
        assert.deepEqual(
          Object.keys(rule).toSorted(),
          ["parameters", "type"],
          "Unknown update lock fields",
        );
        assert.deepEqual(
          rule.parameters,
          { update_allows_fetch_and_merge: false },
          "Staging lock permits updates by fetch-and-merge",
        );
      } else {
        assert.deepEqual(Object.keys(rule), ["type"], "Unknown update lock fields");
      }
    } else {
      assert.deepEqual(Object.keys(rule), ["type"], "Unknown staging lock parameters");
    }
  }
  return positive(lock.id);
}
export function assertStagingProtection(
  rulesets: readonly unknown[],
  visibility: ProtectionVisibility = "owner_full",
): number {
  return assertSourceLock(rulesets, SOURCE_REF, visibility);
}
export function assertPreviousSourceProtection(
  rulesets: readonly unknown[],
  visibility: ProtectionVisibility = "owner_full",
): number {
  const id = assertSourceLock(rulesets, PREVIOUS_SOURCE_REF, visibility);
  assert.equal(id, 25832759, "Frozen v3 source lock identity drift");
  return id;
}
const nativeContexts = [
  "check",
  "trusted-admission-evidence",
  "trusted-admission-authority-evolution-v1",
  "trusted-validation",
  "docs-quality-source-successor-v3",
];
export function assertMainProtection(
  mainRaw: unknown,
  identityRaw: unknown,
  visibility: ProtectionVisibility = "owner_full",
): void {
  const main = object(mainRaw),
    identity = object(identityRaw);
  for (const [rule, expectedId] of [
    [main, 19979783],
    [identity, 24363205],
  ] as const) {
    assert.ok(
      rule.source === TARGET.repository &&
        rule.source_type === "Repository" &&
        rule.id === expectedId &&
        rule.enforcement === "active" &&
        rule.target === "branch",
      "Required main rule identity drift",
    );
    assert.deepEqual(
      object(rule.conditions).ref_name,
      { exclude: [], include: ["~DEFAULT_BRANCH"] },
      "Required main scope drift",
    );
    assertBypassObservation(rule, visibility);
  }
  const mainRules = array(main.rules).map(object),
    identityRules = array(identity.rules).map(object);
  assert.deepEqual(
    mainRules
      .map((rule) => rule.type)
      .toSorted((left, right) =>
        String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0,
      ),
    [
      "deletion",
      "non_fast_forward",
      "pull_request",
      "required_linear_history",
      "required_status_checks",
    ],
    "Main protection rule set drift",
  );
  assert.deepEqual(
    identityRules.map((rule) => rule.type),
    ["required_status_checks"],
    "Identity protection rule set drift",
  );
  const contexts = (rules: Record<string, unknown>[]): string[] => {
    const matches = rules.filter((rule) => rule.type === "required_status_checks");
    assert.equal(matches.length, 1);
    const parameters = object(matches[0]!.parameters);
    assert.equal(
      parameters.strict_required_status_checks_policy,
      true,
      "Strict checks must remain enabled",
    );
    assert.equal(parameters.do_not_enforce_on_create, false, "Creation check enforcement drift");
    const checks = array(parameters.required_status_checks).map(object);
    assert.ok(
      checks.every((check) => typeof check.context === "string" && check.integration_id === 15368),
      "Required check App drift",
    );
    assert.equal(
      new Set(checks.map((check) => check.context)).size,
      checks.length,
      "Duplicate required context",
    );
    return checks.map((check) => String(check.context)).toSorted();
  };
  const observed = contexts(mainRules);
  const bridge = nativeContexts.filter((name) => name !== "docs-quality-source-successor-v3");
  const admittedSets = [
    nativeContexts,
    [...nativeContexts, SOURCE_CONTEXT],
    [...bridge, SOURCE_CONTEXT],
  ].map((names) => names.toSorted());
  assert.ok(
    admittedSets.some((names) => JSON.stringify(names) === JSON.stringify(observed)),
    "Unapproved main required-context transition",
  );
  assert.deepEqual(
    contexts(identityRules),
    ["commit-author-identity"],
    "Identity requirement must remain unchanged",
  );
  const pullRule = object(mainRules.find((rule) => rule.type === "pull_request")!.parameters);
  assert.deepEqual(
    pullRule,
    {
      required_approving_review_count: 0,
      dismiss_stale_reviews_on_push: true,
      required_reviewers: [],
      require_code_owner_review: false,
      dismissal_restriction: { enabled: false, allowed_actors: [] },
      require_last_push_approval: false,
      required_review_thread_resolution: true,
      require_extra_approval_for_unattributed_changes: true,
      allowed_merge_methods: ["squash"],
    },
    "Main PR protections changed",
  );
}

/** Pure proposals. Installation restores the predecessor before retiring the
 * temporary successor requirement; no route creates an unprotected interval. */
export function planProtectionTransition(
  mainRaw: unknown,
  identityRaw: unknown,
  phase: "add" | "retire" | "restore" | "install",
) {
  assert.ok(["add", "retire", "restore", "install"].includes(phase), "Unknown cutover phase");
  assertMainProtection(mainRaw, identityRaw, "owner_full");
  const main = structuredClone(object(mainRaw)),
    identity = structuredClone(object(identityRaw));
  const predecessor = "docs-quality-source-successor-v3";
  const status = array(main.rules)
    .map(object)
    .find((rule) => rule.type === "required_status_checks")!;
  const parameters = object(status.parameters),
    checks = array(parameters.required_status_checks).map(object);
  const hasPredecessor = checks.some((check) => check.context === predecessor);
  const hasSuccessor = checks.some((check) => check.context === SOURCE_CONTEXT);
  if (phase === "add") {
    assert.ok(hasPredecessor, "Predecessor must remain during additive cutover");
    assert.ok(!hasSuccessor, "Successor is already required; read back current protections");
    checks.push({ context: SOURCE_CONTEXT, integration_id: 15368 });
  } else if (phase === "restore") {
    assert.ok(hasSuccessor && !hasPredecessor, "Restore requires the successor-only state");
    checks.push({ context: predecessor, integration_id: 15368 });
  } else {
    assert.ok(
      hasPredecessor && hasSuccessor,
      "Retirement requires the already-installed predecessor AND successor bridge",
    );
  }
  parameters.required_status_checks = checks.filter((check) =>
    phase === "retire"
      ? check.context !== predecessor
      : phase === "install"
        ? check.context !== SOURCE_CONTEXT
        : true,
  );
  assertMainProtection(main, identity, "owner_full");
  return { phase, installation: "proposal-only-not-hosted-proof", main, identity };
}

/** Check actual checkout bytes, including all tracked resolution/configuration inputs. */
export async function assertLocalSource(
  tree: CompleteTree,
  root = new URL("../", import.meta.url),
): Promise<void> {
  const directory = fileURLToPath(root);
  const git = (...args: string[]): string =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      timeout: 20_000,
      maxBuffer: 8 * 1024 * 1024,
    }).trim();
  assert.equal(
    git("rev-parse", "HEAD"),
    sha(tree.revision),
    "Local checkout commit is not the actual protected source event",
  );
  assert.equal(
    git("rev-parse", "HEAD^{tree}"),
    tree.sha,
    "Local checkout tree is not the protected source tree",
  );
  assert.equal(
    git("status", "--porcelain=v1", "--untracked-files=all"),
    "",
    "Modified or untracked staging source",
  );
  for (const entry of tree.entries.values()) {
    const localPath = join(directory, ...entry.path.split("/")),
      info = await lstat(localPath);
    assert.ok(!info.isSymbolicLink(), `Symlinked checkout input: ${entry.path}`);
    if (entry.type === "tree") {
      assert.ok(info.isDirectory(), "Checkout source directory type drift");
      continue;
    }
    assert.equal(entry.mode, "100644", "Staged execution permits only regular source blobs");
    assert.ok(info.isFile(), "Checkout source input is not regular");
    const bytes = await readFile(localPath);
    assert.equal(gitHash("blob", bytes), entry.sha, `Checkout source blob drift: ${entry.path}`);
  }
}

export const BOOTSTRAP_INPUTS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".npmrc",
  "tools/renovate-validation/package.json",
  "tools/renovate-validation/pnpm-lock.yaml",
  "tools/renovate-validation/pnpm-workspace.yaml",
]);
const bootstrapDirectories = [".", "tools/renovate-validation"];
const hookSettings = ["pnpmfile", "global-pnpmfile", "configDependencies"];

async function assertAbsent(path: string, label: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if (object(error).code === "ENOENT") {
      return;
    }
    throw error;
  }
  assert.fail(label);
}

export const bootstrapGlobalConfigPath = (environment: NodeJS.ProcessEnv): string =>
  join(environment.XDG_CONFIG_HOME || join(homedir(), ".config"), "pnpm", "config.yaml");

/** No pnpm process may start before ambient executable configuration is excluded. */
export async function assertBootstrapEnvironment(
  root: URL,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  assert.equal(process.platform, "linux", "Source bootstrap is qualified only on its Linux runner");
  assert.ok(
    !Object.keys(environment).some((key) => /^(?:pnpm|npm)_config_/iu.test(key)),
    "Ambient package-manager configuration overrides are forbidden before bootstrap",
  );
  // pnpm11.18 dirs.js: Linux uses XDG_CONFIG_HOME/pnpm or ~/.config/pnpm.
  // System/user npmrc sources supply registry/auth settings, not executable YAML settings.
  const globalConfig = bootstrapGlobalConfigPath(environment);
  assert.ok(isAbsolute(globalConfig), "Bootstrap global pnpm configuration path must be absolute");
  await assertAbsent(
    globalConfig,
    "Ambient global pnpm YAML configuration is forbidden before bootstrap",
  );
  for (const directory of bootstrapDirectories) {
    for (const name of [".pnpmfile.cjs", ".pnpmfile.mjs"]) {
      await assertAbsent(
        join(fileURLToPath(root), directory, name),
        "Local pnpm hook files or symlinks are forbidden before bootstrap",
      );
    }
  }
}

export function assertBootstrapConfiguration(raw: unknown): void {
  const settings = object(raw);
  for (const key of hookSettings) {
    assert.equal(settings[key], undefined, `Executable pnpm setting is forbidden: ${key}`);
  }
  assert.equal(settings.engineStrict, true, "Bootstrap engine enforcement changed");
  assert.equal(settings.strictPeerDependencies, true, "Bootstrap peer enforcement changed");
  assert.equal(settings.verifyDepsBeforeRun, "error", "Bootstrap dependency verification changed");
}

/** Builtin-only source proof; no pnpm process may run before this on each fresh runner. */
export async function preflightBootstrap(
  sourceSHA: string,
  root = new URL("../", import.meta.url),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CompleteTree> {
  await assertBootstrapEnvironment(root, environment);
  const directory = fileURLToPath(root);
  const git = (...args: string[]): Buffer =>
    execFileSync("git", args, {
      cwd: directory,
      env: environment,
      timeout: 20_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  assert.equal(
    git("rev-parse", "HEAD").toString().trim(),
    sha(sourceSHA),
    "Bootstrap checkout is not the protected source",
  );
  const rawEntries = git("ls-tree", "-r", "-t", "-l", "-z", sourceSHA)
    .toString()
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("\t");
      assert.ok(separator > 0);
      const [mode, type, hash, size] = line.slice(0, separator).trim().split(/\s+/u);
      assert.ok(mode && type && hash && size);
      return {
        path: line.slice(separator + 1),
        mode,
        type,
        sha: hash,
        ...(size === "-" ? {} : { size: Number(size) }),
      };
    });
  const treeSHA = git("rev-parse", `${sourceSHA}^{tree}`).toString().trim();
  const tree = {
    ...parseCompleteTree({ sha: treeSHA, truncated: false, tree: rawEntries }, treeSHA),
    revision: sourceSHA,
  };
  await assertLocalSource(tree, root);
  for (const path of BOOTSTRAP_INPUTS) {
    const entry = tree.entries.get(path);
    assert.ok(
      entry?.mode === "100644" && entry.type === "blob",
      `Bootstrap input must be a regular blob: ${path}`,
    );
    const reviewed = git("show", `${TARGET.headSHA}:${path}`);
    assert.equal(
      entry.sha,
      gitHash("blob", reviewed),
      `Bootstrap install control differs from reviewed H: ${path}`,
    );
  }
  assert.ok(
    [...tree.entries.keys()].every(
      (path) => ![".pnpmfile.cjs", ".pnpmfile.mjs"].includes(basename(path)),
    ),
    "Tracked pnpm hook files are forbidden before bootstrap",
  );
  return tree;
}

/** Scoped metadata proof after pinned package-manager setup, before either installation. */
export async function qualifyBootstrap(
  sourceSHA: string,
  root = new URL("../", import.meta.url),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const tree = await preflightBootstrap(sourceSHA, root, environment);
  const directory = fileURLToPath(root);
  const read = (args: string[], cwd: string): string =>
    execFileSync("pnpm", args, {
      cwd,
      env: environment,
      encoding: "utf8",
      timeout: 20_000,
      maxBuffer: 64 * 1024,
    }).trim();
  assert.equal(read(["--version"], directory), "11.18.0", "Bootstrap requires exact pnpm11.18.0");
  // H's reviewed controls have no configDependencies. Global YAML and config overrides
  // were rejected before pnpm; these reads cannot load or resolve an ambient plugin.
  for (const child of bootstrapDirectories) {
    const settings: Record<string, unknown> = {};
    for (const key of [
      ...hookSettings,
      "engineStrict",
      "strictPeerDependencies",
      "verifyDepsBeforeRun",
    ]) {
      const value = read(
        [
          "--config.ignore-pnpmfile=true",
          "--config.ignore-scripts=true",
          "--config.frozen-lockfile=true",
          "--config.offline=true",
          "config",
          "get",
          key,
          "--json",
        ],
        join(directory, child),
      );
      settings[key] =
        value === "" || value === "undefined" ? undefined : (JSON.parse(value) as unknown);
    }
    assertBootstrapConfiguration(settings);
  }
  await assertLocalSource(tree, root);
  await assertBootstrapEnvironment(root, environment);
}

function repoIdentity(raw: unknown): Record<string, unknown> {
  const repo = object(raw);
  assert.ok(
    repo.id === TARGET.repositoryId && repo.full_name === TARGET.repository,
    "Repository identity drift",
  );
  return repo;
}

const human = (raw: unknown): boolean => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return false;
  }
  const account = object(raw);
  return (
    account.type === "User" &&
    typeof account.login === "string" &&
    account.login.length > 0 &&
    !/\[bot\]|^(github|web-flow)$/iu.test(account.login)
  );
};
const personMetadata = (raw: unknown): Record<string, unknown> => {
  const person = object(raw);
  assert.ok(
    typeof person.name === "string" &&
      person.name.trim().length > 0 &&
      typeof person.email === "string" &&
      person.email.includes("@"),
    "Missing Git author metadata",
  );
  return person;
};
/** Source-owned implementation of the reviewed exact owner-name-alias policy; raw strings never grant owner authority. */
export function assertCommitIdentity(
  pullRaw: unknown,
  commitValues: readonly unknown[],
  openPullValues: readonly unknown[],
): string {
  const pull = object(pullRaw),
    headSHA = sha(object(pull.head).sha);
  assert.ok(human(pull.user), "Bot/GitHub PR authors are forbidden");
  assert.ok(
    Number.isSafeInteger(pull.commits) && Number(pull.commits) >= 1 && Number(pull.commits) <= 250,
    "Complete commit evidence requires 1..250 PR commits",
  );
  const commits = commitValues.map(object);
  assert.ok(
    commits.length === pull.commits &&
      new Set(commits.map((commit) => sha(commit.sha))).size === commits.length &&
      commits.at(-1)!.sha === headSHA,
    "Incomplete or mismatched current-head commit evidence",
  );
  for (const commit of commits) {
    const author = personMetadata(object(commit.commit).author);
    assert.ok(
      !/\[bot\]|^(github|web-flow)$/iu.test(String(author.name).trim()) &&
        !/\[bot\]|^noreply@github\.com$/iu.test(String(author.email).trim()) &&
        (commit.author === null || human(commit.author)),
      "Bot/GitHub commit AUTHOR is forbidden",
    );
    assert.ok(
      !/^(?:codex|openai(?: codex)?)$/iu.test(String(author.name).trim()) &&
        !/^(?:codex|openai)@(?:openai\.com|users\.noreply\.github\.com)$/iu.test(
          String(author.email).trim(),
        ),
      "Codex/OpenAI source AUTHOR is forbidden",
    );
    const ownerClaim = (role: "author" | "committer"): boolean => {
      const account = commit[role] === null ? undefined : object(commit[role]),
        person = object(object(commit.commit)[role]);
      const name = typeof person.name === "string" ? person.name.trim().toLowerCase() : undefined;
      return (
        (typeof account?.login === "string" && account.login.toLowerCase() === "777genius") ||
        name === "777genius" ||
        (typeof person.email === "string" &&
          person.email.trim().toLowerCase() === "iliyazelenkog@gmail.com") ||
        (account === undefined && ["iliya", "илия"].includes(String(name)))
      );
    };
    if ((["author", "committer"] as const).some(ownerClaim)) {
      for (const role of ["author", "committer"] as const) {
        const account = object(commit[role]),
          person = personMetadata(object(commit.commit)[role]);
        assert.ok(
          account.type === "User" && account.login === "777genius" && account.id === ownerId,
          "Owner source requires actual User/777genius author AND committer associations",
        );
        assert.ok(
          ["iliya", "Илия"].includes(String(person.name)) &&
            person.email === "iliyazelenkog@gmail.com",
          "Owner source requires exact iliya/Илия and owner email in BOTH roles",
        );
        assert.ok(
          !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(String(person.name)) &&
            /^[^\s@]+@[^\s@]+$/u.test(person.email) &&
            !/\[bot\]|^(github|web-flow|codex|openai(?: codex)?)$/iu.test(
              String(person.name).trim(),
            ) &&
            !/\[bot\]|^noreply@github\.com$|^(?:codex|openai)@(?:openai\.com|users\.noreply\.github\.com)$/iu.test(
              person.email,
            ),
          "Owner source requires valid non-Bot/non-Codex raw metadata in BOTH roles",
        );
      }
    }
  }
  const matching = openPullValues.map(object).filter((value) => object(value.head).sha === headSHA);
  assert.ok(
    matching.some((value) => value.number === pull.number) &&
      matching.every((value) => human(value.user)),
    "Conflicting Bot/GitHub PR author on the same head",
  );
  return JSON.stringify({
    commits,
    sameHead: matching
      .map((value) => [value.number, value.id, value.user, object(value.head).sha])
      .toSorted((left, right) => Number(left[0]) - Number(right[0])),
  });
}

export function targetPullSnapshot(raw: unknown, exact = true): string {
  const pull = object(raw),
    base = object(pull.base),
    head = object(pull.head);
  repoIdentity(base.repo);
  repoIdentity(head.repo);
  assert.ok(
    pull.state === "open" &&
      pull.merged === false &&
      typeof pull.draft === "boolean" &&
      base.ref === "main" &&
      typeof head.ref === "string" &&
      head.ref.length > 0 &&
      Number.isSafeInteger(pull.changed_files) &&
      Number(pull.changed_files) >= 1 &&
      Number(pull.changed_files) <= 3000,
    "Invalid live source PR metadata",
  );
  positive(pull.number);
  positive(pull.id);
  sha(base.sha);
  sha(head.sha);
  if (exact) {
    const actor = object(pull.user);
    assert.ok(
      pull.number === TARGET.pullRequest &&
        pull.id === TARGET.pullId &&
        !pull.draft &&
        base.sha === TARGET.baseSHA &&
        head.sha === TARGET.headSHA &&
        pull.changed_files === TARGET_TUPLE.length &&
        pull.commits === TARGET.commits &&
        actor.type === "User" &&
        actor.login === "777genius" &&
        actor.id === ownerId,
      "Live exact runtime/admission tuple drift",
    );
  }
  return JSON.stringify([
    pull.id,
    pull.number,
    pull.state,
    pull.merged,
    pull.draft,
    base.sha,
    head.sha,
    base.ref,
    head.ref,
    pull.changed_files,
    pull.commits,
    pull.user,
    pull.updated_at,
  ]);
}

export function executorFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  event?: unknown,
): ExecutorInput {
  const runId = Number(environment.GITHUB_RUN_ID),
    runAttempt = Number(environment.GITHUB_RUN_ATTEMPT);
  assert.ok(
    /^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ID ?? "") &&
      /^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ATTEMPT ?? ""),
    "Invalid real run coordinates",
  );
  positive(runId);
  positive(runAttempt);
  assert.equal(environment.GITHUB_REPOSITORY, TARGET.repository, "Wrong execution repository");
  assert.equal(
    environment.SOURCE_WORKFLOW_REPOSITORY,
    TARGET.repository,
    "Wrong called source repository",
  );
  assert.equal(
    environment.SOURCE_WORKFLOW_PATH,
    SOURCE_WORKFLOW,
    "Wrong called source workflow path",
  );
  const sourceSHA = sha(environment.SOURCE_WORKFLOW_SHA),
    callerWorkflowSHA = sha(environment.GITHUB_WORKFLOW_SHA);
  const common = {
    repository: TARGET.repository,
    sourceRef: SOURCE_REF,
    sourceSHA,
    workflowPath: SOURCE_WORKFLOW,
    runId,
    runAttempt,
    callerWorkflowRef: String(environment.GITHUB_WORKFLOW_REF),
    callerWorkflowSHA,
  };
  if (environment.GITHUB_EVENT_NAME === "push") {
    if (CANARY_REFS.includes(String(environment.GITHUB_REF))) {
      const ref = String(environment.GITHUB_REF),
        headSHA = sha(environment.GITHUB_SHA),
        payload = object(event);
      assert.equal(payload.ref, ref, "Canary payload ref differs from actual event");
      assert.equal(payload.after, headSHA, "Canary payload head differs from actual event");
      assert.equal(payload.deleted, false, "Deleted canary source");
      repoIdentity(payload.repository);
      assert.equal(callerWorkflowSHA, headSHA, "Canary defining caller is not event-head owned");
      assert.equal(
        environment.SOURCE_WORKFLOW_REF,
        `${TARGET.repository}/${SOURCE_WORKFLOW}@${sourceSHA}`,
        "Canary must pin immutable source",
      );
      assert.equal(
        environment.GITHUB_WORKFLOW_REF,
        `${TARGET.repository}/${CANARY_WORKFLOW}@${ref}`,
        "Wrong canary caller",
      );
      return { ...common, mode: "canary", event: "push", targetHeadSHA: headSHA };
    }
    assert.equal(environment.GITHUB_REF, SOURCE_REF, "Wrong staging push ref");
    assert.equal(environment.GITHUB_SHA, sourceSHA, "Push source and genuine event SHA differ");
    assert.equal(callerWorkflowSHA, sourceSHA, "Push defining workflow SHA differs");
    assert.equal(
      environment.SOURCE_WORKFLOW_REF,
      `${TARGET.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`,
      "Wrong push defining workflow ref",
    );
    assert.equal(
      environment.GITHUB_WORKFLOW_REF,
      environment.SOURCE_WORKFLOW_REF,
      "Push workflow provenance differs",
    );
    return {
      ...common,
      mode: "push",
      event: "push",
      pullRequest: TARGET.pullRequest,
      targetBaseSHA: TARGET.baseSHA,
      targetHeadSHA: TARGET.headSHA,
    };
  }
  assert.equal(
    environment.GITHUB_EVENT_NAME,
    "pull_request_target",
    "Unsupported source successor event",
  );
  assert.equal(
    environment.SOURCE_WORKFLOW_REF,
    `${TARGET.repository}/${SOURCE_WORKFLOW}@${sourceSHA}`,
    "Reusable workflow must use an immutable source SHA",
  );
  assert.equal(
    environment.GITHUB_WORKFLOW_REF,
    `${TARGET.repository}/${CALLER_WORKFLOW}@refs/heads/main`,
    "Wrong protected main caller",
  );
  assert.equal(environment.GITHUB_REF, "refs/heads/main", "Caller is not protected main");
  const pull = object(object(event).pull_request);
  targetPullSnapshot(pull, false);
  const baseSHA = sha(object(pull.base).sha),
    headSHA = sha(object(pull.head).sha);
  assert.equal(environment.GITHUB_SHA, baseSHA, "Caller event is not the actual target base");
  assert.equal(callerWorkflowSHA, baseSHA, "Main caller workflow is not target-base owned");
  return {
    ...common,
    mode: "reusable",
    event: "pull_request_target",
    pullRequest: positive(pull.number),
    targetBaseSHA: baseSHA,
    targetHeadSHA: headSHA,
  };
}

export function callerWorkflowDefinition(sourceSHA: string): object {
  const permissions = {
    actions: "read",
    contents: "read",
    "pull-requests": "read",
    statuses: "write",
  };
  return {
    name: "Trusted Runtime and Admission Source Successor V1",
    on: { pull_request_target: { types: ["opened", "synchronize", "reopened", "edited"] } },
    permissions,
    jobs: {
      source: { uses: `${TARGET.repository}/${SOURCE_WORKFLOW}@${sha(sourceSHA)}`, permissions },
    },
  };
}

export function canaryWorkflowDefinition(sourceSHA: string): object {
  const permissions = {
    actions: "read",
    contents: "read",
    "pull-requests": "read",
    statuses: "write",
  };
  return {
    name: "Runtime and Admission Source Canary V1",
    on: { push: { branches: CANARY_REFS.map((ref) => ref.slice("refs/heads/".length)) } },
    permissions,
    jobs: {
      source: { uses: `${TARGET.repository}/${SOURCE_WORKFLOW}@${sha(sourceSHA)}`, permissions },
    },
  };
}
export async function assertCanaryWorkflow(bytes: Buffer, sourceSHA: string): Promise<void> {
  const { parse } = await import("yaml");
  assert.deepEqual(
    parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    canaryWorkflowDefinition(sourceSHA),
    "Canary caller differs from canonical inputless immutable source contract",
  );
}

/** Resolve only a genuine canary push; neither inputs nor branch names can select a protected exception. */
export async function resolveExecutionTarget(
  api: GitHubReadApi,
  input: ExecutorInput,
): Promise<Omit<ProtectedExecutor, "sourceTreeSHA">> {
  if (input.mode !== "canary") {
    return input;
  }
  const prefix = `${TARGET.repository}/${CANARY_WORKFLOW}@`,
    ref = input.callerWorkflowRef.slice(prefix.length);
  assert.ok(
    input.callerWorkflowRef.startsWith(prefix) &&
      CANARY_REFS.includes(ref) &&
      input.callerWorkflowSHA === input.targetHeadSHA,
    "Unbound canary caller target",
  );
  const values = (await arrayPages(api, `${repositoryRoot}/pulls?state=open&base=main`))
    .flat()
    .map(object);
  const matches = values.filter(
    (value) =>
      object(value.head).sha === input.targetHeadSHA &&
      object(value.head).ref === ref.slice("refs/heads/".length) &&
      object(object(value.head).repo).full_name === TARGET.repository,
  );
  assert.equal(
    matches.length,
    1,
    "Canary must identify exactly one current open PR for its actual push head/ref",
  );
  const pull = object(await api.get(`${repositoryRoot}/pulls/${positive(matches[0]!.number)}`));
  targetPullSnapshot(pull, false);
  assert.ok(
    object(pull.head).sha === input.targetHeadSHA &&
      object(pull.head).ref === ref.slice("refs/heads/".length) &&
      pull.draft === false &&
      object(pull.user).id === ownerId &&
      object(pull.user).login === "777genius",
    "Live canary target drift",
  );
  return {
    ...input,
    pullRequest: positive(pull.number),
    targetBaseSHA: sha(object(pull.base).sha),
  };
}

export async function assertCallerWorkflow(bytes: Buffer, sourceSHA: string): Promise<void> {
  const { parse } = await import("yaml");
  assert.deepEqual(
    parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    callerWorkflowDefinition(sourceSHA),
    "Main caller does not pin the exact reviewed source/runtime contract",
  );
}

function assertFiles(
  base: CompleteTree,
  head: CompleteTree,
  pages: readonly (readonly unknown[])[],
  count: number,
): unknown[] {
  assert.ok(
    pages.length >= 1 &&
      pages.length <= 32 &&
      pages.every(
        (page, index) =>
          page.length <= 100 &&
          (index === pages.length - 1 ? page.length < 100 : page.length === 100),
      ),
    "Incomplete file pagination",
  );
  const files = pages.flat(),
    seen = new Set<string>(),
    declared = new Set<string>();
  assert.equal(files.length, count, "Changed file count drift");
  for (const raw of files) {
    const file = object(raw);
    assert.ok(
      pathValid(file.filename) && !seen.has(file.filename),
      "Invalid or duplicate changed file",
    );
    seen.add(file.filename);
    declared.add(file.filename);
    sha(file.sha);
    assert.ok(
      ["added", "modified", "removed", "renamed", "copied", "changed"].includes(
        String(file.status),
      ),
      "Unknown file status",
    );
    assert.ok(
      file.previous_filename === undefined || pathValid(file.previous_filename),
      "Invalid rename origin",
    );
    if (file.status === "renamed") {
      assert.ok(
        pathValid(file.previous_filename) && base.entries.has(file.previous_filename),
        "Missing rename origin",
      );
      declared.add(file.previous_filename);
    }
    const selected = (file.status === "removed" ? base : head).entries.get(file.filename);
    assert.ok(
      selected && selected.type !== "tree" && selected.sha === file.sha,
      "Changed file is not bound to its complete Git tree",
    );
    if (file.status === "added") {
      assert.equal(base.entries.get(file.filename), undefined, "Added file already exists");
    }
    if (file.status === "removed") {
      assert.equal(head.entries.get(file.filename), undefined, "Removed file still exists");
    }
  }
  const changed = [...new Set([...base.entries.keys(), ...head.entries.keys()])].filter((path) => {
    const before = base.entries.get(path),
      after = head.entries.get(path);
    assert.ok(
      !before || !after || (before.type === "tree") === (after.type === "tree"),
      "Ancestor directory replacement",
    );
    return !sameEntry(before, after) && before?.type !== "tree" && after?.type !== "tree";
  });
  assert.deepEqual(
    changed.toSorted(),
    [...declared].toSorted(),
    "Hidden or spurious changed Git leaf",
  );
  return files;
}

function assertPreserved(
  base: CompleteTree,
  head: CompleteTree,
  paths: readonly string[],
  allowAbsent = false,
): void {
  for (const path of paths) {
    const before = base.entries.get(path),
      after = head.entries.get(path);
    if (allowAbsent && before === undefined && after === undefined) {
      continue;
    }
    assert.ok(
      before?.type === "blob" &&
        before.mode === "100644" &&
        after?.type === "blob" &&
        after.mode === "100644" &&
        sameEntry(before, after),
      `Protected v2 input changed or missing: ${path}`,
    );
  }
}

export async function checkSourceSuccessor(
  raw: unknown,
  baseManifest: Buffer,
  baseLock: Buffer,
  sourceSHA: string,
): Promise<string> {
  sha(sourceSHA);
  const evidence = object(raw),
    rawBase = object(evidence.baseTree),
    rawHead = object(evidence.headTree);
  assert.equal(evidence.repository, TARGET.repository, "Wrong source envelope repository");
  positive(evidence.pullRequest);
  sha(evidence.baseSHA);
  sha(evidence.headSHA);
  assert.equal(evidence.sourceSHA, evidence.headSHA, "Legacy target source must be its live head");
  assert.equal(evidence.baseRef, "main");
  assert.equal(evidence.defaultBranch, "main");
  assert.equal(evidence.headRepository, TARGET.repository);
  assert.equal(evidence.paginationComplete, true);
  const live = object(evidence.live);
  assert.equal(live.state, "open", "Target is not open");
  for (const key of [
    "pullRequest",
    "repository",
    "baseSHA",
    "headSHA",
    "sourceSHA",
    "baseRef",
    "defaultBranch",
    "headRepository",
    "changedFiles",
  ]) {
    assert.equal(live[key], evidence[key], `Live source envelope drift: ${key}`);
  }
  const base = parseCompleteTree(rawBase, sha(rawBase.sha)),
    head = parseCompleteTree(rawHead, sha(rawHead.sha));
  for (const [path, bytes] of [
    ["package.json", baseManifest],
    ["pnpm-lock.yaml", baseLock],
  ] as const) {
    const entry = base.entries.get(path);
    assert.ok(
      entry?.type === "blob" &&
        entry.mode === "100644" &&
        gitHash("blob", bytes) === entry.sha &&
        entry.size === bytes.length,
      `Actual target-base install bytes are unbound: ${path}`,
    );
  }
  const flat = array(evidence.files);
  const pages = Array.from({ length: Math.floor(flat.length / 100) + 1 }, (_, index) =>
    flat.slice(index * 100, (index + 1) * 100),
  );
  assertFiles(base, head, pages, Number(evidence.changedFiles));
  if (
    evidence.pullRequest === TARGET.pullRequest &&
    evidence.baseSHA === TARGET.baseSHA &&
    evidence.headSHA === TARGET.headSHA
  ) {
    assert.equal(evidence.repository, TARGET.repository);
    assert.equal(evidence.sourceSHA, TARGET.headSHA);
    assert.equal(evidence.paginationComplete, true);
    assertSourceTuple(base, head, pages);
    // Only this exact tuple may expand adoption/admission inputs. All four runtime
    // helpers and both legacy verifier files are unchanged, including their tests.
    assertPreserved(base, head, [
      ...LEGACY_INPUTS,
      ...QUALITY_INPUTS.filter((path) => path !== "toolchain.config.json"),
      "scripts/check-docs-verifier-authority.mts",
      "scripts/check-docs-verifier-authority.test.mts",
      ...PREVIOUS_INSTALL_PATHS,
    ]);
    assertPreserved(base, head, PREVIOUS_SOURCE_INPUTS, true);
    return "runtime-admission";
  }
  if (head.entries.has(CANARY_WORKFLOW)) {
    const data = object(object(evidence.installationData)[CANARY_WORKFLOW]);
    assert.ok(
      data.encoding === "base64" && typeof data.content === "string",
      "Missing authenticated canary bytes",
    );
    const bytes = Buffer.from(data.content, "base64");
    assert.equal(
      gitHash("blob", bytes),
      head.entries.get(CANARY_WORKFLOW)!.sha,
      "Canary caller blob drift",
    );
    await assertCanaryWorkflow(bytes, sourceSHA);
  }
  const installation =
    flat.length === INSTALL_PATHS.length &&
    flat.every((rawFile) => {
      const file = object(rawFile);
      return (
        INSTALL_PATHS.includes(String(file.filename)) &&
        file.status === "added" &&
        file.previous_filename === undefined
      );
    });
  assertPreserved(
    base,
    head,
    [...QUALITY_INPUTS, ...ADMISSION_INPUTS, ...PREVIOUS_INSTALL_PATHS, ...PREVIOUS_SOURCE_INPUTS],
    true,
  );
  if (installation) {
    for (const path of INSTALL_PATHS) {
      const entry = head.entries.get(path);
      assert.ok(
        base.entries.get(path) === undefined && entry?.type === "blob" && entry.mode === "100644",
        "Installation is not three additive regular blobs",
      );
    }
    const data = object(object(evidence.installationData)[CALLER_WORKFLOW]);
    assert.ok(
      typeof data.content === "string" && data.encoding === "base64",
      "Missing authenticated caller installation bytes",
    );
    const bytes = Buffer.from(data.content, "base64");
    assert.equal(
      gitHash("blob", bytes),
      head.entries.get(CALLER_WORKFLOW)!.sha,
      "Caller installation blob drift",
    );
    await assertCallerWorkflow(bytes, sourceSHA);
  } else {
    assertPreserved(base, head, INSTALL_PATHS, true);
  }
  // Existing ordinary, dependency, special and finite historical rules stay with their frozen owner.
  const { checkSourceSuccessor: checkFrozenV3 } =
    await import("./docs-quality-source-successor-v3.ts");
  return checkFrozenV3(evidence, baseManifest, baseLock, sourceSHA);
}

async function protectedSourceSnapshot(
  api: GitHubReadApi,
  executor: ProtectedExecutor,
): Promise<string> {
  const [branchRaw, previousRaw, runRaw, summaries] = await Promise.all([
    api.get(
      `${repositoryRoot}/branches/${encodeURIComponent(SOURCE_REF.slice("refs/heads/".length))}`,
    ),
    api.get(
      `${repositoryRoot}/branches/${encodeURIComponent(PREVIOUS_SOURCE_REF.slice("refs/heads/".length))}`,
    ),
    api.get(`${repositoryRoot}/actions/runs/${executor.runId}/attempts/${executor.runAttempt}`),
    arrayPages(api, `${repositoryRoot}/rulesets?includes_parents=true`),
  ]);
  const branch = object(branchRaw),
    previous = object(previousRaw),
    run = object(runRaw);
  assert.ok(
    previous.name === PREVIOUS_SOURCE_REF.slice("refs/heads/".length) &&
      previous.protected === true &&
      object(previous.commit).sha === PREVIOUS_SOURCE_SHA,
    "Frozen v3 source ref/protection drift",
  );
  assert.ok(
    branch.name === SOURCE_REF.slice("refs/heads/".length) && branch.protected === true,
    "Staged source is not visibly protected",
  );
  assert.equal(
    object(branch.commit).sha,
    executor.sourceSHA,
    "Locked defining workflow source moved",
  );
  repoIdentity(run.repository);
  assert.ok(
    run.id === executor.runId &&
      run.run_attempt === executor.runAttempt &&
      run.event === executor.event,
    "Current run provenance drift",
  );
  if (executor.mode === "push") {
    assert.ok(
      run.path === SOURCE_WORKFLOW &&
        run.head_sha === executor.sourceSHA &&
        run.head_branch === SOURCE_REF.slice("refs/heads/".length),
      "Genuine source push provenance drift",
    );
    const actor = object(run.actor);
    assert.ok(
      actor.type === "User" && actor.login === "777genius" && actor.id === ownerId,
      "Staged source push must originate with the owner",
    );
  } else {
    assert.ok(
      run.path === (executor.mode === "canary" ? CANARY_WORKFLOW : CALLER_WORKFLOW) &&
        run.head_sha === executor.targetHeadSHA,
      "Reusable target run provenance drift",
    );
    if (executor.mode === "canary") {
      const actor = object(run.actor);
      assert.ok(
        actor.type === "User" &&
          actor.login === "777genius" &&
          actor.id === ownerId &&
          executor.callerWorkflowRef ===
            `${TARGET.repository}/${CANARY_WORKFLOW}@refs/heads/${String(run.head_branch)}`,
        "Canary push actor/ref drift",
      );
    }
    const references = array(run.referenced_workflows).map(object);
    const matches = references.filter(
      (value) =>
        value.path === `${TARGET.repository}/${SOURCE_WORKFLOW}@${executor.sourceSHA}` &&
        value.sha === executor.sourceSHA,
    );
    assert.equal(
      matches.length,
      1,
      "Run does not reference the exact defining reusable workflow source",
    );
  }
  const flat = summaries.flat().map(object);
  assert.equal(
    new Set(flat.map((value) => value.id)).size,
    flat.length,
    "Duplicate ruleset pagination",
  );
  const rules = await Promise.all(
    flat.map((value) => api.get(`${repositoryRoot}/rulesets/${positive(value.id)}`)),
  );
  const lockId = assertStagingProtection(rules, "public_read"),
    previousLockId = assertPreviousSourceProtection(rules, "public_read");
  return JSON.stringify({
    source: object(branch.commit).sha,
    run: [
      run.id,
      run.run_attempt,
      run.event,
      run.path,
      run.head_sha,
      run.head_branch,
      run.referenced_workflows,
      run.actor,
    ],
    lock: rules.find((value) => object(value).id === lockId),
    previous: [previous, rules.find((value) => object(value).id === previousLockId)],
  });
}

export interface SourceEvidence {
  readonly executor: ProtectedExecutor;
  readonly sourceTree: CompleteTree;
  readonly baseTree: CompleteTree;
  readonly headTree: CompleteTree;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly baseManifest: Buffer;
  readonly baseLock: Buffer;
  readonly recheck: () => Promise<void>;
  readonly protectionObservation: typeof HOSTED_PROTECTION_OBSERVATION;
}

const blobData = (document: VerifiedDocument): object => ({
  sha: document.blob,
  size: document.bytes.length,
  encoding: "base64",
  content: document.bytes.toString("base64"),
});
const treeData = (tree: CompleteTree): object => ({
  sha: tree.sha,
  truncated: false,
  tree: [...tree.entries.values()],
});
const inputData = (tree: CompleteTree): object =>
  Object.fromEntries(
    LEGACY_INPUTS.map((path) => {
      const entry = tree.entries.get(path);
      return [
        path,
        entry === undefined
          ? null
          : { path: entry.path, sha: entry.sha, mode: entry.mode, type: entry.type },
      ];
    }),
  );

export async function collectSourceEvidence(
  api: GitHubReadApi,
  unresolved: ExecutorInput,
): Promise<SourceEvidence> {
  const input = await resolveExecutionTarget(api, unresolved);
  assert.ok(
    input.repository === TARGET.repository &&
      input.sourceRef === SOURCE_REF &&
      input.workflowPath === SOURCE_WORKFLOW &&
      ((input.mode === "push" && input.event === "push") ||
        (input.mode === "canary" && input.event === "push") ||
        (input.mode === "reusable" && input.event === "pull_request_target")),
    "Wrong protected execution context",
  );
  sha(input.sourceSHA);
  sha(input.targetBaseSHA);
  sha(input.targetHeadSHA);
  positive(input.runId);
  positive(input.runAttempt);
  positive(input.pullRequest);
  if (input.mode === "push") {
    assert.ok(
      input.pullRequest === TARGET.pullRequest &&
        input.targetBaseSHA === TARGET.baseSHA &&
        input.targetHeadSHA === TARGET.headSHA &&
        input.callerWorkflowSHA === input.sourceSHA &&
        input.callerWorkflowRef === `${TARGET.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}`,
      "Push cannot choose another target",
    );
  } else if (input.mode === "canary") {
    assert.ok(
      input.callerWorkflowSHA === input.targetHeadSHA &&
        CANARY_REFS.some(
          (ref) => input.callerWorkflowRef === `${TARGET.repository}/${CANARY_WORKFLOW}@${ref}`,
        ),
      "Unbound canary execution",
    );
  } else {
    assert.ok(
      input.callerWorkflowSHA === input.targetBaseSHA &&
        input.callerWorkflowRef === `${TARGET.repository}/${CALLER_WORKFLOW}@refs/heads/main`,
      "Unprotected main caller binding",
    );
  }
  const sourceTree = await readTree(api, input.sourceSHA),
    executor: ProtectedExecutor = { ...input, sourceTreeSHA: sourceTree.sha };
  const sourceSnapshot = await protectedSourceSnapshot(api, executor);
  let firstPull: Record<string, unknown> | undefined;
  const readLive = async (): Promise<string> => {
    const [controllerRaw, pullRaw, branchRaw, mainRaw, identityRaw] = await Promise.all([
      api.get(repositoryRoot),
      api.get(`${repositoryRoot}/pulls/${input.pullRequest}`),
      api.get(`${repositoryRoot}/branches/main`),
      api.get(`${repositoryRoot}/rulesets/19979783`),
      api.get(`${repositoryRoot}/rulesets/24363205`),
    ]);
    const controller = repoIdentity(controllerRaw),
      pull = object(pullRaw),
      branch = object(branchRaw);
    assert.ok(
      controller.default_branch === "main" &&
        controller.archived === false &&
        controller.disabled === false &&
        controller.fork === false,
      "Live default repository drift",
    );
    assert.ok(
      branch.name === "main" &&
        branch.protected === true &&
        object(branch.commit).sha === input.targetBaseSHA,
      "Live protected main moved",
    );
    const snapshot = targetPullSnapshot(pull, input.mode === "push");
    assert.ok(
      pull.number === input.pullRequest &&
        object(pull.base).sha === input.targetBaseSHA &&
        object(pull.head).sha === input.targetHeadSHA,
      "Target differs from genuine event",
    );
    assertMainProtection(mainRaw, identityRaw, "public_read");
    assert.equal(
      targetPullSnapshot(
        await api.get(`${repositoryRoot}/pulls/${input.pullRequest}`),
        input.mode === "push",
      ),
      snapshot,
      "Target moved during observation",
    );
    assert.equal(
      object(object(await api.get(`${repositoryRoot}/branches/main`)).commit).sha,
      input.targetBaseSHA,
      "Main moved during observation",
    );
    const [commits, openPulls] = await Promise.all([
      arrayPages(api, `${repositoryRoot}/pulls/${input.pullRequest}/commits`),
      arrayPages(api, `${repositoryRoot}/pulls?state=open&base=main`),
    ]);
    const commitIdentity = assertCommitIdentity(pull, commits.flat(), openPulls.flat());
    if (input.mode === "canary") {
      const resolved = await resolveExecutionTarget(api, unresolved);
      assert.ok(
        resolved.pullRequest === input.pullRequest &&
          resolved.targetBaseSHA === input.targetBaseSHA,
        "Canary PR selection changed",
      );
    }
    firstPull ??= pull;
    return JSON.stringify({ pull: snapshot, main: mainRaw, identity: identityRaw, commitIdentity });
  };
  const snapshot = await readLive(),
    pull = firstPull!;
  const [baseTree, headTree, pages] = await Promise.all([
    readTree(api, input.targetBaseSHA),
    readTree(api, input.targetHeadSHA),
    arrayPages(api, `${repositoryRoot}/pulls/${input.pullRequest}/files`),
  ]);
  const files = assertFiles(baseTree, headTree, pages, Number(pull.changed_files));
  if (input.mode === "push") {
    assertSourceTuple(baseTree, headTree, pages);
    const [comparisonRaw, commitPages] = await Promise.all([
      api.get(`${repositoryRoot}/compare/${TARGET.baseSHA}...${TARGET.headSHA}`),
      arrayPages(api, `${repositoryRoot}/pulls/${TARGET.pullRequest}/commits`),
    ]);
    const comparison = object(comparisonRaw),
      commits = commitPages.flat().map(object);
    assert.ok(
      comparison.status === "ahead" &&
        comparison.behind_by === 0 &&
        comparison.ahead_by === TARGET.commits &&
        comparison.total_commits === TARGET.commits &&
        object(comparison.base_commit).sha === TARGET.baseSHA &&
        object(comparison.merge_base_commit).sha === TARGET.baseSHA,
      "Finite target is not based on the exact current main",
    );
    assert.ok(
      commits.length === TARGET.commits &&
        new Set(commits.map((value) => sha(value.sha))).size === commits.length &&
        commits.at(-1)!.sha === TARGET.headSHA,
      "Incomplete finite source commits",
    );
    assert.deepEqual(
      commits.map((value) => sha(value.sha)).toSorted(),
      TARGET_COMMITS,
      "Finite source commit identities changed",
    );
  }
  const [baseManifest, baseLock, headManifest, headLock] = await Promise.all([
    readVerifiedDocument(api, baseTree, input.targetBaseSHA, "package.json"),
    readVerifiedDocument(api, baseTree, input.targetBaseSHA, "pnpm-lock.yaml"),
    readVerifiedDocument(api, headTree, input.targetHeadSHA, "package.json"),
    readVerifiedDocument(api, headTree, input.targetHeadSHA, "pnpm-lock.yaml"),
  ]);
  const installationData: Record<string, unknown> = {};
  if (executor.mode === "reusable") {
    assertPreserved(baseTree, headTree, [
      ...INSTALL_PATHS,
      ...QUALITY_INPUTS,
      ...ADMISSION_INPUTS,
      ...PREVIOUS_INSTALL_PATHS,
    ]);
    assertPreserved(baseTree, headTree, PREVIOUS_SOURCE_INPUTS, true);
    const caller = await readVerifiedDocument(api, baseTree, input.targetBaseSHA, CALLER_WORKFLOW);
    // Publisher remains dependency-free; canonical YAML semantics are evaluated in the actual source job.
    installationData[CALLER_WORKFLOW] = blobData(caller);
  }
  if (executor.mode === "canary") {
    installationData[CANARY_WORKFLOW] = blobData(
      await readVerifiedDocument(api, headTree, input.targetHeadSHA, CANARY_WORKFLOW),
    );
  }
  const live = {
    state: "open",
    pullRequest: input.pullRequest,
    repository: TARGET.repository,
    baseSHA: input.targetBaseSHA,
    headSHA: input.targetHeadSHA,
    sourceSHA: input.targetHeadSHA,
    baseRef: "main",
    defaultBranch: "main",
    headRepository: TARGET.repository,
    changedFiles: pull.changed_files,
  };
  const evidence = {
    ...live,
    base: "5abed741aff64506d0e9f87f76541a4e93af7e4a",
    reviewTarget: "96cb95a89ca4a133fbb626133eb3ac6289938ff7",
    files,
    paginationComplete: true,
    baseTree: treeData(baseTree),
    headTree: treeData(headTree),
    baseInputs: inputData(baseTree),
    headInputs: inputData(headTree),
    headData: { "package.json": blobData(headManifest), "pnpm-lock.yaml": blobData(headLock) },
    installationData,
    live,
  };
  const recheck = async (): Promise<void> => {
    assert.equal(
      await protectedSourceSnapshot(api, executor),
      sourceSnapshot,
      "Protected source/run moved during verification",
    );
    assert.equal(
      await readLive(),
      snapshot,
      "Target or main protections changed during verification",
    );
  };
  await recheck();
  return {
    executor,
    sourceTree,
    baseTree,
    headTree,
    evidence,
    baseManifest: baseManifest.bytes,
    baseLock: baseLock.bytes,
    recheck,
    protectionObservation: HOSTED_PROTECTION_OBSERVATION,
  };
}

export function createGitHubReadApi(token: string): GitHubStatusApi {
  assert.ok(token.length > 0, "A job-scoped GitHub token is required");
  const request = async (
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<unknown> => {
    assert.ok(
      path === repositoryRoot || path.startsWith(`${repositoryRoot}/`),
      "Cross-repository core request refused",
    );
    assert.ok(
      !/[\\\r\n#]/u.test(path) && !/(?:^|\/)\.\.(?:\/|$|\?)/u.test(decodeURIComponent(path)),
      "Unsafe GitHub API path",
    );
    const response = await fetch(`https://api.github.com/${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.ok(response.ok, `GitHub ${method} ${path} failed with HTTP ${response.status}`);
    const text = await response.text();
    assert.ok(Buffer.byteLength(text) <= 16 * 1024 * 1024, "Oversized GitHub API response");
    return JSON.parse(text) as unknown;
  };
  return {
    get: (path) => request("GET", path),
    postStatus: (head, value) => {
      sha(head);
      assert.equal(value.context, SOURCE_CONTEXT, "Legacy or unowned status context refused");
      assert.ok(
        ["pending", "success", "failure"].includes(value.state),
        "Unknown source status state",
      );
      return request("POST", `${repositoryRoot}/statuses/${head}`, value);
    },
  };
}

export async function assertCurrentSuccessfulJobs(
  api: GitHubReadApi,
  executor: ProtectedExecutor,
): Promise<void> {
  const jobs: Record<string, unknown>[] = [];
  let total: number | undefined;
  for (let page = 1; page <= 32; page += 1) {
    const data = object(
      await api.get(
        `${repositoryRoot}/actions/runs/${executor.runId}/attempts/${executor.runAttempt}/jobs?per_page=100&page=${page}`,
      ),
    );
    const values = array(data.jobs).map(object),
      count = positive(data.total_count);
    total ??= count;
    assert.equal(count, total, "Moving job pagination");
    assert.ok(values.length <= 100, "Oversized job page");
    jobs.push(...values);
    if (values.length < 100) {
      break;
    }
    assert.ok(page < 32, "Job pagination exceeded bound");
  }
  assert.ok(
    total === jobs.length && new Set(jobs.map((job) => positive(job.id))).size === jobs.length,
    "Incomplete current-attempt job evidence",
  );
  for (const name of ["qualify", "source"]) {
    const matches = jobs.filter(
      (job) =>
        job.name === name || (typeof job.name === "string" && job.name.endsWith(` / ${name}`)),
    );
    assert.equal(matches.length, 1, `Missing or duplicate ${name} job`);
    const job = matches[0]!;
    assert.ok(
      job.run_id === executor.runId &&
        job.run_attempt === executor.runAttempt &&
        job.head_sha === (executor.mode === "push" ? executor.sourceSHA : executor.targetHeadSHA) &&
        job.status === "completed" &&
        job.conclusion === "success",
      `Current-attempt ${name} did not succeed`,
    );
    const steps = array(job.steps).map(object);
    assert.ok(
      steps.length > 0 &&
        steps.every(
          (step) =>
            step.status === "completed" && ["success", "skipped"].includes(String(step.conclusion)),
        ) &&
        steps.some((step) => step.conclusion === "success"),
      `Incomplete ${name} steps`,
    );
    const requiredName =
      name === "qualify"
        ? "Exercise accepting and rejecting source successor cases"
        : "Verify actual protected source semantics";
    const required = steps.filter((step) => step.name === requiredName);
    assert.ok(
      required.length === 1 &&
        required[0]!.status === "completed" &&
        required[0]!.conclusion === "success",
      `Decisive ${name} step did not actually succeed`,
    );
  }
}

export async function publishSourceSuccessor(
  api: GitHubStatusApi,
  input: ExecutorInput,
): Promise<void> {
  // The immutable defining workflow derives this SHA from the genuine event (or exact finite tuple).
  // Revoke stale shared-SHA success even if live PR resolution fails; only granting success requires all authority proofs.
  const headSHA = sha(input.targetHeadSHA);
  positive(input.runId);
  positive(input.runAttempt);
  const status = (state: "pending" | "success" | "failure"): Promise<unknown> =>
    api.postStatus(headSHA, {
      context: SOURCE_CONTEXT,
      state,
      target_url: `https://github.com/${TARGET.repository}/actions/runs/${input.runId}/attempts/${input.runAttempt}`,
      description: `Protected runtime/admission successor v2: ${state}`,
    });
  try {
    await status("pending");
    const executor = await resolveExecutionTarget(api, input);
    const initial = object(
      await api.get(`${repositoryRoot}/pulls/${positive(executor.pullRequest)}`),
    );
    targetPullSnapshot(initial, executor.mode === "push");
    assert.ok(
      object(initial.base).sha === executor.targetBaseSHA && object(initial.head).sha === headSHA,
      "Unsafe status target drift",
    );
    const bound = await collectSourceEvidence(api, executor);
    await assertLocalSource(bound.sourceTree);
    await assertCurrentSuccessfulJobs(api, bound.executor);
    await bound.recheck();
    await status("success");
    await bound.recheck();
  } catch (error) {
    await status("failure");
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  assert.ok(
    process.argv.length === 3 &&
      ["preflight", "bootstrap", "qualify", "source", "publish"].includes(String(mode)),
    "Use preflight, bootstrap, qualify, source or publish",
  );
  if (mode === "preflight" || mode === "bootstrap") {
    assert.equal(
      process.env.SOURCE_WORKFLOW_REPOSITORY,
      TARGET.repository,
      "Bootstrap repository drift",
    );
    assert.equal(
      process.env.SOURCE_WORKFLOW_PATH,
      SOURCE_WORKFLOW,
      "Bootstrap workflow path drift",
    );
    assert.ok(
      process.env.SOURCE_WORKFLOW_REF === `${TARGET.repository}/${SOURCE_WORKFLOW}@${SOURCE_REF}` ||
        process.env.SOURCE_WORKFLOW_REF ===
          `${TARGET.repository}/${SOURCE_WORKFLOW}@${sha(process.env.SOURCE_WORKFLOW_SHA)}`,
      "Bootstrap workflow reference drift",
    );
    if (mode === "preflight") {
      await preflightBootstrap(sha(process.env.SOURCE_WORKFLOW_SHA));
    } else {
      await qualifyBootstrap(sha(process.env.SOURCE_WORKFLOW_SHA));
    }
    console.log(
      mode === "preflight"
        ? "Builtin-only immutable source and ambient hook preflight verified"
        : "Immutable source bootstrap controls and hook-free pnpm configuration verified",
    );
  } else {
    const event = ["pull_request_target", "push"].includes(String(process.env.GITHUB_EVENT_NAME))
      ? (JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH ?? "", "utf8")) as unknown)
      : undefined;
    const executor = executorFromEnvironment(process.env, event),
      api = createGitHubReadApi(process.env.GITHUB_TOKEN ?? "");
    if (mode === "publish") {
      await publishSourceSuccessor(api, executor);
    } else {
      const bound = await collectSourceEvidence(api, executor);
      await assertLocalSource(bound.sourceTree);
      if (mode === "source") {
        if (executor.mode === "reusable") {
          const caller = object(object(bound.evidence.installationData)[CALLER_WORKFLOW]);
          await assertCallerWorkflow(
            Buffer.from(String(caller.content), "base64"),
            executor.sourceSHA,
          );
        }
        const result = await checkSourceSuccessor(
          bound.evidence,
          bound.baseManifest,
          bound.baseLock,
          executor.sourceSHA,
        );
        await bound.recheck();
        console.log(
          JSON.stringify({
            result,
            executor: bound.executor,
            protectionObservation: bound.protectionObservation,
          }),
        );
      } else {
        await bound.recheck();
        console.log(
          JSON.stringify({
            result: "source-qualified-semantics-separate",
            executor: bound.executor,
            protectionObservation: bound.protectionObservation,
          }),
        );
      }
    }
  }
}
