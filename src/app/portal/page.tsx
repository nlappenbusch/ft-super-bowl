'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const NAVY = '#143047';
const ACCENT = '#d9531e';

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Schon eingeloggt? → direkt ins Dashboard.
    fetch('/api/portal/me').then((r) => {
      if (r.ok) router.replace('/portal/app');
      else setChecking(false);
    }).catch(() => setChecking(false));
    if (typeof window !== 'undefined' && window.location.search.includes('error=link')) {
      setError('Dieser Login-Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.');
    }
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSending(true);
    try {
      const r = await fetch('/api/portal/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) { setError(j.error || 'Es ist ein Fehler aufgetreten.'); }
      else setSent(true);
    } catch { setError('Verbindungsfehler. Bitte später erneut versuchen.'); }
    finally { setSending(false); }
  };

  if (checking) {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>Lädt…</div>;
  }

  return (
    <div style={{ maxWidth: 460, margin: '20px auto', background: '#fff', borderRadius: 18, boxShadow: '0 8px 30px rgba(20,48,71,0.10)', padding: '34px 32px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: NAVY }}>Willkommen zurück</h1>
      <p style={{ margin: '0 0 22px', fontSize: 15, lineHeight: 1.6, color: '#374151' }}>
        Melden Sie sich mit Ihrer E-Mail-Adresse an. Wir senden Ihnen einen sicheren Login-Link – ganz ohne Passwort.
      </p>

      {sent ? (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '16px 18px', color: '#047857', fontSize: 15, lineHeight: 1.6 }}>
          <strong>Fast geschafft!</strong> Wenn ein Konto zu <strong>{email}</strong> existiert, ist ein Login-Link unterwegs.
          Bitte prüfen Sie Ihr Postfach (auch den Spam-Ordner). Der Link ist 30&nbsp;Minuten gültig.
        </div>
      ) : (
        <form onSubmit={submit}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px', color: '#b91c1c', fontSize: 14, marginBottom: 16 }}>{error}</div>
          )}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>E-Mail-Adresse</label>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="ihre@email.com" autoComplete="email"
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #d8dde4', padding: '12px 14px', fontSize: 15, outline: 'none' }}
          />
          <button
            type="submit" disabled={sending}
            style={{ marginTop: 16, width: '100%', background: ACCENT, color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}
          >
            {sending ? 'Senden…' : 'Login-Link anfordern →'}
          </button>
        </form>
      )}

      <p style={{ margin: '20px 0 0', fontSize: 12.5, color: '#9ca3af', lineHeight: 1.6 }}>
        Sie haben noch keine Anfrage bei uns? Stellen Sie zuerst eine Anfrage auf unserer Website – danach steht Ihnen das Portal offen.
      </p>
    </div>
  );
}
