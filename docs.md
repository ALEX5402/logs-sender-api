### Constraints & Security

- **Max File Size**: 18MB (Requests >18MB return `400 Bad Request`)
- **Allowed Extensions**: `.log`, `.txt`, `.zip`
- {chat_id} should be that chat or group id where you added the [bot](https://t.me/logs_sender93874_bot)
- **Sanitization**: All URLs and `@username` mentions in text/captions are replaced with `[LINK REMOVED]` and `[MENTION REMOVED]`.

### Examples

#### 1. Upload a File (multipart/form-data)

```bash
curl -X POST \
  -F "file=@app.log" \
  -F "caption=Production Crash" \
  https://logs-sender-api.vercel.app/api/{chat_id}/upload
```

#### 2. Send Text Content (JSON)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "Critical error at line 42", "caption": "Backend Service"}' \
  https://logs-sender-api.vercel.app/api/{chat_id}/upload
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
