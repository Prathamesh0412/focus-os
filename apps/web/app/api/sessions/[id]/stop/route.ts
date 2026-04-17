import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { updateSessionTotals } from '@/lib/session-stats';

// PATCH /api/sessions/[id]/stop - Stop an active session
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = params.id;

  // Verify session belongs to user and is active
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.state !== 'active') {
    return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
  }

  // Recalculate totals from events
  await updateSessionTotals(sessionId);

  // Mark session as completed
  const updatedSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      state: 'completed',
      endedAt: new Date(),
    },
  });

  return NextResponse.json(updatedSession);
}
