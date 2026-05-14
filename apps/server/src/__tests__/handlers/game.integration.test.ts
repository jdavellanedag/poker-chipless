import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { GameState, AckResponse, CreateAckResponse, JoinAckResponse } from '@poker-chipless/types';
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

type StartedGame = {
  hostClient: TypedSocket;
  playerClient: TypedSocket;
  code: string;
  hostId: string;
  playerId: string;
  state: GameState;
};

async function setupStartedGame(): Promise<StartedGame> {
  const hostClient = tracked(createClient());
  const playerClient = tracked(createClient());
  await connect(hostClient);
  await connect(playerClient);

  const createAck = await new Promise<CreateAckResponse>((resolve) => {
    hostClient.emit('session:create', { displayName: 'Alice' }, resolve);
  });
  if (!createAck.ok) throw new Error('create failed');

  const joinAck = await new Promise<JoinAckResponse>((resolve) => {
    playerClient.emit('session:join', { code: createAck.code, displayName: 'Bob' }, resolve);
  });
  if (!joinAck.ok) throw new Error('join failed');

  const bothDrained = Promise.all([
    new Promise<GameState>((r) => { hostClient.once('game:state', r); }),
    new Promise<GameState>((r) => { playerClient.once('game:state', r); }),
  ]);

  const startAck = await new Promise<AckResponse>((resolve) => {
    hostClient.emit('host:start-game', { startingStack: 1000, smallBlind: 10, bigBlind: 20 }, resolve);
  });
  if (!startAck.ok) throw new Error('start failed');

  const [state] = await bothDrained;

  return {
    hostClient,
    playerClient,
    code: createAck.code,
    hostId: createAck.playerId,
    playerId: joinAck.playerId,
    state,
  };
}

describe('game actions without a session', () => {
  it('action:fold with no session returns ok:false with Session not found error', async () => {
    const client = tracked(createClient());
    await connect(client);

    const ack = await new Promise<AckResponse>((resolve) => {
      client.emit('action:fold', {}, resolve);
    });

    expect(ack.ok).toBe(false);
    if (!ack.ok) {
      expect(ack.error).toBe('Session not found.');
    }
  });
});

describe('action:fold', () => {
  it('happy path: active player folds, ack ok:true, isFolded:true in game:state', async () => {
    const { hostClient, state } = await setupStartedGame();
    const activePlayer = state.players[state.activePlayerIndex];

    const statePromise = new Promise<GameState>((resolve) => {
      hostClient.once('game:state', resolve);
    });

    const ack = await new Promise<AckResponse>((resolve) => {
      hostClient.emit('action:fold', {}, resolve);
    });

    const newState = await statePromise;

    expect(ack.ok).toBe(true);
    const foldedPlayer = newState.players.find((p) => p.id === activePlayer.id);
    expect(foldedPlayer?.isFolded).toBe(true);
  });
});

describe('action:check', () => {
  it('happy path: player checks after call, ack ok:true, hasActedThisRound:true in game:state', async () => {
    const { hostClient, playerClient } = await setupStartedGame();

    // Drain call state on both clients so playerClient has no pending events when check fires
    const callDrained = Promise.all([
      new Promise<GameState>((r) => { hostClient.once('game:state', r); }),
      new Promise<GameState>((r) => { playerClient.once('game:state', r); }),
    ]);
    await new Promise<AckResponse>((r) => { hostClient.emit('action:call', {}, r); });
    const [afterCall] = await callDrained;
    expect(afterCall.players[afterCall.activePlayerIndex].displayName).toBe('Bob');

    const checkDrained = Promise.all([
      new Promise<GameState>((r) => { hostClient.once('game:state', r); }),
      new Promise<GameState>((r) => { playerClient.once('game:state', r); }),
    ]);
    const ack = await new Promise<AckResponse>((r) => { playerClient.emit('action:check', {}, r); });
    const [newState] = await checkDrained;

    expect(ack.ok).toBe(true);
    const bob = newState.players.find((p) => p.displayName === 'Bob');
    expect(bob?.hasActedThisRound).toBe(true);
  });
});

describe('action:call', () => {
  it('happy path: active player calls big blind, ack ok:true, pot increases', async () => {
    const { hostClient, state } = await setupStartedGame();
    const potBefore = state.pot;

    const statePromise = new Promise<GameState>((resolve) => {
      hostClient.once('game:state', resolve);
    });

    const ack = await new Promise<AckResponse>((resolve) => {
      hostClient.emit('action:call', {}, resolve);
    });

    const newState = await statePromise;

    expect(ack.ok).toBe(true);
    expect(newState.pot).toBeGreaterThan(potBefore);
  });
});

describe('action:bet', () => {
  it('happy path: player bets on flop, ack ok:true, currentBet is updated', async () => {
    const { hostClient, playerClient } = await setupStartedGame();

    // Alice calls — drain on both clients
    const callDrained = Promise.all([
      new Promise<GameState>((r) => { hostClient.once('game:state', r); }),
      new Promise<GameState>((r) => { playerClient.once('game:state', r); }),
    ]);
    await new Promise<AckResponse>((r) => { hostClient.emit('action:call', {}, r); });
    await callDrained;

    // Bob checks (round complete) — drain on both
    const checkDrained = Promise.all([
      new Promise<GameState>((r) => { hostClient.once('game:state', r); }),
      new Promise<GameState>((r) => { playerClient.once('game:state', r); }),
    ]);
    await new Promise<AckResponse>((r) => { playerClient.emit('action:check', {}, r); });
    await checkDrained;

    // Host advances to flop — drain on both
    const advanceDrained = Promise.all([
      new Promise<GameState>((r) => { hostClient.once('game:state', r); }),
      new Promise<GameState>((r) => { playerClient.once('game:state', r); }),
    ]);
    await new Promise<AckResponse>((r) => { hostClient.emit('host:advance-round', {}, r); });
    await advanceDrained;

    // Bob acts first on flop (first after dealer) and bets
    const betDrained = Promise.all([
      new Promise<GameState>((r) => { hostClient.once('game:state', r); }),
      new Promise<GameState>((r) => { playerClient.once('game:state', r); }),
    ]);
    const ack = await new Promise<AckResponse>((r) => { playerClient.emit('action:bet', { amount: 50 }, r); });
    const [newState] = await betDrained;

    expect(ack.ok).toBe(true);
    expect(newState.currentBet).toBe(50);
  });
});

describe('action:raise', () => {
  it('happy path: active player raises, ack ok:true, currentBet is updated', async () => {
    const { hostClient, playerClient, state } = await setupStartedGame();

    // Alice calls — drain on both so playerClient has no pending events
    const callDrained = Promise.all([
      new Promise<GameState>((r) => { hostClient.once('game:state', r); }),
      new Promise<GameState>((r) => { playerClient.once('game:state', r); }),
    ]);
    await new Promise<AckResponse>((r) => { hostClient.emit('action:call', {}, r); });
    const [afterCall] = await callDrained;
    expect(afterCall.players[afterCall.activePlayerIndex].displayName).toBe('Bob');

    const raiseDrained = Promise.all([
      new Promise<GameState>((r) => { hostClient.once('game:state', r); }),
      new Promise<GameState>((r) => { playerClient.once('game:state', r); }),
    ]);
    const ack = await new Promise<AckResponse>((r) => { playerClient.emit('action:raise', { amount: 40 }, r); });
    const [newState] = await raiseDrained;

    expect(ack.ok).toBe(true);
    expect(newState.currentBet).toBeGreaterThan(state.currentBet);
  });
});

describe('action:allin', () => {
  it('happy path: active player goes all-in, ack ok:true, isAllIn:true in game:state', async () => {
    const { hostClient, state } = await setupStartedGame();
    const activePlayer = state.players[state.activePlayerIndex];

    const statePromise = new Promise<GameState>((resolve) => {
      hostClient.once('game:state', resolve);
    });

    const ack = await new Promise<AckResponse>((resolve) => {
      hostClient.emit('action:allin', {}, resolve);
    });

    const newState = await statePromise;

    expect(ack.ok).toBe(true);
    const player = newState.players.find((p) => p.id === activePlayer.id);
    expect(player?.isAllIn).toBe(true);
  });
});
