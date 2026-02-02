import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSessionForUser } from "@/app/lib/auth";
import { findUserByUsername } from "@/app/lib/database";

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: "Username and password are required" },
                { status: 400 }
            );
        }

        const user = await findUserByUsername(username);

        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            return NextResponse.json(
                { success: false, message: "Invalid username or password" },
                { status: 401 }
            );
        }

        // Create session
        if (user._id) {
            await createSessionForUser(user._id.toString());
        } else {
            return NextResponse.json(
                { success: false, message: "User ID missing" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { success: true, message: "Logged in successfully", role: user.role },
            { status: 200 }
        );

    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
