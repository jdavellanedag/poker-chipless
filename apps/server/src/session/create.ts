import { randomUUID } from 'crypto';
import type { GameState } from '@poker-chipless/types';

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
        isFolded: false,
        hasActedThisRound: false,
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
    startingStack: 0,
    roundComplete: false,
    log: [],
  };
  return { state, token };
}
