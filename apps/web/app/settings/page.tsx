'use client';

import { useState, useEffect } from 'react';
import BlockedDomainsForm from '@/components/BlockedDomainsForm';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('focusos_api_key');
    if (stored) setApiKey(stored);
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('focusos_api_key', newKey);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure your Focus OS preferences
          </p>
        </header>

        <div className="space-y-6">
          {/* API Key Configuration */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Authentication</h2>
            <div>
              <label
                htmlFor="apikey"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                API Key
              </label>
              <input
                type="password"
                id="apikey"
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="Enter your API key"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="mt-2 text-sm text-gray-500">
                This key authenticates your browser extension and dashboard.
                Find it in your .env file or ask your administrator.
              </p>
            </div>
          </div>

          {/* Blocked Domains */}
          <BlockedDomainsForm />
        </div>
      </div>
    </div>
  );
}
