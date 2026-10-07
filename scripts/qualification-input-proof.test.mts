import assert from "node:assert/strict";
import test from "node:test";
import {
  compareQualificationInputs, MAX_INPUT_ENTRIES,
  type ComparisonExpectationV1, type QualificationInputProofV1, type RejectionReason,
} from "./qualification-input-proof.mts";

const F = "a".repeat(40);
const H = "b".repeat(40);
const content = "1".repeat(64);
const changed = "2".repeat(64);

// Expectations and both records are independently constructed; no receipt derives
// the expected tuple, no production outcome/reason table supplies the test oracle.
function expected(): ComparisonExpectationV1 {
  return {
    version: 1, repository: "example/product", candidate: H, fullAncestor: F,
    fingerprints: { suite: "3".repeat(64), policy: "4".repeat(64), implementation: "5".repeat(64),
      toolchain: "6".repeat(64), installedGraph: "7".repeat(64) },
    qualifiedOrigin: { repository: "example/product", runId: "100", attempt: 2,
      workflow: ".github/workflows/full.yml", workflowRevision: F, sourceRevision: F },
    currentOrigin: { repository: "example/product", runId: "200", attempt: 1,
      workflow: ".github/workflows/affected.yml", workflowRevision: F, sourceRevision: H },
    inputCount: 3,
    inputs: [
      { path: "src/eligible.ts", type: "file", mode: "100644", membership: "structural", content },
      { path: "tools/check.ts", type: "file", mode: "100644", membership: "closed", content },
      { path: "package.json", type: "file", mode: "100644", membership: "closed", content },
    ],
    permittedContentChanges: ["src/eligible.ts"],
  };
}
function proof(candidate: string, qualified: boolean): QualificationInputProofV1 {
  return {
    version: 1, repository: "example/product", candidate, fullAncestor: F,
    fingerprints: { suite: "3".repeat(64), policy: "4".repeat(64), implementation: "5".repeat(64),
      toolchain: "6".repeat(64), installedGraph: "7".repeat(64) },
    origin: { repository: "example/product", runId: qualified ? "100" : "200", attempt: qualified ? 2 : 1,
      workflow: qualified ? ".github/workflows/full.yml" : ".github/workflows/affected.yml",
      workflowRevision: F, sourceRevision: candidate },
    inputs: [
      { path: "src/eligible.ts", type: "file", mode: "100644", membership: "structural", content },
      { path: "tools/check.ts", type: "file", mode: "100644", membership: "closed", content },
      { path: "package.json", type: "file", mode: "100644", membership: "closed", content },
    ],
  };
}
function rejected(current: unknown, reason: RejectionReason, qualified: unknown = proof(F, true), context = expected()): void {
  assert.deepEqual(compareQualificationInputs(context, qualified, current), { status: "rejected", reason });
}
function withEntry(patch: Record<string, unknown>, index = 0): unknown {
  const current = proof(H, false);
  return { ...current, inputs: current.inputs.map((input, i) => i === index ? { ...input, ...patch } : input) };
}

// Failure: equating an omission receipt with execution success, or mutating caller arrays.
test("unchanged closed evidence reports only omission and accepts frozen independent records", () => {
  const context = expected();
  const qualified = proof(F, true);
  const current = proof(H, false);
  for (const record of [qualified, current]) {
    record.inputs.forEach(Object.freeze);
    Object.freeze(record.inputs);
    Object.freeze(record);
  }
  context.inputs.forEach(Object.freeze);
  Object.freeze(context.inputs);
  Object.freeze(context.permittedContentChanges);
  Object.freeze(context);
  assert.deepEqual(compareQualificationInputs(context, qualified, current), { status: "omitted-unchanged-inputs" });
});

// Failure: comparing parent trees or array order rejects a legitimate content-only leaf change.
test("permitted structural leaf content may change while every closed input stays exact", () => {
  const current = proof(H, false);
  const inputs = current.inputs.map(input => input.path === "src/eligible.ts" ? { ...input, content: changed } : { ...input });
  assert.deepEqual(compareQualificationInputs(expected(), proof(F, true), { ...current, inputs: inputs.toReversed() }),
    { status: "omitted-unchanged-inputs" });
});

// Failure: a content allowlist overrides closed membership or admits unrelated content.
test("changed closed and unpermitted leaf content rejects", () => {
  rejected(withEntry({ content: changed }, 1), "closed-input-changed");
  rejected(withEntry({ content: changed }), "closed-input-changed", proof(F, true), { ...expected(), permittedContentChanges: [] });
});

// Failure: comparing only one receipt ignores deletions/additions in qualified or current inventories.
test("independent inventory count rejects missing and added input presence on either side", () => {
  for (const qualifiedSide of [true, false]) {
    const original = proof(qualifiedSide ? F : H, qualifiedSide);
    for (const inputs of [original.inputs.slice(1), [...original.inputs,
      { path: "extra.ts", type: "file", mode: "100644", membership: "closed", content }]]) {
      const altered = { ...original, inputs };
      rejected(qualifiedSide ? proof(H, false) : altered, "incomplete-inputs", qualifiedSide ? altered : proof(F, true));
    }
  }
  const qualified = proof(F, true);
  const current = proof(H, false);
  rejected({ ...current, inputs: current.inputs.slice(1) }, "incomplete-inputs", { ...qualified, inputs: qualified.inputs.slice(1) });
});

// Failure: a Map silently drops repeated entries while unchanged counts still look complete.
test("duplicate entries reject independently in either record", () => {
  for (const qualifiedSide of [true, false]) {
    const original = proof(qualifiedSide ? F : H, qualifiedSide);
    const altered = { ...original, inputs: [original.inputs[0], original.inputs[1], original.inputs[1]] };
    rejected(qualifiedSide ? proof(H, false) : altered, "duplicate-input", qualifiedSide ? altered : proof(F, true));
  }
});

// Failure: content permission hides path, Git kind/mode or closed membership changes.
test("structural coordinates reject independently of matching content on a permitted path", () => {
  for (const patch of [
    { path: "src/renamed.ts" }, { type: "symlink", mode: "120000" },
    { type: "gitlink", mode: "160000" }, { mode: "100755" }, { membership: "closed" },
  ]) {rejected(withEntry(patch), "input-structure-changed");}
  rejected(withEntry({ membership: "structural" }, 1), "input-structure-changed");
});

// Failure: coercion, sparse arrays, ignored extra keys or path normalization hides malformed entries.
test("malformed leaf coordinates are rejected without normalization or coercion", () => {
  for (const patch of [
    { path: "src//eligible.ts" }, { path: "./src/eligible.ts" }, { path: "src/../eligible.ts" },
    { path: "/src/eligible.ts" }, { path: "src\\eligible.ts" }, { path: "src/eligible.ts\n" },
    { path: "x".repeat(4097) }, { mode: 100644 }, { type: "tree" },
    { type: "symlink", mode: "100644" }, { membership: "unknown" },
    { content: "" }, { content: "0".repeat(64) }, { content: 123 }, { unexpected: true },
  ]) {rejected(withEntry(patch), "malformed-proof");}
  const current = proof(H, false);
  const sparse: unknown[] = Array(3);
  sparse[0] = current.inputs[0];
  sparse[2] = current.inputs[2];
  rejected({ ...current, inputs: sparse }, "malformed-proof");
  rejected({ ...current, inputs: current.inputs.map(({ content: ignored, ...entry }, i) => i === 1 ? entry : { ...entry, content: ignored }) }, "malformed-proof");
});

// Failure: a self-declared empty, unbounded or nonclosed inventory claims complete evidence.
test("empty unbounded and entirely structural manifests cannot qualify", () => {
  const current = proof(H, false);
  rejected({ ...current, inputs: [] }, "incomplete-inputs");
  rejected({ ...current, inputs: Array(MAX_INPUT_ENTRIES + 1).fill(current.inputs[0]) }, "incomplete-inputs");
  rejected({ ...current, inputs: current.inputs.map(input => ({ ...input, membership: "structural" })) }, "incomplete-inputs");
});

// Failure: both records share stale suite/policy/compiler/implementation/install hashes and self-certify.
test("each execution fingerprint binds independently supplied expectations on both records", () => {
  for (const key of ["suite", "policy", "implementation", "toolchain", "installedGraph"] as const) {
    const qualified = proof(F, true);
    const current = proof(H, false);
    const badQualified = { ...qualified, fingerprints: { ...qualified.fingerprints, [key]: changed } };
    const badCurrent = { ...current, fingerprints: { ...current.fingerprints, [key]: changed } };
    rejected(badCurrent, "fingerprint-mismatch");
    rejected(current, "fingerprint-mismatch", badQualified);
    rejected(badCurrent, "fingerprint-mismatch", badQualified);
  }
});

// Failure: missing or invalid receipt/version/identity fields fall through as an eligible comparison.
test("missing malformed and unsupported proofs have explicit stable rejection reasons", () => {
  rejected(null, "missing-proof");
  rejected(undefined, "missing-proof");
  rejected(proof(H, false), "missing-proof", null);
  for (const value of [false, 1, "proof", [], {}, { ...proof(H, false), version: "1" },
    { ...proof(H, false), version: Number.NaN }, { ...proof(H, false), candidate: "abc" },
    { ...proof(H, false), fullAncestor: "0".repeat(40) }, { ...proof(H, false), repository: 12 },
    { ...proof(H, false), repository: "../product" },
    { ...proof(H, false), fingerprints: { ...proof(H, false).fingerprints, suite: "ABC" } }]) {
    rejected(value, "malformed-proof");
  }
  rejected({ ...proof(H, false), version: 2 }, "unsupported-version");
  rejected(proof(H, false), "unsupported-version", { ...proof(F, true), version: 2 });
});

// Failure: replayed head or another repository/full ancestor reuses a valid same-content receipt.
test("repository candidate and full ancestor bind the independent identity tuple", () => {
  for (const qualifiedSide of [true, false]) {
    const original = proof(qualifiedSide ? F : H, qualifiedSide);
    for (const patch of [{ repository: "foreign/product" }, { candidate: "c".repeat(40) }, { fullAncestor: "d".repeat(40) }]) {
      const altered = { ...original, ...patch };
      rejected(qualifiedSide ? proof(H, false) : altered, "identity-mismatch", qualifiedSide ? altered : proof(F, true));
    }
  }
});

// Failure: receipt schema agreement authorizes foreign/stale workflow or run/attempt/source origin.
test("all Actions origin coordinates reject stale foreign and replayed records", () => {
  for (const qualifiedSide of [true, false]) {
    const original = proof(qualifiedSide ? F : H, qualifiedSide);
    for (const patch of [
      { repository: "foreign/product" }, { runId: "300" }, { attempt: 3 },
      { workflow: ".github/workflows/foreign.yml" }, { workflowRevision: "e".repeat(40) }, { sourceRevision: "f".repeat(40) },
    ]) {
      const altered = { ...original, origin: { ...original.origin, ...patch } };
      rejected(qualifiedSide ? proof(H, false) : altered, "origin-mismatch", qualifiedSide ? altered : proof(F, true));
    }
  }
  const current = proof(H, false);
  for (const patch of [{ runId: 200 }, { runId: "0200" }, { attempt: "1" }, { attempt: 0 },
    { attempt: 1.5 }, { attempt: Number.MAX_SAFE_INTEGER + 1 }, { workflowRevision: "main" }]) {
    rejected({ ...current, origin: { ...current.origin, ...patch } }, "malformed-proof");
  }
});

// Failure: an authenticated boolean in attacker-controlled data becomes authority.
test("authentication assertions are outside the schema and cannot grant omission", () => {
  const current = proof(H, false);
  rejected({ ...current, authenticated: true }, "malformed-proof");
  rejected({ ...current, origin: { ...current.origin, authenticated: true } }, "malformed-proof");
});

// Failure: incomplete trusted context or an overbroad/duplicated permission weakens the contract.
test("invalid expectations and closed unknown or duplicate content permissions reject", () => {
  for (const permittedContentChanges of [["tools/check.ts"], ["missing.ts"], ["src/eligible.ts", "src/eligible.ts"]]) {
    rejected(proof(H, false), "invalid-content-permission", proof(F, true), { ...expected(), permittedContentChanges });
  }
  for (const patch of [{ inputCount: 0 }, { inputCount: MAX_INPUT_ENTRIES + 1 }, { inputCount: "3" },
    { version: 2 }, { permittedContentChanges: ["./src/eligible.ts"] },
    { currentOrigin: { ...expected().currentOrigin, attempt: "1" } }]) {
    const malformed = { ...expected(), ...patch } as unknown as ComparisonExpectationV1;
    rejected(proof(H, false), "malformed-expectation", proof(F, true), malformed);
  }
  rejected(proof(H, false), "origin-mismatch", proof(F, true),
    { ...expected(), qualifiedOrigin: { ...expected().qualifiedOrigin, sourceRevision: H } });
});

// Failure: retained mutable arrays contaminate later calls or change an already returned result.
test("comparison retains no mutable caller references or hidden state", () => {
  const qualified = proof(F, true);
  const inputs = [...proof(H, false).inputs];
  const current = { ...proof(H, false), inputs };
  const result = compareQualificationInputs(expected(), qualified, current);
  inputs.pop();
  assert.deepEqual(result, { status: "omitted-unchanged-inputs" });
  rejected(current, "incomplete-inputs", qualified);
  assert.deepEqual(compareQualificationInputs(expected(), proof(F, true), proof(H, false)), { status: "omitted-unchanged-inputs" });
});

// Failure: two coordinated receipt edits self-certify without independently derived F coordinates.
test("independent expected leaf coordinates reject coordinated drift in both records", () => {
  for (const patch of [{ content: changed }, { path: "tools/renamed.ts" }, { mode: "100755" }, { membership: "structural" }]) {
    const qualified = proof(F, true);
    const current = proof(H, false);
    const alter = (record: QualificationInputProofV1) => ({ ...record,
      inputs: record.inputs.map((input, i) => i === 1 ? { ...input, ...patch } : input) });
    rejected(alter(current), "content" in patch ? "closed-input-changed" : "input-structure-changed", alter(qualified));
  }
  // Failure: permission for H's content change also rewrites immutable qualified F evidence.
  const qualified = proof(F, true);
  const alteredF = { ...qualified, inputs: qualified.inputs.map((input, index) =>
    index === 0 ? { ...input, content: changed } : input) };
  rejected(proof(H, false), "closed-input-changed", alteredF);
  rejected(withEntry({ content: changed }), "closed-input-changed", alteredF);
  const malformed = { ...expected(), inputs: [expected().inputs[0], expected().inputs[1], expected().inputs[1]] };
  rejected(proof(H, false), "malformed-expectation", proof(F, true), malformed as unknown as ComparisonExpectationV1);
});

// Failure: reordering a set with content and structural drift changes the conservative reason.
test("structural rejection takes precedence over content independently of manifest order", () => {
  const current = proof(H, false);
  const inputs = current.inputs.map((input, index) => index === 0 ? { ...input, path: "src/renamed.ts" }
    : index === 1 ? { ...input, content: changed } : input);
  rejected({ ...current, inputs }, "input-structure-changed");
  rejected({ ...current, inputs: inputs.toReversed() }, "input-structure-changed");
});

// Failure: returning F's first content rejection hides a structural change in H.
test("current structure takes precedence over qualified content drift", () => {
  const qualified = proof(F, true);
  const alteredF = { ...qualified, inputs: qualified.inputs.map((input, index) =>
    index === 1 ? { ...input, content: changed } : input) };
  rejected(withEntry({ path: "src/renamed.ts" }), "input-structure-changed", alteredF);
});

// Failure: Array.from or spread executes caller code and normalizes it into inert evidence.
test("input accessors reject before executing in proofs and independent expectations", () => {
  let calls = 0;
  const current = proof(H, false);
  const leaf = current.inputs[0];
  Object.defineProperty(current.inputs, "0", { get() { calls += 1; return leaf; } });
  rejected(current, "malformed-proof");
  const context = expected();
  const expectedLeaf = context.inputs[0];
  Object.defineProperty(context.inputs, "0", { get() { calls += 1; return expectedLeaf; } });
  rejected(proof(H, false), "malformed-expectation", proof(F, true), context);
  assert.equal(calls, 0);
});

// Failure: caller iteration hides extra properties or supplies a fabricated complete inventory.
test("custom input and permission iterators cannot normalize evidence", () => {
  let calls = 0;
  const current = proof(H, false);
  const inert = [...current.inputs];
  Object.defineProperty(current.inputs, Symbol.iterator, { value: function* () { calls += 1; yield* inert; } });
  rejected(current, "malformed-proof");
  const context = expected();
  Object.defineProperty(context.permittedContentChanges, Symbol.iterator, {
    value: function* () { calls += 1; yield "src/eligible.ts"; },
  });
  rejected(proof(H, false), "malformed-expectation", proof(F, true), context);
  assert.equal(calls, 0);
});

// Failure: the unsupported-version fast path reads an accessor before checking shape.
test("version accessors reject without executing caller code", () => {
  let calls = 0;
  const current = proof(H, false);
  Object.defineProperty(current, "version", { get() { calls += 1; return 1; } });
  rejected(current, "malformed-proof");
  assert.equal(calls, 0);
});
