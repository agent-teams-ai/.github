#!/usr/bin/env python3
"""Reviewed corrections applied after composition, before all candidate checks."""
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
path.write_text(text.replace(old, new))

path = root / 'scripts/observe-org-repository-inventory.mjs'
text = path.read_text()
assert text.count('.toSorted()') == 2
# Preserve JavaScript's string ordering, independent of host locale.
path.write_text(text.replace('.toSorted()', '.toSorted((left, right) => String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0)'))
print('Exact named CI contracts and current explicit inventory ordering retained; no quality rule disabled.')
