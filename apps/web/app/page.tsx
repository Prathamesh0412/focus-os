import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Focus OS</h1>
          <p className="text-xl text-gray-600">
            Track your focus sessions. Measure real distractions.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="text-3xl mb-2">🎯</div>
            <h3 className="text-lg font-semibold mb-2">Start Focus Session</h3>
            <p className="text-gray-600">
              Begin a timed focus session and track your productive time.
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="text-lg font-semibold mb-2">Track Distractions</h3>
            <p className="text-gray-600">
              Chrome extension automatically detects when you get distracted.
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="text-3xl mb-2">📈</div>
            <h3 className="text-lg font-semibold mb-2">View Analytics</h3>
            <p className="text-gray-600">
              See your focus time, distractions, and improvement over time.
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
          >
            Open Dashboard
          </Link>
        </div>

        <div className="mt-16 text-center text-sm text-gray-500">
          <p>
            Configure your Chrome extension to start tracking.
            <br />
            API Key required for authentication.
          </p>
        </div>
      </div>
    </div>
  );
}
