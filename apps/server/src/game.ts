import type { GameState, LogEntry } from '@poker-chipless/types';

type GameResult = { ok: true; state: GameState } | { ok: false; error: string };

export function startGame(
  state: GameState,
  payload: { startingStack: number; smallBlind: number; bigBlind: number },
): GameResult {
  if (state.phase !== 'lobby') {
    return { ok: false, error: 'Game has already started.' };
  }
  if (state.players.length < 2) {
    return { ok: false, error: 'At least 2 players are required to start.' };
  }
  const { startingStack, smallBlind, bigBlind } = payload;
  if (startingStack <= 0) {
    return { ok: false, error: 'Starting stack must be a positive integer.' };
  }
  if (smallBlind <= 0) {
    return { ok: false, error: 'Small blind must be a positive integer.' };
  }
  if (bigBlind < smallBlind) {
    return { ok: false, error: 'Big blind must be greater than or equal to small blind.' };
  }
  return {
    ok: true,
    state: {
      ...state,
      phase: 'active',
      smallBlind,
      bigBlind,
      dealerButtonIndex: -1, // sentinel: no hand dealt yet
      players: state.players.map((p) => ({ ...p, chipCount: startingStack })),
    },
  };
}

function nextActiveIndex(players: GameState['players'], fromIndex: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (!players[idx].isEliminated) return idx;
  }
  return fromIndex;
}

export function newHand(state: GameState): GameResult {
  if (state.phase !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }
  const activePlayers = state.players.filter((p) => !p.isEliminated);
  if (activePlayers.length < 2) {
    return { ok: false, error: 'Not enough active players to start a hand.' };
  }

  const buttonIndex =
    state.dealerButtonIndex === -1
      ? state.players.findIndex((p) => !p.isEliminated)
      : nextActiveIndex(state.players, state.dealerButtonIndex);

  // Heads-up: button IS the small blind; otherwise SB is left of button
  const sbIndex =
    activePlayers.length === 2 ? buttonIndex : nextActiveIndex(state.players, buttonIndex);
  const bbIndex = nextActiveIndex(state.players, sbIndex);
  // Heads-up: button/SB acts first pre-flop; 3+ players: UTG is next clockwise after BB
  const utgIndex =
    activePlayers.length === 2 ? buttonIndex : nextActiveIndex(state.players, bbIndex);

  const players = state.players.map((p) => ({ ...p, currentBet: 0, isAllIn: false, isFolded: false, hasActedThisRound: false }));
  const log: LogEntry[] = [...state.log];

  const sbPlayer = players[sbIndex];
  const sbAmount = Math.min(state.smallBlind, sbPlayer.chipCount);
  players[sbIndex] = {
    ...sbPlayer,
    chipCount: sbPlayer.chipCount - sbAmount,
    currentBet: sbAmount,
    isAllIn: sbPlayer.chipCount <= state.smallBlind,
  };
  log.push({
    timestamp: new Date().toISOString(),
    message: `${sbPlayer.displayName} posts small blind: ${sbAmount}`,
  });

  const bbPlayer = players[bbIndex];
  const bbAmount = Math.min(state.bigBlind, bbPlayer.chipCount);
  players[bbIndex] = {
    ...bbPlayer,
    chipCount: bbPlayer.chipCount - bbAmount,
    currentBet: bbAmount,
    isAllIn: bbPlayer.chipCount <= state.bigBlind,
  };
  log.push({
    timestamp: new Date().toISOString(),
    message: `${bbPlayer.displayName} posts big blind: ${bbAmount}`,
  });

  return {
    ok: true,
    state: withValidActions({
      ...state,
      round: 'preflop',
      dealerButtonIndex: buttonIndex,
      activePlayerIndex: utgIndex,
      pot: sbAmount + bbAmount,
      currentBet: state.bigBlind,
      lastRaiseSize: state.bigBlind,
      roundComplete: false,
      players,
      log,
    }),
  };
}

function nextFoldAwareIndex(players: GameState['players'], fromIndex: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (!players[idx].isEliminated && !players[idx].isFolded) return idx;
  }
  return fromIndex;
}

export function withValidActions(state: GameState): GameState {
  const active = state.players[state.activePlayerIndex];
  const players = state.players.map((p) => {
    if (p.id !== active?.id || p.isEliminated || p.isFolded || p.isAllIn || state.roundComplete || state.phase === 'showdown') {
      return { ...p, validActions: [] as GameState['players'][number]['validActions'] };
    }
    const callAmount = state.currentBet - p.currentBet;
    if (callAmount > 0 && p.chipCount <= callAmount) {
      return { ...p, validActions: ['allin', 'fold'] as GameState['players'][number]['validActions'] };
    }
    if (state.currentBet === 0) {
      return { ...p, validActions: ['bet', 'check', 'fold', 'allin'] as GameState['players'][number]['validActions'] };
    }
    return { ...p, validActions: ['call', 'raise', 'fold', 'allin'] as GameState['players'][number]['validActions'] };
  });
  return { ...state, players };
}

function detectRoundComplete(state: GameState): GameState {
  const contesting = state.players.filter((p) => !p.isFolded && !p.isEliminated);
  const allActed = contesting.every((p) => p.isAllIn || p.hasActedThisRound);
  const allMatched = contesting.every((p) => p.isAllIn || p.currentBet === state.currentBet);
  if (!allActed || !allMatched || state.roundComplete) return withValidActions(state);
  return withValidActions({
    ...state,
    roundComplete: true,
    log: [
      ...state.log,
      { timestamp: new Date().toISOString(), message: 'Betting round complete. Host may advance.' },
    ],
  });
}

export function fold(state: GameState, playerId: string): GameResult {
  if (state.phase !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer.id !== playerId) {
    return { ok: false, error: 'It is not your turn.' };
  }

  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex ? { ...p, isFolded: true, hasActedThisRound: true } : p,
  );
  const log = [
    ...state.log,
    { timestamp: new Date().toISOString(), message: `${activePlayer.displayName} folds` },
  ];

  const contesting = players.filter((p) => !p.isFolded && !p.isEliminated);
  if (contesting.length === 1) {
    const winner = contesting[0];
    const winnerIndex = players.findIndex((p) => p.id === winner.id);
    return {
      ok: true,
      state: withValidActions({
        ...state,
        phase: 'showdown',
        round: 'showdown',
        players,
        activePlayerIndex: winnerIndex,
        roundComplete: true,
        log: [
          ...log,
          { timestamp: new Date().toISOString(), message: `${winner.displayName} wins ${state.pot} (everyone else folded)` },
        ],
      }),
    };
  }

  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return { ok: true, state: detectRoundComplete({ ...state, players, log, activePlayerIndex: nextIndex }) };
}

export function check(state: GameState, playerId: string): GameResult {
  if (state.phase !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer.id !== playerId) {
    return { ok: false, error: 'It is not your turn.' };
  }
  if (state.currentBet !== activePlayer.currentBet) {
    return { ok: false, error: 'Cannot check when there is an open bet.' };
  }

  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex ? { ...p, hasActedThisRound: true } : p,
  );
  const log = [
    ...state.log,
    { timestamp: new Date().toISOString(), message: `${activePlayer.displayName} checks` },
  ];

  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return { ok: true, state: detectRoundComplete({ ...state, players, log, activePlayerIndex: nextIndex }) };
}

export function call(state: GameState, playerId: string): GameResult {
  if (state.phase !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer.id !== playerId) {
    return { ok: false, error: 'It is not your turn.' };
  }
  const callAmount = Math.max(0, state.currentBet - activePlayer.currentBet);
  const actualAmount = Math.min(callAmount, activePlayer.chipCount);

  const goesAllIn = actualAmount < callAmount;
  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex
      ? { ...p, chipCount: p.chipCount - actualAmount, currentBet: p.currentBet + actualAmount, hasActedThisRound: true, isAllIn: goesAllIn || p.isAllIn }
      : p,
  );
  const log = [
    ...state.log,
    { timestamp: new Date().toISOString(), message: `${activePlayer.displayName} calls ${actualAmount}` },
  ];

  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return {
    ok: true,
    state: detectRoundComplete({ ...state, players, log, pot: state.pot + actualAmount, activePlayerIndex: nextIndex }),
  };
}

export function allin(state: GameState, playerId: string): GameResult {
  if (state.phase !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer.id !== playerId) {
    return { ok: false, error: 'It is not your turn.' };
  }

  const allInAmount = activePlayer.chipCount;
  const totalBet = activePlayer.currentBet + allInAmount;
  const newCurrentBet = Math.max(state.currentBet, totalBet);
  const newLastRaiseSize = totalBet > state.currentBet
    ? Math.max(state.lastRaiseSize, totalBet - state.currentBet)
    : state.lastRaiseSize;

  const players = state.players.map((p, i) => {
    if (i === state.activePlayerIndex) {
      return { ...p, chipCount: 0, currentBet: totalBet, isAllIn: true, hasActedThisRound: true };
    }
    // Re-open betting if this all-in raises the bet above the current bet
    if (totalBet > state.currentBet && !p.isFolded && !p.isEliminated && !p.isAllIn) {
      return { ...p, hasActedThisRound: false };
    }
    return p;
  });
  const log = [
    ...state.log,
    { timestamp: new Date().toISOString(), message: `${activePlayer.displayName} goes all-in for ${allInAmount}` },
  ];

  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return {
    ok: true,
    state: detectRoundComplete({
      ...state,
      players,
      log,
      currentBet: newCurrentBet,
      lastRaiseSize: newLastRaiseSize,
      pot: state.pot + allInAmount,
      activePlayerIndex: nextIndex,
    }),
  };
}

export function raise(state: GameState, playerId: string, raiseTotal: number): GameResult {
  if (state.phase !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer.id !== playerId) {
    return { ok: false, error: 'It is not your turn.' };
  }
  if (state.currentBet === 0) {
    return { ok: false, error: 'No open bet to raise. Use bet.' };
  }
  const minRaiseTotal = state.currentBet + state.lastRaiseSize;
  if (raiseTotal < minRaiseTotal) {
    return { ok: false, error: `Minimum raise is to ${minRaiseTotal}.` };
  }
  const addAmount = raiseTotal - activePlayer.currentBet;
  if (addAmount > activePlayer.chipCount) {
    return { ok: false, error: 'Raise exceeds your chip count.' };
  }

  const raiseIncrement = raiseTotal - state.currentBet;
  const players = state.players.map((p, i) => {
    if (i === state.activePlayerIndex) {
      return { ...p, chipCount: p.chipCount - addAmount, currentBet: raiseTotal, hasActedThisRound: true };
    }
    // Re-open betting for all non-folded, non-eliminated, non-all-in players except the raiser
    if (!p.isFolded && !p.isEliminated && !p.isAllIn) {
      return { ...p, hasActedThisRound: false };
    }
    return p;
  });
  const log = [
    ...state.log,
    { timestamp: new Date().toISOString(), message: `${activePlayer.displayName} raises to ${raiseTotal}` },
  ];

  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return {
    ok: true,
    state: detectRoundComplete({
      ...state,
      players,
      log,
      currentBet: raiseTotal,
      lastRaiseSize: raiseIncrement,
      pot: state.pot + addAmount,
      activePlayerIndex: nextIndex,
    }),
  };
}

export function bet(state: GameState, playerId: string, amount: number): GameResult {
  if (state.phase !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer.id !== playerId) {
    return { ok: false, error: 'It is not your turn.' };
  }
  if (state.currentBet !== 0) {
    return { ok: false, error: 'Cannot bet when there is already an open bet. Use raise.' };
  }
  if (amount < state.bigBlind) {
    return { ok: false, error: `Minimum bet is the big blind (${state.bigBlind}).` };
  }
  if (amount > activePlayer.chipCount) {
    return { ok: false, error: 'Bet exceeds your chip count.' };
  }

  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex
      ? { ...p, chipCount: p.chipCount - amount, currentBet: amount, hasActedThisRound: true }
      : p,
  );
  const log = [
    ...state.log,
    { timestamp: new Date().toISOString(), message: `${activePlayer.displayName} bets ${amount}` },
  ];

  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return {
    ok: true,
    state: detectRoundComplete({
      ...state,
      players,
      log,
      currentBet: amount,
      lastRaiseSize: amount,
      pot: state.pot + amount,
      activePlayerIndex: nextIndex,
    }),
  };
}

const ROUND_ORDER = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const;
type Round = typeof ROUND_ORDER[number];

const ROUND_LABELS: Record<Round, string> = {
  preflop: '--- Pre-flop ---',
  flop: '--- Flop ---',
  turn: '--- Turn ---',
  river: '--- River ---',
  showdown: '--- Showdown ---',
};

export function advanceRound(state: GameState): GameResult {
  if (state.phase !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }
  const currentIndex = ROUND_ORDER.indexOf(state.round as Round);
  if (currentIndex === -1 || currentIndex === ROUND_ORDER.length - 1) {
    return { ok: false, error: 'Cannot advance past showdown.' };
  }
  const nextRound = ROUND_ORDER[currentIndex + 1];
  const players = state.players.map((p) => ({
    ...p,
    currentBet: 0,
    hasActedThisRound: false,
  }));

  // First non-folded non-eliminated player clockwise of the button
  const n = players.length;
  let firstActive = state.dealerButtonIndex;
  for (let i = 1; i <= n; i++) {
    const idx = (state.dealerButtonIndex + i) % n;
    if (!players[idx].isEliminated && !players[idx].isFolded) {
      firstActive = idx;
      break;
    }
  }

  const log = [
    ...state.log,
    { timestamp: new Date().toISOString(), message: ROUND_LABELS[nextRound] },
  ];

  const isShowdown = nextRound === 'showdown';
  return {
    ok: true,
    state: detectRoundComplete({
      ...state,
      phase: isShowdown ? 'showdown' : state.phase,
      round: nextRound,
      currentBet: 0,
      lastRaiseSize: state.bigBlind,
      roundComplete: false,
      activePlayerIndex: firstActive,
      players,
      log,
    }),
  };
}

export function declareWinner(state: GameState, playerId: string): GameResult {
  if (state.phase !== 'showdown') {
    return { ok: false, error: 'Cannot declare a winner outside of showdown.' };
  }
  const winner = state.players.find((p) => p.id === playerId);
  if (!winner) {
    return { ok: false, error: 'Player not found.' };
  }
  if (winner.isEliminated) {
    return { ok: false, error: 'Cannot declare an eliminated player as winner.' };
  }

  const potAmount = state.pot;
  const players = state.players.map((p) => {
    const newChips = p.id === playerId ? p.chipCount + potAmount : p.chipCount;
    return {
      ...p,
      chipCount: newChips,
      isEliminated: p.isEliminated || newChips === 0,
    };
  });

  const log = [
    ...state.log,
    {
      timestamp: new Date().toISOString(),
      message: `${winner.displayName} wins pot of ${potAmount}`,
    },
  ];

  return {
    ok: true,
    state: withValidActions({
      ...state,
      phase: 'active',
      pot: 0,
      players,
      log,
    }),
  };
}

export function reorderPlayers(state: GameState, orderedPlayerIds: string[]): GameResult {
  const existingIds = new Set(state.players.map((p) => p.id));
  if (
    orderedPlayerIds.length !== state.players.length ||
    !orderedPlayerIds.every((id) => existingIds.has(id))
  ) {
    return { ok: false, error: 'Player ID list does not match current players.' };
  }
  const playerMap = new Map(state.players.map((p) => [p.id, p]));
  return {
    ok: true,
    state: { ...state, players: orderedPlayerIds.map((id) => playerMap.get(id)!) },
  };
}
