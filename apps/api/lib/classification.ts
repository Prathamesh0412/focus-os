/**
 * Domain classification for focus vs distraction
 */

// Known productive/focus domains
const FOCUS_DOMAINS = [
  'github.com',
  'stackoverflow.com',
  'developer.mozilla.org',
  'docs.google.com',
  'notion.so',
  'linear.app',
  'jira.atlassian.com',
  'figma.com',
  'code.visualstudio.com',
  'vscode.dev',
  'localhost', // Development work
];

// Known distraction domains (in addition to user's blocked list)
const DISTRACTION_DOMAINS = [
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'netflix.com',
  'amazon.com',
  'linkedin.com',
  'news.ycombinator.com',
];

/**
 * Classify domain as focus or distraction
 */
export function classifyDomain(domain: string, userBlockedDomains: string[]): 'focus' | 'distraction' {
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  
  // Check user's custom blocked domains first
  if (userBlockedDomains.some(blocked => blocked.toLowerCase().replace(/^www\./, '') === normalized)) {
    return 'distraction';
  }
  
  // Check known distraction domains
  if (DISTRACTION_DOMAINS.includes(normalized)) {
    return 'distraction';
  }
  
  // Check known focus domains
  if (FOCUS_DOMAINS.includes(normalized)) {
    return 'focus';
  }
  
  // Default to focus for unknown domains (optimistic approach)
  return 'focus';
}

/**
 * Get category description for display
 */
export function getCategoryDescription(category: 'focus' | 'distraction'): string {
  return category === 'focus' ? '🎯 Focus' : '⚠️ Distraction';
}
