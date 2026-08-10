import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import Ajv2020 from "ajv/dist/2020.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateSchema(value, schema, label) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    const details = validate.errors
      .map(({ instancePath, message }) => `${instancePath || "/"} ${message}`)
      .join("; ");
    throw new Error(`${label} does not satisfy its JSON Schema: ${details}`);
  }
}

function manifestDigest(entries) {
  const canonical = [...entries]
    .sort(({ path: left }, { path: right }) => (left < right ? -1 : left > right ? 1 : 0))
    .map(({ path, git_blob_sha: blob }) => `${path}\0${blob}\n`)
    .join("");
  return createHash("sha256").update(canonical).digest("hex");
}

function validateManifest(entries, digest, required, label) {
  if (!required) {
    assert(entries.length === 0 && digest === null, `${label} must be explicitly empty.`);
    return;
  }
  assert(entries.length > 0 && digest !== null, `${label} must contain immutable blob evidence.`);
  const paths = entries.map(({ path }) => path);
  assert(new Set(paths).size === paths.length, `${label} paths must be unique.`);
  assert(digest === manifestDigest(entries), `${label} manifest digest does not match its Git blob entries.`);
}

function validateSpecificationEvidence(evidence, repository) {
  const verified = evidence.verification === "verified_at_revision";
  assert(
    verified === (evidence.revision !== null && evidence.entries.length > 0),
    `${repository} specification evidence must bind verified paths to one immutable revision.`,
  );
  validateManifest(evidence.entries, evidence.manifest_sha256, verified, `${repository} specification evidence`);
  assert(verified || evidence.revision === null, `${repository} unverified specification evidence must not imply a revision.`);
  const approval = evidence.approval_evidence;
  const approvalApplicable = approval.status !== "not_applicable";
  assert(
    approvalApplicable === (approval.revision !== null && approval.entries.length > 0),
    `${repository} approval evidence must explicitly bind a revision or be N/A.`,
  );
  validateManifest(approval.entries, approval.manifest_sha256, approvalApplicable, `${repository} approval evidence`);
  assert(approvalApplicable || approval.revision === null, `${repository} N/A approval evidence must not imply a revision.`);
  assert(!approvalApplicable || approval.revision === evidence.revision, `${repository} approval evidence revision must match the specification snapshot.`);
}

function validateQualification(qualification, repository, axis) {
  const qualified = qualification.verification === "qualified_at_revision";
  const notApplicable = qualification.verification === "not_applicable";
  assert(
    qualified ===
      (qualification.qualified_revision !== null && qualification.evidence_entries.length > 0),
    `${repository} ${axis} qualification must bind evidence to one immutable revision.`,
  );
  validateManifest(
    qualification.evidence_entries,
    qualification.manifest_sha256,
    qualified,
    `${repository} ${axis} qualification evidence`,
  );
  assert(
    qualified || qualification.qualified_revision === null,
    `${repository} unverified or N/A ${axis} qualification must not imply a revision.`,
  );
  assert(
    notApplicable === (qualification.status === "not_applicable"),
    `${repository} ${axis} N/A status and verification must agree.`,
  );
  assert(
    !qualified || !["not_qualified", "not_applicable"].includes(qualification.status),
    `${repository} ${axis} cannot be both qualified and ${qualification.status}.`,
  );
}

function validateRemoteChecks(remote, repository) {
  const observed = remote.status === "observed_active";
  assert(
    observed === (remote.ruleset_id !== null && remote.checks.length > 0),
    `${repository} active remote checks must bind a ruleset ID and checks.`,
  );
  assert(
    observed === (remote.reason === null),
    `${repository} remote-check reason must be null only for an active observation.`,
  );
  assert(
    observed ===
      (remote.required_approving_review_count === 0 &&
        remote.require_code_owner_review === false),
    `${repository} ruleset approval observation must be exact zero-approval or unavailable.`,
  );
  const identities = remote.checks.map(({ context, integration_id }) => `${context}\0${integration_id}`);
  assert(new Set(identities).size === identities.length, `${repository} remote checks must be unique.`);
}

export function validateExecutableSpecLedger(ledger, schema) {
  validateSchema(ledger, schema, "Executable-spec qualification ledger");
  const repositories = new Set();
  const exclusions = new Set(
    ledger.scope.archived_exclusions.map(({ repository }) => repository),
  );
  assert(
    exclusions.size === ledger.scope.archived_exclusions.length,
    "Archived exclusions must be unique.",
  );
  assert(
    ledger.scope.active_repository_count === ledger.repositories.length,
    "Active repository count must match the ledger records.",
  );
  assert(
    ledger.scope.observed_repository_count ===
      ledger.repositories.length + ledger.scope.archived_exclusions.length,
    "Observed organization repository count must equal active records plus archived exclusions.",
  );
  for (const record of ledger.repositories) {
    assert(!repositories.has(record.repository), `Duplicate repository: ${record.repository}`);
    assert(!exclusions.has(record.repository), `${record.repository} cannot be both active and excluded.`);
    repositories.add(record.repository);
    validateSpecificationEvidence(record.specification_evidence, record.repository);
    validateQualification(record.implementation_qualification, record.repository, "implementation");
    validateQualification(record.deployment_qualification, record.repository, "deployment");

    const notApplicable = record.applicability === "not_applicable";
    assert(
      notApplicable ===
        (record.gate_contract.full_repository_command === null &&
          record.gate_contract.executable_spec_commands.length === 0),
      `${record.repository} local gate applicability is inconsistent.`,
    );
    validateRemoteChecks(record.gate_contract.remote_required_checks, record.repository);

    const positiveMaturity = [
      "capability_implemented",
      "implemented_internal_slice",
      "accepted_partial_projections",
    ].includes(record.specification_maturity);
    if (positiveMaturity) {
      assert(
        record.specification_evidence.verification === "verified_at_revision" &&
          record.specification_evidence.approval_evidence.status === "accepted_transitive",
        `${record.repository} positive maturity requires verified specification and accepted approval evidence.`,
      );
    }
    if (record.specification_maturity === "synthetic_proposed") {
      assert(
        record.specification_evidence.verification === "verified_at_revision" &&
          record.specification_evidence.approval_evidence.status === "proposed_unapproved",
        `${record.repository} proposed maturity must remain verified but explicitly unapproved.`,
      );
    }
    if (record.applicability === "governance_only") {
      assert(
        record.specification_maturity === "governance_only" &&
          record.specification_evidence.verification === "unverified_snapshot" &&
          record.implementation_qualification.status === "not_applicable" &&
          record.deployment_qualification.status === "not_applicable",
        `${record.repository} governance-only axes are inconsistent.`,
      );
    }
    if (record.applicability === "not_applicable") {
      assert(
        record.specification_maturity === "not_applicable" &&
          record.specification_evidence.verification === "not_applicable" &&
          record.implementation_qualification.status === "not_applicable" &&
          record.deployment_qualification.status === "not_applicable",
        `${record.repository} N/A axes are inconsistent.`,
      );
    }
    for (const qualification of [record.implementation_qualification, record.deployment_qualification]) {
      assert(
        qualification.status !== "capability_only_not_product_qualified" ||
          qualification.verification !== "qualified_at_revision",
        `${record.repository} capability-only status cannot claim product qualification.`,
      );
      assert(
        (qualification.status === "partially_qualified_internal_slice") ===
          (qualification.verification === "qualified_at_revision"),
        `${record.repository} positive qualification status requires immutable verified evidence.`,
      );
      assert(
        qualification.verification !== "qualified_at_revision" ||
          qualification.qualified_revision === record.specification_evidence.revision,
        `${record.repository} qualification revision must match its specification revision.`,
      );
    }
  }
  if (!ledger.approval_policy.can_approve_pull_request_reviews) {
    assert(
      ledger.approval_policy.minimum_required_approvals === 0,
      "Approval policy must not create a single-member deadlock.",
    );
  }
}

export function validateCodeSecurityDefaults(policy, schema) {
  validateSchema(policy, schema, "Code-security defaults snapshot");
  const ids = policy.defaults.map(({ id }) => id);
  assert(new Set(ids).size === ids.length, "Security configuration IDs must be unique.");
  const targets = policy.defaults.map(({ default_for_new_repositories }) =>
    default_for_new_repositories);
  assert(new Set(targets).size === targets.length, "Security default visibility targets must be unique.");
  assert(targets.includes("public"), "A public-repository security default is required.");
  assert(targets.includes("private_and_internal"), "A private_and_internal security default is required.");
  const observed = policy.evidence.verification === "observed_api_snapshot";
  assert(
    observed === (typeof policy.evidence.endpoint === "string" && policy.evidence.endpoint.length > 0),
    "Observed security state must cite its API endpoint; unverified state must not.",
  );
  const exceptions = policy.required_check_exceptions.map(({ repository }) => repository);
  assert(new Set(exceptions).size === exceptions.length, "Required-check exceptions must be unique by repository.");
  const defaultIds = new Set(policy.defaults.map(({ id }) => id));
  const attachments = policy.repository_attachments.map(({ repository }) => repository);
  assert(new Set(attachments).size === attachments.length, "Security attachments must be unique by repository.");
  for (const attachment of policy.repository_attachments) {
    assert(defaultIds.has(attachment.configuration_id), `${attachment.repository} references an unknown security configuration.`);
  }
}

export function validateActionsPolicy(policy, schema) {
  validateSchema(policy, schema, "Actions policy snapshot");
  const pinning = policy.action_sha_pinning;
  if (pinning.fully_enforced) {
    assert(
      pinning.organization_policy_enabled &&
        pinning.rollout_status === "enforced" &&
        pinning.pending.length === 0,
      "Fully enforced SHA pinning requires enabled organization policy and no pending repositories.",
    );
  } else {
    assert(
      !pinning.organization_policy_enabled &&
        pinning.rollout_status === "pending_gateway_pr" &&
        pinning.pending.length > 0,
      "Pending SHA pinning must name at least one blocking repository.",
    );
  }
  const pending = pinning.pending.map(({ repository }) => repository);
  assert(new Set(pending).size === pending.length, "Pending Actions repositories must be unique.");
}

export async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
