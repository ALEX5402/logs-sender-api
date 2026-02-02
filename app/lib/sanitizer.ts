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
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g;

    // Username Regex (matches @username)
    const mentionRegex = /@[\w\d_]+/g;

    let sanitized = text;

    // Replace URLs
    sanitized = sanitized.replace(urlRegex, '[LINK REMOVED]');

    // Replace Mentions
    sanitized = sanitized.replace(mentionRegex, '[MENTION REMOVED]');

    return sanitized;
}
