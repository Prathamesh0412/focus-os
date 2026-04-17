import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/focus-domains - Get user's focus domains
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // For now, return default focus domains
  const focusDomains = [
    'github.com',
    'stackoverflow.com',
    'developer.mozilla.org',
    'docs.google.com',
    'notion.so',
    'linear.app',
    'jira.atlassian.com',
    'figma.com',
    'code.visualstudio.com',
    'vscode.dev',
    'localhost',
  ];

  return NextResponse.json({ domains: focusDomains });
}

// POST /api/focus-domains - Add custom focus domain
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { domain } = await request.json();
  if (!domain) {
    return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
  }

  // For now, just return success (we'd store this in a separate table in production)
  return NextResponse.json({ success: true, domain });
}
