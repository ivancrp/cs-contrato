import './globals.css';
import type { Metadata } from 'next';
import { AppHeader } from '@/components/AppHeader';

export const metadata: Metadata = {
  title: 'CS Contrato — Trade Up Optimizer',
  description: 'Plataforma profissional de análise e otimização de Trade Up Contracts CS2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-surface text-slate-100 antialiased">
        <AppHeader />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 2xl:max-w-[88rem] 2xl:px-8">{children}</main>
      </body>
    </html>
  );
}
