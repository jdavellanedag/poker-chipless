import { useState } from 'react';
import type { GameState } from '@poker-chipless/types';
import { ActionLog } from '../components/ActionLog.js';
import { HostPanel } from '../components/HostPanel.js';
import { PlayerList } from '../components/PlayerList.js';
import { ActionButtons } from '../components/ActionButtons.js';

interface GameScreenProps {
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
}

export function GameScreen({
  state, myPlayerId,
  onNewHand, onAdvanceRound, onDeclareWinner,
  onFold, onCheck, onCall, onBet, onRaise, onAllin,
  onPause, onResume, onRebuy,
}: GameScreenProps) {
  const me = state.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const isMyTurn = state.players[state.activePlayerIndex]?.id === myPlayerId;
  const isPaused = state.phase === 'paused';
  const [hostPanelOpen, setHostPanelOpen] = useState(false);

  const hostPlayer = state.players.find((p) => p.isHost);
  const hostDisconnected = hostPlayer ? !hostPlayer.isConnected : false;

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
  const sbIdx = hasHand ? (activePlayers.length === 2 ? state.dealerButtonIndex : nonElim(state.dealerButtonIndex)) : -1;
  const bbIdx = hasHand ? nonElim(sbIdx) : -1;

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

        {/* Top: pot + round label */}
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
            <PlayerList
              mode="game"
              players={state.players}
              myPlayerId={myPlayerId}
              activePlayerIndex={state.activePlayerIndex}
              dealerButtonIndex={state.dealerButtonIndex}
              sbIdx={sbIdx}
              bbIdx={bbIdx}
            />
          </div>
        </div>

        {/* Bottom: action buttons + host toggle + action log */}
        <div className="shrink-0 px-4 pb-4">
          <div className="max-w-sm mx-auto">
            {me && (
              <ActionButtons
                me={me}
                currentBet={state.currentBet}
                bigBlind={state.bigBlind}
                lastRaiseSize={state.lastRaiseSize}
                activePlayerIndex={state.activePlayerIndex}
                phase={state.phase}
                roundComplete={state.roundComplete}
                isPaused={isPaused}
                isMyTurn={isMyTurn}
                onFold={onFold}
                onCheck={onCheck}
                onCall={onCall}
                onBet={onBet}
                onRaise={onRaise}
                onAllin={onAllin}
              />
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

      {/* Host panel — mobile: full-screen overlay; desktop: fixed right sidebar */}
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
            phase={state.phase}
            round={state.round}
            pot={state.pot}
            roundComplete={state.roundComplete}
            startingStack={state.startingStack}
            players={state.players}
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
