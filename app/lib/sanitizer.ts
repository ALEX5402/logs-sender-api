/**
 * Sanitizes text content by removing URLs and @mentions.
 * Useful for preventing spam and self-promotion in logs.
 * 
 * @param text The input text to sanitize
 * @returns The sanitized text with sensitive patterns replaced
 */
export function sanitizeContent(text: string): string {
    if (!text) return text;

    // URL Regex (matches http, https, www, and common domain patterns)
    // URL Regex (Match http/https, www, and common domains while avoiding filenames)
    // Matches:
    // 1. http:// or https://
    // 2. www.
    // 3. t.me/ or telegram.me/
    // 4. Domains ending in common TLDs (com, org, net, io, me, xyz, biz, info)
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|((?:t|telegram)\.me\/[^\s]+)|([a-zA-Z0-9-]+\.(?:com|org|net|io|me|xyz|biz|info)(?=\s|$|\/))/gi;

    // Username Regex (matches @username, min 3 chars to avoid @1 etc potentially)
    const mentionRegex = /@[\w\d_]{3,}/g;


    let sanitized = text;

    // Replace URLs
    sanitized = sanitized.replace(urlRegex, '[LINK REMOVED]');

    // Replace Mentions
    sanitized = sanitized.replace(mentionRegex, '[MENTION REMOVED]');

    return sanitized;
}
