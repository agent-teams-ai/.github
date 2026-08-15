import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  EXPECTED_CONSUMERS,
  auditConsumers,
  createGitHubClient,
  runCli,
  validateConsumerFiles,
  validateInventory
} from "../scripts/check-foundation-consumers.mjs";

const TEST_INTEGRITY = `sha512-${Buffer.alloc(64, 7).toString("base64")}`;

function inventory(overrides = {}) {
  return {
    schemaVersion: 1,
    organization: "agent-teams-ai",
    package: "@agent-teams/engineering-foundation",
    requiredVersion: "0.16.1",
    registry: "https://registry.npmjs.org/",
    requiredIntegrity: TEST_INTEGRITY,
    sourceRepository: "engineering-foundation",
    consumers: EXPECTED_CONSUMERS.map((repository) => ({ repository, manifestPath: "package.json", lockfilePath: "pnpm-lock.yaml" })),
    exceptions: [],
    ...overrides
  };
}

function manifest(version = "0.16.1") {
  return JSON.stringify({ devDependencies: { "@agent-teams/engineering-foundation": version } });
}

function lockfile({ version = "0.16.1", lockedVersion = version, integrity = TEST_INTEGRITY, tarball, patched = false, overridden = false, extraSnapshot } = {}) {
  return `lockfileVersion: '9.0'\n${patched ? "patchedDependencies:\n  '@agent-teams/engineering-foundation@0.16.1': patches/foundation.patch\n" : ""}${overridden ? "overrides:\n  '@agent-teams/engineering-foundation': 0.16.0\n" : ""}importers:\n  .:\n    devDependencies:\n      '@agent-teams/engineering-foundation':\n        specifier: ${version}\n        version: ${lockedVersion}\npackages:\n  '@agent-teams/engineering-foundation@${version}':\n    resolution:\n      integrity: ${integrity}\n${tarball ? `      tarball: ${tarball}\n` : ""}snapshots:\n  '@agent-teams/engineering-foundation@${lockedVersion}': {}\n${extraSnapshot ? `  '@agent-teams/engineering-foundation@${extraSnapshot}': {}\n` : ""}`;
}

function response(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "x-ratelimit-remaining": "1000", ...headers } });
}

function mockGitHub({ repositorySelection = "all", truncatedRepository, nestedRepository, omitRepository, rateLimited = false } = {}) {
  const repositories = [...EXPECTED_CONSUMERS, "engineering-foundation", "unrelated"]
    .filter((name) => name !== omitRepository)
    .map((name) => ({ name, default_branch: "main" }));
  const sha = "a".repeat(40);
  const blobs = new Map();
  const routes = new Map();
  routes.set("/installation/repositories?per_page=1", { repository_selection: repositorySelection, total_count: repositories.length, repositories: repositories.slice(0, 1) });
  routes.set("/orgs/agent-teams-ai/repos?type=all&per_page=100", repositories);

  for (const repository of repositories) {
    routes.set(`/repos/agent-teams-ai/${repository.name}/branches/main`, { commit: { sha } });
    const tree = [];
    const addBlob = (path, source) => {
      const blobSha = createHash("sha1").update(`${repository.name}:${path}`).digest("hex");
      tree.push({ path, type: "blob", sha: blobSha });
      blobs.set(`/repos/agent-teams-ai/${repository.name}/git/blobs/${blobSha}`, { encoding: "base64", content: Buffer.from(source).toString("base64"), truncated: false });
    };
    if (EXPECTED_CONSUMERS.includes(repository.name)) {
      addBlob("package.json", manifest());
      addBlob("pnpm-lock.yaml", lockfile());
      if (nestedRepository === repository.name) addBlob("packages/nested/package.json", manifest());
    } else {
      addBlob("package.json", JSON.stringify({ private: true }));
    }
    routes.set(`/repos/agent-teams-ai/${repository.name}/git/trees/${sha}?recursive=1`, { truncated: truncatedRepository === repository.name, tree });
  }

  return async (url) => {
    const path = new URL(url).pathname + new URL(url).search;
    if (rateLimited) return response({ message: "rate limit" }, { status: 403, headers: { "x-ratelimit-remaining": "0" } });
    if (blobs.has(path)) return response(blobs.get(path));
    if (routes.has(path)) return response(routes.get(path));
    return response({ message: `Unhandled ${path}` }, { status: 404 });
  };
}

test("inventory accepts exactly the four governed consumers", () => {
  assert.equal(validateInventory(inventory()).consumers.length, 4);
  assert.throws(() => validateInventory(inventory({ requiredIntegrity: "sha512-not-canonical" })), /canonical sha512 SRI/);
});

test("inventory rejects duplicate and replacement consumers", () => {
  const duplicate = inventory();
  duplicate.consumers[3] = { ...duplicate.consumers[0] };
  assert.throws(() => validateInventory(duplicate), /Duplicate consumer/);

  const replacement = inventory();
  replacement.consumers[3] = { ...replacement.consumers[3], repository: "other" };
  assert.throws(() => validateInventory(replacement), /Consumers must be exactly/);
});

test("inventory rejects inexact or unexplained exceptions", () => {
  const base = { repository: "repo", path: "package.json", reason: "a sufficiently long reason", expiresOn: "2099-01-01", approvalOwner: "@agent-teams-ai/foundation-owners" };
  assert.throws(() => validateInventory(inventory({ exceptions: [{ ...base, path: "../package.json" }] })), /exact repository-relative path/);
  assert.throws(() => validateInventory(inventory({ exceptions: [{ ...base, reason: "short" }] })), /must explain/);
  assert.throws(() => validateInventory(inventory({ exceptions: [{ ...base, approvalOwner: "nobody" }] })), /accountable GitHub user or team/);
  assert.throws(() => validateInventory(inventory({ exceptions: [{ ...base, expiresOn: "2026-01-01" }] }), { now: new Date("2026-08-15T00:00:00Z") }), /expired/);
});

test("inventory prohibits nested manifests and lockfiles", () => {
  const nestedManifest = inventory();
  nestedManifest.consumers[0] = { ...nestedManifest.consumers[0], manifestPath: "packages/app/package.json" };
  assert.throws(() => validateInventory(nestedManifest), /nested manifests are prohibited/);
  const nestedLock = inventory();
  nestedLock.consumers[0] = { ...nestedLock.consumers[0], lockfilePath: "packages/app/pnpm-lock.yaml" };
  assert.throws(() => validateInventory(nestedLock), /nested lockfiles are prohibited/);
});

test("consumer files require exact devDependency and lock integrity", () => {
  const data = inventory();
  const consumer = data.consumers[0];
  assert.doesNotThrow(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile() }));
  assert.doesNotThrow(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ lockedVersion: "0.16.1(supports-color@7.2.0)" }) }));
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest("^0.16.1"), lockfileSource: lockfile() }), /exact devDependency/);
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ integrity: `sha512-${Buffer.alloc(64, 8).toString("base64")}` }) }), /canonical registry SRI/);
});

test("consumer files reject patches, overrides, and alternate tarballs", () => {
  const data = inventory();
  const consumer = data.consumers[0];
  const patchedManifest = JSON.stringify({ devDependencies: { [data.package]: data.requiredVersion }, pnpm: { patchedDependencies: { [`${data.package}@${data.requiredVersion}`]: "patches/f.patch" } } });
  const overriddenManifest = JSON.stringify({ devDependencies: { [data.package]: data.requiredVersion }, pnpm: { overrides: { [`other>${data.package}`]: "0.16.0" } } });
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: patchedManifest, lockfileSource: lockfile() }), /must not patch/);
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: overriddenManifest, lockfileSource: lockfile() }), /must not override/);
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ patched: true }) }), /must not patch/);
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ overridden: true }) }), /must not override/);
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ tarball: "https://evil.example/foundation.tgz" }) }), /alternate tarball/);
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ lockedVersion: "https://evil.example/foundation.tgz" }) }), /disallowed source or suffix/);
});

test("consumer files reject hidden patch suffixes without patch metadata", () => {
  const data = inventory();
  const consumer = data.consumers[0];
  const patchedVersion = "0.16.1(patch_hash=attacker)(supports-color@7.2.0)";
  assert.throws(
    () => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ lockedVersion: patchedVersion }) }),
    /resolved version has a disallowed source or suffix/
  );
  assert.throws(
    () => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ extraSnapshot: "0.16.1(patch_hash=attacker)" }) }),
    /snapshot with a disallowed source or suffix/
  );
  assert.throws(
    () => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ lockedVersion: "0.16.1(attacker)" }) }),
    /resolved version has a disallowed source or suffix/
  );
});

test("pending publication integrity disables live audit before API access", async () => {
  let called = false;
  await assert.rejects(auditConsumers({ inventory: inventory({ requiredIntegrity: "pending-publication" }), token: "test", fetchImpl: async () => { called = true; throw new Error("unexpected"); } }), /disabled until the stable registry SRI is pinned/);
  assert.equal(called, false);
});

test("GitHub client fails closed on rate limits", async () => {
  const client = createGitHubClient({ token: "test", fetchImpl: mockGitHub({ rateLimited: true }) });
  await assert.rejects(client.request("/installation/repositories?per_page=1"), /rate limit exhausted/);
});

test("live audit binds SHAs and validates all four consumers", async () => {
  const result = await auditConsumers({ inventory: inventory(), token: "test", fetchImpl: mockGitHub() });
  assert.equal(result.filter((entry) => entry.consumer).length, 4);
  assert.ok(result.every((entry) => entry.sha === "a".repeat(40)));
  assert.ok(!result.some((entry) => entry.repository === "engineering-foundation"));
});

test("live audit rejects selected-repository GitHub App installations", async () => {
  await assert.rejects(auditConsumers({ inventory: inventory(), token: "test", fetchImpl: mockGitHub({ repositorySelection: "selected" }) }), /repository_selection=all/);
});

test("live audit rejects inaccessible, nested, and truncated repositories", async () => {
  await assert.rejects(auditConsumers({ inventory: inventory(), token: "test", fetchImpl: mockGitHub({ omitRepository: "agent-teams-platform" }) }), /missing or inaccessible: agent-teams-platform/);
  await assert.rejects(auditConsumers({ inventory: inventory(), token: "test", fetchImpl: mockGitHub({ nestedRepository: "agent-runtime" }) }), /Nested or unexpected/);
  await assert.rejects(auditConsumers({ inventory: inventory(), token: "test", fetchImpl: mockGitHub({ truncatedRepository: "unrelated" }) }), /recursive tree is missing or truncated/);
});

test("live audit reports safe partial progress before a later failure", async () => {
  let checked = 0;
  await assert.rejects(auditConsumers({
    inventory: inventory(),
    token: "test",
    fetchImpl: mockGitHub({ nestedRepository: "extension-foundation" }),
    onProgress: () => { checked += 1; }
  }), /Nested or unexpected/);
  assert.equal(checked, 3);
});

test("live audit rejects stale path exceptions", async () => {
  const data = inventory({ exceptions: [{ repository: "unrelated", path: "package.json", reason: "Temporary exact path exception", expiresOn: "2099-01-01", approvalOwner: "@agent-teams-ai/foundation-owners" }] });
  await assert.rejects(auditConsumers({ inventory: data, token: "test", fetchImpl: mockGitHub() }), /Stale or unverifiable exception/);
});

test("public failure report contains no repository, path, branch, or SHA", async () => {
  const directory = await mkdtemp(join(tmpdir(), "foundation-audit-"));
  const output = join(directory, "report.json");
  try {
    assert.equal(await runCli(["--output", output], {}), 1);
    const report = await readFile(output, "utf8");
    assert.doesNotMatch(report, /agent-teams-platform|package\.json|main|[a-f0-9]{40}/);
    assert.deepEqual(JSON.parse(report), {
      status: "failed",
      startedAt: JSON.parse(report).startedAt,
      completedAt: JSON.parse(report).completedAt,
      requiredVersion: "0.16.1",
      registeredConsumerCount: 4,
      checkedRepositoryCount: 0,
      verifiedConsumerCount: 0,
      errorCode: "FOUNDATION_CONSUMER_AUDIT_FAILED"
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
