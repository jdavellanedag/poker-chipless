import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, CreateAckResponse, JoinAckResponse } from '@poker-chipless/types';
import { createSession } from '../session/create.js';
import { joinSession } from '../session/join.js';
import { getSession, setSession } from '../session/store.js';
import { maybeScheduleAutoFold, handleDisconnect } from '../session/disconnect.js';
import { appendLog } from '../game/state.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSessionHandlers(io: IO, socket: Sock): void {
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
    setSession(state.code, { state, tokenMap });
    socket.join(state.code);
    socket.data.code = state.code;
    socket.data.playerId = hostId;
    io.to(state.code).emit('game:state', state);
    ack({ ok: true, code: state.code, token, playerId: hostId } as CreateAckResponse);
  });

  socket.on('session:join', ({ code, displayName, token }, ack) => {
    const session = getSession(code.toUpperCase());
    if (!session) {
      ack({ ok: false, error: 'Session not found. Check the code and try again.' });
      return;
    }

    if (token && session.tokenMap.has(token)) {
      const playerId = session.tokenMap.get(token)!;
      const player = session.state.players.find((p) => p.id === playerId);
      if (player) {
        let restoredState = {
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
        maybeScheduleAutoFold(code.toUpperCase(), io);
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

  socket.on('disconnect', () => {
    handleDisconnect(socket, io);
  });
}
