import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "auth_session";

export async function proxy(request: NextRequest) {
    // Only protect /dashboard
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
        const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

        // Simple check: If no cookie, redirect to login
        if (!sessionCookie) {
            return NextResponse.redirect(new URL("/login", request.url));
        }

        // Full validation happens in the Server Component (Node.js runtime)
    }

    return NextResponse.next();
}

// Configure middleware to run on specific paths
export const config = {
    matcher: ["/dashboard/:path*"],
};
