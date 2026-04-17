import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  CreateSessionRequestSchema, 
  SessionSchema,
  SessionState,
  EventCategory
} from '@focus-os/types';
import { calculateSessionStats, extractDomain } from '@focus-os/utils';

const router = Router();

// Validation schemas
const CreateSessionSchema = CreateSessionRequestSchema.extend({
  allowedDomains: z.array(z.string()).optional(),
});

const UpdateSessionSchema = z.object({
  state: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED']).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Create a new focus session
 */
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { title, expectedDurationMinutes, allowedDomains } = CreateSessionSchema.parse(req.body);
  
  const userId = req.user!.id;

  // Check if there's already an active session
  const activeSession = await prisma.session.findFirst({
    where: {
      userId,
      state: 'ACTIVE'
    }
  });

  if (activeSession) {
    throw new AppError('User already has an active session', 409);
  }

  // Create new session
  const session = await prisma.session.create({
    data: {
      userId,
      title,
      expectedDurationMinutes,
      state: 'ACTIVE',
      startedAt: new Date(),
      lastActiveAt: new Date(),
    },
    include: {
      activityEvents: true,
      notes: true,
    }
  });

  res.status(201).json({
    message: 'Session created successfully',
    session: SessionSchema.parse(session),
  });
}));

/**
 * Get all sessions for the authenticated user
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { 
    page = '1', 
    limit = '20', 
    state, 
    startDate, 
    endDate 
  } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { userId };

  if (state) {
    where.state = state;
  }

  if (startDate || endDate) {
    where.startedAt = {};
    if (startDate) where.startedAt.gte = new Date(startDate as string);
    if (endDate) where.startedAt.lte = new Date(endDate as string);
  }

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      include: {
        activityEvents: {
          orderBy: { startedAt: 'desc' },
          take: 10, // Include recent events
        },
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take,
    }),
    prisma.session.count({ where }),
  ]);

  res.json({
    sessions: sessions.map(session => SessionSchema.parse(session)),
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
}));

/**
 * Get the active session for the authenticated user
 */
router.get('/active', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  const session = await prisma.session.findFirst({
    where: {
      userId,
      state: 'ACTIVE',
    },
    include: {
      activityEvents: {
        orderBy: { startedAt: 'desc' },
        take: 50, // Include recent activity
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!session) {
    return res.json({ session: null });
  }

  // Update last active time
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() }
  });

  res.json({
    session: SessionSchema.parse(session),
  });
}));

/**
 * Get a specific session by ID
 */
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const sessionId = req.params.id;
  const userId = req.user!.id;

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    include: {
      activityEvents: {
        orderBy: { startedAt: 'asc' },
      },
      notes: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  // Calculate session stats
  const stats = calculateSessionStats(session.activityEvents, session.state === 'COMPLETED');

  res.json({
    session: {
      ...SessionSchema.parse(session),
      stats,
    },
  });
}));

/**
 * Update a session (pause, resume, complete, cancel)
 */
router.patch('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const sessionId = req.params.id;
  const userId = req.user!.id;
  const updateData = UpdateSessionSchema.parse(req.body);

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  // Handle session state transitions
  if (updateData.state) {
    const newState = updateData.state as SessionState;
    
    // Validate state transitions
    if (session.state === 'COMPLETED' && newState !== 'CANCELLED') {
      throw new AppError('Cannot modify a completed session', 400);
    }

    if (session.state === 'CANCELLED') {
      throw new AppError('Cannot modify a cancelled session', 400);
    }

    // Set endedAt for terminal states
    if (newState === 'COMPLETED' || newState === 'CANCELLED') {
      updateData.endedAt = new Date();
      
      // Calculate final duration
      const actualDuration = Math.floor(
        (new Date().getTime() - session.startedAt.getTime()) / 1000
      );
      (updateData as any).actualDurationSeconds = actualDuration;
    }
  }

  const updatedSession = await prisma.session.update({
    where: { id: sessionId },
    data: updateData,
    include: {
      activityEvents: true,
      notes: true,
    },
  });

  res.json({
    message: 'Session updated successfully',
    session: SessionSchema.parse(updatedSession),
  });
}));

/**
 * Delete a session
 */
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const sessionId = req.params.id;
  const userId = req.user!.id;

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  // Only allow deletion of cancelled or completed sessions
  if (session.state === 'ACTIVE') {
    throw new AppError('Cannot delete an active session', 400);
  }

  await prisma.session.delete({
    where: { id: sessionId },
  });

  res.json({
    message: 'Session deleted successfully',
  });
}));

/**
 * Add a note to a session
 */
router.post('/:id/notes', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const sessionId = req.params.id;
  const userId = req.user!.id;
  const { content, type = 'manual' } = req.body;

  if (!content || typeof content !== 'string') {
    throw new AppError('Note content is required', 400);
  }

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  const note = await prisma.sessionNote.create({
    data: {
      sessionId,
      userId,
      content,
      type,
    },
  });

  res.status(201).json({
    message: 'Note added successfully',
    note,
  });
}));

export default router;
