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

test("individual registrations join the drift view without hiding other drift or claiming a new census", () => {
  const registration = {
    inventory: { ...inventory.repositories[0], repository: "agent-teams-ai/payments-sdk", id: 2, created_at: "2026-10-19T19:00:14Z" },
    docs_protocol: { ...policy.repositories[0], repository: "agent-teams-ai/payments-sdk", repository_id: 2 },
  };
  const scope = { repositories: [registration] };
  const payment = { ...live[0], full_name: registration.inventory.repository, id: 2, created_at: registration.inventory.created_at };
  assert.deepEqual(assertRepositoryInventoryCurrent([...live, payment], inventory, policy, scope),
    { missingFromSnapshot: [], absentFromOrganization: [], structuralChanges: [], missingClassification: [] });
  assert.deepEqual(repositoryInventoryDrift(live, inventory, policy, scope).absentFromOrganization, [payment.full_name]);
  const drift = repositoryInventoryDrift([{ ...live[0], visibility: "private" }, payment,
    { ...payment, id: 3, full_name: "agent-teams-ai/another" }], inventory, policy, scope);
  assert.equal(drift.structuralChanges[0].field, "visibility");
  assert.deepEqual(drift.missingFromSnapshot, ["agent-teams-ai/another"]);
  assert.equal(inventory.repositories.length, 1, "the historical snapshot is never mutated by projection");
});
