const http = require('http');
const url = require('url');
const fs = require('fs');

// Simple mock database
const mockData = {
  user: {
    id: 'demo-user',
    email: 'demo@focusos.local',
    apiKey: '02313202e4207fed50089c8e7d99be82c85f3f8f2cc42e9b9d9ebe8b9fca6f3c'
  },
  sessions: [
    {
      id: 'session-1',
      userId: 'demo-user',
      title: 'Focus Session - Today',
      startedAt: new Date().toISOString(),
      state: 'ACTIVE',
      focusScore: 85,
      totalFocusSeconds: 1800
    }
  ],
  insights: [
    {
      id: 'insight-1',
      type: 'productivity_trend',
      title: 'Productivity Improving!',
      description: 'Your focus score has improved by 8 points this week.',
      isRead: false
    }
  ]
};

// Simple API server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`${method} ${path}`);

  try {
    if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    if (path === '/api/sessions/active') {
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== mockData.user.apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid API key' }));
        return;
      }
      
      const activeSession = mockData.sessions.find(s => s.state === 'ACTIVE');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ session: activeSession || null }));
      return;
    }

    if (path === '/api/insights') {
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== mockData.user.apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid API key' }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        insights: mockData.insights,
        unreadCount: mockData.insights.filter(i => !i.isRead).length
      }));
      return;
    }

    if (path === '/api/sessions' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== mockData.user.apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid API key' }));
        return;
      }
      
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const sessionData = JSON.parse(body);
        const newSession = {
          id: 'session-' + Date.now(),
          userId: 'demo-user',
          ...sessionData,
          startedAt: new Date().toISOString(),
          state: 'ACTIVE'
        };
        mockData.sessions.push(newSession);
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ session: newSession }));
      });
      return;
    }

    // Default response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));

  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n=== Focus OS API Server ===`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Key: 02313202e4207fed50089c8e7d99be82c85f3f8f2cc42e9b9d9ebe8b9fca6f3c`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log(`========================\n`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down');
  server.close();
});
