import { randomUUID } from 'crypto';
import type { GameState } from '@poker-chipless/types';

type JoinResult =
  | { ok: true; state: GameState; token: string }
  | { ok: false; error: string };

export function joinSession(
  state: GameState,
  payload: { displayName: string; token?: string },
): JoinResult {
  if (state.phase !== 'lobby') {
    return { ok: false, error: 'Session is not accepting new players.' };
  }
  const name = payload.displayName.trim();
  if (!name) {
    return { ok: false, error: 'Display name cannot be empty.' };
  }
  const token = randomUUID();
  const newPlayer = {
    id: randomUUID(),
    displayName: name,
    chipCount: 0,
    currentBet: 0,
    isHost: false,
    isEliminated: false,
    isConnected: true,
    isAllIn: false,
    isFolded: false,
    hasActedThisRound: false,
    validActions: [] as GameState['players'][0]['validActions'],
  };
  return {
    ok: true,
    state: { ...state, players: [...state.players, newPlayer] },
    token,
  };
}
