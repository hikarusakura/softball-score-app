// api/generate-report.js

export default async function handler(req, res) {
  // POSTメソッド以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { gameData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY_NEW;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  // ★ 試行するモデルのリスト（優先順）
  // 1.5系を中心に、最後は2.0やProも試す総力戦です
  const CANDIDATE_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
    "gemini-pro", // 1.0 Pro
    "gemini-2.0-flash" // 最新（混雑しやすいので最後）
  ];

  const prompt = `
    あなたは少年ソフトボールの熱血スポーツ記者です。
    以下の試合データをもとに、保護者が読んで感動するような、ドラマチックな「試合戦評記事」を書いてください。

    【制約事項】
    - 新聞記事のような文体で書いてください（「〜だ」「〜した」調）。
    - 以下のJSON形式のテキストのみを出力してください（マークダウンの記号は不要）。
    {
      "headline": "記事の見出し（20文字以内、キャッチーに）",
      "content": "記事の本文（400文字程度。試合の流れ、勝敗の分かれ目、活躍した選手などを具体的に。絵文字は少しだけ使用可）"
    }

    【試合データ】
    - 大会名: ${gameData.tournamentName || '練習試合'}
    - 日付: ${gameData.date}
    - 先攻（表）: ${gameData.topTeam} / 後攻（裏）: ${gameData.bottomTeam}
    - スコア: ${gameData.topTeam} ${gameData.topScore} - ${gameData.bottomScore} ${gameData.bottomTeam}
    - 勝者: ${gameData.winner}
    - 試合経過:
      ${gameData.timeline.map(t => `・${t.inning}回${t.inningHalf || ''} ${t.message}`).join('\n')}
    - 活躍選手:
      ${gameData.hitLeaders.map(p => `${p.name} (${p.count}安打)`).join(', ')}
  `;

  let lastError = null;

  // ★ ループ処理：使えるモデルが見つかるまで次々と試す
  for (const modelName of CANDIDATE_MODELS) {
    try {
      console.log(`Testing model: ${modelName}...`);
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        // 404(見つからない)や429(混雑)なら、エラーを投げて次のモデルへ
        throw new Error(`[${modelName}] ${response.status} ${errorData.error?.message}`);
      }

      // 成功したらデータを整形して終了
      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error(`[${modelName}] No candidates returned`);
      }

      const text = data.candidates[0].content.parts[0].text;
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const article = JSON.parse(jsonStr);

      console.log(`Successfully generated using: ${modelName}`);
      return res.status(200).json(article); // ★ 成功！ここで処理終了

    } catch (error) {
      console.error(`Failed with ${modelName}:`, error.message);
      lastError = error;
      // 次のモデルへループ継続...
    }
  }

  // ★ 全部のモデルがダメだった場合
  console.error('All models failed.');
  res.status(500).json({ 
    error: 'Failed to generate report with all available models.', 
    details: lastError?.message 
  });
}