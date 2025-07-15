import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, orderBy, query, getDoc, deleteDoc, increment } from "firebase/firestore";

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

export const saveGameState = async (teamId, gameId, gameState) => {
  const gameRef = doc(db, 'teams', teamId, 'games', gameId);
  await setDoc(gameRef, { ...gameState, lastUpdated: Date.now() });
};

export const watchGameState = (teamId, gameId, callback, errorCallback) => {
  const gameRef = doc(db, 'teams', teamId, 'games', gameId);
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
  const gamesCollectionRef = collection(db, 'teams', teamId, 'games');
  const q = query(gamesCollectionRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  const games = [];
  querySnapshot.forEach((doc) => {
    games.push({ id: doc.id, ...doc.data() });
  });
  return games;
};

export const deleteGameFromFirebase = async (teamId, gameId) => {
  try {
    const gameRef = doc(db, 'teams', teamId, 'games', gameId);
    await deleteDoc(gameRef);
    return true;
  } catch (error) {
    console.error("ドキュメントの削除中にエラーが発生しました:", error);
    return false;
  }
};

// ★★★ 選手成績更新のロジックを修正 ★★★
export const updatePlayerStats = async (teamId, playerName, statsToAdd) => {
  const teamRef = doc(db, 'teams', teamId);
  try {
    const updateData = {};
    for (const key in statsToAdd) {
      // Firestoreのincrement命令をここで使う
      updateData[`playerStats.${playerName}.${key}`] = increment(statsToAdd[key]);
    }
    await setDoc(teamRef, updateData, { merge: true });
  } catch (error) {
    console.error("選手成績の更新に失敗しました:", error);
  }
};