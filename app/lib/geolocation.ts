/**
 * IP Geolocation using free ip-api.com service
 */

export interface GeoLocation {
    ip: string;
    country?: string;
    countryCode?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    isp?: string;
    timezone?: string;
}

/**
 * Get geolocation data for an IP address
 * Uses the free ip-api.com service (limited to 45 requests/minute)
 */
export async function getGeoLocation(ip: string): Promise<GeoLocation> {
    // Skip geolocation for localhost/private IPs
    if (isPrivateIP(ip)) {
        return {
            ip,
            country: "Local",
            countryCode: "XX",
            city: "Local Network",
        };
    }

    try {
        const response = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,lat,lon,isp,timezone`,
            { next: { revalidate: 86400 } } // Cache for 24 hours
        );

        const data = await response.json();

        if (data.status === "success") {
            return {
                ip,
                country: data.country,
                countryCode: data.countryCode,
                city: data.city,
                latitude: data.lat,
                longitude: data.lon,
                isp: data.isp,
                timezone: data.timezone,
            };
        }

        return { ip };
    } catch (error) {
        console.error("Geolocation error:", error);
        return { ip };
    }
}

/**
 * Check if an IP address is private/local
 */
function isPrivateIP(ip: string): boolean {
    // IPv4 private ranges
    const privateRanges = [
        /^127\./,                    // Loopback
        /^10\./,                     // Class A private
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
        /^192\.168\./,               // Class C private
        /^::1$/,                     // IPv6 loopback
        /^fe80:/i,                   // IPv6 link-local
        /^fc00:/i,                   // IPv6 unique local
        /^fd/i,                      // IPv6 unique local
    ];

    return privateRanges.some((range) => range.test(ip));
}

/**
 * Extract client IP from request headers
 */
export function getClientIP(headers: Headers): string {
    // Check various headers in order of preference
    const forwardedFor = headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }

    const realIp = headers.get("x-real-ip");
    if (realIp) {
        return realIp.trim();
    }

    const cfConnectingIp = headers.get("cf-connecting-ip");
    if (cfConnectingIp) {
        return cfConnectingIp.trim();
    }

    return "127.0.0.1";
}
