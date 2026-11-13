'use client';

/**
 * /belege — eigenständige Oberfläche von Faltin Belege (belege.faltintravel.com → "/").
 * Handy: Erfassen mit Kamera. Grosser Bildschirm: Liste + Prüfung (umschaltbar).
 * Nur für angemeldete Mitarbeitende (Middleware), Login via Microsoft 365.
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LayoutGrid, LogOut, Smartphone } from 'lucide-react';
import BelegeMobile from '@/components/belege/BelegeMobile';
import BelegeDesk from '@/components/belege/BelegeDesk';

const SUITE_URL = 'https://next.faltintravel.com/admin';

export default function BelegeHome() {
  const [view, setView] = useState<'mobile' | 'desk' | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search).get('ansicht');
    let saved: string | null = null;
    try { saved = localStorage.getItem('belege-ansicht'); } catch { /* */ }
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    setView(sp === 'desk' || sp === 'mobile' ? sp : saved === 'desk' || saved === 'mobile' ? saved : wide ? 'desk' : 'mobile');
  }, []);

  const switchTo = (v: 'mobile' | 'desk') => {
    try { localStorage.setItem('belege-ansicht', v); } catch { /* */ }
    setView(v);
  };

  if (!view) return <div className="min-h-screen" style={{ background: '#f4f6f9' }} />;

  if (view === 'mobile') {
    return (
      <div className="min-h-screen bg-[#e9edf2]">
        <BelegeMobile />
        <button type="button" onClick={() => switchTo('desk')}
          className="fixed right-4 top-4 z-20 hidden rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold shadow lg:block" style={{ color: '#143047' }}>
          Desktop-Ansicht
        </button>
      </div>
    );
  }

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* */ }
    window.location.href = '/admin/login?from=/belege';
  };

  return (
    <div className="min-h-screen" style={{ background: '#f4f6f9' }}>
      <header className="sticky top-0 z-40" style={{ background: '#143047' }}>
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/faltin-logo.svg" alt="Faltin Travel" width={110} height={36} priority />
            <span className="h-6 w-px bg-white/20" />
            <span className="text-lg font-extrabold tracking-tight text-white">Belege</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={() => switchTo('mobile')} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
              <Smartphone className="h-4 w-4" /> <span className="hidden sm:inline">Erfassen</span>
            </button>
            <a href={SUITE_URL} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-white/80 hover:bg-white/10" title="Zur Faltin-Suite">
              <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Suite</span>
            </a>
            <button onClick={logout} className="rounded-lg p-2 text-white/70 hover:bg-white/10" title="Abmelden" aria-label="Abmelden">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <BelegeDesk />
      </main>
    </div>
  );
}
