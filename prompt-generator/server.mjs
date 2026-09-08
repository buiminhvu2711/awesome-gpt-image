// Optional local proxy for prompt-generator.html
// Run: CLINE_API_KEY="sk-..." node server.mjs  -> http://localhost:3000/prompt-generator.html
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Nạp biến cấu hình từ file .env ở root repo (nếu có) TRƯỚC khi đọc cấu hình
try {
  process.loadEnvFile(join(__dirname, "..", ".env"));
} catch {
  /* chưa có .env — dùng biến môi trường hệ thống */
}

const PORT = process.env.PORT || 3000;
const CLINE_API_KEY = process.env.CLINE_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY || "";
const MODEL = process.env.CLINE_MODEL || "anthropic/claude-sonnet-4.6";

// Trích các prompt mẫu từ README.md làm few-shot examples cho model
const MAX_EXAMPLES = 40;
const MAX_EXAMPLE_CHARS = 30000;

function getReadmeExamples() {
  try {
    const readme = readFileSync(join(__dirname, "..", "README.md"), "utf8");
    const blocks = [...readme.matchAll(/```text\r?\n([\s\S]*?)```/g)]
      .map((m) => m[1].trim())
      .filter((t) => t.length > 20 && t.length < 2000);
    // Chọn đều giữa đầu/giữa/cuối README để đa dạng thể loại
    const step = Math.max(1, Math.floor(blocks.length / MAX_EXAMPLES));
    const picked = blocks.filter((_, i) => i % step === 0).slice(0, MAX_EXAMPLES);
    let out = "";
    for (const ex of picked) {
      if (out.length + ex.length > MAX_EXAMPLE_CHARS) break;
      out += `- ${ex.replace(/\s+/g, " ")}\n`;
    }
    return `EXAMPLE PROMPTS FROM THE LIBRARY:\n${out}`;
  } catch {
    return "(Không đọc được thư viện prompt mẫu — hãy dựa vào kiến thức riêng về GPT Image 2.)";
  }
}

const SYSTEM_PROMPT = `You are an expert prompt engineer for OpenAI's GPT Image 2 image generation model.

The user will describe what image they want (in Vietnamese or any language). Your job is to return ONE final, ready-to-use image prompt in ENGLISH.

Rules for the prompt you produce:
- Write as a descriptive instruction paragraph, not a list of keywords.
- Be specific: subject, action, composition, camera/lens, lighting, color palette, mood, environment details, textures.
- If text appears in the image, put the exact text in double quotes.
- Match the aesthetic style the user asks for (photorealistic RAW photo, cinematic, illustration, poster design, etc.). For photorealism, mention realistic imperfections and natural lighting.
- Keep it between 60 and 200 words. Do not add headings, explanations, or anything besides the prompt itself.

Below is a curated collection of real, high-quality GPT Image 2 prompts from a community library. Study their style, level of detail, and techniques — imitate their quality and adapt their techniques (RAW camera quality cues, exact quoted text, style keywords, layout specifications, etc.) to the user's request.

${getReadmeExamples()}

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

  if (req.method === "POST" && req.url === "/api/image") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let prompt = "";
    try { prompt = JSON.parse(body).prompt?.slice(0, 4000) || ""; } catch {}

    if (!prompt.trim()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Thiếu prompt." }));
    }
    if (!OPENAI_API_KEY) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Chưa đặt OPENAI_API_KEY trong .env." }));
    }

    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          prompt,
          size: process.env.OPENAI_IMAGE_SIZE || "1024x1024",
          n: 1,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        res.writeHead(response.status, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: data.error?.message || `OpenAI API lỗi ${response.status}`,
          status: response.status,
        }));
      }
      const b64 = data.data?.[0]?.b64_json || data.data?.[0]?.url || "";
      if (!b64) {
        res.writeHead(502, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "OpenAI không trả về ảnh." }));
      }

      // Lưu ảnh xuống assets/generated/ trong repo
      const genDir = join(__dirname, "..", "assets", "generated");
      mkdirSync(genDir, { recursive: true });
      const filename = `gpt-image-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      const isUrl = b64.startsWith("http");
      if (!isUrl) writeFileSync(join(genDir, filename), Buffer.from(b64, "base64"));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        image: isUrl ? b64 : `data:image/png;base64,${b64}`,
        saved: isUrl ? null : `/assets/generated/${filename}`,
      }));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Không kết nối được OpenAI API: " + err.message }));
    }
    return;
  }

  // Phục vụ ảnh đã gen từ assets/generated/
  if (req.method === "GET" && req.url.startsWith("/assets/generated/")) {
    const file = join(__dirname, "..", decodeURIComponent(req.url.split("?")[0]));
    if (existsSync(file) && file.startsWith(join(__dirname, "..", "assets", "generated"))) {
      const ext = extname(file).toLowerCase();
      const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" }[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      return res.end(readFileSync(file));
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`✅ Proxy chạy tại http://localhost:${PORT}/prompt-generator.html`);
  if (!CLINE_API_KEY) console.warn("⚠️  Hãy đặt biến môi trường CLINE_API_KEY!");
});

