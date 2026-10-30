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
path.write_text(text.replace(old, new))
print('Bound exact CI bootstrap step names and commands; conditions and continue-on-error remain forbidden.')
