import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  EXPECTED_CONSUMERS,
  auditConsumers,
  createGitHubClient,
  validateConsumerFiles,
  validateInventory
} from "../scripts/check-foundation-consumers.mjs";

function inventory(overrides = {}) {
  return {
    schemaVersion: 1,
    organization: "agent-teams-ai",
    package: "@agent-teams/engineering-foundation",
    requiredVersion: "0.16.1",
    sourceRepository: "engineering-foundation",
    consumers: EXPECTED_CONSUMERS.map((repository) => ({ repository, manifestPath: "package.json", lockfilePath: "pnpm-lock.yaml" })),
    exceptions: [],
    ...overrides
  };
}

function manifest(version = "0.16.1") {
  return JSON.stringify({ devDependencies: { "@agent-teams/engineering-foundation": version } });
}

function lockfile({ version = "0.16.1", integrity = "sha512-abcdefghijklmnopqrstuvwxyz0123456789" } = {}) {
  return `lockfileVersion: '9.0'\nimporters:\n  .:\n    devDependencies:\n      '@agent-teams/engineering-foundation':\n        specifier: ${version}\n        version: ${version}\npackages:\n  '@agent-teams/engineering-foundation@${version}':\n    resolution:\n      integrity: ${integrity}\n`;
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
  assert.throws(() => validateInventory(inventory({ exceptions: [{ repository: "repo", path: "../package.json", reason: "a sufficiently long reason" }] })), /exact repository-relative path/);
  assert.throws(() => validateInventory(inventory({ exceptions: [{ repository: "repo", path: "package.json", reason: "short" }] })), /must explain/);
});

test("consumer files require exact devDependency and lock integrity", () => {
  const data = inventory();
  const consumer = data.consumers[0];
  assert.doesNotThrow(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile() }));
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest("^0.16.1"), lockfileSource: lockfile() }), /exact devDependency/);
  assert.throws(() => validateConsumerFiles({ inventory: data, consumer, manifestSource: manifest(), lockfileSource: lockfile({ integrity: "missing" }) }), /missing package integrity/);
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

test("live audit rejects stale path exceptions", async () => {
  const data = inventory({ exceptions: [{ repository: "unrelated", path: "package.json", reason: "Temporary exact path exception" }] });
  await assert.rejects(auditConsumers({ inventory: data, token: "test", fetchImpl: mockGitHub() }), /Stale or unverifiable exception/);
});
