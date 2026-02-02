import { NextRequest, NextResponse } from "next/server";
import { blockIp, unblockIp, isIpBlocked } from "@/app/lib/database";
import { getCurrentUser } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
    try {
        // Auth check
        const user = await getCurrentUser();
        if (!user || user.role !== "admin") {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { ip } = await request.json();
        if (!ip) {
            return NextResponse.json({ success: false, error: "IP required" }, { status: 400 });
        }

        await blockIp(ip, "Blocked by admin dashboard");
        return NextResponse.json({ success: true, message: `IP ${ip} blocked` });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to block IP" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        // Auth check
        const user = await getCurrentUser();
        if (!user || user.role !== "admin") {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { ip } = await request.json();
        if (!ip) {
            return NextResponse.json({ success: false, error: "IP required" }, { status: 400 });
        }

        await unblockIp(ip);
        return NextResponse.json({ success: true, message: `IP ${ip} unblocked` });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to unblock IP" }, { status: 500 });
    }
}
