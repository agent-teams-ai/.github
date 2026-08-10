import { readFile } from "node:fs/promises";

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

function validateSpecificationEvidence(evidence, repository) {
  const verified = evidence.verification === "verified_at_revision";
  assert(
    verified === (evidence.revision !== null && evidence.paths.length > 0),
    `${repository} specification evidence must bind verified paths to one immutable revision.`,
  );
  if (!verified) {
    assert(
      evidence.revision === null && evidence.paths.length === 0,
      `${repository} unverified or N/A specification evidence must not imply a revision.`,
    );
  }
}

function validateQualification(qualification, repository, axis) {
  const qualified = qualification.verification === "qualified_at_revision";
  const notApplicable = qualification.verification === "not_applicable";
  assert(
    qualified ===
      (qualification.qualified_revision !== null && qualification.evidence_paths.length > 0),
    `${repository} ${axis} qualification must bind evidence to one immutable revision.`,
  );
  if (!qualified) {
    assert(
      qualification.qualified_revision === null && qualification.evidence_paths.length === 0,
      `${repository} unverified or N/A ${axis} qualification must not imply evidence.`,
    );
  }
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
  const identities = remote.checks.map(({ context, integration_id }) => `${context}\0${integration_id}`);
  assert(new Set(identities).size === identities.length, `${repository} remote checks must be unique.`);
}

export function validateExecutableSpecLedger(ledger, schema) {
  validateSchema(ledger, schema, "Executable-spec qualification ledger");
  const repositories = new Set();
  for (const record of ledger.repositories) {
    assert(!repositories.has(record.repository), `Duplicate repository: ${record.repository}`);
    repositories.add(record.repository);
    assert(record.owner.repository === record.repository, `${record.repository} owner must name the same repository.`);
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
}

export async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
