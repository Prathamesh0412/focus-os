// Default blocked domains
export const DEFAULT_BLOCKED_DOMAINS = [
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'netflix.com',
  'twitch.tv',
  'discord.com',
  'whatsapp.com',
  'amazon.com',
  'ebay.com',
  'pinterest.com',
  'linkedin.com',
  'news.ycombinator.com',
  'cnn.com',
  'bbc.com',
  'espn.com',
  'gaming.com',
  'steam.com'
];

// Default allowed (productive) domains
export const DEFAULT_ALLOWED_DOMAINS = [
  'github.com',
  'gitlab.com',
  'stackoverflow.com',
  'notion.so',
  'linear.app',
  'figma.com',
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'calendar.google.com',
  'mail.google.com',
  'outlook.com',
  'slack.com',
  'microsoft.com',
  'office.com',
  'monday.com',
  'asana.com',
  'trello.com',
  'jira.com',
  'confluence.com',
  'atlassian.com'
];

// Extension configuration defaults
export const DEFAULT_EXTENSION_SETTINGS = {
  apiBaseUrl: 'http://localhost:3000',
  distractionTimeoutMinutes: 2,
  autoCloseEnabled: false,
  warningEnabled: true,
  gracePeriodSeconds: 30,
  pollingIntervalMs: 15000,
  maxRetries: 3,
  retryDelayMs: 1000
};

// Session configuration
export const DEFAULT_SESSION_CONFIG = {
  defaultDurations: [25, 50, 90, 120], // minutes
  defaultDuration: 50, // minutes
  minDuration: 5, // minutes
  maxDuration: 240, // minutes (4 hours)
  autoStopOnInactivity: true,
  inactivityThresholdMs: 300000 // 5 minutes
};

// Focus score configuration
export const FOCUS_SCORE_CONFIG = {
  baseScore: 100,
  maxDistractionPenalty: 50,
  distractionPenaltyPerInterruption: 5,
  longDistractionPenaltyPer2Minutes: 3,
  maxLongDistractionPenalty: 30,
  forcedClosePenaltyPerEvent: 10,
  maxForcedClosePenalty: 40,
  completionBonus: 20,
  streakBonusPer10Minutes: 1,
  maxStreakBonus: 15,
  longDistractionThresholdSeconds: 120
};

// Analytics configuration
export const ANALYTICS_CONFIG = {
  defaultDateRangeDays: 30,
  maxDateRangeDays: 365,
  chartDataPoints: 50,
  topDistractionsLimit: 10,
  insightsMinSessions: 5,
  weeklyHeatmapWeeks: 12
};

// API configuration
export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  rateLimitMs: 100, // 100ms between requests
  batchSize: 50 // max events per batch
};

// Database configuration
export const DATABASE_CONFIG = {
  connectionTimeout: 10000, // 10 seconds
  queryTimeout: 30000, // 30 seconds
  maxConnections: 10,
  connectionRetryAttempts: 3,
  connectionRetryDelay: 2000 // 2 seconds
};

// Security configuration
export const SECURITY_CONFIG = {
  apiKeyLength: 64,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  passwordMinLength: 8,
  jwtExpiration: '24h'
};

// UI configuration
export const UI_CONFIG = {
  theme: {
    primaryColor: '#3b82f6',
    secondaryColor: '#10b981',
    dangerColor: '#ef4444',
    warningColor: '#f59e0b',
    darkMode: false
  },
  chart: {
    primaryColor: '#3b82f6',
    secondaryColor: '#10b981',
    dangerColor: '#ef4444',
    gridColor: '#e5e7eb',
    textColor: '#374151'
  },
  animation: {
    duration: 300,
    easing: 'ease-in-out'
  }
};

// Environment variable validation
export const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'FOCUS_OS_API_KEY'
] as const;

export const OPTIONAL_ENV_VARS = [
  'DEMO_USER_EMAIL',
  'NODE_ENV',
  'PORT'
] as const;

// Export all configurations
export const CONFIG = {
  DEFAULT_BLOCKED_DOMAINS,
  DEFAULT_ALLOWED_DOMAINS,
  DEFAULT_EXTENSION_SETTINGS,
  DEFAULT_SESSION_CONFIG,
  FOCUS_SCORE_CONFIG,
  ANALYTICS_CONFIG,
  API_CONFIG,
  DATABASE_CONFIG,
  SECURITY_CONFIG,
  UI_CONFIG,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS
} as const;
