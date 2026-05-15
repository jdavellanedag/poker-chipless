import { useState } from 'react';
import type { GameState } from '@poker-chipless/types';
import { DeclareWinnerPanel } from './DeclareWinnerPanel.js';

function advanceRoundLabel(round: GameState['round']): string {
  if (round === 'preflop') return 'Deal Flop';
  if (round === 'flop') return 'Deal Turn';
  if (round === 'turn') return 'Deal River';
  return 'Go to Showdown';
}

interface HostPanelProps {
  phase: GameState['phase'];
  round: GameState['round'];
  pot: number;
  roundComplete: boolean;
  startingStack: number;
  players: GameState['players'];
  onNewHand: () => void;
  onAdvanceRound: () => void;
  onDeclareWinner: (playerId: string) => void;
  onPause: () => void;
  onResume: () => void;
  onRebuy: (playerId: string, amount: number) => void;
}

export function HostPanel({
  phase,
  round,
  pot,
  roundComplete,
  startingStack,
  players,
  onNewHand,
  onAdvanceRound,
  onDeclareWinner,
  onPause,
  onResume,
  onRebuy,
}: HostPanelProps) {
  const [rebuyPlayerId, setRebuyPlayerId] = useState(players[0]?.id ?? '');
  const [rebuyAmount, setRebuyAmount] = useState(String(startingStack));
  const parsedRebuyAmount = parseInt(rebuyAmount, 10);
  const rebuyValid = !isNaN(parsedRebuyAmount) && parsedRebuyAmount > 0 && rebuyPlayerId !== '' && pot === 0;

  return (
    <div className="mt-4 bg-slate-800 rounded-xl p-4 space-y-3">
      <p className="text-slate-400 text-xs uppercase tracking-wide">Host Controls</p>

      {pot === 0 && (
        <button
          data-testid="new-hand-btn"
          onClick={onNewHand}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded"
        >
          New Hand
        </button>
      )}

      {roundComplete && phase !== 'showdown' && pot > 0 && (
        <button
          data-testid="advance-round-btn"
          onClick={onAdvanceRound}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded"
        >
          {advanceRoundLabel(round)}
        </button>
      )}

      {phase === 'showdown' && pot > 0 && (
        <DeclareWinnerPanel
          eligible={players.filter((p) => !p.isEliminated && !p.isFolded)}
          pot={pot}
          onDeclareWinner={onDeclareWinner}
        />
      )}

      <div className="space-y-2">
        <p className="text-slate-500 text-xs uppercase tracking-wide">Rebuy</p>
        <select
          data-testid="rebuy-player-select"
          value={rebuyPlayerId}
          onChange={(e) => setRebuyPlayerId(e.target.value)}
          className="w-full bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName} ({p.chipCount} chips{p.isEliminated ? ', eliminated' : ''})
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            data-testid="rebuy-amount-input"
            type="number"
            min={1}
            step={1}
            value={rebuyAmount}
            onChange={(e) => setRebuyAmount(e.target.value)}
            className="flex-1 bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            data-testid="rebuy-btn"
            disabled={!rebuyValid}
            onClick={() => rebuyValid && onRebuy(rebuyPlayerId, parsedRebuyAmount)}
            className={`flex-1 font-semibold py-2 rounded ${rebuyValid ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'}`}
          >
            Rebuy
          </button>
        </div>
      </div>

      {phase === 'active' && (
        <button
          data-testid="pause-btn"
          onClick={onPause}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2 rounded"
        >
          Pause Game
        </button>
      )}

      {phase === 'paused' && (
        <button
          data-testid="resume-btn"
          onClick={onResume}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded"
        >
          Resume Game
        </button>
      )}
    </div>
  );
}
