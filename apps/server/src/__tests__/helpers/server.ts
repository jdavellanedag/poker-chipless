import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@poker-chipless/types';
import { registerSessionHandlers } from '../../handlers/session.js';
import { registerGameHandlers } from '../../handlers/game.js';
import { registerHostHandlers } from '../../handlers/host.js';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let httpServer: ReturnType<typeof createServer>;
let serverIo: Server<ClientToServerEvents, ServerToClientEvents>;
let port: number;

export async function startServer(): Promise<void> {
  return new Promise<void>((resolve) => {
    httpServer = createServer();
    serverIo = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      cors: { origin: '*' },
    });
    serverIo.on('connection', (socket) => {
      registerSessionHandlers(serverIo, socket);
      registerGameHandlers(serverIo, socket);
      registerHostHandlers(serverIo, socket);
    });
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });
}

export async function stopServer(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    serverIo.close();
    httpServer.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function createClient(): TypedSocket {
  return ioClient(`http://localhost:${port}`) as TypedSocket;
}
