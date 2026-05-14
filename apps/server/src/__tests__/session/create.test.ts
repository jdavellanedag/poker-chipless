import { describe, it, expect } from 'vitest';
import { generateCode, createSession } from '../../session/create.js';

const VALID_CHARS = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');

describe('generateCode', () => {
  it('returns a 6-character uppercase alphanumeric code with no ambiguous chars', () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
    for (const char of code) {
      expect(VALID_CHARS.has(char), `char '${char}' not in allowed charset`).toBe(true);
    }
  });
});

describe('createSession', () => {
  it('returns a lobby-phase GameState with the host as the only player', () => {
    const { state, token } = createSession('Alice');
    expect(state.phase).toBe('lobby');
    expect(state.players).toHaveLength(1);
    const host = state.players[0];
    expect(host.displayName).toBe('Alice');
    expect(host.isHost).toBe(true);
    expect(host.isConnected).toBe(true);
    expect(host.isEliminated).toBe(false);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('generates a valid 6-char session code', () => {
    const { state } = createSession('Bob');
    expect(state.code).toHaveLength(6);
    for (const char of state.code) {
      expect(VALID_CHARS.has(char)).toBe(true);
    }
  });
});
