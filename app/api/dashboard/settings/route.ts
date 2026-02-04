import { NextRequest, NextResponse } from "next/server";
import { getPanicMode, setPanicMode } from "@/app/lib/database";
import { getCurrentUser } from "@/app/lib/auth";

/**
 * GET /api/dashboard/settings
 * Returns current global settings
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const panicMode = await getPanicMode();
        return NextResponse.json({ success: true, panicMode });
    } catch (error) {
        console.error("Settings API error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/dashboard/settings
 * Updates global settings
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        if (typeof body.panicMode !== 'boolean') {
            return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
        }

        await setPanicMode(body.panicMode, user.username);

        return NextResponse.json({
            success: true,
            panicMode: body.panicMode,
            message: body.panicMode ? "Panic Mode Enabled" : "Panic Mode Disabled"
        });

    } catch (error) {
        console.error("Settings Update API error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
