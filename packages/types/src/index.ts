export type ValidAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

export interface LogEntry {
  timestamp: string; // ISO 8601
  message: string;
}

export interface Player {
  id: string; // UUID
  displayName: string;
  /** @remarks integer only */
  chipCount: number;
  /** @remarks integer only */
  currentBet: number;
  isHost: boolean;
  isEliminated: boolean;
  isConnected: boolean;
  isAllIn: boolean;
  isFolded: boolean;
  hasActedThisRound: boolean;
  validActions: ValidAction[];
}

export interface GameState {
  code: string; // 6-char session code
  phase: 'lobby' | 'active' | 'paused' | 'showdown' | 'ended';
  round: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  players: Player[]; // ordered by seat
  dealerButtonIndex: number;
  activePlayerIndex: number;
  /** @remarks integer only */
  pot: number;
  /** @remarks integer only — highest bet open this round */
  currentBet: number;
  /** @remarks integer only — for minimum re-raise enforcement */
  lastRaiseSize: number;
  /** @remarks integer only */
  smallBlind: number;
  /** @remarks integer only */
  bigBlind: number;
  roundComplete: boolean;
  log: LogEntry[];
}

export interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'game:log': (entry: LogEntry) => void;
}

export interface ClientToServerEvents {
  'session:create': (
    payload: { displayName: string },
    ack: (res: CreateAckResponse) => void,
  ) => void;
  'session:join': (
    payload: { code: string; displayName: string; token?: string },
    ack: (res: JoinAckResponse) => void,
  ) => void;
  'action:fold': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
  'action:check': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
  'action:call': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
  'action:bet': (
    payload: { amount: number },
    ack: (res: AckResponse) => void,
  ) => void;
  'action:raise': (
    payload: { amount: number },
    ack: (res: AckResponse) => void,
  ) => void;
  'action:allin': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
  'host:new-hand': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
  'host:advance-round': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
  'host:declare-winner': (
    payload: { playerId: string },
    ack: (res: AckResponse) => void,
  ) => void;
  'host:rebuy': (
    payload: { playerId: string; amount: number },
    ack: (res: AckResponse) => void,
  ) => void;
  'host:pause': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
  'host:resume': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
  'host:reorder-players': (
    payload: { orderedPlayerIds: string[] },
    ack: (res: AckResponse) => void,
  ) => void;
  'host:start-game': (
    payload: { startingStack: number; smallBlind: number; bigBlind: number },
    ack: (res: AckResponse) => void,
  ) => void;
  'host:end-session': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
}

export type AckResponse = { ok: true } | { ok: false; error: string };
export type CreateAckResponse = { ok: true; code: string; token: string; playerId: string } | { ok: false; error: string };
export type JoinAckResponse = { ok: true; token: string; playerId: string } | { ok: false; error: string };
