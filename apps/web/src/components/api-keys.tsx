"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiKey {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchKeys() {
    const res = await fetch(`${API_URL}/api-keys`, { credentials: "include" });
    const data = await res.json();
    setKeys(data.keys || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api-keys`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    setNewKey(data.key);
    setLabel("");
    fetchKeys();
  }

  async function handleDelete(id: string) {
    await fetch(`${API_URL}/api-keys/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    fetchKeys();
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-800 mb-1">
            API key created — copy it now, it won&apos;t be shown again:
          </p>
          <code className="block bg-white border rounded px-3 py-2 text-sm font-mono break-all">
            {newKey}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newKey);
            }}
            className="mt-2 text-xs text-green-700 hover:underline"
          >
            Copy to clipboard
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Key label (optional)"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button
          type="submit"
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Create key
        </button>
      </form>

      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">No API keys yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 font-medium">Label</th>
              <th className="pb-2 font-medium">Created</th>
              <th className="pb-2 font-medium">Last used</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id} className="border-b">
                <td className="py-2">{key.label || "—"}</td>
                <td className="py-2 text-gray-500">
                  {new Date(key.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2 text-gray-500">
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
