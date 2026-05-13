import { describe, it, expect } from 'vitest';
import { createSession, joinSession } from '../session.js';
import { startGame, reorderPlayers, newHand, fold, check, call } from '../game.js';

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
  it('awards pot to last remaining player, keeps phase active, and allows newHand', () => {
    // Heads-up: Alice(0)=button/SB acts first. Alice folds → Bob wins.
    const hand = makeHand(['Alice', 'Bob']);
    expect(hand.activePlayerIndex).toBe(0);
    const potBeforeFold = hand.pot; // SB + BB already in pot

    const result = fold(hand, hand.players[0].id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const bob = result.state.players.find((p) => p.displayName === 'Bob')!;
    // phase stays active — host can immediately start a new hand
    expect(result.state.phase).toBe('active');
    // pot transferred to Bob
    expect(result.state.pot).toBe(0);
    expect(bob.chipCount).toBe(hand.players.find((p) => p.displayName === 'Bob')!.chipCount + potBeforeFold);
    // log records the win
    expect(result.state.log.map((e) => e.message)).toContain(
      `Bob wins ${potBeforeFold} (everyone else folded)`,
    );
    // host can start a new hand without hitting "Game has already started"
    const nextHand = newHand(result.state);
    expect(nextHand.ok).toBe(true);
  });

  it('awards pot to last remaining player in a 3-player hand when two fold', () => {
    // Alice(0)=button/UTG, Bob(1)=SB, Carol(2)=BB. Alice folds first, then Bob folds.
    const hand = makeHand(['Alice', 'Bob', 'Carol']);
    expect(hand.activePlayerIndex).toBe(0); // Alice (UTG) acts first
    const potBeforeFolds = hand.pot;

    const afterAliceFold = fold(hand, hand.players[0].id);
    expect(afterAliceFold.ok).toBe(true);
    if (!afterAliceFold.ok) return;
    // Two still contesting (Bob + Carol) — hand continues
    expect(afterAliceFold.state.phase).toBe('active');

    const afterBobFold = fold(afterAliceFold.state, afterAliceFold.state.players[afterAliceFold.state.activePlayerIndex].id);
    expect(afterBobFold.ok).toBe(true);
    if (!afterBobFold.ok) return;

    const carol = afterBobFold.state.players.find((p) => p.displayName === 'Carol')!;
    expect(afterBobFold.state.phase).toBe('active');
    expect(afterBobFold.state.pot).toBe(0);
    expect(carol.chipCount).toBe(hand.players.find((p) => p.displayName === 'Carol')!.chipCount + potBeforeFolds);
    const nextHand = newHand(afterBobFold.state);
    expect(nextHand.ok).toBe(true);
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
