import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

// __tests__/handlers/ → ../../.. → src/  → ../../../.. → apps/server/
const serverPkg = join(fileURLToPath(import.meta.url), '../../../..');
const serverSrc = join(serverPkg, 'src');

function lineCount(filePath: string): number {
  return readFileSync(filePath, 'utf-8').split('\n').length;
}

describe('handler structure', () => {
  it('index.ts is under 60 lines', () => {
    const lines = lineCount(join(serverSrc, 'index.ts'));
    expect(lines).toBeLessThan(60);
  });

  it('handlers/session.ts exports registerSessionHandlers', async () => {
    const mod = await import(join(serverSrc, 'handlers/session.js'));
    expect(typeof mod.registerSessionHandlers).toBe('function');
  });

  it('handlers/game.ts exports registerGameHandlers', async () => {
    const mod = await import(join(serverSrc, 'handlers/game.js'));
    expect(typeof mod.registerGameHandlers).toBe('function');
  });

  it('handlers/host.ts exports registerHostHandlers', async () => {
    const mod = await import(join(serverSrc, 'handlers/host.js'));
    expect(typeof mod.registerHostHandlers).toBe('function');
  });
});
