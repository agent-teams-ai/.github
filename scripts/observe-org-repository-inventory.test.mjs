import assert from "node:assert/strict";
import test from "node:test";
import { assertRepositoryInventoryCurrent, auditRepositoryBootstrapConfigurations, loadRemoteBootstrapSource, repositoryInventoryDrift } from "./observe-org-repository-inventory.mjs";

const inventory = { repositories: [{ repository: "agent-teams-ai/current", id: 1, created_at: "2026-08-01T00:00:00Z", archived: false, visibility: "public", default_branch: "main", is_fork: false, fork_parent: null }] };
const policy = { repositories: [{ repository: "agent-teams-ai/current", repository_id: 1, repository_lifecycle: "active", docs_role: "pending_classification", admission_status: "pending_classification" }] };
const live = [{ full_name: "agent-teams-ai/current", id: 1, created_at: "2026-08-01T00:00:00Z", archived: false, visibility: "public", default_branch: "main", fork: false, fork_parent: null }];

test("accepts a live repository represented by the snapshot and policy", () => {
  assert.deepEqual(assertRepositoryInventoryCurrent(live, inventory, policy), { missingFromSnapshot: [], absentFromOrganization: [], structuralChanges: [], missingClassification: [] });
});

test("fails with pending_classification guidance for a new repository", () => {
  assert.throws(() => assertRepositoryInventoryCurrent([...live, { ...live[0], full_name: "agent-teams-ai/new", id: 2 }], inventory, policy), /agent-teams-ai\/new[\s\S]*pending_classification/u);
});

test("reports structural and lifecycle drift as an actionable diff", () => {
  const drift = repositoryInventoryDrift([{ ...live[0], default_branch: "trunk", fork: true, fork_parent: "upstream/current" }], inventory, policy);
  assert.deepEqual(drift.structuralChanges.map(({ field }) => field), ["default_branch", "is_fork", "fork_parent"]);
  assert.deepEqual(repositoryInventoryDrift([], inventory, policy).absentFromOrganization, ["agent-teams-ai/current"]);
});

test("live bootstrap backstop detects a wholly absent caller without migrating older repositories", async () => {
  const files = new Map();
  const source = { read: async path => files.get(path), workflows: async () => [] };
  const results = await auditRepositoryBootstrapConfigurations([
    live[0],
    { ...live[0], id: 2, full_name: "agent-teams-ai/new", created_at: "2026-10-22T01:00:00Z" },
  ], async () => source);
  assert.equal(results.length, 1);
  assert.equal(results[0].repository, "agent-teams-ai/new");
  assert.equal(results[0].status, "unsupported_stack_pending");
  assert.ok(results[0].issues.some(issue => issue.path === ".github/workflows/repository-admission.yml" && issue.message.includes("missing")));
  assert.ok(results[0].issues.some(issue => issue.path === "foundation.config.yaml"));
  assert.match(results[0].guide, /\.github\/blob\/main\/docs\/repository-admission\.md#new-repository-bootstrap$/u);
});

test("older explicit bootstrap opt-in remains mandatory when its caller disappears", async () => {
  const results = await auditRepositoryBootstrapConfigurations(live, async () => ({
    read: async path => path === "package.json" ? '{"repositoryAdmission":1}' : undefined,
    workflows: async () => [],
  }));
  assert.equal(results.length, 1);
  assert.equal(results[0].status, "unsupported_stack_pending");
});

test("bootstrap remote reader fails closed for truncated trees and inaccessible repository data", async () => {
  const sha = "1".repeat(40);
  const commit = { sha, commit: { tree: { sha } } };
  await assert.rejects(loadRemoteBootstrapSource(live[0], async endpoint => endpoint.includes("/commits/") ? commit : { sha, truncated: true, tree: [] }), /Complete bounded Git tree/u);
  await assert.rejects(auditRepositoryBootstrapConfigurations(live, async () => { throw new Error("credential scope unavailable"); }), /credential scope/u);
});
