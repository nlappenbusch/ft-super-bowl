'use client';

import { useEffect, useState } from 'react';
import { Save, Trophy } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { Button, COLORS, PageHeader, SectionCard, Spinner } from '@/components/admin/ui';
import { TIPPSPIEL_MATCHES } from '@/lib/tippspielMatches';

type ResultMap = Record<number, [string, string]>;

export default function TippspielAdminPage() {
  const [results, setResults] = useState<ResultMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/tippspiel/results').then((response) => response.json()).then((data) => {
      if (data.success) {
        setResults(Object.fromEntries(data.results.map((result: { match_id: number; home_score: number; away_score: number }) => [
          result.match_id, [String(result.home_score), String(result.away_score)],
        ])));
      }
    }).finally(() => setLoading(false));
  }, []);

  const update = (matchId: number, side: 0 | 1, value: string) => {
    if (!/^\d{0,2}$/.test(value)) return;
    setResults((current) => {
      const next: [string, string] = [...(current[matchId] || ['', ''])];
      next[side] = value;
      return { ...current, [matchId]: next };
    });
  };

  const save = async (matchId: number) => {
    const [home, away] = results[matchId] || ['', ''];
    if (home === '' || away === '') return;
    setSaving(matchId);
    const response = await fetch('/api/admin/tippspiel/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, home_score: Number(home), away_score: Number(away) }),
    });
    const data = await response.json();
    setMessage(data.success ? 'Resultat gespeichert. Die Rangliste wurde neu berechnet.' : data.error);
    setSaving(null);
  };

  return (
    <AdminShell title="WM-Tippspiel">
      <PageHeader title="WM-Tippspiel Resultate" description="Finalresultate eintragen; Punkte und Ranglisten werden automatisch berechnet." />
      {message && <div className="mb-4 rounded-xl bg-white p-3 text-sm" style={{ border: `1px solid ${COLORS.stroke}`, color: COLORS.navy }}>{message}</div>}
      <SectionCard title="Spiele" description="Wertung: 5 Punkte exakt, 3 Punkte Tordifferenz, 2 Punkte Tendenz." icon={<Trophy className="h-5 w-5" />}>
        {loading ? <div className="flex justify-center py-16"><Spinner /></div> : <div className="space-y-3">
          {TIPPSPIEL_MATCHES.map((match) => <div key={match.id} className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center" style={{ background: COLORS.surfaceMuted }}>
            <div className="min-w-0 flex-1"><div className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>{match.date} · {match.group}</div><div className="mt-1 font-bold" style={{ color: COLORS.navy }}>{match.home} – {match.away}</div></div>
            <div className="flex items-center gap-2">
              <input aria-label={`Tore ${match.home}`} className="h-10 w-14 rounded-lg border bg-white text-center font-bold" value={results[match.id]?.[0] || ''} onChange={(event) => update(match.id, 0, event.target.value)} />
              <span>:</span>
              <input aria-label={`Tore ${match.away}`} className="h-10 w-14 rounded-lg border bg-white text-center font-bold" value={results[match.id]?.[1] || ''} onChange={(event) => update(match.id, 1, event.target.value)} />
              <Button size="sm" onClick={() => save(match.id)} disabled={saving === match.id || !results[match.id]?.[0] || !results[match.id]?.[1]}>
                {saving === match.id ? <Spinner /> : <Save className="h-4 w-4" />} Speichern
              </Button>
            </div>
          </div>)}
        </div>}
      </SectionCard>
    </AdminShell>
  );
}
