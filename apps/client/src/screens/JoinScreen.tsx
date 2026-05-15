import { CenteredCard } from '../components/CenteredCard.js';

interface JoinScreenProps {
  joinCode: string;
  setJoinCode: (v: string) => void;
  joinName: string;
  setJoinName: (v: string) => void;
  error: string;
  loading: boolean;
  onJoin: () => void;
  onBack: () => void;
}

export function JoinScreen({ joinCode, setJoinCode, joinName, setJoinName, error, loading, onJoin, onBack }: JoinScreenProps) {
  return (
    <CenteredCard>
      <h1 className="text-2xl font-bold text-white mb-6">Join Game</h1>
      <input
        className="w-full bg-slate-700 text-white rounded px-3 py-2 mb-3 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase tracking-widest"
        placeholder="Session code"
        maxLength={6}
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
      />
      <input
        className="w-full bg-slate-700 text-white rounded px-3 py-2 mb-4 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder="Your display name"
        value={joinName}
        onChange={(e) => setJoinName(e.target.value)}
      />
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <button
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded disabled:opacity-50"
        onClick={onJoin}
        disabled={loading}
      >
        {loading ? 'Joining…' : 'Join'}
      </button>
      <button
        className="w-full mt-2 text-slate-400 hover:text-white text-sm py-1"
        onClick={onBack}
      >
        Back
      </button>
    </CenteredCard>
  );
}
