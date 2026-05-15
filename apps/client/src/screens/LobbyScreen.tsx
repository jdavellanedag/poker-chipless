import { useState } from 'react';
import type { GameState } from '@poker-chipless/types';
import { ActionLog } from '../components/ActionLog.js';
import { PlayerList } from '../components/PlayerList.js';

interface LobbyScreenProps {
  state: GameState;
  myPlayerId: string;
  onStartGame: (stack: number, sb: number, bb: number, onResult: (err?: string) => void) => void;
  onReorder: (ids: string[]) => void;
}

export function LobbyScreen({ state, myPlayerId, onStartGame, onReorder }: LobbyScreenProps) {
  const [stack, setStack] = useState('1000');
  const [smallBlind, setSmallBlind] = useState('10');
  const [bigBlind, setBigBlind] = useState('20');
  const [formError, setFormError] = useState('');

  const me = state.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const connected = state.players.filter((p) => p.isConnected);

  function moveUp(index: number) {
    if (index === 0) return;
    const order = state.players.map((p) => p.id);
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    onReorder(order);
  }

  function moveDown(index: number) {
    if (index === state.players.length - 1) return;
    const order = state.players.map((p) => p.id);
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
    onReorder(order);
  }

  function handleStart() {
    const s = parseInt(stack, 10);
    const sb = parseInt(smallBlind, 10);
    const bb = parseInt(bigBlind, 10);
    if (!s || s <= 0 || !sb || sb <= 0 || !bb || bb <= 0) {
      setFormError('All values must be positive integers.');
      return;
    }
    setFormError('');
    onStartGame(s, sb, bb, (err) => { if (err) setFormError(err); });
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-8 pt-8">
          <p className="text-slate-400 text-sm mb-1">Session code</p>
          <p className="text-3xl font-mono font-bold text-emerald-400 tracking-widest">{state.code}</p>
        </div>

        <h2 className="text-white font-semibold mb-3">Players ({connected.length})</h2>
        <PlayerList
          mode="lobby"
          players={state.players}
          isHost={isHost}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
        />

        {isHost ? (
          <div className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-semibold mb-1">Game Settings</h3>
            <div>
              <label className="text-slate-400 text-sm block mb-1" htmlFor="starting-stack">
                Starting stack
              </label>
              <input
                id="starting-stack"
                type="number"
                min={1}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={stack}
                onChange={(e) => setStack(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-slate-400 text-sm block mb-1" htmlFor="small-blind">
                  Small blind
                </label>
                <input
                  id="small-blind"
                  type="number"
                  min={1}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={smallBlind}
                  onChange={(e) => setSmallBlind(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-slate-400 text-sm block mb-1" htmlFor="big-blind">
                  Big blind
                </label>
                <input
                  id="big-blind"
                  type="number"
                  min={1}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={bigBlind}
                  onChange={(e) => setBigBlind(e.target.value)}
                />
              </div>
            </div>
            {formError && <p className="text-red-400 text-sm">{formError}</p>}
            <button
              onClick={handleStart}
              disabled={state.players.length < 2}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed mt-1"
            >
              Start Game
            </button>
          </div>
        ) : (
          <p className="text-center text-slate-400 mt-4">Waiting for host to start…</p>
        )}

        <ActionLog entries={state.log} />
      </div>
    </div>
  );
}
