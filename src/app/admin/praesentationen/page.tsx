'use client';

/**
 * /admin/praesentationen – Übersicht aller Decks + Anlegen neuer Präsentationen
 * (leeres Gerüst oder Übernahme eines fertigen KI-Incentive-Plans).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, PageHeader, InputField, SelectInput, Button, Badge, Field, Spinner, EmptyState } from '@/components/admin/ui';
import { Presentation, Plus, Trash2, Copy, FileDown, ExternalLink, Wand2 } from 'lucide-react';
import type { DeckLang, DeckListRow } from '@/lib/presentation/types';

interface IncentiveRow { id: string; title: string; status: string; created_at: string }

const LANG_LABEL: Record<string, string> = { de: 'Deutsch', en: 'English', fr: 'Français' };

export default function PresentationsPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckListRow[]>([]);
  const [plans, setPlans] = useState<IncentiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState<DeckLang>('de');
  const [fromIncentive, setFromIncentive] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [d, p] = await Promise.all([
      fetch('/api/admin/presentations').then((r) => r.json()).catch(() => null),
      fetch('/api/admin/incentive').then((r) => r.json()).catch(() => null),
    ]);
    if (d?.success) setDecks(d.data || []);
    if (p?.success) setPlans((p.data || []).filter((x: IncentiveRow) => x.status !== 'generating' && x.status !== 'error'));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/presentations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, lang, fromIncentive: fromIncentive || undefined }),
      });
      const j = await res.json();
      if (j.success && j.id) router.push(`/admin/praesentationen/${j.id}`);
      else setError(j.error || 'Anlegen fehlgeschlagen.');
    } catch { setError('Verbindungsfehler.'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Präsentation „${name}" wirklich löschen?`)) return;
    await fetch(`/api/admin/presentations/${id}`, { method: 'DELETE' });
    load();
  };

  const duplicate = async (id: string) => {
    const res = await fetch(`/api/admin/presentations/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const j = await res.json();
    if (j.success && j.id) router.push(`/admin/praesentationen/${j.id}`);
  };

  return (
    <AdminShell title="Präsentationen">
      <PageHeader
        title="Präsentationen"
        description="Kundenfertige Decks im Faltin-Design – als PDF, PowerPoint oder Web-Link."
      />

      <SectionCard title="Neue Präsentation" description="Leeres Gerüst oder ein fertiger Incentive-Plan als Startpunkt.">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_2fr_auto] md:items-end">
          <InputField label="Titel" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Ryder Cup 2027 – Travel Package" />
          <Field label="Sprache">
            <SelectInput value={lang} onChange={(e) => setLang(e.target.value as DeckLang)}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </SelectInput>
          </Field>
          <Field label="Aus Incentive-Plan übernehmen (optional)">
            <SelectInput value={fromIncentive} onChange={(e) => setFromIncentive(e.target.value)}>
              <option value="">— leeres Gerüst —</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </SelectInput>
          </Field>
          <Button onClick={create} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : fromIncentive ? <Wand2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Anlegen
          </Button>
        </div>
        {error && <p className="mt-3 text-sm" style={{ color: COLORS.danger }}>{error}</p>}
        {!plans.length && (
          <p className="mt-3 text-sm" style={{ color: COLORS.textMuted }}>
            Noch keine fertigen Incentive-Pläne vorhanden – im <Link href="/admin/incentive" className="underline">Incentive Builder</Link> lässt sich einer erzeugen.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Alle Präsentationen">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : !decks.length ? (
          <EmptyState icon={<Presentation className="h-6 w-6" />} title="Noch keine Präsentationen" description="Oben eine neue anlegen." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.textMuted }} className="text-left">
                  <th className="pb-2 font-semibold">Titel</th>
                  <th className="pb-2 font-semibold">Sprache</th>
                  <th className="pb-2 font-semibold">Folien</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Geändert</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {decks.map((d) => (
                  <tr key={d.id} style={{ borderTop: `1px solid ${COLORS.stroke}` }}>
                    <td className="py-3 pr-3">
                      <Link href={`/admin/praesentationen/${d.id}`} className="font-semibold hover:underline" style={{ color: COLORS.navy }}>
                        {d.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">{LANG_LABEL[d.lang] || d.lang}</td>
                    <td className="py-3 pr-3">{d.slide_count}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={d.status === 'final' ? 'ok' : 'muted'}>{d.status === 'final' ? 'final' : 'Entwurf'}</Badge>
                      {d.share_enabled && <span className="ml-2"><Badge tone="info">Link aktiv</Badge></span>}
                    </td>
                    <td className="py-3 pr-3" style={{ color: COLORS.textMuted }}>
                      {new Date(d.updated_at).toLocaleDateString('de-CH')}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a href={`/api/admin/presentations/${d.id}/export?format=pdf`} target="_blank" rel="noreferrer" title="PDF">
                          <Button variant="ghost" size="sm"><FileDown className="h-4 w-4" /></Button>
                        </a>
                        {d.share_enabled && d.share_token && (
                          <a href={`/p/${d.share_token}`} target="_blank" rel="noreferrer" title="Web-Link öffnen">
                            <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                          </a>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => duplicate(d.id)} title="Duplizieren"><Copy className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(d.id, d.title)} title="Löschen"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AdminShell>
  );
}
