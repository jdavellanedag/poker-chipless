import { useState, useEffect } from 'react';
import type { GameState } from '@poker-chipless/types';
import socket from '../socket.js';

export function useGameState(): { gameState: GameState | null } {
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    socket.connect();
    socket.on('game:state', setGameState);
    return () => {
      socket.off('game:state', setGameState);
    };
  }, []);

  return { gameState };
}
