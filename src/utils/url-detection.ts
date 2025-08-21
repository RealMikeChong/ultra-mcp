/**
 * URL detection utilities for identifying URLs in text content
 */

// Common URL patterns that are likely to be useful for URL context
const URL_PATTERNS = [
  // HTTP/HTTPS URLs
  /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
  // Domain-like patterns that might be URLs without protocol
  /(?:^|\s)((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(?:\/[^\s<>"{}|\\^`\[\]]*)?/g,
];

/**
 * Extracts URLs from a text string
 * @param text The text to search for URLs
 * @param requireProtocol Whether to only match URLs with http/https protocol
 * @returns Array of unique URLs found in the text
 */
export function extractUrls(text: string, requireProtocol = true): string[] {
  const urls = new Set<string>();
  
  if (requireProtocol) {
    // Only match HTTP/HTTPS URLs
    const matches = text.match(URL_PATTERNS[0]);
    if (matches) {
      matches.forEach(url => urls.add(url.trim()));
    }
  } else {
    // Match all URL patterns
    URL_PATTERNS.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const url = match.trim();
          // Add protocol if missing for domain-like patterns
          if (!url.startsWith('http')) {
            urls.add(`https://${url}`);
          } else {
            urls.add(url);
          }
        });
      }
    });
  }
  
  return Array.from(urls);
}

/**
 * Checks if a text contains any URLs
 * @param text The text to check
 * @param requireProtocol Whether to only consider URLs with http/https protocol
 * @returns True if the text contains URLs
 */
export function hasUrls(text: string, requireProtocol = true): boolean {
  return extractUrls(text, requireProtocol).length > 0;
}

/**
 * Validates if a string is a properly formatted URL
 * @param url The URL string to validate
 * @returns True if the URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Filters a list of URLs to only include valid, accessible URLs
 * @param urls Array of URL strings to filter
 * @returns Array of valid URLs
 */
export function filterValidUrls(urls: string[]): string[] {
  return urls.filter(isValidUrl);
}