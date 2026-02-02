import { NextRequest, NextResponse } from "next/server";
import { logout } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
    try {
        await logout();
        return NextResponse.json(
            { success: true, message: "Logged out successfully" },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, message: "Error loggin out" },
            { status: 500 }
        );
    }
}
