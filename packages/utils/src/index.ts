import { ActivityEvent, SessionStats, FocusScoreBreakdown } from '@focus-os/types';
import { format, differenceInSeconds, startOfDay, endOfDay, subDays } from 'date-fns';

// Domain extraction utilities
export function extractDomain(url: string): string | null {
  if (!url) return null;

  // Ignore special URLs
  if (url.startsWith('chrome://') ||
      url.startsWith('extension://') ||
      url.startsWith('about:') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('chrome-search://')) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === 'localhost') {
      return 'localhost';
    }

    const parts = hostname.split('.');
    if (parts.length <= 2) {
      return hostname;
    }

    // Get last two parts (e.g., example.com from www.example.com)
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

// Focus score calculation
export function calculateFocusScore(
  focusSeconds: number,
  distractionSeconds: number,
  interruptionCount: number,
  longestUninterruptedStreak: number,
  totalSessionSeconds: number,
  isCompleted: boolean,
  forcedCloseCount: number = 0
): FocusScoreBreakdown {
  const baseScore = 100;
  
  // Distraction penalty (5 points per distraction)
  const distractionPenalty = Math.min(interruptionCount * 5, 50);
  
  // Long distraction penalty (extra penalty for distractions > 2 minutes)
  const longDistractionPenalty = Math.min(
    Math.floor(distractionSeconds / 120) * 3, 
    30
  );
  
  // Forced close penalty (10 points per forced close)
  const forcedClosePenalty = Math.min(forcedCloseCount * 10, 40);
  
  // Completion bonus (20 points if completed)
  const completionBonus = isCompleted ? 20 : 0;
  
  // Streak bonus (up to 15 points for long uninterrupted focus)
  const streakBonus = Math.min(Math.floor(longestUninterruptedStreak / 600), 15);
  
  const finalScore = Math.max(0, Math.min(100, 
    baseScore - distractionPenalty - longDistractionPenalty - forcedClosePenalty + completionBonus + streakBonus
  ));

  return {
    baseScore,
    distractionPenalty,
    longDistractionPenalty,
    forcedClosePenalty,
    completionBonus,
    streakBonus,
    finalScore
  };
}

// Session statistics calculation
export function calculateSessionStats(
  events: ActivityEvent[],
  isCompleted: boolean,
  forcedCloseCount: number = 0
): SessionStats {
  const focusEvents = events.filter(e => e.category === 'focus');
  const distractionEvents = events.filter(e => e.category === 'distraction');
  
  const totalFocusSeconds = focusEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
  const totalDistractionSeconds = distractionEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
  const interruptionCount = distractionEvents.length;
  
  // Calculate longest uninterrupted focus streak
  let longestUninterruptedStreak = 0;
  let currentStreak = 0;
  
  events.forEach(event => {
    if (event.category === 'focus') {
      currentStreak += event.durationSeconds;
      longestUninterruptedStreak = Math.max(longestUninterruptedStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });
  
  const scoreBreakdown = calculateFocusScore(
    totalFocusSeconds,
    totalDistractionSeconds,
    interruptionCount,
    longestUninterruptedStreak,
    totalFocusSeconds + totalDistractionSeconds,
    isCompleted,
    forcedCloseCount
  );
  
  return {
    totalFocusSeconds,
    totalDistractionSeconds,
    interruptionCount,
    longestUninterruptedStreak,
    focusScore: scoreBreakdown.finalScore,
    scoreBreakdown
  };
}

// Time formatting utilities
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'h:mm a');
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a');
}

// Date range utilities
export function getDateRange(days: number): { start: Date; end: Date } {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(end, days - 1));
  return { start, end };
}

export function isToday(date: string | Date): boolean {
  const today = new Date();
  const compareDate = new Date(date);
  return (
    today.getDate() === compareDate.getDate() &&
    today.getMonth() === compareDate.getMonth() &&
    today.getFullYear() === compareDate.getFullYear()
  );
}

export function isThisWeek(date: string | Date): boolean {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
  const compareDate = new Date(date);
  return compareDate >= startOfWeek && compareDate <= endOfWeek;
}

// Analytics utilities
export function groupEventsByDay(events: ActivityEvent[]): Record<string, ActivityEvent[]> {
  return events.reduce((groups, event) => {
    const date = format(new Date(event.createdAt), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, ActivityEvent[]>);
}

export function getTopDistractions(events: ActivityEvent[], limit: number = 10): Array<{ domain: string; count: number; totalTime: number }> {
  const distractionEvents = events.filter(e => e.category === 'distraction');
  const domainStats = distractionEvents.reduce((stats, event) => {
    if (!stats[event.domain]) {
      stats[event.domain] = { count: 0, totalTime: 0 };
    }
    stats[event.domain].count += 1;
    stats[event.domain].totalTime += event.durationSeconds;
    return stats;
  }, {} as Record<string, { count: number; totalTime: number }>);

  return Object.entries(domainStats)
    .map(([domain, stats]) => ({ domain, ...stats }))
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, limit);
}

export function calculateProductivityRatio(focusSeconds: number, distractionSeconds: number): number {
  const total = focusSeconds + distractionSeconds;
  if (total === 0) return 0;
  return Math.round((focusSeconds / total) * 100);
}

// Validation utilities
export function isValidApiKey(key: string): boolean {
  return typeof key === 'string' && key.length >= 32 && /^[a-f0-9]+$/i.test(key);
}

export function isValidDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
  return domainRegex.test(domain);
}

// Local storage utilities
export const storageKeys = {
  API_KEY: 'focusos_api_key',
  API_BASE_URL: 'focusos_api_base_url',
  EXTENSION_SETTINGS: 'focusos_extension_settings',
  USER_PREFERENCES: 'focusos_user_preferences'
} as const;

export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}
