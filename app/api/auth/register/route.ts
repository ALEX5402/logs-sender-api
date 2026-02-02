import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: "Username and password are required" },
                { status: 400 }
            );
        }

        const result = await registerUser(username, password);

        if (!result.success) {
            return NextResponse.json(
                { success: false, message: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: true, message: result.message },
            { status: 201 }
        );

    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
