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

function coordinateChecksum(entries) {
  const canonical = [...entries]
    .sort(({ path: left }, { path: right }) => (left < right ? -1 : left > right ? 1 : 0))
    .map(({ path, git_blob_sha: blob }) => `${path}\0${blob}\n`)
    .join("");
  return createHash("sha256").update(canonical).digest("hex");
}

function validateCoordinateChecksum(entries, digest, required, label) {
  if (!required) {
    assert(entries.length === 0 && digest === null, `${label} must be explicitly empty.`);
    return;
  }
  assert(entries.length > 0 && digest !== null, `${label} must contain dated Git evidence coordinates.`);
  const paths = entries.map(({ path }) => path);
  assert(new Set(paths).size === paths.length, `${label} paths must be unique.`);
  assert(
    digest === coordinateChecksum(entries),
    `${label} internal coordinate checksum does not match its ledger entries.`,
  );
}

function validateSpecificationEvidence(evidence, repository) {
  const reviewed = evidence.evidence_status === "dated_human_reviewed_coordinates";
  assert(
    reviewed === (evidence.revision !== null && evidence.entries.length > 0),
    `${repository} reviewed specification coordinates require a source revision and entries.`,
  );
  validateCoordinateChecksum(evidence.entries, evidence.coordinate_checksum_sha256, reviewed, `${repository} specification evidence`);
  assert(reviewed || evidence.revision === null, `${repository} unreviewed specification evidence must not imply a revision.`);
  const approval = evidence.approval_evidence;
  const approvalApplicable = approval.status !== "not_applicable";
  assert(
    approvalApplicable === (approval.revision !== null && approval.entries.length > 0),
    `${repository} approval evidence must cite a revision or be N/A.`,
  );
  validateCoordinateChecksum(approval.entries, approval.coordinate_checksum_sha256, approvalApplicable, `${repository} approval evidence`);
  assert(approvalApplicable || approval.revision === null, `${repository} N/A approval evidence must not imply a revision.`);
  assert(!approvalApplicable || approval.revision === evidence.revision, `${repository} approval evidence revision must match the specification snapshot.`);
}

function validateQualification(qualification, repository, axis) {
  const accepted = qualification.evidence_status === "governance_accepted_coordinates";
  const notApplicable = qualification.evidence_status === "not_applicable";
  assert(
    accepted ===
      (qualification.accepted_revision !== null && qualification.evidence_entries.length > 0),
    `${repository} ${axis} governance acceptance requires a revision coordinate and evidence entries.`,
  );
  validateCoordinateChecksum(
    qualification.evidence_entries,
    qualification.coordinate_checksum_sha256,
    accepted,
    `${repository} ${axis} qualification evidence`,
  );
  assert(
    accepted || qualification.accepted_revision === null,
    `${repository} unaccepted or N/A ${axis} qualification must not imply a revision.`,
  );
  assert(
    notApplicable === (qualification.status === "not_applicable"),
    `${repository} ${axis} N/A status and evidence_status must agree.`,
  );
  assert(
    !accepted || !["not_qualified", "not_applicable"].includes(qualification.status),
    `${repository} ${axis} cannot be both governance-accepted and ${qualification.status}.`,
  );
}

function validateRemoteChecks(remote, repository) {
  const observed = remote.status === "observed_active";
  const excepted = remote.status === "unavailable_free_private_repository";
  const unobserved = remote.status === "not_observed";
  const observedShape =
    remote.ruleset_id !== null &&
    remote.checks.length > 0 &&
    remote.required_approving_review_count === 0 &&
    remote.require_code_owner_review === false &&
    remote.reason === null &&
    remote.exception_id === null;
  const unavailableShape =
    remote.ruleset_id === null &&
    remote.checks.length === 0 &&
    remote.required_approving_review_count === null &&
    remote.require_code_owner_review === null &&
    remote.reason === null &&
    remote.exception_id !== null;
  const unobservedShape =
    remote.ruleset_id === null &&
    remote.checks.length === 0 &&
    remote.required_approving_review_count === null &&
    remote.require_code_owner_review === null &&
    typeof remote.reason === "string" &&
    remote.reason.length > 0 &&
    remote.exception_id === null;
  assert(
    observed === observedShape,
    `${repository} observed-active remote checks must use the exact enforced shape.`,
  );
  assert(
    excepted === unavailableShape,
    `${repository} unavailable remote checks must use the exact exception shape.`,
  );
  assert(
    unobserved === unobservedShape,
    `${repository} unobserved remote checks must use the exact reason shape.`,
  );
  const identities = remote.checks.map(({ context, integration_id }) => `${context}\0${integration_id}`);
  assert(new Set(identities).size === identities.length, `${repository} remote checks must be unique.`);
}

const maturityByApplicability = {
  capability_owner: ["capability_implemented"],
  applicable: [
    "synthetic_proposed",
    "implemented_internal_slice",
    "accepted_partial_projections",
  ],
  governance_only: ["governance_only"],
  not_applicable: ["not_applicable"],
};

export function validateExecutableSpecLedger(ledger, schema) {
  validateSchema(ledger, schema, "Executable-spec qualification ledger");
  const repositories = new Set();
  const activeRepositoryIds = new Set();
  const exclusions = new Set(
    ledger.scope.archived_exclusions.map(({ repository }) => repository),
  );
  const excludedRepositoryIds = new Set(
    ledger.scope.archived_exclusions.map(({ repository_id }) => repository_id),
  );
  assert(
    exclusions.size === ledger.scope.archived_exclusions.length,
    "Archived exclusions must be unique.",
  );
  assert(
    excludedRepositoryIds.size === ledger.scope.archived_exclusions.length,
    "Archived exclusion repository IDs must be unique.",
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
    assert(!activeRepositoryIds.has(record.repository_id), `Duplicate active repository ID: ${record.repository_id}`);
    assert(!excludedRepositoryIds.has(record.repository_id), `${record.repository} ID cannot be both active and excluded.`);
    repositories.add(record.repository);
    activeRepositoryIds.add(record.repository_id);
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

    assert(
      maturityByApplicability[record.applicability].includes(record.specification_maturity),
      `${record.repository} maturity is incompatible with applicability ${record.applicability}.`,
    );

    const positiveMaturity = [
      "capability_implemented",
      "implemented_internal_slice",
      "accepted_partial_projections",
    ].includes(record.specification_maturity);
    if (positiveMaturity) {
      assert(
        record.specification_evidence.evidence_status === "dated_human_reviewed_coordinates" &&
          record.specification_evidence.approval_evidence.status === "accepted_transitive",
        `${record.repository} positive maturity requires human-reviewed coordinates and accepted approval evidence.`,
      );
    }
    if (record.specification_maturity === "synthetic_proposed") {
      assert(
        record.specification_evidence.evidence_status === "dated_human_reviewed_coordinates" &&
          record.specification_evidence.approval_evidence.status === "proposed_unapproved",
        `${record.repository} proposed maturity must retain reviewed coordinates but remain explicitly unapproved.`,
      );
    }
    if (record.applicability === "governance_only") {
      assert(
        record.specification_maturity === "governance_only" &&
          record.specification_evidence.evidence_status === "unverified_snapshot" &&
          record.implementation_qualification.status === "not_applicable" &&
          record.deployment_qualification.status === "not_applicable",
        `${record.repository} governance-only axes are inconsistent.`,
      );
    }
    if (record.applicability === "not_applicable") {
      assert(
        record.specification_maturity === "not_applicable" &&
          record.specification_evidence.evidence_status === "not_applicable" &&
          record.implementation_qualification.status === "not_applicable" &&
          record.deployment_qualification.status === "not_applicable",
        `${record.repository} N/A axes are inconsistent.`,
      );
    }
    for (const qualification of [record.implementation_qualification, record.deployment_qualification]) {
      assert(
        qualification.status !== "capability_only_not_product_qualified" ||
          qualification.evidence_status !== "governance_accepted_coordinates",
        `${record.repository} capability-only status cannot claim product qualification.`,
      );
      assert(
        (qualification.status === "partially_qualified_internal_slice") ===
          (qualification.evidence_status === "governance_accepted_coordinates"),
        `${record.repository} positive qualification status requires governance-accepted evidence coordinates.`,
      );
      assert(
        qualification.evidence_status !== "governance_accepted_coordinates" ||
          qualification.accepted_revision === record.specification_evidence.revision,
        `${record.repository} qualification revision must match its specification revision.`,
      );
      assert(
        qualification.evidence_status !== "governance_accepted_coordinates" ||
          record.specification_evidence.approval_evidence.status === "accepted_transitive",
        `${record.repository} governance-accepted qualification requires accepted catalog or ADR evidence.`,
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
  const observed = policy.defaults_evidence.verification === "observed_api_snapshot";
  assert(
    observed ===
      (typeof policy.defaults_evidence.endpoint === "string" &&
        policy.defaults_evidence.endpoint.length > 0),
    "Observed security state must cite its API endpoint; unverified state must not.",
  );
  const exceptionRepositories = policy.required_check_exceptions.map(({ repository }) => repository);
  const exceptionIds = policy.required_check_exceptions.map(({ id }) => id);
  assert(new Set(exceptionRepositories).size === exceptionRepositories.length, "Required-check exceptions must be unique by repository.");
  assert(new Set(exceptionIds).size === exceptionIds.length, "Required-check exception IDs must be unique.");
  const defaultIds = new Set(policy.defaults.map(({ id }) => id));
  const attachments = policy.repository_attachments.map(({ repository }) => repository);
  const attachmentIds = policy.repository_attachments.map(({ repository_id }) => repository_id);
  assert(new Set(attachments).size === attachments.length, "Security attachments must be unique by repository.");
  assert(new Set(attachmentIds).size === attachmentIds.length, "Security attachments must be unique by repository ID.");
  for (const attachment of policy.repository_attachments) {
    const claims = attachment.evidence_records.map(({ claim }) => claim);
    assert(new Set(claims).size === claims.length, `${attachment.repository} security evidence claims must be unique.`);
    const configuration = attachment.evidence_records.find(
      ({ claim }) => claim === "configuration_attachment",
    );
    assert(defaultIds.has(configuration?.configuration_id), `${attachment.repository} references an unknown security configuration.`);
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

export function validateGovernanceReferences(ledger, security, actions) {
  const exceptionIds = security.required_check_exceptions.map(({ id }) => id);
  assert(new Set(exceptionIds).size === exceptionIds.length, "Required-check exception authority IDs must be unique.");
  const exceptions = new Map(
    security.required_check_exceptions.map((exception) => [exception.id, exception]),
  );
  const actionReferenceIds = actions.required_check_exception_ids;
  assert(new Set(actionReferenceIds).size === actionReferenceIds.length, "Actions exception references must be unique.");
  const actionReferences = new Set(actionReferenceIds);
  const ledgerReferenceRecords = ledger.repositories.filter(
    ({ gate_contract }) => gate_contract.remote_required_checks.exception_id !== null,
  );
  const ledgerReferenceIds = ledgerReferenceRecords.map(
    ({ gate_contract }) => gate_contract.remote_required_checks.exception_id,
  );
  assert(new Set(ledgerReferenceIds).size === ledgerReferenceIds.length, "Ledger exception references must be one-to-one.");
  const ledgerReferences = new Map(
    ledgerReferenceRecords.map((record) => [record.gate_contract.remote_required_checks.exception_id, record]),
  );
  for (const reference of actionReferenceIds) {
    assert(exceptions.has(reference), `Actions policy references unknown required-check exception: ${reference}`);
  }
  for (const [reference, record] of ledgerReferences) {
    const exception = exceptions.get(reference);
    assert(exception, `${record.repository} references unknown required-check exception: ${reference}`);
    assert(exception.repository === record.repository, `${record.repository} references an exception owned by another repository.`);
  }
  for (const exception of exceptions.values()) {
    assert(actionReferences.has(exception.id), `Actions policy must reference required-check exception: ${exception.id}`);
    assert(ledgerReferences.has(exception.id), `Executable-spec ledger must reference required-check exception: ${exception.id}`);
  }
}

export async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
