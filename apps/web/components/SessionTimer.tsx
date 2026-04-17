'use client';

import { useState, useEffect } from 'react';

interface SessionTimerProps {
  startedAt: string;
}

export default function SessionTimer({ startedAt }: SessionTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = new Date(startedAt).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      const seconds = Math.floor((now - startTime) / 1000);
      setElapsed(seconds);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const formatUnit = (unit: number): string => unit.toString().padStart(2, '0');

  return (
    <div className="text-center py-8">
      <div className="text-6xl font-mono font-bold text-gray-900">
        {hours > 0 && (
          <>
            <span className="text-4xl">{formatUnit(hours)}</span>
            <span className="mx-2">:</span>
          </>
        )}
        <span>{formatUnit(minutes)}</span>
        <span className="mx-2">:</span>
        <span>{formatUnit(seconds)}</span>
      </div>
      <p className="text-gray-500 mt-2">Session duration</p>
    </div>
  );
}
