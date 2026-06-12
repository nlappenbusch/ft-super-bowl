'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Lock, User, LoaderCircle } from 'lucide-react';

const BLUE_GLOW: React.CSSProperties = {
  background:
    'radial-gradient(60% 95% at 12% 12%, rgba(58,124,190,0.5), transparent 60%),' +
    'radial-gradient(55% 85% at 90% 22%, rgba(34,84,143,0.45), transparent 55%),' +
    'linear-gradient(180deg, #163e63 0%, #0e2842 55%, #0c2138 100%)',
};

const ERRORS: Record<string, string> = {
  state: 'Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.',
  token: 'Microsoft-Anmeldung fehlgeschlagen.',
  tenant: 'Dieser Microsoft-Account gehört nicht zur erlaubten Organisation.',
  config: 'Microsoft 365 ist serverseitig noch nicht konfiguriert.',
};

export default function AdminLoginPage() {
  const [username, setUsername] = useState('localadmin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('/admin');
  const [msConfigured, setMsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const e = p.get('error');
    if (e) setError(ERRORS[e] || 'Anmeldung fehlgeschlagen.');
    const f = p.get('from');
    if (f && f.startsWith('/admin')) setFrom(f);
  }, []);

  useEffect(() => {
    fetch('/api/auth/microsoft/status').then((r) => r.json()).then((d) => setMsConfigured(!!d.configured)).catch(() => setMsConfigured(false));
  }, []);

  const submitLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (d.success) { window.location.href = from; return; }
      setError(d.error || 'Falsche Zugangsdaten.');
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={BLUE_GLOW}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Brand-Header */}
        <div className="flex flex-col items-center gap-3 px-8 pt-9 pb-6" style={{ background: 'linear-gradient(135deg,#112b44,#1f4c75)' }}>
          <Image src="/faltin-logo.svg" alt="Faltin Travel" width={150} height={48} priority />
          <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/80" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            Admin-Bereich
          </span>
        </div>

        <div className="px-8 py-8">
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Microsoft 365 */}
          {msConfigured === false ? (
            <div
              className="flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold text-gray-400"
              style={{ borderColor: '#e5e8ed', background: '#f8fafc' }}
              title="Im Admin unter E-Mail / Microsoft 365 konfigurieren"
            >
              <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden><rect x="1" y="1" width="10" height="10" fill="#f25022" /><rect x="12" y="1" width="10" height="10" fill="#7fba00" /><rect x="1" y="12" width="10" height="10" fill="#00a4ef" /><rect x="12" y="12" width="10" height="10" fill="#ffb900" /></svg>
              Microsoft 365 – noch nicht konfiguriert
            </div>
          ) : (
            <a
              href={`/api/auth/microsoft/start?from=${encodeURIComponent(from)}`}
              className="flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-bold text-gray-800 transition hover:bg-gray-50"
              style={{ borderColor: '#d8dde4' }}
            >
              <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden><rect x="1" y="1" width="10" height="10" fill="#f25022" /><rect x="12" y="1" width="10" height="10" fill="#7fba00" /><rect x="1" y="12" width="10" height="10" fill="#00a4ef" /><rect x="12" y="12" width="10" height="10" fill="#ffb900" /></svg>
              Mit Microsoft 365 anmelden
            </a>
          )}

          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
            <span className="h-px flex-1 bg-gray-200" /> oder lokal <span className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Local Admin */}
          <form onSubmit={submitLocal} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600"><User className="mr-1 -mt-0.5 inline h-3.5 w-3.5" /> Benutzer</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }} autoComplete="username" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600"><Lock className="mr-1 -mt-0.5 inline h-3.5 w-3.5" /> Passwort</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }} autoComplete="current-password" placeholder="••••••••" />
            </label>
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: '#d9531e' }}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Anmelden
            </button>
          </form>
        </div>

        <div className="border-t px-8 py-4 text-center text-[11px] text-gray-400" style={{ borderColor: '#eef1f4' }}>
          Faltin Travel AG · Admin-Zugang ausschließlich für berechtigte Nutzer.
        </div>
      </div>
    </div>
  );
}
