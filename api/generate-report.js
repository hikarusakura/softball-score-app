// api/generate-report.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  // POSTメソッド以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { gameData } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // ★ モデル名は最新のものを使用
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });

    // AIへの指示書（プロンプト）を作成
    const prompt = `
      あなたは少年ソフトボールの熱血スポーツ記者です。
      以下の試合データをもとに、保護者が読んで感動するような、ドラマチックな「試合戦評記事」を書いてください。

      【制約事項】
      - 新聞記事のような文体で書いてください（「〜だ」「〜した」調）。
      - 以下のJSON形式で出力してください（マークダウン等は不要）。
      {
        "headline": "記事の見出し（20文字以内、キャッチーに）",
        "content": "記事の本文（400文字程度。試合の流れ、勝敗の分かれ目、活躍した選手などを具体的に。絵文字は少しだけ使用可）"
      }

      【試合データ】
      - 大会名: ${gameData.tournamentName || '練習試合'}
      - 日付: ${gameData.date}
      - 先攻（表の攻撃）: ${gameData.topTeam}
      - 後攻（裏の攻撃）: ${gameData.bottomTeam}
      - スコア結果:
        ${gameData.topTeam}: ${gameData.topScore}点
        ${gameData.bottomTeam}: ${gameData.bottomScore}点
      - 勝者: ${gameData.winner}
      - タイムライン（試合経過）:
        ※「表」の攻撃は先攻チーム、「裏」の攻撃は後攻チームです。
        ${gameData.timeline.map(t => `・${t.inning}回${t.inningHalf || ''} ${t.message}`).join('\n')}
      - 活躍選手（安打数）:
        ${gameData.hitLeaders.map(p => `${p.name} (${p.count}安打)`).join(', ')}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON部分だけを抽出して返す
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const article = JSON.parse(jsonStr);

    res.status(200).json(article);

  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
}