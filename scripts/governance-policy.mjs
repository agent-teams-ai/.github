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

function isCanonicalRepositoryPath(path) {
  if (typeof path !== "string" || path !== path.normalize("NFC")) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes(":") || /[\u0000-\u001F\u007F]/u.test(path)) {
    return false;
  }
  const segments = path.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
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
  const absent = remote.status === "observed_absent";
  const excepted = remote.status === "unavailable_free_private_repository";
  const unobserved = remote.status === "not_observed";
  const collectionEndpoint = `https://api.github.com/repos/${repository}/rulesets`;
  const observedShape =
    remote.observed_at !== null &&
    remote.evidence_endpoint === `${collectionEndpoint}/${remote.ruleset_id}` &&
    remote.http_status === 200 &&
    remote.ruleset_id !== null &&
    remote.checks.length > 0 &&
    remote.required_approving_review_count === 0 &&
    remote.require_code_owner_review === false &&
    remote.reason === null &&
    remote.exception_id === null;
  const absentShape =
    remote.observed_at !== null &&
    remote.evidence_endpoint === collectionEndpoint &&
    remote.http_status === 200 &&
    remote.ruleset_id === null &&
    remote.checks.length === 0 &&
    remote.required_approving_review_count === null &&
    remote.require_code_owner_review === null &&
    remote.reason === null &&
    remote.exception_id === null;
  const unavailableShape =
    remote.observed_at !== null &&
    remote.evidence_endpoint === collectionEndpoint &&
    remote.http_status === 403 &&
    remote.ruleset_id === null &&
    remote.checks.length === 0 &&
    remote.required_approving_review_count === null &&
    remote.require_code_owner_review === null &&
    remote.reason === null &&
    remote.exception_id !== null;
  const unobservedShape =
    remote.observed_at === null &&
    remote.evidence_endpoint === null &&
    remote.http_status === null &&
    remote.ruleset_id === null &&
    remote.checks.length === 0 &&
    remote.required_approving_review_count === null &&
    remote.require_code_owner_review === null &&
    typeof remote.reason === "string" &&
    remote.reason.trim().length > 0 &&
    remote.exception_id === null;
  assert(
    observed === observedShape,
    `${repository} observed-active remote checks must use the exact enforced shape.`,
  );
  assert(
    absent === absentShape,
    `${repository} observed-absent remote checks must use the exact empty-ruleset shape.`,
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
  assert(
    ledger.ledger_revision.startsWith(`${ledger.snapshot_date}.`),
    "Ledger revision date must match its snapshot date.",
  );
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
    const disabledGateShape =
      record.gate_contract.full_repository_command === null &&
      record.gate_contract.executable_spec_commands.length === 0;
    const enabledGateShape =
      record.gate_contract.full_repository_command !== null &&
      record.gate_contract.executable_spec_commands.length > 0;
    assert(
      notApplicable === disabledGateShape && !notApplicable === enabledGateShape,
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
    if (record.applicability === "capability_owner") {
      assert(
        record.implementation_qualification.status ===
          "capability_only_not_product_qualified" &&
          record.deployment_qualification.status === "not_applicable" &&
          record.deployment_qualification.evidence_status === "not_applicable",
        `${record.repository} capability-owner qualification axes are inconsistent.`,
      );
    }
    if (record.applicability === "applicable") {
      const allowedProductStatuses = new Set([
        "not_qualified",
        "partially_qualified_internal_slice",
      ]);
      assert(
        allowedProductStatuses.has(record.implementation_qualification.status) &&
          allowedProductStatuses.has(record.deployment_qualification.status),
        `${record.repository} product qualification axes are inconsistent.`,
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
  const hasRemoteObservation = ledger.repositories.some(
    ({ gate_contract }) =>
      gate_contract.remote_required_checks.status !== "not_observed",
  );
  assert(
    hasRemoteObservation ===
      (ledger.remote_enforcement.verification === "dated_api_observation"),
    "Remote enforcement verification must match the repository observations.",
  );
  for (const { repository, gate_contract } of ledger.repositories) {
    const remote = gate_contract.remote_required_checks;
    if (ledger.remote_enforcement.verification === "dated_api_observation") {
      assert(
        remote.status !== "not_observed" &&
          remote.observed_at === ledger.remote_enforcement.observed_at,
        `${repository} ruleset evidence must match the dated organization snapshot.`,
      );
    } else {
      assert(
        remote.status === "not_observed",
        `${repository} cannot retain ruleset observations under an unverified snapshot.`,
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
  const defaultsEndpoint =
    `https://api.github.com/orgs/${policy.organization}/code-security/configurations/defaults`;
  assert(
    observed ===
      (policy.defaults_evidence.endpoint === defaultsEndpoint),
    "Observed security state must cite its API endpoint; unverified state must not.",
  );
  const organizationClaims = policy.organization_observations.map(({ claim }) => claim);
  assert(
    new Set(organizationClaims).size === organizationClaims.length,
    "Organization security observation claims must be unique.",
  );
  for (const observation of policy.organization_observations) {
    const expectedEndpoint =
      observation.claim === "organization_ghas_billing"
        ? `https://api.github.com/orgs/${policy.organization}/settings/billing/advanced-security`
        : `https://api.github.com/orgs/${policy.organization}`;
    assert(
      observation.endpoint === expectedEndpoint,
      `${observation.claim} must cite an endpoint scoped to the observed organization.`,
    );
  }
  const twoFactor = policy.organization_observations.find(
    ({ claim }) => claim === "two_factor_requirement_enabled",
  );
  if (twoFactor.value) {
    assert(
      twoFactor.transition_status === "none" &&
        twoFactor.risk === null &&
        twoFactor.compensation === null,
      "Enabled two-factor enforcement must not retain a pending transition or compensation.",
    );
  } else {
    assert(
        twoFactor.transition_status !== "none" &&
        typeof twoFactor.risk === "string" &&
        twoFactor.risk.trim().length > 0 &&
        typeof twoFactor.compensation === "string" &&
        twoFactor.compensation.trim().length > 0,
      "A disabled two-factor requirement must record its transition, risk, and compensation.",
    );
  }
  const exceptionRepositories = policy.required_check_exceptions.map(({ repository }) => repository);
  const exceptionIds = policy.required_check_exceptions.map(({ id }) => id);
  assert(new Set(exceptionRepositories).size === exceptionRepositories.length, "Required-check exceptions must be unique by repository.");
  assert(new Set(exceptionIds).size === exceptionIds.length, "Required-check exception IDs must be unique.");
  const defaultIds = new Set(policy.defaults.map(({ id }) => id));
  const defaultsById = new Map(policy.defaults.map((configuration) => [configuration.id, configuration]));
  const attachments = policy.repository_attachments.map(({ repository }) => repository);
  const attachmentIds = policy.repository_attachments.map(({ repository_id }) => repository_id);
  assert(new Set(attachments).size === attachments.length, "Security attachments must be unique by repository.");
  assert(new Set(attachmentIds).size === attachmentIds.length, "Security attachments must be unique by repository ID.");
  for (const attachment of policy.repository_attachments) {
    const claims = attachment.evidence_records.map(({ claim }) => claim);
    assert(new Set(claims).size === claims.length, `${attachment.repository} security evidence claims must be unique.`);
    const expectedEndpoints = new Map([
      [
        "configuration_attachment",
        `https://api.github.com/repos/${attachment.repository}/code-security-configuration`,
      ],
      [
        "dependabot_alerts_enablement",
        `https://api.github.com/repos/${attachment.repository}/vulnerability-alerts`,
      ],
      [
        "automated_security_fixes",
        `https://api.github.com/repos/${attachment.repository}/automated-security-fixes`,
      ],
    ]);
    for (const evidence of attachment.evidence_records) {
      assert(
        evidence.endpoint === expectedEndpoints.get(evidence.claim),
        `${attachment.repository} ${evidence.claim} endpoint must match the repository scope.`,
      );
    }
    const configuration = attachment.evidence_records.find(
      ({ claim }) => claim === "configuration_attachment",
    );
    assert(defaultIds.has(configuration?.configuration_id), `${attachment.repository} references an unknown security configuration.`);
    const expectedVisibility =
      attachment.visibility === "public" ? "public" : "private_and_internal";
    assert(
      defaultsById.get(configuration?.configuration_id)?.default_for_new_repositories ===
        expectedVisibility,
      `${attachment.repository} security configuration does not match repository visibility.`,
    );
  }
}

function inventoryChecksum(entries) {
  const canonical = [...entries]
    .sort(({ repository: left }, { repository: right }) =>
      left < right ? -1 : left > right ? 1 : 0)
    .map(({ repository, id, archived, visibility, default_branch: branch, is_fork: fork, fork_parent: parent }) =>
      `${repository}\0${id}\0${archived}\0${visibility}\0${branch}\0${fork}\0${JSON.stringify(parent)}\n`)
    .join("");
  return createHash("sha256").update(canonical).digest("hex");
}

export function validateOrganizationRepositoryInventory(inventory, schema) {
  validateSchema(inventory, schema, "Organization repository inventory");
  assert(
    inventory.snapshot_revision.startsWith(`${inventory.observed_at}.`),
    "Inventory revision date must match its observation date.",
  );
  const repositories = inventory.repositories.map(({ repository }) => repository);
  const ids = inventory.repositories.map(({ id }) => id);
  assert(new Set(repositories).size === repositories.length, "Inventory repositories must be unique.");
  assert(new Set(ids).size === ids.length, "Inventory repository IDs must be unique.");
  for (const record of inventory.repositories) {
    assert(
      record.is_fork === (record.fork_parent !== null),
      `${record.repository} fork identity and parent must agree.`,
    );
  }
  assert(
    inventory.checksum_sha256 === inventoryChecksum(inventory.repositories),
    "Inventory internal checksum does not match its structural entries.",
  );
}

export function validateDocsProtocolPolicy(policy, schema) {
  validateSchema(policy, schema, "Documentation protocol policy");
  assert(
    policy.snapshot_revision.startsWith(`${policy.observed_at}.`),
    "Documentation protocol revision date must match its observation date.",
  );
  const ids = policy.repositories.map(({ repository_id: id }) => id);
  assert(new Set(ids).size === ids.length, "Documentation protocol repository IDs must be unique.");
  const activeRecords = policy.repositories.filter(
    ({ repository_lifecycle: lifecycle }) => lifecycle === "active",
  );
  const activeNames = activeRecords.map(({ repository }) => repository);
  assert(new Set(activeNames).size === activeNames.length,
    "Active documentation protocol repository names must be unique.");

  const owned = activeRecords.filter(
    ({ governance_ownership: ownership }) => ownership === "organization_owned",
  );
  const external = activeRecords.filter(
    ({ governance_ownership: ownership }) => ownership === "external",
  );
  const forkSources = activeRecords.filter(
    ({ source_provenance: source }) => source.kind === "fork",
  );
  assert(
    activeRecords.length === policy.admission.expected_repository_count &&
      owned.length === policy.admission.owned_repository_count &&
      external.length === policy.admission.external_repository_count &&
      forkSources.length === policy.admission.fork_source_count,
    "Documentation protocol admission counts must match its repository records.",
  );
  const activeOwnedRollouts = owned.filter(
    ({ docs_role: role, cohort_binding_status: binding }) =>
      role === "consumer" && binding === "rollout_pending",
  );
  assert(activeOwnedRollouts.length <= 1,
    "At most one organization-owned consumer may be rollout_pending at a time.");

  const producer = activeRecords.filter(({ docs_role: role }) => role === "protocol_producer");
  const controllers = activeRecords.filter(({ docs_role: role }) => role === "governance_controller");
  assert(
    producer.length === 1 && producer[0].repository === policy.protocol.producer_repository,
    "Documentation protocol must have exactly one declared producer.",
  );
  assert(
    producer[0].protocol_required === false &&
      producer[0].admission_status === "not_applicable" &&
      producer[0].qualification.status === "not_applicable",
    "Documentation protocol producer is not a consumer and must not claim consumer qualification.",
  );
  assert(
    controllers.length === 1 &&
      controllers[0].repository === "agent-teams-ai/.github" &&
      controllers[0].governance_ownership === "organization_owned",
    "Documentation protocol governance controller must be exactly the organization-owned .github repository.",
  );
  const craig = policy.repositories.find(
    ({ repository }) => repository === "agent-teams-ai/craig-meeting-gateway",
  );
  assert(
    craig?.governance_ownership === "external" &&
      craig.source_provenance.kind === "fork" &&
      craig.source_provenance.parent_repository === "CraigChat/craig" &&
      craig.docs_role === "not_applicable" &&
      craig.admission_status === "exception" &&
      craig.exemption !== null,
    "Craig gateway must remain an explicit external-fork documentation protocol exemption.",
  );

  for (const record of policy.repositories) {
    const repositoryPaths = [
      record.profile_path,
      record.caller_workflow_path,
      record.qualification_evidence_path,
      ...record.qualification.evidence_paths,
    ].filter((path) => path !== null);
    assert(
      repositoryPaths.every(isCanonicalRepositoryPath),
      `${record.repository} documentation protocol paths must be canonical NFC repository-relative POSIX paths.`,
    );
    assert(
      (record.source_provenance.kind === "fork") ===
        (record.source_provenance.parent_repository !== null),
      `${record.repository} source provenance kind and parent must agree.`,
    );
    const consumer = record.docs_role === "consumer";
    const admitted = record.admission_status === "admitted";
    const qualified = record.qualification.status === "qualified";
    if (consumer) {
      assert(
        record.governance_ownership === "organization_owned" &&
          record.protocol_required &&
          record.fixed_gate_command === policy.protocol.fixed_gate_command &&
          record.exemption === null,
        `${record.repository} consumer admission contract is incomplete.`,
      );
      assert(admitted === qualified, `${record.repository} admission and qualification status must agree.`);
      if (qualified) {
        const legacy = record.cohort_binding_status === "legacy_pre_cohort";
        const hosted = record.observed_default_branch_evidence;
        assert(
          record.exact_package_version !== null &&
            record.exact_foundation_version !== null &&
            ["legacy_pre_cohort", "rollout_pending", "bound"].includes(
              record.cohort_binding_status,
            ) &&
            record.profile_path !== null &&
            !/^(?:\.github|node_modules)(?:\/|$)/u.test(record.profile_path) &&
            /\.ya?ml$/u.test(record.profile_path) &&
            record.caller_workflow_path !== null &&
            /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(record.caller_workflow_path) &&
            record.reusable_workflow_revision !== null &&
            !/^0{40}$/u.test(record.reusable_workflow_revision) &&
            record.qualification_evidence_path !== null &&
            !/^(?:\.github|node_modules)(?:\/|$)/u.test(record.qualification_evidence_path) &&
            /qualification\.json$/u.test(record.qualification_evidence_path) &&
            record.qualification.observed_revision !== null &&
            !/^0{40}$/u.test(record.qualification.observed_revision) &&
            new Set([
              record.profile_path,
              record.caller_workflow_path,
              record.qualification_evidence_path,
            ]).size === 3 &&
            record.qualification.evidence_paths.length >= 4 &&
            record.qualification.evidence_paths.includes("package.json") &&
            record.qualification.evidence_paths.includes(record.profile_path) &&
            record.qualification.evidence_paths.includes(record.caller_workflow_path) &&
            record.qualification.evidence_paths.includes(record.qualification_evidence_path) &&
            (legacy
              ? hosted === null
              : hosted !== null &&
                hosted.revision === record.qualification.observed_revision &&
                hosted.required_context === record.required_check_context &&
                hosted.caller_workflow_path === record.caller_workflow_path &&
                hosted.check_run_url.startsWith(`https://github.com/${record.repository}/actions/runs/`) &&
                hosted.check_run_url.includes(`/actions/runs/${hosted.workflow_run_id}`) &&
                record.required_check_context !== null),
          `${record.repository} qualified admission requires bound package, distinct typed paths, nonzero consumer and reusable-workflow revisions, and complete evidence.`,
        );
      } else if (record.admission_status === "admission_candidate") {
        assert(
          record.cohort_binding_status === "bootstrap_pending" &&
            record.desired_cohort_id !== null &&
            record.observed_cohort_id === null &&
            record.observed_cohort_record_digest === null &&
            record.observed_cohort_event_digest === null &&
            record.exact_package_version === null &&
            record.exact_foundation_version === null &&
            record.profile_path !== null &&
            record.caller_workflow_path !== null &&
            record.qualification_evidence_path !== null &&
            record.required_check_context !== null &&
            record.reusable_workflow_revision === null &&
            record.observed_default_branch_evidence === null &&
            record.qualification.status === "not_qualified" &&
            record.qualification.observed_revision === null &&
            record.qualification.evidence_paths.length === 0,
          `${record.repository} admission candidate must bind only a desired bootstrap Cohort and planned paths.`,
        );
      } else {
        assert(
          record.admission_status === "pending_admission" &&
            record.exact_package_version === null &&
            record.exact_foundation_version === null &&
            record.cohort_binding_status === "not_applicable" &&
            record.desired_cohort_id === null &&
            record.observed_cohort_id === null &&
            record.observed_cohort_record_digest === null &&
            record.observed_cohort_event_digest === null &&
            record.required_check_context === null &&
            record.observed_default_branch_evidence === null &&
            record.profile_path === null &&
            record.caller_workflow_path === null &&
            record.reusable_workflow_revision === null &&
            record.qualification_evidence_path === null &&
            record.qualification.observed_revision === null &&
            record.qualification.evidence_paths.length === 0,
          `${record.repository} pending admission must not imply qualification evidence.`,
        );
      }
    } else {
      const classifiedNotApplicable = record.docs_role === "not_applicable" &&
        ["not_applicable", "exception"].includes(record.admission_status);
      const pendingClassification = record.docs_role === "pending_classification" &&
        record.admission_status === "pending_classification";
      assert(
        !record.protocol_required &&
          record.fixed_gate_command === null &&
          record.exact_package_version === null &&
          record.exact_foundation_version === null &&
          record.cohort_binding_status === "not_applicable" &&
          record.desired_cohort_id === null &&
          record.observed_cohort_id === null &&
          record.observed_cohort_record_digest === null &&
          record.observed_cohort_event_digest === null &&
          record.profile_path === null &&
          record.caller_workflow_path === null &&
          record.reusable_workflow_revision === null &&
          record.qualification_evidence_path === null &&
          record.required_check_context === null &&
          record.observed_default_branch_evidence === null &&
          (classifiedNotApplicable || pendingClassification ||
            ["governance_controller", "protocol_producer"].includes(record.docs_role)) &&
          record.qualification.status === "not_applicable" &&
          record.qualification.observed_revision === null &&
          record.qualification.evidence_paths.length === 0,
        `${record.repository} non-consumer must not imply documentation protocol adoption.`,
      );
    }

    const exemptFork = record.governance_ownership === "external";
    assert(
      exemptFork === (record.exemption !== null) &&
        (!exemptFork || record.docs_role === "not_applicable"),
      `${record.repository} fork exemption shape is invalid.`,
    );
    assert(
      (record.repository_id === 1319378484) ===
        (record.required_check_exception_id === "platform-private-required-checks-github-free"),
      `${record.repository} required-check exception reference is invalid.`,
    );
  }
}

export function validateActionsPolicy(policy, schema) {
  validateSchema(policy, schema, "Actions policy snapshot");
  assert(
    policy.snapshot_revision.startsWith(`${policy.last_live_audit_attempt.attempted_at}.`),
    "Actions snapshot revision must match its last live audit attempt.",
  );
  assert(
    policy.last_live_audit_attempt.attempted_at >= policy.observed_at,
    "Actions live audit attempt must not predate the authoritative observation.",
  );
  const pinning = policy.action_sha_pinning;
  if (pinning.fully_enforced) {
    assert(
      pinning.sha_pinning_required &&
        pinning.rollout_status === "enforced" &&
        pinning.pending.length === 0,
      "Fully enforced SHA pinning requires enabled organization policy and no pending repositories.",
    );
  } else {
    assert(
      !pinning.sha_pinning_required &&
        pinning.rollout_status === "pending_gateway_pr" &&
        pinning.pending.length > 0,
      "Pending SHA pinning must name at least one blocking repository.",
    );
  }
  const pending = pinning.pending.map(({ repository }) => repository);
  assert(new Set(pending).size === pending.length, "Pending Actions repositories must be unique.");
}

export function validateGovernanceReferences(ledger, security, actions, inventory, docsProtocol) {
  const organizationApi = `https://api.github.com/orgs/${inventory.organization}`;
  assert(
    security.organization === inventory.organization &&
      ledger.approval_policy.evidence_reference ===
        `${organizationApi}/actions/permissions/workflow` &&
      actions.organization_workflow_permissions.evidence_endpoint ===
        `${organizationApi}/actions/permissions/workflow` &&
      actions.action_sha_pinning.evidence_endpoint ===
        `${organizationApi}/actions/permissions`,
    "Governance policy organization evidence must match the organization inventory authority.",
  );
  assert(
    docsProtocol.organization === inventory.organization &&
      docsProtocol.inventory_snapshot_revision === inventory.snapshot_revision &&
      docsProtocol.observed_at === inventory.observed_at,
    "Documentation protocol policy must reference the exact organization inventory snapshot.",
  );
  const inventoryByRepository = new Map(
    inventory.repositories.map((record) => [record.repository, record]),
  );
  const activeInventory = inventory.repositories.filter(({ archived }) => !archived);
  const archivedInventory = inventory.repositories.filter(({ archived }) => archived);
  assert(
    ledger.snapshot_date === inventory.observed_at &&
      ledger.scope.observed_repository_count === inventory.repositories.length &&
      ledger.scope.active_repository_count === activeInventory.length &&
      ledger.scope.archived_exclusions.length === archivedInventory.length,
    "Ledger scope counts must match the dated organization inventory.",
  );
  const activeLedger = new Map(ledger.repositories.map((record) => [record.repository, record]));
  const archivedLedger = new Map(
    ledger.scope.archived_exclusions.map((record) => [record.repository, record]),
  );
  for (const record of activeInventory) {
    const ledgerRecord = activeLedger.get(record.repository);
    assert(
      ledgerRecord?.repository_id === record.id &&
        ledgerRecord.gate_contract.remote_required_checks.default_branch === record.default_branch,
      `${record.repository} active ledger identity must match the organization inventory.`,
    );
    assert(
      ledgerRecord.gate_contract.remote_required_checks.status !==
        "unavailable_free_private_repository" || record.visibility === "private",
      `${record.repository} private-repository ruleset unavailability requires private inventory visibility.`,
    );
  }
  for (const record of archivedInventory) {
    const exclusion = archivedLedger.get(record.repository);
    assert(
      exclusion?.repository_id === record.id,
      `${record.repository} archived exclusion must match the organization inventory.`,
    );
  }
  assert(
    activeLedger.size === activeInventory.length && archivedLedger.size === archivedInventory.length,
    "Ledger repository sets must exactly match the organization inventory split.",
  );
  const activeDocsProtocol = docsProtocol.repositories.filter(
    ({ repository_lifecycle: lifecycle }) => lifecycle === "active",
  );
  const docsProtocolById = new Map(
    activeDocsProtocol.map((record) => [record.repository_id, record]),
  );
  for (const record of activeInventory) {
    const protocolRecord = docsProtocolById.get(record.id);
    assert(
      protocolRecord?.repository === record.repository,
      `${record.repository} documentation protocol identity must match the active inventory.`,
    );
    assert(
      (protocolRecord.source_provenance.kind === "fork") === record.is_fork &&
        protocolRecord.source_provenance.parent_repository === record.fork_parent,
      `${record.repository} documentation protocol source provenance must match fork evidence.`,
    );
  }
  assert(
    docsProtocolById.size === activeInventory.length,
    "Documentation protocol repository set must exactly match the active organization inventory.",
  );
  for (const record of archivedInventory) {
    const protocolRecord = docsProtocol.repositories.find(
      ({ repository_id: id }) => id === record.id,
    );
    assert(protocolRecord?.repository_lifecycle === "archived",
      `${record.repository} documentation protocol tombstone must match archived inventory.`);
  }
  for (const attachment of security.repository_attachments) {
    const inventoryRecord = inventoryByRepository.get(attachment.repository);
    assert(
      inventoryRecord &&
        !inventoryRecord.archived &&
        inventoryRecord.id === attachment.repository_id &&
        inventoryRecord.visibility === attachment.visibility,
      `${attachment.repository} security attachment identity must match the active organization inventory.`,
    );
  }
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
  const protocolExceptionRecords = docsProtocol.repositories.filter(
    ({ required_check_exception_id: id }) => id !== null,
  );
  for (const record of protocolExceptionRecords) {
    const exception = exceptions.get(record.required_check_exception_id);
    assert(
      exception?.repository === record.repository,
      `${record.repository} documentation protocol references an invalid required-check exception.`,
    );
  }
}

export async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
