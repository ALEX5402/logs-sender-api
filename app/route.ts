import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Logs Sender API",
    version: "1.0.0",
    description: "Send logs to Telegram via HTTP API",
    endpoints: {
      upload: {
        path: "/api/{chat_id}/upload",
        method: "POST",
        description: "Upload logs to be sent to a specific Telegram chat",
        parameters: {
          chat_id: "The Telegram chat ID where logs will be sent"
        }
      }
    },
    documentation: "GET /api/{chat_id}/upload for detailed usage"
  });
}
