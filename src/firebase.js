// src/firebase.js
import { initializeApp } from "firebase/app";
// Realtime Database用のimportは不要になるのでコメントアウトまたは削除
// import { getDatabase, ref, set, onValue, off } from 'firebase/database';
// Firestoreで必要な命令を追加
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, orderBy, query, getDoc, deleteDoc } from "firebase/firestore";

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

// Firestoreを初期化し、「db」としてexport
export const db = getFirestore(app);

// ゲーム状態を保存する関数
export const saveGameState = async (gameId, gameState) => {
  try {
    const gameRef = doc(db, 'games', gameId);
    await setDoc(gameRef, {
      ...gameState,
      lastUpdated: Date.now()
    });
    // console.log('ゲーム状態をFirestoreに保存しました');
  } catch (error) {
    console.error('Firestoreへの保存エラー:', error);
  }
};

// ゲーム状態を監視する関数
export const watchGameState = (gameId, callback, errorCallback) => {
  const gameRef = doc(db, 'games', gameId);
  console.log(`[firebase.js] 試合ID: ${gameId} の監視を開始します。`); // ログ追加

  const unsubscribe = onSnapshot(gameRef, 
    (doc) => {
      // 成功時のコールバック
      callback(doc);
    }, 
    (error) => {
      // エラー時のコールバック
      console.error("[firebase.js] 監視中にエラーが発生しました:", error);
      if (errorCallback) {
        errorCallback(error);
      }
    }
  );
  return unsubscribe;
};

// リスナーを停止する関数
export const stopWatching = (unsubscribe) => {
  if (unsubscribe) {
    unsubscribe(); // onSnapshotから返された関数を実行して監視を停止
  }
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

// 指定されたIDの試合ドキュメントをFirebaseから削除する関数
export const deleteGameFromFirebase = async (gameId) => {
  try {
    const gameRef = doc(db, 'games', gameId);
    await deleteDoc(gameRef);
    console.log(`ドキュメント ${gameId} が正常に削除されました。`);
    return true; // 成功したことを示すためにtrueを返す
  } catch (error) {
    console.error("ドキュメントの削除中にエラーが発生しました:", error);
    alert("データの削除に失敗しました。");
    return false; // 失敗したことを示すためにfalseを返す
  }
};
