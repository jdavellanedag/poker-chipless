import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@poker-chipless/types';

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
});

export default socket;
