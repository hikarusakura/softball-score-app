import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, orderBy, query, getDoc, deleteDoc, updateDoc, increment } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyAz0Lm3rKe5W9r0R_Efye9sIkT7WDQwYvo",
  authDomain: "softball-score-app.firebaseapp.com",
  databaseURL: "https://softball-score-app-default-rtdb.firebaseio.com",
  projectId: "softball-score-app",
  storageBucket: "softball-score-app.appspot.com",
  messagingSenderId: "752191549444",
  appId: "1:752191549444:web:f914184a01593a555f0551"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);


// --- 認証関数 ---
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const onAuth = (callback) => onAuthStateChanged(auth, callback);

// --- チームデータ取得関数 ---
export const getTeamData = (teamId) => {
  const teamRef = doc(db, 'teams', teamId);
  return getDoc(teamRef);
};


// --- 試合データ関連関数 (すべてteamIdを引数に取るように修正) ---

export const saveGameState = async (teamId, year, gameId, gameState) => {
  const gameRef = doc(db, 'teams', teamId, 'years', String(year), 'games', gameId);
  await setDoc(gameRef, { ...gameState, lastUpdated: Date.now() });
};

export const watchGameState = (teamId, year, gameId, callback, errorCallback) => {
  const gameRef = doc(db, 'teams', teamId, 'years', String(year), 'games', gameId);
  return onSnapshot(gameRef, callback, errorCallback);
};

export const stopWatching = (unsubscribe) => {
  if (unsubscribe) unsubscribe();
};

export const generateGameId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const getAllGames = async (teamId) => {
  const gamesCollectionRef = collection(db, 'teams', teamId, 'years', String(year), 'games');
  const q = query(gamesCollectionRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  const games = [];
  querySnapshot.forEach((doc) => {
    games.push({ id: doc.id, ...doc.data() });
  });
  return games;
};

export const deleteGameFromFirebase = async (teamId, year, gameId) => {
  try {
    const gameRef = doc(db, 'teams', teamId, 'years', String(year), 'games', gameId);
    await deleteDoc(gameRef);
    return true;
  } catch (error) {
    console.error("ドキュメントの削除中にエラーが発生しました:", error);
    return false;
  }
};

// ★★★ 選手成績更新のロジックを修正 ★★★
// 特定の選手の成績を更新する（加算・上書き両対応）
export const updatePlayerStats = async (teamId, playerName, statsData, isOverwrite = false) => {
  const teamRef = doc(db, 'teams', teamId);
  try {
    const updateData = {};
    if (isOverwrite) {
      // --- 上書きモード ---
      // playerStatsオブジェクト全体の中の、特定の選手データを丸ごと置き換える
      updateData[`playerStats.${playerName}`] = statsData;
    } else {
      // --- 加算モード ---
      // 各成績にincrement命令を適用する
      for (const key in statsData) {
        updateData[`playerStats.${playerName}.${key}`] = increment(statsData[key]);
      }
    }
    await setDoc(teamRef, updateData, { merge: true });
    return true;
  } catch (error) {
    console.error("選手成績の更新に失敗しました:", error);
    return false;
  }
};

// 特定の選手の成績データを丸ごと上書きする関数
export const setPlayerStats = async (teamId, playerName, newStats) => {
  const teamRef = doc(db, 'teams', teamId);
  try {
    // ドット記法を使い、特定の選手のマップを新しいデータで上書きする
    await setDoc(teamRef, {
      playerStats: {
        [playerName]: newStats
      }
    }, { merge: true }); // merge:trueで他の選手データを消さないようにする
    return true;
  } catch (error) {
    console.error("選手成績の上書きに失敗しました:", error);
    return false;
  }
};

// パスワードを設定・変更する画面と機能
export const updateTeamData = async (teamId, dataToUpdate) => {
  const teamRef = doc(db, 'teams', teamId);
  try {
    await setDoc(teamRef, dataToUpdate, { merge: true });
    return true;
  } catch (error) {
    console.error("チームデータの更新に失敗しました:", error);
    return false;
  }
};

export const incrementLikeCount = async (userId, gameId) => {
  if (!userId || !gameId) return false;
  const gameRef = doc(db, 'teams', userId, 'games', gameId);
  try {
    await updateDoc(gameRef, {
      likeCount: increment(1)
    });
    return true;
  } catch (error) {
    console.error("いいねの更新に失敗しました:", error);
    return false;
  }
};