import type { GameState } from '@poker-chipless/types';
import { appendLog, withValidActions, detectRoundComplete } from './state.js';

type GameResult = { ok: true; state: GameState } | { ok: false; error: string };

function nextFoldAwareIndex(players: GameState['players'], fromIndex: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (!players[idx].isEliminated && !players[idx].isFolded) return idx;
  }
  return fromIndex;
}

function foldInternal(state: GameState, playerId: string, logMessage: string): GameResult {
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
  const afterFold = appendLog({ ...state, players }, logMessage);

  const contesting = players.filter((p) => !p.isFolded && !p.isEliminated);
  if (contesting.length === 1) {
    const winner = contesting[0];
    const winnerIndex = players.findIndex((p) => p.id === winner.id);
    return {
      ok: true,
      state: withValidActions(appendLog({
        ...afterFold,
        phase: 'showdown',
        round: 'showdown',
        activePlayerIndex: winnerIndex,
        roundComplete: true,
      }, `${winner.displayName} wins ${state.pot} (everyone else folded)`)),
    };
  }

  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return { ok: true, state: detectRoundComplete({ ...afterFold, activePlayerIndex: nextIndex }) };
}

export function fold(state: GameState, playerId: string): GameResult {
  return foldInternal(state, playerId, `${state.players[state.activePlayerIndex]?.displayName} folds`);
}

export function autoFold(state: GameState, playerId: string): GameResult {
  return foldInternal(state, playerId, `${state.players[state.activePlayerIndex]?.displayName} auto-folded (disconnected)`);
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
  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return {
    ok: true,
    state: detectRoundComplete(appendLog({ ...state, players, activePlayerIndex: nextIndex }, `${activePlayer.displayName} checks`)),
  };
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
  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return {
    ok: true,
    state: detectRoundComplete(appendLog(
      { ...state, players, pot: state.pot + actualAmount, activePlayerIndex: nextIndex },
      `${activePlayer.displayName} calls ${actualAmount}`,
    )),
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
    if (totalBet > state.currentBet && !p.isFolded && !p.isEliminated && !p.isAllIn) {
      return { ...p, hasActedThisRound: false };
    }
    return p;
  });
  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return {
    ok: true,
    state: detectRoundComplete(appendLog(
      { ...state, players, currentBet: newCurrentBet, lastRaiseSize: newLastRaiseSize, pot: state.pot + allInAmount, activePlayerIndex: nextIndex },
      `${activePlayer.displayName} goes all-in for ${allInAmount}`,
    )),
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
    if (!p.isFolded && !p.isEliminated && !p.isAllIn) {
      return { ...p, hasActedThisRound: false };
    }
    return p;
  });
  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return {
    ok: true,
    state: detectRoundComplete(appendLog(
      { ...state, players, currentBet: raiseTotal, lastRaiseSize: raiseIncrement, pot: state.pot + addAmount, activePlayerIndex: nextIndex },
      `${activePlayer.displayName} raises to ${raiseTotal}`,
    )),
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
  const nextIndex = nextFoldAwareIndex(players, state.activePlayerIndex);
  return {
    ok: true,
    state: detectRoundComplete(appendLog(
      { ...state, players, currentBet: amount, lastRaiseSize: amount, pot: state.pot + amount, activePlayerIndex: nextIndex },
      `${activePlayer.displayName} bets ${amount}`,
    )),
  };
}
