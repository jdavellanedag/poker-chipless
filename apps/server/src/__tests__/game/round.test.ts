import { describe, it, expect } from 'vitest';
import { createSession, joinSession } from '../../session.js';
import { startGame, newHand, declareWinner } from '../../game/host-actions.js';
import { fold, check, call } from '../../game/player-actions.js';
import { advanceRound } from '../../game/round.js';

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

describe('advanceRound', () => {
  it('preflop → flop: round transitions, per-round state resets, logs "--- Flop ---"', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const preflopDone = {
      ...hand,
      roundComplete: true,
      currentBet: 40,
      lastRaiseSize: 20,
      players: hand.players.map((p) => ({ ...p, currentBet: 40, hasActedThisRound: true })),
    };

    const result = advanceRound(preflopDone);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.state;
    expect(s.round).toBe('flop');
    expect(s.currentBet).toBe(0);
    expect(s.lastRaiseSize).toBe(hand.bigBlind);
    expect(s.roundComplete).toBe(false);
    expect(s.players.every((p) => p.currentBet === 0)).toBe(true);
    expect(s.players.every((p) => p.hasActedThisRound === false || p.isFolded || p.isEliminated)).toBe(true);
    expect(s.log.map((e) => e.message)).toContain('--- Flop ---');
  });

  it('advances through full sequence: flop → turn → river → showdown', () => {
    const base = { ...makeHand(['Alice', 'Bob']), roundComplete: true };
    const rounds = ['preflop', 'flop', 'turn', 'river'] as const;
    const expected = ['flop', 'turn', 'river', 'showdown'] as const;
    let state = base;
    for (let i = 0; i < rounds.length; i++) {
      state = { ...state, round: rounds[i] };
      const result = advanceRound(state);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.round).toBe(expected[i]);
      state = result.state;
    }
  });

  it('sets activePlayerIndex to first non-folded non-eliminated player clockwise of button', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol', 'Dave']);
    const state = {
      ...hand,
      dealerButtonIndex: 0,
      roundComplete: true,
      players: hand.players.map((p, i) => ({ ...p, isFolded: i === 1 })),
    };

    const result = advanceRound(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerIndex).toBe(2);
  });

  it('rejects when phase is not active', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const result = advanceRound({ ...hand, phase: 'ended' });
    expect(result.ok).toBe(false);
  });

  it('river → showdown: sets both phase and round to showdown', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const riverDone = { ...hand, round: 'river' as const, roundComplete: true, pot: 100 };

    const result = advanceRound(riverDone);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round).toBe('showdown');
    expect(result.state.phase).toBe('showdown');
  });

  it('rejects when round is already showdown', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const result = advanceRound({ ...hand, round: 'showdown' });
    expect(result.ok).toBe(false);
  });
});

describe('validActions during showdown', () => {
  it('all players have empty validActions after river → showdown via advanceRound', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const riverDone = {
      ...hand,
      round: 'river' as const,
      roundComplete: true,
      pot: 100,
      players: hand.players.map((p) => ({ ...p, hasActedThisRound: true, currentBet: 0 })),
    };

    const result = advanceRound(riverDone);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('showdown');
    result.state.players.forEach((p) => {
      expect(p.validActions).toHaveLength(0);
    });
  });

  it('all players have empty validActions after last player checks on the river and host advances to showdown', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const riverState = {
      ...hand,
      round: 'river' as const,
      currentBet: 0,
      pot: 150,
      players: hand.players.map((p, i) => ({
        ...p,
        currentBet: 0,
        hasActedThisRound: i !== 0,
      })),
      activePlayerIndex: 0,
      roundComplete: false,
    };
    const afterCheck = check(riverState, riverState.players[0].id);
    expect(afterCheck.ok).toBe(true);
    if (!afterCheck.ok) return;
    expect(afterCheck.state.roundComplete).toBe(true);

    const afterAdvance = advanceRound(afterCheck.state);
    expect(afterAdvance.ok).toBe(true);
    if (!afterAdvance.ok) return;
    expect(afterAdvance.state.phase).toBe('showdown');
    afterAdvance.state.players.forEach((p) => {
      expect(p.validActions).toHaveLength(0);
    });
  });

  it('all players have empty validActions after last player calls on the river and host advances to showdown', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const riverState = {
      ...hand,
      round: 'river' as const,
      currentBet: 100,
      pot: 200,
      players: hand.players.map((p, i) => ({
        ...p,
        currentBet: i === 0 ? 0 : 100,
        chipCount: i === 0 ? p.chipCount : p.chipCount - 100,
        hasActedThisRound: i !== 0,
      })),
      activePlayerIndex: 0,
      roundComplete: false,
    };
    const afterCall = call(riverState, riverState.players[0].id);
    expect(afterCall.ok).toBe(true);
    if (!afterCall.ok) return;
    expect(afterCall.state.roundComplete).toBe(true);

    const afterAdvance = advanceRound(afterCall.state);
    expect(afterAdvance.ok).toBe(true);
    if (!afterAdvance.ok) return;
    expect(afterAdvance.state.phase).toBe('showdown');
    afterAdvance.state.players.forEach((p) => {
      expect(p.validActions).toHaveLength(0);
    });
  });

  it('all players have empty validActions in fold-win showdown', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const afterAliceFold = fold(hand, hand.players[0].id);
    expect(afterAliceFold.ok).toBe(true);
    if (!afterAliceFold.ok) return;
    const afterBobFold = fold(afterAliceFold.state, afterAliceFold.state.players[1].id);
    expect(afterBobFold.ok).toBe(true);
    if (!afterBobFold.ok) return;
    expect(afterBobFold.state.phase).toBe('showdown');
    afterBobFold.state.players.forEach((p) => {
      expect(p.validActions).toHaveLength(0);
    });
  });

  it('all players have empty validActions after declareWinner via normal showdown path', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const riverDone = {
      ...hand,
      round: 'river' as const,
      roundComplete: true,
      pot: 100,
      players: hand.players.map((p) => ({ ...p, hasActedThisRound: true, currentBet: 0 })),
    };
    const afterShowdown = advanceRound(riverDone);
    expect(afterShowdown.ok).toBe(true);
    if (!afterShowdown.ok) return;
    expect(afterShowdown.state.phase).toBe('showdown');
    expect(afterShowdown.state.roundComplete).toBe(false);

    const alice = afterShowdown.state.players.find((p) => p.displayName === 'Alice')!;
    const afterWinner = declareWinner(afterShowdown.state, alice.id);
    expect(afterWinner.ok).toBe(true);
    if (!afterWinner.ok) return;
    expect(afterWinner.state.phase).toBe('active');
    afterWinner.state.players.forEach((p) => {
      expect(p.validActions).toHaveLength(0);
    });
  });

  it('all players have empty validActions after declareWinner via fold-win showdown', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const afterFold = fold(hand, hand.players[0].id);
    expect(afterFold.ok).toBe(true);
    if (!afterFold.ok) return;
    expect(afterFold.state.phase).toBe('showdown');

    const bob = afterFold.state.players.find((p) => p.displayName === 'Bob')!;
    const afterWinner = declareWinner(afterFold.state, bob.id);
    expect(afterWinner.ok).toBe(true);
    if (!afterWinner.ok) return;
    expect(afterWinner.state.phase).toBe('active');
    afterWinner.state.players.forEach((p) => {
      expect(p.validActions).toHaveLength(0);
    });
  });
});
