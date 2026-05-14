import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, GameState } from '@poker-chipless/types';
import { getSession } from './store.js';
import { appendLog } from '../game/state.js';
import { autoFold } from '../game/player-actions.js';

const DISCONNECT_TIMEOUT_MS = parseInt(process.env.DISCONNECT_TIMEOUT_MS ?? '10000', 10);

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function maybeScheduleAutoFold(code: string, io: IoServer): void {
  const session = getSession(code);
  if (!session) return;
  const { state } = session;
  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer || activePlayer.isConnected || state.phase !== 'active') {
    if (session.autoFoldTimer !== undefined) {
      clearTimeout(session.autoFoldTimer);
      session.autoFoldTimer = undefined;
    }
    return;
  }
  if (session.autoFoldTimer === undefined) {
    const playerId = activePlayer.id;
    session.autoFoldTimer = setTimeout(() => {
      session.autoFoldTimer = undefined;
      const s = getSession(code);
      if (!s) return;
      const result = autoFold(s.state, playerId);
      if (result.ok) {
        s.state = result.state;
        io.to(code).emit('game:state', s.state);
        maybeScheduleAutoFold(code, io);
      }
    }, DISCONNECT_TIMEOUT_MS);
  }
}

export function handleDisconnect(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: IoServer,
): void {
  const { code, playerId } = socket.data as { code?: string; playerId?: string };
  if (!code || !playerId) return;
  const session = getSession(code);
  if (!session) return;
  const player = session.state.players.find((p) => p.id === playerId);

  const disconnectedState: GameState = {
    ...session.state,
    players: session.state.players.map((p) =>
      p.id === playerId ? { ...p, isConnected: false } : p,
    ),
  };

  if (player?.isHost && (session.state.phase === 'active' || session.state.phase === 'showdown')) {
    session.previousPhase = session.state.phase;
    session.state = appendLog(
      { ...disconnectedState, phase: 'paused' },
      `${player.displayName} disconnected`,
    );
    if (session.autoFoldTimer !== undefined) {
      clearTimeout(session.autoFoldTimer);
      session.autoFoldTimer = undefined;
    }
  } else {
    session.state = appendLog(
      disconnectedState,
      player ? `${player.displayName} disconnected` : 'A player disconnected',
    );
    maybeScheduleAutoFold(code, io);
  }

  io.to(code).emit('game:state', session.state);
}
