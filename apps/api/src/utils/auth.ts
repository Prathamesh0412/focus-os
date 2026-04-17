import { randomBytes } from 'crypto';

/**
 * Generate a secure 64-character hexadecimal API key
 */
export function generateSecureApiKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Hash a password using bcrypt (placeholder for now)
 * In production, use bcrypt with proper salt rounds
 */
export async function hashPassword(password: string): Promise<string> {
  // Placeholder - implement bcrypt in production
  return password; // This is insecure, replace with bcrypt
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Placeholder - implement bcrypt in production
  return password === hash; // This is insecure, replace with bcrypt
}
