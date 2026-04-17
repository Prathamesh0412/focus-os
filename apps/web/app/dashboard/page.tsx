'use client';

import { useState, useEffect } from 'react';
import SessionTimer from '@/components/SessionTimer';
import StatsCards from '@/components/StatsCards';
import StartStopButton from '@/components/StartStopButton';
import RecentEvents from '@/components/RecentEvents';

interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  state: 'active' | 'completed' | 'cancelled';
  totalFocusSeconds: number;
  totalDistractionSeconds: number;
  interruptionCount: number;
  activityEvents: ActivityEvent[];
}

interface ActivityEvent {
  id: string;
  domain: string;
  durationSeconds: number;
  category: 'focus' | 'distraction';
  createdAt: string;
}

export default function Dashboard() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveSession = async () => {
    try {
      const apiKey = localStorage.getItem('focusos_api_key');
      const res = await fetch('/api/sessions/active', {
        headers: { 'X-API-Key': apiKey || '' },
      });
      
      if (res.status === 401) {
        setError('Unauthorized: Please set your API key');
        return;
      }
      
      const data = await res.json();
      setActiveSession(data.session);
      
      // Also fetch recent activity events
      if (data.session) {
        const eventsRes = await fetch('/api/activity-events', {
          headers: { 'X-API-Key': apiKey || '' },
        });
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setActiveSession(prev => prev ? {...prev, activityEvents: eventsData.events} : null);
        }
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSession();
    const interval = setInterval(fetchActiveSession, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSessionChange = () => {
    fetchActiveSession();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            {activeSession ? 'Focus session in progress' : 'No active session'}
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            {error.includes('Unauthorized') && (
              <button
                onClick={() => {
                  localStorage.setItem('focusos_api_key', '02313202e4207fed50089c8e7d99be82c85f3f8f2cc42e9b9d9ebe8b9fca6f3c');
                  setError(null);
                  fetchActiveSession();
                }}
                className="ml-4 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Set API Key
              </button>
            )}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-6">
          {/* Timer and Controls */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Current Session</h2>
              <StartStopButton
                session={activeSession}
                onSessionChange={handleSessionChange}
              />
            </div>
            {activeSession && <SessionTimer startedAt={activeSession.startedAt} />}
          </div>

          {/* Stats Cards */}
          {activeSession && (
            <StatsCards
              focusSeconds={activeSession.totalFocusSeconds}
              distractionSeconds={activeSession.totalDistractionSeconds}
              interruptions={activeSession.interruptionCount}
            />
          )}

          {/* Recent Events */}
          {activeSession && activeSession.activityEvents.length > 0 && (
            <RecentEvents events={activeSession.activityEvents} />
          )}
        </div>
      </div>
    </div>
  );
}
