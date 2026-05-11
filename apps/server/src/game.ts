import type { GameState } from '@poker-chipless/types';

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
      players: state.players.map((p) => ({ ...p, chipCount: startingStack })),
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
