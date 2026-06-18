'use client';

import { useState } from 'react';
import { API_BASE } from '@/lib/api';
import { SkinAutocomplete } from '@/components/SkinAutocomplete';

export default function AlertsPage() {
  const [skinId, setSkinId] = useState('');
  const [skinName, setSkinName] = useState('');
  const [minRoi, setMinRoi] = useState(5);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch(`${API_BASE}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skinId: skinId || skinName, skinName, minRoi }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? 'Erro ao criar alerta');
      return;
    }
    setMessage(`Alerta criado: ${data.id}`);
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Alertas de ROI</h1>
      <p className="text-sm text-slate-400">
        Receba notificação quando uma skin atingir o ROI mínimo no ranking de oportunidades.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-surface-border bg-surface-card p-6">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Skin</label>
          <SkinAutocomplete
            value={skinName}
            onChange={(query) => {
              setSkinName(query);
              setSkinId('');
            }}
            onSelect={(skin) => {
              setSkinName(skin.name);
              setSkinId(skin.id);
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">ROI mínimo (%)</label>
          <input
            type="number"
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
            value={minRoi}
            onChange={(e) => setMinRoi(Number(e.target.value))}
            min={0}
            step={0.5}
          />
        </div>
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black">
          Criar alerta
        </button>
        {message && <p className="text-sm text-emerald-400">{message}</p>}
      </form>
    </div>
  );
}
