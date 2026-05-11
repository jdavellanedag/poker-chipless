import { randomUUID } from 'crypto';
import type { GameState } from '@poker-chipless/types';

type JoinResult =
  | { ok: true; state: GameState; token: string }
  | { ok: false; error: string };

const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return code;
}

export function createSession(displayName: string): { state: GameState; token: string } {
  const token = randomUUID();
  const playerId = randomUUID();
  const state: GameState = {
    code: generateCode(),
    phase: 'lobby',
    round: 'preflop',
    players: [
      {
        id: playerId,
        displayName,
        chipCount: 0,
        currentBet: 0,
        isHost: true,
        isEliminated: false,
        isConnected: true,
        isAllIn: false,
        validActions: [],
      },
    ],
    dealerButtonIndex: 0,
    activePlayerIndex: 0,
    pot: 0,
    currentBet: 0,
    lastRaiseSize: 0,
    smallBlind: 0,
    bigBlind: 0,
    log: [],
  };
  return { state, token };
}

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
    validActions: [] as GameState['players'][0]['validActions'],
  };
  return {
    ok: true,
    state: { ...state, players: [...state.players, newPlayer] },
    token,
  };
}
