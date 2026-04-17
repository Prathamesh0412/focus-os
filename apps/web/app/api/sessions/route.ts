import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/sessions - Start a new session
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { expectedDurationMinutes } = body;

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expectedDurationMinutes: expectedDurationMinutes || null,
      state: 'active',
    },
  });

  return NextResponse.json(session);
}

// GET /api/sessions - List all sessions for user
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(sessions);
}
