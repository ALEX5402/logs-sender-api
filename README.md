# Logs Sender API

A Next.js 14 API for receiving log files and forwarding them to Telegram, with a beautiful analytics dashboard.

## Features

- **Log Upload API** - Accept logs via POST and forward to Telegram
- **Analytics Dashboard** - View all requests with stats and visualizations
- **IP Geolocation** - Track request origins by country and city
- **Real-time Stats** - Request counts, success rates, hourly trends
- **Modern Dark UI** - Beautiful dashboard with glassmorphism design

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
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB=logs_sender
   ```

3. **Start MongoDB** (if using local):
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 mongo
   
   # Or use MongoDB Atlas cloud
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Access the dashboard**:
   Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Telegram bot token:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

## Getting a Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the instructions
3. Copy the token provided by BotFather

## Getting Your Chat ID

1. Add your bot to the group/channel or send a message to your bot
2. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find the `chat.id` in the response

## API Usage

### Endpoint

```
POST /api/{chat_id}/upload
```

### Content Types Supported

- `multipart/form-data` - For file uploads
- `application/json` - For JSON payloads
- `text/plain` - For raw text

---

### Examples

#### 1. Upload a File (multipart/form-data)

```bash
curl -X POST \
  -F "file=@logs.txt" \
  -F "caption=App crash logs" \
  https://your-domain.com/api/123456789/upload
```

#### 2. Send Text Content (JSON)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "Error: Something went wrong\nStack trace here...", "caption": "Error Log"}' \
  https://your-domain.com/api/123456789/upload
```

#### 3. Send Plain Text

```bash
curl -X POST \
  -H "Content-Type: text/plain" \
  -d 'Your log content here' \
  https://your-domain.com/api/123456789/upload
```

---

### Client Code Examples

#### JavaScript/TypeScript (Form Data)

```typescript
async function sendLogs(chatId: string, logContent: string) {
  const formData = new FormData();
  const blob = new Blob([logContent], { type: 'text/plain' });
  formData.append('file', blob, 'logs.txt');
  formData.append('caption', 'Application Logs');

  const response = await fetch(`https://your-domain.com/api/${chatId}/upload`, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}
```

#### Kotlin/Android

```kotlin
suspend fun sendLogs(chatId: String, logFile: File) {
    val client = OkHttpClient()
    
    val requestBody = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart(
            "file",
            logFile.name,
            logFile.asRequestBody("text/plain".toMediaType())
        )
        .addFormDataPart("caption", "Android Crash Log")
        .build()

    val request = Request.Builder()
        .url("https://your-domain.com/api/$chatId/upload")
        .post(requestBody)
        .build()

    client.newCall(request).execute()
}
```

#### Swift/iOS

```swift
func sendLogs(chatId: String, logContent: String) async throws {
    let url = URL(string: "https://your-domain.com/api/\(chatId)/upload")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body: [String: Any] = [
        "text": logContent,
        "caption": "iOS Crash Log"
    ]
    
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    print(String(data: data, encoding: .utf8)!)
}
```

---

### Response Format

#### Success (200)
```json
{
  "success": true,
  "message": "Logs sent successfully to Telegram"
}
```

#### Error (4xx/5xx)
```json
{
  "success": false,
  "message": "Failed to send logs to Telegram",
  "error": "Detailed error message"
}
```

## Deployment

Deploy to Vercel:

```bash
npm i -g vercel
vercel
```

Set the `TELEGRAM_BOT_TOKEN` environment variable in your Vercel project settings.

## License

MIT
