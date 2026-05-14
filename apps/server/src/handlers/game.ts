import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@poker-chipless/types';
import { getSession } from '../session/store.js';
import { maybeScheduleAutoFold } from '../session/disconnect.js';
import { fold, check, call, bet, raise, allin } from '../game/player-actions.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerGameHandlers(io: IO, socket: Sock): void {
  socket.on('action:fold', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = fold(session.state, playerId ?? '');
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!, io);
    ack({ ok: true });
  });

  socket.on('action:check', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = check(session.state, playerId ?? '');
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!, io);
    ack({ ok: true });
  });

  socket.on('action:call', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = call(session.state, playerId ?? '');
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!, io);
    ack({ ok: true });
  });

  socket.on('action:bet', ({ amount }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = bet(session.state, playerId ?? '', amount);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!, io);
    ack({ ok: true });
  });

  socket.on('action:raise', ({ amount }, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = raise(session.state, playerId ?? '', amount);
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!, io);
    ack({ ok: true });
  });

  socket.on('action:allin', (_payload, ack) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const session = code ? getSession(code) : undefined;
    if (!session) { ack({ ok: false, error: 'Session not found.' }); return; }
    const result = allin(session.state, playerId ?? '');
    if (!result.ok) { ack({ ok: false, error: result.error }); return; }
    session.state = result.state;
    io.to(code!).emit('game:state', session.state);
    maybeScheduleAutoFold(code!, io);
    ack({ ok: true });
  });
}
