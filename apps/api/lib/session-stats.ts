import { prisma } from './prisma';

/**
 * Recalculate session totals from activity events.
 * Ensures stats are always consistent with underlying events.
 */
export async function recalculateSessionStats(sessionId: string) {
  const events = await prisma.activityEvent.findMany({
    where: { sessionId },
    select: {
      category: true,
      durationSeconds: true,
    },
  });

  let totalFocusSeconds = 0;
  let totalDistractionSeconds = 0;
  let interruptionCount = 0;

  for (const event of events) {
    if (event.category === 'focus') {
      totalFocusSeconds += event.durationSeconds;
    } else {
      totalDistractionSeconds += event.durationSeconds;
      interruptionCount += 1;
    }
  }

  return {
    totalFocusSeconds,
    totalDistractionSeconds,
    interruptionCount,
  };
}

/**
 * Update session totals based on activity events.
 */
export async function updateSessionTotals(sessionId: string) {
  const stats = await recalculateSessionStats(sessionId);

  return prisma.session.update({
    where: { id: sessionId },
    data: stats,
  });
}
