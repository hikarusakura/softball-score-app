// src/components/ScoreViewer.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";

export default function ScoreViewer() {
  const [score, setScore] = useState({ runs: 0, hits: 0 });

  useEffect(() => {
    const scoreRef = ref(db, "scores/teamA");
    const unsubscribe = onValue(scoreRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setScore(data);
      }
    });

    return () => unsubscribe(); // クリーンアップ
  }, []);

  return (
    <div>
              <button
                onClick={watchGame}
                className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs transition-colors"
              >
                観戦画面
              </button>
    </div>
  );
}
