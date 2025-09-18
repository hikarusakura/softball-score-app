import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Trophy, Eye, ChevronLeft, Copy, Heart } from 'lucide-react';
import {
  db, saveGameState, watchGameState, stopWatching,
  generateGameId, getAllGames, deleteGameFromFirebase,
  login, logout, onAuth, getTeamData, updatePlayerStats,
  updateTeamData
} from './firebase';
import { doc, setDoc } from "firebase/firestore";



// --- ログイン画面コンポーネント ---
const LoginScreen = ({ onLogin }) => {
  const [teamId, setTeamId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!teamId || !password) {
      setError('チームIDとパスワードを入力してください。');
      return;
    }
    setLoading(true);
    try {
      const fullEmail = `${teamId.toLowerCase()}@softball.app`;
      await onLogin(fullEmail, password);
    } catch (err) {
      setError('チームIDまたはパスワードが違います。');
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-md mx-4">
        <h1 className="text-2xl font-bold text-center mb-6">試合速報アプリ ログイン</h1>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">チームID</label>
            <input
              type="text"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              placeholder="チームIDを入力"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              placeholder="パスワードを入力"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg disabled:bg-blue-300">
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
};


// --- 試合別 個人成績画面コンポーネント ---
const InGameStatsScreen = ({ players, inGameStats, isGameCreator, onBack }) => {
  const playersWithStats = (players || [])
    .filter(player => inGameStats[player] && Object.values(inGameStats[player]).some(stat => stat > 0));

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">この試合の個人成績</h1>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="text-left py-3 px-4 uppercase font-semibold text-sm">選手名</th>
                <th className="py-3 px-4 uppercase font-semibold text-sm">打数</th>
                <th className="py-3 px-4 uppercase font-semibold text-sm">安打</th>
                <th className="py-3 px-4 uppercase font-semibold text-sm">本塁打</th>
                <th className="py-3 px-4 uppercase font-semibold text-sm">打点</th>
                <th className="py-3 px-4 uppercase font-semibold text-sm">盗塁</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {playersWithStats.length > 0 ? (
                playersWithStats.map((playerName) => {
                  const stats = inGameStats[playerName] || {};
                  return (
                    <tr key={playerName} className="border-b border-gray-200 hover:bg-gray-100">
                      <td className="text-left py-3 px-4">{playerName}</td>
                      <td className="text-center py-3 px-4">{stats.atBats || 0}</td>
                      <td className="text-center py-3 px-4">{stats.hits || 0}</td>
                      <td className="text-center py-3 px-4">{stats.homeRuns || 0}</td>
                      <td className="text-center py-3 px-4">{stats.rbi || 0}</td>
                      <td className="text-center py-3 px-4">{stats.stolenBases || 0}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-gray-500">この試合で記録された成績はありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


// --- チーム管理画面コンポーネント ---
const TeamManagementScreen = ({ initialProfiles, onSave, onBack }) => {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [newTeamName, setNewTeamName] = useState('');

  const handleAddTeam = () => {
    if (!newTeamName.trim()) {
      alert('チーム名を入力してください。');
      return;
    }
    if (profiles.includes(newTeamName.trim())) {
      alert('同じ名前のチームが既に存在します。');
      return;
    }
    setProfiles(prev => [...prev, newTeamName.trim()]);
    setNewTeamName('');
  };

  const handleDeleteTeam = (teamNameToDelete) => {
    if (profiles.length <= 1) {
      alert('チームは最低1つ必要です。');
      return;
    }
    if (window.confirm(`「${teamNameToDelete}」を削除しますか？`)) {
      setProfiles(prev => prev.filter(name => name !== teamNameToDelete));
    }
  };

  const handleSave = () => {
    onSave(profiles);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <button onClick={onBack} className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full"><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="text-2xl font-bold text-gray-800">チーム管理</h1>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">新しいチームを追加</label>
          <div className="flex space-x-2">
            <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" placeholder="チーム名を入力" />
            <button onClick={handleAddTeam} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">追加</button>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">現在のチームリスト</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto bg-gray-50 p-3 rounded-lg">
            {profiles.map((name, index) => (
              <div key={index} className="flex justify-between items-center bg-white p-2 rounded-md shadow-sm">
                <span>{name}</span>
                <button onClick={() => handleDeleteTeam(name)} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-lg">削除</button>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 border-t pt-6">
          <button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg">変更を保存</button>
        </div>
      </div>
    </div>
  );
};


// --- ログイン後のメインアプリ本体 ---
// 【重要】このテストコードで既存のSoftballScoreAppを一時的に置き換えてください
const SoftballScoreApp = ({ user, initialTeamData }) => {
  const [gameState, setGameState] = useState('setup');
  const firebaseListener = useRef(null);

  // ログはここに配置
  console.log("【テスト中】現在のgameState:", gameState);

  // loadGame関数を、gameStateを変更するだけの最小限の機能にする
  const loadGame = (id, mode = 'watch') => {
    console.log(`loadGameが呼び出されました。mode: ${mode}`);
    if (mode === 'watch') {
      setGameState('watching');
    } else if (mode === 'resume') {
      setGameState('playing');
    }
  };

  // 画面の表示も最小限にする
  if (gameState === 'setup') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">テスト画面</h1>
        <p className="mb-2">現在のgameState: {gameState}</p>
        <button 
          onClick={() => loadGame('test-game-id', 'watch')}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          このボタンを押して観戦モードをテスト
        </button>
      </div>
    );
  }

  // 観戦モード（または記録モード）の表示
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">テスト画面</h1>
      <p className="mb-2">現在のgameState: {gameState}</p>
      <p className="text-green-600 font-bold">
        {gameState === 'watching' ? '観戦モードに切り替わりました！いいねボタンが表示されるはずの画面です。' : '記録モードです。'}
      </p>
      <button 
        onClick={() => setGameState('setup')}
        className="mt-4 bg-gray-500 text-white px-4 py-2 rounded"
      >
        セットアップに戻る
      </button>
    </div>
  );
};


// --- アプリケーションの親コンポーネント ---
const App = () => {
  const [user, setUser] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuth(async (user) => {
      if (user) {
        try {
          const docSnap = await getTeamData(user.uid);
          if (docSnap.exists()) {
            setTeamData(docSnap.data());
            setUser(user);
          } else {
            setError(`チームデータが見つかりません (ID: ${user.uid})`);
            logout();
          }
        } catch (err) {
          setError('チームデータの読み込みに失敗しました。');
          console.error(err);
        }
      } else {
        setUser(null);
        setTeamData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center">エラー: {error} <button onClick={logout} className="ml-4 bg-blue-500 text-white px-3 py-1 rounded">再ログイン</button></div>;
  }

  return user && teamData ? <SoftballScoreApp user={user} initialTeamData={teamData} /> : <LoginScreen onLogin={login} />;
};

export default App;