import { describe, it, expect } from 'vitest';
import { createSession, joinSession } from '../session.js';
import { startGame, reorderPlayers } from '../game.js';

function makelobby(playerNames: string[]) {
  const [host, ...rest] = playerNames;
  let { state } = createSession(host);
  for (const name of rest) {
    const result = joinSession(state, { displayName: name });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
  return state;
}

describe('reorderPlayers', () => {
  it('reorders players to the given id sequence', () => {
    const state = makelobby(['Alice', 'Bob', 'Carol']);
    const [alice, bob, carol] = state.players;
    const result = reorderPlayers(state, [carol.id, alice.id, bob.id]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.map((p) => p.id)).toEqual([carol.id, alice.id, bob.id]);
  });

  it('rejects when the id list does not match the player set', () => {
    const state = makelobby(['Alice', 'Bob']);
    const result = reorderPlayers(state, ['non-existent-id', state.players[0].id]);
    expect(result.ok).toBe(false);
  });

  it('rejects when the id list has a different length than players', () => {
    const state = makelobby(['Alice', 'Bob', 'Carol']);
    const result = reorderPlayers(state, [state.players[0].id, state.players[1].id]);
    expect(result.ok).toBe(false);
  });
});

describe('startGame', () => {
  it('rejects when fewer than 2 players are in the lobby', () => {
    const state = makelobby(['Alice']);
    const result = startGame(state, { startingStack: 1000, smallBlind: 10, bigBlind: 20 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('rejects a non-positive starting stack', () => {
    const state = makelobby(['Alice', 'Bob']);
    const result = startGame(state, { startingStack: 0, smallBlind: 10, bigBlind: 20 });
    expect(result.ok).toBe(false);
  });

  it('rejects when big blind is less than small blind', () => {
    const state = makelobby(['Alice', 'Bob']);
    const result = startGame(state, { startingStack: 1000, smallBlind: 20, bigBlind: 10 });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-positive small blind', () => {
    const state = makelobby(['Alice', 'Bob']);
    const result = startGame(state, { startingStack: 1000, smallBlind: 0, bigBlind: 0 });
    expect(result.ok).toBe(false);
  });

  it('transitions phase to active and sets chip counts', () => {
    const state = makelobby(['Alice', 'Bob']);
    const result = startGame(state, { startingStack: 1000, smallBlind: 10, bigBlind: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('active');
    expect(result.state.smallBlind).toBe(10);
    expect(result.state.bigBlind).toBe(20);
    for (const p of result.state.players) {
      expect(p.chipCount).toBe(1000);
    }
  });

  it('rejects when session is not in lobby phase', () => {
    const state = { ...makelobby(['Alice', 'Bob']), phase: 'active' as const };
    const result = startGame(state, { startingStack: 1000, smallBlind: 10, bigBlind: 20 });
    expect(result.ok).toBe(false);
  });
});
