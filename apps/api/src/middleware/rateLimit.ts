import { Request, Response, NextFunction } from 'express';
import { API_CONFIG } from '@focus-os/config';

// Simple in-memory rate limiter for development
// In production, use Redis or similar
const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientId = getClientIdentifier(req);
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 100; // 100 requests per minute

  // Clean up expired entries
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(key);
    }
  }

  // Get current count for this client
  const current = requestCounts.get(clientId);

  if (!current || now > current.resetTime) {
    // New window or expired window
    requestCounts.set(clientId, {
      count: 1,
      resetTime: now + windowMs,
    });
    return next();
  }

  // Check if limit exceeded
  if (current.count >= maxRequests) {
    const resetIn = Math.ceil((current.resetTime - now) / 1000);
    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
      retryAfter: resetIn,
    });
  }

  // Increment count
  current.count++;
  next();
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(req: Request): string {
  // Try API key first (most reliable for extension requests)
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return `api:${apiKey.slice(0, 16)}`;
  }

  // Fall back to IP
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  const realIp = req.headers['x-real-ip'] as string;
  const ip = forwardedFor?.split(',')[0] || realIp || req.socket.remoteAddress || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Stricter rate limiting for sensitive endpoints
 */
export function strictRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientId = getClientIdentifier(req);
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 10; // 10 requests per minute for sensitive endpoints

  // Clean up expired entries
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(key);
    }
  }

  const current = requestCounts.get(`${clientId}:strict`);

  if (!current || now > current.resetTime) {
    requestCounts.set(`${clientId}:strict`, {
      count: 1,
      resetTime: now + windowMs,
    });
    return next();
  }

  if (current.count >= maxRequests) {
    const resetIn = Math.ceil((current.resetTime - now) / 1000);
    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded for sensitive operations. Try again in ${resetIn} seconds.`,
      retryAfter: resetIn,
    });
  }

  current.count++;
  next();
}
