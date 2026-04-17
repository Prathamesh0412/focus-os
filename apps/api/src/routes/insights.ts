import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  subDays, 
  startOfDay, 
  endOfDay, 
  format,
  differenceInDays,
  isAfter,
  isBefore
} from 'date-fns';

const router = Router();

// Validation schemas
const InsightsQuerySchema = z.object({
  limit: z.number().min(1).max(50).optional(),
  unread: z.boolean().optional(),
  type: z.string().optional(),
});

/**
 * Get insights for the authenticated user
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { limit = 20, unread, type } = InsightsQuerySchema.parse(req.query);

  const where: any = { userId, isArchived: false };

  if (unread) {
    where.isRead = false;
  }

  if (type) {
    where.type = type;
  }

  const insights = await prisma.insight.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json({
    insights,
    unreadCount: await prisma.insight.count({
      where: { userId, isRead: false, isArchived: false },
    }),
  });
}));

/**
 * Mark insight as read
 */
router.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const insightId = req.params.id;

  const insight = await prisma.insight.findFirst({
    where: {
      id: insightId,
      userId,
    },
  });

  if (!insight) {
    throw new AppError('Insight not found', 404);
  }

  const updatedInsight = await prisma.insight.update({
    where: { id: insightId },
    data: { isRead: true },
  });

  res.json({
    message: 'Insight marked as read',
    insight: updatedInsight,
  });
}));

/**
 * Mark insight as unread
 */
router.patch('/:id/unread', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const insightId = req.params.id;

  const insight = await prisma.insight.findFirst({
    where: {
      id: insightId,
      userId,
    },
  });

  if (!insight) {
    throw new AppError('Insight not found', 404);
  }

  const updatedInsight = await prisma.insight.update({
    where: { id: insightId },
    data: { isRead: false },
  });

  res.json({
    message: 'Insight marked as unread',
    insight: updatedInsight,
  });
}));

/**
 * Archive insight
 */
router.patch('/:id/archive', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const insightId = req.params.id;

  const insight = await prisma.insight.findFirst({
    where: {
      id: insightId,
      userId,
    },
  });

  if (!insight) {
    throw new AppError('Insight not found', 404);
  }

  const updatedInsight = await prisma.insight.update({
    where: { id: insightId },
    data: { isArchived: true },
  });

  res.json({
    message: 'Insight archived',
    insight: updatedInsight,
  });
}));

/**
 * Delete insight
 */
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const insightId = req.params.id;

  const insight = await prisma.insight.findFirst({
    where: {
      id: insightId,
      userId,
    },
  });

  if (!insight) {
    throw new AppError('Insight not found', 404);
  }

  await prisma.insight.delete({
    where: { id: insightId },
  });

  res.json({
    message: 'Insight deleted',
  });
}));

/**
 * Generate new insights based on recent data
 */
router.post('/generate', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  // Get recent data for insight generation
  const last30Days = subDays(new Date(), 30);
  const last7Days = subDays(new Date(), 7);

  const [recentSessions, recentEvents] = await Promise.all([
    prisma.session.findMany({
      where: {
        userId,
        startedAt: { gte: last30Days },
      },
      include: {
        activityEvents: true,
      },
    }),
    prisma.activityEvent.findMany({
      where: {
        userId,
        startedAt: { gte: last30Days },
      },
    }),
  ]);

  const newInsights = [];

  // Generate productivity trend insight
  const productivityInsight = generateProductivityTrendInsight(userId, recentSessions);
  if (productivityInsight) newInsights.push(productivityInsight);

  // Generate distraction pattern insight
  const distractionInsight = generateDistractionPatternInsight(userId, recentEvents);
  if (distractionInsight) newInsights.push(distractionInsight);

  // Generate optimal time insight
  const optimalTimeInsight = generateOptimalTimeInsight(userId, recentSessions);
  if (optimalTimeInsight) newInsights.push(optimalTimeInsight);

  // Generate session duration insight
  const durationInsight = generateSessionDurationInsight(userId, recentSessions);
  if (durationInsight) newInsights.push(durationInsight);

  // Generate weekly comparison insight
  const weeklyInsight = generateWeeklyComparisonInsight(userId, recentSessions);
  if (weeklyInsight) newInsights.push(weeklyInsight);

  // Create insights in database
  const createdInsights = [];
  for (const insightData of newInsights) {
    // Check if similar insight already exists
    const existingInsight = await prisma.insight.findFirst({
      where: {
        userId,
        type: insightData.type,
        createdAt: { gte: last7Days },
      },
    });

    if (!existingInsight) {
      const insight = await prisma.insight.create({
        data: insightData,
      });
      createdInsights.push(insight);
    }
  }

  res.status(201).json({
    message: 'Insights generated successfully',
    insights: createdInsights,
    generated: newInsights.length,
    created: createdInsights.length,
  });
}));

/**
 * Generate productivity trend insight
 */
function generateProductivityTrendInsight(userId: string, sessions: any[]) {
  if (sessions.length < 5) return null;

  const last7Days = sessions.filter(s => 
    differenceInDays(new Date(), new Date(s.startedAt)) <= 7
  );
  const previous7Days = sessions.filter(s => {
    const daysDiff = differenceInDays(new Date(), new Date(s.startedAt));
    return daysDiff > 7 && daysDiff <= 14;
  });

  if (last7Days.length === 0 || previous7Days.length === 0) return null;

  const recentAvgScore = last7Days.reduce((sum, s) => sum + s.focusScore, 0) / last7Days.length;
  const previousAvgScore = previous7Days.reduce((sum, s) => sum + s.focusScore, 0) / previous7Days.length;

  const improvement = recentAvgScore - previousAvgScore;
  const isImproving = improvement > 5;
  const isDeclining = improvement < -5;

  if (!isImproving && !isDeclining) return null;

  return {
    userId,
    type: 'productivity_trend',
    title: isImproving ? 'Productivity Improving!' : 'Productivity Declining',
    description: isImproving 
      ? `Your focus score has improved by ${Math.abs(Math.round(improvement))} points this week compared to last week. Keep up the great work!`
      : `Your focus score has decreased by ${Math.abs(Math.round(improvement))} points this week. Consider reviewing your focus strategies.`,
    data: {
      recentAvgScore: Math.round(recentAvgScore),
      previousAvgScore: Math.round(previousAvgScore),
      improvement: Math.round(improvement),
    },
  };
}

/**
 * Generate distraction pattern insight
 */
function generateDistractionPatternInsight(userId: string, events: any[]) {
  const distractionEvents = events.filter(e => e.category === 'DISTRACTION');
  
  if (distractionEvents.length < 10) return null;

  // Find most distracting domain
  const domainCounts = distractionEvents.reduce((acc, event) => {
    acc[event.domain] = (acc[event.domain] || 0) + 1;
    return acc;
  }, {});

  const topDistraction = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)[0];

  if (!topDistraction) return null;

  const [domain, count] = topDistraction;
  const percentage = Math.round((count / distractionEvents.length) * 100);

  if (percentage < 20) return null; // Only alert if it's a significant pattern

  return {
    userId,
    type: 'distraction_pattern',
    title: 'Top Distraction Identified',
    description: `${domain} accounts for ${percentage}% of your distractions this month. Consider adding it to your blocked domains.`,
    data: {
      domain,
      count,
      percentage,
      totalDistractions: distractionEvents.length,
    },
  };
}

/**
 * Generate optimal time insight
 */
function generateOptimalTimeInsight(userId: string, sessions: any[]) {
  if (sessions.length < 10) return null;

  // Group sessions by hour of day
  const hourlyPerformance: Record<number, { totalScore: number; count: number }> = {};
  
  sessions.forEach(session => {
    const hour = new Date(session.startedAt).getHours();
    if (!hourlyPerformance[hour]) {
      hourlyPerformance[hour] = { totalScore: 0, count: 0 };
    }
    hourlyPerformance[hour].totalScore += session.focusScore;
    hourlyPerformance[hour].count += 1;
  });

  // Calculate average score for each hour
  const hourlyAverages = Object.entries(hourlyPerformance)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      avgScore: data.totalScore / data.count,
      sessions: data.count,
    }))
    .filter(h => h.sessions >= 3) // Only consider hours with enough data
    .sort((a, b) => b.avgScore - a.avgScore);

  if (hourlyAverages.length === 0) return null;

  const bestHour = hourlyAverages[0];
  const overallAvg = sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length;

  if (bestHour.avgScore - overallAvg < 10) return null; // Only if significantly better

  return {
    userId,
    type: 'optimal_time',
    title: 'Best Focus Time Found',
    description: `Your focus performance is highest at ${bestHour.hour}:00. Consider scheduling important work during this time.`,
    data: {
      bestHour: bestHour.hour,
      bestHourScore: Math.round(bestHour.avgScore),
      overallAvgScore: Math.round(overallAvg),
      improvement: Math.round(bestHour.avgScore - overallAvg),
    },
  };
}

/**
 * Generate session duration insight
 */
function generateSessionDurationInsight(userId: string, sessions: any[]) {
  const completedSessions = sessions.filter(s => s.state === 'COMPLETED');
  
  if (completedSessions.length < 5) return null;

  // Calculate average duration and success rate by duration
  const durationGroups: Record<string, { total: number; completed: number; totalScore: number }> = {
    'short': { total: 0, completed: 0, totalScore: 0 },    // < 30 min
    'medium': { total: 0, completed: 0, totalScore: 0 },  // 30-60 min
    'long': { total: 0, completed: 0, totalScore: 0 },    // > 60 min
  };

  sessions.forEach(session => {
    const durationMinutes = session.actualDurationSeconds ? session.actualDurationSeconds / 60 : 0;
    let group: string;

    if (durationMinutes < 30) group = 'short';
    else if (durationMinutes <= 60) group = 'medium';
    else group = 'long';

    durationGroups[group].total += 1;
    if (session.state === 'COMPLETED') {
      durationGroups[group].completed += 1;
    }
    durationGroups[group].totalScore += session.focusScore;
  });

  // Find the best performing duration
  const groupPerformance = Object.entries(durationGroups)
    .filter(([, data]) => data.total >= 3)
    .map(([group, data]) => ({
      group,
      completionRate: (data.completed / data.total) * 100,
      avgScore: data.totalScore / data.total,
      total: data.total,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  if (groupPerformance.length === 0) return null;

  const bestGroup = groupPerformance[0];
  const recommendations = {
    short: 'shorter sessions (under 30 minutes)',
    medium: 'medium sessions (30-60 minutes)',
    long: 'longer sessions (over 60 minutes)',
  };

  return {
    userId,
    type: 'session_duration',
    title: 'Optimal Session Length',
    description: `You perform best with ${recommendations[bestGroup.group as keyof typeof recommendations]}. Your completion rate is ${Math.round(bestGroup.completionRate)}% with these sessions.`,
    data: {
      bestDuration: bestGroup.group,
      completionRate: Math.round(bestGroup.completionRate),
      avgScore: Math.round(bestGroup.avgScore),
      totalSessions: bestGroup.total,
    },
  };
}

/**
 * Generate weekly comparison insight
 */
function generateWeeklyComparisonInsight(userId: string, sessions: any[]) {
  const thisWeek = sessions.filter(s => {
    const sessionDate = new Date(s.startedAt);
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    return isAfter(sessionDate, weekStart);
  });

  const lastWeek = sessions.filter(s => {
    const sessionDate = new Date(s.startedAt);
    const today = new Date();
    const lastWeekStart = startOfWeek(subDays(today, 7), { weekStartsOn: 0 });
    const lastWeekEnd = endOfWeek(subDays(today, 7), { weekStartsOn: 0 });
    return isAfter(sessionDate, lastWeekStart) && isBefore(sessionDate, lastWeekEnd);
  });

  if (thisWeek.length === 0 || lastWeek.length === 0) return null;

  const thisWeekFocusTime = thisWeek.reduce((sum, s) => sum + s.totalFocusSeconds, 0);
  const lastWeekFocusTime = lastWeek.reduce((sum, s) => sum + s.totalFocusSeconds, 0);

  const change = thisWeekFocusTime - lastWeekFocusTime;
  const changePercent = lastWeekFocusTime > 0 ? (change / lastWeekFocusTime) * 100 : 0;

  if (Math.abs(changePercent) < 15) return null; // Only if significant change

  const isIncrease = change > 0;
  const changeHours = Math.abs(change) / 3600;

  return {
    userId,
    type: 'weekly_comparison',
    title: isIncrease ? 'Great Week!' : 'Week in Review',
    description: isIncrease 
      ? `You focused ${Math.round(changeHours)} more hours this week than last week!`
      : `You focused ${Math.round(changeHours)} fewer hours this week than last week.`,
    data: {
      thisWeekHours: Math.round(thisWeekFocusTime / 3600),
      lastWeekHours: Math.round(lastWeekFocusTime / 3600),
      changeHours: Math.round(changeHours),
      changePercent: Math.round(changePercent),
    },
  };
}

export default router;
