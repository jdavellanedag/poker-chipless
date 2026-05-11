import { describe, it, expect } from 'vitest';
import { createSession, joinSession } from '../session.js';
import { startGame, reorderPlayers, newHand } from '../game.js';

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

describe('newHand', () => {
  it('in heads-up: button is SB and BB acts first pre-flop', () => {
    const state = makeActive(['Alice', 'Bob']);
    const result = newHand(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.state;
    // Button (Alice, index 0) = SB
    expect(s.dealerButtonIndex).toBe(0);
    expect(s.players[0].currentBet).toBe(10); // Alice posted SB
    expect(s.players[1].currentBet).toBe(20); // Bob posted BB
    // BB (Bob, index 1) acts first pre-flop in heads-up
    expect(s.activePlayerIndex).toBe(1);
  });

  it('advances the button clockwise on each subsequent hand', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);
    const hand1 = newHand(state);
    expect(hand1.ok).toBe(true);
    if (!hand1.ok) return;
    expect(hand1.state.dealerButtonIndex).toBe(0); // Alice

    const hand2 = newHand(hand1.state);
    expect(hand2.ok).toBe(true);
    if (!hand2.ok) return;
    expect(hand2.state.dealerButtonIndex).toBe(1); // Bob

    const hand3 = newHand(hand2.state);
    expect(hand3.ok).toBe(true);
    if (!hand3.ok) return;
    expect(hand3.state.dealerButtonIndex).toBe(2); // Carol

    const hand4 = newHand(hand3.state);
    expect(hand4.ok).toBe(true);
    if (!hand4.ok) return;
    expect(hand4.state.dealerButtonIndex).toBe(0); // wraps back to Alice
  });

  it('skips eliminated players when advancing the button', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);
    const hand1 = newHand(state);
    expect(hand1.ok).toBe(true);
    if (!hand1.ok) return;
    // Eliminate Bob (index 1)
    const withBobEliminated = {
      ...hand1.state,
      players: hand1.state.players.map((p) =>
        p.displayName === 'Bob' ? { ...p, isEliminated: true } : p,
      ),
    };
    const hand2 = newHand(withBobEliminated);
    expect(hand2.ok).toBe(true);
    if (!hand2.ok) return;
    expect(hand2.state.dealerButtonIndex).toBe(2); // skips Bob, lands on Carol
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
    expect(result.state.pot).toBe(25); // 5 (all-in SB) + 20 (BB)
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
    expect(result.state.pot).toBe(18); // 10 (SB) + 8 (all-in BB)
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
    expect(s.dealerButtonIndex).toBe(0);          // Alice = button
    expect(s.players[1].chipCount).toBe(990);      // Bob posted SB 10
    expect(s.players[2].chipCount).toBe(980);      // Carol posted BB 20
    expect(s.pot).toBe(30);                        // 10 + 20
    expect(s.currentBet).toBe(20);                 // = bigBlind
    expect(s.activePlayerIndex).toBe(0);           // UTG = Alice (wraps after BB at index 2)
  });
});
