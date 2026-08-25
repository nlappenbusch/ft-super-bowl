'use client';

/**
 * /admin/mcp — KI-Zugang (MCP-Server) verwalten (TASK-00125).
 * ─────────────────────────────────────────────────────────────────────────────
 * FT-Mitarbeiter verbinden ihre KI (Claude, ChatGPT, …) mit dem Portal über
 * einen persönlichen API-Key. Hier: Zugänge erstellen (mit Werkzeugumfang),
 * persönliche Token-URL kopieren, Scopes nachträglich ändern, widerrufen —
 * plus Einrichtungsanleitungen für die gängigen Clients.
 * Die Tool-Gruppen müssen mit MCP_TOOL_GROUPS in src/lib/mcpServer.ts
 * übereinstimmen (dort serverseitig, hier fürs UI gespiegelt).
 */
import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { PageHeader, SectionCard, Card, Button, Field, TextInput, Badge, Spinner, COLORS } from '@/components/admin/ui';
import { Bot, Plus, Trash2, Copy, Check, ShieldAlert, KeyRound, Link2, Wrench } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  created_by: string;
  last_used_at: string | null;
  revoked: number;
  scopes: string;
}

/** Muss mit MCP_TOOL_GROUPS in src/lib/mcpServer.ts übereinstimmen. */
const TOOL_GROUPS = [
  { id: 'content', label: 'Website-Inhalte', description: 'Events, Serien, Pakete, FAQs (nur lesen)' },
  { id: 'bookings', label: 'Anfragen & Buchungen', description: 'Status nachschlagen und auflisten' },
  { id: 'customers', label: 'Kunden', description: 'Suchen, anlegen, aktualisieren' },
  { id: 'offers', label: 'Angebote & Rechnungen', description: 'Kalkulationen, Angebots-PDF, Rechnung aus Angebot' },
  { id: 'tasks', label: 'Aufgaben', description: 'Ticketsystem inkl. Zeitbuchung' },
] as const;

const ALL_IDS = TOOL_GROUPS.map((g) => g.id as string);

function scopesToList(scopes: string): string[] {
  const raw = (scopes || 'all').trim();
  if (!raw || raw === 'all') return [...ALL_IDS];
  return raw.split(',').map((x) => x.trim()).filter((x) => ALL_IDS.includes(x));
}

function listToScopes(list: string[]): string {
  const valid = ALL_IDS.filter((g) => list.includes(g));
  return valid.length === ALL_IDS.length || valid.length === 0 ? 'all' : valid.join(',');
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary" size="sm"
      onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Kopiert' : (label || 'Kopieren')}
    </Button>
  );
}

export default function McpAdminPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [newScopes, setNewScopes] = useState<string[]>([...ALL_IDS]);
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ plaintext: string; name: string } | null>(null);
  const [origin, setOrigin] = useState('https://next.faltintravel.com');
  const [editScopes, setEditScopes] = useState<string | null>(null); // key.id im Scope-Editor
  const [editList, setEditList] = useState<string[]>([]);
  const [savingScopes, setSavingScopes] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) setOrigin(window.location.origin);
  }, []);

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
    setCreating(true); setFresh(null);
    try {
      const r = await fetch('/api/admin/api-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), scopes: listToScopes(newScopes) }),
      }).then((x) => x.json());
      if (r.success) { setFresh({ plaintext: r.data.plaintext, name: name.trim() }); setName(''); setNewScopes([...ALL_IDS]); await load(); }
    } finally { setCreating(false); }
  };

  const revoke = async (k: ApiKey) => {
    if (!confirm(`Zugang "${k.name}" widerrufen? Die KI dieses Mitarbeiters verliert sofort den Zugriff.`)) return;
    await fetch(`/api/admin/api-keys/${k.id}`, { method: 'DELETE' });
    load();
  };

  const openScopeEditor = (k: ApiKey) => {
    setEditScopes(k.id);
    setEditList(scopesToList(k.scopes));
  };

  const saveScopes = async (k: ApiKey) => {
    setSavingScopes(true);
    try {
      await fetch(`/api/admin/api-keys/${k.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: listToScopes(editList) }),
      });
      setEditScopes(null);
      await load();
    } finally { setSavingScopes(false); }
  };

  const tokenUrl = (plaintext: string) => `${origin}/api/mcp/${plaintext}`;

  const ScopeChecks = ({ list, onToggle }: { list: string[]; onToggle: (id: string, on: boolean) => void }) => (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {TOOL_GROUPS.map((g) => (
        <label key={g.id} className="flex cursor-pointer items-start gap-2 text-xs" style={{ color: COLORS.navy }}>
          <input
            type="checkbox" className="mt-0.5"
            checked={list.includes(g.id)}
            onChange={(e) => onToggle(g.id, e.target.checked)}
            style={{ accentColor: COLORS.accent }}
          />
          <span><span className="font-semibold">{g.label}</span><br /><span style={{ color: COLORS.textMuted }}>{g.description}</span></span>
        </label>
      ))}
    </div>
  );

  return (
    <AdminShell title="KI-Zugang (MCP)">
      <PageHeader
        title="KI-Zugang (MCP-Server)"
        description="Mitarbeiter verbinden ihre KI (Claude, ChatGPT, …) direkt mit dem Portal: Kunden, Angebote, Rechnungen, Buchungsstatus und Aufgaben — per persönlicher Zugangs-URL."
      />

      <SectionCard
        title="Neuen Zugang erstellen"
        description="Pro Mitarbeiter (oder Anwendung) einen eigenen Zugang — so lässt er sich einzeln widerrufen und der Werkzeugumfang einschränken."
        icon={<Plus className="h-4 w-4" />}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Bezeichnung" className="min-w-[240px] flex-1">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Stefan / ChatGPT" onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
            </Field>
            <Button variant="accent" onClick={create} disabled={creating || !name.trim()}>
              {creating ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />} Zugang erstellen
            </Button>
          </div>
          <Field label="Werkzeugumfang" hint="Standard: alles. Einschränken z.B. für reine Auskunfts-KIs.">
            <ScopeChecks list={newScopes} onToggle={(id, on) => setNewScopes((prev) => on ? [...prev, id] : prev.filter((x) => x !== id))} />
          </Field>
        </div>

        {fresh && (
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: COLORS.accent, background: '#fff7f2' }}>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: COLORS.accent }}>
              <ShieldAlert className="h-4 w-4" /> Jetzt kopieren — Key und URL werden nicht erneut angezeigt!
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                  Persönliche Zugangs-URL für {fresh.name} — in Claude/ChatGPT als MCP-Server eintragen
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg border bg-white px-3 py-2 text-xs" style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>{tokenUrl(fresh.plaintext)}</code>
                  <CopyButton value={tokenUrl(fresh.plaintext)} label="URL kopieren" />
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                  API-Key (für Clients mit Header-Auth: Authorization: Bearer …)
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg border bg-white px-3 py-2 text-xs" style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>{fresh.plaintext}</code>
                  <CopyButton value={fresh.plaintext} label="Key kopieren" />
                </div>
              </div>
              <p className="text-[11px]" style={{ color: COLORS.warn }}>
                Die URL wirkt wie ein Passwort: nur an die betreffende Person geben, nicht in Chats oder Dokumente einfügen. Bei Verlust hier widerrufen.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="mt-6">
        <SectionCard title="Bestehende Zugänge" icon={<Bot className="h-4 w-4" />}>
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="space-y-3">
              {keys.length === 0 && (
                <Card className="text-center"><span className="text-sm" style={{ color: COLORS.textMuted }}>Noch keine Zugänge erstellt.</span></Card>
              )}
              {keys.map((k) => (
                <Card key={k.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: COLORS.navy }}>{k.name}</span>
                        {k.revoked ? <Badge tone="danger">widerrufen</Badge> : <Badge tone="ok">aktiv</Badge>}
                        {!k.revoked && (
                          <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
                            {scopesToList(k.scopes).length === ALL_IDS.length
                              ? 'voller Umfang'
                              : scopesToList(k.scopes).map((id) => TOOL_GROUPS.find((g) => g.id === id)?.label || id).join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: COLORS.textMuted }}>
                        <code>{k.key_prefix}…</code>
                        <span>erstellt {(k.created_at || '').slice(0, 10)}{k.created_by ? ` · ${k.created_by}` : ''}</span>
                        <span>{k.last_used_at ? `zuletzt genutzt ${(k.last_used_at || '').slice(0, 16).replace('T', ' ')}` : 'nie genutzt'}</span>
                      </div>
                    </div>
                    {!k.revoked && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openScopeEditor(k)} title="Werkzeugumfang ändern"><Wrench className="h-4 w-4" /> Umfang</Button>
                        <Button size="sm" variant="ghost" onClick={() => revoke(k)} title="Widerrufen"><Trash2 className="h-4 w-4" /> Widerrufen</Button>
                      </div>
                    )}
                  </div>
                  {editScopes === k.id && (
                    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: COLORS.stroke, background: COLORS.surfaceMuted }}>
                      <ScopeChecks list={editList} onToggle={(id, on) => setEditList((prev) => on ? [...prev, id] : prev.filter((x) => x !== id))} />
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="accent" onClick={() => saveScopes(k)} disabled={savingScopes}>
                          {savingScopes ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} Speichern
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditScopes(null)}>Abbrechen</Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title="Einrichtung in den Clients"
          description="Die persönliche Zugangs-URL ist alles, was ein Mitarbeiter braucht."
          icon={<Link2 className="h-4 w-4" />}
        >
          <div className="space-y-4 text-sm" style={{ color: COLORS.navy }}>
            <div>
              <div className="font-bold">Claude (claude.ai / Desktop)</div>
              <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                Einstellungen → Connectors → «Custom Connector hinzufügen» → als Remote-MCP-Server-URL die persönliche
                Zugangs-URL eintragen (ohne weitere Authentifizierung). Danach stehen die Portal-Werkzeuge in jedem Chat zur Verfügung.
              </p>
            </div>
            <div>
              <div className="font-bold">ChatGPT</div>
              <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                Einstellungen → Connectors (Entwicklermodus aktivieren) → «Connector hinzufügen» → die persönliche Zugangs-URL als
                MCP-Server-URL eintragen, Authentifizierung «Keine». Der Server nutzt Streamable HTTP (JSON).
              </p>
            </div>
            <div>
              <div className="font-bold">Claude Code (Terminal)</div>
              <code className="mt-1 block overflow-x-auto rounded-lg border bg-white px-3 py-2 text-xs" style={{ borderColor: COLORS.stroke }}>
                claude mcp add --transport http faltin-portal {origin}/api/mcp/&lt;ftk_…&gt;
              </code>
            </div>
            <div>
              <div className="font-bold">Andere Clients (Header-Auth)</div>
              <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                Endpoint <code>{origin}/api/mcp</code> mit Header <code>Authorization: Bearer ftk_…</code> — z.B. für den
                ElevenLabs-Voice-Agent oder eigene Integrationen.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
