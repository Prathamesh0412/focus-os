interface ActivityEvent {
  id: string;
  domain: string;
  durationSeconds: number;
  category: 'focus' | 'distraction';
  createdAt: string;
}

interface RecentEventsProps {
  events: ActivityEvent[];
}

function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export default function RecentEvents({ events }: RecentEventsProps) {
  const recentEvents = events.slice(0, 10);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
      <div className="space-y-2">
        {recentEvents.map(event => {
          const time = new Date(event.createdAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={event.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    event.category === 'focus'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-gray-900 font-medium">
                  {event.domain}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    event.category === 'focus'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {event.category}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {formatDuration(event.durationSeconds)} at {time}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
