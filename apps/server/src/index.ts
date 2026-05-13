import { createServer } from 'http';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import express from 'express';
import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, GameState, CreateAckResponse, JoinAckResponse } from '@poker-chipless/types';
import { createSession, joinSession } from './session.js';
import { appendLog, startGame, reorderPlayers, newHand, fold, check, call, bet, raise, allin, advanceRound, declareWinner, pause, resume, rebuy, autoFold } from './game.js';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientBuildPath = join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));
app.get('/*path', (_req, res) => {
  res.sendFile(join(clientBuildPath, 'index.html'));
});

const DISCONNECT_TIMEOUT_MS = parseInt(process.env.DISCONNECT_TIMEOUT_MS ?? '10000', 10);

type SessionRecord = {
  state: GameState;
  tokenMap: Map<string, string>;
  previousPhase?: GameState['phase'];
  autoFoldTimer?: ReturnType<typeof setTimeout>;
};

// session code → SessionRecord
const sessions = new Map<string, SessionRecord>();

function maybeScheduleAutoFold(code: string) {
  const session = sessions.get(code);
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
      const s = sessions.get(code);
      if (!s) return;
      const result = autoFold(s.state, playerId);
      if (result.ok) {
        s.state = result.state;
        io.to(code).emit('game:state', s.state);
        maybeScheduleAutoFold(code);
      }
    }, DISCONNECT_TIMEOUT_MS);
  }
}

io.on('connection', (socket) => {
  socket.on('session:create', ({ displayName }, ack) => {
    const name = displayName.trim();
    if (!name) {
      ack({ ok: false, error: 'Display name cannot be empty.' });
      return;
    }
    const { state: rawState, token } = createSession(name);
    const state = appendLog(rawState, `${name} created the session`);
    const tokenMap = new Map<string, string>();
    const hostId = state.players[0].id;
    tokenMap.set(token, hostId);
    sessions.set(state.code, { state, tokenMap });
    socket.join(state.code);
    socket.data.code = state.code;
    socket.data.playerId = hostId;
    io.to(state.code).emit('game:state', state);
    ack({ ok: true, code: state.code, token, playerId: hostId } as CreateAckResponse);
  });

  socket.on('session:join', ({ code, displayName, token }, ack) => {
    const session = sessions.get(code.toUpperCase());
    if (!session) {
      ack({ ok: false, error: 'Session not found. Check the code and try again.' });
      return;
    }

    // reconnection
    if (token && session.tokenMap.has(token)) {
      const playerId = session.tokenMap.get(token)!;
      const player = session.state.players.find((p) => p.id === playerId);
      if (player) {
        let restoredState: GameState = {
          ...session.state,
          players: session.state.players.map((p) =>
            p.id === playerId ? { ...p, isConnected: true } : p,
          ),
        };
        if (player.isHost && session.state.phase === 'paused' && session.previousPhase !== undefined) {
          restoredState = { ...restoredState, phase: session.previousPhase };
          session.previousPhase = undefined;
        }
        session.state = appendLog(restoredState, `${player.displayName} reconnected`);
        socket.join(code.toUpperCase());
        socket.data.code = code.toUpperCase();
        socket.data.playerId = playerId;
        io.to(code.toUpperCase()).emit('game:state', session.state);
        maybeScheduleAutoFold(code.toUpperCase());
        ack({ ok: true, token, playerId } as JoinAckResponse);
        return;
      }
    }

    const result = joinSession(session.state, { displayName });
    if (!result.ok) {
      ack({ ok: false, error: result.error });
      return;
    }
    const newPlayer = result.state.players[result.state.players.length - 1];
    session.state = appendLog(result.state, `${newPlayer.displayName} joined the session`);
    session.tokenMap.set(result.token, newPlayer.id);
    socket.join(code.toUpperCase());
    socket.data.code = code.toUpperCase();
    socket.data.playerId = newPlayer.id;
    io.to(code.toUpperCase()).emit('game:state', session.state);
    ack({ ok: true, token: result.token, playerId: newPlayer.id } as JoinAckResponse);
  });

  socket.on('host:reorder-players', ({ orderedPlayerIds }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
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
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can start the game.' }); return; }
    const result = startGame(session.state, { startingStack, smallBlind, bigBlind });
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    const handResult = newHand(result.state);
    if (!handResult.ok) { ack({ ok: false, error: handResult.error }); return; }
    session.state = handResult.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!);
    ack({ ok: true });
  });

  socket.on('host:new-hand', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can start a new hand.' }); return; }
    const activePlayers = session.state.players.filter((p) => !p.isEliminated);
    if (activePlayers.length < 2) {
      session.state = appendLog({ ...session.state, phase: 'ended' }, 'Game ended');
      io.to(code!).emit('game:state', session.state);
      ack({ ok: true });
      return;
    }
    session.state = { ...session.state, phase: 'active' };
    const result = newHand(session.state);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!);
    ack({ ok: true });
  });

  socket.on('host:advance-round', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can advance the round.' }); return; }
    const result = advanceRound(session.state);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!);
    ack({ ok: true });
  });

  socket.on('host:declare-winner', ({ playerId: winnerId }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can declare a winner.' }); return; }
    const result = declareWinner(session.state, winnerId);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });

  socket.on('action:fold', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = fold(session.state, playerId ?? '');
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!);
    ack({ ok: true });
  });

  socket.on('action:check', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = check(session.state, playerId ?? '');
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!);
    ack({ ok: true });
  });

  socket.on('action:call', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = call(session.state, playerId ?? '');
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!);
    ack({ ok: true });
  });

  socket.on('action:bet', ({ amount }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = bet(session.state, playerId ?? '', amount);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!);
    ack({ ok: true });
  });

  socket.on('action:raise', ({ amount }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = raise(session.state, playerId ?? '', amount);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!);
    ack({ ok: true });
  });

  socket.on('action:allin', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = allin(session.state, playerId ?? '');
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!);
    ack({ ok: true });
  });

  socket.on('host:pause', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can pause the game.' }); return; }
    const result = pause(session.state);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    maybeScheduleAutoFold(code!);
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });

  socket.on('host:resume', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can resume the game.' }); return; }
    const result = resume(session.state);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });

  socket.on('host:rebuy', ({ playerId: targetId, amount }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? sessions.get(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const player = session.state.players.find((p) => p.id === playerId);
    if (!player?.isHost) { ack({ ok: false, error: 'Only the host can issue a rebuy.' }); return; }
    const result = rebuy(session.state, targetId, amount);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    ack({ ok: true });
  });

  socket.on('disconnect', () => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    if (!code || !playerId) return;
    const session = sessions.get(code);
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
      maybeScheduleAutoFold(code);
    }

    io.to(code).emit('game:state', session.state);
  });
});

function getLocalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const PORT = 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log(`Serving on http://${ip}:${PORT}`);
});
