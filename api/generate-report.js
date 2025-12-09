// api/generate-report.js

export default async function handler(req, res) {
  // POSTメソッド以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { gameData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  try {
    // ★ ライブラリを使わず、直接URLを叩く (REST API)
    // ここで gemini-1.5-flash を直接指名します
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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

    // Googleへのリクエスト送信
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Google API Error');
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // JSONの整形（```json などを除去）
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const article = JSON.parse(jsonStr);

    res.status(200).json(article);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
}