'use client';

/**
 * Dashboard-Kachel: Wo stecken besondere Wuensche in den Anfragen?
 *
 * Zeigt, wie viele Anfragen einen Freitext haben, wie viele davon noch
 * unbearbeitet sind, und welche Themen darin vorkommen. Jede Zeile fuehrt
 * gefiltert ins Kanban-Board.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { SectionCard, Button, COLORS } from './ui';
import { WISH_CATEGORIES, analyzeWishes, wishCounts, type WishKey } from '@/lib/specialRequests';

interface WishLead {
  id: string;
  status: 'new' | 'in_progress' | 'booked' | 'rejected';
  message?: string;
  notes?: string;
}

export default function WishOverview({ leads }: { leads: WishLead[] }) {
  const stats = useMemo(() => {
    const infos = leads.map((l) => ({ lead: l, info: analyzeWishes(l.message, l.notes) }));
    const { total, freitext, byKey } = wishCounts(infos.map((x) => x.info));
    const offen = infos.filter(
      (x) => x.info.has && (x.lead.status === 'new' || x.lead.status === 'in_progress'),
    ).length;
    const rows = WISH_CATEGORIES.filter((c) => byKey[c.key as WishKey] > 0)
      .map((c) => ({ ...c, count: byKey[c.key as WishKey] }))
      .sort((a, b) => b.count - a.count);
    return { total, freitext, offen, rows, quote: leads.length ? Math.round((total / leads.length) * 100) : 0 };
  }, [leads]);

  const max = Math.max(1, ...stats.rows.map((r) => r.count));

  return (
    <SectionCard
      title="Besondere Wünsche"
      icon={<Sparkles className="h-5 w-5" />}
      actions={
        <Link href="/admin/crm?wunsch=nur">
          <Button variant="ghost" size="sm">Im Board <ArrowRight className="h-3.5 w-3.5" /></Button>
        </Link>
      }
    >
      <div className="mb-4 flex items-end gap-3">
        <span className="text-3xl font-extrabold tabular-nums" style={{ color: '#d97706' }}>{stats.total}</span>
        <span className="pb-1 text-xs" style={{ color: COLORS.textMuted }}>
          von {leads.length} Anfragen ({stats.quote}&nbsp;%)
          {stats.offen > 0 && (
            <>
              <br />
              <span className="font-bold" style={{ color: COLORS.accent }}>{stats.offen}</span> noch unbearbeitet
            </>
          )}
        </span>
      </div>

      {stats.rows.length === 0 ? (
        <div className="py-6 text-center text-sm" style={{ color: COLORS.textMuted }}>
          Keine Anfrage mit Anmerkung
        </div>
      ) : (
        <div className="space-y-2.5">
          {stats.rows.map((r) => (
            <Link key={r.key} href={`/admin/crm?wunsch=${r.key}`} className="block transition hover:opacity-75" title={r.hint}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold" style={{ color: COLORS.navy }}>
                  <span aria-hidden>{r.emoji}</span> {r.label}
                </span>
                <span className="tabular-nums" style={{ color: COLORS.textMuted }}>{r.count}</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: COLORS.surfaceMuted }}>
                <div className="h-2 rounded-full" style={{ width: `${Math.round((r.count / max) * 100)}%`, background: r.color }} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {stats.freitext > 0 && (
        <Link
          href="/admin/crm?wunsch=freitext"
          className="mt-4 flex items-center justify-between border-t pt-3 text-xs transition hover:opacity-75"
          style={{ borderColor: COLORS.stroke, color: COLORS.textMuted }}
          title="Nachricht vorhanden, aber ohne erkennbares Thema"
        >
          <span>Weitere Anfragen mit Freitext</span>
          <span className="tabular-nums font-semibold">{stats.freitext}</span>
        </Link>
      )}
    </SectionCard>
  );
}
