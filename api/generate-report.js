// api/generate-report.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  // POSTメソッド以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { gameData } = req.body;

  // APIキーの確認
  if (!process.env.GEMINI_API_KEY_NEW) {
    console.error("API Key is missing in environment variables");
    return res.status(500).json({ error: 'Server Configuration Error: API Key missing' });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_NEW);
    
    // ★ 最も標準的で安定しているモデル名を使用
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });

    // プロンプト（指示書）の作成
    const prompt = `
      あなたは少年ソフトボールの熱血スポーツ記者です。
      以下の試合データをもとに、ドラマチックな「試合戦評記事」を書いてください。

      【制約事項】
      - 文体：新聞記事風（「〜だ」「〜した」調）
      - 出力形式：以下のJSON形式のみ（余計なマークダウンや挨拶は不要）
      {
        "headline": "記事の見出し（20文字以内）",
        "content": "記事の本文（400文字程度）"
      }

      【試合データ】
      - 大会名: ${gameData.tournamentName || '練習試合'}
      - 日付: ${gameData.date}
      - 先攻: ${gameData.topTeam} / 後攻: ${gameData.bottomTeam}
      - スコア: ${gameData.topTeam} ${gameData.topScore} - ${gameData.bottomScore} ${gameData.bottomTeam}
      - 勝者: ${gameData.winner}
      - 試合経過:
        ${gameData.timeline.map(t => `・${t.inning}回${t.inningHalf || ''} ${t.message}`).join('\n')}
      - 活躍選手:
        ${gameData.hitLeaders.map(p => `${p.name} (${p.count}安打)`).join(', ')}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSONの整形（AIが ```json 等をつける場合があるため除去）
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const article = JSON.parse(jsonStr);
        res.status(200).json(article);
    } catch (e) {
        console.error("JSON Parse Error:", text); // パース失敗時は生のテキストをログに出す
        res.status(500).json({ error: 'Failed to parse AI response' });
    }

  } catch (error) {
    console.error('Gemini API Error:', error);
    // エラー内容を詳細に返す（デバッグ用）
    res.status(500).json({ 
        error: 'Failed to generate report', 
        details: error.message 
    });
  }
}