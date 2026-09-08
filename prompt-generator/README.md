# GPT Image 2 Prompt Generator 🎨

Trang web sinh prompt GPT Image 2: nhập ý tưởng (tiếng Việt) → nhận prompt tiếng Anh hoàn chỉnh, sinh bằng Cline API.

- **Không cần server:** mở trực tiếp `prompt-generator.html` (hoặc deploy lên GitHub Pages), dán Cline API Key của bạn vào ô trên trang — key chỉ lưu trong `localStorage` và chỉ gửi tới `api.cline.bot`.
- **Proxy local (tuỳ chọn):** nếu browser bị CORS chặn, cấu hình file `.env` ở root repo rồi chạy:

```bash
# 1. Tạo .env từ mẫu (nếu chưa có) và điền CLINE_API_KEY
cp prompt-generator/.env.example .env

# 2. Chạy proxy
node prompt-generator/server.mjs
# mở http://localhost:3000
```

## Cấu hình qua `.env` (ở root repo)

| Biến | Mặc định | Mô tả |
|---|---|---|
| `CLINE_API_KEY` | — | API key của Cline (**bắt buộc** khi dùng proxy) |
| `CLINE_MODEL` | `anthropic/claude-sonnet-4.6` | Model sinh prompt (danh sách: `GET https://api.cline.bot/api/v1/models`) |
| `PORT` | `3000` | Port của proxy local |

- ⚠️ Model id dùng dấu **chấm**: `anthropic/claude-sonnet-4.6` (không phải `-4-6` như một số tài liệu cũ). Nếu sai sẽ nhận lỗi `404 model not found`.
- Tài khoản Cline cần có **credit dương** — nếu âm sẽ nhận lỗi `402 Insufficient balance` (nạp tại [app.cline.bot](https://app.cline.bot)).

- File `.env` đã được đưa vào `.gitignore` nên key không bị commit.
- Server tự nạp `.env` bằng `process.loadEnvFile()` (Node ≥ 20.6), không cần cài dotenv. Biến môi trường hệ thống vẫn được ưu tiên nếu đã đặt.


