#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  loadJson,
  validateDocsProtocolPolicy,
} from "./governance-policy.mjs";
import {
  validateDocsGovernanceReferences,
  validateDocsProtocolExceptions,
} from "./docs-cohort-policy.mjs";
import { verifyDocsAdmissionEvidence } from "./verify-docs-cohort-evidence.mjs";

export async function verifyDocsAdmissionChange(paths, overrides = {}) {
  const [policy, policySchema, exceptions, exceptionsSchema, registry, registrySchema, security] =
    await Promise.all([
      loadJson(paths.policy),
      loadJson("governance/docs-protocol-policy.schema.json"),
      loadJson(paths.exceptions),
      loadJson("governance/docs-protocol-exceptions.schema.json"),
      loadJson("governance/docs-qualified-cohorts.json"),
      loadJson("governance/docs-qualified-cohorts.schema.json"),
      loadJson("governance/code-security-defaults.json"),
    ]);
  validateDocsProtocolPolicy(policy, policySchema);
  validateDocsProtocolExceptions(exceptions, exceptionsSchema);
  validateDocsGovernanceReferences(registry, exceptions, policy, security);
  return verifyDocsAdmissionEvidence(policy, registry, registrySchema, {
    requireCredential: true,
    ...overrides,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const policy = process.env.DOCS_ADMISSION_POLICY_PATH;
  const exceptions = process.env.DOCS_ADMISSION_EXCEPTIONS_PATH;
  if (!policy || !exceptions) {
    throw new Error("Trusted admission verification requires materialized policy and exceptions paths.");
  }
  const verified = await verifyDocsAdmissionChange({ policy, exceptions });
  console.log(`Trusted Docs admission evidence verified for ${verified.length} bound consumer(s).`);
}
