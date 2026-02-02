import { NextRequest, NextResponse } from "next/server";
import { sendLogs, isTelegramConfigured } from "@/app/lib/telegram";
import { saveLog, LogEntry, isIpBlocked } from "@/app/lib/database";
import { getClientIP, getGeoLocation } from "@/app/lib/geolocation";
import { sanitizeContent } from "@/app/lib/sanitizer";
import { rateLimiter } from "@/app/lib/ratelimit";

interface UploadResponse {
    success: boolean;
    message: string;
    error?: string;
}

/**
 * POST /api/[chat_id]/upload
 * 
 * Accepts multipart/form-data with:
 * - file: A .txt log file (optional)
 * - text: Log text content as string (optional)
 * - caption: Optional caption for the log (optional)
 * 
 * Either 'file' or 'text' must be provided.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ chat_id: string }> }
): Promise<NextResponse<UploadResponse>> {
    const startTime = Date.now();
    const ip = getClientIP(request.headers);

    // Rate Limit Check
    const limitStatus = rateLimiter.check(ip);
    if (!limitStatus.allowed) {
        return NextResponse.json(
            {
                success: false,
                message: "Rate limit exceeded",
                error: "Too many requests. Please try again later.",
            },
            { status: 429 }
        );
    }

    // IP Block Check
    if (await isIpBlocked(ip)) {
        return NextResponse.json(
            {
                success: false,
                message: "Access Denied",
                error: "Your IP address has been blocked.",
            },
            { status: 403 }
        );
    }

    const userAgent = request.headers.get("user-agent") || undefined;

    // Get geolocation in background
    const geoPromise = getGeoLocation(ip);

    let logEntry: Partial<LogEntry> = {
        ip,
        userAgent,
        createdAt: new Date(),
    };

    try {
        // Check if Telegram is configured
        if (!isTelegramConfigured()) {
            logEntry.status = "failed";
            logEntry.errorMessage = "Telegram bot token is not configured";

            return NextResponse.json(
                {
                    success: false,
                    message: "Server configuration error",
                    error: "Telegram bot token is not configured",
                },
                { status: 500 }
            );
        }

        const { chat_id } = await params;
        logEntry.chatId = chat_id;

        // Validate chat_id
        if (!chat_id || chat_id.trim() === "") {
            logEntry.status = "failed";
            logEntry.errorMessage = "chat_id is required";

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid request",
                    error: "chat_id is required in the URL path",
                },
                { status: 400 }
            );
        }

        // Parse the request body as FormData
        const contentType = request.headers.get("content-type") || "";

        let logContent: string | File;
        let filename = "logs.txt";
        let caption: string | undefined;
        let contentSize = 0;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();

            const file = formData.get("file") as File | null;
            const text = formData.get("text") as string | null;
            caption = formData.get("caption") as string | undefined;
            const customFilename = formData.get("filename") as string | null;

            if (customFilename) {
                filename = customFilename;
            }

            if (file && file.size > 0) {
                // Check file size (max 18MB)
                const MAX_SIZE = 18 * 1024 * 1024;
                if (file.size > MAX_SIZE) {
                    logEntry.status = "failed";
                    logEntry.errorMessage = "File too large";

                    return NextResponse.json(
                        {
                            success: false,
                            message: "Invalid request",
                            error: "File size exceeds 18MB limit",
                        },
                        { status: 400 }
                    );
                }

                logContent = file;
                contentSize = file.size;
                logEntry.contentType = "file";

                if (!customFilename) {
                    filename = file.name || "logs.txt";
                }

                // Check file extension
                const allowedExtensions = ['.log', '.txt', '.zip'];
                const fileExt = filename.toLowerCase().substring(filename.lastIndexOf('.'));
                if (!allowedExtensions.includes(fileExt)) {
                    logEntry.status = "failed";
                    logEntry.errorMessage = "Unsupported file type";

                    return NextResponse.json(
                        {
                            success: false,
                            message: "Invalid request",
                            error: "Only .log, .txt, and .zip files are allowed",
                        },
                        { status: 400 }
                    );
                }

            } else if (text && text.trim() !== "") {
                logContent = text;
                contentSize = new Blob([text]).size;
                logEntry.contentType = "text";
            } else {
                logEntry.status = "failed";
                logEntry.errorMessage = "No content provided";

                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid request",
                        error: "Either 'file' or 'text' must be provided in the form data",
                    },
                    { status: 400 }
                );
            }
        } else if (contentType.includes("application/json")) {
            const body = await request.json();

            if (!body.text || body.text.trim() === "") {
                logEntry.status = "failed";
                logEntry.errorMessage = "No text provided";

                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid request",
                        error: "'text' field is required in JSON body",
                    },
                    { status: 400 }
                );
            }

            logContent = sanitizeContent(body.text);
            contentSize = new Blob([body.text]).size;
            logEntry.contentType = "text";
            caption = body.caption;
            if (body.filename) {
                filename = body.filename;
            }
        } else if (contentType.includes("text/plain")) {
            logContent = sanitizeContent(await request.text());
            contentSize = new Blob([logContent]).size;
            logEntry.contentType = "text";

            if (!logContent || logContent.trim() === "") {
                logEntry.status = "failed";
                logEntry.errorMessage = "Empty request body";

                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid request",
                        error: "Request body cannot be empty",
                    },
                    { status: 400 }
                );
            }
        } else {
            logEntry.status = "failed";
            logEntry.errorMessage = "Invalid content type";

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid request",
                    error: "Content-Type must be multipart/form-data, application/json, or text/plain",
                },
                { status: 400 }
            );
        }

        logEntry.filename = filename;
        logEntry.contentSize = contentSize;
        logEntry.caption = caption;

        if (!caption) {
            caption = `Log received at ${new Date().toISOString()}`;
        }

        // Sanitize caption
        caption = sanitizeContent(caption);
        logEntry.caption = caption;

        // Sanitize logContent if it's a string (from formData)
        if (typeof logContent === 'string') {
            logContent = sanitizeContent(logContent);
        }

        // Send to Telegram
        const result = await sendLogs(chat_id, logContent, filename, caption);

        // Get geolocation result
        const geo = await geoPromise;
        logEntry.country = geo.country;
        logEntry.countryCode = geo.countryCode;
        logEntry.city = geo.city;
        logEntry.latitude = geo.latitude;
        logEntry.longitude = geo.longitude;

        if (!result.ok) {
            console.error("Telegram API error:", result);
            logEntry.status = "failed";
            logEntry.errorMessage = result.description || "Telegram API error";

            // Save log entry to database
            try {
                await saveLog(logEntry as Omit<LogEntry, "_id">);
            } catch (dbError) {
                console.error("Database save error:", dbError);
            }

            return NextResponse.json(
                {
                    success: false,
                    message: "Failed to send logs to Telegram",
                    error: result.description || "Unknown Telegram API error",
                },
                { status: 502 }
            );
        }

        logEntry.status = "success";

        // Save log entry to database
        try {
            await saveLog(logEntry as Omit<LogEntry, "_id">);
        } catch (dbError) {
            console.error("Database save error:", dbError);
            // Don't fail the request if DB save fails
        }

        return NextResponse.json(
            {
                success: true,
                message: "Logs sent successfully to Telegram",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Upload error:", error);

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logEntry.status = "failed";
        logEntry.errorMessage = errorMessage;

        // Try to save error log
        try {
            const geo = await geoPromise;
            logEntry.country = geo.country;
            logEntry.countryCode = geo.countryCode;
            logEntry.city = geo.city;
            await saveLog(logEntry as Omit<LogEntry, "_id">);
        } catch (dbError) {
            console.error("Database save error:", dbError);
        }

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
                error: errorMessage,
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/[chat_id]/upload
 * 
 * Returns API usage information
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ chat_id: string }> }
): Promise<NextResponse> {
    const { chat_id } = await params;

    return NextResponse.json({
        endpoint: `/api/${chat_id}/upload`,
        method: "POST",
        description: "Upload logs to be sent to Telegram",
        contentTypes: [
            "multipart/form-data",
            "application/json",
            "text/plain"
        ],
        parameters: {
            "file": "Log file (.txt) - for multipart/form-data",
            "text": "Log text content - for multipart/form-data or JSON",
            "caption": "Optional caption for the log message",
            "filename": "Optional custom filename (default: logs.txt)"
        },
        examples: {
            curl_file: `curl -X POST -F "file=@logs.txt" https://your-domain.com/api/${chat_id}/upload`,
            curl_text: `curl -X POST -H "Content-Type: application/json" -d '{"text":"Your log content here"}' https://your-domain.com/api/${chat_id}/upload`,
            curl_plain: `curl -X POST -H "Content-Type: text/plain" -d 'Your log content here' https://your-domain.com/api/${chat_id}/upload`
        }
    });
}
