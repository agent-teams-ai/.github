import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MANIFEST_PATH,
  validateAppendOnlyStandardHistory,
  validateFeatureModuleStandardManifest,
} from "./check-feature-module-standard.mjs";

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const artifacts = new Map(await Promise.all(manifest.versions.map(async (record) => [
  record.path,
  await readFile(record.path),
])));
const clone = (value) => structuredClone(value);

function digests(source) {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
  return {
    git_blob_sha: createHash("sha1")
      .update(Buffer.from(`blob ${bytes.length}\0`))
      .update(bytes)
      .digest("hex"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

test("accepts the checked-in immutable Feature Module Standard", () => {
  assert.doesNotThrow(() => validateFeatureModuleStandardManifest(manifest, artifacts));
});

test("rejects digest, path, marker, and manifest-shape drift", () => {
  const wrongDigest = clone(manifest);
  wrongDigest.versions[0].sha256 = "0".repeat(64);
  assert.throws(
    () => validateFeatureModuleStandardManifest(wrongDigest, artifacts),
    /digest does not match/u,
  );

  const wrongPath = clone(manifest);
  wrongPath.versions[0].path = "../v1.md";
  assert.throws(
    () => validateFeatureModuleStandardManifest(wrongPath, artifacts),
    /invalid canonical path/u,
  );

  const missingMarkerManifest = clone(manifest);
  const source = artifacts.get(manifest.versions[0].path).toString("utf8");
  const sourceWithoutMarker = Buffer.from(
    source.replace("## Adoption contract", "## Local adoption"),
  );
  Object.assign(missingMarkerManifest.versions[0], digests(sourceWithoutMarker));
  const missingMarkerArtifacts = new Map(artifacts);
  missingMarkerArtifacts.set(manifest.versions[0].path, sourceWithoutMarker);
  assert.throws(
    () => validateFeatureModuleStandardManifest(missingMarkerManifest, missingMarkerArtifacts),
    /missing required marker/u,
  );

  const extraField = clone(manifest);
  extraField.unowned = true;
  assert.throws(
    () => validateFeatureModuleStandardManifest(extraField, artifacts),
    /must contain exactly/u,
  );
});

test("allows append-only successors but rejects mutation or removal", () => {
  const successor = clone(manifest.versions[0]);
  successor.version = "v2";
  successor.path = "docs/architecture/feature-module-standard/v2.md";
  const current = clone(manifest);
  current.versions.push(successor);
  assert.doesNotThrow(() => validateAppendOnlyStandardHistory(current, [manifest]));

  const changed = clone(manifest);
  changed.versions[0].status = "superseded";
  assert.throws(
    () => validateAppendOnlyStandardHistory(changed, [manifest]),
    /metadata is immutable/u,
  );

  const removed = clone(manifest);
  removed.versions = [];
  assert.throws(
    () => validateAppendOnlyStandardHistory(removed, [manifest]),
    /cannot be removed/u,
  );
});
