import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/settings/blocked-domains - Get all blocked domains
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const blockedDomains = await prisma.blockedDomain.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(blockedDomains);
}

// POST /api/settings/blocked-domains - Add a blocked domain
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { domain } = body;

  if (!domain) {
    return NextResponse.json(
      { error: 'Domain is required' },
      { status: 400 }
    );
  }

  try {
    const blockedDomain = await prisma.blockedDomain.create({
      data: {
        userId: user.id,
        domain: domain.toLowerCase(),
      },
    });

    return NextResponse.json(blockedDomain);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Domain already blocked' },
        { status: 409 }
      );
    }
    throw error;
  }
}
