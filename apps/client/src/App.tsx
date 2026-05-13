import { useState, useEffect, useRef } from 'react';
import type { GameState, LogEntry } from '@poker-chipless/types';
import socket from './socket.js';

export default function App() {
  const [screen, setScreen] = useState<'home' | 'join'>('home');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [error, setError] = useState('');
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    socket.connect();
    socket.on('game:state', (state) => setGameState(state));

    const savedCode = sessionStorage.getItem('session_code');
    const savedToken = sessionStorage.getItem('session_token');
    const savedName = sessionStorage.getItem('display_name');
    const savedPlayerId = sessionStorage.getItem('player_id');
    if (savedCode && savedToken && savedName && savedPlayerId) {
      setMyPlayerId(savedPlayerId);
      socket.emit('session:join', { code: savedCode, displayName: savedName, token: savedToken }, (res) => {
        if (!res.ok) {
          sessionStorage.clear();
          setMyPlayerId('');
        }
      });
    }

    return () => { socket.off('game:state'); };
  }, []);

  function handleCreate() {
    const name = createName.trim();
    if (!name) { setError('Display name cannot be empty.'); return; }
    setError('');
    setLoading(true);
    socket.emit('session:create', { displayName: name }, (res) => {
      setLoading(false);
      if (!res.ok) { setError(res.error); return; }
      sessionStorage.setItem('session_code', res.code);
      sessionStorage.setItem('session_token', res.token);
      sessionStorage.setItem('display_name', name);
      sessionStorage.setItem('player_id', res.playerId);
      setMyPlayerId(res.playerId);
    });
  }

  function handleJoin() {
    const name = joinName.trim();
    const code = joinCode.trim().toUpperCase();
    if (!name) { setError('Display name cannot be empty.'); return; }
    if (code.length !== 6) { setError('Session code must be 6 characters.'); return; }
    setError('');
    setLoading(true);
    socket.emit('session:join', { code, displayName: name }, (res) => {
      setLoading(false);
      if (!res.ok) { setError(res.error); return; }
      sessionStorage.setItem('session_code', code);
      sessionStorage.setItem('session_token', res.token);
      sessionStorage.setItem('display_name', name);
      sessionStorage.setItem('player_id', res.playerId);
      setMyPlayerId(res.playerId);
    });
  }

  function handleStartGame(startingStack: number, smallBlind: number, bigBlind: number, onResult: (err?: string) => void) {
    socket.emit('host:start-game', { startingStack, smallBlind, bigBlind }, (res) => {
      onResult(res.ok ? undefined : res.error);
    });
  }

  function handleReorder(orderedPlayerIds: string[]) {
    socket.emit('host:reorder-players', { orderedPlayerIds }, () => {});
  }

  function handleNewHand() {
    socket.emit('host:new-hand', {}, () => {});
  }

  function handleAdvanceRound() {
    socket.emit('host:advance-round', {}, () => {});
  }

  function handleDeclareWinner(winnerId: string) {
    socket.emit('host:declare-winner', { playerId: winnerId }, () => {});
  }

  function handleFold() {
    socket.emit('action:fold', {}, () => {});
  }

  function handleCheck() {
    socket.emit('action:check', {}, () => {});
  }

  function handleCall() {
    socket.emit('action:call', {}, () => {});
  }

  function handleBet(amount: number) {
    socket.emit('action:bet', { amount }, () => {});
  }

  function handleRaise(amount: number) {
    socket.emit('action:raise', { amount }, () => {});
  }

  function handleAllin() {
    socket.emit('action:allin', {}, () => {});
  }

  function handlePause() {
    socket.emit('host:pause', {}, () => {});
  }

  function handleResume() {
    socket.emit('host:resume', {}, () => {});
  }

  function handleRebuy(playerId: string, amount: number) {
    socket.emit('host:rebuy', { playerId, amount }, () => {});
  }

  if (gameState) {
    if (gameState.phase === 'ended') {
      const lastLog = gameState.log[gameState.log.length - 1];
      return (
        <CenteredCard>
          <h1 className="text-2xl font-bold text-white mb-4">Game Over</h1>
          {lastLog && (
            <p className="text-slate-300 text-center mb-4">{lastLog.message}</p>
          )}
          <ul className="space-y-2">
            {gameState.players.filter((p) => !p.isEliminated).map((p) => (
              <li key={p.id} className="text-emerald-400 font-semibold text-lg text-center">
                {p.displayName} — {p.chipCount} chips
              </li>
            ))}
          </ul>
        </CenteredCard>
      );
    }
    if (gameState.phase === 'active' || gameState.phase === 'showdown' || gameState.phase === 'paused') {
      return (
        <GameScreen
          state={gameState}
          myPlayerId={myPlayerId}
          onNewHand={handleNewHand}
          onAdvanceRound={handleAdvanceRound}
          onDeclareWinner={handleDeclareWinner}
          onFold={handleFold}
          onCheck={handleCheck}
          onCall={handleCall}
          onBet={handleBet}
          onRaise={handleRaise}
          onAllin={handleAllin}
          onPause={handlePause}
          onResume={handleResume}
          onRebuy={handleRebuy}
        />
      );
    }
    return (
      <LobbyScreen
        state={gameState}
        myPlayerId={myPlayerId}
        onStartGame={handleStartGame}
        onReorder={handleReorder}
      />
    );
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

function LobbyScreen({
  state,
  myPlayerId,
  onStartGame,
  onReorder,
}: {
  state: GameState;
  myPlayerId: string;
  onStartGame: (stack: number, sb: number, bb: number, onResult: (err?: string) => void) => void;
  onReorder: (ids: string[]) => void;
}) {
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
        <ul className="space-y-2 mb-8">
          {state.players.map((p, i) => (
            <li
              key={p.id}
              data-testid={`player-row-${p.displayName}`}
              className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3"
            >
              <span className={p.isConnected ? 'text-white' : 'text-slate-500'}>
                {p.displayName}
              </span>
              <span className="flex items-center gap-2">
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
                {isHost && (
                  <span className="flex gap-0.5">
                    <button
                      data-testid={`move-up-${p.displayName}`}
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="text-slate-400 hover:text-white disabled:opacity-20 w-6 text-center"
                      aria-label={`Move ${p.displayName} up`}
                    >▲</button>
                    <button
                      data-testid={`move-down-${p.displayName}`}
                      onClick={() => moveDown(i)}
                      disabled={i === state.players.length - 1}
                      className="text-slate-400 hover:text-white disabled:opacity-20 w-6 text-center"
                      aria-label={`Move ${p.displayName} down`}
                    >▼</button>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

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

function GameScreen({
  state,
  myPlayerId,
  onNewHand,
  onAdvanceRound,
  onDeclareWinner,
  onFold,
  onCheck,
  onCall,
  onBet,
  onRaise,
  onAllin,
  onPause,
  onResume,
  onRebuy,
}: {
  state: GameState;
  myPlayerId: string;
  onNewHand: () => void;
  onAdvanceRound: () => void;
  onDeclareWinner: (playerId: string) => void;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onBet: (amount: number) => void;
  onRaise: (amount: number) => void;
  onAllin: () => void;
  onPause: () => void;
  onResume: () => void;
  onRebuy: (playerId: string, amount: number) => void;
}) {
  const me = state.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const isMyTurn = state.players[state.activePlayerIndex]?.id === myPlayerId;
  const callAmount = me ? Math.max(0, state.currentBet - me.currentBet) : 0;
  const canCheck = isMyTurn && state.currentBet === (me?.currentBet ?? 0);

  const minBetOrRaise = state.currentBet === 0
    ? state.bigBlind
    : state.currentBet + state.lastRaiseSize;
  const [betInput, setBetInput] = useState(String(minBetOrRaise));
  const [hostPanelOpen, setHostPanelOpen] = useState(false);
  const activePlayerRef = useRef<HTMLLIElement>(null);

  // Reset input to new minimum whenever the active player changes or minimum shifts
  useEffect(() => {
    setBetInput(String(minBetOrRaise));
  }, [state.activePlayerIndex, minBetOrRaise]);

  useEffect(() => {
    activePlayerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [state.activePlayerIndex]);

  const parsedBet = parseInt(betInput, 10);
  const betInputValid = !isNaN(parsedBet) && parsedBet > 0 && parsedBet === Math.floor(parsedBet);
  const canBet = isMyTurn && state.currentBet === 0 && betInputValid && parsedBet >= state.bigBlind && me !== undefined && parsedBet <= me.chipCount;
  const canRaise = isMyTurn && state.currentBet > 0 && betInputValid && parsedBet >= minBetOrRaise && me !== undefined && parsedBet <= (me.currentBet + me.chipCount);
  // Only show Call when the player can fully cover it; if they can't, All-In button covers it
  const canCall = !canCheck && me !== undefined && me.chipCount > callAmount;

  // Compute SB/BB indices for badge display (only valid once a hand has started)
  const hasHand = state.dealerButtonIndex >= 0;
  const nonElim = (from: number) => {
    const n = state.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (from + i) % n;
      if (!state.players[idx].isEliminated) return idx;
    }
    return from;
  };
  const activePlayers = state.players.filter((p) => !p.isEliminated);
  const sbIdx = hasHand
    ? (activePlayers.length === 2 ? state.dealerButtonIndex : nonElim(state.dealerButtonIndex))
    : -1;
  const bbIdx = hasHand ? nonElim(sbIdx) : -1;

  const isPaused = state.phase === 'paused';
  const hostPlayer = state.players.find((p) => p.isHost);
  const hostDisconnected = hostPlayer ? !hostPlayer.isConnected : false;

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Pause banner — first child so it compresses flex-1 rather than overflowing */}
      {!isHost && isPaused && (
        <div data-testid="pause-banner" className="shrink-0 bg-yellow-600 text-white text-center py-2 px-4 font-semibold text-sm">
          {hostDisconnected ? 'Waiting for host to reconnect…' : 'Game paused by host'}
        </div>
      )}

      {/* Content column — takes all remaining height, no overflow on itself */}
      <div className={`flex flex-col flex-1 overflow-hidden transition-opacity ${!isHost && isPaused ? 'opacity-50' : ''} ${isHost ? 'md:mr-72' : ''}`}>

        {/* Top: pot + round label — always visible */}
        <div className="shrink-0 px-4 pt-4">
          <div className="max-w-sm mx-auto">
            <div className="text-center mb-3">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Pot</p>
              <p data-testid="pot" className="text-3xl font-bold text-white">{state.pot}</p>
              <p data-testid="round-label" className="text-slate-500 text-xs mt-1 uppercase tracking-wide">{state.round}</p>
            </div>
          </div>
        </div>

        {/* Middle: scrollable player list */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="max-w-sm mx-auto">
            <ul className="space-y-2 py-2">
              {state.players.map((p, i) => {
                const isButton = i === state.dealerButtonIndex;
                const isActive = i === state.activePlayerIndex;
                const isSB = i === sbIdx;
                const isBB = i === bbIdx;
                return (
                  <li
                    key={p.id}
                    ref={isActive ? activePlayerRef : null}
                    data-testid={`player-row-${p.displayName}`}
                    className={`flex justify-between items-center rounded-lg px-4 py-3 ${isActive ? 'bg-slate-700 ring-1 ring-emerald-500' : 'bg-slate-800'}`}
                  >
                    <span className="flex items-center gap-2">
                      {isButton && (
                        <span className="text-xs bg-yellow-600 text-yellow-100 px-1.5 py-0.5 rounded-full font-mono">D</span>
                      )}
                      {isSB && (
                        <span data-testid={`badge-sb-${p.displayName}`} className="text-xs bg-blue-700 text-blue-100 px-1.5 py-0.5 rounded-full font-mono">SB</span>
                      )}
                      {isBB && (
                        <span data-testid={`badge-bb-${p.displayName}`} className="text-xs bg-violet-700 text-violet-100 px-1.5 py-0.5 rounded-full font-mono">BB</span>
                      )}
                      {p.isEliminated && (
                        <span data-testid={`badge-eliminated-${p.displayName}`} className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded-full font-mono">Eliminated</span>
                      )}
                      {!p.isConnected && (
                        <span
                          data-testid={`disconnected-indicator-${p.displayName}`}
                          className="w-2 h-2 rounded-full bg-slate-500 shrink-0"
                          aria-label="disconnected"
                        />
                      )}
                      <span className={p.id === myPlayerId ? 'text-emerald-400 font-semibold' : p.isFolded ? 'text-slate-600 line-through' : !p.isConnected ? 'text-slate-500' : 'text-white'}>
                        {p.displayName}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      {p.currentBet > 0 && (
                        <span className="text-yellow-400 font-mono text-sm">{p.currentBet}</span>
                      )}
                      <span data-testid={`chips-${p.displayName}`} className="text-slate-300 font-mono">{p.chipCount}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Bottom: action buttons + mobile host-controls toggle + action log — always visible */}
        <div className="shrink-0 px-4 pb-4">
          <div className="max-w-sm mx-auto">
            {isMyTurn && !state.roundComplete && state.phase !== 'showdown' && !isPaused && (
              <div data-testid="action-buttons" className="space-y-2 mb-4">
                <div className="flex gap-2">
                  <button
                    data-testid="btn-fold"
                    onClick={onFold}
                    className="flex-1 bg-red-700 hover:bg-red-600 text-white font-semibold py-3 rounded"
                  >
                    Fold
                  </button>
                  {canCheck && (
                    <button
                      data-testid="btn-check"
                      onClick={onCheck}
                      className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 rounded"
                    >
                      Check
                    </button>
                  )}
                  {canCall && (
                    <button
                      data-testid="btn-call"
                      onClick={onCall}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded"
                    >
                      Call {callAmount}
                    </button>
                  )}
                  <button
                    data-testid="btn-allin"
                    onClick={onAllin}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-3 rounded"
                  >
                    All-In ({me?.chipCount ?? 0})
                  </button>
                </div>
                {state.currentBet === 0 ? (
                  <div className="flex gap-2">
                    <input
                      data-testid="bet-input"
                      type="number"
                      min={state.bigBlind}
                      step={1}
                      value={betInput}
                      onChange={(e) => setBetInput(e.target.value)}
                      className="flex-1 bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      data-testid="btn-bet"
                      onClick={() => { if (canBet) onBet(parsedBet); }}
                      disabled={!canBet}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded disabled:opacity-40"
                    >
                      Bet {betInputValid ? parsedBet : ''}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      data-testid="raise-input"
                      type="number"
                      min={minBetOrRaise}
                      step={1}
                      value={betInput}
                      onChange={(e) => setBetInput(e.target.value)}
                      className="flex-1 bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      data-testid="btn-raise"
                      onClick={() => { if (canRaise) onRaise(parsedBet); }}
                      disabled={!canRaise}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded disabled:opacity-40"
                    >
                      Raise to {betInputValid ? parsedBet : ''}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isHost && !hostPanelOpen && (
              <button
                data-testid="host-panel-toggle"
                onClick={() => setHostPanelOpen(true)}
                className="md:hidden w-full bg-slate-700 text-slate-300 py-3 rounded-lg text-sm my-2"
              >
                ▲ Host Controls
              </button>
            )}

            <ActionLog entries={state.log} />
          </div>
        </div>
      </div>

      {/* Single panel instance — mobile: full-screen overlay; desktop: fixed right sidebar */}
      {isHost && (
        <aside
          data-testid="host-panel-sidebar"
          className={`fixed right-0 top-0 w-full md:w-72 h-screen bg-slate-800 border-l border-slate-700 overflow-y-auto flex-col p-4 z-50 ${hostPanelOpen ? 'flex' : 'hidden'} md:flex`}
        >
          <div className="flex items-center justify-between md:hidden mb-2">
            <span className="text-slate-300 text-sm font-semibold">Host Controls</span>
            <button
              data-testid="host-panel-close"
              onClick={() => setHostPanelOpen(false)}
              className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded"
              aria-label="Close host controls"
            >
              ✕
            </button>
          </div>
          <HostPanel
            state={state}
            onNewHand={onNewHand}
            onAdvanceRound={onAdvanceRound}
            onDeclareWinner={onDeclareWinner}
            onPause={onPause}
            onResume={onResume}
            onRebuy={onRebuy}
          />
        </aside>
      )}
    </div>
  );
}

function advanceRoundLabel(round: GameState['round']): string {
  if (round === 'preflop') return 'Deal Flop';
  if (round === 'flop') return 'Deal Turn';
  if (round === 'turn') return 'Deal River';
  return 'Go to Showdown';
}

function HostPanel({
  state,
  onNewHand,
  onAdvanceRound,
  onDeclareWinner,
  onPause,
  onResume,
  onRebuy,
}: {
  state: GameState;
  onNewHand: () => void;
  onAdvanceRound: () => void;
  onDeclareWinner: (playerId: string) => void;
  onPause: () => void;
  onResume: () => void;
  onRebuy: (playerId: string, amount: number) => void;
}) {
  const [rebuyPlayerId, setRebuyPlayerId] = useState(state.players[0]?.id ?? '');
  const [rebuyAmount, setRebuyAmount] = useState(String(state.startingStack));
  const parsedRebuyAmount = parseInt(rebuyAmount, 10);
  const rebuyValid = !isNaN(parsedRebuyAmount) && parsedRebuyAmount > 0 && rebuyPlayerId !== '' && state.pot === 0;

  return (
    <div className="mt-4 bg-slate-800 rounded-xl p-4 space-y-3">
      <p className="text-slate-400 text-xs uppercase tracking-wide">Host Controls</p>

      {state.pot === 0 && (
        <button
          data-testid="new-hand-btn"
          onClick={onNewHand}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded"
        >
          New Hand
        </button>
      )}

      {state.roundComplete && state.phase !== 'showdown' && state.pot > 0 && (
        <button
          data-testid="advance-round-btn"
          onClick={onAdvanceRound}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded"
        >
          {advanceRoundLabel(state.round)}
        </button>
      )}

      {state.phase === 'showdown' && state.pot > 0 && (
        <DeclareWinnerPanel state={state} onDeclareWinner={onDeclareWinner} />
      )}

      <div className="space-y-2">
        <p className="text-slate-500 text-xs uppercase tracking-wide">Rebuy</p>
        <select
          data-testid="rebuy-player-select"
          value={rebuyPlayerId}
          onChange={(e) => setRebuyPlayerId(e.target.value)}
          className="w-full bg-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {state.players.map((p) => (
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

      {state.phase === 'active' && (
        <button
          data-testid="pause-btn"
          onClick={onPause}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2 rounded"
        >
          Pause Game
        </button>
      )}

      {state.phase === 'paused' && (
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

function DeclareWinnerPanel({
  state,
  onDeclareWinner,
}: {
  state: GameState;
  onDeclareWinner: (playerId: string) => void;
}) {
  const eligible = state.players.filter((p) => !p.isEliminated && !p.isFolded);
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
          Accept — {winner.displayName} wins {state.pot}
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

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function ActionLog({ entries }: { entries: LogEntry[] }) {
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
