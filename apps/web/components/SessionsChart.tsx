'use client';

interface Session {
  id: string;
  startedAt: string;
  totalFocusSeconds: number;
  totalDistractionSeconds: number;
}

interface SessionsChartProps {
  sessions: Session[];
}

export default function SessionsChart({ sessions }: SessionsChartProps) {
  const last10Sessions = sessions.slice(0, 10).reverse();

  const maxDuration = Math.max(
    ...last10Sessions.map(s => s.totalFocusSeconds + s.totalDistractionSeconds),
    1
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Session History</h2>
      <div className="space-y-3">
        {last10Sessions.map(session => {
          const focusPercent = (session.totalFocusSeconds / maxDuration) * 100;
          const distractionPercent =
            (session.totalDistractionSeconds / maxDuration) * 100;
          const date = new Date(session.startedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          return (
            <div key={session.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{date}</span>
                <span className="text-gray-500">
                  {Math.round(session.totalFocusSeconds / 60)}m focus
                </span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${focusPercent}%` }}
                />
                <div
                  className="bg-red-500 h-full transition-all"
                  style={{ width: `${distractionPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-gray-600">Focus</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-gray-600">Distraction</span>
        </div>
      </div>
    </div>
  );
}
