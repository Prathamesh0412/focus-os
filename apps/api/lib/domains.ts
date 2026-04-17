/**
 * Extract domain from URL and normalize it.
 *
 * Examples:
 * - https://www.youtube.com/watch?v=123 -> youtube.com
 * - https://mail.google.com/mail/u/0 -> google.com
 * - https://github.com/user/repo -> github.com
 *
 * Strategy: Get the registered domain (SLD + TLD), ignoring subdomains.
 * For prototype, we use a simple approach: last two parts of hostname.
 */
export function extractDomain(url: string): string | null {
  if (!url) return null;

  // Ignore chrome://, extension://, about:, etc.
  if (url.startsWith('chrome://') ||
      url.startsWith('extension://') ||
      url.startsWith('about:') ||
      url.startsWith('chrome-extension://')) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Handle localhost for development
    if (hostname === 'localhost') {
      return 'localhost';
    }

    const parts = hostname.split('.');

    // For simple domains like example.com, return as-is
    if (parts.length <= 2) {
      return hostname;
    }

    // For subdomains, get last two parts (e.g., example.com from www.example.com)
    // This is simplified; real implementation would use a TLD library
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

/**
 * Normalize domain for consistent matching.
 */
export function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '');
}

/**
 * Check if domain matches a blocked domain pattern.
 */
export function isDomainBlocked(domain: string, blockedDomains: string[]): boolean {
  const normalized = normalizeDomain(domain);
  return blockedDomains.some(blocked => normalizeDomain(blocked) === normalized);
}
