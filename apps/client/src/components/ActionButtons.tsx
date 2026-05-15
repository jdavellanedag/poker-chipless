import { useState, useEffect } from 'react';
import type { Player, GameState } from '@poker-chipless/types';

interface ActionButtonsProps {
  me: Player;
  currentBet: number;
  bigBlind: number;
  lastRaiseSize: number;
  activePlayerIndex: number;
  phase: GameState['phase'];
  roundComplete: boolean;
  isPaused: boolean;
  isMyTurn: boolean;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onBet: (amount: number) => void;
  onRaise: (amount: number) => void;
  onAllin: () => void;
}

export function ActionButtons({
  me, currentBet, bigBlind, lastRaiseSize, activePlayerIndex,
  phase, roundComplete, isPaused, isMyTurn,
  onFold, onCheck, onCall, onBet, onRaise, onAllin,
}: ActionButtonsProps) {
  const minBetOrRaise = currentBet === 0 ? bigBlind : currentBet + lastRaiseSize;
  const callAmount = Math.max(0, currentBet - me.currentBet);
  const canCheck = isMyTurn && currentBet === me.currentBet;
  const canCall = !canCheck && me.chipCount > callAmount;

  const [betInput, setBetInput] = useState(String(minBetOrRaise));
  useEffect(() => { setBetInput(String(minBetOrRaise)); }, [activePlayerIndex, minBetOrRaise]);

  const parsedBet = parseInt(betInput, 10);
  const betInputValid = !isNaN(parsedBet) && parsedBet > 0 && parsedBet === Math.floor(parsedBet);
  const canBet = isMyTurn && currentBet === 0 && betInputValid && parsedBet >= bigBlind && parsedBet <= me.chipCount;
  const canRaise = isMyTurn && currentBet > 0 && betInputValid && parsedBet >= minBetOrRaise && parsedBet <= (me.currentBet + me.chipCount);

  if (!isMyTurn || roundComplete || phase === 'showdown' || isPaused) return null;

  return (
    <div data-testid="action-buttons" className="space-y-2 mb-4">
      <div className="flex gap-2">
        <button data-testid="btn-fold" onClick={onFold} className="flex-1 bg-red-700 hover:bg-red-600 text-white font-semibold py-3 rounded">Fold</button>
        {canCheck && <button data-testid="btn-check" onClick={onCheck} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 rounded">Check</button>}
        {canCall && <button data-testid="btn-call" onClick={onCall} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded">Call {callAmount}</button>}
        <button data-testid="btn-allin" onClick={onAllin} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-3 rounded">All-In ({me.chipCount})</button>
      </div>
      {currentBet === 0 ? (
        <div className="flex gap-2">
          <input data-testid="bet-input" type="number" min={bigBlind} step={1} value={betInput} onChange={(e) => setBetInput(e.target.value)} className="flex-1 bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button data-testid="btn-bet" onClick={() => { if (canBet) onBet(parsedBet); }} disabled={!canBet} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded disabled:opacity-40">Bet {betInputValid ? parsedBet : ''}</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input data-testid="raise-input" type="number" min={minBetOrRaise} step={1} value={betInput} onChange={(e) => setBetInput(e.target.value)} className="flex-1 bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button data-testid="btn-raise" onClick={() => { if (canRaise) onRaise(parsedBet); }} disabled={!canRaise} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded disabled:opacity-40">Raise to {betInputValid ? parsedBet : ''}</button>
        </div>
      )}
    </div>
  );
}
