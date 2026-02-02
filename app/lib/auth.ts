
import { cookies } from "next/headers";
import { compare, hash } from "bcryptjs";
import {
    findUserByUsername,
    createUser,
    createSession,
    deleteSession,
    getSession,
    findUserById,
    getUserCount,
    User
} from "./database";

// Session configuration
const SESSION_COOKIE_NAME = "auth_session";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function hashPassword(password: string): Promise<string> {
    return hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return compare(password, hash);
}

export async function createSessionForUser(userId: string) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    await createSession({
        _id: sessionId,
        userId,
        expiresAt
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        expires: expiresAt,
        path: "/",
    });
}

export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionId) return null;

    const session = await getSession(sessionId);
    if (!session) return null;

    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
        await deleteSession(sessionId);
        return null;
    }

    return findUserById(session.userId);
}

export async function logout() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionId) {
        await deleteSession(sessionId);
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function registerUser(username: string, password: string): Promise<{ success: boolean; message: string }> {
    const existingUser = await findUserByUsername(username);

    if (existingUser) {
        return { success: false, message: "Username already taken" };
    }

    const count = await getUserCount();

    // Single User Mode: If any user exists, block registration
    if (count > 0) {
        return { success: false, message: "Registration is closed. Admin account already exists." };
    }

    const role = 'admin'; // First user is always admin

    const passwordHash = await hashPassword(password);

    const newUser: User = {
        username,
        passwordHash,
        role,
        createdAt: new Date()
    };

    await createUser(newUser);
    return { success: true, message: "User registered successfully" };
}
