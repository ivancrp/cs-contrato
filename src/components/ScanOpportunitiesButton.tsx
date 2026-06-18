'use client';

import { useState } from 'react';
import { API_BASE } from '@/lib/api';

export function ScanOpportunitiesButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleScan() {
    setLoading(true);
    setMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const adminKey = process.env.NEXT_PUBLIC_API_ADMIN_KEY;
      if (adminKey) headers['x-api-key'] = adminKey;

      const res = await fetch(`${API_BASE}/opportunities/scan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ limit: 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha no scan');
      setMessage(`${data.total} oportunidades · ${data.alertsTriggered ?? 0} alertas`);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleScan}
        disabled={loading}
        className="rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
      >
        {loading ? 'Escaneando…' : 'Atualizar scan'}
      </button>
      {message && <span className="text-xs text-slate-500">{message}</span>}
    </div>
  );
}
