// api/generate-report.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { gameData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY_NEW;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  try {
    // ---------------------------------------------------------
    // ステップ1: あなたのキーで使える「モデル一覧」を取得する
    // ---------------------------------------------------------
    console.log("🔍 Available models searching...");
    const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    const modelsResponse = await fetch(modelsUrl);
    if (!modelsResponse.ok) {
      throw new Error(`Failed to list models: ${modelsResponse.status}`);
    }
    
    const modelsData = await modelsResponse.json();
    const availableModels = modelsData.models || [];

    // 「generateContent（記事作成）」に対応しているモデルだけを抽出
    // かつ、制限の厳しい "gemini-2.0" は（もし他があるなら）避ける優先順位にする
    const viableModels = availableModels
      // 1. まずは「記事作成(generateContent)」に対応しているかチェック
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
      // 2. さらに、今回の用途に合わない特殊なモデルを除外
      .filter(m => {
        const name = m.name;
        return !name.includes("image") &&    // 画像生成用は除外
               !name.includes("vision") &&   // 視覚認識用は除外
               !name.includes("robotics") && // ロボット用は除外
               !name.includes("nano") &&     // スマホ用(超軽量)は除外
               !name.includes("tts");        // 音声読み上げ用は除外
      })
      .map(m => m.name.replace("models/", ""))
      
      // 3. 「賢い順」に並び替え
      .sort((a, b) => {
        // ヘルパー関数: モデルの強さを数値化する（大きい方が優先）
        const getScore = (name) => {
          let score = 0;
          
          // 世代による加点 (新しい方が偉い)
          if (name.includes("gemini-3")) score += 4000;
          else if (name.includes("gemini-2.5")) score += 3000;
          else if (name.includes("gemini-2.0")) score += 2000;
          else if (name.includes("gemini-1.5")) score += 1000;
          
          // ランクによる加点 (Pro > Flash > Lite > Gemma)
          if (name.includes("pro")) score += 500;
          else if (name.includes("flash") && !name.includes("lite")) score += 300; // 普通のFlash
          else if (name.includes("lite")) score += 100; // Lite
          else if (name.includes("gemma")) score -= 100; // Gemmaは今回不向き

          // "exp" や "preview" は不安定なことがあるので少し下げる（安定版優先）
          // ただしGemini 3などはPreviewしかないので、スコア差でカバーされます
          if (name.includes("preview") || name.includes("exp")) score -= 10;

          return score;
        };

        // スコア比較（降順＝点数が高い方が先に来る）
        return getScore(b) - getScore(a);
      });

    console.log("📋 Found models:", viableModels);

    if (viableModels.length === 0) {
      throw new Error("No available models found for this API key.");
    }

    // ---------------------------------------------------------
    // ステップ2: 見つかったモデルを使って記事を書く
    // ---------------------------------------------------------
    // AIが間違えないように、明確な役割定義を作成
    const topTeamInfo = `先攻（${gameData.topTeam}）`;
    const bottomTeamInfo = `後攻（${gameData.bottomTeam}）`;
    const myTeamName = gameData.myTeam || '自チーム';

    const prompt = `
      あなたは少年ソフトボールチーム「${myTeamName}」の【熱血専属スポーツ記者】です。
      以下の試合データをもとに、保護者が読んで感動するような、ドラマチックな「試合戦評記事」を書いてください。

      【⚠️ 最重要：チーム情報の定義】
      以下の定義を厳守し、絶対にチームを取り違えないでください。
      - 先攻チーム: ${gameData.topTeam}（スコアボードの上の段）
      - 後攻チーム: ${gameData.bottomTeam}（スコアボードの下の段）
      - 試合結果: ${gameData.topTeam} ${gameData.topScore} 対 ${gameData.bottomScore} ${gameData.bottomTeam}
      - 勝者: ${gameData.winner}

      【チーム情報の定義2】
      - 我がチーム: ${myTeamName}
      - 対戦相手: ${gameData.opponentTeam}

      【重要：視点の固定】
      - あなたは「${myTeamName}」の味方です。中立である必要はありません。
      - 常に「${myTeamName}」を主語（主人公）にして記事を構成してください。

      【勝敗による書き分けルール】
      - **${myTeamName}が勝った場合**:
        手放しで称賛してください。「快勝」「劇的勝利」「圧倒」など、ポジティブな言葉を多用してください。
      - **${myTeamName}が負けた場合**:
        「悔しい敗戦」「あと一歩」「健闘」というトーンで書いてください。
        相手の勝利を祝うのではなく、自チームの頑張りや、次につながる良いプレーに焦点を当ててください。
        最後は必ず「次戦に期待したい」「前を向こう」といった励ましの言葉で締めてください。

      【タイムラインの読み方ルール】
      - データは「試合開始（1回）から試合終了」に向かって、時系列順（古い順）に並んでいます。
      - 一番上が最初のプレー、一番下が最後のプレーです。
      - 「表」は先攻（${gameData.topTeam}）の攻撃、「裏」は後攻（${gameData.bottomTeam}）の攻撃です。
      - 試合の流れを、この時系列通りに追って記事にしてください。

      【制約事項】
      - 新聞記事のような文体で書いてください（「〜だ」「〜した」調）。
      - 以下のJSON形式のテキストのみを出力してください（マークダウン不要）。
      {
        "headline": "記事の見出し（20文字以内。勝っても負けても${myTeamName}の名前を入れること）",
        "content": "記事の本文（400文字程度。試合の流れ、勝敗の分かれ目、活躍した選手などを具体的に。絵文字は少しだけ使用可）"
      }

      【試合データ詳細】
      - 大会名: ${gameData.tournamentName || '練習試合'}
      - 日付: ${gameData.date}
      - 試合経過タイムライン:
        ${gameData.timeline.map(t => `・${t.inning}回${t.inningHalf || ''}：${t.message}`).join('\n')}
      - 活躍選手（ヒットを打った選手）:
        ${gameData.hitLeaders.map(p => `${p.name} (${p.count}安打)`).join(', ')}
    `;

    // 上から順に試す（もし1つ目がダメなら2つ目へ）
    let lastError = null;
    
    for (const modelName of viableModels) {
      try {
        console.log(`🚀 Trying model: ${modelName}...`);
        
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(`${response.status} ${errData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        // 成功！データを整形して返す
        const text = data.candidates[0].content.parts[0].text;
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const article = JSON.parse(jsonStr);

        console.log(`✅ Success with ${modelName}`);
        return res.status(200).json(article);

      } catch (e) {
        console.error(`❌ Failed with ${modelName}:`, e.message);
        lastError = e;
        // 次のモデルへ...
      }
    }

    // 全滅した場合
    throw lastError || new Error("All models failed.");

  } catch (error) {
    console.error('Final Error:', error);
    res.status(500).json({ error: 'Generation failed', details: error.message });
  }
}