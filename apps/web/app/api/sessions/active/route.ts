import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/sessions/active - Get currently active session
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeSession = await prisma.session.findFirst({
    where: {
      userId: user.id,
      state: 'active',
    },
    include: {
      activityEvents: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!activeSession) {
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({ session: activeSession });
}
