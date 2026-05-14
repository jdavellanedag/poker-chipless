import type { GameState } from '@poker-chipless/types';
import { appendLog, withValidActions } from './state.js';

type GameResult = { ok: true; state: GameState } | { ok: false; error: string };

function nextActiveIndex(players: GameState['players'], fromIndex: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (!players[idx].isEliminated) return idx;
  }
  return fromIndex;
}

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
    state: appendLog({
      ...state,
      phase: 'active',
      smallBlind,
      bigBlind,
      startingStack,
      dealerButtonIndex: -1,
      players: state.players.map((p) => ({ ...p, chipCount: startingStack })),
    }, `Game started. Stack: ${startingStack}, Blinds: ${smallBlind}/${bigBlind}`),
  };
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

  const sbIndex =
    activePlayers.length === 2 ? buttonIndex : nextActiveIndex(state.players, buttonIndex);
  const bbIndex = nextActiveIndex(state.players, sbIndex);
  const utgIndex =
    activePlayers.length === 2 ? buttonIndex : nextActiveIndex(state.players, bbIndex);

  const players = state.players.map((p) => ({ ...p, currentBet: 0, isAllIn: false, isFolded: false, hasActedThisRound: false }));

  const sbPlayer = players[sbIndex];
  const sbAmount = Math.min(state.smallBlind, sbPlayer.chipCount);
  players[sbIndex] = {
    ...sbPlayer,
    chipCount: sbPlayer.chipCount - sbAmount,
    currentBet: sbAmount,
    isAllIn: sbPlayer.chipCount <= state.smallBlind,
  };

  const bbPlayer = players[bbIndex];
  const bbAmount = Math.min(state.bigBlind, bbPlayer.chipCount);
  players[bbIndex] = {
    ...bbPlayer,
    chipCount: bbPlayer.chipCount - bbAmount,
    currentBet: bbAmount,
    isAllIn: bbPlayer.chipCount <= state.bigBlind,
  };

  const withBlinds = appendLog(
    appendLog({ ...state, players }, `${sbPlayer.displayName} posts small blind: ${sbAmount}`),
    `${bbPlayer.displayName} posts big blind: ${bbAmount}`,
  );

  return {
    ok: true,
    state: withValidActions({
      ...withBlinds,
      round: 'preflop',
      dealerButtonIndex: buttonIndex,
      activePlayerIndex: utgIndex,
      pot: sbAmount + bbAmount,
      currentBet: state.bigBlind,
      lastRaiseSize: state.bigBlind,
      roundComplete: false,
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

  const newlyEliminated = players.filter(
    (p, i) => p.isEliminated && !state.players[i].isEliminated,
  );

  let afterWin = appendLog(
    { ...state, phase: 'active', pot: 0, players, roundComplete: true },
    `${winner.displayName} wins pot of ${potAmount}`,
  );
  for (const p of newlyEliminated) {
    afterWin = appendLog(afterWin, `${p.displayName} has been eliminated`);
  }

  return { ok: true, state: withValidActions(afterWin) };
}

export function pause(state: GameState): GameResult {
  if (state.phase !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }
  return {
    ok: true,
    state: appendLog({ ...state, phase: 'paused' }, 'Game paused by host'),
  };
}

export function resume(state: GameState): GameResult {
  if (state.phase !== 'paused') {
    return { ok: false, error: 'Game is not paused.' };
  }
  return {
    ok: true,
    state: appendLog({ ...state, phase: 'active' }, 'Game resumed by host'),
  };
}

export function rebuy(state: GameState, playerId: string, amount: number): GameResult {
  if (state.pot > 0) {
    return { ok: false, error: 'Rebuy is only allowed between hands.' };
  }
  if (amount <= 0) {
    return { ok: false, error: 'Rebuy amount must be a positive integer.' };
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { ok: false, error: 'Player not found.' };
  }
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, chipCount: p.chipCount + amount, isEliminated: false } : p,
  );
  return {
    ok: true,
    state: appendLog({ ...state, players }, `${player.displayName} re-buys for ${amount} chips`),
  };
}

export function endGame(state: GameState): GameResult {
  const remaining = state.players.filter((p) => !p.isEliminated);
  if (remaining.length >= 2) {
    return { ok: false, error: 'Cannot end game while 2 or more players remain.' };
  }
  const winner = remaining[0];
  const message = winner ? `Game over — ${winner.displayName} wins!` : 'Game over';
  return {
    ok: true,
    state: appendLog({ ...state, phase: 'ended' }, message),
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
