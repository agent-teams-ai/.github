import assert from "node:assert/strict";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Schema } from "ajv/dist/2020.js";

function synchronousSchema(value: unknown): Schema {
  if (typeof value === "boolean") { return value; }
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), "Expected a JSON Schema mapping or boolean");
  assert.ok(!("$async" in value) || value.$async === false, "Governance schemas must validate synchronously");
  return value;
}

// One strict validator for both the retained JavaScript entrypoint and typed
// registration policy. The owned schema supplies the runtime type boundary.
export function validateSchema<T = unknown>(value: unknown, schema: unknown, label: string,
  relatedSchemas: readonly unknown[] = []): T {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const related of relatedSchemas) { ajv.addSchema(synchronousSchema(related)); }
  const validate = ajv.compile<T>(synchronousSchema(schema));
  if (!validate(value)) {
    const details = (validate.errors ?? [])
      .map(({ instancePath, message }) => `${instancePath || "/"} ${message}`)
      .join("; ");
    throw new Error(`${label} does not satisfy its JSON Schema: ${details}`);
  }
  return value;
}
