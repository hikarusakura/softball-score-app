// sharedState.js
// 共有状態管理のためのユーティリティ関数

// 共有状態のキー
const SHARED_GAME_KEY = 'softball_shared_game';
const SHARED_LOCK_KEY = 'softball_game_lock';

// ゲーム状態を保存
export const saveSharedGameState = (gameData) => {
  try {
    localStorage.setItem(SHARED_GAME_KEY, JSON.stringify({
      ...gameData,
      lastUpdated: Date.now()
    }));
    return true;
  } catch (error) {
    console.error('共有状態の保存に失敗しました:', error);
    return false;
  }
};

// ゲーム状態を取得
export const getSharedGameState = () => {
  try {
    const data = localStorage.getItem(SHARED_GAME_KEY);
    if (!data) return null;
    
    const parsedData = JSON.parse(data);
    // 10分以上古いデータは無効とする
    if (Date.now() - parsedData.lastUpdated > 10 * 60 * 1000) {
      localStorage.removeItem(SHARED_GAME_KEY);
      localStorage.removeItem(SHARED_LOCK_KEY);
      return null;
    }
    
    return parsedData;
  } catch (error) {
    console.error('共有状態の取得に失敗しました:', error);
    return null;
  }
};

// ゲームロックを取得（スコア入力権限の管理）
export const acquireGameLock = (userId) => {
  try {
    const existingLock = localStorage.getItem(SHARED_LOCK_KEY);
    
    if (existingLock) {
      const lockData = JSON.parse(existingLock);
      // 5分以上古いロックは無効とする
      if (Date.now() - lockData.timestamp > 5 * 60 * 1000) {
        localStorage.removeItem(SHARED_LOCK_KEY);
      } else if (lockData.userId !== userId) {
        return false; // 他のユーザーがロック中
      }
    }
    
    // ロックを取得
    localStorage.setItem(SHARED_LOCK_KEY, JSON.stringify({
      userId: userId,
      timestamp: Date.now()
    }));
    
    return true;
  } catch (error) {
    console.error('ゲームロックの取得に失敗しました:', error);
    return false;
  }
};

// ゲームロックを解除
export const releaseGameLock = (userId) => {
  try {
    const existingLock = localStorage.getItem(SHARED_LOCK_KEY);
    if (existingLock) {
      const lockData = JSON.parse(existingLock);
      if (lockData.userId === userId) {
        localStorage.removeItem(SHARED_LOCK_KEY);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('ゲームロックの解除に失敗しました:', error);
    return false;
  }
};

// 現在のロック状態を確認
export const checkGameLock = (userId) => {
  try {
    const existingLock = localStorage.getItem(SHARED_LOCK_KEY);
    
    if (!existingLock) {
      return { isLocked: false, isOwner: false };
    }
    
    const lockData = JSON.parse(existingLock);
    
    // 5分以上古いロックは無効
    if (Date.now() - lockData.timestamp > 5 * 60 * 1000) {
      localStorage.removeItem(SHARED_LOCK_KEY);
      return { isLocked: false, isOwner: false };
    }
    
    return {
      isLocked: true,
      isOwner: lockData.userId === userId,
      lockOwner: lockData.userId
    };
  } catch (error) {
    console.error('ゲームロック状態の確認に失敗しました:', error);
    return { isLocked: false, isOwner: false };
  }
};

// 共有状態をクリア
export const clearSharedState = () => {
  try {
    localStorage.removeItem(SHARED_GAME_KEY);
    localStorage.removeItem(SHARED_LOCK_KEY);
    return true;
  } catch (error) {
    console.error('共有状態のクリアに失敗しました:', error);
    return false;
  }
};

// ユニークなユーザーIDを生成・取得
export const getUserId = () => {
  const USER_ID_KEY = 'softball_user_id';
  let userId = localStorage.getItem(USER_ID_KEY);
  
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(USER_ID_KEY, userId);
  }
  
  return userId;
};