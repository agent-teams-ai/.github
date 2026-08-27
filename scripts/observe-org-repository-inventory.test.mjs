import assert from "node:assert/strict";
import test from "node:test";
import { assertRepositoryInventoryCurrent, repositoryInventoryDrift } from "./observe-org-repository-inventory.mjs";

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
