import { NextRequest, NextResponse } from "next/server";
import { getLogs, getStats } from "@/app/lib/database";

/**
 * GET /api/dashboard
 * 
 * Returns logs list with pagination and stats
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const chatId = searchParams.get("chatId") || undefined;
        const status = searchParams.get("status") || undefined;
        const country = searchParams.get("country") || undefined;
        const includeStats = searchParams.get("stats") !== "false";

        const [logsResult, stats] = await Promise.all([
            getLogs(page, limit, { chatId, status, country }),
            includeStats ? getStats() : null,
        ]);

        return NextResponse.json({
            success: true,
            data: {
                logs: logsResult.logs,
                pagination: {
                    page,
                    limit,
                    total: logsResult.total,
                    totalPages: Math.ceil(logsResult.total / limit),
                },
                stats: stats,
            },
        });
    } catch (error) {
        console.error("Dashboard API error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
