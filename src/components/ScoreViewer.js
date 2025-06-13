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
      <h3>チームA</h3>
      <p>得点: {score.runs}</p>
      <p>ヒット: {score.hits}</p>
    </div>
  );
}
