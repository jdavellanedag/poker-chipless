import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(fileURLToPath(import.meta.url), '../../../../..');

describe('repo setup', () => {
  it('root package.json has engines.node set to >=20', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8'));
    expect(pkg.engines).toBeDefined();
    expect(pkg.engines.node).toMatch(/^\s*>=\s*20/);
  });

  it('.nvmrc at repo root specifies node 20', () => {
    const nvmrc = readFileSync(join(repoRoot, '.nvmrc'), 'utf-8').trim();
    expect(nvmrc).toBe('20');
  });

  it('root package.json start script runs node on the compiled server (not tsx)', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8'));
    expect(pkg.scripts.start).toBe('node apps/server/dist/index.js');
  });
});
