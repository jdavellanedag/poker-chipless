import { useState, useEffect } from 'react';
import socket from '../socket.js';

export function useSession() {
  const [screen, setScreen] = useState<'home' | 'join'>('home');
  const [myPlayerId, setMyPlayerId] = useState('');
  const [error, setError] = useState('');
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedCode = sessionStorage.getItem('session_code');
    const savedToken = sessionStorage.getItem('session_token');
    const savedName = sessionStorage.getItem('display_name');
    const savedPlayerId = sessionStorage.getItem('player_id');
    if (savedCode && savedToken && savedName && savedPlayerId) {
      setMyPlayerId(savedPlayerId);
      socket.emit('session:join', { code: savedCode, displayName: savedName, token: savedToken }, (res) => {
        if (!res.ok) {
          sessionStorage.clear();
          setMyPlayerId('');
        }
      });
    }
  }, []);

  function handleCreate() {
    const name = createName.trim();
    if (!name) { setError('Display name cannot be empty.'); return; }
    setError('');
    setLoading(true);
    socket.emit('session:create', { displayName: name }, (res) => {
      setLoading(false);
      if (!res.ok) { setError(res.error); return; }
      sessionStorage.setItem('session_code', res.code);
      sessionStorage.setItem('session_token', res.token);
      sessionStorage.setItem('display_name', name);
      sessionStorage.setItem('player_id', res.playerId);
      setMyPlayerId(res.playerId);
    });
  }

  function handleJoin() {
    const name = joinName.trim();
    const code = joinCode.trim().toUpperCase();
    if (!name) { setError('Display name cannot be empty.'); return; }
    if (code.length !== 6) { setError('Session code must be 6 characters.'); return; }
    setError('');
    setLoading(true);
    socket.emit('session:join', { code, displayName: name }, (res) => {
      setLoading(false);
      if (!res.ok) { setError(res.error); return; }
      sessionStorage.setItem('session_code', code);
      sessionStorage.setItem('session_token', res.token);
      sessionStorage.setItem('display_name', name);
      sessionStorage.setItem('player_id', res.playerId);
      setMyPlayerId(res.playerId);
    });
  }

  return {
    screen, setScreen,
    myPlayerId,
    error, setError,
    createName, setCreateName,
    joinCode, setJoinCode,
    joinName, setJoinName,
    loading,
    handleCreate,
    handleJoin,
  };
}
