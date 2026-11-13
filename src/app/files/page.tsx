'use client';

/**
 * /files — eigenständige Oberfläche von Faltin Files (files.faltintravel.com → "/").
 * Nur für angemeldete Mitarbeitende (Middleware), Login via Microsoft 365.
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LayoutGrid, LogOut } from 'lucide-react';
import FilesApp from '@/components/files/FilesApp';

const SUITE_URL = 'https://next.faltintravel.com/admin';

export default function FilesHome() {
  const [user, setUser] = useState<{ name: string } | null>(null);
  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((d) => { if (d?.user) setUser(d.user); }).catch(() => {});
  }, []);

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* */ }
    window.location.href = '/admin/login?from=/files';
  };

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <header className="sticky top-0 z-40" style={{ background: '#143047' }}>
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/faltin-logo.svg" alt="Faltin Travel" width={110} height={36} priority />
            <span className="h-6 w-px bg-white/20" />
            <span className="text-lg font-extrabold tracking-tight text-white">Files</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {user && <span className="hidden text-sm text-white/70 sm:inline">{user.name}</span>}
            <a href={SUITE_URL} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-white/80 hover:bg-white/10" title="Zur Faltin-Suite">
              <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Suite</span>
            </a>
            <button onClick={logout} className="rounded-lg p-2 text-white/70 hover:bg-white/10" title="Abmelden" aria-label="Abmelden">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: '#143047' }}>Dateien teilen</h1>
          <p className="mt-1 text-sm text-slate-500">Hochladen, Link kopieren, fertig. Gelöscht wird automatisch – standardmässig nach 30 Tagen.</p>
        </div>
        <FilesApp />
      </main>
    </div>
  );
}
