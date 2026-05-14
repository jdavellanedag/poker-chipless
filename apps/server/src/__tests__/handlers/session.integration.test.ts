import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { GameState, CreateAckResponse, JoinAckResponse } from '@poker-chipless/types';
import { startServer, stopServer, createClient } from '../helpers/server.js';
import type { TypedSocket } from '../helpers/server.js';
import { clearStore } from '../../session/store.js';

const clients: TypedSocket[] = [];

function tracked(s: TypedSocket): TypedSocket {
  clients.push(s);
  return s;
}

async function connect(s: TypedSocket): Promise<void> {
  if (s.connected) return;
  return new Promise<void>((resolve) => s.once('connect', resolve));
}

beforeAll(() => startServer());
afterAll(() => stopServer());

beforeEach(() => {
  clearStore();
});

afterEach(() => {
  for (const c of clients) {
    if (c.connected) c.disconnect();
  }
  clients.length = 0;
});

describe('session:create', () => {
  it('happy path returns ok ack with code/token/playerId and emits lobby game:state', async () => {
    const client = tracked(createClient());
    await connect(client);

    const statePromise = new Promise<GameState>((resolve) => {
      client.once('game:state', resolve);
    });

    const ack = await new Promise<CreateAckResponse>((resolve) => {
      client.emit('session:create', { displayName: 'Alice' }, resolve);
    });

    const state = await statePromise;

    expect(ack.ok).toBe(true);
    if (ack.ok) {
      expect(ack.code).toHaveLength(6);
      expect(typeof ack.token).toBe('string');
      expect(typeof ack.playerId).toBe('string');
    }

    expect(state.phase).toBe('lobby');
    expect(state.players).toHaveLength(1);
    expect(state.players[0].displayName).toBe('Alice');
  });

  it('empty display name returns ok:false and emits no game:state', async () => {
    const client = tracked(createClient());
    await connect(client);

    let stateReceived = false;
    client.once('game:state', () => { stateReceived = true; });

    const ack = await new Promise<CreateAckResponse>((resolve) => {
      client.emit('session:create', { displayName: '   ' }, resolve);
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(ack.ok).toBe(false);
    if (!ack.ok) {
      expect(typeof ack.error).toBe('string');
    }
    expect(stateReceived).toBe(false);
  });
});

describe('session:join', () => {
  it('new player: both clients receive game:state with two players', async () => {
    const host = tracked(createClient());
    const joiner = tracked(createClient());
    await connect(host);
    await connect(joiner);

    const createAck = await new Promise<CreateAckResponse>((resolve) => {
      host.emit('session:create', { displayName: 'Alice' }, resolve);
    });
    if (!createAck.ok) throw new Error('create failed');
    const { code } = createAck;

    const hostStatePromise = new Promise<GameState>((resolve) => {
      host.once('game:state', resolve);
    });
    const joinerStatePromise = new Promise<GameState>((resolve) => {
      joiner.once('game:state', resolve);
    });

    const joinAck = await new Promise<JoinAckResponse>((resolve) => {
      joiner.emit('session:join', { code, displayName: 'Bob' }, resolve);
    });

    const [hostState, joinerState] = await Promise.all([hostStatePromise, joinerStatePromise]);

    expect(joinAck.ok).toBe(true);
    expect(hostState.players).toHaveLength(2);
    expect(joinerState.players).toHaveLength(2);
    expect(joinerState.players.map((p) => p.displayName)).toContain('Bob');
  });

  it('valid reconnect token: isConnected becomes true after rejoin', async () => {
    const host = tracked(createClient());
    const joiner = tracked(createClient());
    await connect(host);
    await connect(joiner);

    const createAck = await new Promise<CreateAckResponse>((resolve) => {
      host.emit('session:create', { displayName: 'Alice' }, resolve);
    });
    if (!createAck.ok) throw new Error('create failed');

    const joinAck = await new Promise<JoinAckResponse>((resolve) => {
      joiner.emit('session:join', { code: createAck.code, displayName: 'Bob' }, resolve);
    });
    if (!joinAck.ok) throw new Error('join failed');
    const { token } = joinAck;

    joiner.disconnect();
    await new Promise<void>((resolve) => setTimeout(resolve, 30));

    const reconnector = tracked(createClient());
    await connect(reconnector);

    const statePromise = new Promise<GameState>((resolve) => {
      reconnector.once('game:state', resolve);
    });

    const reconnectAck = await new Promise<JoinAckResponse>((resolve) => {
      reconnector.emit('session:join', { code: createAck.code, displayName: 'Bob', token }, resolve);
    });

    const state = await statePromise;

    expect(reconnectAck.ok).toBe(true);
    const bob = state.players.find((p) => p.displayName === 'Bob');
    expect(bob?.isConnected).toBe(true);
  });

  it('unknown session code returns ok:false', async () => {
    const client = tracked(createClient());
    await connect(client);

    const ack = await new Promise<JoinAckResponse>((resolve) => {
      client.emit('session:join', { code: 'XXXXXX', displayName: 'Bob' }, resolve);
    });

    expect(ack.ok).toBe(false);
    if (!ack.ok) {
      expect(typeof ack.error).toBe('string');
    }
  });
});
