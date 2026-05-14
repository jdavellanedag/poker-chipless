import { describe, it, expect } from 'vitest';
import { createSession } from '../../session/create.js';
import { joinSession } from '../../session/join.js';
import { startGame, newHand, declareWinner, pause, resume, rebuy, endGame, reorderPlayers } from '../../game/host-actions.js';

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

function makeActive(playerNames: string[], startingStack = 1000, smallBlind = 10, bigBlind = 20) {
  const lobby = makelobby(playerNames);
  const result = startGame(lobby, { startingStack, smallBlind, bigBlind });
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function makeHand(playerNames: string[], startingStack = 1000, smallBlind = 10, bigBlind = 20) {
  const active = makeActive(playerNames, startingStack, smallBlind, bigBlind);
  const result = newHand(active);
  if (!result.ok) throw new Error(result.error);
  return result.state;
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

describe('startGame log', () => {
  it('appends "Game started. Stack: 1000, Blinds: 10/20" to the log', () => {
    const state = makelobby(['Alice', 'Bob']);
    const result = startGame(state, { startingStack: 1000, smallBlind: 10, bigBlind: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const messages = result.state.log.map((e) => e.message);
    expect(messages).toContain('Game started. Stack: 1000, Blinds: 10/20');
  });
});

describe('newHand', () => {
  it('rejects when phase is not active', () => {
    const state = makelobby(['Alice', 'Bob']);
    const result = newHand(state);
    expect(result.ok).toBe(false);
  });

  it('in heads-up: button is SB and button/SB acts first pre-flop', () => {
    const state = makeActive(['Alice', 'Bob']);
    const result = newHand(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.state;
    expect(s.dealerButtonIndex).toBe(0);
    expect(s.players[0].currentBet).toBe(10);
    expect(s.players[1].currentBet).toBe(20);
    expect(s.activePlayerIndex).toBe(0);
  });

  it('advances the button clockwise on each subsequent hand', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);
    const hand1 = newHand(state);
    expect(hand1.ok).toBe(true);
    if (!hand1.ok) return;
    expect(hand1.state.dealerButtonIndex).toBe(0);

    const hand2 = newHand(hand1.state);
    expect(hand2.ok).toBe(true);
    if (!hand2.ok) return;
    expect(hand2.state.dealerButtonIndex).toBe(1);

    const hand3 = newHand(hand2.state);
    expect(hand3.ok).toBe(true);
    if (!hand3.ok) return;
    expect(hand3.state.dealerButtonIndex).toBe(2);

    const hand4 = newHand(hand3.state);
    expect(hand4.ok).toBe(true);
    if (!hand4.ok) return;
    expect(hand4.state.dealerButtonIndex).toBe(0);
  });

  it('skips eliminated players when advancing the button', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);
    const hand1 = newHand(state);
    expect(hand1.ok).toBe(true);
    if (!hand1.ok) return;
    const withBobEliminated = {
      ...hand1.state,
      players: hand1.state.players.map((p) =>
        p.displayName === 'Bob' ? { ...p, isEliminated: true } : p,
      ),
    };
    const hand2 = newHand(withBobEliminated);
    expect(hand2.ok).toBe(true);
    if (!hand2.ok) return;
    expect(hand2.state.dealerButtonIndex).toBe(2);
  });

  it('treats SB as all-in when stack is less than small blind', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);
    const shortStack = { ...state.players[1], chipCount: 5 };
    const stateWithShortSB = { ...state, players: [state.players[0], shortStack, state.players[2]] };

    const result = newHand(stateWithShortSB);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sb = result.state.players[1];
    expect(sb.chipCount).toBe(0);
    expect(sb.currentBet).toBe(5);
    expect(sb.isAllIn).toBe(true);
    expect(result.state.pot).toBe(25);
    const messages = result.state.log.map((e) => e.message);
    expect(messages).toContain('Bob posts small blind: 5');
  });

  it('treats BB as all-in when stack is less than big blind', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);
    const shortStack = { ...state.players[2], chipCount: 8 };
    const stateWithShortBB = { ...state, players: [state.players[0], state.players[1], shortStack] };

    const result = newHand(stateWithShortBB);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bb = result.state.players[2];
    expect(bb.chipCount).toBe(0);
    expect(bb.currentBet).toBe(8);
    expect(bb.isAllIn).toBe(true);
    expect(result.state.pot).toBe(18);
    const messages = result.state.log.map((e) => e.message);
    expect(messages).toContain('Carol posts big blind: 8');
  });

  it('appends log entries for each blind posted', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);
    const result = newHand(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const messages = result.state.log.map((e) => e.message);
    expect(messages).toContain('Bob posts small blind: 10');
    expect(messages).toContain('Carol posts big blind: 20');
  });

  it('places button at index 0, posts blinds, and sets UTG on the first hand', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);

    const result = newHand(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.state;
    expect(s.dealerButtonIndex).toBe(0);
    expect(s.players[1].chipCount).toBe(990);
    expect(s.players[2].chipCount).toBe(980);
    expect(s.pot).toBe(30);
    expect(s.currentBet).toBe(20);
    expect(s.activePlayerIndex).toBe(0);
  });
});

describe('declareWinner', () => {
  it('transfers full pot to winner, resets pot to 0, and logs "Alice wins pot of 1200"', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const state = { ...hand, phase: 'showdown' as const, round: 'showdown' as const, pot: 1200 };
    const alice = state.players[0];

    const result = declareWinner(state, alice.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pot).toBe(0);
    expect(result.state.players[0].chipCount).toBe(alice.chipCount + 1200);
    expect(result.state.log.map((e) => e.message)).toContain('Alice wins pot of 1200');
  });

  it('marks players with chipCount === 0 after pot transfer as isEliminated', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const state = {
      ...hand,
      phase: 'showdown' as const,
      round: 'showdown' as const,
      pot: 500,
      players: hand.players.map((p) =>
        p.displayName === 'Bob' ? { ...p, chipCount: 0 } : p,
      ),
    };
    const alice = state.players.find((p) => p.displayName === 'Alice')!;

    const result = declareWinner(state, alice.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bob = result.state.players.find((p) => p.displayName === 'Bob')!;
    expect(bob.isEliminated).toBe(true);
    const aliceAfter = result.state.players.find((p) => p.displayName === 'Alice')!;
    expect(aliceAfter.isEliminated).toBe(false);
  });

  it('logs "Bob has been eliminated" when Bob reaches 0 chips after pot transfer', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const state = {
      ...hand,
      phase: 'showdown' as const,
      round: 'showdown' as const,
      pot: 500,
      players: hand.players.map((p) =>
        p.displayName === 'Bob' ? { ...p, chipCount: 0 } : p,
      ),
    };
    const alice = state.players.find((p) => p.displayName === 'Alice')!;

    const result = declareWinner(state, alice.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.log.map((e) => e.message)).toContain('Bob has been eliminated');
  });

  it('rejects when playerId does not exist', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const result = declareWinner({ ...hand, phase: 'showdown' as const, pot: 100 }, 'non-existent-id');
    expect(result.ok).toBe(false);
  });

  it('rejects when player is eliminated', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const state = {
      ...hand,
      phase: 'showdown' as const,
      round: 'showdown' as const,
      pot: 100,
      players: hand.players.map((p) =>
        p.displayName === 'Alice' ? { ...p, isEliminated: true } : p,
      ),
    };
    const alice = state.players.find((p) => p.displayName === 'Alice')!;
    const result = declareWinner(state, alice.id);
    expect(result.ok).toBe(false);
  });

  it('rejects when phase is not showdown', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const state = { ...hand, phase: 'active' as const, pot: 100 };
    const result = declareWinner(state, state.players[0].id);
    expect(result.ok).toBe(false);
  });

  it('returns phase active after pot transfer so host can start a new hand', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const state = { ...hand, phase: 'showdown' as const, round: 'showdown' as const, pot: 500 };
    const alice = state.players.find((p) => p.displayName === 'Alice')!;

    const result = declareWinner(state, alice.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('active');
    expect(result.state.pot).toBe(0);
  });
});

describe('pause', () => {
  it('transitions phase to paused and logs "Game paused by host"', () => {
    const state = makeActive(['Alice', 'Bob']);
    const result = pause(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('paused');
    expect(result.state.log.map((e) => e.message)).toContain('Game paused by host');
  });

  it('rejects when game is not active', () => {
    const state = { ...makeActive(['Alice', 'Bob']), phase: 'paused' as const };
    const result = pause(state);
    expect(result.ok).toBe(false);
  });
});

describe('resume', () => {
  it('transitions phase back to active and logs "Game resumed by host"', () => {
    const state = { ...makeActive(['Alice', 'Bob']), phase: 'paused' as const };
    const result = resume(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('active');
    expect(result.state.log.map((e) => e.message)).toContain('Game resumed by host');
  });

  it('rejects when game is not paused', () => {
    const state = makeActive(['Alice', 'Bob']);
    const result = resume(state);
    expect(result.ok).toBe(false);
  });
});

describe('rebuy', () => {
  it('adds chips to the player and logs "Alice re-buys for 500 chips"', () => {
    const state = makeActive(['Alice', 'Bob']);
    const alice = state.players[0];
    const result = rebuy(state, alice.id, 500);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].chipCount).toBe(alice.chipCount + 500);
    expect(result.state.log.map((e) => e.message)).toContain('Alice re-buys for 500 chips');
  });

  it('un-eliminates a player who was eliminated', () => {
    const state = makeActive(['Alice', 'Bob']);
    const eliminated = { ...state.players[0], chipCount: 0, isEliminated: true };
    const withElim = { ...state, players: [eliminated, state.players[1]] };
    const result = rebuy(withElim, eliminated.id, 200);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].isEliminated).toBe(false);
    expect(result.state.players[0].chipCount).toBe(200);
  });

  it('rejects a non-positive rebuy amount', () => {
    const state = makeActive(['Alice', 'Bob']);
    const result = rebuy(state, state.players[0].id, 0);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown player id', () => {
    const state = makeActive(['Alice', 'Bob']);
    const result = rebuy(state, 'no-such-id', 100);
    expect(result.ok).toBe(false);
  });

  it('rejects rebuy when a hand is in progress (pot > 0)', () => {
    const state = makeHand(['Alice', 'Bob']);
    const alice = state.players[0];
    const result = rebuy(state, alice.id, 500);
    expect(result.ok).toBe(false);
  });

  it('allows rebuy between hands when pot is 0', () => {
    const state = makeActive(['Alice', 'Bob']);
    const alice = state.players[0];
    const result = rebuy(state, alice.id, 500);
    expect(result.ok).toBe(true);
  });
});

describe('endGame', () => {
  it('transitions to phase ended and logs "Game over — Alice wins!" when Alice is the last player with chips', () => {
    const state = makeActive(['Alice', 'Bob']);
    const withBobEliminated = {
      ...state,
      players: state.players.map((p) =>
        p.displayName === 'Bob' ? { ...p, chipCount: 0, isEliminated: true } : p,
      ),
    };

    const result = endGame(withBobEliminated);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('ended');
    expect(result.state.log.map((e) => e.message)).toContain('Game over — Alice wins!');
  });

  it('rejects when there are still 2 or more non-eliminated players', () => {
    const state = makeActive(['Alice', 'Bob']);
    const result = endGame(state);
    expect(result.ok).toBe(false);
  });
});
