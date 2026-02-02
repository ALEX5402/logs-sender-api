/**
 * Telegram Bot Integration for sending logs
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export interface TelegramResponse {
    ok: boolean;
    result?: unknown;
    description?: string;
    error_code?: number;
}

/**
 * Send a text message to a Telegram chat
 */
export async function sendMessage(
    chatId: string,
    text: string,
    parseMode: "HTML" | "Markdown" | "MarkdownV2" = "HTML"
): Promise<TelegramResponse> {
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: parseMode,
        }),
    });

    return response.json();
}

/**
 * Send a document (file) to a Telegram chat
 */
export async function sendDocument(
    chatId: string,
    file: File | Blob,
    filename: string,
    caption?: string
): Promise<TelegramResponse> {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", file, filename);

    if (caption) {
        formData.append("caption", caption);
    }

    const response = await fetch(`${TELEGRAM_API_BASE}/sendDocument`, {
        method: "POST",
        body: formData,
    });

    return response.json();
}

/**
 * Send logs as a document or message based on content size
 * If content is small, sends as message. If large, sends as file.
 */
export async function sendLogs(
    chatId: string,
    content: string | File | Blob,
    filename: string = "logs.txt",
    caption?: string
): Promise<TelegramResponse> {
    // If content is a string and small enough, send as message
    if (typeof content === "string") {
        const MAX_MESSAGE_LENGTH = 4000; // Telegram limit is 4096

        if (content.length <= MAX_MESSAGE_LENGTH) {
            const formattedMessage = caption
                ? `<b>${caption}</b>\n\n<pre>${escapeHtml(content)}</pre>`
                : `<pre>${escapeHtml(content)}</pre>`;
            return sendMessage(chatId, formattedMessage, "HTML");
        }

        // Content is too large, convert to file
        const blob = new Blob([content], { type: "text/plain" });
        return sendDocument(chatId, blob, filename, caption);
    }

    // Content is already a File/Blob
    return sendDocument(chatId, content, filename, caption);
}

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Verify the bot token is configured
 */
export function isTelegramConfigured(): boolean {
    return !!TELEGRAM_BOT_TOKEN;
}
