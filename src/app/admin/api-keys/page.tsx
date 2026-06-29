'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { PageHeader, SectionCard, Card, Button, Field, TextInput, Badge, Spinner, COLORS } from '@/components/admin/ui';
import { KeyRound, Plus, Trash2, Copy, Check, ShieldAlert } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  created_by: string;
  last_used_at: string | null;
  revoked: number;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null); // einmalig sichtbarer Klartext
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/api-keys').then((x) => x.json());
      if (r.success) setKeys(r.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true); setFresh(null); setCopied(false);
    try {
      const r = await fetch('/api/admin/api-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }),
      }).then((x) => x.json());
      if (r.success) { setFresh(r.data.plaintext); setName(''); await load(); }
    } finally { setCreating(false); }
  };

  const revoke = async (k: ApiKey) => {
    if (!confirm(`Key "${k.name}" widerrufen? Anwendungen mit diesem Key verlieren sofort den Zugriff.`)) return;
    await fetch(`/api/admin/api-keys/${k.id}`, { method: 'DELETE' });
    load();
  };

  const copy = async () => {
    if (!fresh) return;
    try { await navigator.clipboard.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  return (
    <AdminShell title="API-Keys">
      <PageHeader
        title="API-Keys"
        description="Schlüssel für den externen Zugriff (z.B. MCP-Server). Ein Key wird nur einmal angezeigt – danach nur noch widerrufbar."
      />

      <SectionCard title="Neuen Key erzeugen" icon={<Plus className="h-4 w-4" />}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Bezeichnung" className="min-w-[240px] flex-1">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. MCP-Server Nils / Laptop" onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
          </Field>
          <Button variant="accent" onClick={create} disabled={creating || !name.trim()}>
            {creating ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />} Key erzeugen
          </Button>
        </div>

        {fresh && (
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: COLORS.accent, background: '#fff7f2' }}>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: COLORS.accent }}>
              <ShieldAlert className="h-4 w-4" /> Jetzt kopieren – der Key wird nicht erneut angezeigt!
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border bg-white px-3 py-2 text-sm" style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>{fresh}</code>
              <Button variant="secondary" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Kopiert' : 'Kopieren'}</Button>
            </div>
          </div>
        )}
      </SectionCard>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="mt-6 space-y-3">
          {keys.length === 0 && (
            <Card className="text-center"><span className="text-sm" style={{ color: COLORS.textMuted }}>Noch keine Keys erstellt.</span></Card>
          )}
          {keys.map((k) => (
            <Card key={k.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: COLORS.navy }}>{k.name}</span>
                    {k.revoked ? <Badge tone="danger">widerrufen</Badge> : <Badge tone="ok">aktiv</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: COLORS.textMuted }}>
                    <code>{k.key_prefix}…</code>
                    <span>erstellt {(k.created_at || '').slice(0, 10)}{k.created_by ? ` · ${k.created_by}` : ''}</span>
                    <span>{k.last_used_at ? `zuletzt genutzt ${(k.last_used_at || '').slice(0, 16).replace('T', ' ')}` : 'nie genutzt'}</span>
                  </div>
                </div>
                {!k.revoked && (
                  <Button size="sm" variant="ghost" onClick={() => revoke(k)} title="Widerrufen"><Trash2 className="h-4 w-4" /> Widerrufen</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
