import { CenteredCard } from '../components/CenteredCard.js';

interface HomeScreenProps {
  createName: string;
  setCreateName: (v: string) => void;
  error: string;
  loading: boolean;
  onCreate: () => void;
  onGoJoin: () => void;
}

export function HomeScreen({ createName, setCreateName, error, loading, onCreate, onGoJoin }: HomeScreenProps) {
  return (
    <CenteredCard>
      <h1 className="text-3xl font-bold text-white mb-2">Poker Chipless</h1>
      <p className="text-slate-400 text-sm mb-8">No chips needed. Run the game from your phone.</p>
      <input
        className="w-full bg-slate-700 text-white rounded px-3 py-2 mb-4 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder="Your display name (host)"
        value={createName}
        onChange={(e) => setCreateName(e.target.value)}
      />
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <button
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded mb-3 disabled:opacity-50"
        onClick={onCreate}
        disabled={loading}
      >
        {loading ? 'Creating…' : 'Create Game'}
      </button>
      <button
        className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded"
        onClick={onGoJoin}
      >
        Join Game
      </button>
    </CenteredCard>
  );
}
