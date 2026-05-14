import { describe, it, expect } from 'vitest';
import { createSession } from '../../session/create.js';
import { joinSession } from '../../session/join.js';
import { appendLog, withValidActions } from '../../game/state.js';
import { fold, autoFold, check, call, bet, raise, allin } from '../../game/player-actions.js';
import { startGame, newHand } from '../../game/host-actions.js';

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

function makeFlopState(playerNames: string[], startingStack = 1000, smallBlind = 10, bigBlind = 20) {
  const hand = makeHand(playerNames, startingStack, smallBlind, bigBlind);
  return withValidActions({
    ...hand,
    round: 'flop' as const,
    currentBet: 0,
    lastRaiseSize: bigBlind,
    pot: 0,
    roundComplete: false,
    activePlayerIndex: 0,
    players: hand.players.map((p) => ({ ...p, currentBet: 0, hasActedThisRound: false })),
  });
}

describe('appendLog', () => {
  it('appends an entry with the given message and an ISO timestamp to state.log', () => {
    const { state } = createSession('Alice');
    const before = state.log.length;

    const next = appendLog(state, 'hello world');

    expect(next.log).toHaveLength(before + 1);
    const entry = next.log[next.log.length - 1];
    expect(entry.message).toBe('hello world');
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('does not mutate the original state', () => {
    const { state } = createSession('Alice');
    const original = state.log.length;
    appendLog(state, 'side effect?');
    expect(state.log).toHaveLength(original);
  });
});

describe('validActions', () => {
  it('active player with no open bet can bet, check, and fold', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']); // currentBet=0, Alice active
    const alice = state.players[0];
    expect(alice.validActions).toContain('bet');
    expect(alice.validActions).toContain('check');
    expect(alice.validActions).toContain('fold');
    expect(alice.validActions).not.toContain('call');
    expect(alice.validActions).not.toContain('raise');
  });

  it('active player with open bet can call, raise, fold, and allin — but not check', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']); // preflop: currentBet=20, Alice active
    const alice = hand.players[0];
    expect(alice.validActions).toContain('call');
    expect(alice.validActions).toContain('raise');
    expect(alice.validActions).toContain('fold');
    expect(alice.validActions).toContain('allin');
    expect(alice.validActions).not.toContain('check');
    expect(alice.validActions).not.toContain('bet');
  });

  it('active player whose stack cannot cover the call gets allin and fold only', () => {
    const active = makeActive(['Alice', 'Bob', 'Carol'], 1000, 10, 20);
    const aliceWith5 = { ...active.players[0], chipCount: 5 };
    const stateWith5 = { ...active, players: [aliceWith5, active.players[1], active.players[2]] };
    const result = newHand(stateWith5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const aliceInHand = result.state.players[0];
    expect(aliceInHand.validActions).toContain('allin');
    expect(aliceInHand.validActions).toContain('fold');
    expect(aliceInHand.validActions).not.toContain('call');
    expect(aliceInHand.validActions).not.toContain('raise');
  });

  it('non-active players have empty validActions', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']); // Alice is active
    expect(hand.players[1].validActions).toHaveLength(0); // Bob
    expect(hand.players[2].validActions).toHaveLength(0); // Carol
  });
});

describe('turn advancement', () => {
  it('skips folded players when advancing after fold', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol', 'Dave']);
    expect(hand.activePlayerIndex).toBe(3); // Dave is UTG
    const withAliceFolded = {
      ...hand,
      players: hand.players.map((p) => p.displayName === 'Alice' ? { ...p, isFolded: true } : p),
    };
    const result = fold(withAliceFolded, withAliceFolded.players[3].id); // Dave folds
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerIndex).toBe(1); // skips Alice(0), lands on Bob(1)
  });

  it('skips eliminated players when advancing after fold', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol', 'Dave']);
    const withAliceEliminated = {
      ...hand,
      players: hand.players.map((p) => p.displayName === 'Alice' ? { ...p, isEliminated: true } : p),
    };
    const result = fold(withAliceEliminated, withAliceEliminated.players[3].id); // Dave folds
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerIndex).toBe(1); // skips Alice(0), lands on Bob(1)
  });
});

describe('round complete', () => {
  it('sets roundComplete and logs when all active players have matched currentBet', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const flopState = {
      ...hand,
      round: 'flop' as const,
      currentBet: 0,
      roundComplete: false,
      activePlayerIndex: 0,
      players: hand.players.map((p) => ({ ...p, currentBet: 0 })),
    };
    const afterAlice = check(flopState, flopState.players[0].id);
    expect(afterAlice.ok).toBe(true);
    if (!afterAlice.ok) return;
    expect(afterAlice.state.roundComplete).toBe(false);

    const afterBob = check(afterAlice.state, afterAlice.state.players[1].id);
    expect(afterBob.ok).toBe(true);
    if (!afterBob.ok) return;
    expect(afterBob.state.roundComplete).toBe(true);
    expect(afterBob.state.log.map((e) => e.message)).toContain(
      'Betting round complete. Host may advance.',
    );
  });
});

describe('fold-win roundComplete', () => {
  it('sets roundComplete when SB folds last in a 3-player hand', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);

    const afterAlice = fold(hand, hand.players[0].id);
    expect(afterAlice.ok).toBe(true);
    if (!afterAlice.ok) return;

    const bobIndex = afterAlice.state.activePlayerIndex;
    const afterBob = fold(afterAlice.state, afterAlice.state.players[bobIndex].id);
    expect(afterBob.ok).toBe(true);
    if (!afterBob.ok) return;

    expect(afterBob.state.roundComplete).toBe(true);
    expect(afterBob.state.activePlayerIndex).not.toBe(bobIndex);
  });

  it('sets roundComplete when BB folds last after a caller folds others out', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol', 'Dave']);
    expect(hand.activePlayerIndex).toBe(3);

    const afterDave = call(hand, hand.players[3].id);
    expect(afterDave.ok).toBe(true);
    if (!afterDave.ok) return;

    const afterAlice = fold(afterDave.state, afterDave.state.players[afterDave.state.activePlayerIndex].id);
    expect(afterAlice.ok).toBe(true);
    if (!afterAlice.ok) return;

    const afterBob = fold(afterAlice.state, afterAlice.state.players[afterAlice.state.activePlayerIndex].id);
    expect(afterBob.ok).toBe(true);
    if (!afterBob.ok) return;

    const carolIndex = afterBob.state.activePlayerIndex;
    const afterCarol = fold(afterBob.state, afterBob.state.players[carolIndex].id);
    expect(afterCarol.ok).toBe(true);
    if (!afterCarol.ok) return;

    expect(afterCarol.state.roundComplete).toBe(true);
    expect(afterCarol.state.activePlayerIndex).not.toBe(carolIndex);
  });
});

describe('last player standing', () => {
  it('fold() sets phase showdown, round showdown, pot intact, and logs win message when last player stands', () => {
    const hand = makeHand(['Alice', 'Bob']);
    const potBeforeFold = hand.pot;

    const result = fold(hand, hand.players[0].id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('showdown');
    expect(result.state.round).toBe('showdown');
    expect(result.state.pot).toBe(potBeforeFold);
    expect(result.state.log.map((e) => e.message)).toContain(
      `Bob wins ${potBeforeFold} (everyone else folded)`,
    );
  });

  it('enters showdown phase with pot intact in heads-up when active player folds', () => {
    const hand = makeHand(['Alice', 'Bob']);
    expect(hand.activePlayerIndex).toBe(0);
    const potBeforeFold = hand.pot;

    const result = fold(hand, hand.players[0].id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('showdown');
    expect(result.state.round).toBe('showdown');
    expect(result.state.pot).toBe(potBeforeFold);
    const bob = result.state.players.find((p) => p.displayName === 'Bob')!;
    expect(bob.chipCount).toBe(hand.players.find((p) => p.displayName === 'Bob')!.chipCount);
    expect(result.state.log.map((e) => e.message)).toContain(
      `Bob wins ${potBeforeFold} (everyone else folded)`,
    );
  });

  it('enters showdown phase with pot intact in a 3-player hand when two fold', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    expect(hand.activePlayerIndex).toBe(0);
    const potBeforeFolds = hand.pot;

    const afterAliceFold = fold(hand, hand.players[0].id);
    expect(afterAliceFold.ok).toBe(true);
    if (!afterAliceFold.ok) return;
    expect(afterAliceFold.state.phase).toBe('active');

    const afterBobFold = fold(afterAliceFold.state, afterAliceFold.state.players[afterAliceFold.state.activePlayerIndex].id);
    expect(afterBobFold.ok).toBe(true);
    if (!afterBobFold.ok) return;

    const carol = afterBobFold.state.players.find((p) => p.displayName === 'Carol')!;
    expect(afterBobFold.state.phase).toBe('showdown');
    expect(afterBobFold.state.round).toBe('showdown');
    expect(afterBobFold.state.pot).toBe(potBeforeFolds);
    expect(carol.chipCount).toBe(hand.players.find((p) => p.displayName === 'Carol')!.chipCount);
    expect(afterBobFold.state.log.map((e) => e.message)).toContain(
      `Carol wins ${potBeforeFolds} (everyone else folded)`,
    );
  });
});

describe('fold', () => {
  it('rejects action from non-active player', () => {
    const state = makeHand(['Alice', 'Bob', 'Carol']);
    const result = fold(state, state.players[1].id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('marks active player as folded, advances turn, and logs "Alice folds"', () => {
    const state = makeHand(['Alice', 'Bob', 'Carol']);

    const result = fold(state, state.players[0].id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].isFolded).toBe(true);
    expect(result.state.activePlayerIndex).toBe(1);
    expect(result.state.log.map((e) => e.message)).toContain('Alice folds');
  });
});

describe('check', () => {
  it('rejects action from non-active player', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const flopState = { ...hand, round: 'flop' as const, currentBet: 0, activePlayerIndex: 1,
      players: hand.players.map((p) => ({ ...p, currentBet: 0 })) };
    const result = check(flopState, flopState.players[2].id);
    expect(result.ok).toBe(false);
  });

  it('rejects check when a bet is open', () => {
    const state = makeHand(['Alice', 'Bob', 'Carol']);
    const result = check(state, state.players[0].id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('advances turn and logs "Bob checks" when no open bet', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const flopState = {
      ...hand,
      round: 'flop' as const,
      currentBet: 0,
      activePlayerIndex: 1,
      players: hand.players.map((p) => ({ ...p, currentBet: 0 })),
    };

    const result = check(flopState, flopState.players[1].id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerIndex).toBe(2);
    expect(result.state.log.map((e) => e.message)).toContain('Bob checks');
  });
});

describe('call', () => {
  it('rejects action from non-active player', () => {
    const state = makeHand(['Alice', 'Bob', 'Carol']);
    const result = call(state, state.players[2].id);
    expect(result.ok).toBe(false);
  });

  it('deducts call amount from chips, adds to pot, advances turn, and logs "Alice calls 20"', () => {
    const state = makeHand(['Alice', 'Bob', 'Carol']);

    const result = call(state, state.players[0].id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].chipCount).toBe(980);
    expect(result.state.players[0].currentBet).toBe(20);
    expect(result.state.pot).toBe(50);
    expect(result.state.activePlayerIndex).toBe(1);
    expect(result.state.log.map((e) => e.message)).toContain('Alice calls 20');
  });

  it('converts to all-in when stack is less than the call amount', () => {
    const state = makeHand(['Alice', 'Bob'], 1000, 10, 20);
    const aliceShort = { ...state.players[0], chipCount: 5 };
    const shortState = { ...state, players: [aliceShort, state.players[1]] };

    const result = call(shortState, aliceShort.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const alice = result.state.players[0];
    expect(alice.chipCount).toBe(0);
    expect(alice.isAllIn).toBe(true);
    expect(alice.currentBet).toBe(15);
    expect(result.state.pot).toBe(35);
  });
});

describe('raise', () => {
  it('increases currentBet, deducts chips, adds to pot, and logs "Alice raises to 800"', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = raise(hand, hand.players[0].id, 800);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.currentBet).toBe(800);
    expect(result.state.players[0].chipCount).toBe(200);
    expect(result.state.players[0].currentBet).toBe(800);
    expect(result.state.pot).toBe(30 + 800);
    expect(result.state.log.map((e) => e.message)).toContain('Alice raises to 800');
  });

  it('rejects action from non-active player', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = raise(hand, hand.players[1].id, 100);
    expect(result.ok).toBe(false);
  });

  it('rejects raise when there is no open bet', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']);
    const result = raise(state, state.players[0].id, 100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('rejects raise below minimum (currentBet + lastRaiseSize)', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = raise(hand, hand.players[0].id, 39);
    expect(result.ok).toBe(false);
  });

  it('accepts raise exactly at minimum', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = raise(hand, hand.players[0].id, 40);
    expect(result.ok).toBe(true);
  });

  it('updates lastRaiseSize to the raise increment', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = raise(hand, hand.players[0].id, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRaiseSize).toBe(80);
  });

  it('re-opens betting for players who already acted when a raise occurs', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const afterAlice = call(hand, hand.players[0].id);
    expect(afterAlice.ok).toBe(true);
    if (!afterAlice.ok) return;
    const afterBob = call(afterAlice.state, afterAlice.state.players[afterAlice.state.activePlayerIndex].id);
    expect(afterBob.ok).toBe(true);
    if (!afterBob.ok) return;
    const carolIdx = afterBob.state.activePlayerIndex;
    const afterCarol = raise(afterBob.state, afterBob.state.players[carolIdx].id, 60);
    expect(afterCarol.ok).toBe(true);
    if (!afterCarol.ok) return;
    expect(afterCarol.state.players[0].hasActedThisRound).toBe(false);
    expect(afterCarol.state.players[1].hasActedThisRound).toBe(false);
    expect(afterCarol.state.players[2].hasActedThisRound).toBe(true);
  });
});

describe('allin', () => {
  it('sets chipCount to 0, isAllIn to true, adds all chips to pot, and logs "Alice goes all-in for 350"', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']);
    const shortAlice = { ...state.players[0], chipCount: 350 };
    const shortState = { ...state, players: [shortAlice, state.players[1], state.players[2]] };

    const result = allin(shortState, shortAlice.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].chipCount).toBe(0);
    expect(result.state.players[0].isAllIn).toBe(true);
    expect(result.state.players[0].currentBet).toBe(350);
    expect(result.state.pot).toBe(350);
    expect(result.state.log.map((e) => e.message)).toContain('Alice goes all-in for 350');
  });

  it('rejects action from non-active player', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']);
    const result = allin(state, state.players[1].id);
    expect(result.ok).toBe(false);
  });

  it('always valid regardless of currentBet (no open bet)', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']);
    const result = allin(state, state.players[0].id);
    expect(result.ok).toBe(true);
  });

  it('always valid regardless of currentBet (open bet exists)', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = allin(hand, hand.players[0].id);
    expect(result.ok).toBe(true);
  });

  it('updates currentBet when all-in amount exceeds currentBet', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = allin(hand, hand.players[0].id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.currentBet).toBe(1000);
  });
});

describe('bet', () => {
  it('sets currentBet, deducts chips, adds to pot, and logs "Alice bets 400"', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']);
    const result = bet(state, state.players[0].id, 400);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.currentBet).toBe(400);
    expect(result.state.players[0].chipCount).toBe(600);
    expect(result.state.players[0].currentBet).toBe(400);
    expect(result.state.pot).toBe(400);
    expect(result.state.log.map((e) => e.message)).toContain('Alice bets 400');
  });

  it('rejects action from non-active player', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']);
    const result = bet(state, state.players[1].id, 100);
    expect(result.ok).toBe(false);
  });

  it('rejects bet when there is already an open bet', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = bet(hand, hand.players[0].id, 100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('rejects bet below the big blind minimum', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']);
    const result = bet(state, state.players[0].id, 10);
    expect(result.ok).toBe(false);
  });

  it('sets lastRaiseSize to the bet amount', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']);
    const result = bet(state, state.players[0].id, 200);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRaiseSize).toBe(200);
  });

  it('advances the turn to the next active player after bet', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']);
    const result = bet(state, state.players[0].id, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerIndex).toBe(1);
  });
});

describe('autoFold', () => {
  it('folds the active player, logs "<name> auto-folded (disconnected)", and advances turn', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);
    const activePlayer = state.players[state.activePlayerIndex];

    const result = autoFold(state, activePlayer.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.find((p) => p.id === activePlayer.id)!.isFolded).toBe(true);
    expect(result.state.log.map((e) => e.message)).toContain(
      `${activePlayer.displayName} auto-folded (disconnected)`,
    );
    expect(result.state.activePlayerIndex).not.toBe(state.activePlayerIndex);
  });

  it('rejects when it is not the given player\'s turn', () => {
    const state = makeActive(['Alice', 'Bob', 'Carol']);
    const nonActive = state.players.find((p) => p.id !== state.players[state.activePlayerIndex].id)!;
    const result = autoFold(state, nonActive.id);
    expect(result.ok).toBe(false);
  });

  it('rejects when the game is not active', () => {
    const state = { ...makeActive(['Alice', 'Bob']), phase: 'paused' as const };
    const result = autoFold(state, state.players[state.activePlayerIndex].id);
    expect(result.ok).toBe(false);
  });
});
