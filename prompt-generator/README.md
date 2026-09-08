# GPT Image 2 Prompt Generator 🎨

Trang web sinh prompt GPT Image 2: nhập ý tưởng (tiếng Việt) → nhận prompt tiếng Anh hoàn chỉnh, sinh bằng Cline API.

> 🔒 Chạy local — `.env` không được commit (đã bị `.gitignore`). Tool gen hình ảnh qua OpenAI Image API.

## Chạy

```bash
node prompt-generator/server.mjs
# mở http://localhost:3000 (port theo .env)
```

## Cấu hình qua `.env` (ở root repo)

| Biến | Mặc định | Mô tả |
|---|---|---|
| `CLINE_API_KEY` | — | API key của Cline (**bắt buộc** khi dùng proxy) |
| `CLINE_MODEL` | `cline-pass/kimi-k3` | Model sinh prompt (ClinePass dùng tiền tố `cline-pass/...`) |
| `OPENAI_API_KEY` | — | API key OpenAI (cho nút 🖼️ Gen hình; chấp nhận cả tên `OPEN_AI_API_KEY`) |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2` | Model gen ảnh của OpenAI |
| `OPENAI_IMAGE_SIZE` | `1024x1024` | Kích thước ảnh (`1024x1024`, `1024x1536`, `1536x1024`) |
| `PORT` | `3000` | Port của proxy local |

- Model id ClinePass: xem danh sách tại `GET https://api.cline.bot/api/v1/models`. Sai sẽ nhận `404 model not found`.
- ClinePass đo usage theo 3 cửa sổ: 5 giờ / tuần / tháng (xem tại app.cline.bot dashboard).
- Nút 🖼️ Gen hình gọi OpenAI Image API (`POST /v1/images/generations`, model `gpt-image-2`, trả về b64_json) — cần tài khoản OpenAI có credit, thời gian gen 30-90s.

- Server tự nạp `.env` bằng `process.loadEnvFile()` (Node ≥ 20.6), không cần cài dotenv. Biến môi trường hệ thống vẫn được ưu tiên nếu đã đặt.


