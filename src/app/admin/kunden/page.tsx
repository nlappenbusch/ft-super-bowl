'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, Spinner, EmptyState, Badge } from '@/components/admin/ui';
import { Search, Users, ArrowRight, Mail, Phone, GitMerge } from 'lucide-react';

interface CustomerRow {
  id: string;
  name: string;
  company: string;
  phone: string;
  city: string;
  primary_email: string;
  emails: string[];
  requests_count: number;
  bookings_count: number;
  revenue: number;
  duplicate_ids?: string[];
}

function eur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);
}

export default function KundenPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((r) => r.json());
      if (res.success) setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);

  return (
    <AdminShell title="Kunden">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#eef2f7' }}>
            <Users className="h-5 w-5" style={{ color: COLORS.navy }} />
          </span>
          <div>
            <div className="text-sm text-gray-500">Kundenstamm</div>
            <div className="text-lg font-extrabold" style={{ color: COLORS.navy }}>
              {rows.length} Kunden · {eur(totalRevenue)} gebucht
            </div>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, E-Mail, Firma, Ort…"
            className="w-72 rounded-lg border py-2 pl-9 pr-3 text-sm text-gray-900"
            style={{ borderColor: '#d8dde4' }}
          />
        </div>
      </div>

      <SectionCard title="Alle Kunden" description="Eindeutig über die E-Mail-Adresse. Klick öffnet die Kundenakte mit Anfragen, Buchungen, Rechnungen & Adresse.">
        {loading ? (
          <div className="py-10 text-center"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="Keine Kunden gefunden." description="Kunden entstehen automatisch aus Anfragen (per E-Mail)." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2">Kunde</th>
                  <th className="px-3 py-2">Kontakt</th>
                  <th className="px-3 py-2 text-center">Anfragen</th>
                  <th className="px-3 py-2 text-center">Buchungen</th>
                  <th className="px-3 py-2 text-right">Umsatz</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t transition-colors hover:bg-gray-50" style={{ borderColor: '#eef2f7' }}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/kunden/${c.id}`} className="font-bold" style={{ color: COLORS.navy }}>
                          {c.name || '(ohne Name)'}
                        </Link>
                        {(c.duplicate_ids || []).length > 0 && (
                          <Link href={`/admin/kunden/${c.id}`} title="Gleicher Vor- und Nachname wie ein anderer Kunde — in der Akte zusammenführen.">
                            <Badge tone="warn"><GitMerge className="h-3 w-3" /> Dublette?</Badge>
                          </Link>
                        )}
                      </div>
                      {c.company && <div className="text-xs text-gray-500">{c.company}</div>}
                      {c.city && <div className="text-xs text-gray-400">{c.city}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-gray-700"><Mail className="h-3.5 w-3.5 text-gray-400" /> {c.primary_email}</div>
                      {c.emails.length > 1 && <div className="text-xs text-gray-400">+{c.emails.length - 1} Alias</div>}
                      {c.phone && <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500"><Phone className="h-3 w-3 text-gray-400" /> {c.phone}</div>}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-gray-700">{c.requests_count}</td>
                    <td className="px-3 py-3 text-center font-semibold" style={{ color: c.bookings_count > 0 ? '#16a34a' : '#9ca3af' }}>{c.bookings_count}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: COLORS.navy }}>{eur(c.revenue)}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/admin/kunden/${c.id}`} className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: COLORS.accent }}>
                        Akte <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
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
