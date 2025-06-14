import React, { useState, useEffect } from 'react';
import { Play, Users, Trophy, Clock, Target, Eye, ChevronLeft, Share2, Copy, Wifi, WifiOff } from 'lucide-react';
import { saveGameState, watchGameState, stopWatching, generateGameId } from './firebase';


let sharedGameState = {
  isActive: false,
  inputUserId: null,
  gameData: null,
  lastUpdated: null
};

const SoftballScoreApp = () => {
  // 選手リスト（デフォルト）- きよはる追加
  const defaultPlayers = [
    'せいや', 'りゅうせ', 'きよはる', 'きづき', 'れお', 'もあ',
    'つかさ', 'はやと', 'あゆむ', 'はると', 'ゆいと',
    'さほ', 'あいこ', 'しょうい', 'まひろ', 'じん'
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

  // 新しく追加するstate（共有機能用）
  const [gameId, setGameId] = useState(null);
  const [isGameCreator, setIsGameCreator] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [watchingGameId, setWatchingGameId] = useState('');
  const [firebaseListener, setFirebaseListener] = useState(null);

  // URL パラメータからゲームIDを取得
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId');
    
    if (gameIdFromUrl) {
      // 観戦モードで開始
      setWatchingGameId(gameIdFromUrl);
      setGameId(gameIdFromUrl);
      setIsGameCreator(false);
      setIsWatchingMode(true);
      setGameState('watching');
      startWatchingGame(gameIdFromUrl);
    }
  }, []);

  // 観戦モードでゲーム状態を監視
  const startWatchingGame = (gameId) => {
    const listener = watchGameState(gameId, (data) => {
      console.log('ゲーム状態を受信:', data);
      
      // 受信したデータで状態を更新
      if (data.opponentTeam) setOpponentTeam(data.opponentTeam);
      if (data.isHomeTeam !== undefined) setIsHomeTeam(data.isHomeTeam);
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
      
      setIsConnected(true);
    });
    
    setFirebaseListener(listener);
  };

  // ゲーム状態をFirebaseに保存
  const saveCurrentGameState = async () => {
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
      createdAt: Date.now()
    };

    try {
      await saveGameState(gameId, currentState);
      setIsConnected(true);
    } catch (error) {
      console.error('保存失敗:', error);
      setIsConnected(false);
    }
  };

  // 状態が変更されたときにFirebaseに保存
  useEffect(() => {
    if (isGameCreator && gameState === 'playing') {
      saveCurrentGameState();
    }
  }, [
    opponentTeam, currentInning, currentTeamBatting, outCount, 
    bases, homeScore, awayScore, timeline, currentBatter, 
    customBatter, useCustomBatter
  ]);

  // 試合開始
  const startGame = () => {
    if (!opponentTeam) {
      alert('対戦相手のチーム名を入力してください');
      return;
    }

  
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
  const addToTimeline = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const currentTeam = getCurrentTeamName();
    const newEntry = {
      time: timestamp,
      message: message,
      inning: currentInning,
      team: currentTeam,
      outCount: outCount
    };
    
    setTimeline(prev => [newEntry, ...prev]);
  };

  // 現在攻撃中のチーム名を取得
  const getCurrentTeamName = () => {
    if (isHomeTeam) {
      // 若葉が後攻の場合
      return currentTeamBatting === 'away' ? opponentTeam : '若葉';
    } else {
      // 若葉が先攻の場合
      return currentTeamBatting === 'away' ? '若葉' : opponentTeam;
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

  // 観戦モード開始（URLから）
  const startWatchingFromId = () => {
    if (!watchingGameId) {
      alert('ゲームIDを入力してください');
      return;
    }
    
    setGameId(watchingGameId);
    setIsGameCreator(false);
    setIsWatchingMode(true);
    setGameState('watching');
    startWatchingGame(watchingGameId);
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
        <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${
          isConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
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

    if (currentTeamBatting === 'away') {
      // 表から裏へ
      setCurrentTeamBatting('home');
    } else {
      // 裏から次のイニングの表へ
      setCurrentTeamBatting('away');
      setCurrentInning(prev => prev + 1);
    }
    setOutCount(0);
    setBases({ first: false, second: false, third: false });
    
    const nextTeam = currentTeamBatting === 'away' ? getCurrentTeamName() : getCurrentTeamName();
    addToTimeline(`${currentInning}回${currentTeamBatting === 'away' ? '表' : '裏'}開始`);
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
      date: new Date().toLocaleDateString(),
      opponent: opponentTeam,
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      winner: winner,
      timeline: timeline,
      isHomeTeam: isHomeTeam
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
              onClick={backToSetup}
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

// セットアップ画面の修正版
if (gameState === 'setup') {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <Trophy className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">ソフトボール速報</h1>
          <p className="text-gray-600">試合情報を入力してください</p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              対戦相手チーム名
            </label>
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
              <span className="text-sm font-medium text-gray-700">
                若葉が後攻（ホーム）
              </span>
            </label>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={startGame}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Play className="h-5 w-5" />
              <span>試合開始（記録モード）</span>
            </button>
            
            {/* 既存のゲーム観戦用ボタン */}
            {gameId && isGameCreator && (
              <button
                onClick={() => setShowShareDialog(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Share2 className="h-5 w-5" />
                <span>観戦URLを共有</span>
              </button>
            )}
          </div>
          
          {/* 観戦モード用入力 */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">観戦モード</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={watchingGameId}
                onChange={(e) => setWatchingGameId(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="ゲームIDを入力 (例: ABC123)"
                maxLength={6}
              />
              <button
                onClick={startWatchingFromId}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Eye className="h-5 w-5" />
                <span>観戦開始</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* 既存の過去の試合表示 */}
        {pastGames.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4">過去の試合</h2>
            {pastGames.slice(0, 3).map((game, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded-lg mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{game.date}</span>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

  // 速報観戦画面
  if (gameState === 'watching') {
    const totalHomeScore = homeScore.reduce((a, b) => (a || 0) + (b || 0), 0);
    const totalAwayScore = awayScore.reduce((a, b) => (a || 0) + (b || 0), 0);
    const currentTeamName = getCurrentTeamName();

    return (
      <div className="min-h-screen bg-gradient-to-r from-blue-900 to-green-800 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">⚾ 試合進行中 ⚾</h1>
              <p className="text-gray-600">若葉 vs {opponentTeam}</p>
            </div>
            <button
              onClick={() => setGameState('playing')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              入力画面に戻る
            </button>
          </div>
          
          {/* スコアボード */}
          <div className="bg-black bg-opacity-50 rounded-lg p-6 mb-6">
            <div className="text-center">
              <div className="grid grid-cols-9 gap-1 sm:gap-2 mb-3 pb-2">
                <div className="text-left font-semibold min-w-[40px]">.</div>
               {[1,2,3,4,5,6].map(i => (
                 <div key={i} className="text-center font-bold min-w-[28px]">{i}</div>
               ))}
               <div className="text-center font-bold min-w-[32px]">R</div>
          </div>
              
              {/* スコア表示（先攻・後攻に応じて表示順序を調整） */}
              {isHomeTeam ? (
                <>
                  <div className="grid grid-cols-9 gap-2 mb-2">
                    <div className="text-left">{opponentTeam}</div>
                    {awayScore.map((score, i) => (
                      <div key={i} className="text-lg">{score !== null ? score : '-'}</div>
                    ))}
                    <div className="font-bold text-xl">{totalAwayScore}</div>
                  </div>
                  
                  <div className="grid grid-cols-9 gap-2">
                    <div className="text-left">若葉</div>
                    {homeScore.map((score, i) => (
                      <div key={i} className="text-lg">{score !== null ? score : '-'}</div>
                    ))}
                    <div className="font-bold text-xl">{totalHomeScore}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-9 gap-2 mb-2">
                    <div className="text-left">若葉</div>
                    {awayScore.map((score, i) => (
                      <div key={i} className="text-lg">{score !== null ? score : '-'}</div>
                    ))}
                    <div className="font-bold text-xl">{totalAwayScore}</div>
                  </div>
                  
                  <div className="grid grid-cols-9 gap-2">
                    <div className="text-left">{opponentTeam}</div>
                    {homeScore.map((score, i) => (
                      <div key={i} className="text-lg">{score !== null ? score : '-'}</div>
                    ))}
                    <div className="font-bold text-xl">{totalHomeScore}</div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* 現在の状況 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-300">現在</div>
              <div className="font-bold text-lg">{currentInning}回{currentTeamBatting === 'away' ? '表' : '裏'}</div>
              <div className="text-sm">{currentTeamName}</div>
            </div>
            
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-300">アウト</div>
              <div className="font-bold text-3xl">{outCount}</div>
            </div>
            
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-300">打者</div>
              <div className="font-bold text-sm">
                {useCustomBatter ? customBatter : currentBatter || '未選択'}
              </div>
            </div>
          </div>
          
          {/* ダイアモンド */}
          <div className="flex justify-center mb-6">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 border-2 border-white transform rotate-45"></div>
              <div className={`absolute top-1/2 left-0 w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white ${bases.third ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
              <div className={`absolute top-0 left-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white ${bases.second ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
              <div className={`absolute top-1/2 right-0 w-4 h-4 -mr-2 -mt-2 rounded-full border-2 border-white ${bases.first ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
              <div className="absolute bottom-0 left-1/2 w-4 h-4 -ml-2 -mb-2 rounded-full border-2 border-white bg-red-600"></div>
            </div>
          </div>
          
          {/* タイムライン */}
          <div className="bg-white bg-opacity-10 rounded-lg p-4">
            <h3 className="font-bold mb-4 text-center text-lg">⚡ タイムライン ⚡</h3>
            <div className="max-h-64 overflow-y-auto">
              {timeline.length === 0 ? (
                <p className="text-center text-gray-300">まだプレイがありません</p>
              ) : (
                timeline.slice(0, 10).map((entry, index) => (
                  <div key={index} className="border-b border-gray-600 pb-2 mb-2 last:border-b-0">
                    <div className="flex justify-between items-start text-sm">
                      <span className="text-gray-300">{entry.time}</span>
                      <span className="text-gray-300">{entry.inning}回 {entry.outCount}アウト</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-yellow-300">[{entry.team}]</span> {entry.message}
                    </div>
                  </div>
                ))
              )}
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
            <h1 className="text-lg font-bold">⚾ ソフトボール速報 ⚾</h1>
            <p className="text-xs truncate">若葉 vs {opponentTeam}</p>
          </div>
          
          {/* スコアボード（6回分、1行ずつ） */}
          <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-4">
            <div className="text-center text-sm">
              {/* ヘッダー */}
              <div className="grid grid-cols-9 gap-1 mb-2 border-b border-gray-500 pb-2">
                <div className="text-left text-xs">チーム</div>
                {[1,2,3,4,5,6].map(i => (
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
              timeline.slice(0, 8).map((entry, index) => (
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
                {isGameCreator && (
      <button
        onClick={() => setShowShareDialog(true)}
        className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors flex items-center space-x-1"
      >
        <Share2 className="h-4 w-4" />
        <span>共有</span>
      </button>
    )}
              <button
      onClick={() => setGameState('watching')}
      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex items-center space-x-1"
    >
      <Eye className="h-4 w-4" />
      <span>観戦画面</span>
    </button>
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