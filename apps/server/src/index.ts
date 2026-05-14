import { createServer } from 'http';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import express from 'express';
import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@poker-chipless/types';
import { registerSessionHandlers } from './handlers/session.js';
import { registerGameHandlers } from './handlers/game.js';
import { registerHostHandlers } from './handlers/host.js';

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

io.on('connection', (socket) => {
  registerSessionHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerHostHandlers(io, socket);
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
