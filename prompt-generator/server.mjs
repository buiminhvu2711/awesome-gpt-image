// Optional local proxy for prompt-generator.html
// Run: CLINE_API_KEY="sk-..." node server.mjs  -> http://localhost:3000/prompt-generator.html
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Nạp biến cấu hình từ file .env ở root repo (nếu có) TRƯỚC khi đọc cấu hình
try {
  process.loadEnvFile(join(__dirname, "..", ".env"));
} catch {
  /* chưa có .env — dùng biến môi trường hệ thống */
}

const PORT = process.env.PORT || 3000;
const CLINE_API_KEY = process.env.CLINE_API_KEY || "";
const MODEL = process.env.CLINE_MODEL || "anthropic/claude-sonnet-4.6";

const SYSTEM_PROMPT = `You are an expert prompt engineer for OpenAI's GPT Image 2 image generation model.

The user will describe what image they want (in Vietnamese or any language). Your job is to return ONE final, ready-to-use image prompt in ENGLISH.

Rules for the prompt you produce:
- Write as a descriptive instruction paragraph, not a list of keywords.
- Be specific: subject, action, composition, camera/lens, lighting, color palette, mood, environment details, textures.
- If text appears in the image, put the exact text in double quotes.
- Match the aesthetic style the user asks for (photorealistic RAW photo, cinematic, illustration, poster design, etc.). For photorealism, mention realistic imperfections and natural lighting.
- Keep it between 60 and 200 words. Do not add headings, explanations, or anything besides the prompt itself.

Output format: return ONLY the final prompt text. No preamble, no quotes around the whole thing, no markdown.`;

const server = createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/prompt-generator.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(readFileSync(join(__dirname, "..", "prompt-generator.html")));
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let userText = "";
    try { userText = JSON.parse(body).message?.slice(0, 4000) || ""; } catch {}

    if (!userText.trim()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Thiếu nội dung yêu cầu." }));
    }
    if (!CLINE_API_KEY) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Server chưa đặt biến môi trường CLINE_API_KEY." }));
    }

    try {
      const response = await fetch("https://api.cline.bot/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLINE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          stream: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Yêu cầu ảnh của tôi: ${userText}` },
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        res.writeHead(response.status, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: data.error?.message || data.message || data.error || `Cline API lỗi ${response.status}`,
          status: response.status,
        }));
      }
      // Response shape có thể là {choices:[...]} hoặc {data:{choices:[...]}} tuỳ model
      const choice = data.choices?.[0] || data.data?.choices?.[0];
      const prompt = (choice?.message?.content || "").trim();
      if (!prompt) {
        res.writeHead(502, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Response rỗng hoặc sai định dạng từ Cline API" }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ prompt }));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Không kết nối được Cline API: " + err.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`✅ Proxy chạy tại http://localhost:${PORT}/prompt-generator.html`);
  if (!CLINE_API_KEY) console.warn("⚠️  Hãy đặt biến môi trường CLINE_API_KEY!");
});

