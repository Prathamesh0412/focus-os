# Focus OS

A full-stack focus tracking application with Chrome extension integration.

## Architecture Summary

**System Components:**
- **Next.js 14 App Router** - Web dashboard and REST API
- **PostgreSQL** (Supabase/Neon) - Database storage
- **Prisma ORM** - Type-safe database queries
- **Chrome Extension (MV3)** - Tracks active tab changes and sends events

**Data Flow:**
1. User starts session via dashboard → `POST /api/sessions`
2. Extension polls `/api/sessions/active` every 15s to detect active session
3. On tab/domain change, extension sends `POST /api/activity-events` with duration
4. Backend classifies event (focus/distraction) based on blocked domains
5. Dashboard polls for live stats updates

**Auth Strategy:**
- Prototype-friendly API key authentication
- Single demo user seeded in database
- Extension stores API key in Chrome storage
- All API requests include `X-API-Key` header

---

## Database Design

### Tables

**users**
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| email | String | User email (unique) |
| apiKey | String | API key for auth (unique) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**sessions**
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | Foreign key to users |
| startedAt | DateTime | Session start time |
| endedAt | DateTime? | Session end time |
| expectedDurationMinutes | Int? | Target duration |
| state | Enum | active/completed/cancelled |
| totalFocusSeconds | Int | Accumulated focus time |
| totalDistractionSeconds | Int | Accumulated distraction time |
| interruptionCount | Int | Number of distractions |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**activity_events**
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| sessionId | String | Foreign key to sessions |
| userId | String | Foreign key to users |
| domain | String | Website domain |
| startedAt | DateTime | Event start time |
| endedAt | DateTime | Event end time |
| durationSeconds | Int | Time spent on domain |
| category | Enum | focus/distraction |
| source | Enum | chrome_extension |
| createdAt | DateTime | Creation timestamp |

**blocked_domains**
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | Foreign key to users |
| domain | String | Blocked domain |
| createdAt | DateTime | Creation timestamp |

### Relationships
- User → Sessions (1:N)
- User → ActivityEvents (1:N)
- User → BlockedDomains (1:N)
- Session → ActivityEvents (1:N)

---

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# PostgreSQL connection string (Supabase or Neon)
DATABASE_URL="postgresql://user:password@host:5432/focusos?schema=public"

# Your app's public URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# API key for extension authentication
FOCUS_OS_API_KEY="your-secure-api-key-here"

# Demo user email
DEMO_USER_EMAIL="demo@focusos.local"
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string from Supabase/Neon |
| `NEXT_PUBLIC_APP_URL` | Base URL for the web app (used by extension) |
| `FOCUS_OS_API_KEY` | Secret key for API authentication |
| `DEMO_USER_EMAIL` | Email for the seeded demo user |

---

## Full Project Structure

```
focus-os/
├── app/
│   ├── page.tsx                    # Home page
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   ├── dashboard/
│   │   └── page.tsx                # Dashboard with live session
│   ├── sessions/
│   │   └── page.tsx                # Past sessions list
│   ├── settings/
│   │   └── page.tsx                # Settings page
│   └── api/
│       ├── sessions/
│       │   ├── route.ts            # POST /api/sessions, GET /api/sessions
│       │   ├── active/
│       │   │   └── route.ts        # GET /api/sessions/active
│       │   └── [id]/
│       │       └── stop/
│       │           └── route.ts    # PATCH /api/sessions/[id]/stop
│       ├── activity-events/
│       │   └── route.ts            # POST /api/activity-events, GET /api/activity-events
│       └── settings/
│           └── blocked-domains/
│               ├── route.ts        # GET/POST /api/settings/blocked-domains
│               └── [id]/
│                   └── route.ts    # DELETE /api/settings/blocked-domains/[id]
├── components/
│   ├── SessionTimer.tsx            # Live session timer
│   ├── StatsCards.tsx              # Focus/distraction stats
│   ├── StartStopButton.tsx         # Start/stop session button
│   ├── SessionsChart.tsx           # Session history chart
│   ├── RecentEvents.tsx            # Recent activity list
│   └── BlockedDomainsForm.tsx      # Add/remove blocked domains
├── lib/
│   ├── prisma.ts                   # Prisma client singleton
│   ├── auth.ts                     # API key validation
│   ├── domains.ts                  # Domain extraction utilities
│   └── session-stats.ts            # Session stats recalculation
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── seed.ts                     # Database seeding
├── extension/
│   ├── manifest.json               # Extension manifest (MV3)
│   ├── background.js               # Background service worker
│   ├── options.html                # Settings page
│   ├── options.js                  # Settings logic
│   ├── popup.html                  # Extension popup
│   └── popup.js                    # Popup logic
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
├── .env.example
└── README.md
```

---

## API Reference

### Sessions

#### `POST /api/sessions` - Start Session
**Request:**
```json
{}
```

**Response (201):**
```json
{
  "id": "session_id",
  "userId": "user_id",
  "startedAt": "2024-01-01T12:00:00.000Z",
  "state": "active",
  "totalFocusSeconds": 0,
  "totalDistractionSeconds": 0,
  "interruptionCount": 0
}
```

#### `GET /api/sessions` - List Sessions
**Response (200):**
```json
[
  {
    "id": "session_id",
    "startedAt": "2024-01-01T12:00:00.000Z",
    "endedAt": "2024-01-01T13:00:00.000Z",
    "state": "completed",
    "totalFocusSeconds": 2400,
    "totalDistractionSeconds": 300,
    "interruptionCount": 2
  }
]
```

#### `GET /api/sessions/active` - Get Active Session
**Response (200):**
```json
{
  "session": {
    "id": "session_id",
    "startedAt": "2024-01-01T12:00:00.000Z",
    "state": "active",
    "totalFocusSeconds": 600,
    "totalDistractionSeconds": 60,
    "interruptionCount": 1,
    "activityEvents": [...]
  }
}
```

#### `PATCH /api/sessions/[id]/stop` - Stop Session
**Response (200):**
```json
{
  "id": "session_id",
  "state": "completed",
  "endedAt": "2024-01-01T13:00:00.000Z",
  "totalFocusSeconds": 2400,
  "totalDistractionSeconds": 300,
  "interruptionCount": 2
}
```

### Activity Events

#### `POST /api/activity-events` - Record Event
**Request:**
```json
{
  "sessionId": "session_id",
  "domain": "youtube.com",
  "startedAt": "2024-01-01T12:00:00.000Z",
  "endedAt": "2024-01-01T12:05:00.000Z",
  "durationSeconds": 300
}
```

**Response (200):**
```json
{
  "event": { ... },
  "category": "distraction",
  "sessionStats": {
    "totalFocusSeconds": 600,
    "totalDistractionSeconds": 360,
    "interruptionCount": 2
  }
}
```

### Blocked Domains

#### `GET /api/settings/blocked-domains` - List Domains
**Response (200):**
```json
[
  {
    "id": "domain_id",
    "domain": "youtube.com",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### `POST /api/settings/blocked-domains` - Add Domain
**Request:**
```json
{
  "domain": "tiktok.com"
}
```

**Response (201):**
```json
{
  "id": "new_id",
  "domain": "tiktok.com",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### `DELETE /api/settings/blocked-domains/[id]` - Remove Domain
**Response (200):**
```json
{
  "success": true
}
```

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase or Neon recommended)
- Chrome browser

### Step 1: Install Dependencies
```bash
cd focus-os
npm install
```

### Step 2: Set Up Environment
```bash
cp .env.example .env
```

Edit `.env` with your database credentials:
```bash
DATABASE_URL="postgresql://user:password@host:5432/focusos?schema=public"
FOCUS_OS_API_KEY="generate-a-secure-key-here"
```

Generate a secure API key:
```bash
# macOS/Linux
openssl rand -hex 32

# Or use any random string generator
```

### Step 3: Set Up Database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Or run migrations (production)
npm run db:migrate

# Seed demo user and default blocked domains
npm run db:seed
```

### Step 4: Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to verify the app is running.

### Step 5: Load Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `focus-os/extension` folder
5. The extension icon should appear in your toolbar

### Step 6: Configure Extension

1. Right-click the extension icon → "Options"
2. Set **API Base URL** to `http://localhost:3000`
3. Set **API Key** to the value from your `.env` file
4. Click "Save Settings"
5. Click "Test Connection" to verify

### Step 7: Test the Flow

1. Open the dashboard at `http://localhost:3000/dashboard`
2. Click "Start Session"
3. The extension badge should show "ON"
4. Navigate to different websites
5. Watch the dashboard update with activity events

---

## Deployment on Vercel

### Step 1: Push to Git
```bash
git init
git add .
git commit -m "Initial Focus OS commit"
git branch -M main
git remote add origin your-repo-url
git push -u origin main
```

### Step 2: Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and create a new project
2. Import your Git repository
3. Configure the following environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `FOCUS_OS_API_KEY` | Your secure API key |
| `DEMO_USER_EMAIL` | `demo@focusos.local` |

### Step 3: Deploy
```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy
vercel
```

### Step 4: Run Database Migrations

After deployment, run migrations on the production database:

```bash
# In Vercel project settings → Deployments
# Or use Vercel CLI with production environment
vercel env pull production
npx prisma migrate deploy
```

### Step 5: Update Extension for Production

1. Note your production URL (e.g., `https://focus-os.vercel.app`)
2. In extension options:
   - Set **API Base URL** to your production URL
   - Keep the same API key
3. For production distribution, update `manifest.json`:
   ```json
   "host_permissions": [
     "https://focus-os.vercel.app/*"
   ]
   ```

### CORS Notes

The Next.js app includes CORS headers in `next.config.js` to allow extension requests. For production, you may want to restrict the allowed origins:

```javascript
headers: [
  {
    source: '/api/:path*',
    headers: [
      { key: 'Access-Control-Allow-Origin', value: 'chrome-extension://YOUR_EXTENSION_ID' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-API-Key' },
    ],
  },
]
```

---

## Testing Plan

### Manual Test Checklist

#### 1. Session Management
- [ ] Start a new session from dashboard
- [ ] Verify session appears in database with state="active"
- [ ] Verify extension badge changes to "ON"
- [ ] Stop the session
- [ ] Verify session state changes to "completed"
- [ ] Verify `endedAt` timestamp is set

#### 2. Activity Tracking
- [ ] With active session, navigate to a non-blocked site (e.g., github.com)
- [ ] Wait 10+ seconds, then navigate to another site
- [ ] Check network tab for POST to `/api/activity-events`
- [ ] Verify event created with category="focus"
- [ ] Navigate to a blocked site (e.g., youtube.com)
- [ ] Verify event created with category="distraction"
- [ ] Verify session `interruptionCount` incremented

#### 3. Dashboard Live Updates
- [ ] Start session
- [ ] Verify timer counts up correctly
- [ ] Navigate to sites and verify stats update
- [ ] Verify focus time matches expected duration
- [ ] Verify distraction time matches expected duration
- [ ] Verify interruptions count matches distraction events

#### 4. Blocked Domains
- [ ] Add a new blocked domain in settings
- [ ] Verify it appears in the list
- [ ] Navigate to the newly blocked domain
- [ ] Verify it's counted as distraction
- [ ] Remove the domain
- [ ] Navigate to it again
- [ ] Verify it's now counted as focus

#### 5. Database Verification
```sql
-- Check sessions
SELECT * FROM "Session" ORDER BY "createdAt" DESC LIMIT 5;

-- Check activity events
SELECT "domain", "category", "durationSeconds", "createdAt"
FROM "ActivityEvent"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check blocked domains
SELECT * FROM "BlockedDomain";
```

#### 6. Extension Configuration
- [ ] Change API URL in extension options
- [ ] Click "Test Connection" - should succeed
- [ ] Enter invalid API key
- [ ] Click "Test Connection" - should fail with 401
- [ ] Restore correct settings

---

## Example Data Flow

### Scenario: User Focus Session

**Timeline:**
- **2:00 PM** - User starts session on dashboard
- **2:00-2:10 PM** - Working on `docs.google.com` (10 min)
- **2:10-2:12 PM** - Distracted by `youtube.com` (2 min)
- **2:12-2:32 PM** - Back to work on `github.com` (20 min)
- **2:32 PM** - User stops session

**Events Sent by Extension:**

1. At 2:10 PM (tab switch from docs.google.com):
```json
POST /api/activity-events
{
  "sessionId": "session_abc123",
  "domain": "google.com",
  "startedAt": "2024-01-01T14:00:00Z",
  "endedAt": "2024-01-01T14:10:00Z",
  "durationSeconds": 600
}
```
Response: `{ "category": "focus", ... }`

2. At 2:12 PM (tab switch from youtube.com):
```json
{
  "sessionId": "session_abc123",
  "domain": "youtube.com",
  "startedAt": "2024-01-01T14:10:00Z",
  "endedAt": "2024-01-01T14:12:00Z",
  "durationSeconds": 120
}
```
Response: `{ "category": "distraction", ... }`

3. At 2:32 PM (session stop or tab switch):
```json
{
  "sessionId": "session_abc123",
  "domain": "github.com",
  "startedAt": "2024-01-01T14:12:00Z",
  "endedAt": "2024-01-01T14:32:00Z",
  "durationSeconds": 1200
}
```
Response: `{ "category": "focus", ... }`

**Final Session Stats:**
- Focus Time: 600 + 1200 = 1800 seconds (30 minutes)
- Distraction Time: 120 seconds (2 minutes)
- Interruptions: 1

**Database State:**
```sql
-- Session record
id: session_abc123
state: completed
totalFocusSeconds: 1800
totalDistractionSeconds: 120
interruptionCount: 1

-- Activity events (3 rows)
google.com   | focus      | 600
youtube.com  | distraction| 120
github.com   | focus      | 1200
```

---

## Troubleshooting

### Extension Not Tracking
1. Check extension options - API key must be set
2. Check browser console for errors
3. Verify session is active in dashboard
4. Try reloading extension (`chrome://extensions/` → Reload)

### API Errors
1. Check `.env` file has correct `DATABASE_URL`
2. Verify database is accessible
3. Check API key matches seeded user
4. Review Next.js server logs

### Database Connection Issues
```bash
# Test connection
npx prisma db pull

# Regenerate client
npm run db:generate

# Check migrations
npx prisma migrate status
```

### CORS Errors in Extension
- Ensure `next.config.js` has CORS headers
- For local dev, `http://localhost:3000` must be in `host_permissions`
- Restart Next.js server after config changes

---

## License

MIT
