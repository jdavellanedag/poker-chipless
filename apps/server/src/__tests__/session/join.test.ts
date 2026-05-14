import { describe, it, expect } from 'vitest';
import { createSession } from '../../session/create.js';
import { joinSession } from '../../session/join.js';

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
