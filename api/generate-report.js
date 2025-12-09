// api/generate-report.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 指定時間（ミリ秒）待機する関数
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    
    // ★ 唯一反応があった "gemini-2.0-flash" を使用
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

    // --- ★ リトライロジック（ここから） ---
    let result;
    let retryCount = 0;
    const maxRetries = 3; // 最大3回までやり直す

    while (retryCount < maxRetries) {
      try {
        result = await model.generateContent(prompt);
        break; // 成功したらループを抜ける
      } catch (error) {
        // 429 (Too Many Requests) または 503 (Service Unavailable) の場合のみリトライ
        if (error.message.includes("429") || error.message.includes("503")) {
          retryCount++;
          console.log(`混雑中... リトライします (${retryCount}/${maxRetries})`);
          await sleep(2000 * retryCount); // 2秒, 4秒... と待機時間を増やす
        } else {
          throw error; // それ以外のエラーは即座に停止
        }
      }
    }

    if (!result) {
      throw new Error("混雑のため記事を作成できませんでした。もう一度お試しください。");
    }
    // --- ★ リトライロジック（ここまで） ---

    const response = await result.response;
    const text = response.text();

    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const article = JSON.parse(jsonStr);

    res.status(200).json(article);

  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
}