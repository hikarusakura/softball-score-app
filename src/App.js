import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Trophy, Eye, ChevronLeft, Copy } from 'lucide-react';
import { db, saveGameState, watchGameState, stopWatching, generateGameId, getAllGames, deleteGameFromFirebase, login, logout, onAuth, getTeamData, updatePlayerStats, updateTeamData } from './firebase';
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
  const [playerStats, setPlayerStats] = useState(initialTeamData.playerStats || {});
  const [players, setPlayers] = useState(initialTeamData.players || Object.keys(initialTeamData.playerStats || {}));
  const [teamName, setTeamName] = useState(initialTeamData.teamName || 'あなたのチーム');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [gameState, setGameState] = useState('setup');
  const [tournamentName, setTournamentName] = useState('');
  const [opponentTeam, setOpponentTeam] = useState('');
  const [isHomeTeam, setIsHomeTeam] = useState(true);
  const [bsoCount, setBsoCount] = useState({ b: 0, s: 0 });
  const [isStatsRecordingEnabled, setIsStatsRecordingEnabled] = useState(true); // デフォルトは記録する
  const [currentInning, setCurrentInning] = useState(1);
  const [currentTeamBatting, setCurrentTeamBatting] = useState('away');
  const [outCount, setOutCount] = useState(0);
  const [bases, setBases] = useState({ first: false, second: false, third: false });
  const [homeScore, setHomeScore] = useState(Array(6).fill(null));
  const [awayScore, setAwayScore] = useState(Array(6).fill(null));
  const [homeHits, setHomeHits] = useState(0);
  const [awayHits, setAwayHits] = useState(0);
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
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [watchingGameId, setWatchingGameId] = useState('');
  const [resumeGameId, setResumeGameId] = useState('');
  const firebaseListener = useRef(null);
  const [firebaseGames, setFirebaseGames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [inGameStats, setInGameStats] = useState({}); // 現在の試合だけの成績を記録
  const [editingPlayer, setEditingPlayer] = useState(null); // 編集中の選手名
  const [tempStats, setTempStats] = useState({});       // 編集中の数値
  const [currentPassword, setCurrentPassword] = useState('');
  const [showStolenBaseModal, setShowStolenBaseModal] = useState(false);
  const [stealingPlayer, setStealingPlayer] = useState(null); // 盗塁する選手名を一時保存
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResuming, setIsResuming] = useState(false);
  const [myTeamPitcher, setMyTeamPitcher] = useState('');
  const [opponentPitcher, setOpponentPitcher] = useState('');


  // --- ポジション対応表 ---
  const positionMap = { '投': 'ピッチャー', '捕': 'キャッチャー', '一': 'ファースト', '二': 'セカンド', '三': 'サード', '遊': 'ショート', '左': 'レフト', '中': 'センター', '右': 'ライト' };
  const hitTypeAbbreviationMap = {
    'ヒット': '安',
    '2ベース': '二',
    '3ベース': '三',
    'ホームラン': '本'
  };

  // --- ヘルパー関数 & ロジック関数 ---
  const getPlayerList = () => players || [];

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
    const myTeam = teamName || 'あなたのチーム';
    if (isHomeTeam) {
      return currentTeamBatting === 'away' ? truncateTeamName(opponentTeam) : myTeam;
    } else {
      return currentTeamBatting === 'away' ? myTeam : truncateTeamName(opponentTeam);
    }
  }; 

  // 保存処理を行う関数
const handleUpdatePassword = async () => {
  // 1. 現在のパスワードが正しいかチェック
  if (currentPassword !== initialTeamData.deletePassword) {
    alert('現在のパスワードが違います。');
    return;
    }
    // 2. 新しいパスワードが入力されているかチェック
  if (!newPassword) {
    alert('新しいパスワードを入力してください。');
    return;
  }
  // 3. 新しいパスワードが一致するかチェック
  if (newPassword !== confirmPassword) {
    alert('新しいパスワードが一致しません。');
    return;
  }
// 4. 更新処理
  const success = await updateTeamData(user.uid, { deletePassword: newPassword });
  if (success) {
    alert('パスワードを更新しました。');
    // initialTeamDataも更新して、次回のチェックに備える
    initialTeamData.deletePassword = newPassword;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  } else {
    alert('パスワードの更新に失敗しました。');
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
    setHomeScore(Array(6).fill(null));
    setAwayScore(Array(6).fill(null));
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
    setShareUrl('');
    setWatchingGameId('');
    setResumeGameId('');
    setSelectedGameTimeline(null);
    setHistory([]);
    setInGameStats({});
    setBsoCount({ b: 0, s: 0 });
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
      myTeamPitcher,
      opponentPitcher,
      bsoCount,
      inGameStats,
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
      await saveGameState(user.uid, gameId, currentState);
       } catch (error) {
      console.error('保存失敗:', error);
    }
  }, [
    myTeamPitcher,opponentPitcher,
    user.uid, gameId, isGameCreator, inGameStats, isStatsRecordingEnabled, tournamentName, opponentTeam, isHomeTeam, currentInning, 
    currentTeamBatting, outCount, bases, homeScore, awayScore, homeHits, awayHits,
    timeline, currentBatter, customBatter, useCustomBatter, gameStartDate, bsoCount
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
        setMyTeamPitcher(data.myTeamPitcher || '');
        setOpponentPitcher(data.opponentPitcher || '');
        setBsoCount(data.bsoCount || { b: 0, s: 0 });
        setInGameStats(data.inGameStats || {});
        setIsStatsRecordingEnabled(data.isStatsRecordingEnabled !== undefined ? data.isStatsRecordingEnabled : true);
        setTournamentName(data.tournamentName || '');
        setOpponentTeam(data.opponentTeam || '');
        setIsHomeTeam(data.isHomeTeam === true);
        setCurrentInning(typeof data.currentInning === 'number' ? data.currentInning : 1);
        setCurrentTeamBatting(data.currentTeamBatting || 'away');
        setOutCount(typeof data.outCount === 'number' ? data.outCount : 0);
        setBases(data.bases && typeof data.bases === 'object' ? data.bases : { first: false, second: false, third: false });
        setHomeScore(Array.isArray(data.homeScore) ? data.homeScore : Array(6).fill(null));
        setAwayScore(Array.isArray(data.awayScore) ? data.awayScore : Array(6).fill(null));
        setHomeHits(data.homeHits || 0);
        setAwayHits(data.awayHits || 0);
        setTimeline(Array.isArray(data.timeline) ? data.timeline : []);
        setCurrentBatter(data.currentBatter || '');
        setCustomBatter(data.customBatter || '');
        setUseCustomBatter(data.useCustomBatter === true);
        setGameStartDate(typeof data.gameStartDate === 'number' ? data.gameStartDate : null);
                
        //if (mode === 'watch' && user.uid !== gameIdToLoad) { 
        //}

        if (mode === 'watch') {
          setGameId(gameIdToLoad);
          setIsGameCreator(false);
          setGameState('watching');
        } else if (mode === 'resume') {
          setIsResuming(true);
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
  if (initialTeamData) {
    setPlayerStats(initialTeamData.playerStats || {});
    setPlayers(initialTeamData.players || Object.keys(initialTeamData.playerStats || {}));
    setTeamName(initialTeamData.teamName || 'あなたのチーム');
  }
}, [initialTeamData]);

  useEffect(() => {
    if (!user || !user.uid) return;
    const teamRef = doc(db, 'teams', user.uid);
    setDoc(teamRef, { 
      playerStats: playerStats,
      players: players 
    }, { merge: true });
  }, [playerStats, players, user]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId');
    const teamIdFromUrl = urlParams.get('teamId');
    if (gameIdFromUrl && teamIdFromUrl) {
      if(user && user.uid === teamIdFromUrl) {
        loadGame(gameIdFromUrl, 'watch');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!isGameCreator || gameState !== 'playing' || isResuming) {
      return;
    }
    saveCurrentGameState();
  }, [
    opponentTeam, tournamentName, isHomeTeam, currentInning, 
    currentTeamBatting, outCount, bases, homeScore, awayScore, 
    timeline, currentBatter, customBatter, useCustomBatter, 
    gameStartDate, saveCurrentGameState, isGameCreator, gameState, homeHits, awayHits, inGameStats
  ]);

  useEffect(() => {
    if (isResuming) {
      // データの読み込みと画面表示が完了するのを少し待ってから、再開中フラグをOFFに戻す
      const timer = setTimeout(() => {
        setIsResuming(false);
      }, 500); // 0.5秒後に実行

      // コンポーネントが不要になった場合にタイマーをクリアする
      return () => clearTimeout(timer);
    }
  }, [isResuming]);

/*
    useEffect(() => {
    // teamDataが読み込まれた後、かつplayerStatsが空でない場合にのみ実行
    if (!user || !initialTeamData) return;

    const teamRef = doc(db, 'teams', user.uid);
    // playerStatsオブジェクト全体でFirestoreを更新する
    setDoc(teamRef, { 
      playerStats: playerStats,
      players: players 
    }, { merge: true });

  }, [playerStats, players, user, initialTeamData]);
*/
  const saveStateToHistory = () => {
    const currentState = {
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
    
    setHomeScore(Array(6).fill(null));
    setAwayScore(Array(6).fill(null));
    setTimeline([]);
    setHistory([]);
    setCurrentInning(1);
    setOutCount(0);
    setBases({ first: false, second: false, third: false });
    setHomeHits(0);
    setAwayHits(0);
    setInGameStats({});
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
    addToTimeline(`試合開始！ (${teamName} vs ${opponentTeam})`);
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
    // 得点が入らなかった場合、スコア表に0を記録
    if ((isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away')) {
      if (isHomeTeam) setHomeScore(prev => { const ns = [...prev]; if (ns[currentInning - 1] === null) ns[currentInning - 1] = 0; return ns; });
      else setAwayScore(prev => { const ns = [...prev]; if (ns[currentInning - 1] === null) ns[currentInning - 1] = 0; return ns; });
    } else {
      if (isHomeTeam) setAwayScore(prev => { const ns = [...prev]; if (ns[currentInning - 1] === null) ns[currentInning - 1] = 0; return ns; });
      else setHomeScore(prev => { const ns = [...prev]; if (ns[currentInning - 1] === null) ns[currentInning - 1] = 0; return ns; });
    }
    // 1. 「次の」状態をすべて計算します
    const nextInning = currentTeamBatting === 'away' ? currentInning : currentInning + 1;
    const nextTeamBatting = currentTeamBatting === 'away' ? 'home' : 'away';
    // 2. 「次の」攻撃チーム名を、より正確なロジックで取得します
    let nextTeamName;
  const myTeam = teamName || '若葉'; // ログインしているチーム名

  if (nextTeamBatting === 'home') {
    // 次に攻撃するのがホームチームの場合
    nextTeamName = isHomeTeam ? myTeam : opponentTeam;
  } else {
    // 次に攻撃するのがアウェイチームの場合
    nextTeamName = isHomeTeam ? opponentTeam : myTeam;
  }
    const inningHalf = (nextTeamBatting === 'home') ? '裏' : '表';
    const message = `${nextInning}回${inningHalf}開始`;
    addToTimeline(message, { inning: nextInning, team: truncateTeamName(nextTeamName), outCount: 0 });
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

  // BSOを操作・リセットする関数
const toggleBso = (type) => {
  saveStateToHistory(); // 元に戻せるように履歴保存
  setBsoCount(prev => {
    const newCount = { ...prev };
    if (type === 'b') {
      newCount.b = (newCount.b + 1) % 4; // 0, 1, 2, 3 と循環
    } else if (type === 's') {
      newCount.s = (newCount.s + 1) % 3; // 0, 1, 2 と循環
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
    const isHit = ['ヒット', '2ベース', '3ベース', 'ホームラン'].includes(result);
    let runsScored = 0;
    let isAnOut = false;

    const statsUpdate = {};
    const isWalkOrHBP = ['四球', '死球'].includes(result);
    const isStrikeout = result === '三振';
    // 打数がカウントされる打席か
    const isAtBat = !isWalkOrHBP && result !== 'バント'; // バントも打数から除外する

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
      if(result === '四球') statsUpdate.walks = 1;
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
    // 打点と、得点した選手の得点を記録
      statsUpdate.rbi = (statsUpdate.rbi || 0) + runsScored;

    // 実際のスコアに反映させる
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

    // ★★★ 最後に成績を更新する ★★★
    if (Object.keys(statsUpdate).length > 0) {
      // 試合中のハイライト用データは、チェックボックスの状態に関わらず常に更新
      setInGameStats(prev => {
        const newStats = { ...prev };
        const player = { ...(newStats[batterName] || {}) };
        for (const key in statsUpdate) {
          player[key] = (player[key] || 0) + statsUpdate[key];
        }
        newStats[batterName] = player;
        return newStats;
      });

      // チーム全体の累計成績は、チェックボックスがONの場合のみ更新
      if (isStatsRecordingEnabled) {
        updatePlayerStats(user.uid, batterName, statsUpdate);
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

    setCurrentBatter('');
    setCustomBatter('');
    setUseCustomBatter(false);
    setSelectedPosition(null);
    resetBso();
  };
  

  // 盗塁の場合はポップアップを開く
const handleSpecialRecord = (type) => {
  if (type === 'stolenBase') {
    setShowStolenBaseModal(true);
    setStealingPlayer(null);
    return;
  }

  saveStateToHistory();
  const batterName = useCustomBatter ? customBatter : currentBatter;
  // 盗塁以外の場合、打者が選択されているかチェック
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
  // 1. 先に打席結果（特殊記録）をタイムラインに追加
  addToTimeline(message);
  // 2. 犠牲フライの場合、アウト処理を後から行う
  if (isSacFly) {
    const { newOutCount, inningShouldChange } = processOut();
    addToTimeline(`アウト！ (${newOutCount}アウト)`, { outCount: newOutCount });
    if (inningShouldChange) {
      changeInning();
    }
  }
  // 3. 打点があった場合、スコアに反映させる
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
  // 4. 個人成績を更新
  if (Object.keys(statsUpdate).length > 0) {
      // 試合中のハイライト用データは、チェックボックスの状態に関わらず常に更新
      setInGameStats(prev => {
        const newStats = { ...prev };
        const player = { ...(newStats[batterName] || {}) };
        for (const key in statsUpdate) {
          player[key] = (player[key] || 0) + statsUpdate[key];
        }
        newStats[batterName] = player;
        return newStats;
      });

      // チーム全体の累計成績は、チェックボックスがONの場合のみ更新
      if (isStatsRecordingEnabled) {
        updatePlayerStats(user.uid, batterName, statsUpdate);
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
  
  setCurrentBatter('');
  setCustomBatter('');
  setUseCustomBatter(false);
};
// 盗塁を記録する新しい関数
const recordStolenBase = (playerName, stealType) => {
  saveStateToHistory();
  
  const statsUpdate = { stolenBases: 1 };
  
  // FirestoreとローカルのStateを更新
  if (isStatsRecordingEnabled) {
    updatePlayerStats(user.uid, playerName, statsUpdate);
    setPlayerStats(prev => {
      const newStats = { ...prev };
      const player = { ...(newStats[playerName] || {}) };
      player.stolenBases = (player.stolenBases || 0) + 1;
      newStats[playerName] = player;
      return newStats;
    });
  

      setInGameStats(prev => {
        const newStats = { ...prev };
        const player = { ...(newStats[playerName] || {}) };
        player.stolenBases = (player.stolenBases || 0) + 1;
        newStats[playerName] = player;
        return newStats;
      });
    }








  addToTimeline(`${playerName}: ${stealType}成功！`);
  setShowStolenBaseModal(false); // ポップアップを閉じる
};

  const toggleBase = (base) => {
    saveStateToHistory();
    setBases(prev => ({ ...prev, [base]: !prev[base] }));
  };

  const postOutRunnerComment = () => {
    saveStateToHistory(); // 元に戻せるように履歴保存

    // 1. アウトカウントの文字列を生成
    const outText = ['無死', '一死', '二死'][outCount] || '三死';

    // 2. 走者の状況の文字列を生成
    const runnerParts = [];
    if (bases.third) runnerParts.push('三塁'); // 3塁から書くと自然な日本語に
    if (bases.second) runnerParts.push('二塁');
    if (bases.first) runnerParts.push('一塁');

    let runnerText = '';
    if (runnerParts.length === 0) {
      runnerText = '走者なし';
    } else if (runnerParts.length === 3) {
      runnerText = '満塁';
    } else {
      runnerText = runnerParts.join('、');
    }

    // 3. タイムラインに投稿
    const message = `【状況】${outText} ${runnerText}`;
    addToTimeline(message);
  };

  const endGame = () => {
    const finalHomeScore = homeScore.reduce((a, b) => (a || 0) + (b || 0), 0);
    const finalAwayScore = awayScore.reduce((a, b) => (a || 0) + (b || 0), 0);
    const myTeamName = teamName || '若葉';
    let winner = isHomeTeam ? (finalHomeScore > finalAwayScore ? myTeamName : opponentTeam) : (finalAwayScore > finalHomeScore ? myTeamName : opponentTeam);
    const gameData = {
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
    // チームデータから削除用パスワードを取得
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
    const newPlayer = newPlayerName.trim();
    if (players.includes(newPlayer)) {
      alert('同じ名前の選手が既に存在します。');
      return;
    }
    // 新しい選手に、全ての成績が0の初期データを作成する
    setPlayerStats(prev => ({
      ...prev,
      [newPlayer]: {
        atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0, hitByPitches: 0, stolenBases: 0
      }
    }));
    // players配列に名前を追加
    setPlayers(prev => [...prev, newPlayer]);
    setNewPlayerName('');
  };

const handleDeletePlayer = (playerToDelete) => {
    if (window.confirm(`「${playerToDelete}」を名簿から削除しますか？成績データも全て削除されます。`)) {
      // playerStatsからデータを削除
      const updatedStats = { ...playerStats };
      delete updatedStats[playerToDelete];
      setPlayerStats(updatedStats);
      // players配列から名前を削除
      setPlayers(prev => prev.filter(player => player !== playerToDelete));
    }
  };

const movePlayerUp = (index) => {
    if (index === 0) return;
    // players配列の順番を直接入れ替える
    const newPlayers = [...players];
    [newPlayers[index - 1], newPlayers[index]] = [newPlayers[index], newPlayers[index - 1]];
    setPlayers(newPlayers);
  };

const movePlayerDown = (index) => {
    if (index === players.length - 1) return;
    // players配列の順番を直接入れ替える
    const newPlayers = [...players];
    [newPlayers[index + 1], newPlayers[index]] = [newPlayers[index], newPlayers[index + 1]];
    setPlayers(newPlayers);
  };
// 編集モードを開始する関数
const handleEditPlayer = (playerName) => {
  // チームデータから正しいパスワードを取得
  const correctPassword = initialTeamData.deletePassword;

  // パスワードが設定されていない場合は、編集させずにメッセージを表示
  if (!correctPassword) {
    alert('編集・削除用のパスワードが設定されていません。\n選手管理画面で設定してください。');
    return;
    }

    // パスワードの入力を求める
    const password = prompt("編集するにはパスワードを入力してください：");

    // ユーザーがキャンセルボタンを押した場合は、何もしない
    if (password === null) {
      return;
    }

    // パスワードが正しいかチェック
    if (password === correctPassword) {
      // 正しい場合は、編集モードを開始
      setEditingPlayer(playerName);
      setTempStats(playerStats[playerName] || {});
      } else {
        // 間違っている場合は、アラートを表示
        alert('パスワードが違います。');
      }
};

// 編集中の数値を一時Stateに反映させる関数
const handleStatChange = (statName, value) => {
  setTempStats(prev => ({
    ...prev,
    [statName]: parseInt(value, 10) || 0 // 数値に変換(空なら0)
  }));
};

// 編集内容を保存する関数
const handleSaveStats = async (playerName) => {
  if (window.confirm(`「${playerName}」の成績を保存しますか？`)) {
    // 第4引数に true を渡して「上書きモード」を有効にする
    const success = await updatePlayerStats(user.uid, playerName, tempStats, true);
    if (success) {
      setPlayerStats(prev => ({
        ...prev,
        [playerName]: tempStats
      }));
      alert('成績を保存しました。');
    } else {
      alert('成績の保存に失敗しました。');
    }
    setEditingPlayer(null);
  }
};
// 編集をキャンセルする関数
const handleCancelEdit = () => {
  setEditingPlayer(null);
  //setTempStats({});
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
                  <span className="text-gray-300">{entry.time}</span>
                  <span className="text-gray-300">{entry.inning}回 {entry.outCount}アウト</span>
                </div>
                <div className="text-sm"><span className="font-medium text-blue-600">[{entry.team}]</span> {entry.message}</div>
              </div>
            ))}
          </div>
          <GameHighlights inGameStats={selectedGameTimeline.inGameStats || {}} players={getPlayerList()} />
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

  // 個人成績表示画面のJSX

if (gameState === 'statsScreen') {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={() => setGameState('setup')}
            className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">個人成績一覧</h1>
        </div>

        {/* 成績一覧テーブル */}
<div className="overflow-x-auto">
  <table className="min-w-full bg-white text-xs md:text-sm">
    <thead className="bg-gray-800 text-white">
      <tr>
        <th className="text-left py-2 px-3">選手名</th>
        <th>打率</th><th>出塁率</th><th>打席</th><th>打数</th><th>安打</th><th>二塁打</th>
        <th>三塁打</th><th>本塁打</th><th>打点</th><th>三振</th>
        <th>四球</th><th>死球</th><th>盗塁</th>
        <th className="py-2 px-3">操作</th>
      </tr>
    </thead>
    <tbody className="text-gray-700">
      {getPlayerList().map((playerName) => {
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

        // 自動計算
        const totalAtBats = atBats;
        const plateAppearances = atBats + walks + hitByPitches; // 犠飛などは未対応
        const battingAverage = totalAtBats > 0 ? (hits / totalAtBats).toFixed(3) : '.000';
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
        </div>
        <div className="mb-6 border-t pt-6">
  <h2 className="text-lg font-semibold text-gray-800 mb-2">削除用パスワードの変更</h2>
  <div className="space-y-2">
    <input
      type="password"
      value={currentPassword}
      onChange={(e) => setCurrentPassword(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
      placeholder="現在のパスワード"
    />
    <input
      type="password"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
      placeholder="新しいパスワード"
    />
    <input
      type="password"
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
      placeholder="新しいパスワード（確認用）"
    />
    <button
      onClick={handleUpdatePassword}
      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
    >
      パスワードを更新
    </button>
  </div>
</div>
      </div>
    );
  }

  if (gameState === 'inGameStatsScreen') {
    return <InGameStatsScreen />;
  }

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 p-4">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-2xl p-8">
          <div className="text-right mb-4">
            <button onClick={logout} className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg">ログアウト</button>
          </div>
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
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isStatsRecordingEnabled}
                  onChange={(e) => setIsStatsRecordingEnabled(e.target.checked)}
                  className="w-5 h-5 text-green-600"
                />
                <span className="text-sm font-medium text-gray-700">
                  個人成績を自動記録する
                </span>
              </label>
            </div>
            <button onClick={startGame} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2">
              <Play className="h-5 w-5" />
              <span>試合開始（新規記録）</span>
            </button>
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
　　　　　　　<div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-6">
              <button
                onClick={() => setGameState('playerManagement')}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 text-sm"
              >
                <span>選手名簿の管理</span>
              </button>
              <button
                onClick={() => setGameState('statsScreen')}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 text-sm"
              >
                <span>個人成績の確認</span>
              </button>
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

  // playing or watching view
  const totalHomeScore = homeScore.reduce((a, b) => a + (b || 0), 0);
  const totalAwayScore = awayScore.reduce((a, b) => a + (b || 0), 0);
  // 表示するピッチャー名を決定するロジック
  const pitcherToDisplay = (() => {
    const isMyTeamBatting = (isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away');
    if (isMyTeamBatting) {
      // 自チームの攻撃中は、相手ピッチャーを表示
      return opponentPitcher || '未設定';
    } else {
      // 相手チームの攻撃中は、自チームのピッチャーを表示
      return myTeamPitcher || '未設定';
    }
  })();
  const isInputView = gameState === 'playing';

  const ShareDialog = () => {
    if (!showShareDialog) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-bold mb-4 text-center">観戦用URL</h3>
          <p className="text-sm text-gray-600 mb-4">このURLを共有すると、他の人がリアルタイムで試合を観戦できます</p>
          <div className="bg-gray-100 p-3 rounded-lg mb-4 break-all text-sm">{shareUrl}</div>
          <div className="flex space-x-3">
            <button onClick={copyToClipboard} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2"><Copy className="h-4 w-4" /><span>コピー</span></button>
            <button onClick={() => setShowShareDialog(false)} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg">閉じる</button>
          </div>
          <div className="mt-3 text-center"><p className="text-xs text-gray-500">ゲームID: {gameId}</p></div>
        </div>
      </div>
    );
  };


// 盗塁選手を選択するためのポップアップコンポーネント
const StolenBaseModal = () => {
  if (!showStolenBaseModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        {stealingPlayer ? (
          // --- ステージ2: どの塁へ盗塁したか選択 ---
          <div>
            <h3 className="text-lg font-bold mb-4 text-center">
              <span className="font-normal">{stealingPlayer} が</span><br/>どの塁へ盗塁しましたか？
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => recordStolenBase(stealingPlayer, '二盗')} className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold">2塁へ</button>
              <button onClick={() => recordStolenBase(stealingPlayer, '三盗')} className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold">3塁へ</button>
              <button onClick={() => recordStolenBase(stealingPlayer, '本盗')} className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold">本塁へ</button>
            </div>
            <button
              onClick={() => setStealingPlayer(null)}
              className="w-full mt-4 bg-gray-400 hover:bg-gray-500 text-white py-2 px-4 rounded-lg text-sm"
            >
              選手を選び直す
            </button>
          </div>
        ) : (
          // --- ステージ1: 誰が盗塁したか選択 ---
          <div>
            <h3 className="text-lg font-bold mb-4 text-center">盗塁した選手を選択</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {getPlayerList().map((player) => (
                <button
                  key={player}
                  onClick={() => setStealingPlayer(player)}
                  className="w-full text-left p-3 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  {player}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowStolenBaseModal(false)}
          className="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
};

// BSOカウンターの表示コンポーネント
const BSOIndicator = () => {
  return (
    <div className="flex flex-col space-y-2 items-start">
      <div className="flex items-center space-x-1">
        <span className="text-sm font-bold text-white">B</span>
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border border-gray-400 ${i < bsoCount.b ? 'bg-green-500' : 'bg-gray-600'}`}></div>
        ))}
      </div>
      <div className="flex items-center space-x-1">
        <span className="text-sm font-bold text-white">S</span>
        {[...Array(2)].map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border border-gray-400 ${i < bsoCount.s ? 'bg-yellow-500' : 'bg-gray-600'}`}></div>
        ))}
      </div>
      <div className="flex items-center space-x-1">
        <span className="text-sm font-bold text-white">O</span>
        {[...Array(2)].map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border border-gray-400 ${i < outCount ? 'bg-red-500' : 'bg-gray-600'}`}></div>
        ))}
      </div>
    </div>
  );
};

//ハイライト表示用のコンポーネント
const GameHighlights = ({ inGameStats, players }) => {
  // playerStatsオブジェクトから、指定された成績を持つ選手を抽出するヘルパー関数
  const getPlayersWithStat = (statName) => {
    return players
      .filter(playerName => inGameStats[playerName] && inGameStats[playerName][statName] > 0)
      .map(playerName => ({
        name: playerName,
        count: inGameStats[playerName][statName]
      }));
  };

  const homeRunHitter = getPlayersWithStat('homeRuns');
  const hitLeaders = getPlayersWithStat('hits');
  const stolenBaseLeaders = getPlayersWithStat('stolenBases');

  // 表示すべきハイライトが何もない場合は、何も描画しない
  if (homeRunHitter.length === 0 && hitLeaders.length === 0 && stolenBaseLeaders.length === 0) {
    return null;
  }

  return (
    <div className="bg-white bg-opacity-20 rounded-lg p-3 mt-3 text-xs">
      {homeRunHitter.length > 0 && (
        <div className="mb-2">
          <h4 className="font-bold text-yellow-300">本塁打</h4>
          <p className="text-white">
            {homeRunHitter.map(p => `${p.name}(${p.count})`).join('、 ')}
          </p>
        </div>
      )}
      {hitLeaders.length > 0 && (
        <div className="mb-2">
          <h4 className="font-bold text-yellow-300">安打</h4>
          <p className="text-white">
            {hitLeaders.map(p => `${p.name}(${p.count})`).join('、 ')}
          </p>
        </div>
      )}
      {stolenBaseLeaders.length > 0 && (
        <div>
          <h4 className="font-bold text-yellow-300">盗塁</h4>
          <p className="text-white">
            {stolenBaseLeaders.map(p => `${p.name}(${p.count})`).join('、 ')}
          </p>
        </div>
      )}
    </div>
  );
};

const InGameStatsScreen = () => {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center mb-6">
            <button
              onClick={() => setGameState('playing')} // 記録画面に戻る
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
                {players
                  .filter(player => inGameStats[player] && Object.values(inGameStats[player]).some(stat => stat > 0))
                  .map((playerName) => {
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
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <ShareDialog />
      <StolenBaseModal />
      <div className={isInputView ? "h-1/2" : "h-full"}>
        <div className="h-full bg-gradient-to-r from-blue-900 to-green-800 text-white p-3 overflow-auto">
          <div className="max-w-4xl mx-auto relative">
            { gameState === 'watching' && (<button onClick={returnToSetup} className="absolute top-0 left-0 z-40 p-2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full transition-colors" aria-label="セットアップに戻る"><ChevronLeft className="h-6 w-6" /></button>)}
            <button
              onClick={() => setGameState('inGameStatsScreen')}
              className="absolute top-0 right-0 z-40 px-3 py-1 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-lg text-xs font-semibold"
            >
              個人成績
            </button>
            <div className="text-center mb-3 pt-8">
              <h1 className="text-lg font-bold">⚾ {teamName} 試合速報 ⚾</h1>
              <p className="text-xs text-gray-300">試合日時: {formatDate(gameStartDate)}{tournamentName && ` (${tournamentName})`}</p>
              <p className="text-xs truncate">{teamName} vs {opponentTeam}</p>
            </div>
            {/* ... スコアボードJSX ... */}
            <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-4">
              <div className="text-center text-sm">
                <div className="grid grid-cols-10 gap-1 mb-2 border-b border-gray-500 pb-2">
                  <div className="text-left text-xs col-span-2">チーム</div>
                  {[1,2,3,4,5,6].map(i => (<div key={i} className="text-xs">{i}</div>))}
                  <div className="font-bold text-xs">R</div>
                  <div className="font-bold text-xs">H</div>
                </div>
                {isHomeTeam ? (<>
                  <div className="grid grid-cols-10 gap-1 mb-1">
                    <div className="text-left text-xs truncate col-span-2">{opponentTeam}</div>
                    {[...Array(6)].map((_, i) => (<div key={i} className="text-xs">{awayScore[i] !== null ? awayScore[i] : '-'}</div>))}
                    <div className="font-bold text-xs">{totalAwayScore}</div>
                    <div className="font-bold text-xs">{awayHits}</div>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    <div className="text-left text-xs truncate col-span-2">{teamName}</div>
                    {[...Array(6)].map((_, i) => (<div key={i} className="text-xs">{homeScore[i] !== null ? homeScore[i] : '-'}</div>))}
                    <div className="font-bold text-xs">{totalHomeScore}</div>
                    <div className="font-bold text-xs">{homeHits}</div>
                  </div>
                </>) : (<>
                  <div className="grid grid-cols-10 gap-1 mb-1">
                    <div className="text-left text-xs truncate col-span-2">{teamName}</div>
                    {[...Array(6)].map((_, i) => (<div key={i} className="text-xs">{awayScore[i] !== null ? awayScore[i] : '-'}</div>))}
                    <div className="font-bold text-xs">{totalAwayScore}</div>
                    <div className="font-bold text-xs">{awayHits}</div>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    <div className="text-left text-xs truncate col-span-2">{opponentTeam}</div>
                    {[...Array(6)].map((_, i) => (<div key={i} className="text-xs">{homeScore[i] !== null ? homeScore[i] : '-'}</div>))}
                    <div className="font-bold text-xs">{totalHomeScore}</div>
                    <div className="font-bold text-xs">{homeHits}</div>
                  </div>
                </>)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-300">現在</div>
                <div className="font-bold text-sm">{currentInning}回{currentTeamBatting === 'away' ? '表' : '裏'}</div>
                <div className="text-xs truncate">{getCurrentTeamName()}</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-300">投手</div>
                <div className="font-bold text-sm truncate">{pitcherToDisplay}</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-300">打者</div>
                <div className="font-bold text-xs truncate">{useCustomBatter ? customBatter : currentBatter || '未選択'}</div>
              </div>
            </div>
            <div className="flex justify-center items-center gap-x-6 mb-3">
              {/* BSOカウンターを左側に配置 */}
              <BSOIndicator />
              {/* ダイアモンド */}
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-2 border-white transform rotate-45"></div>
                <div className={`absolute top-1/2 left-0 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white ${bases.third ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                <div className={`absolute top-0 left-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white ${bases.second ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                <div className={`absolute top-1/2 right-0 w-3 h-3 -mr-1.5 -mt-1.5 rounded-full border-2 border-white ${bases.first ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                <div className="absolute bottom-0 left-1/2 w-3 h-3 -ml-1.5 -mb-1.5 rounded-full border-2 border-white bg-red-600"></div>
              </div>
            </div>
            <div className={`bg-white bg-opacity-10 rounded-lg p-3 overflow-y-auto ${isInputView ? 'max-h-32' : 'max-h-96'}`}>
              <h3 className="font-bold mb-2 text-center text-sm">⚡ タイムライン ⚡</h3>
              {timeline.length === 0 ? (<p className="text-center text-gray-300 text-xs">まだプレイがありません</p>) : (
                timeline.map((entry, index) => (
                  <div key={index} className="border-b border-gray-600 pb-1 mb-1 last:border-b-0">
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-gray-300">{entry.time}</span>
                      <span className="text-gray-300">{entry.inning}回 {entry.outCount}アウト</span>
                    </div>
                    <div className="text-xs"><span className="font-medium text-yellow-300">[{entry.team}]</span> {entry.message}</div>
                  </div>
                ))
              )}
            </div>
            <GameHighlights inGameStats={inGameStats} players={players} />
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
                <button onClick={forceChange} className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs transition-colors">チェンジ</button>
                <button onClick={endGame} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors">試合終了</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">BSO操作</label>
                <div className="flex space-x-1">
                  <button onClick={() => toggleBso('b')} className="flex-1 py-1 rounded-lg text-xs bg-green-500 hover:bg-green-600 text-white">B</button>
                  <button onClick={() => toggleBso('s')} className="flex-1 py-1 rounded-lg text-xs bg-yellow-500 hover:bg-yellow-600 text-white">S</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ベース操作</label>
                <div className="flex space-x-1">
                  <button onClick={() => toggleBase('first')} className={`flex-1 py-1 rounded-lg text-xs transition-colors ${bases.first ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>1塁</button>
                  <button onClick={() => toggleBase('second')} className={`flex-1 py-1 rounded-lg text-xs transition-colors ${bases.second ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>2塁</button>
                  <button onClick={() => toggleBase('third')} className={`flex-1 py-1 rounded-lg text-xs transition-colors ${bases.third ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>3塁</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">状況コメント</label>
                <button onClick={postOutRunnerComment} className="w-full py-1 rounded-lg text-xs bg-purple-500 hover:bg-purple-600 text-white">アウト走者</button>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">打者選択</label>
              <div className="flex items-center space-x-3 mb-2">
                <div className="flex items-center">
                  <input type="radio" id="preset-batter" name="batter-type" checked={!useCustomBatter} onChange={() => setUseCustomBatter(false)} className="mr-1" />
                  <label htmlFor="preset-batter" className="text-xs">選手リスト</label>
                </div>
                <div className="flex items-center">
                  <input type="radio" id="custom-batter" name="batter-type" checked={useCustomBatter} onChange={() => setUseCustomBatter(true)} className="mr-1" />
                  <label htmlFor="custom-batter" className="text-xs">自由入力</label>
                </div>
              </div>
              {useCustomBatter ? (
                <input type="text" value={customBatter} onChange={(e) => setCustomBatter(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="打者名を入力" />
              ) : (
                <select value={currentBatter} onChange={(e) => setCurrentBatter(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">打者を選択</option>
                  {getPlayerList().map((player, index) => (<option key={index} value={player}>{player}</option>))}
                </select>
              )}
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">ポジション（任意）</label>
              <div className="grid grid-cols-9 gap-1">
                {Object.keys(positionMap).map((pos) => (
                  <button key={pos} onClick={() => setSelectedPosition(prevSelected => prevSelected === pos ? null : pos)} className={`px-2 py-1 text-white rounded-lg text-xs transition-colors ${selectedPosition === pos ? 'bg-orange-500 font-bold ring-2 ring-white' : 'bg-blue-500 hover:bg-blue-600'}`}>
                    {pos}
                  </button>
                ))}
              </div>
              <hr className="my-2 border-gray-300" />
              <label className="block text-xs font-medium text-gray-700 mb-1">打席結果</label>
              <div className="grid grid-cols-4 gap-1">
                {['ヒット', '2ベース', '3ベース', 'ホームラン', '三振', '振り逃げ', 'ゴロ', 'ライナー', 'フライ', 'バント', '死球', '四球'].map((result) => (
                  <button key={result} onClick={() => handleBattingResult(result)} className="px-2 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-xs transition-colors">
                    {result}
                  </button>
                ))}
              </div>
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
              <div>
                <button onClick={addOut} className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm transition-colors">アウト ({outCount}/3)</button>
              </div>
              <div>
                <button onClick={addRun} className="w-full px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm transition-colors">得点</button>
              </div>


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
                <input
                  type="text"
                  value={myTeamPitcher}
                  onChange={(e) => setMyTeamPitcher(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="自チームのピッチャー名"
                />
                <input
                  type="text"
                  value={opponentPitcher}
                  onChange={(e) => setOpponentPitcher(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="相手チームのピッチャー名"
                />
              </div>
            </div>
          </div>
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center">エラー: {error} <button onClick={logout} className="ml-4 bg-blue-500 text-white px-3 py-1 rounded">再ログイン</button></div>;

  return user && teamData ? <SoftballScoreApp user={user} initialTeamData={teamData} /> : <LoginScreen onLogin={login} />;
};

export default App;
