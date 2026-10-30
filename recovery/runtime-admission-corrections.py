#!/usr/bin/env python3
"""Reviewed corrections applied after composition, before all candidate checks."""
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
path = root / 'scripts/check-quality-scope.mjs'
text = path.read_text()
old = '''  for (const run of ["pnpm --dir tools/renovate-validation install --frozen-lockfile --ignore-scripts", "pnpm --dir tools/renovate-validation run build:native"]) {
    const matches = steps.filter(step => step?.run === run);
    assert.deepEqual(matches, [{ run }], "CI must retain exact isolated validator bootstrap");
  }'''
new = '''  for (const expected of [
    { name: "Install the isolated Node 24 Renovate tool without lifecycle scripts", run: "pnpm --dir tools/renovate-validation install --frozen-lockfile --ignore-scripts" },
    { name: "Build the allowed native validator dependency with managed Node 24", run: "pnpm --dir tools/renovate-validation run build:native" },
  ]) {
    const matches = steps.filter(step => step?.run === expected.run);
    assert.deepEqual(matches, [expected], "CI must retain exact isolated validator bootstrap");
  }'''
assert text.count(old) == 1, 'Reconstructed CI contract changed; review before applying correction'
text = text.replace(old, new)
old = 'for (const entry of census.classified.filter(entry => entry.path.endsWith(".ts")))'
new = 'for (const entry of census.classified.filter(candidate => candidate.path.endsWith(".ts")))'
assert text.count(old) == 1
text = text.replace(old, new)

# The frozen real-lint fixture intentionally contains lint inputs, not the
# separate Renovate installation. Keep its exact bytes and validate that
# separate installation at the complete quality-scope gate instead.
pattern = r'  assert\.deepEqual\(\s*renovateTool,[\s\S]*?"Isolated validator contract changed",?\s*\);'
found = list(re.finditer(pattern, text))
assert len(found) == 1
check = found[0].group()
text = text[:found[0].start()] + text[found[0].end():]
assert text.count('  renovateTool,\n') == 1
text = text.replace('  renovateTool,\n', '')
text, count = re.subn(r'    renovateTool: await readJson\("tools/renovate-validation/package.json"\),\n', '', text)
assert count == 1
anchor = 'export function assertQualityAdoption('
assert text.count(anchor) == 1
text = text.replace(anchor, '// Runtime tooling is a complete-scope gate, not a dependency of the lint CLI.\n// Keep this fail-closed check in the full gate without widening lint inputs.\nexport function assertRuntimeToolAdoption(renovateTool) {\n' + check + '\n}\n\n' + anchor)
anchor = '  const census = assertQualityAdoption(await readQualityAdoption());'
assert text.count(anchor) == 1
text = text.replace(anchor, anchor + '\n  assertRuntimeToolAdoption(JSON.parse(await readFile(new URL("tools/renovate-validation/package.json", root), "utf8")));')
path.write_text(text)

path = root / 'scripts/check-quality-scope.test.mjs'
text = path.read_text()
text = text.replace('  assertQualityAdoption,', '  assertQualityAdoption,\n  assertRuntimeToolAdoption,', 1)
for name in ['ranged isolated Renovate pin', 'wrong isolated validator runtime', 'unbounded native validator build']:
    pattern = r'  "' + re.escape(name) + r'":\s*\(?value\)?\s*=>\s*\{[^}]*\},\n'
    text, count = re.subn(pattern, '', text)
    assert count == 1, (name, count)
anchor = 'const accepted = await readQualityAdoption();'
addition = '''
const acceptedRuntimeTool = JSON.parse(await readFile(new URL("../tools/renovate-validation/package.json", import.meta.url), "utf8"));

test("complete quality scope accepts the exact isolated runtime contract", () => {
  assertRuntimeToolAdoption(acceptedRuntimeTool);
});
test("complete quality scope rejects a missing isolated runtime contract", () => {
  assert.throws(() => assertRuntimeToolAdoption(undefined), assert.AssertionError);
});
for (const [name, mutate] of Object.entries({
  "ranged isolated Renovate pin": value => { value.devDependencies.renovate = "^44.24.2"; },
  "wrong isolated validator runtime": value => { value.devEngines.runtime.version = "26.11.1"; },
  "unbounded native validator build": value => { value.scripts["build:native"] = "pnpm rebuild"; },
})) {
  test(`complete quality scope rejects ${name}`, () => {
    const value = structuredClone(acceptedRuntimeTool);
    mutate(value);
    assert.throws(() => assertRuntimeToolAdoption(value), assert.AssertionError);
  });
}
'''
assert text.count(anchor) == 1
path.write_text(text.replace(anchor, anchor + '\n' + addition))

path = root / 'scripts/observe-org-repository-inventory.mjs'
text = path.read_text()
assert text.count('.toSorted()') == 2
# Preserve JavaScript's string ordering, independent of host locale.
path.write_text(text.replace('.toSorted()', '.toSorted((left, right) => String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0)'))
print('Exact CI contracts, explicit ordering and all runtime negatives retained; frozen lint fixture unchanged.')
