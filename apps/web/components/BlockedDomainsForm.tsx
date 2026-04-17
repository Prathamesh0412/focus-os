'use client';

import { useState, useEffect } from 'react';

interface BlockedDomain {
  id: string;
  domain: string;
  createdAt: string;
}

export default function BlockedDomainsForm() {
  const [domains, setDomains] = useState<BlockedDomain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = async () => {
    const apiKey = localStorage.getItem('focusos_api_key');
    const res = await fetch('/api/settings/blocked-domains', {
      headers: { 'X-API-Key': apiKey || '' },
    });
    const data = await res.json();
    setDomains(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem('focusos_api_key');
      const res = await fetch('/api/settings/blocked-domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey || '',
        },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add domain');
      }

      setNewDomain('');
      fetchDomains();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeDomain = async (id: string) => {
    const apiKey = localStorage.getItem('focusos_api_key');
    await fetch(`/api/settings/blocked-domains/${id}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': apiKey || '' },
    });
    fetchDomains();
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Distracting Domains</h2>
      <p className="text-gray-600 mb-4">
        Websites in this list will be counted as distractions during focus
        sessions.
      </p>

      <form onSubmit={addDomain} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newDomain}
          onChange={e => setNewDomain(e.target.value)}
          placeholder="youtube.com"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={saving || !newDomain.trim()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? 'Adding...' : 'Add'}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {domains.map(domain => (
          <div
            key={domain.id}
            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
          >
            <span className="text-gray-900">{domain.domain}</span>
            <button
              onClick={() => removeDomain(domain.id)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Remove
            </button>
          </div>
        ))}
        {domains.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            No blocked domains. Add some distracting websites above.
          </div>
        )}
      </div>
    </div>
  );
}
