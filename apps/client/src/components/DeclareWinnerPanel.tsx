import { useState } from 'react';
import type { Player } from '@poker-chipless/types';

interface DeclareWinnerPanelProps {
  eligible: Player[];
  pot: number;
  onDeclareWinner: (playerId: string) => void;
}

export function DeclareWinnerPanel({ eligible, pot, onDeclareWinner }: DeclareWinnerPanelProps) {
  const [selectedId, setSelectedId] = useState(eligible[0]?.id ?? '');

  if (eligible.length === 1) {
    const winner = eligible[0];
    return (
      <div data-testid="declare-winner-panel" className="space-y-2">
        <button
          data-testid="accept-winner-btn"
          onClick={() => onDeclareWinner(winner.id)}
          className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2 rounded"
        >
          Accept — {winner.displayName} wins {pot}
        </button>
      </div>
    );
  }

  return (
    <div data-testid="declare-winner-panel" className="space-y-2">
      <select
        data-testid="winner-select"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      >
        {eligible.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName} ({p.chipCount} chips)
          </option>
        ))}
      </select>
      <button
        data-testid="declare-winner-btn"
        onClick={() => { if (selectedId) onDeclareWinner(selectedId); }}
        disabled={!selectedId}
        className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2 rounded disabled:opacity-40"
      >
        Declare Winner
      </button>
    </div>
  );
}
