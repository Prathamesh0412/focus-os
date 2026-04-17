import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { subDays, addHours, addMinutes } from 'date-fns';

const prisma = new PrismaClient();

const DEMO_API_KEY = process.env.FOCUS_OS_API_KEY || '02313202e4207fed50089c8e7d99be82c85f3f8f2cc42e9b9d9ebe8b9fca6f3c';
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@focusos.local';

// Realistic productive domains
const PRODUCTIVE_DOMAINS = [
  { domain: 'github.com', category: 'development' },
  { domain: 'gitlab.com', category: 'development' },
  { domain: 'stackoverflow.com', category: 'development' },
  { domain: 'notion.so', category: 'productivity' },
  { domain: 'linear.app', category: 'productivity' },
  { domain: 'figma.com', category: 'design' },
  { domain: 'docs.google.com', category: 'productivity' },
  { domain: 'sheets.google.com', category: 'productivity' },
  { domain: 'slides.google.com', category: 'productivity' },
  { domain: 'calendar.google.com', category: 'productivity' },
  { domain: 'mail.google.com', category: 'communication' },
  { domain: 'outlook.com', category: 'communication' },
  { domain: 'slack.com', category: 'communication' },
  { domain: 'microsoft.com', category: 'productivity' },
  { domain: 'office.com', category: 'productivity' },
  { domain: 'monday.com', category: 'productivity' },
  { domain: 'asana.com', category: 'productivity' },
  { domain: 'trello.com', category: 'productivity' },
  { domain: 'jira.com', category: 'productivity' },
  { domain: 'confluence.com', category: 'productivity' },
  { domain: 'atlassian.com', category: 'productivity' },
  { domain: 'vscode.dev', category: 'development' },
  { domain: 'codepen.io', category: 'development' },
  { domain: 'vercel.com', category: 'development' },
];

// Realistic distracting domains
const DISTRACTING_DOMAINS = [
  { domain: 'youtube.com', reason: 'Video entertainment' },
  { domain: 'facebook.com', reason: 'Social media' },
  { domain: 'twitter.com', reason: 'Social media' },
  { domain: 'instagram.com', reason: 'Social media' },
  { domain: 'tiktok.com', reason: 'Short video entertainment' },
  { domain: 'reddit.com', reason: 'Social news' },
  { domain: 'netflix.com', reason: 'Video streaming' },
  { domain: 'twitch.tv', reason: 'Live streaming' },
  { domain: 'discord.com', reason: 'Chat/Community' },
  { domain: 'whatsapp.com', reason: 'Messaging' },
  { domain: 'amazon.com', reason: 'Shopping' },
  { domain: 'ebay.com', reason: 'Shopping' },
  { domain: 'pinterest.com', reason: 'Social discovery' },
  { domain: 'linkedin.com', reason: 'Professional social media' },
  { domain: 'news.ycombinator.com', reason: 'News' },
  { domain: 'cnn.com', reason: 'News' },
  { domain: 'bbc.com', reason: 'News' },
  { domain: 'espn.com', reason: 'Sports' },
  { domain: 'gaming.com', reason: 'Gaming' },
  { domain: 'steam.com', reason: 'Gaming' },
  { domain: 'x.com', reason: 'Social media' },
  { domain: 'threads.net', reason: 'Social media' },
  { domain: 'telegram.org', reason: 'Messaging' },
  { domain: 'snapchat.com', reason: 'Social media' },
];

// Session templates for realistic data
const SESSION_TEMPLATES = [
  { duration: 25, focusScore: 85, completionRate: 0.9, distractions: 1 },
  { duration: 50, focusScore: 75, completionRate: 0.8, distractions: 2 },
  { duration: 90, focusScore: 65, completionRate: 0.7, distractions: 3 },
  { duration: 120, focusScore: 55, completionRate: 0.6, distractions: 4 },
];

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateSessionEvents(sessionId: string, userId: string, startTime: Date, duration: number, expectedDistractions: number) {
  const events = [];
  let currentTime = new Date(startTime);
  const endTime = addMinutes(currentTime, duration);
  
  // Start with a productive domain
  let currentDomain = randomChoice(PRODUCTIVE_DOMAINS).domain;
  let eventStart = new Date(currentTime);
  
  while (currentTime < endTime) {
    // Random event duration between 30 seconds and 15 minutes
    const eventDuration = randomInt(30, 900);
    const eventEnd = addMinutes(eventStart, eventDuration);
    
    // Don't go past session end
    if (eventEnd > endTime) {
      events.push({
        sessionId,
        userId,
        domain: currentDomain,
        startedAt: eventStart,
        endedAt: endTime,
        durationSeconds: Math.floor((endTime.getTime() - eventStart.getTime()) / 1000),
        category: PRODUCTIVE_DOMAINS.some(p => p.domain === currentDomain) ? 'FOCUS' : 'DISTRACTION',
        source: 'CHROME_EXTENSION',
      });
      break;
    }
    
    // Determine if this is a distraction event
    const isDistraction = Math.random() < 0.3 && events.filter(e => e.category === 'DISTRACTION').length < expectedDistractions;
    
    if (isDistraction) {
      currentDomain = randomChoice(DISTRACTING_DOMAINS).domain;
    } else {
      currentDomain = randomChoice(PRODUCTIVE_DOMAINS).domain;
    }
    
    events.push({
      sessionId,
      userId,
      domain: currentDomain,
      startedAt: eventStart,
      endedAt: eventEnd,
      durationSeconds: eventDuration,
      category: PRODUCTIVE_DOMAINS.some(p => p.domain === currentDomain) ? 'FOCUS' : 'DISTRACTION',
      source: 'CHROME_EXTENSION',
    });
    
    eventStart = new Date(eventEnd);
    currentTime = eventEnd;
  }
  
  return events;
}

async function main() {
  console.log('Seeding database with realistic data...');

  // Clean existing data
  await prisma.activityEvent.deleteMany();
  await prisma.sessionNote.deleteMany();
  await prisma.insight.deleteMany();
  await prisma.allowedDomain.deleteMany();
  await prisma.blockedDomain.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Create demo user with settings
  const demoUser = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      apiKey: DEMO_API_KEY,
      isActive: true,
      onboardingCompleted: true,
      userSettings: {
        create: {
          defaultSessionMinutes: 50,
          distractionTimeoutMinutes: 2,
          gracePeriodSeconds: 30,
          autoCloseEnabled: false,
          warningEnabled: true,
          ignorePinnedTabs: true,
          trackNewTabs: true,
          syncEnabled: true,
          emailNotifications: true,
          pushNotifications: false,
          weeklyReports: true,
          theme: 'light',
          language: 'en',
        },
      },
    },
  });

  console.log(`Demo user created: ${demoUser.email}`);
  console.log(`API Key: ${demoUser.apiKey}`);

  // Seed productive domains
  for (const { domain, category } of PRODUCTIVE_DOMAINS) {
    await prisma.allowedDomain.create({
      data: {
        userId: demoUser.id,
        domain,
        category,
      },
    });
  }

  // Seed distracting domains
  for (const { domain, reason } of DISTRACTING_DOMAINS) {
    await prisma.blockedDomain.create({
      data: {
        userId: demoUser.id,
        domain,
        reason,
      },
    });
  }

  console.log('Domain lists seeded.');

  // Generate 30 days of realistic session history
  const sessions = [];
  const events = [];
  
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const date = subDays(new Date(), daysAgo);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    // Fewer sessions on weekends
    const sessionsToday = isWeekend ? randomInt(0, 2) : randomInt(1, 4);
    
    for (let i = 0; i < sessionsToday; i++) {
      const template = randomChoice(SESSION_TEMPLATES);
      const startHour = randomInt(8, 18); // Work hours
      const startMinute = randomInt(0, 59);
      
      const startTime = new Date(date);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      // Random completion based on template
      const isCompleted = Math.random() < template.completionRate;
      const actualDuration = isCompleted ? template.duration : Math.floor(template.duration * randomFloat(0.3, 0.9));
      
      const session = {
        userId: demoUser.id,
        title: `Focus Session - ${formatDate(startTime)}`,
        expectedDurationMinutes: template.duration,
        actualDurationSeconds: actualDuration * 60,
        startedAt: startTime,
        endedAt: isCompleted ? addMinutes(startTime, actualDuration) : null,
        state: isCompleted ? 'COMPLETED' : 'CANCELLED',
        totalFocusSeconds: 0, // Will be calculated
        totalDistractionSeconds: 0, // Will be calculated
        totalNeutralSeconds: 0,
        interruptionCount: 0, // Will be calculated
        longestUninterruptedStreak: randomInt(300, 1800), // 5-30 minutes
        focusScore: template.focusScore + randomInt(-10, 10),
        maxFocusLevel: randomChoice(['HIGH', 'MEDIUM', 'LOW']),
        recoveryTimeSeconds: randomInt(60, 300),
        forcedCloseCount: 0,
        warningCount: randomInt(0, template.distractions),
        tabSwitchCount: randomInt(5, 25),
        uniqueDomainsVisited: randomInt(3, 8),
        deviceInfo: {
          platform: 'Chrome Extension',
          version: '1.0.0',
        },
      };
      
      sessions.push(session);
    }
  }
  
  // Create sessions
  const createdSessions = [];
  for (const sessionData of sessions) {
    const session = await prisma.session.create({
      data: sessionData,
    });
    createdSessions.push(session);
  }
  
  // Generate activity events for each session
  for (const session of createdSessions) {
    if (session.state === 'COMPLETED') {
      const sessionEvents = generateSessionEvents(
        session.id,
        session.userId,
        session.startedAt,
        session.actualDurationSeconds! / 60,
        Math.floor(session.interruptionCount)
      );
      
      for (const eventData of sessionEvents) {
        await prisma.activityEvent.create({
          data: eventData,
        });
      }
    }
  }
  
  // Recalculate session statistics based on events
  for (const session of createdSessions) {
    const events = await prisma.activityEvent.findMany({
      where: { sessionId: session.id },
    });
    
    const focusEvents = events.filter(e => e.category === 'FOCUS');
    const distractionEvents = events.filter(e => e.category === 'DISTRACTION');
    
    const totalFocusSeconds = focusEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
    const totalDistractionSeconds = distractionEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
    const interruptionCount = distractionEvents.length;
    
    await prisma.session.update({
      where: { id: session.id },
      data: {
        totalFocusSeconds,
        totalDistractionSeconds,
        interruptionCount,
      },
    });
  }
  
  // Generate some insights
  const insights = [
    {
      userId: demoUser.id,
      type: 'productivity_trend',
      title: 'Productivity Improving!',
      description: 'Your focus score has improved by 8 points this week compared to last week. Keep up the great work!',
      data: { recentAvgScore: 78, previousAvgScore: 70, improvement: 8 },
    },
    {
      userId: demoUser.id,
      type: 'distraction_pattern',
      title: 'Top Distraction Identified',
      description: 'youtube.com accounts for 35% of your distractions this month. Consider adding it to your blocked domains.',
      data: { domain: 'youtube.com', count: 12, percentage: 35, totalDistractions: 34 },
    },
    {
      userId: demoUser.id,
      type: 'optimal_time',
      title: 'Best Focus Time Found',
      description: 'Your focus performance is highest at 9:00. Consider scheduling important work during this time.',
      data: { bestHour: 9, bestHourScore: 82, overallAvgScore: 71, improvement: 11 },
    },
    {
      userId: demoUser.id,
      type: 'session_duration',
      title: 'Optimal Session Length',
      description: 'You perform best with medium sessions (30-60 minutes). Your completion rate is 85% with these sessions.',
      data: { bestDuration: 'medium', completionRate: 85, avgScore: 76, totalSessions: 12 },
    },
  ];
  
  for (const insightData of insights) {
    await prisma.insight.create({
      data: insightData,
    });
  }

  console.log(`Created ${sessions.length} sessions with realistic activity events`);
  console.log('Blocked domains seeded.');
  console.log('Allowed domains seeded.');
  console.log('Insights generated.');
  console.log('Seeding complete!');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
