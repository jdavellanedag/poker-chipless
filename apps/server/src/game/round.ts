import type { GameState } from '@poker-chipless/types';
import { appendLog, detectRoundComplete } from './state.js';

type GameResult = { ok: true; state: GameState } | { ok: false; error: string };

const ROUND_ORDER = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const;
type Round = typeof ROUND_ORDER[number];

const ROUND_LABELS: Record<Round, string> = {
  preflop: '--- Pre-flop ---',
  flop: '--- Flop ---',
  turn: '--- Turn ---',
  river: '--- River ---',
  showdown: '--- Showdown ---',
};

export { detectRoundComplete } from './state.js';

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

  const n = players.length;
  let firstActive = state.dealerButtonIndex;
  for (let i = 1; i <= n; i++) {
    const idx = (state.dealerButtonIndex + i) % n;
    if (!players[idx].isEliminated && !players[idx].isFolded) {
      firstActive = idx;
      break;
    }
  }

  const isShowdown = nextRound === 'showdown';
  return {
    ok: true,
    state: detectRoundComplete(appendLog({
      ...state,
      phase: isShowdown ? 'showdown' : state.phase,
      round: nextRound,
      currentBet: 0,
      lastRaiseSize: state.bigBlind,
      roundComplete: false,
      activePlayerIndex: firstActive,
      players,
    }, ROUND_LABELS[nextRound])),
  };
}
