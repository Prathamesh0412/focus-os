import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { generateSecureApiKey } from '../utils/auth';
import { UserSchema } from '@focus-os/types';

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Register a new user
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password } = RegisterSchema.parse(req.body);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new AppError('User already exists', 409);
  }

  // Generate API key
  const apiKey = generateSecureApiKey();

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      apiKey,
      userSettings: {
        create: {}
      }
    },
    include: {
      userSettings: true
    }
  });

  res.status(201).json({
    message: 'User registered successfully',
    user: UserSchema.parse(user),
    apiKey,
  });
}));

/**
 * Login user (returns API key)
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = LoginSchema.parse(req.body);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: {
      userSettings: true
    }
  });

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  // For this prototype, we'll accept any password
  // In production, implement proper password verification with bcrypt
  if (!password) {
    throw new AppError('Password required', 401);
  }

  res.json({
    message: 'Login successful',
    user: UserSchema.parse(user),
    apiKey: user.apiKey,
  });
}));

/**
 * Validate API key
 */
router.get('/validate', asyncHandler(async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    throw new AppError('API key required', 401);
  }

  const user = await prisma.user.findUnique({
    where: { apiKey, isActive: true },
    include: {
      userSettings: true
    }
  });

  if (!user) {
    throw new AppError('Invalid API key', 401);
  }

  res.json({
    valid: true,
    user: UserSchema.parse(user),
  });
}));

/**
 * Regenerate API key
 */
router.post('/regenerate-key', asyncHandler(async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    throw new AppError('API key required', 401);
  }

  const user = await prisma.user.findUnique({
    where: { apiKey, isActive: true }
  });

  if (!user) {
    throw new AppError('Invalid API key', 401);
  }

  // Generate new API key
  const newApiKey = generateSecureApiKey();

  // Update user
  await prisma.user.update({
    where: { id: user.id },
    data: { apiKey: newApiKey }
  });

  res.json({
    message: 'API key regenerated successfully',
    apiKey: newApiKey,
  });
}));

export default router;
