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
  // Heads-up: BB acts first pre-flop (button/SB acts last)
  const utgIndex =
    activePlayers.length === 2 ? bbIndex : nextActiveIndex(state.players, bbIndex);

  const players = state.players.map((p) => ({ ...p, currentBet: 0, isAllIn: false }));
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
    state: {
      ...state,
      round: 'preflop',
      dealerButtonIndex: buttonIndex,
      activePlayerIndex: utgIndex,
      pot: sbAmount + bbAmount,
      currentBet: state.bigBlind,
      lastRaiseSize: state.bigBlind,
      players,
      log,
    },
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
