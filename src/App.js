import React, { useState, useEffect } from 'react';
import { login, logout, onAuth } from './firebase';

// --- ログイン画面コンポーネント ---
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // チームIDにドメインを付与してメール形式にする
      const fullEmail = `${email}@softball.app`;
      await onLogin(fullEmail, password);
    } catch (err) {
      setError('チームIDまたはパスワードが違います。');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">試合速報アプリ ログイン</h1>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">チームID</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg">
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
};

// --- ログイン後のメインアプリコンポーネント ---
const MainApp = ({ user }) => {
  // TODO: ここに、これまでのSoftballScoreAppのロジックを移植していく
  
  return (
    <div>
      <h1>ようこそ, {user.email} さん</h1>
      <p>（ここに、これまでのアプリの本体が表示されます）</p>
      <button onClick={logout} className="p-2 bg-red-500 text-white rounded">ログアウト</button>
    </div>
  );
};


// --- アプリケーションの親コンポーネント ---
const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthでログイン状態を監視し、変更があればsetUserでstateを更新
    const unsubscribe = onAuth((user) => {
      setUser(user);
      setLoading(false);
    });
    // クリーンアップ関数
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>読み込み中...</div>;
  }

  // userが存在すればメインアプリを、しなければログイン画面を表示
  return user ? <MainApp user={user} /> : <LoginScreen onLogin={login} />;
};

export default App;