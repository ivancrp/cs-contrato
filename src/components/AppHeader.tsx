'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/trade-up', label: 'Trade Up', icon: '⚗️' },
  { href: '/opportunities', label: 'TOP 100', icon: '🏆' },
  { href: '/stattrak', label: 'StatTrak', icon: '🔢' },
  { href: '/alerts', label: 'Alertas', icon: '🔔' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  return pathname.startsWith(href);
}

export function AppHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-surface-border/80 bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 2xl:max-w-[88rem] 2xl:px-8">
        <Link
          href="/dashboard"
          className="group flex shrink-0 items-center gap-2.5"
          onClick={() => setMobileOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-base ring-1 ring-accent/30 transition group-hover:bg-accent/25">
            ⚡
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-white">CS Contrato</span>
            <span className="block text-[10px] font-medium text-slate-500">Trade Up Optimizer</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-accent/15 text-accent ring-1 ring-accent/25'
                    : 'text-slate-400 hover:bg-surface-card hover:text-slate-100'
                }`}
              >
                <span className="text-xs opacity-80">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-slate-300 transition hover:bg-surface-card md:hidden"
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileOpen && (
        <nav className="border-t border-surface-border/60 bg-surface-card/95 px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ href, label, icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? 'bg-accent/15 text-accent'
                        : 'text-slate-300 hover:bg-surface/80'
                    }`}
                  >
                    <span>{icon}</span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
