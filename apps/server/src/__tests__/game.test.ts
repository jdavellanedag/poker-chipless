import { describe, it, expect } from 'vitest';
import { createSession, joinSession } from '../session.js';
import { appendLog, startGame, reorderPlayers, newHand, fold, check, call, bet, raise, allin, withValidActions, advanceRound, declareWinner, pause, resume, rebuy, autoFold, endGame } from '../game.js';

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
    // Button (Alice, index 0) = SB
    expect(s.dealerButtonIndex).toBe(0);
    expect(s.players[0].currentBet).toBe(10); // Alice posted SB
    expect(s.players[1].currentBet).toBe(20); // Bob posted BB
    // Button/SB (Alice, index 0) acts first pre-flop in heads-up
    expect(s.activePlayerIndex).toBe(0);
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

// helpers for action tests
function makeHand(playerNames: string[], startingStack = 1000, smallBlind = 10, bigBlind = 20) {
  const active = makeActive(playerNames, startingStack, smallBlind, bigBlind);
  const result = newHand(active);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe('turn advancement', () => {
  it('skips folded players when advancing after fold', () => {
    // 4-player: Alice(0)=button, Bob(1)=SB, Carol(2)=BB, Dave(3)=UTG=active.
    // Pre-fold Alice so when Dave folds the turn goes to Bob(1), not Alice(0).
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
    // Post-flop: currentBet=0, all players have currentBet=0 — first check completes the round
    const hand = makeHand(['Alice', 'Bob']);
    const flopState = {
      ...hand,
      round: 'flop' as const,
      currentBet: 0,
      roundComplete: false,
      activePlayerIndex: 0,
      players: hand.players.map((p) => ({ ...p, currentBet: 0 })),
    };
    // Alice checks — Bob still needs to act, round not complete yet
    const afterAlice = check(flopState, flopState.players[0].id);
    expect(afterAlice.ok).toBe(true);
    if (!afterAlice.ok) return;
    expect(afterAlice.state.roundComplete).toBe(false);

    // Bob checks — both have currentBet=0 === currentBet=0, round complete
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
    // Alice(0)=button/UTG, Bob(1)=SB, Carol(2)=BB
    // Alice folds → Bob folds → Carol wins; Bob's screen must not show action buttons
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
    // Alice(0)=button, Bob(1)=SB, Carol(2)=BB, Dave(3)=UTG
    // Dave calls, Alice folds, Bob folds, Carol folds → Dave wins; Carol's screen must not show action buttons
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
    // Heads-up: Alice(0)=button/SB acts first. Alice folds → Bob is last standing.
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
    // Heads-up: Alice(0)=button/SB acts first. Alice folds → phase: showdown, pot stays.
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
    // Alice(0)=button/UTG, Bob(1)=SB, Carol(2)=BB. Alice folds first, then Bob folds → Carol is last.
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
    const state = makeHand(['Alice', 'Bob', 'Carol']); // Alice is active (UTG)
    const result = fold(state, state.players[1].id);   // Bob tries to act
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('marks active player as folded, advances turn, and logs "Alice folds"', () => {
    // 3-player: Alice=button/UTG(idx0), Bob=SB(idx1), Carol=BB(idx2). Active = Alice.
    const state = makeHand(['Alice', 'Bob', 'Carol']);

    const result = fold(state, state.players[0].id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].isFolded).toBe(true);
    expect(result.state.activePlayerIndex).toBe(1); // Bob is next
    expect(result.state.log.map((e) => e.message)).toContain('Alice folds');
  });
});

describe('check', () => {
  it('rejects action from non-active player', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const flopState = { ...hand, round: 'flop' as const, currentBet: 0, activePlayerIndex: 1,
      players: hand.players.map((p) => ({ ...p, currentBet: 0 })) };
    const result = check(flopState, flopState.players[2].id); // Carol tries, Bob is active
    expect(result.ok).toBe(false);
  });

  it('rejects check when a bet is open', () => {
    const state = makeHand(['Alice', 'Bob', 'Carol']); // currentBet=20, Alice.currentBet=0
    const result = check(state, state.players[0].id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('advances turn and logs "Bob checks" when no open bet', () => {
    // Simulate post-flop: currentBet=0, all players' currentBet=0, Bob acts first.
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
    expect(result.state.activePlayerIndex).toBe(2); // Carol is next
    expect(result.state.log.map((e) => e.message)).toContain('Bob checks');
  });
});

describe('call', () => {
  it('rejects action from non-active player', () => {
    const state = makeHand(['Alice', 'Bob', 'Carol']); // Alice is active
    const result = call(state, state.players[2].id);   // Carol tries
    expect(result.ok).toBe(false);
  });

  it('deducts call amount from chips, adds to pot, advances turn, and logs "Alice calls 20"', () => {
    // 3-player: Alice=UTG(idx0), currentBet=20, Alice.currentBet=0 → call amount = 20.
    const state = makeHand(['Alice', 'Bob', 'Carol']);

    const result = call(state, state.players[0].id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].chipCount).toBe(980); // 1000 - 20
    expect(result.state.players[0].currentBet).toBe(20);
    expect(result.state.pot).toBe(50);                   // 30 + 20
    expect(result.state.activePlayerIndex).toBe(1);      // Bob is next
    expect(result.state.log.map((e) => e.message)).toContain('Alice calls 20');
  });

  it('converts to all-in when stack is less than the call amount', () => {
    // Heads-up: Alice(SB/button)=15 chips, Bob(BB)=1000 chips, bigBlind=20.
    // Alice.currentBet=10 (posted SB), callAmount=10, but stack only has 5 left → actualAmount=5.
    const state = makeHand(['Alice', 'Bob'], 1000, 10, 20);
    // Override Alice's chipCount after blind posting: she posted 10, has 990 left normally.
    // Instead give her a total stack of 15 so after posting SB(10) she has 5 left.
    const aliceShort = { ...state.players[0], chipCount: 5 }; // 5 left after SB posted
    const shortState = { ...state, players: [aliceShort, state.players[1]] };

    const result = call(shortState, aliceShort.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const alice = result.state.players[0];
    expect(alice.chipCount).toBe(0);
    expect(alice.isAllIn).toBe(true);
    expect(alice.currentBet).toBe(15); // 10 (SB posted) + 5 (all she had left)
    expect(result.state.pot).toBe(35); // 30 (blinds) + 5 (Alice's remaining stack)
  });
});

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

describe('raise', () => {
  it('increases currentBet, deducts chips, adds to pot, and logs "Alice raises to 800"', () => {
    // Preflop: currentBet=20 (BB). Alice(UTG, idx0) raises to 800.
    // Alice.currentBet=0, so she puts in 800 total. Net deduction = 800.
    const hand = makeHand(['Alice', 'Bob', 'Carol']); // Alice(UTG), currentBet=20
    const result = raise(hand, hand.players[0].id, 800);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.currentBet).toBe(800);
    expect(result.state.players[0].chipCount).toBe(200);   // 1000 - 800
    expect(result.state.players[0].currentBet).toBe(800);
    expect(result.state.pot).toBe(30 + 800);               // blinds + raise
    expect(result.state.log.map((e) => e.message)).toContain('Alice raises to 800');
  });

  it('rejects action from non-active player', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']); // Alice is active
    const result = raise(hand, hand.players[1].id, 100);   // Bob tries
    expect(result.ok).toBe(false);
  });

  it('rejects raise when there is no open bet', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']); // currentBet=0
    const result = raise(state, state.players[0].id, 100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('rejects raise below minimum (currentBet + lastRaiseSize)', () => {
    // currentBet=20, lastRaiseSize=20 (bigBlind) → minimum raise = 40
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = raise(hand, hand.players[0].id, 39); // below minimum of 40
    expect(result.ok).toBe(false);
  });

  it('accepts raise exactly at minimum', () => {
    // currentBet=20, lastRaiseSize=20 → minimum = 40
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = raise(hand, hand.players[0].id, 40);
    expect(result.ok).toBe(true);
  });

  it('updates lastRaiseSize to the raise increment', () => {
    // Raise to 100 when currentBet=20 → increment = 80
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = raise(hand, hand.players[0].id, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRaiseSize).toBe(80); // 100 - 20
  });

  it('re-opens betting for players who already acted when a raise occurs', () => {
    // 3-player: Alice(idx0)=UTG calls, Bob(idx1)=SB calls, then Carol(idx2)=BB raises.
    // After Carol raises, Alice and Bob who already called must act again.
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    // Alice calls
    const afterAlice = call(hand, hand.players[0].id);
    expect(afterAlice.ok).toBe(true);
    if (!afterAlice.ok) return;
    // Bob (SB) calls
    const afterBob = call(afterAlice.state, afterAlice.state.players[afterAlice.state.activePlayerIndex].id);
    expect(afterBob.ok).toBe(true);
    if (!afterBob.ok) return;
    // Carol (BB) raises to 60
    const carolIdx = afterBob.state.activePlayerIndex;
    const afterCarol = raise(afterBob.state, afterBob.state.players[carolIdx].id, 60);
    expect(afterCarol.ok).toBe(true);
    if (!afterCarol.ok) return;
    // Alice and Bob must have hasActedThisRound reset to false
    expect(afterCarol.state.players[0].hasActedThisRound).toBe(false); // Alice
    expect(afterCarol.state.players[1].hasActedThisRound).toBe(false); // Bob
    expect(afterCarol.state.players[2].hasActedThisRound).toBe(true);  // Carol (the raiser)
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
    // Alice has 5 chips left, currentBet=20, Alice.currentBet=0 → call amount=20 > 5
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const aliceShort = { ...hand.players[0], chipCount: 5 };
    const shortState = { ...hand, players: [aliceShort, hand.players[1], hand.players[2]] };
    // Re-derive validActions by calling computeValidActions or re-running through a state broadcast
    // Since validActions is computed during action execution, we can test it via newHand with short stack
    // OR we can expose a computeValidActions helper. For now test through state.players after newHand.
    const active = makeActive(['Alice', 'Bob', 'Carol'], 1000, 10, 20);
    // Give Alice only 5 chips
    const aliceWith5 = { ...active.players[0], chipCount: 5 };
    const stateWith5 = { ...active, players: [aliceWith5, active.players[1], active.players[2]] };
    const result = newHand(stateWith5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Alice is UTG (idx0) in 3-player, she has 5 chips but currentBet=20 so call amount=20 > 5
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

describe('allin', () => {
  it('sets chipCount to 0, isAllIn to true, adds all chips to pot, and logs "Alice goes all-in for 350"', () => {
    // Post-flop: Alice has 350 chips, no open bet.
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
    const state = makeFlopState(['Alice', 'Bob', 'Carol']); // Alice is active
    const result = allin(state, state.players[1].id);       // Bob tries
    expect(result.ok).toBe(false);
  });

  it('always valid regardless of currentBet (no open bet)', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']); // currentBet=0
    const result = allin(state, state.players[0].id);
    expect(result.ok).toBe(true);
  });

  it('always valid regardless of currentBet (open bet exists)', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']); // preflop currentBet=20
    const result = allin(hand, hand.players[0].id);
    expect(result.ok).toBe(true);
  });

  it('updates currentBet when all-in amount exceeds currentBet', () => {
    // Alice goes all-in for 1000 when currentBet=20 → currentBet becomes 1000
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    const result = allin(hand, hand.players[0].id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.currentBet).toBe(1000); // Alice had 1000 chips
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
    const state = makeFlopState(['Alice', 'Bob', 'Carol']); // Alice is active (idx 0)
    const result = bet(state, state.players[1].id, 100);    // Bob tries
    expect(result.ok).toBe(false);
  });

  it('rejects bet when there is already an open bet', () => {
    const hand = makeHand(['Alice', 'Bob', 'Carol']); // preflop: currentBet=20
    const result = bet(hand, hand.players[0].id, 100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('rejects bet below the big blind minimum', () => {
    const state = makeFlopState(['Alice', 'Bob', 'Carol']); // bigBlind=20
    const result = bet(state, state.players[0].id, 10);     // less than 20
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
    const state = makeFlopState(['Alice', 'Bob', 'Carol']); // Alice active (idx 0)
    const result = bet(state, state.players[0].id, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerIndex).toBe(1); // Bob is next
  });
});

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
    // 4-player: button=0 (Alice), Bob(1)=folded. First active clockwise = Carol(2).
    const hand = makeHand(['Alice', 'Bob', 'Carol', 'Dave']);
    const state = {
      ...hand,
      dealerButtonIndex: 0,
      roundComplete: true,
      players: hand.players.map((p, i) => ({ ...p, isFolded: i === 1 })), // Bob folded
    };

    const result = advanceRound(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerIndex).toBe(2); // Carol, skipping Bob
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
    // Bob has 0 chips (went all-in and lost). After pot goes to Alice, Bob is eliminated.
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

describe('validActions during showdown', () => {
  it('all players have empty validActions after river → showdown via advanceRound', () => {
    // River is complete; host advances to showdown. No player should have any valid actions.
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
    // Simulate the exact user-reported scenario: last player checks → roundComplete →
    // host advances to showdown → no player should see action buttons.
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    // Put everyone in a river state where Bob and Carol already acted; Alice checks last.
    const riverState = {
      ...hand,
      round: 'river' as const,
      currentBet: 0,
      pot: 150,
      players: hand.players.map((p, i) => ({
        ...p,
        currentBet: 0,
        hasActedThisRound: i !== 0, // Bob and Carol already acted; Alice(0) is active
      })),
      activePlayerIndex: 0,
      roundComplete: false,
    };
    const afterCheck = check(riverState, riverState.players[0].id); // Alice checks
    expect(afterCheck.ok).toBe(true);
    if (!afterCheck.ok) return;
    expect(afterCheck.state.roundComplete).toBe(true); // round should be complete

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
    // Bob bet 100; Alice and Carol already matched; Alice is last and calls.
    const riverState = {
      ...hand,
      round: 'river' as const,
      currentBet: 100,
      pot: 200,
      players: hand.players.map((p, i) => ({
        ...p,
        currentBet: i === 0 ? 0 : 100, // Alice(0) hasn't matched yet
        chipCount: i === 0 ? p.chipCount : p.chipCount - 100,
        hasActedThisRound: i !== 0,
      })),
      activePlayerIndex: 0,
      roundComplete: false,
    };
    const afterCall = call(riverState, riverState.players[0].id); // Alice calls
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
    // When all but one player fold, the game enters showdown immediately.
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    // Alice and Bob fold; Carol wins by default → showdown
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
    // Bug: after advanceRound → showdown (roundComplete=false) and then declareWinner
    // transitions phase back to 'active', the active player was incorrectly assigned valid
    // actions because roundComplete was still false and phase was no longer 'showdown'.
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
    expect(afterShowdown.state.roundComplete).toBe(false); // not set during showdown phase

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
    // Fold-win path already set roundComplete=true before showdown; this confirms
    // declareWinner preserves that invariant after transitioning back to active.
    const hand = makeHand(['Alice', 'Bob']);
    const afterFold = fold(hand, hand.players[0].id); // Alice folds → Bob wins, fold-win showdown
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
