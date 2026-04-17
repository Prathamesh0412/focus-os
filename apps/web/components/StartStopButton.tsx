'use client';

import { useState } from 'react';

interface Session {
  id: string;
}

interface StartStopButtonProps {
  session: Session | null;
  onSessionChange: () => void;
}

export default function StartStopButton({
  session,
  onSessionChange,
}: StartStopButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem('focusos_api_key');
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey || '',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start session');
      }

      onSessionChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopSession = async () => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem('focusos_api_key');
      const res = await fetch(`/api/sessions/${session.id}/stop`, {
        method: 'PATCH',
        headers: {
          'X-API-Key': apiKey || '',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to stop session');
      }

      onSessionChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {session ? (
        <button
          onClick={stopSession}
          disabled={loading}
          className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Stopping...' : 'Stop Session'}
        </button>
      ) : (
        <button
          onClick={startSession}
          disabled={loading}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Starting...' : 'Start Session'}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
