import type { Player, LogEntry } from '@poker-chipless/types';
import { CenteredCard } from '../components/CenteredCard.js';

interface GameOverScreenProps {
  players: Player[];
  log: LogEntry[];
}

export function GameOverScreen({ players, log }: GameOverScreenProps) {
  const lastLog = log[log.length - 1];
  return (
    <CenteredCard>
      <h1 className="text-2xl font-bold text-white mb-4">Game Over</h1>
      {lastLog && <p className="text-slate-300 text-center mb-4">{lastLog.message}</p>}
      <ul className="space-y-2">
        {players.filter((p) => !p.isEliminated).map((p) => (
          <li key={p.id} className="text-emerald-400 font-semibold text-lg text-center">
            {p.displayName} — {p.chipCount} chips
          </li>
        ))}
      </ul>
    </CenteredCard>
  );
}
