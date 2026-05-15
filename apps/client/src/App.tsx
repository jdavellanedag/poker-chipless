import socket from './socket.js';
import { useGameState } from './hooks/useGameState.js';
import { useSession } from './hooks/useSession.js';
import { GameScreen } from './screens/GameScreen.js';
import { GameOverScreen } from './screens/GameOverScreen.js';
import { LobbyScreen } from './screens/LobbyScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { JoinScreen } from './screens/JoinScreen.js';

export default function App() {
  const { gameState } = useGameState();
  const { screen, setScreen, myPlayerId, error, setError,
          createName, setCreateName, joinCode, setJoinCode,
          joinName, setJoinName, loading, handleCreate, handleJoin } = useSession();

  const emit = socket.emit.bind(socket);
  function handleStartGame(s: number, sb: number, bb: number, cb: (err?: string) => void) {
    emit('host:start-game', { startingStack: s, smallBlind: sb, bigBlind: bb }, (res) => cb(res.ok ? undefined : res.error));
  }

  if (gameState) {
    if (gameState.phase === 'ended') {
      return <GameOverScreen players={gameState.players} log={gameState.log} />;
    }
    if (gameState.phase === 'active' || gameState.phase === 'showdown' || gameState.phase === 'paused') {
      return (
        <GameScreen
          state={gameState}
          myPlayerId={myPlayerId}
          onNewHand={() => emit('host:new-hand', {}, () => {})}
          onAdvanceRound={() => emit('host:advance-round', {}, () => {})}
          onDeclareWinner={(id) => emit('host:declare-winner', { playerId: id }, () => {})}
          onFold={() => emit('action:fold', {}, () => {})}
          onCheck={() => emit('action:check', {}, () => {})}
          onCall={() => emit('action:call', {}, () => {})}
          onBet={(amount) => emit('action:bet', { amount }, () => {})}
          onRaise={(amount) => emit('action:raise', { amount }, () => {})}
          onAllin={() => emit('action:allin', {}, () => {})}
          onPause={() => emit('host:pause', {}, () => {})}
          onResume={() => emit('host:resume', {}, () => {})}
          onRebuy={(playerId, amount) => emit('host:rebuy', { playerId, amount }, () => {})}
        />
      );
    }
    return (
      <LobbyScreen
        state={gameState}
        myPlayerId={myPlayerId}
        onStartGame={handleStartGame}
        onReorder={(ids) => emit('host:reorder-players', { orderedPlayerIds: ids }, () => {})}
      />
    );
  }

  if (screen === 'join') {
    return (
      <JoinScreen
        joinCode={joinCode} setJoinCode={setJoinCode}
        joinName={joinName} setJoinName={setJoinName}
        error={error} loading={loading}
        onJoin={handleJoin}
        onBack={() => { setScreen('home'); setError(''); }}
      />
    );
  }

  return (
    <HomeScreen
      createName={createName} setCreateName={setCreateName}
      error={error} loading={loading}
      onCreate={handleCreate}
      onGoJoin={() => { setScreen('join'); setError(''); }}
    />
  );
}
