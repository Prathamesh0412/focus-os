import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// DELETE /api/settings/blocked-domains/[id] - Remove a blocked domain
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const blockedDomainId = params.id;

  const blockedDomain = await prisma.blockedDomain.findFirst({
    where: {
      id: blockedDomainId,
      userId: user.id,
    },
  });

  if (!blockedDomain) {
    return NextResponse.json(
      { error: 'Blocked domain not found' },
      { status: 404 }
    );
  }

  await prisma.blockedDomain.delete({
    where: { id: blockedDomainId },
  });

  return NextResponse.json({ success: true });
}
