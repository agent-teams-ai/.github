#!/usr/bin/env bash
set -euo pipefail
export DOCS_COHORT_PNPM_V1_BIN=/tmp/ef-stable18-live-qualification-20260910/pnpm-v1
export DOCS_COHORT_PNPM_V2_BIN=/tmp/ef-stable18-live-qualification-20260910/pnpm-v2
export TMPDIR=/tmp/ef-stable18-live-qualification-20260910/live-tmp
mkdir -p "$TMPDIR"
unset DOCS_COHORT_EVIDENCE_REF
cd /var/data/sandboxes/ef-resume-20260907/TEST-stable18-live-verifier-20260910
/usr/local/bin/node scripts/verify-docs-cohort-evidence.mjs --registry /tmp/ef-fixed-runner-cohort-stage-20260910-artifacts/candidate/governance/docs-qualified-cohorts.json --schema governance/docs-qualified-cohorts.schema.json --changed-from /tmp/ef-fixed-runner-cohort-stage-20260910-artifacts/registry-base.json
