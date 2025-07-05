import React, { useState, useEffect, useCallback } from 'react';
import { Play,  Trophy,  Eye, ChevronLeft,  Copy, Wifi, WifiOff } from 'lucide-react';
import { db, saveGameState, watchGameState, stopWatching,  generateGameId, getAllGames, testReadGame } from './firebase';
import { doc, onSnapshot } from "firebase/firestore";
import { CSVLink } from 'react-csv';


// let sharedGameState = {
//   isActive: false,
//   inputUserId: null,
//   gameData: null,
//   lastUpdated: null
// };

const SoftballScoreApp = () => {
  // 選手リスト（デフォルト）- きよはる追加
  const defaultPlayers = [
    'せいや⑩', 'りゅうせ②', 'きづき③', 'れお④', 'もあ⑤', 'きよはる⑥',
    'はやと⑦', 'つかさ⑨', 'あゆむ⑨', 'はると⑪', 'あいこ⑫', 'ゆいと⑬',
    'しょうい⑮', 'まひろ⑯', 'そうま⑰', 'じん⑱'
  ];

  // 状態管理
  const [gameState, setGameState] = useState('setup'); // setup, playing, watching, timeline
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [isInputUser, setIsInputUser] = useState(false);
  const [isWatchingMode, setIsWatchingMode] = useState(false);
  const [opponentTeam, setOpponentTeam] = useState('');
  const [isHomeTeam, setIsHomeTeam] = useState(true);
  const [currentInning, setCurrentInning] = useState(1);
  const [currentTeamBatting, setCurrentTeamBatting] = useState('away'); // away or home
  const [outCount, setOutCount] = useState(0);
  const [currentBatter, setCurrentBatter] = useState('');
  const [customBatter, setCustomBatter] = useState('');
  const [useCustomBatter, setUseCustomBatter] = useState(false);
  const [firebaseGames, setFirebaseGames] = useState([]); // Firebaseから取得した試合リスト
  const [isLoading, setIsLoading] = useState(false);      // データ読み込み中の状態管理
  const [gameStartDate, setGameStartDate] = useState(null);
  const [resumeGameId, setResumeGameId] = useState('');

  // 自由記入欄の状態
  const [freeComment, setFreeComment] = useState('');

  // ベースランナー状態
  const [bases, setBases] = useState({
    first: false,
    second: false,
    third: false
  });

  // スコア管理（6回分に変更）
  const [homeScore, setHomeScore] = useState(Array(6).fill(null));
  const [awayScore, setAwayScore] = useState(Array(6).fill(null));

  // タイムライン
  const [timeline, setTimeline] = useState([]);

  // 過去の試合データ
  const [pastGames, setPastGames] = useState([]);

  // タイムライン表示用
  const [selectedGameTimeline, setSelectedGameTimeline] = useState(null);

  // 日付フォーマット用のヘルパー関数
  const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 共有機能用
  const [gameId, setGameId] = useState(null);
  const [isGameCreator, setIsGameCreator] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [watchingGameId, setWatchingGameId] = useState('');
  const [firebaseListener, setFirebaseListener] = useState(null);

  // エクスポート用にデータを整形する関数
  const prepareDataForExport = (gameData) => {
    // 1. 基本情報とスコアボードの作成
    const teamA = gameData.isHomeTeam ? gameData.opponent : '若葉';
    const teamB = gameData.isHomeTeam ? '若葉' : gameData.opponent;
    const scoreA = gameData.isHomeTeam ? gameData.awayScore : gameData.homeScore;
    const scoreB = gameData.isHomeTeam ? gameData.homeScore : gameData.awayScore;

    // スコアボードのヘッダーと各チームの行
    const scoreboardHeader = ['チーム', '1', '2', '3', '4', '5', '6', '合計'];
    const teamARow = [teamA, ...gameData.timeline.reduce((acc, entry) => {
      // 実際にはイニングごとのスコアが必要だが、ここでは簡略化のため合計スコアから逆算はしない
      // endGameで保存したスコア配列を使うのが望ましい。
      // 仮にgameDataにイニング別スコアが保存されていると仮定する
      return gameData.isHomeTeam ? gameData.awayScoreInnings : gameData.homeScoreInnings;
    }, Array(6).fill(0)), scoreA];

    // endGame修正後の正しいスコアボードデータ作成
    const homeScores = gameData.homeScoreInnings || Array(6).fill('-');
    const awayScores = gameData.awayScoreInnings || Array(6).fill('-');

    const teamRow1 = [gameData.isHomeTeam ? gameData.opponent : '若葉', ...(gameData.isHomeTeam ? awayScores : homeScores), gameData.isHomeTeam ? gameData.awayScore : gameData.homeScore];
    const teamRow2 = [gameData.isHomeTeam ? '若葉' : gameData.opponent, ...(gameData.isHomeTeam ? homeScores : awayScores), gameData.isHomeTeam ? gameData.homeScore : gameData.awayScore];


    // 2. タイムラインデータの作成
    const timelineHeader = ['時刻', '回', 'アウト', 'チーム', '内容'];
    const timelineRows = gameData.timeline.slice().reverse().map(entry => [
      entry.time,
      entry.inning,
      entry.outCount,
      entry.team,
      entry.message.replace(/,/g, '、') // CSVでカンマが誤認識されないように置換
    ]);

    // 3. すべてのデータを結合
    const exportData = [
      ['対戦相手', gameData.opponent],
      ['試合日', gameData.date],
      ['スコア', `${teamRow2[0]} ${scoreB} - ${scoreA} ${teamRow1[0]}`],
      [], // 空行
      ['イニング別スコア'],
      scoreboardHeader,
      teamRow2,
      teamRow1,
      [], // 空行
      ['タイムライン'],
      timelineHeader,
      ...timelineRows
    ];

    return exportData;
  };

  // URL パラメータからゲームIDを取得
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId');

    if (gameIdFromUrl) {
      // 観戦モードで開始
      loadGame(gameIdFromUrl, 'watch'); 
    }
  }, []);


  // ゲーム状態をFirebaseに保存
  const saveCurrentGameState = useCallback(async () => {
    if (!gameId || !isGameCreator) return;

    const currentState = {
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
    gameState: 'playing',
    gameStartDate: gameStartDate,
    createdAt: gameStartDate || Date.now()
  };

  try {
    await saveGameState(gameId, currentState);
    setIsConnected(true);
  } catch (error) {
    console.error('保存失敗:', error);
    setIsConnected(false);
  }
}, [
  gameId, isGameCreator, opponentTeam, isHomeTeam, currentInning, 
  currentTeamBatting, outCount, bases, homeScore, awayScore, 
  timeline, currentBatter, customBatter, useCustomBatter, gameStartDate
]);

  // 状態が変更されたときにFirebaseに保存
  useEffect(() => {
    if (isGameCreator && gameState === 'playing') {
      saveCurrentGameState();
    }
  }, [
    opponentTeam, currentInning, currentTeamBatting, outCount,
  bases, homeScore, awayScore, timeline, currentBatter,
  customBatter, useCustomBatter,
  isGameCreator, gameState, saveCurrentGameState ]);

  // 試合開始
  const startGame = () => {
    if (!opponentTeam) {
      alert('対戦相手のチーム名を入力してください');
      return;
    }
    setGameStartDate(Date.now()); // 現在のタイムスタンプを保存

    // ゲームIDを生成
    const newGameId = generateGameId();
    setGameId(newGameId);
    setIsGameCreator(true);
    setIsWatchingMode(false);

    // 共有URLを生成
    const url = `${window.location.origin}${window.location.pathname}?gameId=${newGameId}`;
    setShareUrl(url);

    setGameState('playing');
    setCurrentTeamBatting('away');
    const startMessage = `試合開始！ゲームID: ${newGameId}`;
    addToTimeline(startMessage);

    // 共有ダイアログを表示
    setShowShareDialog(true);
  };

  // 速報観戦モード
  const watchGame = () => {
    setGameState('watching');
  };

  // タイムラインに追加
  const addToTimeline = (message, eventDetails = {}) => {
    const timestamp = new Date().toLocaleTimeString();

    // eventDetails に値があればそれを使い、なければ現在の state を使う
    const newEntry = {
      time: timestamp,
      message: message,
      inning: eventDetails.inning !== undefined ? eventDetails.inning : currentInning,
      team: eventDetails.team !== undefined ? eventDetails.team : getCurrentTeamName(),
      outCount: eventDetails.outCount !== undefined ? eventDetails.outCount : outCount,
    };
    setTimeline(prev => [newEntry, ...prev]);
  };

  // チーム名を短縮する関数
  const truncateTeamName = (name) => {
    if (name.length > 4) {
      return name.substring(0, 2) + '..';
    }
    return name;
  };


  // 現在攻撃中のチーム名を取得
  const getCurrentTeamName = () => {
    if (isHomeTeam) {
      // 若葉が後攻の場合
      return currentTeamBatting === 'away' ? truncateTeamName(opponentTeam) : '若葉';
    } else {
      // 若葉が先攻の場合
      return currentTeamBatting === 'away' ? '若葉' : truncateTeamName(opponentTeam);
    }
  };

  // URLをクリップボードにコピー
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('観戦用URLをコピーしました！');
    } catch (err) {
      console.error('コピー失敗:', err);
      // フォールバック
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('観戦用URLをコピーしました！');
    }
  };



  // 共有ダイアログ
  const ShareDialog = () => {
    if (!showShareDialog) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-bold mb-4 text-center">観戦用URL</h3>
          <p className="text-sm text-gray-600 mb-4">
            このURLを共有すると、他の人がリアルタイムで試合を観戦できます
          </p>

          <div className="bg-gray-100 p-3 rounded-lg mb-4 break-all text-sm">
            {shareUrl}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={copyToClipboard}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
            >
              <Copy className="h-4 w-4" />
              <span>コピー</span>
            </button>
            <button
              onClick={() => setShowShareDialog(false)}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
            >
              閉じる
            </button>
          </div>

          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500">ゲームID: {gameId}</p>
          </div>
        </div>
      </div>
    );
  };

  // 接続状態表示
  const ConnectionStatus = () => {
    if (!gameId) return null;

    return (
      <div className="fixed top-4 right-4 z-40">
        <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${isConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
          {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <span>{isConnected ? '接続中' : '切断'}</span>
        </div>
      </div>
    );
  };

  // 得点追加
  const addRun = () => {
    const teamName = getCurrentTeamName();

    if ((isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away')) {
      // 若葉の得点
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
      // 相手チームの得点
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

  // アウトカウント増加
  const addOut = () => {
    const newOutCount = outCount + 1;
    setOutCount(newOutCount);
    addToTimeline(`アウト！ (${newOutCount}アウト)`);

    if (newOutCount >= 3) {
      changeInning();
    }
  };

  // イニング変更
  const changeInning = () => {
    // 得点が入らなかった場合、スコア表に0を記録
    if ((isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away')) {
      // 若葉の攻撃終了
      if (isHomeTeam) {
        setHomeScore(prev => {
          const newScore = [...prev];
          if (newScore[currentInning - 1] === null) {
            newScore[currentInning - 1] = 0;
          }
          return newScore;
        });
      } else {
        setAwayScore(prev => {
          const newScore = [...prev];
          if (newScore[currentInning - 1] === null) {
            newScore[currentInning - 1] = 0;
          }
          return newScore;
        });
      }
    } else {
      // 相手チームの攻撃終了
      if (isHomeTeam) {
        setAwayScore(prev => {
          const newScore = [...prev];
          if (newScore[currentInning - 1] === null) {
            newScore[currentInning - 1] = 0;
          }
          return newScore;
        });
      } else {
        setHomeScore(prev => {
          const newScore = [...prev];
          if (newScore[currentInning - 1] === null) {
            newScore[currentInning - 1] = 0;
          }
          return newScore;
        });
      }
    }

    // 1. 「次の」状態をすべて計算します
    let nextInning;
    let nextTeamBatting;

    if (currentTeamBatting === 'away') {
      // 現在が「表」なら、次は「裏」
      nextTeamBatting = 'home';
      nextInning = currentInning; // イニング数は同じ
    } else {
      // 現在が「裏」なら、次は次のイニングの「表」
      nextTeamBatting = 'away';
      nextInning = currentInning + 1; // イニング数を1増やす
    }

    // 2. 「次の」攻撃チーム名を取得します
    let nextTeamName;
    const teamNameOpponent = truncateTeamName(opponentTeam);
    if (isHomeTeam) { // 若葉が後攻の場合
      nextTeamName = (nextTeamBatting === 'away') ? teamNameOpponent : '若葉';
    } else { // 若葉が先攻の場合
      nextTeamName = (nextTeamBatting === 'away') ? '若葉' : teamNameOpponent;
    }

    // 3. 計算した「次の」情報を使ってタイムラインを更新します
    const inningHalf = (nextTeamBatting === 'home') ? '裏' : '表';
    const message = `${nextInning}回${inningHalf}開始`;

    addToTimeline(message, {
      inning: nextInning,
      team: nextTeamName,
      outCount: 0 // チェンジ直後は必ず0アウト
    });

    // 4. 最後に、計算済みの値でstateを更新します
    setCurrentTeamBatting(nextTeamBatting);
    setCurrentInning(nextInning);
    setOutCount(0);
    setBases({ first: false, second: false, third: false });
  };

  // 強制チェンジ
  const forceChange = () => {
    changeInning();
  };

  // 自由コメント投稿
  const postFreeComment = () => {
    if (!freeComment.trim()) {
      alert('コメントを入力してください');
      return;
    }
    addToTimeline(freeComment.trim());
    setFreeComment('');
  };

  // 打席結果処理
  const handleBattingResult = (result) => {
    const batterName = useCustomBatter ? customBatter : currentBatter;
    if (!batterName) {
      alert('打者名を選択または入力してください');
      return;
    }

    let message = `${batterName}: ${result}`;
    let runsScored = 0;

    // 結果に応じた処理
    switch (result) {
      case 'ヒット':
        // ランナー進塁処理（簡略化）
        if (bases.third) runsScored++;
        setBases(prev => ({ first: true, second: prev.first, third: prev.second }));
        break;
      case '2ベース':
        if (bases.third) runsScored++;
        if (bases.second) runsScored++;
        setBases(prev => ({ first: false, second: true, third: prev.first }));
        break;
      case '3ベース':
        if (bases.third) runsScored++;
        if (bases.second) runsScored++;
        if (bases.first) runsScored++;
        setBases({ first: false, second: false, third: true });
        break;
      case 'ホームラン':
        runsScored = 1;
        if (bases.first) runsScored++;
        if (bases.second) runsScored++;
        if (bases.third) runsScored++;
        setBases({ first: false, second: false, third: false });
        break;
      case '四球':
      case '死球':
        // ランナー進塁処理（簡略化）
        setBases(prev => ({
          first: true,
          second: prev.first && prev.second ? true : prev.second,
          third: prev.first && prev.second && prev.third ? true : prev.third
        }));
        default:
        // 何もしない、または予期せぬ結果のログを出力
        break;
    }

    // 得点を追加
    if (runsScored > 0) {
      const teamName = getCurrentTeamName();

      if ((isHomeTeam && currentTeamBatting === 'home') || (!isHomeTeam && currentTeamBatting === 'away')) {
        // 若葉の得点
        if (isHomeTeam) {
          setHomeScore(prev => {
            const newScore = [...prev];
            newScore[currentInning - 1] = (newScore[currentInning - 1] || 0) + runsScored;
            return newScore;
          });
        } else {
          setAwayScore(prev => {
            const newScore = [...prev];
            newScore[currentInning - 1] = (newScore[currentInning - 1] || 0) + runsScored;
            return newScore;
          });
        }
      } else {
        // 相手チームの得点
        if (isHomeTeam) {
          setAwayScore(prev => {
            const newScore = [...prev];
            newScore[currentInning - 1] = (newScore[currentInning - 1] || 0) + runsScored;
            return newScore;
          });
        } else {
          setHomeScore(prev => {
            const newScore = [...prev];
            newScore[currentInning - 1] = (newScore[currentInning - 1] || 0) + runsScored;
            return newScore;
          });
        }
      }
      message += ` (${runsScored}点獲得！)`;
    }

    addToTimeline(message);

    // 入力フィールドをリセット
    setCurrentBatter('');
    setCustomBatter('');
    setUseCustomBatter(false);
  };

  // ベース状態切り替え
  const toggleBase = (base) => {
    setBases(prev => ({
      ...prev,
      [base]: !prev[base]
    }));
  };

  // 試合終了
  const endGame = () => {
    const finalHomeScore = homeScore.reduce((a, b) => (a || 0) + (b || 0), 0);
    const finalAwayScore = awayScore.reduce((a, b) => (a || 0) + (b || 0), 0);

    let winner;
    if (isHomeTeam) {
      winner = finalHomeScore > finalAwayScore ? '若葉' : opponentTeam;
    } else {
      winner = finalAwayScore > finalHomeScore ? '若葉' : opponentTeam;
    }
  
  

    const gameData = {
      gameId: gameId,
      date: new Date().toLocaleDateString(),
      opponent: opponentTeam,
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      winner: winner,
      timeline: timeline,
      isHomeTeam: isHomeTeam,
      homeScoreInnings: homeScore.map(s => s === null ? 0 : s),
      awayScoreInnings: awayScore.map(s => s === null ? 0 : s)
    };

    setPastGames(prev => [gameData, ...prev]);

    // ゲーム状態をリセット
    setGameState('setup');
    setCurrentInning(1);
    setCurrentTeamBatting('away');
    setOutCount(0);
    setBases({ first: false, second: false, third: false });
    setHomeScore(Array(6).fill(null));
    setAwayScore(Array(6).fill(null));
    setTimeline([]);
    setOpponentTeam('');
    setFreeComment('');
  };


  const loadGame = (id, mode = 'watch') => {
  const gameIdToLoad = id;
  console.log(`[App.js] loadGame が呼び出されました。ID: ${gameIdToLoad},モード: ${mode}`); // ログ追加

  if (!gameIdToLoad || gameIdToLoad.trim() === '') {
    alert('試合IDが入力されていません。');
    return;
  }

  // 既存のリスナーがもし残っていれば、必ず停止する
  if (firebaseListener) {
    stopWatching(firebaseListener);
    console.log('[App.js] 既存のリスナーを停止しました。'); // ログ追加
  }

  
  const newListener = watchGameState(
    gameIdToLoad,
    (doc) => { // 成功時の処理
      console.log('[App.js] Firebaseからデータを受信しました。'); // ログ追加
      if (doc.exists()) {
        console.log('[App.js] ドキュメントが見つかりました。画面を更新します。'); // ログ追加
        const data = doc.data();
      
      // State更新
      if (data.opponentTeam) setOpponentTeam(data.opponentTeam);
      /*if (data.isHomeTeam !== undefined) setIsHomeTeam(data.isHomeTeam);
      if (data.currentInning) setCurrentInning(data.currentInning);
      if (data.currentTeamBatting) setCurrentTeamBatting(data.currentTeamBatting);
      if (data.outCount !== undefined) setOutCount(data.outCount);
      if (data.bases) setBases(data.bases);
      if (data.homeScore) setHomeScore(data.homeScore);
      if (data.awayScore) setAwayScore(data.awayScore);
      if (data.timeline) setTimeline(data.timeline);
      if (data.currentBatter) setCurrentBatter(data.currentBatter);
      if (data.customBatter) setCustomBatter(data.customBatter);
      if (data.useCustomBatter !== undefined) setUseCustomBatter(data.useCustomBatter);
      if (data.gameStartDate) setGameStartDate(data.gameStartDate);
      */
      // モードに応じて最終的な画面状態を決定
      if (mode === 'watch') {
        setGameState('watching');
      } else if (mode === 'resume') {
        setGameId(gameIdToLoad);
        setIsGameCreator(true); // 記録者として設定
        setGameState('playing');  // 入力画面へ
        }
    } else {
      console.log('[App.js] ドキュメントが見つかりませんでした。'); // ログ追加
        alert('指定された試合IDが見つかりませんでした。');
        returnToSetup();
      }
    },
    (error) => { // エラー時の処理
      console.error('[App.js] Firebaseからのデータ取得でエラーが発生しました。', error);
      alert('データの読み込みに失敗しました。コンソールでエラーを確認してください。');
      returnToSetup();
    }
  );


  // 新しいリスナーをStateに保存
  setFirebaseListener(newListener);
};


      // Firebaseから全試合データを取得する関数
    const handleFetchFirebaseGames = async () => {
    setIsLoading(true);
    const games = await getAllGames();
    setFirebaseGames(games);
    setIsLoading(false);
    setGameState('firebaseList');
  };

  // 試合IDをクリップボードにコピーする関数
  const copyIdToClipboard = async (id) => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      alert(`試合ID「${id}」をコピーしました！`);
    } catch (err) {
      console.error('IDのコピーに失敗しました:', err);
      alert('IDのコピーに失敗しました。');
    }
  };

  // 特定の試合データを削除する関数
  const deleteGame = (idToDelete) => {
    if (window.confirm(`試合ID: ${idToDelete} のデータを本当に削除しますか？\nこの操作は元に戻せません。`)) {
      setPastGames(prevGames => prevGames.filter(game => game.gameId !== idToDelete));
    }
  };



// 接続を解除してセットアップ画面に戻るための新しい関数
const returnToSetup = () => {
  if (firebaseListener) {
    stopWatching(firebaseListener); // 監視を停止する
    setFirebaseListener(null);      // listenerの状態をリセット
  }
  setGameState('setup');
};


  // タイムライン表示
  const showTimeline = (game) => {
    setSelectedGameTimeline(game);
    setGameState('timeline');
  };

  // タイムライン画面から戻る
  const backToSetup = () => {
    setSelectedGameTimeline(null);
    setGameState('setup');
  };

  // タイムライン表示画面
  if (gameState === 'timeline' && selectedGameTimeline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 to-pink-500 p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl p-6">
          <div className="flex items-center mb-6">
            <button
              onClick={returnToSetup}
              className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">試合振り返り</h1>
              <p className="text-gray-600">
                {selectedGameTimeline.date} vs {selectedGameTimeline.opponent}
              </p>
              <p className="text-lg font-bold">
                {selectedGameTimeline.isHomeTeam ? '若葉' : selectedGameTimeline.opponent} {selectedGameTimeline.isHomeTeam ? selectedGameTimeline.homeScore : selectedGameTimeline.awayScore} - {selectedGameTimeline.isHomeTeam ? selectedGameTimeline.awayScore : selectedGameTimeline.homeScore} {selectedGameTimeline.isHomeTeam ? selectedGameTimeline.opponent : '若葉'}
                <span className={`ml-2 ${selectedGameTimeline.winner === '若葉' ? 'text-blue-600' : 'text-red-600'}`}>
                  ({selectedGameTimeline.winner}勝利)
                </span>
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="font-bold mb-4 text-center">タイムライン</h3>
            {selectedGameTimeline.timeline.length === 0 ? (
              <p className="text-center text-gray-500">記録がありません</p>
            ) : (
              selectedGameTimeline.timeline.slice().reverse().map((entry, index) => (
                <div key={index} className="border-b border-gray-300 pb-2 mb-2 last:border-b-0">
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-gray-500">{entry.time}</span>
                    <span className="text-gray-500">{entry.inning}回 {entry.outCount}アウト</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-blue-600">[{entry.team}]</span> {entry.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // 過去の試合リストの画面
  if (gameState === 'firebaseList') {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-700 to-gray-900 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={returnToSetup}
            className="mr-4 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Firebase 保存済み試合一覧</h1>
            <p className="text-gray-600">試合IDをクリックすると観戦モードで開きます</p>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-3">
          {firebaseGames.length === 0 ? (
            <p className="text-center text-gray-500 py-4">保存されている試合データがありません。</p>
          ) : (
            firebaseGames.map((game) => {
              // スコアの合計を計算
              const totalHomeScore = (game.homeScore || []).reduce((a, b) => a + b, 0);
              const totalAwayScore = (game.awayScore || []).reduce((a, b) => a + b, 0);

              return (
                <div key={game.id} className="bg-gray-50 hover:bg-gray-100 p-3 rounded-lg transition-colors cursor-pointer"
                     onClick={() => loadGame(game.id, 'watch')}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">
                      {new Date(game.createdAt).toLocaleDateString()}
                    </span>
                    <span className="font-medium text-sm">vs {game.opponentTeam}</span>
                  </div>
                  <div className="text-center font-bold text-blue-600">
                    {game.id}
                  </div>
                  <div className="text-center text-lg mt-1">
                    <span>{game.isHomeTeam ? game.opponentTeam : '若葉'}</span>
                    <span className="font-bold mx-2">{game.isHomeTeam ? totalAwayScore : totalHomeScore}</span>
                    <span>-</span>
                    <span className="font-bold mx-2">{game.isHomeTeam ? totalHomeScore : totalAwayScore}</span>
                    <span>{game.isHomeTeam ? '若葉' : game.opponentTeam}</span>
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

  // セットアップ画面の修正版
  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 p-4">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Trophy className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">若葉試合速報</h1>
            <p className="text-gray-600">試合情報を入力してください</p>
          </div>

          <div className="space-y-6">
            {/* --- ① 試合開始 --- */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">対戦相手チーム名</label>
    <input
      type="text"
      value={opponentTeam}
      onChange={(e) => setOpponentTeam(e.target.value)}
      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      placeholder="チーム名を入力"
    />
  </div>
  <div>
    <label className="flex items-center space-x-3">
      <input
        type="checkbox"
        checked={isHomeTeam}
        onChange={(e) => setIsHomeTeam(e.target.checked)}
        className="w-5 h-5 text-blue-600"
      />
      <span className="text-sm font-medium text-gray-700">若葉が後攻</span>
    </label>
  </div>
  <button
    onClick={startGame}
    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
  >
    <Play className="h-5 w-5" />
    <span>試合開始（新規記録）</span>
  </button>

  
  {/* --- ② 観戦開始 --- */}
  <div className="border-t border-gray-200 pt-6">
    <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">観戦モード</h3>
    <div className="space-y-3">
      <input
        type="text"
        value={watchingGameId}
        onChange={(e) => setWatchingGameId(e.target.value.toUpperCase())}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        placeholder="観戦したい試合のIDを入力。"
        maxLength={6}
      />
      <button
        onClick={() => loadGame(watchingGameId, 'watch')}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        <Eye className="h-5 w-5" />
        <span>観戦開始</span>
      </button>
    </div>
  </div>

  {/* --- ③ 過去の試合を閲覧 --- */}
  <div className="border-t border-gray-200 pt-6">
    <button
      onClick={handleFetchFirebaseGames}
      disabled={isLoading}
      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:bg-purple-300"
    >
      <span>{isLoading ? '読込中...' : '過去の試合を閲覧'}</span>
    </button>
  </div>
  
  {/* --- ④ 速報継続 --- */}
  <div className="border-t border-gray-200 pt-6">
    <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">記録の再開</h3>
    <div className="space-y-3">
      <input
        type="text"
        value={resumeGameId}
        onChange={(e) => setResumeGameId(e.target.value.toUpperCase())}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        placeholder="記録を再開する試合のIDを入力"
        maxLength={6}
      />
      <button
        onClick={() => loadGame(resumeGameId, 'resume')}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        <span>速報を継続</span>
      </button>
    </div>
  </div>
</div>

          {/* ↓↓ このブロックを丸ごと追加 ↓↓ */}
          {pastGames.filter(game => game.gameId).length > 0 && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">過去の試合IDリスト</h3>
              <div className="space-y-2 bg-gray-50 p-3 rounded-lg max-h-48 overflow-y-auto">
                {pastGames
                  .filter(game => game.gameId) // gameIdを持つ試合のみを対象にする
                  .map(game => (
                    <div key={game.gameId} className="flex items-center justify-between text-sm p-2 bg-white rounded shadow-sm">
                      <div>
                        <span className="font-mono text-gray-700">{game.gameId}</span>
                        <span className="ml-2 text-gray-500">(vs {game.opponent})</span>
                      </div>
                      <button
                        onClick={() => copyIdToClipboard(game.gameId)}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded transition-colors"
                      >
                        コピー
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
          
          {/* 既存の過去の試合表示 */}
          {pastGames.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4">過去の試合</h2>
              {pastGames.slice(0, 3).map((game, index) => {
                // 各ゲームに対してエクスポート用データを準備
                const exportData = prepareDataForExport(game);
                // ファイル名を生成
                const filename = `softball-score-${game.date.replace(/\//g, '-')}-${game.opponent}.csv`;

                return (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg mb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm text-gray-600">{game.date}</span>
                        {/* game.gameId が存在する場合のみ表示する */}
                        {game.gameId && (
                          <span className="ml-2 text-xs text-gray-500 bg-gray-200 px-1 rounded">
                            ID: {game.gameId}
                          </span>
                        )}
                      </div>
                      <span className="font-medium">vs {game.opponent}</span>
                    </div>
                    <button
                      onClick={() => showTimeline(game)}
                      className="w-full text-center mt-1 hover:bg-gray-100 p-1 rounded transition-colors"
                    >
                      <span className={`font-bold ${game.winner === '若葉' ? 'text-blue-600' : 'text-red-600'}`}>
                        {game.isHomeTeam ? '若葉' : game.opponent} {game.isHomeTeam ? game.homeScore : game.awayScore} - {game.isHomeTeam ? game.awayScore : game.homeScore} {game.isHomeTeam ? game.opponent : '若葉'} ({game.winner}勝利)
                      </span>
                      <div className="text-xs text-gray-500 mt-1">クリックで詳細表示</div>
                    </button>
                    {/* エクスポートボタン */}
                    <div className="text-center mt-2">
                      <CSVLink
                        data={exportData}
                        filename={filename}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-3 rounded-lg transition-colors"
                        target="_blank"
                      >
                        CSVエクスポート
                      </CSVLink>

                      {/* ↓↓ ここに削除ボタンを追加します ↓↓ */}
                      {game.gameId && (
                        <button
                          onClick={() => deleteGame(game.gameId)}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded-lg transition-colors"
                        >
                          削除
                        </button>
                      )}
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

  // 速報観戦画面
  if (gameState === 'watching') {
    const totalHomeScore = homeScore.reduce((total, score) => {
      return total + (typeof score === 'number' && !isNaN(score) ? score : 0);
    }, 0);
    const totalAwayScore = awayScore.reduce((total, score) => {
      return total + (typeof score === 'number' && !isNaN(score) ? score : 0);
    }, 0);
    const currentTeamName = getCurrentTeamName();

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col relative">
        <button
        onClick={returnToSetup}
        className="absolute top-4 left-4 z-40 p-2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full transition-colors"
        aria-label="セットアップに戻る"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
        {/* 速報プレビュー画面（上半分） */}
        <div className="flex-1 bg-gradient-to-r from-blue-900 to-green-800 text-white p-3 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-3">
              <h1 className="text-lg font-bold">⚾ 速報中 ⚾</h1>
              <p className="text-xs text-gray-300">試合日時: {formatDate(gameStartDate)}</p>
              <p className="text-xs truncate">若葉 vs {opponentTeam}</p>
            </div>

            {/* スコアボード（6回分、1行ずつ） */}
            <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-4">
              <div className="text-center text-sm">
                {/* ヘッダー */}
                <div className="grid grid-cols-9 gap-1 mb-2 border-b border-gray-500 pb-2">
                  <div className="text-left text-xs">チーム</div>
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="text-xs">{i}</div>
                  ))}
                  <div className="font-bold text-xs">R</div>
                </div>

                {/* スコア表示（先攻・後攻に応じて表示順序を調整） */}
                {isHomeTeam ? (
                  <>
                    {/* 若葉が後攻の場合：相手チーム（先攻）が上 */}
                    <div className="grid grid-cols-9 gap-1 mb-1">
                      <div className="text-left text-xs truncate">{opponentTeam}</div>
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="text-xs">{awayScore[i] !== null ? awayScore[i] : '-'}</div>
                      ))}
                      <div className="font-bold text-xs">{totalAwayScore}</div>
                    </div>

                    <div className="grid grid-cols-9 gap-1">
                      <div className="text-left text-xs truncate">若葉</div>
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="text-xs">{homeScore[i] !== null ? homeScore[i] : '-'}</div>
                      ))}
                      <div className="font-bold text-xs">{totalHomeScore}</div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 若葉が先攻の場合：若葉が上 */}
                    <div className="grid grid-cols-9 gap-1 mb-1">
                      <div className="text-left text-xs truncate">若葉</div>
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="text-xs">{awayScore[i] !== null ? awayScore[i] : '-'}</div>
                      ))}
                      <div className="font-bold text-xs">{totalAwayScore}</div>
                    </div>

                    <div className="grid grid-cols-9 gap-1">
                      <div className="text-left text-xs truncate">{opponentTeam}</div>
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="text-xs">{homeScore[i] !== null ? homeScore[i] : '-'}</div>
                      ))}
                      <div className="font-bold text-xs">{totalHomeScore}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 現在の状況 */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-300">現在</div>
                <div className="font-bold text-sm">{currentInning}回{currentTeamBatting === 'away' ? '表' : '裏'}</div>
                <div className="text-xs truncate">
                  {currentTeamName}
                </div>
              </div>

              <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-300">アウト</div>
                <div className="font-bold text-xl">{outCount}</div>
              </div>

              <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-300">打者</div>
                <div className="font-bold text-xs truncate">
                  {useCustomBatter ? customBatter : currentBatter || '未選択'}
                </div>
              </div>
            </div>

            {/* ダイアモンド */}
            <div className="flex justify-center mb-3">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-2 border-white transform rotate-45"></div>
                {/* 3塁 */}
                <div className={`absolute top-1/2 left-0 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white ${bases.third ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                {/* 2塁 */}
                <div className={`absolute top-0 left-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white ${bases.second ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                {/* 1塁 */}
                <div className={`absolute top-1/2 right-0 w-3 h-3 -mr-1.5 -mt-1.5 rounded-full border-2 border-white ${bases.first ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                {/* ホーム */}
                <div className="absolute bottom-0 left-1/2 w-3 h-3 -ml-1.5 -mb-1.5 rounded-full border-2 border-white bg-red-600"></div>
              </div>
            </div>

            {/* タイムライン */}
            <div className="bg-white bg-opacity-10 rounded-lg p-3">
              <h3 className="font-bold mb-2 text-center text-sm">⚡ タイムライン ⚡</h3>
              <div className="max-h-64 overflow-y-auto">
                {timeline.length === 0 ? (
                  <p className="text-center text-gray-300 text-xs">まだプレイがありません</p>
                ) : (
                  timeline.map((entry, index) => (
                    <div key={index} className="border-b border-gray-600 pb-1 mb-1 last:border-b-0">
                      <div className="flex justify-between items-start text-xs">
                        <span className="text-gray-300">{entry.time}</span>
                        <span className="text-gray-300">{entry.inning}回 {entry.outCount}アウト</span>
                      </div>
                      <div className="text-xs">
                        <span className="font-medium text-yellow-300">[{entry.team}]</span> {entry.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 試合中の入力画面
  const totalHomeScore = homeScore.reduce((a, b) => (a || 0) + (b || 0), 0);
  const totalAwayScore = awayScore.reduce((a, b) => (a || 0) + (b || 0), 0);
  const currentTeamName = getCurrentTeamName();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 速報プレビュー画面（上半分） */}
      <div className="flex-1 bg-gradient-to-r from-blue-900 to-green-800 text-white p-3 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-3">
            <h1 className="text-lg font-bold">⚾ 若葉試合速報 ⚾</h1>
            <p className="text-xs text-gray-300">試合日時: {formatDate(gameStartDate)}</p>
            <p className="text-xs truncate">若葉 vs {opponentTeam}</p>
          </div>

          {/* スコアボード（6回分、1行ずつ） */}
          <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-4">
            <div className="text-center text-sm">
              {/* ヘッダー */}
              <div className="grid grid-cols-9 gap-1 mb-2 border-b border-gray-500 pb-2">
                <div className="text-left text-xs">チーム</div>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="text-xs">{i}</div>
                ))}
                <div className="font-bold text-xs">R</div>
              </div>

              {/* スコア表示（先攻・後攻に応じて表示順序を調整） */}
              {isHomeTeam ? (
                <>
                  {/* 若葉が後攻の場合：相手チーム（先攻）が上 */}
                  <div className="grid grid-cols-9 gap-1 mb-1">
                    <div className="text-left text-xs truncate">{opponentTeam}</div>
                    {awayScore.map((score, i) => (
                      <div key={i} className="text-xs">{score !== null ? score : '-'}</div>
                    ))}
                    <div className="font-bold text-sm">{totalAwayScore}</div>
                  </div>

                  <div className="grid grid-cols-9 gap-1">
                    <div className="text-left text-xs truncate">若葉</div>
                    {homeScore.map((score, i) => (
                      <div key={i} className="text-xs">{score !== null ? score : '-'}</div>
                    ))}
                    <div className="font-bold text-sm">{totalHomeScore}</div>
                  </div>
                </>
              ) : (
                <>
                  {/* 若葉が先攻の場合：若葉が上 */}
                  <div className="grid grid-cols-9 gap-1 mb-1">
                    <div className="text-left text-xs truncate">若葉</div>
                    {awayScore.map((score, i) => (
                      <div key={i} className="text-xs">{score !== null ? score : '-'}</div>
                    ))}
                    <div className="font-bold text-sm">{totalAwayScore}</div>
                  </div>

                  <div className="grid grid-cols-9 gap-1">
                    <div className="text-left text-xs truncate">{opponentTeam}</div>
                    {homeScore.map((score, i) => (
                      <div key={i} className="text-xs">{score !== null ? score : '-'}</div>
                    ))}
                    <div className="font-bold text-sm">{totalHomeScore}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 現在の状況 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-300">現在</div>
              <div className="font-bold text-sm">{currentInning}回{currentTeamBatting === 'away' ? '表' : '裏'}</div>
              <div className="text-xs truncate">
                {currentTeamName}
              </div>
            </div>

            <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-300">アウト</div>
              <div className="font-bold text-xl">{outCount}</div>
            </div>

            <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-300">打者</div>
              <div className="font-bold text-xs truncate">
                {useCustomBatter ? customBatter : currentBatter || '未選択'}
              </div>
            </div>
          </div>

          {/* ダイアモンド */}
          <div className="flex justify-center mb-3">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-2 border-white transform rotate-45"></div>
              {/* 3塁 */}
              <div className={`absolute top-1/2 left-0 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white ${bases.third ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
              {/* 2塁 */}
              <div className={`absolute top-0 left-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white ${bases.second ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
              {/* 1塁 */}
              <div className={`absolute top-1/2 right-0 w-3 h-3 -mr-1.5 -mt-1.5 rounded-full border-2 border-white ${bases.first ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
              {/* ホーム */}
              <div className="absolute bottom-0 left-1/2 w-3 h-3 -ml-1.5 -mb-1.5 rounded-full border-2 border-white bg-red-600"></div>
            </div>
          </div>

          {/* タイムライン */}
          <div className="bg-white bg-opacity-10 rounded-lg p-3 max-h-32 overflow-y-auto">
            <h3 className="font-bold mb-2 text-center text-sm">⚡ タイムライン ⚡</h3>
            {timeline.length === 0 ? (
              <p className="text-center text-gray-300 text-xs">まだプレイがありません</p>
            ) : (
              timeline.map((entry, index) => (
                <div key={index} className="border-b border-gray-600 pb-1 mb-1 last:border-b-0">
                  <div className="flex justify-between items-start text-xs">
                    <span className="text-gray-300">{entry.time}</span>
                    <span className="text-gray-300">{entry.inning}回 {entry.outCount}アウト</span>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium text-yellow-300">[{entry.team}]</span> {entry.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* スコア入力画面（下半分） */}
      <div className="flex-1 bg-white p-3 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-800">📝 スコア入力</h2>
            <div className="flex space-x-2">
              <button
                onClick={forceChange}
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs transition-colors"
              >
                チェンジ
              </button>
              <button
                onClick={endGame}
                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors"
              >
                試合終了
              </button>
            </div>
          </div>

          {/* 打者選択 */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">打者選択</label>
            <div className="flex items-center space-x-3 mb-2">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="preset-batter"
                  name="batter-type"
                  checked={!useCustomBatter}
                  onChange={() => setUseCustomBatter(false)}
                  className="mr-1"
                />
                <label htmlFor="preset-batter" className="text-xs">選手リスト</label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="custom-batter"
                  name="batter-type"
                  checked={useCustomBatter}
                  onChange={() => setUseCustomBatter(true)}
                  className="mr-1"
                />
                <label htmlFor="custom-batter" className="text-xs">自由入力</label>
              </div>
            </div>

            {useCustomBatter ? (
              <input
                type="text"
                value={customBatter}
                onChange={(e) => setCustomBatter(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="打者名を入力"
              />
            ) : (
              <select
                value={currentBatter}
                onChange={(e) => setCurrentBatter(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">打者を選択</option>
                {defaultPlayers.map((player, index) => (
                  <option key={index} value={player}>{player}</option>
                ))}
              </select>
            )}
          </div>

          {/* 打席結果ボタン */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">打席結果</label>
            <div className="grid grid-cols-4 gap-1">
              {['ヒット', '2ベース', '3ベース', 'ホームラン', '三振', '振り逃げ', 'ゴロ', 'ライナー', 'フライ', 'バント', '死球', '四球'].map((result) => (
                <button
                  key={result}
                  onClick={() => handleBattingResult(result)}
                  className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs transition-colors"
                >
                  {result}
                </button>
              ))}
            </div>
          </div>

          {/* アウト・得点・ベース操作 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <div>
              <button
                onClick={addOut}
                className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm transition-colors"
              >
                アウト ({outCount}/3)
              </button>
            </div>

            <div>
              <button
                onClick={addRun}
                className="w-full px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm transition-colors"
              >
                得点
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ベース操作</label>
              <div className="flex space-x-1">
                <button
                  onClick={() => toggleBase('first')}
                  className={`px-2 py-1 rounded-lg text-xs transition-colors ${bases.first ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  1塁
                </button>
                <button
                  onClick={() => toggleBase('second')}
                  className={`px-2 py-1 rounded-lg text-xs transition-colors ${bases.second ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  2塁
                </button>
                <button
                  onClick={() => toggleBase('third')}
                  className={`px-2 py-1 rounded-lg text-xs transition-colors ${bases.third ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  3塁
                </button>
              </div>
            </div>
          </div>

          {/* 自由記入欄 */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">自由コメント投稿</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={freeComment}
                onChange={(e) => setFreeComment(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="盗塁、ワイルドピッチなどのコメントを入力"
              />
              <button
                onClick={postFreeComment}
                className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition-colors"
              >
                投稿
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoftballScoreApp;