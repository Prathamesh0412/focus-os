import { z } from 'zod';

// User schemas
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  apiKey: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

// Session schemas
export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  expectedDurationMinutes: z.number().nullable(),
  state: z.enum(['active', 'completed', 'cancelled']),
  totalFocusSeconds: z.number(),
  totalDistractionSeconds: z.number(),
  interruptionCount: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Session = z.infer<typeof SessionSchema>;

// Activity Event schemas
export const ActivityEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userId: z.string(),
  domain: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number(),
  category: z.enum(['focus', 'distraction']),
  source: z.string(),
  createdAt: z.string().datetime(),
});

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

// Blocked Domain schemas
export const BlockedDomainSchema = z.object({
  id: z.string(),
  userId: z.string(),
  domain: z.string(),
  createdAt: z.string().datetime(),
});

export type BlockedDomain = z.infer<typeof BlockedDomainSchema>;

// API Request/Response schemas
export const CreateSessionRequestSchema = z.object({
  title: z.string().optional(),
  expectedDurationMinutes: z.number().optional(),
  allowedDomains: z.array(z.string()).optional(),
});

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const CreateActivityEventRequestSchema = z.object({
  sessionId: z.string(),
  domain: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number(),
});

export type CreateActivityEventRequest = z.infer<typeof CreateActivityEventRequestSchema>;

export const CreateBlockedDomainRequestSchema = z.object({
  domain: z.string(),
});

export type CreateBlockedDomainRequest = z.infer<typeof CreateBlockedDomainRequestSchema>;

// Focus Score calculation
export interface FocusScoreBreakdown {
  baseScore: number;
  distractionPenalty: number;
  longDistractionPenalty: number;
  forcedClosePenalty: number;
  completionBonus: number;
  streakBonus: number;
  finalScore: number;
}

export interface SessionStats {
  totalFocusSeconds: number;
  totalDistractionSeconds: number;
  interruptionCount: number;
  longestUninterruptedStreak: number;
  focusScore: number;
  scoreBreakdown: FocusScoreBreakdown;
}

// Extension types
export interface ExtensionSettings {
  apiBaseUrl: string;
  apiKey: string;
  distractionTimeoutMinutes: number;
  autoCloseEnabled: boolean;
  warningEnabled: boolean;
  gracePeriodSeconds: number;
}

export interface TabActivity {
  tabId: number;
  domain: string | null;
  startTime: number;
  isActive: boolean;
}

export interface SessionState {
  isActive: boolean;
  sessionId: string | null;
  startTime: number | null;
  allowedDomains: string[];
  currentActivity: TabActivity | null;
}
