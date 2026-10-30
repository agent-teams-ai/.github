import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  auditRepositoryBootstrapConfigurations,
  loadRemoteBootstrapSource,
} from "./repository-bootstrap-observation.ts";
import type { BootstrapRepository } from "./repository-bootstrap-observation.ts";
import { validateSchema } from "./governance-schema.ts";
import type { RegistrationScope } from "./repository-registration.ts";

const current: BootstrapRepository = {
  full_name: "agent-teams-ai/current",
  id: 1,
  created_at: "2026-08-01T00:00:00Z",
  archived: false,
  default_branch: "main",
  fork: false,
};
const loadJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8")) as unknown;
const absentFiles = new Map<string, string>();
const missingSource = async () => ({
  read: async (path: string) => absentFiles.get(path),
  workflows: async () => [],
});

void test("live bootstrap backstop detects a wholly absent caller without migrating older repositories", async () => {
  const files = new Map<string, string>();
  const source = { read: async (path: string) => files.get(path), workflows: async () => [] };
  const results = await auditRepositoryBootstrapConfigurations(
    [
      current,
      { ...current, id: 2, full_name: "agent-teams-ai/new", created_at: "2026-10-22T01:00:00Z" },
    ],
    async () => source,
  );
  assert.equal(results.length, 1);
  const observed = results[0];
  assert.ok(observed);
  assert.equal(observed.repository, "agent-teams-ai/new");
  assert.equal(observed.status, "unsupported_stack_pending");
  assert.ok(
    observed.issues.some(
      (issue) =>
        issue.path === ".github/workflows/repository-admission.yml" &&
        issue.message.includes("missing"),
    ),
  );
  assert.ok(observed.issues.some((issue) => issue.path === "foundation.config.yaml"));
  assert.match(
    observed.guide,
    /\.github\/blob\/main\/docs\/repository-admission\.md#new-repository-bootstrap$/u,
  );
});

void test("older explicit bootstrap opt-in remains mandatory when its caller disappears", async () => {
  const results = await auditRepositoryBootstrapConfigurations([current], async () => ({
    read: async (path) => (path === "package.json" ? '{"repositoryAdmission":1}' : undefined),
    workflows: async () => [],
  }));
  assert.equal(results.length, 1);
  assert.equal(results[0]?.status, "unsupported_stack_pending");
});

void test("centrally registered full-FMS scope remains mandatory after both consumer opt-in signals disappear", async () => {
  const [schema, inventorySchema, docsSchema, value] = await Promise.all([
    loadJson("governance/repository-registration-supplements.schema.json"),
    loadJson("governance/organization-repository-inventory.schema.json"),
    loadJson("governance/docs-protocol-policy-v2.schema.json"),
    loadJson("governance/repository-registration-supplements.json"),
  ]);
  const registrations = validateSchema<RegistrationScope>(value, schema, "Registrations", [
    inventorySchema,
    docsSchema,
  ]);
  const payment = registrations.repositories.find(
    (record) => record.inventory.repository === "agent-teams-ai/payments-sdk",
  );
  assert.ok(payment, "the canonical pending registration includes Payments");
  const repository = {
    ...current,
    full_name: payment.inventory.repository,
    id: payment.inventory.id,
    created_at: payment.inventory.created_at,
  };
  assert.deepEqual(
    await auditRepositoryBootstrapConfigurations([repository], missingSource),
    [],
    "creation before the generic cutoff does not implicitly migrate an older repository",
  );
  const results = await auditRepositoryBootstrapConfigurations(
    [repository],
    missingSource,
    new Set(registrations.repositories.map((record) => record.inventory.id)),
  );
  assert.equal(results.length, 1);
  const observed = results[0];
  assert.ok(observed);
  assert.equal(observed.repository_id, payment.inventory.id);
  assert.equal(observed.status, "unsupported_stack_pending");
  assert.ok(
    observed.issues.some(
      (issue) =>
        issue.path === ".github/workflows/repository-admission.yml" &&
        issue.message.includes("missing"),
    ),
  );
  assert.ok(observed.issues.some((issue) => issue.path === "foundation.config.yaml"));
});

void test("bootstrap remote reader fails closed for truncated trees and inaccessible repository data", async () => {
  const sha = "1".repeat(40),
    commit = { sha, commit: { tree: { sha } } };
  await assert.rejects(
    loadRemoteBootstrapSource(current, async (endpoint) =>
      endpoint.includes("/commits/") ? commit : { sha, truncated: true, tree: [] },
    ),
    /Complete bounded Git tree/u,
  );
  await assert.rejects(
    auditRepositoryBootstrapConfigurations([current], async () => {
      throw new Error("credential scope unavailable");
    }),
    /credential scope/u,
  );
});

void test("the typed remote reader verifies immutable bytes, regular modes and live repository identity", async () => {
  const revision = "1".repeat(40),
    treeSHA = "2".repeat(40),
    bytes = Buffer.from('{"repositoryAdmission":1}');
  const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  const commit = { sha: revision, commit: { tree: { sha: treeSHA } } };
  let mode = "100644",
    corrupt = false,
    moved = false;
  const request = async (endpoint: string): Promise<unknown> => {
    if (endpoint.includes("/commits/")) {
      return commit;
    }
    if (endpoint.includes("/git/trees/")) {
      return {
        sha: treeSHA,
        truncated: false,
        tree: [{ path: "package.json", type: "blob", mode, size: bytes.length, sha: blob }],
      };
    }
    if (endpoint.includes("/git/blobs/")) {
      return {
        sha: blob,
        encoding: "base64",
        size: bytes.length,
        content: (corrupt ? Buffer.from("invalid") : bytes).toString("base64"),
      };
    }
    return {
      id: moved ? 2 : current.id,
      full_name: current.full_name,
      default_branch: current.default_branch,
    };
  };
  const source = await loadRemoteBootstrapSource(current, request);
  assert.equal(await source.read("package.json"), bytes.toString());
  await source.recheck?.();
  moved = true;
  await assert.rejects(
    source.recheck?.() ?? Promise.resolve(),
    /identity or default branch moved/u,
  );
  moved = false;
  mode = "120000";
  const symlink = await loadRemoteBootstrapSource(current, request);
  await assert.rejects(symlink.read("package.json"), /bounded regular Git files/u);
  mode = "100644";
  corrupt = true;
  const mismatch = await loadRemoteBootstrapSource(current, request);
  await assert.rejects(mismatch.read("package.json"), /do not match/u);
});

void test("individual registrations join the retained drift API without hiding other drift or claiming a new census", async () => {
  // The retained untyped entrypoint is a runtime boundary. Read its one export
  // as unknown and compare complete results; do not pretend its body is typed.
  const loaded: unknown = await import(
    new URL("./observe-org-repository-inventory.mjs", import.meta.url).href
  );
  assert.ok(loaded !== null && typeof loaded === "object" && "repositoryInventoryDrift" in loaded);
  const drift = loaded.repositoryInventoryDrift;
  assert.ok(typeof drift === "function");
  const inventory = {
    repositories: [
      {
        repository: current.full_name,
        id: current.id,
        created_at: current.created_at,
        archived: false,
        visibility: "public",
        default_branch: "main",
        is_fork: false,
        fork_parent: null,
      },
    ],
  };
  const policy = {
    repositories: [
      { repository: current.full_name, repository_id: current.id, repository_lifecycle: "active" },
    ],
  };
  const registration = {
    inventory: {
      ...inventory.repositories[0],
      repository: "agent-teams-ai/payments-sdk",
      id: 2,
      created_at: "2026-10-19T19:00:14Z",
    },
    docs_protocol: {
      repository: "agent-teams-ai/payments-sdk",
      repository_id: 2,
      repository_lifecycle: "active",
    },
  };
  const scope = { repositories: [registration] },
    live = { ...current, visibility: "public", fork_parent: null };
  const payment = {
    ...live,
    full_name: registration.inventory.repository,
    id: 2,
    created_at: registration.inventory.created_at,
  };
  const invoke = (values: unknown[]): unknown =>
    Reflect.apply(drift, undefined, [values, inventory, policy, scope]);
  assert.deepEqual(invoke([live, payment]), {
    missingFromSnapshot: [],
    absentFromOrganization: [],
    structuralChanges: [],
    missingClassification: [],
  });
  assert.deepEqual(invoke([live]), {
    missingFromSnapshot: [],
    absentFromOrganization: [payment.full_name],
    structuralChanges: [],
    missingClassification: [],
  });
  assert.deepEqual(
    invoke([
      { ...live, visibility: "private" },
      payment,
      { ...payment, id: 3, full_name: "agent-teams-ai/another" },
    ]),
    {
      missingFromSnapshot: ["agent-teams-ai/another"],
      absentFromOrganization: [],
      structuralChanges: [
        {
          repository: live.full_name,
          field: "visibility",
          expected: "public",
          observed: "private",
        },
      ],
      missingClassification: [
        {
          repository: "agent-teams-ai/another",
          repository_id: 3,
          required_status: "pending_classification",
        },
      ],
    },
  );
  assert.equal(
    inventory.repositories.length,
    1,
    "the historical snapshot is never mutated by projection",
  );
});
