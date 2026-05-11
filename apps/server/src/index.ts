import { createServer } from 'http';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import express from 'express';
import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, GameState, CreateAckResponse, JoinAckResponse } from '@poker-chipless/types';
import { createSession, joinSession } from './session.js';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientBuildPath = join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));
app.get('*', (_req, res) => {
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
    tokenMap.set(token, state.players[0].id);
    sessions.set(state.code, { state, tokenMap });
    socket.join(state.code);
    socket.data.code = state.code;
    socket.data.playerId = state.players[0].id;
    io.to(state.code).emit('game:state', state);
    ack({ ok: true, code: state.code, token } as CreateAckResponse);
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
        ack({ ok: true, token } as JoinAckResponse);
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
    ack({ ok: true, token: result.token } as JoinAckResponse);
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
