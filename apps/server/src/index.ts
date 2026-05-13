import { createServer } from 'http';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import express from 'express';
import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, GameState, CreateAckResponse, JoinAckResponse } from '@poker-chipless/types';
import { createSession, joinSession } from './session.js';
import { startGame, reorderPlayers, newHand, fold, check, call, bet, raise, allin, advanceRound, declareWinner } from './game.js';

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

// session code → { state, tokenMap: Map<token, playerId> }
const sessions = new Map<string, { state: GameState; tokenMap: Map<string, string> }>();

io.on('connection', (socket) => {
  socket.on('session:create', ({ displayName }, ack) => {
    const name = displayName.trim();
    if (!name) {
      ack({ ok: false, error: 'Display name cannot be empty.' });
      return;
    }
    const { state, token } = createSession(name);
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
        session.state = {
          ...session.state,
          players: session.state.players.map((p) =>
            p.id === playerId ? { ...p, isConnected: true } : p,
          ),
        };
        socket.join(code.toUpperCase());
        socket.data.code = code.toUpperCase();
        socket.data.playerId = playerId;
        io.to(code.toUpperCase()).emit('game:state', session.state);
        ack({ ok: true, token, playerId } as JoinAckResponse);
        return;
      }
    }

    const result = joinSession(session.state, { displayName });
    if (!result.ok) {
      ack({ ok: false, error: result.error });
      return;
    }
    session.state = result.state;
    const newPlayer = result.state.players[result.state.players.length - 1];
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
      session.state = { ...session.state, phase: 'ended' };
      io.to(code!).emit('game:state', session.state);
      ack({ ok: true });
      return;
    }
    const result = newHand(session.state);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
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
    ack({ ok: true });
  });

  socket.on('disconnect', () => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    if (!code || !playerId) return;
    const session = sessions.get(code);
    if (!session) return;
    session.state = {
      ...session.state,
      players: session.state.players.map((p) =>
        p.id === playerId ? { ...p, isConnected: false } : p,
      ),
    };
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
