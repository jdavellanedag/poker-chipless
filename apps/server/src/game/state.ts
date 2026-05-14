import type { GameState } from '@poker-chipless/types';

export function appendLog(state: GameState, message: string): GameState {
  return {
    ...state,
    log: [...state.log, { timestamp: new Date().toISOString(), message }],
  };
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

export function detectRoundComplete(state: GameState): GameState {
  const contesting = state.players.filter((p) => !p.isFolded && !p.isEliminated);
  const allActed = contesting.every((p) => p.isAllIn || p.hasActedThisRound);
  const allMatched = contesting.every((p) => p.isAllIn || p.currentBet === state.currentBet);
  if (!allActed || !allMatched || state.roundComplete) return withValidActions(state);
  return withValidActions(appendLog({ ...state, roundComplete: true }, 'Betting round complete. Host may advance.'));
}
