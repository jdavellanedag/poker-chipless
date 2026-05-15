import { useEffect, useRef } from 'react';
import type { LogEntry } from '@poker-chipless/types';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function ActionLog({ entries }: { entries: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div
      data-testid="action-log"
      className="mt-4 bg-slate-800 rounded-xl overflow-hidden"
    >
      <p className="text-slate-400 text-xs uppercase tracking-wide px-4 pt-3 pb-1">Game Log</p>
      <div className="h-40 overflow-y-auto px-4 pb-3 space-y-1">
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-2 text-sm">
            <span className="text-slate-500 font-mono shrink-0">{formatTimestamp(entry.timestamp)}</span>
            <span className="text-slate-300">{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
