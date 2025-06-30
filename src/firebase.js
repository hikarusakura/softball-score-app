// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, off, push } from 'firebase/database';
import { collection, getDocs, orderBy, query } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAz0Lm3rKe5W9r0R_Efye9sIkT7WDQwYvo",
  authDomain: "softball-score-app.firebaseapp.com",
  databaseURL: "https://softball-score-app-default-rtdb.firebaseio.com",
  projectId: "softball-score-app",
  storageBucket: "softball-score-app.firebasestorage.app",
  messagingSenderId: "752191549444",
  appId: "1:752191549444:web:f914184a01593a555f0551"
};

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);

// データベースの参照を取得
const database = getDatabase(app);

// ゲーム状態を保存する関数
export const saveGameState = async (gameId, gameState) => {
  try {
    const gameRef = ref(database, `games/${gameId}`);
    await set(gameRef, {
      ...gameState,
      lastUpdated: Date.now()
    });
    console.log('ゲーム状態を保存しました');
  } catch (error) {
    console.error('保存エラー:', error);
  }
};

// ゲーム状態を監視する関数
export const watchGameState = (gameId, callback) => {
  const gameRef = ref(database, `games/${gameId}`);
  onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
  return gameRef; // 後でリスナーを停止するために返す
};

// リスナーを停止する関数
export const stopWatching = (gameRef) => {
  off(gameRef);
};

// ユニークなゲームIDを生成する関数
export const generateGameId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// すべての試合データを取得する新しい関数
export const getAllGames = async () => {
  try {
    // 'games' コレクションへの参照を取得
    const gamesCollectionRef = collection(db, 'games');
    
    // createdAt（作成日時）の降順（新しい順）でデータを並べ替えるクエリを作成
    const q = query(gamesCollectionRef, orderBy("createdAt", "desc"));
    
    // クエリを実行してドキュメントのスナップショットを取得
    const querySnapshot = await getDocs(q);
    
    const games = [];
    querySnapshot.forEach((doc) => {
      // 各ドキュメントのデータを取得し、ドキュメントID（試合ID）も追加
      games.push({ id: doc.id, ...doc.data() });
    });
    
    return games;
  } catch (error) {
    console.error("Firebaseからのデータ取得に失敗しました:", error);
    return []; // エラーの場合は空の配列を返す
  }
};

export { database };