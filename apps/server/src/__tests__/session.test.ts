import { describe, it, expect } from 'vitest';
import { generateCode, createSession, joinSession } from '../session.js';

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

describe('joinSession', () => {
  it('adds a non-host player to the session and returns a token', () => {
    const { state } = createSession('Alice');
    const result = joinSession(state, { displayName: 'Bob' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players).toHaveLength(2);
    const bob = result.state.players[1];
    expect(bob.displayName).toBe('Bob');
    expect(bob.isHost).toBe(false);
    expect(bob.isConnected).toBe(true);
    expect(typeof result.token).toBe('string');
  });

  it('rejects an empty display name', () => {
    const { state } = createSession('Alice');
    const result = joinSession(state, { displayName: '   ' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('rejects joining a session that is not in lobby phase', () => {
    const { state } = createSession('Alice');
    const activeState = { ...state, phase: 'active' as const };
    const result = joinSession(activeState, { displayName: 'Bob' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });
});
