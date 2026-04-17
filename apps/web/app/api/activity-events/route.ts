import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { normalizeDomain, isDomainBlocked } from '@/lib/domains';
import { classifyDomain } from '@/lib/classification';

// POST /api/activity-events - Record activity event from extension
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, domain, startedAt, endedAt, durationSeconds } = body;

  // Validate required fields
  if (!sessionId || !domain || !startedAt || !endedAt || !durationSeconds) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // Verify session exists, is active, and belongs to user
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
      state: 'active',
    },
  });

  if (!session) {
    return NextResponse.json(
      { error: 'No active session found' },
      { status: 400 }
    );
  }

  // Get blocked domains for this user
  const blockedDomains = await prisma.blockedDomain.findMany({
    where: { userId: user.id },
    select: { domain: true },
  });

  const blockedDomainList = blockedDomains.map(b => b.domain);

  // Classify event as focus or distraction using smart classification
  const category = classifyDomain(domain, blockedDomainList);

  // Create activity event
  const event = await prisma.activityEvent.create({
    data: {
      sessionId,
      userId: user.id,
      domain: normalizeDomain(domain),
      startedAt: new Date(startedAt),
      endedAt: new Date(endedAt),
      durationSeconds,
      category,
      source: 'chrome_extension',
    },
  });

  // Update session totals
  const stats = await prisma.activityEvent.groupBy({
    by: ['category'],
    where: { sessionId },
    _sum: { durationSeconds: true },
  });

  const focusSeconds =
    stats.find(s => s.category === 'focus')?._sum.durationSeconds || 0;
  const distractionSeconds =
    stats.find(s => s.category === 'distraction')?._sum.durationSeconds || 0;

  const interruptionCount = await prisma.activityEvent.count({
    where: { sessionId, category: 'distraction' },
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      totalFocusSeconds: focusSeconds,
      totalDistractionSeconds: distractionSeconds,
      interruptionCount,
    },
  });

  return NextResponse.json({
    event,
    category,
    sessionStats: {
      totalFocusSeconds: focusSeconds,
      totalDistractionSeconds: distractionSeconds,
      interruptionCount,
    },
  });
}

// GET /api/activity-events - Get recent events for active session
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeSession = await prisma.session.findFirst({
    where: { userId: user.id, state: 'active' },
  });

  if (!activeSession) {
    return NextResponse.json({ events: [] });
  }

  const events = await prisma.activityEvent.findMany({
    where: { sessionId: activeSession.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ events });
}
