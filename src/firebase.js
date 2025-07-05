// src/firebase.js
import { initializeApp } from "firebase/app";
// Realtime Database用のimportは不要になるのでコメントアウトまたは削除
// import { getDatabase, ref, set, onValue, off } from 'firebase/database';
// Firestoreで必要な命令を追加
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, orderBy, query, getDoc } from "firebase/firestore";

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


// 特定の試合データを1回だけ読み込むテスト関数
export const testReadGame = async (gameId) => {
  try {
    console.log(`[testReadGame] 読み込みテスト開始: games/${gameId}`);
    const gameRef = doc(db, 'games', gameId);
    const docSnap = await getDoc(gameRef);

    if (docSnap.exists()) {
      console.log("[testReadGame] 成功！ドキュメントが見つかりました:", docSnap.data());
      alert("Firebaseとの接続に成功しました！");
    } else {
      console.log("[testReadGame] 失敗！ドキュメントが見つかりませんでした。");
      alert("接続はできましたが、指定されたIDの試合は見つかりませんでした。");
    }
  } catch (error) {
    console.error("[testReadGame] 重大なエラーが発生しました:", error);
    alert("Firebaseとの接続中に重大なエラーが発生しました。コンソールを確認してください。");
  }
};

// onSnapshotが機能するかどうかだけをテストする最終診断用の関数
export const finalOnSnapshotTest = (gameId) => {
  console.log(`【最終診断】onSnapshotの単体テストを開始します。ID: ${gameId}`);
  try {
    const gameRef = doc(db, 'games', gameId);
    
    onSnapshot(gameRef, 
      (doc) => {
        // ★★★ 成功：このメッセージが表示されれば、Firebaseとのリアルタイム接続は機能しています ★★★
        console.log("★★★★★【最終診断】成功：onSnapshot のコールバックが実行されました！★★★★★");
        if (doc.exists()) {
          console.log("★★★★★【最終診断】ドキュメントが見つかりました。★★★★★");
        } else {
          console.log("★★★★★【最終診断】ドキュメントが存在しません。★★★★★");
        }
      }, 
      (error) => {
        // ★★★ 失敗：このメッセージが表示されれば、権限などのエラーです ★★★
        console.error("★★★★★【最終診断】失敗：onSnapshot でエラーが発生しました:", error);
      }
    );
  } catch (e) {
    console.error("★★★★★【最終診断】失敗：onSnapshot の呼び出し自体でエラー:", e);
  }
};