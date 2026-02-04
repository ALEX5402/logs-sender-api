# Logs Sender API

A high-performance Next.js 14 API for receiving log files and forwarding them to Telegram, featuring a professional real-time analytics dashboard.

<img width="1852" height="1042" alt="image" src="https://github.com/user-attachments/assets/da733fe1-2608-43fb-8ad6-73bd2eeb4c3b" />

## Features

- **Secure Log Upload** - Accepts logs via POST (`multipart/form-data`, JSON, text)
- **Professional Dashboard** - Real-time statistics, charts, and geo-distribution
- **IP Geolocation** - Automatic country and city tracking for all requests
- **Smart Sanitization** - Automatically scrubs URLs and `@mentions` to prevent spam
- **Strict Validation** - Enforces file type (`.log`, `.txt`, `.zip`) and size limits (18MB)
- **Modern UI** - Glassmorphism design with JetBrains Mono font and smooth animations
- **High Performance** - Built on Next.js App Router with MongoDB aggregation

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB=logs_sender
   ```

3. **run the development server**:
   ```bash
   npm run dev
   ```

4. **Access the dashboard**:
   Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## API Usage

### Endpoint

```http
POST /api/{chat_id}/upload
```

### Constraints & Security

- **Max File Size**: 18MB (Requests >18MB return `400 Bad Request`)
- **Allowed Extensions**: `.log`, `.txt`, `.zip`
- **Sanitization**: All URLs and `@username` mentions in text/captions are replaced with `[LINK REMOVED]` and `[MENTION REMOVED]`.

### Examples

#### 1. Upload a File (multipart/form-data)

```bash
curl -X POST \
  -F "file=@app.log" \
  -F "caption=Production Crash" \
  http://localhost:3000/api/123456789/upload
```

#### 2. Send Text Content (JSON)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "Critical error at line 42", "caption": "Backend Service"}' \
  http://localhost:3000/api/123456789/upload
  http://localhost:3000/api/123456789/upload
```

### API Responses

#### ✅ 200 OK
Success response when logs are sent to Telegram.
```json
{
  "success": true,
  "message": "Logs sent successfully to Telegram"
}
```

#### ❌ 400 Bad Request
Invalid input (missing fields, file too large, or wrong file type).
```json
{
  "success": false,
  "message": "Invalid request",
  "error": "File size exceeds 18MB limit"
}
```

#### 🚫 401 Unauthorized
If you try to access protected admin routes without login.
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

#### 🔒 403 Forbidden
Blocked IP address.
```json
{
  "success": false,
  "message": "Access Denied",
  "error": "Your IP address has been blocked."
}
```

#### ⚠️ 429 Too Many Requests
Rate limit exceeded (10 requests/minute).
```json
{
  "success": false,
  "message": "Rate limit exceeded",
  "error": "Too many requests. Please try again later."
}
```

#### 💥 500 Server Error
Telegram API failure or internal server error.
```json
{
  "success": false,
  "message": "Failed to send logs to Telegram",
  "error": "Bad Request: chat not found"
}
```

## Getting Credentials

### Telegram Bot Token
1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow instructions
3. Copy the HTTP API Token

### Chat ID
1. Message your bot
2. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Look for `"chat":{"id":123456789...}`

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: MongoDB
- **Styling**: Tailwind CSS v4, Glassmorphism
- **Icons**: Lucide React
- **Notifications**: Sonner

## License

MIT
