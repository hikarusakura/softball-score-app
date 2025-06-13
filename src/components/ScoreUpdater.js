// src/components/ScoreUpdater.js
import React from "react";
import { db } from "../firebase";
import { ref, set } from "firebase/database";

export default function ScoreUpdater() {
  const updateScore = () => {
    set(ref(db, "scores/teamA"), {
      runs: 3,
      hits: 5
    });
  };

  return <button onClick={updateScore}>スコアを更新</button>;
}
