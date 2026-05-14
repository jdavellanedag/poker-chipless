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

/** Register game:state listeners on both clients and return the next state received by both. */
function drainBoth(a: TypedSocket, b: TypedSocket): [Promise<GameState>, Promise<GameState>] {
  return [
    new Promise<GameState>((r) => { a.once('game:state', r); }),
    new Promise<GameState>((r) => { b.once('game:state', r); }),
  ];
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

  const [hostStateP, playerStateP] = drainBoth(hostClient, playerClient);
  const startAck = await new Promise<AckResponse>((resolve) => {
    hostClient.emit('host:start-game', { startingStack: 1000, smallBlind: 10, bigBlind: 20 }, resolve);
  });
  if (!startAck.ok) throw new Error('start failed');

  const state = await hostStateP;
  await playerStateP;

  return {
    hostClient,
    playerClient,
    code: createAck.code,
    hostId: createAck.playerId,
    playerId: joinAck.playerId,
    state,
  };
}

describe('host:start-game', () => {
  it('happy path: ack ok:true and game:state phase is active', async () => {
    const hostClient = tracked(createClient());
    const playerClient = tracked(createClient());
    await connect(hostClient);
    await connect(playerClient);

    const createAck = await new Promise<CreateAckResponse>((r) => {
      hostClient.emit('session:create', { displayName: 'Alice' }, r);
    });
    if (!createAck.ok) throw new Error('create failed');

    const joinAck = await new Promise<JoinAckResponse>((r) => {
      playerClient.emit('session:join', { code: createAck.code, displayName: 'Bob' }, r);
    });
    if (!joinAck.ok) throw new Error('join failed');

    const statePromise = new Promise<GameState>((r) => { hostClient.once('game:state', r); });
    const ack = await new Promise<AckResponse>((r) => {
      hostClient.emit('host:start-game', { startingStack: 1000, smallBlind: 10, bigBlind: 20 }, r);
    });
    const state = await statePromise;

    expect(ack.ok).toBe(true);
    expect(state.phase).toBe('active');
  });
});

describe('host:new-hand', () => {
  it('happy path: ack ok:true and game:state round is preflop', async () => {
    const { hostClient, playerClient, state: prevState } = await setupStartedGame();

    // Fold active player to end the hand (goes to showdown)
    const [foldH, foldP] = drainBoth(hostClient, playerClient);
    await new Promise<AckResponse>((r) => { hostClient.emit('action:fold', {}, r); });
    await Promise.all([foldH, foldP]);

    // Declare winner to reset pot (hostId may be the non-folded winner)
    const winner = prevState.players.find((p) => p.displayName === 'Bob')!;
    const [winH, winP] = drainBoth(hostClient, playerClient);
    await new Promise<AckResponse>((r) => {
      hostClient.emit('host:declare-winner', { playerId: winner.id }, r);
    });
    await Promise.all([winH, winP]);

    const [newHandH] = drainBoth(hostClient, playerClient);
    const ack = await new Promise<AckResponse>((r) => { hostClient.emit('host:new-hand', {}, r); });
    const newState = await newHandH;

    expect(ack.ok).toBe(true);
    expect(newState.round).toBe('preflop');
  });
});

describe('host:advance-round', () => {
  it('happy path: ack ok:true and game:state round advances from preflop', async () => {
    const { hostClient, playerClient } = await setupStartedGame();

    const [advH] = drainBoth(hostClient, playerClient);
    const ack = await new Promise<AckResponse>((r) => { hostClient.emit('host:advance-round', {}, r); });
    const newState = await advH;

    expect(ack.ok).toBe(true);
    expect(newState.round).toBe('flop');
  });
});

describe('host:declare-winner', () => {
  it('happy path: ack ok:true and winner chipCount increases by pot', async () => {
    const { hostClient, playerClient, state } = await setupStartedGame();

    // Alice (active UTG) folds → showdown, Bob wins
    const [foldH, foldP] = drainBoth(hostClient, playerClient);
    await new Promise<AckResponse>((r) => { hostClient.emit('action:fold', {}, r); });
    const [afterFold] = await Promise.all([foldH, foldP]);

    const potBeforeDeclaration = afterFold.pot;
    const bobBefore = afterFold.players.find((p) => p.displayName === 'Bob')!;
    const bob = state.players.find((p) => p.displayName === 'Bob')!;

    const [winH] = drainBoth(hostClient, playerClient);
    const ack = await new Promise<AckResponse>((r) => {
      hostClient.emit('host:declare-winner', { playerId: bob.id }, r);
    });
    const afterWin = await winH;

    expect(ack.ok).toBe(true);
    const bobAfter = afterWin.players.find((p) => p.displayName === 'Bob')!;
    expect(bobAfter.chipCount).toBe(bobBefore.chipCount + potBeforeDeclaration);
  });
});

describe('host:rebuy', () => {
  it('happy path: ack ok:true and target player chipCount increases', async () => {
    const { hostClient, playerClient, state } = await setupStartedGame();

    // Alice folds → showdown
    const [foldH, foldP] = drainBoth(hostClient, playerClient);
    await new Promise<AckResponse>((r) => { hostClient.emit('action:fold', {}, r); });
    await Promise.all([foldH, foldP]);

    // Declare Bob as winner (pot → 0)
    const bob = state.players.find((p) => p.displayName === 'Bob')!;
    const [winH, winP] = drainBoth(hostClient, playerClient);
    await new Promise<AckResponse>((r) => {
      hostClient.emit('host:declare-winner', { playerId: bob.id }, r);
    });
    const [afterWin] = await Promise.all([winH, winP]);

    const aliceBefore = afterWin.players.find((p) => p.displayName === 'Alice')!;
    const alice = state.players.find((p) => p.displayName === 'Alice')!;

    const [rebuyH] = drainBoth(hostClient, playerClient);
    const ack = await new Promise<AckResponse>((r) => {
      hostClient.emit('host:rebuy', { playerId: alice.id, amount: 500 }, r);
    });
    const afterRebuy = await rebuyH;

    expect(ack.ok).toBe(true);
    const aliceAfter = afterRebuy.players.find((p) => p.displayName === 'Alice')!;
    expect(aliceAfter.chipCount).toBe(aliceBefore.chipCount + 500);
  });
});

describe('host:pause and host:resume', () => {
  it('phase transitions to paused then back to active', async () => {
    const { hostClient, playerClient } = await setupStartedGame();

    const [pauseH] = drainBoth(hostClient, playerClient);
    const pauseAck = await new Promise<AckResponse>((r) => { hostClient.emit('host:pause', {}, r); });
    const pausedState = await pauseH;

    expect(pauseAck.ok).toBe(true);
    expect(pausedState.phase).toBe('paused');

    const [resumeH] = drainBoth(hostClient, playerClient);
    const resumeAck = await new Promise<AckResponse>((r) => { hostClient.emit('host:resume', {}, r); });
    const resumedState = await resumeH;

    expect(resumeAck.ok).toBe(true);
    expect(resumedState.phase).toBe('active');
  });
});

describe('host:end-session', () => {
  it('ack ok:true and game:state phase is ended', async () => {
    const { hostClient, playerClient } = await setupStartedGame();

    const [endH] = drainBoth(hostClient, playerClient);
    const ack = await new Promise<AckResponse>((r) => { hostClient.emit('host:end-session', {}, r); });
    const endState = await endH;

    expect(ack.ok).toBe(true);
    expect(endState.phase).toBe('ended');
  });
});

describe('host:* non-host rejection', () => {
  it('host:start-game sent by non-host returns ok:false', async () => {
    const hostClient = tracked(createClient());
    const playerClient = tracked(createClient());
    await connect(hostClient);
    await connect(playerClient);

    const createAck = await new Promise<CreateAckResponse>((r) => {
      hostClient.emit('session:create', { displayName: 'Alice' }, r);
    });
    if (!createAck.ok) throw new Error('create failed');

    await new Promise<JoinAckResponse>((r) => {
      playerClient.emit('session:join', { code: createAck.code, displayName: 'Bob' }, r);
    });

    const ack = await new Promise<AckResponse>((r) => {
      playerClient.emit('host:start-game', { startingStack: 1000, smallBlind: 10, bigBlind: 20 }, r);
    });

    expect(ack.ok).toBe(false);
    if (!ack.ok) {
      expect(typeof ack.error).toBe('string');
    }
  });
});
