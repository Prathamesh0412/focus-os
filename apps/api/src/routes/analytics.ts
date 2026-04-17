import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  subDays, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  isAfter,
  isBefore
} from 'date-fns';
import { 
  groupEventsByDay, 
  getTopDistractions, 
  calculateProductivityRatio,
  getDateRange,
  isToday,
  isThisWeek
} from '@focus-os/utils';

const router = Router();

// Validation schemas
const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  days: z.number().min(1).max(365).optional(),
});

const AnalyticsQuerySchema = DateRangeSchema.extend({
  groupBy: z.enum(['day', 'week', 'month']).optional(),
  includeDetails: z.boolean().optional(),
});

/**
 * Get overview statistics for the user
 */
router.get('/overview', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { days = 30 } = AnalyticsQuerySchema.parse(req.query);

  const { start, end } = getDateRange(days);

  // Get sessions in date range
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startedAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      activityEvents: true,
    },
  });

  // Calculate overview stats
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.state === 'COMPLETED').length;
  const totalFocusTime = sessions.reduce((sum, s) => sum + s.totalFocusSeconds, 0);
  const totalDistractionTime = sessions.reduce((sum, s) => sum + s.totalDistractionSeconds, 0);
  const averageFocusScore = sessions.length > 0 
    ? Math.round(sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length)
    : 0;

  // Today's stats
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const todaySessions = sessions.filter(s => 
    isAfter(s.startedAt, todayStart) && isBefore(s.startedAt, todayEnd)
  );
  const todayFocusTime = todaySessions.reduce((sum, s) => sum + s.totalFocusSeconds, 0);

  // This week's stats
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 });
  const weekSessions = sessions.filter(s => 
    isAfter(s.startedAt, weekStart) && isBefore(s.startedAt, weekEnd)
  );
  const weekFocusTime = weekSessions.reduce((sum, s) => sum + s.totalFocusSeconds, 0);

  // This month's stats
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const monthSessions = sessions.filter(s => 
    isAfter(s.startedAt, monthStart) && isBefore(s.startedAt, monthEnd)
  );
  const monthFocusTime = monthSessions.reduce((sum, s) => sum + s.totalFocusSeconds, 0);

  // Longest deep work streak
  const longestStreak = Math.max(...sessions.map(s => s.longestUninterruptedStreak), 0);

  // Completion rate
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  res.json({
    overview: {
      totalSessions,
      completedSessions,
      completionRate,
      totalFocusTime,
      totalDistractionTime,
      averageFocusScore,
      longestStreak,
      productivityRatio: calculateProductivityRatio(totalFocusTime, totalDistractionTime),
    },
    today: {
      sessions: todaySessions.length,
      focusTime: todayFocusTime,
      distractionTime: todaySessions.reduce((sum, s) => sum + s.totalDistractionSeconds, 0),
    },
    thisWeek: {
      sessions: weekSessions.length,
      focusTime: weekFocusTime,
      distractionTime: weekSessions.reduce((sum, s) => sum + s.totalDistractionSeconds, 0),
    },
    thisMonth: {
      sessions: monthSessions.length,
      focusTime: monthFocusTime,
      distractionTime: monthSessions.reduce((sum, s) => sum + s.totalDistractionSeconds, 0),
    },
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
      days,
    },
  });
}));

/**
 * Get focus time chart data
 */
router.get('/focus-time-chart', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { days = 30, groupBy = 'day' } = AnalyticsQuerySchema.parse(req.query);

  const { start, end } = getDateRange(days);

  // Get all activity events in date range
  const activityEvents = await prisma.activityEvent.findMany({
    where: {
      userId,
      startedAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      session: {
        select: {
          id: true,
          state: true,
        },
      },
    },
    orderBy: { startedAt: 'asc' },
  });

  // Group events by time period
  const groupedData = groupEventsByPeriod(activityEvents, groupBy, start, end);

  // Calculate focus vs distraction time for each period
  const chartData = Object.entries(groupedData).map(([period, events]) => {
    const focusEvents = events.filter(e => e.category === 'FOCUS');
    const distractionEvents = events.filter(e => e.category === 'DISTRACTION');
    
    const focusTime = focusEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
    const distractionTime = distractionEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
    
    return {
      period,
      focusTime,
      distractionTime,
      totalTime: focusTime + distractionTime,
      productivityRatio: calculateProductivityRatio(focusTime, distractionTime),
    };
  });

  res.json({
    data: chartData,
    groupBy,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });
}));

/**
 * Get distraction analysis
 */
router.get('/distraction-analysis', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { days = 30, limit = 10 } = AnalyticsQuerySchema.parse(req.query);

  const { start, end } = getDateRange(days);

  // Get all distraction events in date range
  const distractionEvents = await prisma.activityEvent.findMany({
    where: {
      userId,
      category: 'DISTRACTION',
      startedAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  // Get top distractions
  const topDistractions = getTopDistractions(distractionEvents, limit);

  // Calculate distraction patterns
  const totalDistractionTime = distractionEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
  const totalDistractions = distractionEvents.length;
  const averageDistractionTime = totalDistractions > 0 ? Math.round(totalDistractionTime / totalDistractions) : 0;

  // Group by hour of day
  const hourlyDistractions = Array.from({ length: 24 }, (_, hour) => {
    const hourEvents = distractionEvents.filter(e => {
      const eventHour = new Date(e.startedAt).getHours();
      return eventHour === hour;
    });
    
    return {
      hour,
      count: hourEvents.length,
      totalTime: hourEvents.reduce((sum, e) => sum + e.durationSeconds, 0),
    };
  });

  // Group by day of week
  const weeklyDistractions = Array.from({ length: 7 }, (_, dayIndex) => {
    const dayEvents = distractionEvents.filter(e => {
      const eventDay = new Date(e.startedAt).getDay();
      return eventDay === dayIndex;
    });
    
    return {
      day: dayIndex,
      dayName: format(new Date().setDay(dayIndex), 'EEEE'),
      count: dayEvents.length,
      totalTime: dayEvents.reduce((sum, e) => sum + e.durationSeconds, 0),
    };
  });

  res.json({
    summary: {
      totalDistractionTime,
      totalDistractions,
      averageDistractionTime,
    },
    topDistractions,
    patterns: {
      hourly: hourlyDistractions,
      weekly: weeklyDistractions,
    },
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });
}));

/**
 * Get session trends
 */
router.get('/session-trends', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { days = 30, groupBy = 'day' } = AnalyticsQuerySchema.parse(req.query);

  const { start, end } = getDateRange(days);

  // Get sessions in date range
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startedAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { startedAt: 'asc' },
  });

  // Group sessions by time period
  const groupedSessions = groupSessionsByPeriod(sessions, groupBy, start, end);

  // Calculate trends for each period
  const trendData = Object.entries(groupedSessions).map(([period, periodSessions]) => {
    const completedSessions = periodSessions.filter(s => s.state === 'COMPLETED');
    const totalFocusTime = periodSessions.reduce((sum, s) => sum + s.totalFocusSeconds, 0);
    const totalDistractionTime = periodSessions.reduce((sum, s) => sum + s.totalDistractionSeconds, 0);
    const averageFocusScore = periodSessions.length > 0 
      ? Math.round(periodSessions.reduce((sum, s) => sum + s.focusScore, 0) / periodSessions.length)
      : 0;
    const averageSessionDuration = periodSessions.length > 0
      ? Math.round(totalFocusTime / periodSessions.length)
      : 0;

    return {
      period,
      totalSessions: periodSessions.length,
      completedSessions: completedSessions.length,
      completionRate: periodSessions.length > 0 
        ? Math.round((completedSessions.length / periodSessions.length) * 100)
        : 0,
      totalFocusTime,
      totalDistractionTime,
      averageFocusScore,
      averageSessionDuration,
      productivityRatio: calculateProductivityRatio(totalFocusTime, totalDistractionTime),
    };
  });

  res.json({
    data: trendData,
    groupBy,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });
}));

/**
 * Get productivity heatmap data
 */
router.get('/productivity-heatmap', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { weeks = 12 } = AnalyticsQuerySchema.parse(req.query);

  const startDate = subDays(new Date(), weeks * 7);
  const endDate = new Date();

  // Get all sessions in the date range
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      activityEvents: true,
    },
  });

  // Generate heatmap data
  const heatmapData = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayStart = startOfDay(currentDate);
    const dayEnd = endOfDay(currentDate);
    
    const daySessions = sessions.filter(s => 
      isAfter(s.startedAt, dayStart) && isBefore(s.startedAt, dayEnd)
    );

    const totalFocusTime = daySessions.reduce((sum, s) => sum + s.totalFocusSeconds, 0);
    const totalDistractionTime = daySessions.reduce((sum, s) => sum + s.totalDistractionSeconds, 0);
    const productivityRatio = calculateProductivityRatio(totalFocusTime, totalDistractionTime);

    heatmapData.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      focusTime: totalFocusTime,
      distractionTime: totalDistractionTime,
      productivityRatio,
      sessions: daySessions.length,
      completedSessions: daySessions.filter(s => s.state === 'COMPLETED').length,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  res.json({
    data: heatmapData,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      weeks,
    },
  });
}));

/**
 * Helper function to group events by time period
 */
function groupEventsByPeriod(events: any[], groupBy: string, startDate: Date, endDate: Date): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  events.forEach(event => {
    const eventDate = new Date(event.startedAt);
    let periodKey: string;

    switch (groupBy) {
      case 'week':
        const weekStart = startOfWeek(eventDate, { weekStartsOn: 0 });
        periodKey = format(weekStart, 'yyyy-MM-dd');
        break;
      case 'month':
        periodKey = format(eventDate, 'yyyy-MM');
        break;
      default: // day
        periodKey = format(eventDate, 'yyyy-MM-dd');
        break;
    }

    if (!grouped[periodKey]) {
      grouped[periodKey] = [];
    }
    grouped[periodKey].push(event);
  });

  return grouped;
}

/**
 * Helper function to group sessions by time period
 */
function groupSessionsByPeriod(sessions: any[], groupBy: string, startDate: Date, endDate: Date): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  sessions.forEach(session => {
    const sessionDate = new Date(session.startedAt);
    let periodKey: string;

    switch (groupBy) {
      case 'week':
        const weekStart = startOfWeek(sessionDate, { weekStartsOn: 0 });
        periodKey = format(weekStart, 'yyyy-MM-dd');
        break;
      case 'month':
        periodKey = format(sessionDate, 'yyyy-MM');
        break;
      default: // day
        periodKey = format(sessionDate, 'yyyy-MM-dd');
        break;
    }

    if (!grouped[periodKey]) {
      grouped[periodKey] = [];
    }
    grouped[periodKey].push(session);
  });

  return grouped;
}

export default router;
