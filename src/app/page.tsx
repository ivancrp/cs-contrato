import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-surface-border bg-surface-card p-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Trade Up Optimizer CS2
        </h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Plataforma de análise e otimização de Trade Up Contracts com API Fastify,
          engine de probabilidade, ranking de oportunidades e alertas de ROI.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            prefetch
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-black hover:opacity-90"
          >
            Abrir Dashboard
          </Link>
          <Link
            href="/trade-up"
            className="rounded-lg border border-surface-border px-5 py-2.5 text-sm hover:bg-surface-border/40"
          >
            Buscar Contratos
          </Link>
          <Link
            href="/opportunities"
            className="rounded-lg border border-surface-border px-5 py-2.5 text-sm hover:bg-surface-border/40"
          >
            TOP 100
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: 'Trade Up', desc: 'Busca multi-tier com autocomplete e preços de mercado' },
          { title: 'Oportunidades', desc: 'Ranking TOP 100 por ROI com scan e gráficos' },
          { title: 'Alertas', desc: 'Notificações quando uma skin atinge ROI mínimo' },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-surface-border bg-surface-card/60 p-5"
          >
            <h2 className="font-semibold text-accent">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
