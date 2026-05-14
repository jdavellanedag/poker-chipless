import type { GameState } from '@poker-chipless/types';

export type SessionRecord = {
  state: GameState;
  tokenMap: Map<string, string>;
  previousPhase?: GameState['phase'];
  autoFoldTimer?: ReturnType<typeof setTimeout>;
};

const sessions = new Map<string, SessionRecord>();

export function getSession(code: string): SessionRecord | undefined {
  return sessions.get(code);
}

export function setSession(code: string, record: SessionRecord): void {
  sessions.set(code, record);
}

export function deleteSession(code: string): void {
  sessions.delete(code);
}

export function listSessions(): Map<string, SessionRecord> {
  return sessions;
}
