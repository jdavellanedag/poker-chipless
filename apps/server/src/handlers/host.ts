import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@poker-chipless/types';
import { getSession } from '../session/store.js';
import { maybeScheduleAutoFold } from '../session/disconnect.js';
import { appendLog } from '../game/state.js';
import { startGame, newHand, declareWinner, rebuy, pause, resume, reorderPlayers, endGame } from '../game/host-actions.js';
import { advanceRound } from '../game/round.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerHostHandlers(io: IO, socket: Sock): void {
  socket.on('host:reorder-players', ({ orderedPlayerIds }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can reorder players.' }); return; }
    const result = reorderPlayers(session.state, orderedPlayerIds);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });

  socket.on('host:start-game', ({ startingStack, smallBlind, bigBlind }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can start the game.' }); return; }
    const result = startGame(session.state, { startingStack, smallBlind, bigBlind });
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    const handResult = newHand(result.state);
    if (!handResult.ok) { ack({ ok: false, error: handResult.error }); return; }
    session.state = handResult.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!, io);
    ack({ ok: true });
  });

  socket.on('host:new-hand', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can start a new hand.' }); return; }
    const activePlayers = session.state.players.filter((p) => !p.isEliminated);
    if (activePlayers.length < 2) {
      const endResult = endGame(session.state);
      session.state = endResult.ok ? endResult.state : appendLog({ ...session.state, phase: 'ended' }, 'Game over');
      io.to(code!).emit('game:state', session.state);
      ack({ ok: true });
      return;
    }
    session.state = { ...session.state, phase: 'active' };
    const result = newHand(session.state);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!, io);
    ack({ ok: true });
  });

  socket.on('host:advance-round', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can advance the round.' }); return; }
    const result = advanceRound(session.state);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!, io);
    ack({ ok: true });
  });

  socket.on('host:declare-winner', ({ playerId: winnerId }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can declare a winner.' }); return; }
    const result = declareWinner(session.state, winnerId);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });

  socket.on('host:rebuy', ({ playerId: targetId, amount }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can issue a rebuy.' }); return; }
    const result = rebuy(session.state, targetId, amount);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });

  socket.on('host:pause', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can pause the game.' }); return; }
    const result = pause(session.state);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    maybeScheduleAutoFold(code!, io);
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });

  socket.on('host:resume', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can resume the game.' }); return; }
    const result = resume(session.state);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });

  socket.on('host:end-session', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can end the session.' }); return; }
    const endResult = endGame(session.state);
    session.state = endResult.ok ? endResult.state : appendLog({ ...session.state, phase: 'ended' }, 'Session ended');
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });
}
