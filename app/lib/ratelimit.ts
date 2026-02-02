
/**
 * Simple In-Memory Rate Limiter
 * 
 * Uses a fixed-window counter algorithm with automatic cleanup.
 * NOT suitable for serverless/distributed environments, but works for singleton Node.js server.
 */

interface RateLimitEntry {
    count: number;
    firstRequest: number; // Timestamp of first request in window
}

export class RateLimiter {
    private limits: Map<string, RateLimitEntry>;
    private windowMs: number;
    private maxRequests: number;

    constructor(windowMs: number = 60 * 1000, maxRequests: number = 10) {
        this.limits = new Map();
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;

        // Cleanup every minute to prevent memory leaks
        setInterval(() => this.cleanup(), 60 * 1000);
    }

    /**
     * Check if a key (IP) is rate limited.
     * Increment count if allowed.
     */
    public check(key: string): { allowed: boolean; remaining: number } {
        const now = Date.now();
        const entry = this.limits.get(key);

        if (!entry) {
            this.limits.set(key, { count: 1, firstRequest: now });
            return { allowed: true, remaining: this.maxRequests - 1 };
        }

        // Check if window has expired
        if (now - entry.firstRequest > this.windowMs) {
            // Reset for new window
            this.limits.set(key, { count: 1, firstRequest: now });
            return { allowed: true, remaining: this.maxRequests - 1 };
        }

        if (entry.count >= this.maxRequests) {
            return { allowed: false, remaining: 0 };
        }

        entry.count++;
        return { allowed: true, remaining: this.maxRequests - entry.count };
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.limits.entries()) {
            if (now - entry.firstRequest > this.windowMs) {
                this.limits.delete(key);
            }
        }
    }
}

// Global instance for singleton use in Node.js server
// Use a global variable to persist across hot reloads in dev
const globalForLimiter = globalThis as unknown as { rateLimiter: RateLimiter };

export const rateLimiter = globalForLimiter.rateLimiter || new RateLimiter(60 * 1000, 10); // 10 requests per minute

if (process.env.NODE_ENV !== "production") globalForLimiter.rateLimiter = rateLimiter;
