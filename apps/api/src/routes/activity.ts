import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  CreateActivityEventRequestSchema,
  ActivityEventSchema,
  EventCategory,
  EventSource
} from '@focus-os/types';
import { extractDomain, isValidDomain } from '@focus-os/utils';

const router = Router();

// Validation schemas
const CreateActivityEventSchema = CreateActivityEventRequestSchema.extend({
  url: z.string().optional(),
  title: z.string().optional(),
  tabId: z.number().optional(),
  windowId: z.number().optional(),
});

const BatchActivityEventSchema = z.object({
  events: z.array(CreateActivityEventSchema).min(1).max(50),
});

/**
 * Create a single activity event
 */
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const eventData = CreateActivityEventSchema.parse(req.body);

  // Validate that the session exists and belongs to the user
  const session = await prisma.session.findFirst({
    where: {
      id: eventData.sessionId,
      userId,
      state: 'ACTIVE',
    },
  });

  if (!session) {
    throw new AppError('Active session not found', 404);
  }

  // Validate domain
  if (!isValidDomain(eventData.domain)) {
    throw new AppError('Invalid domain format', 400);
  }

  // Get user's blocked domains to classify the event
  const blockedDomains = await prisma.blockedDomain.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: { domain: true },
  });

  const allowedDomains = await prisma.allowedDomain.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: { domain: true },
  });

  // Classify the event
  const category = classifyActivity(
    eventData.domain,
    blockedDomains.map(d => d.domain),
    allowedDomains.map(d => d.domain)
  );

  // Create the activity event
  const activityEvent = await prisma.activityEvent.create({
    data: {
      sessionId: eventData.sessionId,
      userId,
      domain: eventData.domain,
      url: eventData.url,
      title: eventData.title,
      startedAt: new Date(eventData.startedAt),
      endedAt: new Date(eventData.endedAt),
      durationSeconds: eventData.durationSeconds,
      category,
      source: 'CHROME_EXTENSION',
      tabId: eventData.tabId,
      windowId: eventData.windowId,
    },
  });

  // Update session statistics
  await updateSessionStats(eventData.sessionId);

  res.status(201).json({
    message: 'Activity event created successfully',
    event: ActivityEventSchema.parse(activityEvent),
    category,
  });
}));

/**
 * Create multiple activity events (batch processing)
 */
router.post('/batch', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { events } = BatchActivityEventSchema.parse(req.body);

  // Get user's domain lists
  const blockedDomains = await prisma.blockedDomain.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: { domain: true },
  });

  const allowedDomains = await prisma.allowedDomain.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: { domain: true },
  });

  const blockedDomainList = blockedDomains.map(d => d.domain);
  const allowedDomainList = allowedDomains.map(d => d.domain);

  // Process events in batches
  const createdEvents = [];
  const sessionIds = new Set<string>();

  for (const eventData of events) {
    // Validate session exists and is active
    const session = await prisma.session.findFirst({
      where: {
        id: eventData.sessionId,
        userId,
        state: 'ACTIVE',
      },
    });

    if (!session) {
      continue; // Skip events for inactive sessions
    }

    // Validate domain
    if (!isValidDomain(eventData.domain)) {
      continue;
    }

    // Classify the event
    const category = classifyActivity(
      eventData.domain,
      blockedDomainList,
      allowedDomainList
    );

    // Create the activity event
    const activityEvent = await prisma.activityEvent.create({
      data: {
        sessionId: eventData.sessionId,
        userId,
        domain: eventData.domain,
        url: eventData.url,
        title: eventData.title,
        startedAt: new Date(eventData.startedAt),
        endedAt: new Date(eventData.endedAt),
        durationSeconds: eventData.durationSeconds,
        category,
        source: 'CHROME_EXTENSION',
        tabId: eventData.tabId,
        windowId: eventData.windowId,
      },
    });

    createdEvents.push(ActivityEventSchema.parse(activityEvent));
    sessionIds.add(eventData.sessionId);
  }

  // Update statistics for all affected sessions
  for (const sessionId of sessionIds) {
    await updateSessionStats(sessionId);
  }

  res.status(201).json({
    message: 'Batch activity events created successfully',
    events: createdEvents,
    processed: events.length,
    created: createdEvents.length,
  });
}));

/**
 * Get activity events for a session
 */
router.get('/session/:sessionId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { sessionId } = req.params;
  const { page = '1', limit = '50', category } = req.query;

  // Validate session belongs to user
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { sessionId };

  if (category) {
    where.category = category;
  }

  const [events, total] = await Promise.all([
    prisma.activityEvent.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip,
      take,
    }),
    prisma.activityEvent.count({ where }),
  ]);

  res.json({
    events: events.map(event => ActivityEventSchema.parse(event)),
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
}));

/**
 * Get recent activity events across all sessions
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { 
    page = '1', 
    limit = '20', 
    category, 
    domain,
    startDate, 
    endDate 
  } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { userId };

  if (category) {
    where.category = category;
  }

  if (domain) {
    where.domain = { contains: domain, mode: 'insensitive' };
  }

  if (startDate || endDate) {
    where.startedAt = {};
    if (startDate) where.startedAt.gte = new Date(startDate as string);
    if (endDate) where.startedAt.lte = new Date(endDate as string);
  }

  const [events, total] = await Promise.all([
    prisma.activityEvent.findMany({
      where,
      include: {
        session: {
          select: {
            id: true,
            title: true,
            startedAt: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take,
    }),
    prisma.activityEvent.count({ where }),
  ]);

  res.json({
    events: events.map(event => ({
      ...ActivityEventSchema.parse(event),
      session: event.session,
    })),
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
}));

/**
 * Delete an activity event
 */
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const eventId = req.params.id;
  const userId = req.user!.id;

  const event = await prisma.activityEvent.findFirst({
    where: {
      id: eventId,
      userId,
    },
  });

  if (!event) {
    throw new AppError('Activity event not found', 404);
  }

  await prisma.activityEvent.delete({
    where: { id: eventId },
  });

  // Update session statistics
  await updateSessionStats(event.sessionId);

  res.json({
    message: 'Activity event deleted successfully',
  });
}));

/**
 * Classify activity based on domain lists
 */
function classifyActivity(
  domain: string,
  blockedDomains: string[],
  allowedDomains: string[]
): EventCategory {
  // Check if domain is blocked
  const isBlocked = blockedDomains.some(blocked => 
    domain === blocked || domain.endsWith(`.${blocked}`)
  );

  if (isBlocked) {
    return 'DISTRACTION';
  }

  // Check if domain is allowed
  const isAllowed = allowedDomains.some(allowed => 
    domain === allowed || domain.endsWith(`.${allowed}`)
  );

  if (isAllowed) {
    return 'FOCUS';
  }

  // Default to neutral for unknown domains
  return 'NEUTRAL';
}

/**
 * Update session statistics based on activity events
 */
async function updateSessionStats(sessionId: string) {
  const events = await prisma.activityEvent.findMany({
    where: { sessionId },
  });

  const focusEvents = events.filter(e => e.category === 'FOCUS');
  const distractionEvents = events.filter(e => e.category === 'DISTRACTION');
  const neutralEvents = events.filter(e => e.category === 'NEUTRAL');

  const totalFocusSeconds = focusEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
  const totalDistractionSeconds = distractionEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
  const totalNeutralSeconds = neutralEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
  const interruptionCount = distractionEvents.length;

  // Calculate longest uninterrupted focus streak
  let longestUninterruptedStreak = 0;
  let currentStreak = 0;
  
  events.forEach(event => {
    if (event.category === 'FOCUS') {
      currentStreak += event.durationSeconds;
      longestUninterruptedStreak = Math.max(longestUninterruptedStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  // Calculate unique domains visited
  const uniqueDomains = new Set(events.map(e => e.domain)).size;

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      totalFocusSeconds,
      totalDistractionSeconds,
      totalNeutralSeconds,
      interruptionCount,
      longestUninterruptedStreak,
      uniqueDomainsVisited: uniqueDomains,
      lastActiveAt: new Date(),
    },
  });
}

export default router;
