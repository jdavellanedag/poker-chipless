import { useState, useEffect } from 'react';
import type { GameState } from '@poker-chipless/types';
import socket from './socket.js';

type Screen = 'home' | 'join' | 'lobby';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [error, setError] = useState('');
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    socket.connect();

    socket.on('game:state', (state) => {
      setGameState(state);
      setScreen('lobby');
    });

    // attempt reconnection from sessionStorage
    const savedCode = sessionStorage.getItem('session_code');
    const savedToken = sessionStorage.getItem('session_token');
    const savedName = sessionStorage.getItem('display_name');
    if (savedCode && savedToken && savedName) {
      socket.emit('session:join', { code: savedCode, displayName: savedName, token: savedToken }, (res: { ok: boolean }) => {
        if (!res.ok) {
          sessionStorage.clear();
        }
      });
    }

    return () => {
      socket.off('game:state');
    };
  }, []);

  function handleCreate() {
    const name = createName.trim();
    if (!name) {
      setError('Display name cannot be empty.');
      return;
    }
    setError('');
    setLoading(true);
    socket.emit('session:create', { displayName: name }, (res) => {
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      sessionStorage.setItem('session_code', res.code);
      sessionStorage.setItem('session_token', res.token);
      sessionStorage.setItem('display_name', name);
      setSessionCode(res.code);
    });
  }

  function handleJoin() {
    const name = joinName.trim();
    const code = joinCode.trim().toUpperCase();
    if (!name) {
      setError('Display name cannot be empty.');
      return;
    }
    if (code.length !== 6) {
      setError('Session code must be 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    socket.emit('session:join', { code, displayName: name }, (res) => {
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      sessionStorage.setItem('session_code', code);
      sessionStorage.setItem('session_token', res.token);
      sessionStorage.setItem('display_name', name);
    });
  }

  if (screen === 'lobby' && gameState) {
    return <LobbyScreen state={gameState} sessionCode={gameState.code} />;
  }

  if (screen === 'join') {
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
          onClick={handleJoin}
          disabled={loading}
        >
          {loading ? 'Joining…' : 'Join'}
        </button>
        <button
          className="w-full mt-2 text-slate-400 hover:text-white text-sm py-1"
          onClick={() => { setScreen('home'); setError(''); }}
        >
          Back
        </button>
      </CenteredCard>
    );
  }

  // home screen — shows "Create Game" and, after creation, the session code
  return (
    <CenteredCard>
      <h1 className="text-3xl font-bold text-white mb-2">Poker Chipless</h1>
      <p className="text-slate-400 text-sm mb-8">No chips needed. Run the game from your phone.</p>

      {sessionCode ? (
        <div className="text-center mb-6">
          <p className="text-slate-400 text-sm mb-1">Share this code with your players</p>
          <p className="text-4xl font-mono font-bold text-emerald-400 tracking-widest">{sessionCode}</p>
          <p className="text-slate-500 text-xs mt-2">Waiting for players to join…</p>
        </div>
      ) : (
        <>
          <input
            className="w-full bg-slate-700 text-white rounded px-3 py-2 mb-4 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Your display name (host)"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded mb-3 disabled:opacity-50"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create Game'}
          </button>
          <button
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded"
            onClick={() => { setScreen('join'); setError(''); }}
          >
            Join Game
          </button>
        </>
      )}
    </CenteredCard>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}

function LobbyScreen({ state, sessionCode }: { state: GameState; sessionCode: string }) {
  const connected = state.players.filter((p) => p.isConnected);
  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-8 pt-8">
          <p className="text-slate-400 text-sm mb-1">Session code</p>
          <p className="text-3xl font-mono font-bold text-emerald-400 tracking-widest">{sessionCode}</p>
        </div>
        <h2 className="text-white font-semibold mb-3">Players ({connected.length})</h2>
        <ul className="space-y-2">
          {state.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3"
            >
              <span className={p.isConnected ? 'text-white' : 'text-slate-500'}>
                {p.displayName}
              </span>
              <span className="flex gap-2">
                {p.isHost && (
                  <span className="text-xs bg-emerald-700 text-emerald-200 px-2 py-0.5 rounded-full">
                    host
                  </span>
                )}
                {!p.isConnected && (
                  <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                    disconnected
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
