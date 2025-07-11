import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Trophy, Eye, ChevronLeft, Copy, Wifi, WifiOff } from 'lucide-react';
import { 
  db, saveGameState, watchGameState, stopWatching, 
  generateGameId, getAllGames, deleteGameFromFirebase, 
  incrementViewCount, login, logout, onAuth, getTeamData 
} from './firebase';
import { doc, setDoc } from "firebase/firestore"; 
import { CSVLink } from 'react-csv';

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

// --- ログイン後のメインアプリ本体 ---
const SoftballScoreApp = ({ user, initialTeamData }) => {
  // --- State管理セクション ---
  const [players, setPlayers] = useState(initialTeamData.players || []);
  const [teamName, setTeamName] = useState(initialTeamData.teamName || 'あなたのチーム');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [gameState, setGameState] = useState('setup');
  const [tournamentName, setTournamentName] = useState('');
  const [opponentTeam, setOpponentTeam] = useState('');
  const [isHomeTeam, setIsHomeTeam] = useState(true);
  const [currentInning, setCurrentInning] = useState(1);
  const [currentTeamBatting, setCurrentTeamBatting] = useState('away');
  const [outCount, setOutCount] = useState(0);
  const [bases, setBases] = useState({ first: false, second: false, third: false });
  const [homeScore, setHomeScore] = useState(Array(6).fill(null));
  const [awayScore, setAwayScore] = useState(Array(6).fill(null));
  const [timeline, setTimeline] = useState([]);
  const [gameStartDate, setGameStartDate] = useState(null);
  const [currentBatter, setCurrentBatter] = useState('');
  const [customBatter, setCustomBatter] = useState('');
  const [useCustomBatter, setUseCustomBatter] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [freeComment, setFreeComment] = useState('');
  const [pastGames, setPastGames] = useState([]);
  const [selectedGameTimeline, setSelectedGameTimeline] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [isGameCreator, setIsGameCreator] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [watchingGameId, setWatchingGameId] = useState('');
  const [resumeGameId, setResumeGameId] = useState('');
  const firebaseListener = useRef(null);
  const [firebaseGames, setFirebaseGames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [history, setHistory] = useState([]);

  // --- ポジション対応表 ---
  const positionMap = {
    '投': 'ピッチャー', '捕': 'キャッチャー', '一': 'ファースト',
    '二': 'セカンド', '三': 'サード', '遊': 'ショート',
    '左': 'レフト', '中': 'センター', '右': 'ライト'
  };

  // --- ヘルパー関数 & ロジック関数 ---

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
    const myTeam = teamName || '若葉'; // チーム名がなければ'若葉'
    if (isHomeTeam) {
      return currentTeamBatting === 'away' ? truncateTeamName(opponentTeam) : myTeam;
    } else {
      return currentTeamBatting === 'away' ? myTeam : truncateTeamName(opponentTeam);
    }
  };
  
  const resetGameStates = () => {
    setTournamentName('');
    setOpponentTeam('');
    setIsHomeTeam(true);
    setCurrentInning(1);
    setCurrentTeamBatting('away');
    setOutCount(0);
    setBases({ first: false, second: false, third: false });
    setHomeScore(Array(6).fill(null));
    setAwayScore(Array(6).fill(null));
    setTimeline([]);
    setCurrentBatter('');
    setCustomBatter('');
    setUseCustomBatter(false);
    setFreeComment('');
    setGameStartDate(null);
    setGameId(null);
    setIsGameCreator(false);
    setShareUrl('');
    setWatchingGameId('');
    setResumeGameId('');
    setSelectedGameTimeline(null);
    setHistory([]);
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
      tournamentName,
      opponentTeam,
      isHomeTeam,
      currentInning,
      currentTeamBatting,
      outCount,
      bases,
      homeScore,
      awayScore,
      timeline,
      currentBatter,
      customBatter,
      useCustomBatter,
      gameStartDate,
      createdAt: gameStartDate || Date.now(),
      viewCount: viewCount, // viewCountも保存
    };
    try {
      await saveGameState(user.uid, gameId, currentState);
      setIsConnected(true);
    } catch (error) {
      console.error('保存失敗:', error);
      setIsConnected(false);
    }
  }, [
    user.uid, gameId, isGameCreator, tournamentName, opponentTeam, isHomeTeam, currentInning, 
    currentTeamBatting, outCount, bases, homeScore, awayScore, 
    timeline, currentBatter, customBatter, useCustomBatter, gameStartDate, viewCount
  ]);

  const loadGame = (id, mode = 'watch') => {
    const gameIdToLoad = id;
    if (!gameIdToLoad || gameIdToLoad.trim() === '') {
      alert('試合IDを入力してください。');
      return;
    }
    if (firebaseListener.current) {
      stopWatching(firebaseListener.current);
    }
    const newListener = watchGameState(user.uid, gameIdToLoad, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsConnected(true);
        setTournamentName(data.tournamentName || '');
        setOpponentTeam(data.opponentTeam || '');
        setIsHomeTeam(data.isHomeTeam === true);
        setCurrentInning(typeof data.currentInning === 'number' ? data.currentInning : 1);
        setCurrentTeamBatting(data.currentTeamBatting || 'away');
        setOutCount(typeof data.outCount === 'number' ? data.outCount : 0);
        setBases(data.bases && typeof data.bases === 'object' ? data.bases : { first: false, second: false, third: false });
        setHomeScore(Array.isArray(data.homeScore) ? data.homeScore : Array(6).fill(null));
        setAwayScore(Array.isArray(data.awayScore) ? data.awayScore : Array(6).fill(null));
        setTimeline(Array.isArray(data.timeline) ? data.timeline : []);
        setCurrentBatter(data.currentBatter || '');
        setCustomBatter(data.customBatter || '');
        setUseCustomBatter(data.useCustomBatter === true);
        setGameStartDate(typeof data.gameStartDate === 'number' ? data.gameStartDate : null);
        setViewCount(data.viewCount || 0);
        
        if (mode === 'watch' && !isGameCreator) { // 記録者自身はカウントしない
          incrementViewCount(user.uid, gameIdToLoad); 
        }

        if (mode === 'watch') {
          setGameId(gameIdToLoad);
          setIsGameCreator(false);
          setGameState('watching');
        } else if (mode === 'resume') {
          setGameId(gameIdToLoad);
          setIsGameCreator(true);
          setGameState('playing');
        }
      } else {
        alert('指定された試合IDが見つかりませんでした。');
        returnToSetup();
      }
    }, (error) => {
      console.error('[App.js] Firebaseからのデータ取得でエラーが発生しました。', error);
      alert('データの読み込みに失敗しました。');
      returnToSetup();
    });
    firebaseListener.current = newListener;
  };
  
  useEffect(() => {
    // ログインユーザーのチームの選手リストでStateを更新
    setPlayers(initialTeamData.players || []);
    setTeamName(initialTeamData.teamName || 'あなたのチーム');
  }, [initialTeamData]);

  useEffect(() => {
    localStorage.setItem(`softball_players_${user.uid}`, JSON.stringify(players));
  }, [players, user.uid]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId');
    const teamIdFromUrl = urlParams.get('teamId');
    if (gameIdFromUrl && teamIdFromUrl) {
      if(user && user.uid === teamIdFromUrl) {
        loadGame(gameIdFromUrl, 'watch');
      }
    }
  }, [user]);

  // ★★★ 無限ループを解決した、最終版のuseEffect ★★★
  useEffect(() => {
    if (!isGameCreator || gameState !== 'playing') {
      return;
    }
    saveCurrentGameState();
  }, [
    // 監視対象から saveCurrentGameState を外し、代わりにその中身をすべて列挙
    gameId, isGameCreator, tournamentName, opponentTeam, isHomeTeam, currentInning, 
    currentTeamBatting, outCount, bases, homeScore, awayScore, 
    timeline, currentBatter, customBatter, useCustomBatter, gameStartDate, viewCount,
    gameState // gameStateの変更も検知
  ]);

  const saveStateToHistory = () => {
    const currentState = {
      outCount,
      homeScore: [...homeScore],
      awayScore: [...awayScore],
      bases: { ...bases },
      timeline: [...timeline],
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
    setHistory(prev => prev.slice(0, -1));
    alert("直前の操作を取り消しました。");
  };

  const startGame = () => {
    if (!opponentTeam) {
      alert('対戦相手のチーム名を入力してください');
      return;
    }
    const myTeamName = teamName || '若葉'; // teamNameがセットされることを期待
    
    // 新しい試合のために、スコアやイニングなど試合進行に関わる情報のみリセット
    setHomeScore(Array(6).fill(null));
    setAwayScore(Array(6).fill(null));
    setTimeline([]);
    setHistory([]);
    setCurrentInning(1);
    setOutCount(0);
    setBases({ first: false, second: false, third: false });
    setCurrentBatter('');
    setCustomBatter('');
    setUseCustomBatter(false);
    setSelectedPosition(null);
    
    const newGameId = generateGameId();
    const url = `${window.location.origin}${window.location.pathname}?gameId=${newGameId}&teamId=${user.uid}`;
    
    setGameStartDate(Date.now());
    setGameId(newGameId);
    setShareUrl(url);
    setIsGameCreator(true);
    setGameState('playing');
    setCurrentTeamBatting('away');
    addToTimeline(`試合開始！ (${myTeamName} vs ${opponentTeam})`);
    setShowShareDialog(true);
  };

  const addToTimeline = (message, eventDetails = {}) => {
    const timestamp = new Date().toLocaleTimeString();
    const newEntry = {
      time: timestamp,
      message: message,
      inning: eventDetails.inning !== undefined ? eventDetails.inning : currentInning,
      team: eventDetails.team !== undefined ? eventDetails.team : getCurrentTeamName(),
      outCount: eventDetails.outCount !== undefined ? eventDetails.outCount : outCount,
    };
    setTimeline(prev => [newEntry, ...prev]);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('観戦用URLをコピーしました！');
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
    const teamName = getCurrentTeamName();
    if ((isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away')) {
      if (isHomeTeam) {
        setHomeScore(prev => {
          const newScore = [...prev];
          newScore[currentInning - 1] = (newScore[currentInning - 1] || 0) + 1;
          return newScore;
        });
      } else {
        setAwayScore(prev => {
          const newScore = [...prev];
          newScore[currentInning - 1] = (newScore[currentInning - 1] || 0) + 1;
          return newScore;
        });
      }
    } else {
      if (isHomeTeam) {
        setAwayScore(prev => {
          const newScore = [...prev];
          newScore[currentInning - 1] = (newScore[currentInning - 1] || 0) + 1;
          return newScore;
        });
      } else {
        setHomeScore(prev => {
          const newScore = [...prev];
          newScore[currentInning - 1] = (newScore[currentInning - 1] || 0) + 1;
          return newScore;
        });
      }
    }
    addToTimeline(`得点！ (${teamName})`);
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
    let nextInning = currentTeamBatting === 'away' ? currentInning : currentInning + 1;
    let nextTeamBatting = currentTeamBatting === 'away' ? 'home' : 'away';
    const myTeam = teamName || '若葉';
    let nextTeamName = isHomeTeam ? (nextTeamBatting === 'away' ? truncateTeamName(opponentTeam) : myTeam) : (nextTeamBatting === 'away' ? myTeam : truncateTeamName(opponentTeam));
    const inningHalf = (nextTeamBatting === 'home') ? '裏' : '表';
    const message = `${nextInning}回${inningHalf}開始`;
    addToTimeline(message, { inning: nextInning, team: nextTeamName, outCount: 0 });
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

  const handleBattingResult = (result) => {
    saveStateToHistory();
    const batterName = useCustomBatter ? customBatter : currentBatter;
    if (!batterName) {
      alert('打者名を選択または入力してください');
      return;
    }
    let resultText = result;
    if (selectedPosition && positionMap[selectedPosition]) {
      if (['ゴロ', 'ライナー', 'フライ', 'バント', '三振'].includes(result)) {
        resultText = positionMap[selectedPosition] + result;
      }
    }
    let message = `${batterName}: ${resultText}`;
    let runsScored = 0;
    let isAnOut = false;
    switch (result) {
      case '三振': case 'ゴロ': case 'ライナー': case 'フライ': isAnOut = true; break;
      case 'ヒット': if (bases.third) runsScored++; setBases(prev => ({ first: true, second: prev.first, third: prev.second })); break;
      case '2ベース': if (bases.third) runsScored++; if (bases.second) runsScored++; setBases(prev => ({ first: false, second: true, third: prev.first })); break;
      case '3ベース': if (bases.third) runsScored++; if (bases.second) runsScored++; if (bases.first) runsScored++; setBases({ first: false, second: false, third: true }); break;
      case 'ホームラン': runsScored = 1 + (bases.first ? 1 : 0) + (bases.second ? 1 : 0) + (bases.third ? 1 : 0); setBases({ first: false, second: false, third: false }); break;
      case '四球': case '死球': if (bases.first && bases.second && bases.third) runsScored++; setBases(prev => ({ first: true, second: prev.first ? true : prev.second, third: prev.first && prev.second ? true : prev.third })); break;
      default: break;
    }
    if (runsScored > 0) {
      const currentScoringTeam = getCurrentTeamName();
      const isMyTeamScoring = (isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away');
      if (isMyTeamScoring) {
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
    setCurrentBatter('');
    setCustomBatter('');
    setUseCustomBatter(false);
    setSelectedPosition(null);
  };

  const toggleBase = (base) => {
    saveStateToHistory();
    setBases(prev => ({ ...prev, [base]: !prev[base] }));
  };

  const endGame = () => {
    const finalHomeScore = homeScore.reduce((a, b) => (a || 0) + (b || 0), 0);
    const finalAwayScore = awayScore.reduce((a, b) => (a || 0) + (b || 0), 0);
    const myTeamName = teamName || '若葉';
    let winner = isHomeTeam ? (finalHomeScore > finalAwayScore ? myTeamName : opponentTeam) : (finalAwayScore > finalHomeScore ? myTeamName : opponentTeam);
    const gameData = {
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
    setPastGames(prev => [gameData, ...prev]);
    resetGameStates();
    setGameState('setup');
  };

  const showTimeline = (game) => {
    setSelectedGameTimeline(game);
    setGameState('timeline');
  };

  const handleFetchFirebaseGames = async () => {
    setIsLoading(true);
    const games = await getAllGames(user.uid);
    setFirebaseGames(games);
    setIsLoading(false);
    setGameState('firebaseList');
  };

  const handleDeleteFirebaseGame = async (gameIdToDelete) => {
    const password = prompt("削除するにはパスワードを入力してください：");
    if (password === null) return;
    if (password !== 'wakaba') {
      alert('パスワードが違います。');
      return;
    }
    if (window.confirm(`試合ID: ${gameIdToDelete} のデータを完全に削除しますか？`)) {
      const success = await deleteGameFromFirebase(user.uid, gameIdToDelete);
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
    if (players.includes(newPlayerName.trim())) {
      alert('同じ名前の選手が既に存在します。');
      return;
    }
    const updatedPlayers = [...players, newPlayerName.trim()];
    setPlayers(updatedPlayers);
    // Firestoreのチームデータも更新
    const teamRef = doc(db, 'teams', user.uid);
    setDoc(teamRef, { players: updatedPlayers }, { merge: true });
    setNewPlayerName('');
  };

  const handleDeletePlayer = (playerToDelete) => {
    if (window.confirm(`「${playerToDelete}」を名簿から削除しますか？`)) {
      const updatedPlayers = players.filter(player => player !== playerToDelete);
      setPlayers(updatedPlayers);
      // Firestoreのチームデータも更新
      const teamRef = doc(db, 'teams', user.uid);
      setDoc(teamRef, { players: updatedPlayers }, { merge: true });
    }
  };

  const movePlayerUp = (index) => {
    if (index === 0) return;
    const newPlayers = [...players];
    const playerToMove = newPlayers.splice(index, 1)[0];
    newPlayers.splice(index - 1, 0, playerToMove);
    setPlayers(newPlayers);
  };

  const movePlayerDown = (index) => {
    if (index === players.length - 1) return;
    const newPlayers = [...players];
    const playerToMove = newPlayers.splice(index, 1)[0];
    newPlayers.splice(index + 1, 0, playerToMove);
    setPlayers(newPlayers);
  };

  const prepareDataForExport = (gameData) => {
    const myTeamName = teamName || '若葉';
    const scoreA = gameData.isHomeTeam ? gameData.awayScore : gameData.homeScore;
    const scoreB = gameData.isHomeTeam ? gameData.homeScore : gameData.awayScore;
    const scoreboardHeader = ['チーム', '1', '2', '3', '4', '5', '6', '合計'];
    const homeScores = gameData.homeScoreInnings || Array(6).fill('-');
    const awayScores = gameData.awayScoreInnings || Array(6).fill('-');
    const teamRow1 = [gameData.isHomeTeam ? gameData.opponentTeam : myTeamName, ...(gameData.isHomeTeam ? awayScores : homeScores), scoreA];
    const teamRow2 = [gameData.isHomeTeam ? myTeamName : gameData.opponentTeam, ...(gameData.isHomeTeam ? homeScores : awayScores), scoreB];
    const timelineHeader = ['時刻', '回', 'アウト', 'チーム', '内容'];
    const timelineRows = gameData.timeline.slice().reverse().map(entry => [
      entry.time, entry.inning, entry.outCount, entry.team, entry.message.replace(/,/g, '、')
    ]);
    const exportData = [
      ['大会名', gameData.tournamentName],
      ['対戦相手', gameData.opponentTeam],
      ['試合日', gameData.date],
      ['スコア', `${teamRow2[0]} ${scoreB} - ${scoreA} ${teamRow1[0]}`],
      [],
      ['イニング別スコア'],
      scoreboardHeader,
      teamRow2,
      teamRow1,
      [],
      ['タイムライン'],
      timelineHeader,
      ...timelineRows
    ];
    return exportData;
  };

  // --- 表示(JSX)部分 ---

  if (gameState === 'timeline' && selectedGameTimeline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 to-pink-500 p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl p-6">
          <div className="flex items-center mb-6">
            <button onClick={returnToSetup} className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">試合振り返り</h1>
              <p className="text-gray-600">{selectedGameTimeline.date} vs {selectedGameTimeline.opponentTeam}</p>
              <p className="text-lg font-bold">
                {selectedGameTimeline.isHomeTeam ? teamName : selectedGameTimeline.opponentTeam} {selectedGameTimeline.homeScore} - {selectedGameTimeline.awayScore} {selectedGameTimeline.isHomeTeam ? selectedGameTimeline.opponentTeam : teamName}
                <span className={`ml-2 ${selectedGameTimeline.winner === teamName ? 'text-blue-600' : 'text-red-600'}`}>({selectedGameTimeline.winner}勝利)</span>
              </p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="font-bold mb-4 text-center">タイムライン</h3>
            {selectedGameTimeline.timeline.slice().reverse().map((entry, index) => (
              <div key={index} className="border-b border-gray-300 pb-2 mb-2 last:border-b-0">
                <div className="flex justify-between items-start text-sm">
                  <span className="text-gray-500">{entry.time}</span>
                  <span className="text-gray-500">{entry.inning}回 {entry.outCount}アウト</span>
                </div>
                <div className="text-sm"><span className="font-medium text-blue-600">[{entry.team}]</span> {entry.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'firebaseList') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-700 to-gray-900 p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl p-6">
          <div className="flex items-center mb-6">
            <button onClick={returnToSetup} className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">過去の試合一覧</h1>
              <p className="text-gray-600">試合をタップすると観戦モードで開きます</p>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {isLoading ? (<p className="text-center text-gray-500 py-4">読み込み中...</p>) : firebaseGames.length === 0 ? (<p className="text-center text-gray-500 py-4">保存されている試合データがありません。</p>) : (
              firebaseGames.map((game) => {
                const totalHomeScore = (game.homeScore || []).reduce((a, b) => a + (b || 0), 0);
                const totalAwayScore = (game.awayScore || []).reduce((a, b) => a + (b || 0), 0);
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
                        <span>{game.isHomeTeam ? game.opponentTeam : teamName}</span>
                        <span className="font-bold mx-2">{totalAwayScore}</span>
                        <span>-</span>
                        <span className="font-bold mx-2">{totalHomeScore}</span>
                        <span>{game.isHomeTeam ? teamName : game.opponentTeam}</span>
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
    );
  }

  if (gameState === 'playerManagement') {
    return (
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
              {players.map((player, index) => (
                <div key={index} className="flex justify-between items-center bg-white p-2 rounded-md shadow-sm">
                  <span>{player}</span>
                  <div className="flex items-center space-x-2">
                    <div className="flex flex-col">
                      <button onClick={() => movePlayerUp(index)} disabled={index === 0} className="text-gray-500 hover:text-gray-800 disabled:opacity-25" aria-label="上に移動">▲</button>
                      <button onClick={() => movePlayerDown(index)} disabled={index === players.length - 1} className="text-gray-500 hover:text-gray-800 disabled:opacity-25" aria-label="下に移動">▼</button>
                    </div>
                    <button onClick={() => handleDeletePlayer(player)} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-lg">削除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 p-4">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Trophy className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{teamName} 試合速報</h1>
            <p className="text-gray-600">試合情報を入力してください</p>
          </div>
          <div className="space-y-6">
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
                <span className="text-sm font-medium text-gray-700">{teamName}が後攻</span>
              </label>
            </div>
            <button onClick={startGame} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2">
              <Play className="h-5 w-5" />
              <span>試合開始（新規記録）</span>
            </button>
            <div className="border-t border-gray-200 pt-6">
              <button onClick={() => setGameState('playerManagement')} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2">
                <span>選手名簿の管理</span>
              </button>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <button onClick={handleFetchFirebaseGames} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:bg-purple-300">
                <span>{isLoading ? '読込中...' : '過去の試合を閲覧'}</span>
              </button>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">観戦モード</h3>
              <div className="space-y-3">
                <input type="text" value={watchingGameId} onChange={(e) => setWatchingGameId(e.target.value.toUpperCase())} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="観戦したい試合のIDを入力" maxLength={6} />
                <button onClick={() => loadGame(watchingGameId, 'watch')} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2">
                  <Eye className="h-5 w-5" />
                  <span>観戦開始</span>
                </button>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">記録の再開</h3>
              <div className="space-y-3">
                <input type="text" value={resumeGameId} onChange={(e) => setResumeGameId(e.target.value.toUpperCase())} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="記録を再開する試合のIDを入力" maxLength={6} />
                <button onClick={() => loadGame(resumeGameId, 'resume')} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2">
                  <span>速報を継続</span>
                </button>
              </div>
            </div>
          </div>
          {pastGames.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4">過去の試合（ローカル保存）</h2>
              {pastGames.slice(0, 3).map((game, index) => {
                const exportData = prepareDataForExport(game);
                const filename = `softball-score-${game.date.replace(/\//g, '-')}-${game.opponentTeam}.csv`;
                return (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg mb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm text-gray-600">{game.date}</span>
                        {game.gameId && (<span className="ml-2 text-xs text-gray-500 bg-gray-200 px-1 rounded">ID: {game.gameId}</span>)}
                      </div>
                      <span className="font-medium">vs {game.opponentTeam}</span>
                    </div>
                    <button onClick={() => showTimeline(game)} className="w-full text-center mt-1 hover:bg-gray-100 p-1 rounded transition-colors">
                      <span className={`font-bold ${game.winner === teamName ? 'text-blue-600' : 'text-red-600'}`}>
                        {game.isHomeTeam ? teamName : game.opponentTeam} {game.isHomeTeam ? game.homeScore : game.awayScore} - {game.isHomeTeam ? game.awayScore : game.homeScore} {game.isHomeTeam ? game.opponentTeam : teamName} ({game.winner}勝利)
                      </span>
                      <div className="text-xs text-gray-500 mt-1">クリックで詳細表示</div>
                    </button>
                    <div className="flex items-center justify-center space-x-2 mt-2">
                      <CSVLink data={exportData} filename={filename} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-3 rounded-lg transition-colors" target="_blank">
                        エクスポート
                      </CSVLink>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- playing or watching view ---
  const totalHomeScore = homeScore.reduce((a, b) => a + (b || 0), 0);
  const totalAwayScore = awayScore.reduce((a, b) => a + (b || 0), 0);
  
  const ShareDialog = () => { /* ... */ };
  const ConnectionStatus = () => { /* ... */ };
  const isInputView = gameState === 'playing';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <ShareDialog />
      <ConnectionStatus />
      
      <div className={isInputView ? "h-1/2" : "h-full"}>
        <div className="h-full bg-gradient-to-r from-blue-900 to-green-800 text-white p-3 overflow-auto">
          {/* ... Preview JSX ... */}
        </div>
      </div>
      
      { isInputView && (
        <div className="h-1/2 bg-white p-3 overflow-auto">
          {/* ... Input JSX ... */}
        </div>
      )}
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