import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CS Contrato — Trade Up Optimizer',
  description: 'Plataforma profissional de análise e otimização de Trade Up Contracts CS2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-surface text-slate-100 antialiased">
        <header className="border-b border-surface-border bg-surface-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold text-accent">
              ⚡ CS Contrato
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-slate-300">
              <Link href="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
              <Link href="/trade-up" className="hover:text-white">
                Trade Up
              </Link>
              <Link href="/opportunities" className="hover:text-white">
                TOP 100
              </Link>
              <Link href="/stattrak" className="hover:text-white">
                StatTrak
              </Link>
              <Link href="/alerts" className="hover:text-white">
                Alertas
              </Link>
              <a
                href="/"
                className="text-slate-500 hover:text-slate-300"
                title="App legado Vite"
              >
                Legado
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
