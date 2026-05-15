import { useRef, useEffect } from 'react';
import type { Player } from '@poker-chipless/types';

interface GamePlayerListProps {
  mode: 'game';
  players: Player[];
  myPlayerId: string;
  activePlayerIndex: number;
  dealerButtonIndex: number;
  sbIdx: number;
  bbIdx: number;
}

interface LobbyPlayerListProps {
  mode: 'lobby';
  players: Player[];
  isHost: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

type PlayerListProps = GamePlayerListProps | LobbyPlayerListProps;

export function PlayerList(props: PlayerListProps) {
  if (props.mode === 'game') return <GamePlayerList {...props} />;
  return <LobbyPlayerList {...props} />;
}

function GamePlayerList({ players, myPlayerId, activePlayerIndex, dealerButtonIndex, sbIdx, bbIdx }: GamePlayerListProps) {
  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activePlayerIndex]);

  return (
    <ul className="space-y-2 py-2">
      {players.map((p, i) => {
        const isActive = i === activePlayerIndex;
        return (
          <li
            key={p.id}
            ref={isActive ? activeRef : null}
            data-testid={`player-row-${p.displayName}`}
            className={`flex justify-between items-center rounded-lg px-4 py-3 ${isActive ? 'bg-slate-700 ring-1 ring-emerald-500' : 'bg-slate-800'}`}
          >
            <span className="flex items-center gap-2">
              {i === dealerButtonIndex && <span className="text-xs bg-yellow-600 text-yellow-100 px-1.5 py-0.5 rounded-full font-mono">D</span>}
              {i === sbIdx && <span data-testid={`badge-sb-${p.displayName}`} className="text-xs bg-blue-700 text-blue-100 px-1.5 py-0.5 rounded-full font-mono">SB</span>}
              {i === bbIdx && <span data-testid={`badge-bb-${p.displayName}`} className="text-xs bg-violet-700 text-violet-100 px-1.5 py-0.5 rounded-full font-mono">BB</span>}
              {p.isEliminated && <span data-testid={`badge-eliminated-${p.displayName}`} className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded-full font-mono">Eliminated</span>}
              {!p.isConnected && <span data-testid={`disconnected-indicator-${p.displayName}`} className="w-2 h-2 rounded-full bg-slate-500 shrink-0" aria-label="disconnected" />}
              <span className={p.id === myPlayerId ? 'text-emerald-400 font-semibold' : p.isFolded ? 'text-slate-600 line-through' : !p.isConnected ? 'text-slate-500' : 'text-white'}>
                {p.displayName}
              </span>
            </span>
            <span className="flex items-center gap-3">
              {p.currentBet > 0 && <span className="text-yellow-400 font-mono text-sm">{p.currentBet}</span>}
              <span data-testid={`chips-${p.displayName}`} className="text-slate-300 font-mono">{p.chipCount}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function LobbyPlayerList({ players, isHost, onMoveUp, onMoveDown }: LobbyPlayerListProps) {
  return (
    <ul className="space-y-2 mb-8">
      {players.map((p, i) => (
        <li key={p.id} data-testid={`player-row-${p.displayName}`} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
          <span className={p.isConnected ? 'text-white' : 'text-slate-500'}>{p.displayName}</span>
          <span className="flex items-center gap-2">
            {p.isHost && <span className="text-xs bg-emerald-700 text-emerald-200 px-2 py-0.5 rounded-full">host</span>}
            {!p.isConnected && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">disconnected</span>}
            {isHost && (
              <span className="flex gap-0.5">
                <button data-testid={`move-up-${p.displayName}`} onClick={() => onMoveUp(i)} disabled={i === 0} className="text-slate-400 hover:text-white disabled:opacity-20 w-6 text-center" aria-label={`Move ${p.displayName} up`}>▲</button>
                <button data-testid={`move-down-${p.displayName}`} onClick={() => onMoveDown(i)} disabled={i === players.length - 1} className="text-slate-400 hover:text-white disabled:opacity-20 w-6 text-center" aria-label={`Move ${p.displayName} down`}>▼</button>
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
