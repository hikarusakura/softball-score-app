import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Trophy, Eye, ChevronLeft, Copy, Heart } from 'lucide-react';
import {
  db, saveGameState, watchGameState, stopWatching,
  generateGameId, getAllGames, deleteGameFromFirebase,
  login, logout, onAuth, getTeamData,
  updateTeamData,
  incrementLikeCount
} from './firebase';
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";


//
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
          <table className="min-w-full bg-white text-xs md:text-sm">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="text-left py-2 px-3">選手名</th>
                <th>打率</th>
                <th>出塁率</th>
                <th>打席</th>
                <th>打数</th>
                <th>安打</th>
                <th>二塁打</th>
                <th>三塁打</th>
                <th>本塁打</th>
                <th>打点</th>
                <th>三振</th>
                <th>四球</th>
                <th>死球</th>
                <th>盗塁</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {playersWithStats.length > 0 ? (
                playersWithStats.map((playerName) => {
                  const stats = inGameStats[playerName] || {};
                  const atBats = stats.atBats || 0;
                  const hits = stats.hits || 0;
                  const doubles = stats.doubles || 0;
                  const triples = stats.triples || 0;
                  const homeRuns = stats.homeRuns || 0;
                  const rbi = stats.rbi || 0;
                  const strikeouts = stats.strikeouts || 0;
                  const walks = stats.walks || 0;
                  const hitByPitches = stats.hitByPitches || 0;
                  const stolenBases = stats.stolenBases || 0;
                  const plateAppearances = atBats + walks + hitByPitches;
                  const battingAverage = atBats > 0 ? (hits / atBats).toFixed(3) : '.000';
                  const onBasePercentage = plateAppearances > 0 ? ((hits + walks + hitByPitches) / plateAppearances).toFixed(3) : '.000';

                  return (
                    <tr key={playerName} className="border-b border-gray-200 hover:bg-gray-100">
                      <td className="text-left py-2 px-3 font-medium">{playerName}</td>
                      <td className="text-center font-semibold">{battingAverage}</td>
                      <td className="text-center font-semibold">{onBasePercentage}</td>
                      <td className="text-center">{plateAppearances}</td>
                      <td className="text-center">{atBats}</td>
                      <td className="text-center">{hits}</td>
                      <td className="text-center">{doubles}</td>
                      <td className="text-center">{triples}</td>
                      <td className="text-center">{homeRuns}</td>
                      <td className="text-center">{rbi}</td>
                      <td className="text-center">{strikeouts}</td>
                      <td className="text-center">{walks}</td>
                      <td className="text-center">{hitByPitches}</td>
                      <td className="text-center">{stolenBases}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="14" className="text-center py-4 text-gray-500">この試合で記録された成績はありません。</td>
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
const TeamManagementScreen = ({ initialProfiles, onSave, onBack, currentYear, availableYears, onYearChange, onYearAdd }) => {
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
        <div className="mb-6 border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">年度の管理</h2>
          <div className="grid grid-cols-2 gap-2">
           <div>
           <label className="block text-sm font-medium text-gray-700 mb-1">現在の年度</label>
              <select 
                value={currentYear} 
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
               {(availableYears || []).sort((a, b) => b - a).map(year => 
                 <option key={year} value={year}>{year}年度</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新年度を作成</label>
              <button 
                // ★ 次の年度を提案 (例: 2025年度が最新なら2026年度)
                onClick={() => onYearAdd(Math.max(...availableYears) + 1)}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">{Math.max(...availableYears) + 1}年度を作成
              </button>
            </div>
         </div>
        </div>
        {/* --- △△△ ここまで挿入 △△△ --- */}
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

// --- オーダー編集画面コンポーネント ---
const LineupEditor = ({ players, initialLineup, initialOpponentLineup, onSave, onCancel }) => {
  const [lineup, setLineup] = useState(initialLineup);
  const [opponentLineup, setOpponentLineup] = useState(
  Array.isArray(initialOpponentLineup) && initialOpponentLineup.length > 0
    ? initialOpponentLineup
    : Array(9).fill({ playerName: '', position: '' })
);
  const positions = ['投', '捕', '一', '二', '三', '遊', '左', '中', '右', 'DP'];

  const handlePlayerChange = (index, playerName) => {
    const newLineup = [...lineup];
    newLineup[index] = { ...newLineup[index], playerName };
    setLineup(newLineup);
  };

  const handlePositionChange = (index, position) => {
    const newLineup = [...lineup];
    newLineup[index] = { ...newLineup[index], position };
    setLineup(newLineup);
  };
  
  const handleAddRow = () => {
    setLineup([...lineup, { playerName: '', position: '' }]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold text-center p-4 border-b">オーダー登録・編集</h2>
        <div className="flex-grow overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 自チームオーダー */}
          <div>
            <h3 className="text-lg font-semibold mb-2">自チームオーダー</h3>
            <div className="space-y-2">
              {lineup.map((member, index) => (
                <div key={index} className="grid grid-cols-3 gap-2 items-center">
                  <span className="font-semibold">{index + 1}番</span>
                  <select
                    value={member.playerName}
                    onChange={(e) => handlePlayerChange(index, e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md"
                  >
                    <option value="">選手を選択</option>
                    {players.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select
                    value={member.position}
                    onChange={(e) => handlePositionChange(index, e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md"
                  >
                    <option value="">守備</option>
                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button onClick={handleAddRow} className="mt-2 text-sm text-blue-600 hover:underline">
              + 打順を追加
            </button>
          </div>
          {/* 相手チームオーダー */}
          <div>
            <h3 className="text-lg font-semibold mb-2">相手チームオーダー</h3>
            <div className="space-y-2">
              {opponentLineup.map((member, index) => (
                <div key={index} className="grid grid-cols-3 gap-2 items-center">
                  <span className="font-semibold">{index + 1}番</span>
                  <input
                    type="text"
                    value={member.playerName}
                    onChange={(e) => {
                      const newLineup = [...opponentLineup];
                      newLineup[index] = { ...newLineup[index], playerName: e.target.value };
                      setOpponentLineup(newLineup);
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md"
                    placeholder="選手名"
                  />
                  <select
                    value={member.position}
                    onChange={(e) => {
                      const newLineup = [...opponentLineup];
                      newLineup[index] = { ...newLineup[index], position: e.target.value };
                      setOpponentLineup(newLineup);
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md"
                  >
                    <option value="">守備</option>
                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setOpponentLineup([...opponentLineup, { playerName: '', position: '' }])} 
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              + 打順を追加
            </button>
          </div>
        </div>
        <div className="flex justify-end space-x-4 p-4 border-t">
          <button onClick={onCancel} className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg">キャンセル</button>
          <button onClick={() => onSave(lineup, opponentLineup)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">保存</button>
        </div>
      </div>
    </div>
  );
};

// ★ 引数として受け取るように変更
const GameStartDialog = ({ showShareDialog, dialogTitle, shareMessage, copyToClipboard, setShowShareDialog }) => {
    if (!showShareDialog) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full mx-4">
          <h3 className="text-lg font-bold mb-4 text-center">{dialogTitle}</h3>
          <div className="bg-gray-100 p-3 rounded-lg mb-4 whitespace-pre-wrap text-sm">{shareMessage}</div>
{/* ★ "grid" から "flex" に戻し、"space-x-3" で隙間を空ける */}
          <div className="flex justify-between items-center">
            <button 
              onClick={copyToClipboard} 
              // ★ "flex-1" で幅を均等に分け合う
              className="w-[48%] bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 whitespace-nowrap" >
              コピー
            </button>
            <button 
              onClick={() => setShowShareDialog(false)} 
              // ★ "flex-1" で幅を均等に分け合う
              className="w-[48%] bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg whitespace-nowrap flex justify-center items-center" >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- ▽▽▽ このコンポーネントを丸ごと追加 ▽▽▽ ---
// --- スコア編集画面コンポーネント ---
const ScoreEditor = ({ 
  initialHomeScore, 
  initialAwayScore, 
  myTeamName, 
  opponentTeamName, 
  isHomeTeam, 
  onSave, 
  onBack 
}) => {
  // Stateは「Home（後攻）」と「Away（先攻）」で管理
  const [homeScores, setHomeScores] = useState(initialHomeScore.map(s => s ?? ''));
  const [awayScores, setAwayScores] = useState(initialAwayScore.map(s => s ?? ''));

  // イニングの最大数を計算
  const inningsCount = Math.max(homeScores.length, awayScores.length, 7);

  // チーム名を「先攻（Top）」と「後攻（Bottom）」に振り分け
  const topTeamName = isHomeTeam ? opponentTeamName : myTeamName;    // 先攻チーム名
  const bottomTeamName = isHomeTeam ? myTeamName : opponentTeamName; // 後攻チーム名

  const handleScoreChange = (teamType, inningIndex, value) => {
    if (!/^[0-9]*$/.test(value)) return;

    const isHome = teamType === 'home';
    const currentScores = isHome ? homeScores : awayScores;
    const setScores = isHome ? setHomeScores : setAwayScores;

    const newScores = [...currentScores];
    newScores[inningIndex] = value;

    // 必要に応じて配列を拡張
    while (newScores.length < inningsCount) {
      newScores.push('');
    }
    setScores(newScores);
  };

  // 共通の入力欄コンポーネント
  const ScoreInput = ({ teamType, inningIndex, scores }) => (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={scores[inningIndex] ?? ''}
      onChange={(e) => handleScoreChange(teamType, inningIndex, e.target.value)}
      className="w-full text-center border rounded-md py-1"
    />
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <button onClick={onBack} className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full"><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="text-2xl font-bold text-gray-800">スコア修正</h1>
        </div>

        <div className="overflow-x-auto">
          <div className="flex flex-col space-y-2" style={{ minWidth: `${(inningsCount + 2) * 4}rem` }}>
            
            {/* ヘッダー行 (イニング) */}
            <div className="flex items-center space-x-2">
              <div className="w-24 font-semibold text-sm">チーム</div>
              {Array.from({ length: inningsCount }).map((_, index) => (
                <div key={index} className="w-12 text-center font-semibold">{index + 1}</div>
              ))}
              <div className="w-12 text-center font-semibold">計</div>
            </div>

            {/* --- 上段：先攻 (Away) チーム行 --- */}
            <div className="flex items-center space-x-2">
              <div className="w-24 font-semibold text-sm truncate" title={topTeamName}>
                {topTeamName}
              </div>
              {Array.from({ length: inningsCount }).map((_, index) => (
                <div key={index} className="w-12">
                  {/* awayScores をバインド */}
                  <ScoreInput teamType="away" inningIndex={index} scores={awayScores} />
                </div>
              ))}
              <div className="w-12 text-center font-bold">
                {awayScores.reduce((acc, score) => acc + (parseInt(score) || 0), 0)}
              </div>
            </div>

            {/* --- 下段：後攻 (Home) チーム行 --- */}
            <div className="flex items-center space-x-2">
              <div className="w-24 font-semibold text-sm truncate" title={bottomTeamName}>
                {bottomTeamName}
              </div>
              {Array.from({ length: inningsCount }).map((_, index) => (
                <div key={index} className="w-12">
                  {/* homeScores をバインド */}
                  <ScoreInput teamType="home" inningIndex={index} scores={homeScores} />
                </div>
              ))}
              <div className="w-12 text-center font-bold">
                {homeScores.reduce((acc, score) => acc + (parseInt(score) || 0), 0)}
              </div>
            </div>

          </div>
        </div>

        <div className="mt-8 border-t pt-6">
          <button 
            onClick={() => {
              const convertToNumeric = (arr) => arr.map(val => val === '' ? null : parseInt(val, 10));
              onSave(convertToNumeric(homeScores), convertToNumeric(awayScores));
            }} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
          >
            保存して戻る
          </button>
        </div>
      </div>
    </div>
  );
};

// --- ▽▽▽ AI新聞記事モーダル（スマホ完全対応版） ▽▽▽ ---
const NewspaperModal = ({ isOpen, onClose, article, isLoading, gameData }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2 overflow-y-auto">
      <div className="bg-[#fdfbf7] w-full max-w-4xl rounded-sm shadow-2xl overflow-hidden relative text-gray-900 font-serif my-4" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")'}}>
        
        <button onClick={onClose} className="absolute top-2 right-2 z-20 bg-gray-200 rounded-full p-1 hover:bg-gray-300 transition-colors">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {isLoading ? (
          <div className="p-20 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin h-14 w-14 border-4 border-red-600 border-t-transparent rounded-full mb-6"></div>
            <p className="text-xl font-bold text-gray-700 animate-pulse">
              AI記者が原稿を執筆中...<br/>
              <span className="text-base font-normal mt-2 block text-gray-500">（最高の一瞬を言葉にしています）</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* --- ヘッダーエリア --- */}
            <div className="bg-red-700 text-white p-2 flex justify-between items-end border-b-4 border-black">
              <div>
                <h2 className="text-[10px] font-bold tracking-widest bg-black text-yellow-400 px-2 py-0.5 inline-block transform -skew-x-12">速報</h2>
                <span className="ml-2 text-[10px] opacity-90">{gameData?.date}</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter leading-none" style={{fontFamily: '"Arial Black", sans-serif'}}>
                SOFTBALL<span className="text-yellow-400">Times</span>
              </h1>
            </div>

            <div className="p-4 md:p-8">
              
              {/* --- 大見出し (スマホでは文字サイズを抑え、改行を許可) --- */}
              <div className="mb-4 text-center">
                <h1 className="text-2xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-700 to-blue-900 leading-tight drop-shadow-sm stroke-black break-words" 
                    style={{ WebkitTextStroke: '0.5px black', textShadow: '1px 1px 0px rgba(200,200,200,0.5)' }}>
                  {article.headline}
                </h1>
                <div className="h-0.5 w-full bg-black mt-3 mb-4"></div>
              </div>

              {/* --- レイアウト（スマホ:縦並び / PC:横並び） --- */}
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* ★ 右カラム（スコアボード）：スマホでは一番上 (order-1) */}
                <div className="order-1 md:order-2 w-full md:w-64 flex-shrink-0">
                  
                  {/* スコアボード (ラインスコア形式) */}
                  <div className="border-2 border-black p-1 bg-white shadow-md overflow-x-auto">
                    <h3 className="text-center font-bold bg-black text-white py-0.5 mb-1 text-xs">SCORE BOARD</h3>
                    <table className="w-full text-center text-xs font-bold border-collapse" style={{minWidth: '200px'}}>
                      <thead>
                        <tr className="bg-gray-100 border-b-2 border-gray-400">
                          <th className="py-1 px-1 text-left min-w-[60px]">TEAM</th>
                          {/* イニングヘッダー (1〜7回まで表示) */}
                          {[...Array(7)].map((_, i) => (
                            <th key={i} className="py-1 w-6 font-normal">{i + 1}</th>
                          ))}
                          <th className="py-1 w-8 bg-gray-200 border-l border-gray-300">R</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 先攻チーム */}
                        <tr className="border-b border-dashed border-gray-300">
                          <td className="py-1 px-1 text-left truncate max-w-[80px]">{gameData?.topTeam}</td>
                          {/* スコア配列を展開 (7回分) */}
                          {[...Array(7)].map((_, i) => (
                            <td key={i} className="py-1">
                              {gameData?.topScoreArray && gameData.topScoreArray[i] !== null ? gameData.topScoreArray[i] : 0}
                            </td>
                          ))}
                          <td className="py-1 text-base font-black bg-gray-50 border-l border-gray-300">{gameData?.topScore}</td>
                        </tr>
                        {/* 後攻チーム */}
                        <tr>
                          <td className="py-1 px-1 text-left truncate max-w-[80px]">{gameData?.bottomTeam}</td>
                          {/* スコア配列を展開 (7回分) */}
                          {[...Array(7)].map((_, i) => (
                            <td key={i} className="py-1">
                              {gameData?.bottomScoreArray && gameData.bottomScoreArray[i] !== null ? gameData.bottomScoreArray[i] : (i < (gameData?.topScoreArray?.filter(s => s !== null).length || 0) ? 'x' : 0)}
                              {/* ※後攻の未入力部分は簡易的に '0' または 'x' (サヨナラ等のロジックは複雑になるため一旦0かx表示) */}
                            </td>
                          ))}
                          <td className="py-1 text-base font-black bg-gray-50 border-l border-gray-300">{gameData?.bottomScore}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* ★ 左カラム（記事本文 + ピックアップ）：スマホではその下 (order-2) */}
                <div className="order-2 md:order-1 flex-1">
                  
                  {/* 記事本文 */}
                  <p className="text-base md:text-xl leading-relaxed text-justify font-medium text-gray-800" style={{ lineHeight: '1.8' }}>
                    <span className="float-left text-4xl font-bold text-red-600 mr-1 mt-[-2px] leading-none"></span>
                    {article.content}
                    <span className="text-lg font-bold text-red-600 ml-1"></span>
                  </p>

                  {/* ★ ピックアップ選手 (記事の下に移動) */}
                  {gameData?.hitLeaders && gameData.hitLeaders.length > 0 && (
                    <div className="mt-8 border-t-2 border-dotted border-gray-400 pt-4">
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded relative">
                        <div className="absolute -top-2.5 left-2 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
                          Pickup Players!
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {gameData.hitLeaders.slice(0, 5).map((p, i) => (
                            <span key={i} className="text-xs font-bold text-gray-700 bg-white px-2 py-1 border border-yellow-300 rounded-full">
                              {p.name} <span className="text-red-600 ml-1">{p.count}安打</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 広告風スペース */}
                  <div className="mt-6 bg-gray-100 h-16 flex items-center justify-center text-gray-400 text-[10px] text-center border border-dashed border-gray-300 rounded">
                    広告スペース<br/>(スポンサー募集中)
                  </div>
                </div>

              </div>

              {/* フッター */}
              <div className="mt-6 pt-2 border-t-2 border-gray-800 flex justify-between items-center text-[10px] text-gray-500">
                <span>Generated by Gemini 2.0</span>
                <span className="font-bold">ソフトボール速報アプリ</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
// --- △△△ AI新聞記事モーダル（ここまで） △△△ ---

// --- ログイン後のメインアプリ本体 ---
const SoftballScoreApp = ({ user, initialTeamData }) => {
  // --- State管理セクション ---
  const [players, setPlayers] = useState([]);
  const [playerStats, setPlayerStats] = useState({});
  const [teamProfiles, setTeamProfiles] = useState(initialTeamData.teamProfiles || [initialTeamData.teamName || 'あなたのチーム']);
  const [selectedGameTeam, setSelectedGameTeam] = useState((initialTeamData.teamProfiles || [initialTeamData.teamName || 'あなたのチーム'])[0]);
  const [myTeamNameForGame, setMyTeamNameForGame] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [gameState, setGameState] = useState('setup');
  const [tournamentName, setTournamentName] = useState('');
  const [opponentTeam, setOpponentTeam] = useState('');
  const [isHomeTeam, setIsHomeTeam] = useState(true);
  const [bsoCount, setBsoCount] = useState({ b: 0, s: 0 });
  const [isStatsRecordingEnabled, setIsStatsRecordingEnabled] = useState(true);
  const [currentInning, setCurrentInning] = useState(1);
  const [currentTeamBatting, setCurrentTeamBatting] = useState('away');
  const [outCount, setOutCount] = useState(0);
  const [bases, setBases] = useState({ first: false, second: false, third: false });
  const [homeScore, setHomeScore] = useState(Array(7).fill(null));
  const [awayScore, setAwayScore] = useState(Array(7).fill(null));
  const [homeHits, setHomeHits] = useState(0);
  const [awayHits, setAwayHits] = useState(0);
  const [timeline, setTimeline] = useState([]);
  const [gameStartDate, setGameStartDate] = useState(null);
  const [currentBatter, setCurrentBatter] = useState('');
  const [customBatter, setCustomBatter] = useState('');
  const [useCustomBatter, setUseCustomBatter] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [freeComment, setFreeComment] = useState('');
  const [selectedGameTimeline, setSelectedGameTimeline] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [isGameCreator, setIsGameCreator] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [watchingGameId, setWatchingGameId] = useState('');
  const [resumeGameId, setResumeGameId] = useState('');
  const firebaseListener = useRef(null);
  const [firebaseGames, setFirebaseGames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [history, setHistory] = useState([]);
  const [inGameStats, setInGameStats] = useState({});
  const [myTeamPitcher, setMyTeamPitcher] = useState('');
  const [opponentPitcher, setOpponentPitcher] = useState('');
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [tempStats, setTempStats] = useState({});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showStolenBaseModal, setShowStolenBaseModal] = useState(false);
  const [stealingPlayer, setStealingPlayer] = useState(null);
  const [likeCount, setLikeCount] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'battingAverage', direction: 'descending' });
  const [myTeamLineup, setMyTeamLineup] = useState(Array(9).fill({ playerName: '', position: '' }));
  const [opponentLineup, setOpponentLineup] = useState(Array(9).fill({ playerName: '', position: '' }));
  const [showLineupEditor, setShowLineupEditor] = useState(false);
  const [mainView, setMainView] = useState('timeline');
  const [dialogTitle, setDialogTitle] = useState('共有メッセージ');
  // eslint-disable-next-line no-unused-vars
  const [availableYears, setAvailableYears] = useState(initialTeamData.availableYears || [new Date().getFullYear()]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showNewspaper, setShowNewspaper] = useState(false);
  const [newspaperData, setNewspaperData] = useState(null);
  const [newspaperGameData, setNewspaperGameData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // ★年度計算用のロジックを追加（コンポーネント内、または外でもOK）
const getFiscalYear = () => {
  const now = new Date();
  // getMonth()は 0=1月, 1=2月, 2=3月 ... です
  // 3月(2)以下、つまり1,2,3月の場合は「去年」を返す
  if (now.getMonth() < 3) { 
    return now.getFullYear() - 1;
  }
  // 4月以降なら「今年」を返す
  return now.getFullYear();
};

// eslint-disable-next-line no-unused-vars
const [currentYear, setCurrentYear] = useState(getFiscalYear());

useEffect(() => {
    if (!user || !user.uid) return;

    setIsDataLoading(true); // ★ 読み込み開始（ロック）

    // 現在の年度（例: 2024）の選手・成績データを購読（監視）する
    const yearRef = doc(db, 'teams', user.uid, 'years', String(currentYear));
    const unsubscribe = onSnapshot(yearRef, (docSnap) => {
      if (docSnap.exists()) {
        const yearData = docSnap.data();
        console.log(`${currentYear}年度のデータを読み込みました`);
        setPlayers(yearData.players || []);
        setPlayerStats(yearData.playerStats || {});
      } else {
        // この年度のデータがまだ存在しない場合
        console.log(`${currentYear}年度のデータはまだありません`);
        // setPlayers([]); // (ここは前回の修正通りコメントアウトのまま)
        // setPlayerStats({});
      }
      setIsDataLoading(false); // ★ 読み込み完了（ロック解除）
    }, (error) => { // ★ エラーハンドラを追加
      console.error("選手データの読み込みに失敗:", error);
      setIsDataLoading(false); // ★ エラー時もロック解除
    });

    // コンポーネントが終了する時、またはcurrentYearが変わる時に購読を停止
    return () => unsubscribe();

  }, [user, currentYear]);

// --- ▽▽▽ このブロックを丸ごと追加 ▽▽▽ ---
  useEffect(() => {
    if (!user || !user.uid) return;
    // ★ availableYears が変更されたら、DBのルートに保存
    const teamRef = doc(db, 'teams', user.uid);
    setDoc(teamRef, { 
      availableYears: availableYears
    }, { merge: true });
  }, [availableYears, user]); // ★ availableYears が変わるたびに実行
  // --- △△△ ここまで追加 △△△ ---

useEffect(() => {
    // ★ 読み込み中 or ユーザー未定義なら保存しない
    if (!user || !user.uid || isDataLoading) {
      return; 
    }
    // ★ 現在の年度(currentYear)の場所に保存する
    const yearRef = doc(db, 'teams', user.uid, 'years', String(currentYear)); 
    setDoc(yearRef, { 
      playerStats: playerStats,
      players: players 
    }, { merge: true }); 
  }, [playerStats, players, user, currentYear, isDataLoading]); // ★ 依存配列

  // --- ポジション対応表 ---
  const positionMap = { '投': 'ピッチャー', '捕': 'キャッチャー', '一': 'ファースト', '二': 'セカンド', '三': 'サード', '遊': 'ショート', '左': 'レフト', '中': 'センター', '右': 'ライト' };
  
  // --- ヘルパー関数 & ロジック関数 ---
const setNextBatter = (lastBatterName) => {
    if (!myTeamLineup || myTeamLineup.length === 0) return;

    const lastBatterIndex = myTeamLineup.findIndex(m => m.playerName === lastBatterName);
    
    // 代打などでオーダーにいない選手だった場合は、自動選択しない
    if (lastBatterIndex === -1) {
      setCurrentBatter('');
      return;
    }

    const nextBatterIndex = (lastBatterIndex + 1) % myTeamLineup.length;
    const nextBatter = myTeamLineup[nextBatterIndex];

    if (nextBatter && nextBatter.playerName) {
      setCurrentBatter(nextBatter.playerName);
    } else {
      // 次の打者が空欄の場合は、先頭に戻るか、空のままにする
      setCurrentBatter(myTeamLineup[0]?.playerName || '');
    }
  };

  const getPlayerList = () => players || [];

  // --- ▽▽▽ この関数を丸ごと追加 ▽▽▽ ---
  const handleYearChange = (year) => {
    // 年度切り替え時に、古いデータが残らないよう明示的にリセットする
    console.log(`年度を ${year} に切り替えます。Stateをリセットします。`);
    setIsDataLoading(true); // ★ ロックを追加
    setPlayers([]);
    setPlayerStats({});
    setCurrentYear(year);
  };
  // --- △△△ ここまで追加 △△△ ---

  const sortedPlayers = React.useMemo(() => {
    let sortablePlayers = [...(players || [])];
    if (sortConfig !== null) {
      sortablePlayers.sort((a, b) => {
        const statsA = playerStats[a] || {};
        const statsB = playerStats[b] || {};

        const getValue = (stats, key) => {
          const atBats = stats.atBats || 0;
          const hits = stats.hits || 0;
          const walks = stats.walks || 0;
          const hitByPitches = stats.hitByPitches || 0;
          const plateAppearances = atBats + walks + hitByPitches;

          switch (key) {
            case 'battingAverage':
              return atBats > 0 ? hits / atBats : 0;
            case 'onBasePercentage':
              return plateAppearances > 0 ? (hits + walks + hitByPitches) / plateAppearances : 0;
            case 'plateAppearances':
              return plateAppearances;
            default:
              return stats[key] || 0;
          }
        };

        const valueA = getValue(statsA, sortConfig.key);
        const valueB = getValue(statsB, sortConfig.key);

        if (valueA < valueB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valueA > valueB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortablePlayers;
  }, [players, playerStats, sortConfig]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const truncateTeamName = (name) => {
    if (name && name.length > 4) return name.substring(0, 2) + '..';
    return name;
  };

  const getCurrentTeamName = () => {
    const myTeam = myTeamNameForGame || selectedGameTeam;
    if (isHomeTeam) {
      return currentTeamBatting === 'away' ? truncateTeamName(opponentTeam) : myTeam;
    } else {
      return currentTeamBatting === 'away' ? myTeam : truncateTeamName(opponentTeam);
    }
  };
  
  const resetGameStates = () => {
    setIsStatsRecordingEnabled(true);
    setTournamentName('');
    setOpponentTeam('');
    setIsHomeTeam(true);
    setCurrentInning(1);
    setCurrentTeamBatting('away');
    setOutCount(0);
    setBases({ first: false, second: false, third: false });
    setHomeScore(Array(7).fill(null));
    setAwayScore(Array(7).fill(null));
    setHomeHits(0);
    setAwayHits(0);
    setTimeline([]);
    setCurrentBatter('');
    setCustomBatter('');
    setUseCustomBatter(false);
    setFreeComment('');
    setGameStartDate(null);
    setGameId(null);
    setIsGameCreator(false);
    
    setWatchingGameId('');
    setResumeGameId('');
    setSelectedGameTimeline(null);
    setHistory([]);
    setInGameStats({});
    setBsoCount({ b: 0, s: 0 });
    setMyTeamNameForGame('');
    setMyTeamPitcher('');
    setOpponentPitcher('');
    setLikeCount(0);
    setMyTeamLineup(Array(9).fill({ playerName: '', position: '' }));
    setOpponentLineup(Array(9).fill({ playerName: '', position: '' }));
  };

  const returnToSetup = () => {
    if (firebaseListener.current) {
      stopWatching(firebaseListener.current);
      firebaseListener.current = null;
    }
    resetGameStates();
    setGameState('setup');
  };

  const saveCurrentGameState = useCallback(async () => {
    if (!gameId || !isGameCreator) return;
    const currentState = {
      myTeamLineup,
      opponentLineup,
      myTeamNameForGame,
      bsoCount,
      inGameStats,
      myTeamPitcher,
      opponentPitcher,
      isStatsRecordingEnabled,
      tournamentName,
      opponentTeam,
      isHomeTeam,
      currentInning,
      currentTeamBatting,
      outCount,
      bases,
      homeScore,
      awayScore,
      homeHits,
      awayHits,
      timeline,
      currentBatter,
      customBatter,
      useCustomBatter,
      gameStartDate,
      createdAt: gameStartDate || Date.now(),
    };
    try {
      await saveGameState(user.uid, currentYear, gameId, currentState);
    } catch (error) {
      console.error('保存失敗:', error);
    }
  }, [
    user.uid, gameId, isGameCreator, myTeamNameForGame, bsoCount, inGameStats, myTeamPitcher, opponentPitcher, isStatsRecordingEnabled, tournamentName, opponentTeam, isHomeTeam, currentInning, 
    currentTeamBatting, outCount, bases, homeScore, awayScore, homeHits, awayHits,
    timeline, currentBatter, customBatter, useCustomBatter, gameStartDate, myTeamLineup, opponentLineup, currentYear
  ]);

  // ★useEffectの依存配列を修正
  useEffect(() => {
    if (!isGameCreator || gameState !== 'playing' || isResuming) {
      return;
    }
    saveCurrentGameState();
  }, [gameState, isGameCreator, isResuming, saveCurrentGameState]);
  
  const loadGame = async (id, mode = 'watch') => {
    const gameIdToLoad = id;
    if (!gameIdToLoad || gameIdToLoad.trim() === '') {
      alert('試合IDを入力してください。');
      return;
    }
    if (firebaseListener.current) {
      stopWatching(firebaseListener.current);
      firebaseListener.current = null;
    }

    const profiles = initialTeamData.teamProfiles || [initialTeamData.teamName || 'あなたのチーム'];
    const gameRef = doc(db, 'teams', user.uid, 'years', String(currentYear), 'games', gameIdToLoad);
    
    // --- ▽▽▽ 修正ここから ▽▽▽ ---
    if (mode === 'resume') {
      // ★ 1. 先にデータが存在するか「1回だけ」チェック
      try {
        const docSnap = await getDoc(gameRef); // ★ getDoc を使用
        if (!docSnap.exists()) {
          alert('指定された試合IDが見つかりませんでした。\n（年度が正しいか確認してください）');
          return; // ★ 画面遷移せず終了
        }
      

    // 2. 取得したデータでStateをセット
        const data = docSnap.data();
        setMyTeamNameForGame(data.myTeamNameForGame || profiles[0]);
        setBsoCount(data.bsoCount || { b: 0, s: 0 });
        setInGameStats(data.inGameStats || {});
        setMyTeamPitcher(data.myTeamPitcher || '');
        setOpponentPitcher(data.opponentPitcher || '');
        setIsStatsRecordingEnabled(data.isStatsRecordingEnabled !== undefined ? data.isStatsRecordingEnabled : true);
        setTournamentName(data.tournamentName || '');
        setOpponentTeam(data.opponentTeam || '');
        setIsHomeTeam(data.isHomeTeam === true);
        setCurrentInning(typeof data.currentInning === 'number' ? data.currentInning : 1);
        setCurrentTeamBatting(data.currentTeamBatting || 'away');
        setOutCount(typeof data.outCount === 'number' ? data.outCount : 0);
        setBases(data.bases && typeof data.bases === 'object' ? data.bases : { first: false, second: false, third: false });
        setHomeScore(Array.isArray(data.homeScore) ? data.homeScore : Array(7).fill(null));
        setAwayScore(Array.isArray(data.awayScore) ? data.awayScore : Array(7).fill(null));
        setHomeHits(data.homeHits || 0);
        setAwayHits(data.awayHits || 0);
        setTimeline(Array.isArray(data.timeline) ? data.timeline : []);
        setCurrentBatter(data.currentBatter || '');
        setCustomBatter(data.customBatter || '');
        setUseCustomBatter(data.useCustomBatter === true);
        setGameStartDate(typeof data.gameStartDate === 'number' ? data.gameStartDate : null);
        setLikeCount(data.likeCount || 0);
        setMyTeamLineup(data.myTeamLineup || Array(9).fill({ playerName: '', position: '' }));
        setOpponentLineup(data.opponentLineup || Array(9).fill({ playerName: '', position: '' }));
        
        // 3. 画面遷移
  	  	setIsResuming(true); // 自動保存はまだロック
  	  	setGameId(gameIdToLoad);
  	  	setIsGameCreator(true);
  	  	setGameState('playing');
  	  	// ★ 記録者モードでは監視(watchGameState)は開始しない ★

      } catch (error) {
  	  	console.error("試合の読み込みチェックに失敗:", error);
  	  	alert('試合の読み込みに失敗しました。');
  	  	return;
  	  }

  	} else if (mode === 'watch') {
  	  // --- 観戦モード ---
  	  // 1. 即座に画面遷移
  	  setGameId(gameIdToLoad);
  	  setIsGameCreator(false);
  	  setGameState('watching');
  	   
  	  // 2. 監視(watchGameState)を開始
  	  const newListener = watchGameState(user.uid, currentYear, gameIdToLoad, (doc) => {
  	  	if (doc.exists()) {
  	  	  const data = doc.data();
  	  	  // 3. 取得したデータでStateをセット
  	  	  setMyTeamNameForGame(data.myTeamNameForGame || profiles[0]);
  	  	  setBsoCount(data.bsoCount || { b: 0, s: 0 });
  	  	  setInGameStats(data.inGameStats || {});
  	  	  setMyTeamPitcher(data.myTeamPitcher || '');
  	  	  setOpponentPitcher(data.opponentPitcher || '');
  	  	  setIsStatsRecordingEnabled(data.isStatsRecordingEnabled !== undefined ? data.isStatsRecordingEnabled : true);
  	  	  setTournamentName(data.tournamentName || '');
  	  	  setOpponentTeam(data.opponentTeam || '');
  	  	  setIsHomeTeam(data.isHomeTeam === true);
  	  	  setCurrentInning(typeof data.currentInning === 'number' ? data.currentInning : 1);
  	  	  setCurrentTeamBatting(data.currentTeamBatting || 'away');
  	  	  setOutCount(typeof data.outCount === 'number' ? data.outCount : 0);
  	  	  setBases(data.bases && typeof data.bases === 'object' ? data.bases : { first: false, second: false, third: false });
  	  	  setHomeScore(Array.isArray(data.homeScore) ? data.homeScore : Array(7).fill(null));
  	  	  setAwayScore(Array.isArray(data.awayScore) ? data.awayScore : Array(7).fill(null));
  	  	  setHomeHits(data.homeHits || 0);
  	  	  setAwayHits(data.awayHits || 0);
  	  	  setTimeline(Array.isArray(data.timeline) ? data.timeline : []);
  	  	  setCurrentBatter(data.currentBatter || '');
  	  	  setCustomBatter(data.customBatter || '');
  	  	  setUseCustomBatter(data.useCustomBatter === true);
  	  	  setGameStartDate(typeof data.gameStartDate === 'number' ? data.gameStartDate : null);
  	  	  setLikeCount(data.likeCount || 0);
  	  	  setMyTeamLineup(data.myTeamLineup || Array(9).fill({ playerName: '', position: '' }));
  	  	  setOpponentLineup(data.opponentLineup || Array(9).fill({ playerName: '', position: '' }));
  	  	} else {
  	  	  alert('監視対象の試合データが見つからなくなりました。セットアップ画面に戻ります。');
  	  	  returnToSetup();
  	  	}
  	  }, (error) => {
  	  	console.error('[App.js] Firebaseからのデータ取得でエラーが発生しました。', error);
  	  	alert('データの読み込みに失敗しました。');
  	  	returnToSetup();
  	  });
  	  firebaseListener.current = newListener;
  	}
  };
  


  


  const saveStateToHistory = () => {
    // ★ 試合再開後、最初の操作が行われたらこのフラグをfalseにする
    if (isResuming) {
      setIsResuming(false);
    }
    const currentState = {
      myTeamLineup,
      opponentLineup,
      outCount,
      homeScore: [...homeScore],
      awayScore: [...awayScore],
      bases: { ...bases },
      timeline: [...timeline],
      homeHits,
      awayHits,
      inGameStats: { ...inGameStats },
      bsoCount: { ...bsoCount },
      currentInning,
      currentTeamBatting,
      myTeamPitcher,
      opponentPitcher,
    };
    setHistory(prev => [...prev, currentState].slice(-10));
  };
  
  const undoLastAction = () => {
    if (history.length === 0) {
      alert("元に戻せる操作がありません。");
      return;
    }
    const lastState = history[history.length - 1];
    setOutCount(lastState.outCount);
    setHomeScore(lastState.homeScore);
    setAwayScore(lastState.awayScore);
    setBases(lastState.bases);
    setTimeline(lastState.timeline);
    setHomeHits(lastState.homeHits);
    setAwayHits(lastState.awayHits);
    setInGameStats(lastState.inGameStats);
    setBsoCount(lastState.bsoCount);
    setCurrentInning(lastState.currentInning);
    setCurrentTeamBatting(lastState.currentTeamBatting);
    setMyTeamPitcher(lastState.myTeamPitcher);
    setOpponentPitcher(lastState.opponentPitcher);
    setHistory(prev => prev.slice(0, -1));
    alert("直前の操作を取り消しました。");
  };

  const startGame = () => {
    if (!opponentTeam) {
      alert('対戦相手のチーム名を入力してください');
      return;
    }
    if (!selectedGameTeam) {
      alert('試合を行うチームを選択してください');
      return;
    }
    const gameOpponent = opponentTeam;
    const gameTournament = tournamentName;
    const gameIsHome = isHomeTeam;
    const gameRecordStats = isStatsRecordingEnabled;
    const gameMyTeam = selectedGameTeam;
    const gameMyLineup = myTeamLineup;
    const gameOpponentLineup = opponentLineup;
    resetGameStates();
    setOpponentTeam(gameOpponent);
    setTournamentName(gameTournament);
    setIsHomeTeam(gameIsHome);
    setIsStatsRecordingEnabled(gameRecordStats);
    setMyTeamNameForGame(gameMyTeam);
    setMyTeamLineup(gameMyLineup);
    setOpponentLineup(gameOpponentLineup);
    const newGameId = generateGameId();
    setGameStartDate(Date.now());
    setGameId(newGameId);
    const message = `◆試合速報開始◆\n${gameTournament}\n対 ${gameOpponent}`;
    setDialogTitle('共有メッセージ');
    setShareMessage(message);
    setIsGameCreator(true);
    setGameState('playing');
    setCurrentTeamBatting('away');
    addToTimeline(`試合開始！ (${gameMyTeam} vs ${gameOpponent})`);
    setShowShareDialog(true);
  };

  const addToTimeline = (message, eventDetails = {}) => {
    const timestamp = new Date().toLocaleTimeString();
    const currentHalf = currentTeamBatting === 'away' ? '表' : '裏';
    const newEntry = {
      time: timestamp,
      message: message,
      inning: eventDetails.inning !== undefined ? eventDetails.inning : currentInning,
      inningHalf: eventDetails.inningHalf !== undefined ? eventDetails.inningHalf : currentHalf,
      team: eventDetails.team !== undefined ? eventDetails.team : getCurrentTeamName(),
      outCount: eventDetails.outCount !== undefined ? eventDetails.outCount : outCount,
    };
    setTimeline(prev => [newEntry, ...prev]);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      alert('テキストをコピーしました！');
    } catch (err) {
      console.error('コピー失敗:', err);
    }
  };

  const processOut = () => {
    const newOutCount = outCount + 1;
    setOutCount(newOutCount);
    const inningShouldChange = newOutCount >= 3;
    return { newOutCount, inningShouldChange };
  };

  const addOut = () => {
    saveStateToHistory();
    const { newOutCount, inningShouldChange } = processOut();
    addToTimeline(`アウト！ (${newOutCount}アウト)`, { outCount: newOutCount });
    if (inningShouldChange) {
      changeInning();
    }
  };
  
  const addRun = () => {
    saveStateToHistory();
    const currentScoringTeam = getCurrentTeamName();
    if ((isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away')) {
      if (isHomeTeam) {
        setHomeScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + 1; return ns; });
      } else {
        setAwayScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + 1; return ns; });
      }
    } else {
      if (isHomeTeam) {
        setAwayScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + 1; return ns; });
      } else {
        setHomeScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + 1; return ns; });
      }
    }
    addToTimeline(`得点！ (${currentScoringTeam})`);
  };

  const changeInning = () => {
    saveStateToHistory();
    if ((isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away')) {
      if (isHomeTeam) setHomeScore(prev => { const ns = [...prev]; if (ns[currentInning - 1] === null) ns[currentInning - 1] = 0; return ns; });
      else setAwayScore(prev => { const ns = [...prev]; if (ns[currentInning - 1] === null) ns[currentInning - 1] = 0; return ns; });
    } else {
      if (isHomeTeam) setAwayScore(prev => { const ns = [...prev]; if (ns[currentInning - 1] === null) ns[currentInning - 1] = 0; return ns; });
      else setHomeScore(prev => { const ns = [...prev]; if (ns[currentInning - 1] === null) ns[currentInning - 1] = 0; return ns; });
    }
    const nextInning = currentTeamBatting === 'away' ? currentInning : currentInning + 1;
    const nextTeamBatting = currentTeamBatting === 'away' ? 'home' : 'away';
    let nextTeamName;
    const myTeam = myTeamNameForGame || selectedGameTeam;
    if (nextTeamBatting === 'home') {
      nextTeamName = isHomeTeam ? myTeam : opponentTeam;
    } else {
      nextTeamName = isHomeTeam ? opponentTeam : myTeam;
    }
    const inningHalf = (nextTeamBatting === 'home') ? '裏' : '表';
    const message = `${nextInning}回${inningHalf}開始`;
    addToTimeline(message, { inning: nextInning, team: truncateTeamName(nextTeamName), outCount: 0, inningHalf: inningHalf });
    setCurrentTeamBatting(nextTeamBatting);
    setCurrentInning(nextInning);
    setOutCount(0);
    setBases({ first: false, second: false, third: false });
  };

  const forceChange = () => {
    saveStateToHistory();
    changeInning();
  };

  const postFreeComment = () => {
    saveStateToHistory();
    if (!freeComment.trim()) return;
    addToTimeline(freeComment.trim());
    setFreeComment('');
  };

  const postOutRunnerComment = () => {
    saveStateToHistory();
    const outText = ['無死', '一死', '二死'][outCount] || '三死';
    const runnerParts = [];
    if (bases.first) runnerParts.push('一塁');
    if (bases.second) runnerParts.push('二塁');
    if (bases.third) runnerParts.push('三塁');

    let runnerText = '';
    if (runnerParts.length === 0) {
      runnerText = '走者なし';
    } else if (runnerParts.length === 3) {
      runnerText = '満塁';
    } else {
      runnerText = runnerParts.join('、');
    }
    const message = `【状況】${outText} ${runnerText}`;
    addToTimeline(message);
  };

  const toggleBso = (type) => {
    saveStateToHistory();
    setBsoCount(prev => {
      const newCount = { ...prev };
      if (type === 'b') {
        newCount.b = (newCount.b + 1) % 4;
      } else if (type === 's') {
        newCount.s = (newCount.s + 1) % 3;
      }
      return newCount;
    });
  };

  const resetBso = () => {
    setBsoCount({ b: 0, s: 0 });
  };

  const handleBattingResult = (result) => {
    saveStateToHistory();
    const batterName = useCustomBatter ? customBatter : currentBatter;
    if (!batterName) {
      alert('打者名を選択または入力してください');
      return;
    }
    let resultText = result;
    if (selectedPosition && positionMap[selectedPosition]) {
      resultText = `${result} (${positionMap[selectedPosition]})`;
    }
    let message = `${batterName}: ${resultText}`;
    let runsScored = 0;
    let isAnOut = false;

    const statsUpdate = {};
    const isHit = ['ヒット', '2ベース', '3ベース', 'ホームラン'].includes(result);
    const isWalkOrHBP = ['四球', '死球'].includes(result);
    const isStrikeout = result === '三振';
    const isAtBat = !isWalkOrHBP && result !== 'バント';
    
    if (isAtBat) statsUpdate.atBats = 1;
    if (isHit) {
      statsUpdate.hits = 1;
      const isMyTeamBatting = (isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away');
      if (isMyTeamBatting) {
        if (isHomeTeam) setHomeHits(h => h + 1);
        else setAwayHits(h => h + 1);
      } else {
        if (isHomeTeam) setAwayHits(h => h + 1);
        else setHomeHits(h => h + 1);
      }
    }

    if (isWalkOrHBP) {
      if (result === '四球') statsUpdate.walks = 1;
      else statsUpdate.hitByPitches = 1;
    }
    if (isStrikeout) statsUpdate.strikeouts = 1;

    switch (result) {
      case '三振': case 'ゴロ': case 'ライナー': case 'フライ': isAnOut = true; break;
      case 'ヒット': if (bases.third) runsScored++; setBases(prev => ({ first: true, second: prev.first, third: prev.second })); break;
      case '2ベース': statsUpdate.doubles = 1; if (bases.third) runsScored++; if (bases.second) runsScored++; setBases(prev => ({ first: false, second: true, third: prev.first })); break;
      case '3ベース': statsUpdate.triples = 1; if (bases.third) runsScored++; if (bases.second) runsScored++; if (bases.first) runsScored++; setBases({ first: false, second: false, third: true }); break;
      case 'ホームラン': statsUpdate.homeRuns = 1; runsScored = 1 + (bases.first ? 1 : 0) + (bases.second ? 1 : 0) + (bases.third ? 1 : 0); setBases({ first: false, second: false, third: false }); break;
      case '四球': case '死球': if (bases.first && bases.second && bases.third) runsScored++; setBases(prev => ({ first: true, second: prev.first ? true : prev.second, third: prev.first && prev.second ? true : prev.third })); break;
      default: break;
    }

    if (runsScored > 0) {
      statsUpdate.rbi = (statsUpdate.rbi || 0) + runsScored;
      const isMyTeamBatting = (isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away');
      if (isMyTeamBatting) {
        if (isHomeTeam) setHomeScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + runsScored; return ns; });
        else setAwayScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + runsScored; return ns; });
      } else {
        if (isHomeTeam) setAwayScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + runsScored; return ns; });
        else setHomeScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + runsScored; return ns; });
      }
      message += ` (${runsScored}点獲得！)`;
    }
    
    const nextOutCount = isAnOut ? outCount + 1 : outCount;
    addToTimeline(message, { outCount: nextOutCount });
    
    if (isAnOut) {
      const { newOutCount, inningShouldChange } = processOut();
      addToTimeline(`アウト！ (${newOutCount}アウト)`, { outCount: newOutCount });
      if (inningShouldChange) {
        changeInning();
      }
    }

    if (Object.keys(statsUpdate).length > 0) {
      setInGameStats(prev => {
        const newStats = { ...prev };
        const player = { ...(newStats[batterName] || {}) };
        for (const key in statsUpdate) {
          player[key] = (player[key] || 0) + statsUpdate[key];
        }
        newStats[batterName] = player;
        return newStats;
      });
      if (isStatsRecordingEnabled) {
          setPlayerStats(prev => {
          const newStats = { ...prev };
          const player = { ...(newStats[batterName] || {}) };
          for (const key in statsUpdate) {
            player[key] = (player[key] || 0) + statsUpdate[key];
          }
          newStats[batterName] = player;
          return newStats;
        });
      }
    }

    const isMyTeamBatting = (isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away');

    if (isMyTeamBatting) {
      setNextBatter(batterName);
    } else {
      setCurrentBatter('');
    }

    setCustomBatter('');
    setUseCustomBatter(false);
    setSelectedPosition(null);
    resetBso();
  };
  
  const handleSpecialRecord = (type) => {
    if (type === 'stolenBase') {
      setShowStolenBaseModal(true);
      setStealingPlayer(null);
      return;
    }
    
    saveStateToHistory();
    const batterName = useCustomBatter ? customBatter : currentBatter;
    if (!batterName) {
      alert('記録を残す打者を選択してください');
      return;
    }

    let statsUpdate = {};
    let message = '';
    let isSacFly = false;
    let runsToAdd = 0;

    switch (type) {
      case 'rbi_sac_fly':
        statsUpdate.rbi = 1;
        message = `${batterName}: 犠牲フライ（1打点）`;
        isSacFly = true;
        runsToAdd = 1;
        break;
      case 'rbi_other':
        statsUpdate.rbi = 1;
        message = `${batterName}: 打点1`;
        runsToAdd = 1;
        break;
      default:
        return;
    }

    addToTimeline(message);

    if (isSacFly) {
  const { newOutCount, inningShouldChange } = processOut();
  addToTimeline(`アウト！ (${newOutCount}アウト)`, { outCount: newOutCount });
  
  const isMyTeamBatting = (isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away');
  if (isMyTeamBatting) {
    setNextBatter(batterName);
  } else {
    setCurrentBatter('');
  }

  if (inningShouldChange) {
    changeInning();
  } else {
    resetBso();
  }
}

    if (runsToAdd > 0) {
      const isMyTeamBatting = (isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away');
      if (isMyTeamBatting) {
        if (isHomeTeam) setHomeScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + runsToAdd; return ns; });
        else setAwayScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + runsToAdd; return ns; });
      } else {
        if (isHomeTeam) setAwayScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + runsToAdd; return ns; });
        else setHomeScore(prev => { const ns = [...prev]; ns[currentInning - 1] = (ns[currentInning - 1] || 0) + runsToAdd; return ns; });
      }
    }
    
    if (Object.keys(statsUpdate).length > 0) {
      setInGameStats(prev => {
        const newStats = { ...prev };
        const player = { ...(newStats[batterName] || {}) };
        for (const key in statsUpdate) {
          player[key] = (player[key] || 0) + statsUpdate[key];
        }
        newStats[batterName] = player;
        return newStats;
      });
      if (isStatsRecordingEnabled) {
          setPlayerStats(prev => {
          const newStats = { ...prev };
          const player = { ...(newStats[batterName] || {}) };
          for (const key in statsUpdate) {
            player[key] = (player[key] || 0) + statsUpdate[key];
          }
          newStats[batterName] = player;
          return newStats;
        });
      }
    }
  };

  const recordStolenBase = (playerName, stealType) => {
    saveStateToHistory();
    const statsUpdate = { stolenBases: 1 };
    
    setInGameStats(prev => {
      const newStats = { ...prev };
      const player = { ...(newStats[playerName] || {}) };
      player.stolenBases = (player.stolenBases || 0) + 1;
      newStats[playerName] = player;
      return newStats;
    });

    if (isStatsRecordingEnabled) {
        setPlayerStats(prev => {
        const newStats = { ...prev };
        const player = { ...(newStats[playerName] || {}) };
        player.stolenBases = (player.stolenBases || 0) + 1;
        newStats[playerName] = player;
        return newStats;
      });
    }
  
    addToTimeline(`${playerName}: ${stealType}成功！`);
    setShowStolenBaseModal(false);
  };

  const toggleBase = (base) => {
    saveStateToHistory();
    setBases(prev => ({ ...prev, [base]: !prev[base] }));
  };

  const endGame = () => {
    const finalHomeScore = homeScore.reduce((a, b) => (a || 0) + (b || 0), 0);
    const finalAwayScore = awayScore.reduce((a, b) => (a || 0) + (b || 0), 0);
    const myTeam = myTeamNameForGame || selectedGameTeam;
    let winner = isHomeTeam ? (finalHomeScore > finalAwayScore ? myTeam : opponentTeam) : (finalAwayScore > finalHomeScore ? myTeam : opponentTeam);
    if (finalHomeScore === finalAwayScore) winner = '引き分け';
    // eslint-disable-next-line no-unused-vars
    const gameData = {
      myTeamLineup: myTeamLineup,
      opponentLineup: opponentLineup,
      myTeamNameForGame: myTeam,
      inGameStats: inGameStats,
      tournamentName: tournamentName,
      gameId: gameId,
      date: new Date().toLocaleDateString(),
      opponentTeam: opponentTeam,
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      winner: winner,
      timeline: timeline,
      isHomeTeam: isHomeTeam,
      homeScoreInnings: homeScore.map(s => s === null ? 0 : s),
      awayScoreInnings: awayScore.map(s => s === null ? 0 : s)
    };

// --- ▽▽▽ 試合結果テキスト生成（ここから） ▽▽▽ ---
    
    // 1. 自チームと相手チームの最終スコアを確定
    const myFinalScore = isHomeTeam ? finalHomeScore : finalAwayScore;
    const opponentFinalScore = isHomeTeam ? finalAwayScore : finalHomeScore;

    // 2. 勝敗に応じた絵文字と記号を決定
    let resultPrefix = '△'; // 引き分けがデフォルト
    let resultSuffix = '';

    if (winner === myTeam) {
      resultPrefix = '〇';
      resultSuffix = '✨';
    } else if (winner === opponentTeam) {
      resultPrefix = '●';
      resultSuffix = '💧';
    }

    // 3. スコアテキストを作成
    const scoreText = `${resultPrefix}${myFinalScore}-${opponentFinalScore}${resultSuffix}`;
    
    // 4. 大会名（あれば）を追加
    const tournamentText = tournamentName ? `${tournamentName}\n` : '';

    // 5. 最終的なメッセージを組み立て
    const resultMessage = `◇試合結果◇\n${tournamentText}対${opponentTeam}\n${scoreText}`;

    // 6. ★ promptの代わりにダイアログ用のStateをセット
    setDialogTitle('◇試合結果◇');
    setShareMessage(resultMessage);
    setShowShareDialog(true);

    // --- △△△ 試合結果テキスト生成（ここまで） △△△ ---

    resetGameStates();
    setGameState('setup');
  };

  // eslint-disable-next-line no-unused-vars
  const showTimeline = (game) => {
    setSelectedGameTimeline(game);
    setMyTeamLineup(game.myTeamLineup || Array(9).fill({ playerName: '', position: '' }));
    setOpponentLineup(game.opponentLineup || '');
    setGameState('timeline');
  };

const handleFetchFirebaseGames = async () => {
    setIsLoading(true);
    try { 
      // ★ currentYear を渡すように修正
      const games = await getAllGames(user.uid, currentYear); 
      
      setFirebaseGames(games || []); // (念のため || [] を追加)
      setGameState('firebaseList'); 
    } catch (error) { 
      console.error("試合一覧の読み込みに失敗しました: ", error);
      alert("試合一覧の読み込みに失敗しました。");
    } finally { 
      setIsLoading(false);
    }
  };

// --- ▽▽▽ 新聞生成関数（先攻・後攻対応版） ▽▽▽ ---
      const handleGenerateReport = async () => {
  // 1. 実行の確認
        if (!window.confirm('AI戦評新聞を作成しますか？\n（作成には10〜20秒ほどかかります）')) {
          return;
        }

        // 2. パスワードの確認（削除用パスワードを流用）
        const correctPassword = initialTeamData.deletePassword;
        if (!correctPassword) {
          alert('パスワードが設定されていません。\n「選手管理」画面で削除用パスワードを設定してください。');
          return;
        }

        const inputPassword = prompt('機能を使用するにはパスワードを入力してください：');
        if (inputPassword === null) return; // キャンセルされた場合
        if (inputPassword !== correctPassword) {
          alert('パスワードが違います。');
          return;
        }

        const totalHome = homeScore.reduce((a, b) => a + (b || 0), 0);
        const totalAway = awayScore.reduce((a, b) => a + (b || 0), 0);
        let currentWinner = '引き分け';
        const myTeam = myTeamNameForGame || selectedGameTeam;

        if (totalHome !== totalAway) {
          if (isHomeTeam) {
            currentWinner = totalHome > totalAway ? myTeam : opponentTeam;
          } else {
            currentWinner = totalAway > totalHome ? myTeam : opponentTeam;
          }
        }
        
        setShowNewspaper(true);
        setIsGenerating(true);

        // 先攻(Top)は常にAway、後攻(Bottom)は常にHome
        const topTeamName = isHomeTeam ? opponentTeam : myTeam;    // 自分が後攻なら、相手が先攻
        const bottomTeamName = isHomeTeam ? myTeam : opponentTeam; // 自分が後攻なら、自分が後攻

        // ★ イニングごとのスコア配列を取得
        const topScoreArray = awayScore; 
        const bottomScoreArray = homeScore;

        const topTeamScore = totalAway;
        const bottomTeamScore = totalHome;

        // ★★★ 修正ポイント3：タイムラインを時系列順（古い順）にする ★★★
        // そのまま送ると「最新」が上に来てしまうので、コピーして逆転(.reverse)させます
        const chronologicalTimeline = [...timeline].reverse();

        const gameDataForAI = {
          tournamentName: tournamentName,
          date: formatDate(gameStartDate),
          myTeam: myTeam,
          opponentTeam: opponentTeam,
          totalMyScore: isHomeTeam ? totalHome : totalAway,
          totalOpponentScore: isHomeTeam ? totalAway : totalHome,
          winner: currentWinner,
          // ★ AIに渡す情報を追加
          topTeam: topTeamName,
          bottomTeam: bottomTeamName,
          topScore: topTeamScore,
          bottomScore: bottomTeamScore,
          topScoreArray: topScoreArray,
          bottomScoreArray: bottomScoreArray,
          timeline: timeline,
          hitLeaders: (getPlayerList() || [])
            .filter(p => inGameStats?.[p]?.hits > 0)
            .map(p => ({ name: p, count: inGameStats[p].hits }))
           .sort((a, b) => b.count - a.count)
        };

        setNewspaperGameData(gameDataForAI);

        try {
          const response = await fetch('/api/generate-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameData: gameDataForAI }),
          });

          if (!response.ok) throw new Error('Generation failed');

          const data = await response.json();
          setNewspaperData(data);
        } catch (error) {
          console.error(error);
          alert('記事の作成に失敗しました。');
          setShowNewspaper(false);
        } finally {
          setIsGenerating(false);
        }
      };
      // --- △△△ 新聞生成関数（修正版） △△△ ---

  const handleDeleteFirebaseGame = async (gameIdToDelete) => {
    const correctPassword = initialTeamData.deletePassword;
    if (!correctPassword) {
      alert('削除用パスワードが設定されていません。選手管理画面で設定してください。');
      return;
    }
    const password = prompt("削除するにはパスワードを入力してください：");
    if (password === null) return;
    if (password !== correctPassword) {
      alert('パスワードが違います。');
      return;
    }
    if (window.confirm(`試合ID: ${gameIdToDelete} のデータを完全に削除しますか？`)) {
      const success = await deleteGameFromFirebase(user.uid, currentYear, gameIdToDelete);
      if (success) {
        setFirebaseGames(prevGames => prevGames.filter(game => game.id !== gameIdToDelete));
        alert('試合データを削除しました。');
      }
    }
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) {
      alert('追加する選手の名前を入力してください。');
      return;
    }
    const newPlayer = newPlayerName.trim();
    if (players.includes(newPlayer)) {
      alert('同じ名前の選手が既に存在します。');
      return;
    }
    setPlayerStats(prev => ({
      ...prev,
      [newPlayer]: {
        atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0, hitByPitches: 0, stolenBases: 0
      }
    }));
    setPlayers(prev => [...prev, newPlayer]);
    setNewPlayerName('');
  };

  const handleDeletePlayer = (playerToDelete) => {
    if (window.confirm(`「${playerToDelete}」を名簿から削除しますか？成績データも全て削除されます。`)) {
      const updatedStats = { ...playerStats };
      delete updatedStats[playerToDelete];
      setPlayerStats(updatedStats);
      setPlayers(prev => prev.filter(player => player !== playerToDelete));
    }
  };

  const movePlayerUp = (index) => {
    if (index === 0) return;
    const newPlayers = [...players];
    [newPlayers[index - 1], newPlayers[index]] = [newPlayers[index], newPlayers[index - 1]];
    setPlayers(newPlayers);
  };

  const movePlayerDown = (index) => {
    if (index === players.length - 1) return;
    const newPlayers = [...players];
    [newPlayers[index + 1], newPlayers[index]] = [newPlayers[index], newPlayers[index + 1]];
    setPlayers(newPlayers);
  };

  const handleEditPlayer = (playerName) => {
    const correctPassword = initialTeamData.deletePassword;
    if (!correctPassword) {
      alert('編集・削除用のパスワードが設定されていません。\n選手管理画面で設定してください。');
      return;
    }
    const password = prompt("編集するにはパスワードを入力してください：");
    if (password === null) {
      return;
    }
    if (password === correctPassword) {
      setEditingPlayer(playerName);
      setTempStats(playerStats[playerName] || {});
    } else {
      alert('パスワードが違います。');
    }
  };

  const handleStatChange = (statName, value) => {
    setTempStats(prev => ({ ...prev, [statName]: parseInt(value, 10) || 0 }));
  };

const handleSaveStats = (playerName) => { // ★ async を削除
    if (window.confirm(`「${playerName}」の成績を保存しますか？`)) {
      // ★ Stateを更新するだけにする (自動保存useEffectがDBに書き込む)
      setPlayerStats(prev => ({ ...prev, [playerName]: tempStats }));
      alert('成績を保存しました。');
      setEditingPlayer(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingPlayer(null);
  };

  const handleUpdatePassword = async () => {
    if (currentPassword !== initialTeamData.deletePassword) {
      alert('現在のパスワードが違います。');
      return;
    }
    if (!newPassword) {
      alert('新しいパスワードを入力してください。');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('新しいパスワードが一致しません。');
      return;
    }
    const success = await updateTeamData(user.uid, { deletePassword: newPassword });
    if (success) {
      alert('パスワードを更新しました。');
      initialTeamData.deletePassword = newPassword; 
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      alert('パスワードの更新に失敗しました。');
    }
  };

  // ★この関数と、その下の`return`文内の`GameHighlights`コンポーネントの定義を、
  // State宣言の後に移動させます
  const GameHighlights = ({ inGameStats, players }) => {
    const getPlayersWithStat = (statName) => {
      return (players || [])
        .filter(playerName => inGameStats[playerName] && inGameStats[playerName][statName] > 0)
        .map(playerName => ({ name: playerName, count: inGameStats[playerName][statName] }));
    };
    const homeRunHitters = getPlayersWithStat('homeRuns');
    const hitLeaders = getPlayersWithStat('hits');
    const stolenBaseLeaders = getPlayersWithStat('stolenBases');
    if (homeRunHitters.length === 0 && hitLeaders.length === 0 && stolenBaseLeaders.length === 0) {
      return null;
    }
    return (
      <div className="bg-white bg-opacity-20 rounded-lg p-3 mt-3 text-xs">
        {homeRunHitters.length > 0 && <div className="mb-2"><h4 className="font-bold text-yellow-300">本塁打</h4><p className="text-white">{homeRunHitters.map(p => `${p.name}(${p.count})`).join('、 ')}</p></div>}
        {hitLeaders.length > 0 && <div className="mb-2"><h4 className="font-bold text-yellow-300">安打</h4><p className="text-white">{hitLeaders.map(p => `${p.name}(${p.count})`).join('、 ')}</p></div>}
        {stolenBaseLeaders.length > 0 && <div><h4 className="font-bold text-yellow-300">盗塁</h4><p className="text-white">{stolenBaseLeaders.map(p => `${p.name}(${p.count})`).join('、 ')}</p></div>}
      </div>
    );
  };
 
  // --- ▽▽▽ このブロックを丸ごと挿入 ▽▽▽ ---
  if (gameState === 'scoreEditor') {
    const handleSaveScores = (newHomeScore, newAwayScore) => {
      saveStateToHistory(); 
      setHomeScore(newHomeScore);
      setAwayScore(newAwayScore);
      addToTimeline("スコアボードが手動で修正されました。");
      setGameState('playing'); // ★ setShowScoreEditor(false) から変更
    };
    return (
      <ScoreEditor
        initialHomeScore={homeScore}
        initialAwayScore={awayScore}
        myTeamName={myTeamNameForGame || selectedGameTeam}
        opponentTeamName={opponentTeam}
        isHomeTeam={isHomeTeam}
        onSave={handleSaveScores}
        onBack={() => setGameState('playing')}
      />
    );
  }
  // --- △△△ ここまで挿入 △△△ ---

  // --- JSX ---
if (showLineupEditor) {
    const handleSaveLineup = (newLineup, newOpponentLineup) => {
      setMyTeamLineup(newLineup);
      setOpponentLineup(newOpponentLineup);
      setShowLineupEditor(false);
    };
    return (
      <LineupEditor
        players={getPlayerList()}
        initialLineup={myTeamLineup}
        initialOpponentLineup={opponentLineup}
        onSave={handleSaveLineup}
        onCancel={() => setShowLineupEditor(false)}
      />
    );
  }


  if (gameState === 'teamManagement') {
    const handleSaveTeams = async (newProfiles) => {
      // ... (変更なし) ...
      const success = await updateTeamData(user.uid, { teamProfiles: newProfiles });
      if (success) {
        setTeamProfiles(newProfiles);
        alert('チームリストを保存しました。');
        setGameState('setup');
      } else {
        alert('保存に失敗しました。');
      }
    };
    // ★ (変更なし)
    return (
      <TeamManagementScreen 
        initialProfiles={teamProfiles} 
        onSave={handleSaveTeams} 
        onBack={() => setGameState('setup')}
        // --- ▽▽▽ 以下を丸ごと追加 ▽▽▽ ---
        currentYear={currentYear}
        availableYears={availableYears}
        onYearChange={(year) => handleYearChange(year)}
        onYearAdd={(newYear) => {
          if (!availableYears.includes(newYear)) {
            const updatedYears = [...availableYears, newYear].sort((a, b) => b - a); // 降順ソート
            setAvailableYears(updatedYears);
            setCurrentYear(newYear); // 新しい年度に自動で切り替え
            alert(`${newYear}年度を作成しました。`);
          } else {
            alert(`${newYear}年度は既に存在します。`);
          }
        }}
        // --- △△△ ここまで追加 △△△ ---
      />
    );
  }

  if (gameState === 'inGameStatsScreen') {
    const handleBack = () => {
      setGameState(isGameCreator ? 'playing' : 'watching');
    };
    return (
      <InGameStatsScreen
        players={players}
        inGameStats={inGameStats}
        isGameCreator={isGameCreator}
        onBack={handleBack}
      />
    );
  }

  if (gameState === 'timeline' && selectedGameTimeline) {
    const myTeam = selectedGameTimeline.myTeamNameForGame || teamProfiles[0];
    return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl p-6">
        <div className="flex items-center mb-6">
          <button onClick={returnToSetup} className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">試合振り返り</h1>
            <p className="text-gray-600">{selectedGameTimeline.date} vs {selectedGameTimeline.opponentTeam}</p>
            <p className="text-lg font-bold">
              {selectedGameTimeline.isHomeTeam ? myTeam : selectedGameTimeline.opponentTeam} {selectedGameTimeline.homeScore} - {selectedGameTimeline.awayScore} {selectedGameTimeline.isHomeTeam ? selectedGameTimeline.opponentTeam : myTeam}
              <span className={`ml-2 ${selectedGameTimeline.winner === myTeam ? 'text-blue-600' : 'text-red-600'}`}>({selectedGameTimeline.winner}勝利)</span>
            </p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
          <h3 className="font-bold mb-4 text-center">タイムライン</h3>
          {selectedGameTimeline.timeline.slice().reverse().map((entry, index) => (
            <div key={index} className="border-b border-gray-300 pb-2 mb-2 last:border-b-0">
              <div className="flex justify-between items-start text-sm">
                <span className="text-gray-500">{entry.time}</span>
                <span className="text-gray-500">{entry.inning}回{entry.inningHalf} {entry.outCount}アウト</span>
              </div>
              <div className="text-sm"><span className="font-medium text-blue-600">[{entry.team}]</span> {entry.message}</div>
            </div>
          ))}
        </div>
        <GameHighlights inGameStats={selectedGameTimeline.inGameStats || {}} players={getPlayerList()} />
      </div>
    </div>
  ); }

  if (gameState === 'firebaseList') { return (
    <div className="min-h-screen bg-gradient-to-br from-gray-700 to-gray-900 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl p-6">
        <div className="flex items-center mb-6">
          <button onClick={returnToSetup} className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">試合一覧</h1>
            <p className="text-gray-600">試合をタップすると観戦モードで開きます</p>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-3">
          {isLoading ? (<p className="text-center text-gray-500 py-4">読み込み中...</p>) : firebaseGames.length === 0 ? (<p className="text-center text-gray-500 py-4">保存されている試合データがありません。</p>) : (
            firebaseGames.map((game) => {
              const totalHomeScore = (game.homeScore || []).reduce((a, b) => a + (b || 0), 0);
              const totalAwayScore = (game.awayScore || []).reduce((a, b) => a + (b || 0), 0);
              const myTeam = game.myTeamNameForGame || teamProfiles[0];
              return (
                <div key={game.id} className="bg-gray-50 p-3 rounded-lg shadow-sm">
                  <div className="hover:bg-gray-100 -m-3 p-3 rounded-lg transition-colors cursor-pointer" onClick={() => loadGame(game.id, 'watch')}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="text-sm text-gray-600">{game.createdAt ? new Date(game.createdAt).toLocaleDateString() : '日付不明'}</span>
                        {game.tournamentName && (<span className="text-xs text-white bg-blue-500 px-2 py-0.5 rounded-full">{game.tournamentName}</span>)}
                      </div>
                      <span className="font-medium text-sm">vs {game.opponentTeam}</span>
                    </div>
                    <div className="text-center font-mono text-blue-600 text-sm">{game.id}</div>
                    <div className="text-center text-xl mt-1">
                      <span>{game.isHomeTeam ? game.opponentTeam : myTeam}</span>
                      <span className="font-bold mx-2">{totalAwayScore}</span>
                      <span>-</span>
                      <span className="font-bold mx-2">{totalHomeScore}</span>
                      <span>{game.isHomeTeam ? myTeam : game.opponentTeam}</span>
                    </div>
                  </div>
                  <div className="text-right mt-2 border-t pt-2">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFirebaseGame(game.id); }} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded-lg transition-colors">削除</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  ); }

  if (gameState === 'statsScreen') {
    const requestSort = (key) => {
      let direction = 'descending';
      if (sortConfig.key === key && sortConfig.direction === 'descending') {
        direction = 'ascending';
      }
      setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
      if (sortConfig.key === key) {
        return sortConfig.direction === 'descending' ? ' ▼' : ' ▲';
      }
      return null;
    };
    
    // ヘッダー情報を配列で管理
    const headers = [
      { key: 'playerName', label: '選手名' },
      { key: 'battingAverage', label: '打率' },
      { key: 'onBasePercentage', label: '出塁率' },
      { key: 'plateAppearances', label: '打席' },
      { key: 'atBats', label: '打数' },
      { key: 'hits', label: '安打' },
      { key: 'doubles', label: '二塁打' },
      { key: 'triples', label: '三塁打' },
      { key: 'homeRuns', label: '本塁打' },
      { key: 'rbi', label: '打点' },
      { key: 'strikeouts', label: '三振' },
      { key: 'walks', label: '四球' },
      { key: 'hitByPitches', label: '死球' },
      { key: 'stolenBases', label: '盗塁' },
    ];

    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <button onClick={() => setGameState('setup')} className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full"><ChevronLeft className="h-5 w-5" /></button>
              <h1 className="text-2xl font-bold text-gray-800">個人成績一覧</h1>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white text-xs md:text-sm">
              <thead className="bg-gray-800 text-white">
                <tr>
                  {headers.map(header => (
                    <th 
                      key={header.key} 
                      className="text-left py-2 px-3 cursor-pointer hover:bg-gray-700"
                      onClick={() => header.key !== 'playerName' && requestSort(header.key)}
                    >
                      {header.label}{getSortIndicator(header.key)}
                    </th>
                  ))}
                  <th className="py-2 px-3">操作</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {sortedPlayers.map((playerName) => { // ★ getPlayerList() から sortedPlayers に変更
                  const isEditing = editingPlayer === playerName;
                  const stats = isEditing ? tempStats : (playerStats[playerName] || {});
                  const atBats = stats.atBats || 0;
                  const hits = stats.hits || 0;
                  const doubles = stats.doubles || 0;
                  const triples = stats.triples || 0;
                  const homeRuns = stats.homeRuns || 0;
                  const rbi = stats.rbi || 0;
                  const strikeouts = stats.strikeouts || 0;
                  const walks = stats.walks || 0;
                  const hitByPitches = stats.hitByPitches || 0;
                  const stolenBases = stats.stolenBases || 0;
                  const plateAppearances = atBats + walks + hitByPitches;
                  const battingAverage = atBats > 0 ? (hits / atBats).toFixed(3) : '.000';
                  const onBasePercentage = plateAppearances > 0 ? ((hits + walks + hitByPitches) / plateAppearances).toFixed(3) : '.000';
                  
                  return (
                    <tr key={playerName} className="border-b border-gray-200 hover:bg-gray-100">
                      <td className="text-left py-2 px-3 font-medium">{playerName}</td>
                      <td className="text-center font-semibold">{battingAverage}</td>
                      <td className="text-center font-semibold">{onBasePercentage}</td>
                      <td className="text-center">{plateAppearances}</td>
                      {isEditing ? (
                        <>
                          <td><input type="number" value={atBats} onChange={(e) => handleStatChange('atBats', e.target.value)} className="w-12 text-center border rounded"/></td>
                          <td><input type="number" value={hits} onChange={(e) => handleStatChange('hits', e.target.value)} className="w-12 text-center border rounded"/></td>
                          <td><input type="number" value={doubles} onChange={(e) => handleStatChange('doubles', e.target.value)} className="w-12 text-center border rounded"/></td>
                          <td><input type="number" value={triples} onChange={(e) => handleStatChange('triples', e.target.value)} className="w-12 text-center border rounded"/></td>
                          <td><input type="number" value={homeRuns} onChange={(e) => handleStatChange('homeRuns', e.target.value)} className="w-12 text-center border rounded"/></td>
                          <td><input type="number" value={rbi} onChange={(e) => handleStatChange('rbi', e.target.value)} className="w-12 text-center border rounded"/></td>
                          <td><input type="number" value={strikeouts} onChange={(e) => handleStatChange('strikeouts', e.target.value)} className="w-12 text-center border rounded"/></td>
                          <td><input type="number" value={walks} onChange={(e) => handleStatChange('walks', e.target.value)} className="w-12 text-center border rounded"/></td>
                          <td><input type="number" value={hitByPitches} onChange={(e) => handleStatChange('hitByPitches', e.target.value)} className="w-12 text-center border rounded"/></td>
                          <td><input type="number" value={stolenBases} onChange={(e) => handleStatChange('stolenBases', e.target.value)} className="w-12 text-center border rounded"/></td>
                        </>
                      ) : (
                        <>
                          <td className="text-center">{atBats}</td><td className="text-center">{hits}</td><td className="text-center">{doubles}</td>
                          <td className="text-center">{triples}</td><td className="text-center">{homeRuns}</td><td className="text-center">{rbi}</td>
                          <td className="text-center">{strikeouts}</td><td className="text-center">{walks}</td>
                          <td className="text-center">{hitByPitches}</td><td className="text-center">{stolenBases}</td>
                        </>
                      )}
                      <td className="text-center py-2 px-3">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSaveStats(playerName)} className="bg-blue-500 text-white font-bold py-1 px-2 rounded-md text-xs mr-1">保存</button>
                            <button onClick={handleCancelEdit} className="bg-gray-500 text-white font-bold py-1 px-2 rounded-md text-xs">中止</button>
                          </>
                        ) : (
                          <button onClick={() => handleEditPlayer(playerName)} className="bg-green-500 text-white font-bold py-1 px-2 rounded-md text-xs">編集</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'playerManagement') { return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <button onClick={() => setGameState('setup')} className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full"><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="text-2xl font-bold text-gray-800">選手名簿の管理</h1>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">新しい選手を追加</label>
          <div className="flex space-x-2">
            <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" placeholder="選手名を入力" />
            <button onClick={handleAddPlayer} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">追加</button>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">現在の選手リスト</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto bg-gray-50 p-3 rounded-lg">
            {getPlayerList().map((player, index) => (
              <div key={index} className="flex justify-between items-center bg-white p-2 rounded-md shadow-sm">
                <span>{player}</span>
                <div className="flex items-center space-x-2">
                  <div className="flex flex-col">
                    <button onClick={() => movePlayerUp(index)} disabled={index === 0} className="text-gray-500 hover:text-gray-800 disabled:opacity-25" aria-label="上に移動">▲</button>
                    <button onClick={() => movePlayerDown(index)} disabled={index === getPlayerList().length - 1} className="text-gray-500 hover:text-gray-800 disabled:opacity-25" aria-label="下に移動">▼</button>
                  </div>
                  <button onClick={() => handleDeletePlayer(player)} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-lg">削除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-6 border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">削除用パスワードの変更</h2>
          <div className="space-y-2">
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="現在のパスワード" />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="新しいパスワード" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="新しいパスワード（確認用）" />
            <button onClick={handleUpdatePassword} className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">パスワードを更新</button>
          </div>
        </div>
      </div>
    </div>
  ); }

  if (gameState === 'setup') { return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 p-4">
      <GameStartDialog 
        showShareDialog={showShareDialog}
        dialogTitle={dialogTitle}
        shareMessage={shareMessage}
        copyToClipboard={copyToClipboard}
        setShowShareDialog={setShowShareDialog}
      />
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-2xl p-8">
        <div className="text-right mb-4">
          <button onClick={logout} className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg">ログアウト</button>
        </div>
        <div className="text-center mb-8">
          <Trophy className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">試合速報</h1>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">現在の年度</label>
          <select 
            value={currentYear} 
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {(availableYears || []).sort((a, b) => b - a).map(year => 
              <option key={year} value={year}>{year}年度</option>
             )}
          </select>
        </div>
        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
            <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">観戦モード</h3>
            <button onClick={handleFetchFirebaseGames} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:bg-purple-300">
              <Eye className="h-5 w-5" />
              <span>{isLoading ? '読込中...' : '試合速報を閲覧'}</span>
            </button>
          </div>
          <div className="bg-gray-50 p-6 rounded-lg shadow-inner space-y-6">
          <div className="">
            <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">記録者モード</h3>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">あなたのチーム</label>
            <select value={selectedGameTeam} onChange={(e) => setSelectedGameTeam(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              {teamProfiles.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">大会名（任意）</label>
            <input type="text" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="大会名を入力" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">対戦相手チーム名</label>
            <input type="text" value={opponentTeam} onChange={(e) => setOpponentTeam(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="チーム名を入力" />
          </div>
          <div>
            <label className="flex items-center space-x-3">
              <input type="checkbox" checked={isHomeTeam} onChange={(e) => setIsHomeTeam(e.target.checked)} className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">{selectedGameTeam}が後攻</span>
            </label>
          </div>
          <div>
            <label className="flex items-center space-x-3">
              <input type="checkbox" checked={isStatsRecordingEnabled} onChange={(e) => setIsStatsRecordingEnabled(e.target.checked)} className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">個人成績を自動記録する</span>
            </label>
          </div>
          <button onClick={startGame} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2">
            <Play className="h-5 w-5" />
            <span>試合開始（新規記録）</span>
          </button>

          <button 
            onClick={() => setShowLineupEditor(true)} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            オーダーを登録・編集
          </button>
          
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">記録の再開</h3>
            <div className="space-y-3">
              <input type="text" value={resumeGameId} onChange={(e) => setResumeGameId(e.target.value.toUpperCase())} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="記録を再開する試合のIDを入力" maxLength={6} />
              <button onClick={() => loadGame(resumeGameId, 'resume')} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2">
                <span>速報を継続</span>
              </button>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-6"></div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setGameState('playerManagement')} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg text-xs">選手管理</button>
            <button onClick={() => setGameState('teamManagement')} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg text-xs">チーム管理</button>
            <button onClick={() => setGameState('statsScreen')} className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-3 rounded-lg text-xs">個人成績</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ); }



    // playing or watching view
  const totalHomeScore = homeScore.reduce((a, b) => a + (b || 0), 0);
  const totalAwayScore = awayScore.reduce((a, b) => a + (b || 0), 0);
  const isInputView = gameState === 'playing';
  const myTeam = myTeamNameForGame || selectedGameTeam;

  const pitcherToDisplay = (() => {
    const isMyTeamBatting = (isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away');
    if (isMyTeamBatting) {
      return opponentPitcher || '未設定';
    } else {
      return myTeamPitcher || '未設定';
    }
  })();
  


  const StolenBaseModal = () => {
    if (!showStolenBaseModal) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          {stealingPlayer ? (
            <div>
              <h3 className="text-lg font-bold mb-4 text-center"><span className="font-normal">{stealingPlayer} が</span><br/>どの塁へ盗塁しましたか？</h3>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => recordStolenBase(stealingPlayer, '二盗')} className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold">2塁へ</button>
                <button onClick={() => recordStolenBase(stealingPlayer, '三盗')} className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold">3塁へ</button>
                <button onClick={() => recordStolenBase(stealingPlayer, '本盗')} className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold">本塁へ</button>
              </div>
              <button onClick={() => setStealingPlayer(null)} className="w-full mt-4 bg-gray-400 hover:bg-gray-500 text-white py-2 px-4 rounded-lg text-sm">選手を選び直す</button>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold mb-4 text-center">盗塁した選手を選択</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getPlayerList().map((player) => (
                  <button key={player} onClick={() => setStealingPlayer(player)} className="w-full text-left p-3 bg-gray-100 hover:bg-gray-200 rounded-lg">{player}</button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setShowStolenBaseModal(false)} className="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg">キャンセル</button>
        </div>
      </div>
    );
  };




  const BSOIndicator = () => {
    return (
      <div className="flex flex-col space-y-2 items-start">
        <div className="flex items-center space-x-1"><span className="text-sm font-bold text-white">B</span>{[...Array(3)].map((_, i) => (<div key={i} className={`w-4 h-4 rounded-full border border-gray-400 ${i < bsoCount.b ? 'bg-green-500' : 'bg-gray-600'}`}></div>))}</div>
        <div className="flex items-center space-x-1"><span className="text-sm font-bold text-white">S</span>{[...Array(2)].map((_, i) => (<div key={i} className={`w-4 h-4 rounded-full border border-gray-400 ${i < bsoCount.s ? 'bg-yellow-500' : 'bg-gray-600'}`}></div>))}</div>
        <div className="flex items-center space-x-1"><span className="text-sm font-bold text-white">O</span>{[...Array(2)].map((_, i) => (<div key={i} className={`w-4 h-4 rounded-full border border-gray-400 ${i < outCount ? 'bg-red-500' : 'bg-gray-600'}`}></div>))}</div>
      </div>
    );
  };
  
  if (gameState === 'playing' || gameState === 'watching') {

    {/* --- ▽▽▽ ここに追加 ▽▽▽ --- */}
  if (showNewspaper) {
    return (
      <NewspaperModal 
        isOpen={showNewspaper} 
        onClose={() => setShowNewspaper(false)}
        article={newspaperData || { headline: '', content: '' }}
        isLoading={isGenerating}
        gameData={newspaperGameData}
      />
    );
  }
  {/* --- △△△ ここまで追加 △△△ --- */}

  return (
    <div className="min-h-screen flex flex-col bg-blue-900">
      <GameStartDialog 
      showShareDialog={showShareDialog}
      dialogTitle={dialogTitle}
      shareMessage={shareMessage}
      copyToClipboard={copyToClipboard}
      setShowShareDialog={setShowShareDialog}
      />
      <StolenBaseModal />
      <button
          // ★ 記録者(isGameCreator)でない場合のみクリック可能にする
          onClick={!isGameCreator ? () => incrementLikeCount(user.uid, currentYear, gameId) : undefined}
          // ★ 記録者の場合は押せないスタイル(cursor-not-allowed)を追加
          className={`fixed bottom-4 right-4 z-50 flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg ${!isGameCreator ? 'transition-transform transform hover:scale-110' : 'cursor-not-allowed opacity-75'}`}
        >
          <Heart className="w-8 h-8 text-pink-500" fill="currentColor" />
          <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {likeCount}
          </span>
        </button>
      <div className={isInputView ? "h-1/2" : "h-full"}>
        <div className="h-full bg-gradient-to-r from-blue-900 to-green-800 text-white p-3 overflow-auto">
          <div className="max-w-4xl mx-auto relative p-3">
            { gameState === 'watching' && (<button onClick={returnToSetup} className="absolute top-0 left-0 z-40 p-2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full transition-colors" aria-label="セットアップに戻る"><ChevronLeft className="h-6 w-6" /></button>)}
            <button onClick={() => setGameState('inGameStatsScreen')} className="absolute top-0 right-0 z-40 px-3 py-1 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-lg text-xs font-semibold">個人成績</button>
            <div className="text-center mb-3">
              <h1 className="text-lg font-bold">⚾ {myTeam} 試合速報 ⚾</h1>
              <p className="text-xs text-gray-300">試合日時: {formatDate(gameStartDate)}{tournamentName && ` (${tournamentName})`}</p>
              <p className="text-xs truncate">{myTeam} vs {opponentTeam}</p>
            </div>
            <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-4">
              <div className="text-center text-sm">
                <div className="grid grid-cols-11 gap-1 mb-2 border-b border-gray-500 pb-2">
                  <div className="text-left text-xs col-span-2">チーム</div>{[1,2,3,4,5,6,7].map(i => (<div key={i} className="text-xs">{i}</div>))}<div className="font-bold text-xs">計</div><div className="font-bold text-xs">安</div>
                </div>
                {isHomeTeam ? (
                  <>
                  <div className="grid grid-cols-11 gap-1 mb-1">
                    <div className="text-left text-xs truncate col-span-2">{opponentTeam}</div>{[...Array(7)].map((_, i) => (<div key={i} className="text-xs">{awayScore[i] !== null ? awayScore[i] : '-'}</div>))}<div className="font-bold text-xs">{totalAwayScore}</div><div className="font-bold text-xs">{awayHits}</div>
                  </div>
                  <div className="grid grid-cols-11 gap-1">
                    <div className="text-left text-xs truncate col-span-2">{myTeam}</div>{[...Array(7)].map((_, i) => (<div key={i} className="text-xs">{homeScore[i] !== null ? homeScore[i] : '-'}</div>))}<div className="font-bold text-xs">{totalHomeScore}</div><div className="font-bold text-xs">{homeHits}</div>
                  </div>
                  </>
                ) : (
                  <>
                  <div className="grid grid-cols-11 gap-1 mb-1">
                    <div className="text-left text-xs truncate col-span-2">{myTeam}</div>{[...Array(7)].map((_, i) => (<div key={i} className="text-xs">{awayScore[i] !== null ? awayScore[i] : '-'}</div>))}<div className="font-bold text-xs">{totalAwayScore}</div><div className="font-bold text-xs">{awayHits}</div>
                  </div>
                  <div className="grid grid-cols-11 gap-1">
                    <div className="text-left text-xs truncate col-span-2">{opponentTeam}</div>{[...Array(7)].map((_, i) => (<div key={i} className="text-xs">{homeScore[i] !== null ? homeScore[i] : '-'}</div>))}<div className="font-bold text-xs">{totalHomeScore}</div><div className="font-bold text-xs">{homeHits}</div>
                  </div>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-300">現在</div><div className="font-bold text-sm">{currentInning}回{currentTeamBatting === 'away' ? '表' : '裏'}</div><div className="text-xs truncate">{getCurrentTeamName()}</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-300">投手</div><div className="font-bold text-sm truncate">{pitcherToDisplay}</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-300">打者</div><div className="font-bold text-xs truncate">{useCustomBatter ? customBatter : currentBatter || '未選択'}</div>
              </div>
            </div>
            <div className="flex justify-center items-center gap-x-6 mb-3">
              <BSOIndicator />
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-2 border-white transform rotate-45"></div>
                <div className={`absolute top-1/2 left-0 w-6 h-6 -ml-3 -mt-3 transform rotate-45 border-1 border-white ${bases.third ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                <div className={`absolute top-0 left-1/2 w-6 h-6 -ml-3 -mt-3 transform rotate-45 border-1 border-white ${bases.second ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                <div className={`absolute top-1/2 right-0 w-6 h-6 -mr-3 -mt-3 transform rotate-45 border-1 border-white ${bases.first ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                <div className="absolute bottom-0 left-1/2 w-6 h-6 -ml-3 -mb-3 transform rotate-45 border-1 border-white bg-white"></div>
              </div>
            </div>
            <div>
              {/* 表示切替タブ */}
              <div className="flex border-b border-gray-600 mb-2">
                <button 
                  onClick={() => setMainView('timeline')}
                  className={`flex-1 text-sm py-1 ${mainView === 'timeline' ? 'text-white font-bold border-b-2 border-yellow-400' : 'text-gray-400'}`}
                >
                  タイムライン
                </button>
                <button 
                  onClick={() => setMainView('lineup')}
                  className={`flex-1 text-sm py-1 ${mainView === 'lineup' ? 'text-white font-bold border-b-2 border-yellow-400' : 'text-gray-400'}`}
                >
                  オーダー
                </button>
              </div>

              {/* タイムライン表示 */}
              {mainView === 'timeline' && (
                <div className={`bg-white bg-opacity-10 rounded-lg p-3 overflow-y-auto ${isInputView ? 'max-h-32' : 'max-h-96'}`}>
                  {timeline.length === 0 ? (<p className="text-center text-gray-300 text-xs">まだプレイがありません</p>) : (
                    timeline.map((entry, index) => (
                      <div key={index} className="border-b border-gray-600 pb-1 mb-1 last:border-b-0">
                        <div className="flex justify-between items-start text-xs"><span className="text-gray-300">{entry.time}</span><span className="text-white">{entry.inning}回{entry.inningHalf} {entry.outCount}アウト</span></div>
                        <div className="text-xs"><span className="font-medium text-yellow-300">[{entry.team}]</span> {entry.message}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* オーダー表示 */}
              {mainView === 'lineup' && (
                <div className={`bg-white bg-opacity-10 rounded-lg p-3 overflow-y-auto text-xs ${isInputView ? 'max-h-32' : 'max-h-96'}`}>
                  {isInputView && (
                    <button onClick={() => setShowLineupEditor(true)} className="w-full mb-2 py-1 bg-indigo-500 text-white rounded-md text-xs">オーダーを編集</button>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-bold text-yellow-300 mb-1">{myTeam}</h4>
                      {myTeamLineup.map((member, index) => (
                        member.playerName && <p key={index} className="truncate">{index + 1}. {member.playerName} ({member.position})</p>
                      ))}
                    </div>
                   <div>
                      <h4 className="font-bold text-yellow-300 mb-1">{opponentTeam}</h4>
                      {Array.isArray(opponentLineup) && opponentLineup.map((member, index) => (
                        member.playerName && <p key={index} className="truncate">{index + 1}. {member.playerName} ({member.position})</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <GameHighlights inGameStats={inGameStats} players={players} />

{/* --- ▽▽▽ ここにボタンを追加 ▽▽▽ --- */}
            <button 
              onClick={handleGenerateReport}
              className="mt-4 w-full bg-gradient-to-r from-gray-700 to-gray-900 text-white font-serif py-3 rounded-lg shadow-lg flex items-center justify-center space-x-2 hover:opacity-90 transition-opacity"
            >
              <span>📰</span>
              <span>AI戦評新聞を発行する</span>
            </button>
            {/* --- △△△ ここまで追加 △△△ --- */}

          </div>
        </div>
      </div>
      { isInputView && (
        <div className="h-1/2 bg-white p-3 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-gray-800">📝 スコア入力</h2>
              <div className="flex space-x-2">
                <button onClick={undoLastAction} disabled={history.length === 0} className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed">元に戻す</button>
                <button onClick={() => setGameState('scoreEditor')} className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs transition-colors">スコア修正</button>
                <button onClick={forceChange} className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs transition-colors">チェンジ</button>
                <button onClick={endGame} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors">試合終了</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">BSO操作</label>
                <div className="flex space-x-1">
                  <button onClick={() => toggleBso('b')} className="flex-1 py-2 rounded-lg text-xs bg-green-500 hover:bg-green-600 text-white">ﾎﾞｰﾙ</button>
                  <button onClick={() => toggleBso('s')} className="flex-1 py-2 rounded-lg text-xs bg-yellow-500 hover:bg-yellow-600 text-white">ｽﾄﾗｲｸ</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ベース操作</label>
                <div className="flex space-x-1">
                  <button onClick={() => toggleBase('first')} className={`flex-1 py-2 rounded-lg text-xs transition-colors ${bases.first ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>1塁</button>
                  <button onClick={() => toggleBase('second')} className={`flex-1 py-2 rounded-lg text-xs transition-colors ${bases.second ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>2塁</button>
                  <button onClick={() => toggleBase('third')} className={`flex-1 py-2 rounded-lg text-xs transition-colors ${bases.third ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>3塁</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">状況コメント</label>
                <button onClick={postOutRunnerComment} className="w-full py-2 rounded-lg text-xs bg-purple-500 hover:bg-purple-600 text-white">状況投稿</button>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">打者選択</label>
              <div className="flex items-center space-x-3 mb-2">
                <div className="flex items-center"><input type="radio" id="preset-batter" name="batter-type" checked={!useCustomBatter} onChange={() => setUseCustomBatter(false)} className="mr-1" /><label htmlFor="preset-batter" className="text-xs">選手リスト</label></div>
                <div className="flex items-center"><input type="radio" id="custom-batter" name="batter-type" checked={useCustomBatter} onChange={() => setUseCustomBatter(true)} className="mr-1" /><label htmlFor="custom-batter" className="text-xs">自由入力</label></div>
              </div>
              {useCustomBatter ? (<input type="text" value={customBatter} onChange={(e) => setCustomBatter(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="打者名を入力" />) : (<select value={currentBatter} onChange={(e) => setCurrentBatter(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="">打者を選択</option>{getPlayerList().map((player, index) => (<option key={index} value={player}>{player}</option>))}</select>)}
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">ポジション（任意）</label>
              <div className="grid grid-cols-9 gap-1">{Object.keys(positionMap).map((pos) => (<button key={pos} onClick={() => setSelectedPosition(prevSelected => prevSelected === pos ? null : pos)} className={`px-2 py-2 text-white rounded-lg text-xs transition-colors ${selectedPosition === pos ? 'bg-orange-500 font-bold ring-2 ring-white' : 'bg-blue-500 hover:bg-blue-600'}`}>{pos}</button>))}</div>
              <hr className="my-2 border-gray-300" />
              <label className="block text-xs font-medium text-gray-700 mb-1">打席結果</label>
              <div className="grid grid-cols-4 gap-1">{['ヒット', '2ベース', '3ベース', 'ホームラン', '三振', 'ゴロ', 'ライナー', 'フライ', 'バント', '振り逃げ', '死球', '四球'].map((result) => {
                  const isHitType = ['ヒット', '2ベース', '3ベース', 'ホームラン'].includes(result);
                  const buttonClass = isHitType ? "bg-pink-500 hover:bg-pink-600" : "bg-gray-700 hover:bg-gray-800";
                  return (<button key={result} onClick={() => handleBattingResult(result)} className={`px-2 py-2 text-white rounded-lg text-xs transition-colors ${buttonClass}`}>{result}</button>);
                })}</div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">特殊記録（打者を選択してから押してください）</label>
              <div className="grid grid-cols-4 gap-1">
                <button onClick={() => handleSpecialRecord('stolenBase')} className="px-2 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs">盗塁</button>
                <button onClick={() => handleSpecialRecord('rbi_sac_fly')} className="px-2 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs">犠飛打点</button>
                <button onClick={() => handleSpecialRecord('rbi_other')} className="px-2 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs">その他打点</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={addOut} className="w-full px-3 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm transition-colors">アウト ({outCount}/3)</button>
              <button onClick={addRun} className="w-full px-3 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm transition-colors">得点</button>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">自由コメント投稿</label>
              <div className="flex space-x-2">
                <input type="text" value={freeComment} onChange={(e) => setFreeComment(e.target.value)} className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="盗塁、ワイルドピッチなど" />
                <button onClick={postFreeComment} className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition-colors">投稿</button>
              </div>
            </div>
            <div className="border-t pt-3 mt-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">ピッチャー選択</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={myTeamPitcher} onChange={(e) => setMyTeamPitcher(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="自チームのピッチャー名" />
                <input type="text" value={opponentPitcher} onChange={(e) => setOpponentPitcher(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="相手チームのピッチャー名" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

}

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