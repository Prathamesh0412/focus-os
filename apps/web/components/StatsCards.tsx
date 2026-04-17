interface StatsCardsProps {
  focusSeconds: number;
  distractionSeconds: number;
  interruptions: number;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export default function StatsCards({
  focusSeconds,
  distractionSeconds,
  interruptions,
}: StatsCardsProps) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Focus Time */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              Focus Time
            </p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatDuration(focusSeconds)}
            </p>
          </div>
          <div className="text-4xl">🎯</div>
        </div>
      </div>

      {/* Distraction Time */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              Distraction Time
            </p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatDuration(distractionSeconds)}
            </p>
          </div>
          <div className="text-4xl">⚠️</div>
        </div>
      </div>

      {/* Interruptions */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              Interruptions
            </p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {interruptions}
            </p>
          </div>
          <div className="text-4xl">🔔</div>
        </div>
      </div>
    </div>
  );
}
