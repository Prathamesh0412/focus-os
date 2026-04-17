import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { User } from '@focus-os/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * API Key authentication middleware
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'API key is missing'
      });
    }

    // Validate API key format
    if (!/^[a-f0-9]{64}$/i.test(apiKey)) {
      return res.status(401).json({ 
        error: 'Invalid API key format',
        message: 'API key must be a 64-character hexadecimal string'
      });
    }

    // Find user by API key
    const user = await prisma.user.findUnique({
      where: { 
        apiKey,
        isActive: true 
      },
      include: {
        userSettings: true
      }
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is invalid or inactive'
      });
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'Failed to authenticate request'
    });
  }
}

/**
 * Optional authentication - doesn't fail if no API key
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (apiKey && /^[a-f0-9]{64}$/i.test(apiKey)) {
      const user = await prisma.user.findUnique({
        where: { 
          apiKey,
          isActive: true 
        },
        include: {
          userSettings: true
        }
      });

      if (user) {
        req.user = user;
        // Update last login time
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without authentication
  }
}
