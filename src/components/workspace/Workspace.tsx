'use client';

/**
 * Workspace.tsx — Der KI-Arbeitsplatz (/working-dashboard).
 * Desktop (≥1280px): links „Heute“, Mitte Chat, rechts Posteingang/Wissen/Werkstatt.
 * Schmaler: Reiter oben, ein Bereich zur Zeit.
 */
import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, MessageSquare, Inbox, BookOpen, Lightbulb, Settings2, CircleCheck, CircleAlert, X } from 'lucide-react';
import { COLORS, Spinner } from '@/components/admin/ui';
import ChatPanel from './ChatPanel';
import TodayPanel from './TodayPanel';
import InboxPanel from './InboxPanel';
import KnowledgePanel from './KnowledgePanel';
import WorkshopPanel from './WorkshopPanel';
import { api, jsonInit, type ChatRequest, type WorkspaceStatus } from './types';

type Pane = 'heute' | 'chat' | 'post' | 'wissen' | 'werkstatt';
type SidePane = 'post' | 'wissen' | 'werkstatt';

const PANES: Array<{ id: Pane; label: string; icon: React.ReactNode }> = [
  { id: 'heute', label: 'Heute', icon: <CalendarCheck className="h-4 w-4" /> },
  { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
  { id: 'post', label: 'Posteingang', icon: <Inbox className="h-4 w-4" /> },
  { id: 'wissen', label: 'Wissen', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'werkstatt', label: 'Werkstatt', icon: <Lightbulb className="h-4 w-4" /> },
];

function readStored(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, v: string) {
  try { window.localStorage.setItem(key, v); } catch { /* ohne Storage egal */ }
}

function StatusDot({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={hint}>
      {ok ? <CircleCheck className="h-3.5 w-3.5" style={{ color: COLORS.ok }} /> : <CircleAlert className="h-3.5 w-3.5" style={{ color: COLORS.warn }} />}
      {label}
    </span>
  );
}

interface WsSettings { workspace_model: string; workspace_agent_enabled: boolean; sharepoint_region: string; sharepoint_sites: string; models: string[]; can_edit: boolean }

function SettingsDialog({ status, onClose }: { status: WorkspaceStatus; onClose: () => void }) {
  const [s, setS] = useState<WsSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api<WsSettings>('/api/admin/workspace/settings').then(setS).catch((e) => setMsg((e as Error).message)); }, []);
  const save = async () => {
    if (!s) return;
    setSaving(true); setMsg(null);
    try { await api('/api/admin/workspace/settings', jsonInit('POST', s)); setMsg('Gespeichert.'); }
    catch (e) { setMsg((e as Error).message); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Einstellungen KI-Arbeitsplatz" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b px-5 py-3" style={{ borderColor: COLORS.stroke }}>
          <span className="text-sm font-bold" style={{ color: COLORS.navy }}>KI-Arbeitsplatz · Verbindungen</span>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 hover:bg-gray-100" aria-label="Schliessen"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-5 py-4 text-xs" style={{ color: COLORS.text }}>
          <div className="space-y-1.5">
            <StatusDot ok={status.ai.configured} label={status.ai.configured ? `KI verbunden (${status.ai.model})` : 'KI nicht verbunden — API-Key unter KI-Redaktion'} />
            <br /><StatusDot ok={status.mail.configured} label={status.mail.configured ? `Postfach ${status.mail.mailbox}` : 'Postfach nicht verbunden (E-Mail / M365)'} />
            <br /><StatusDot ok={status.sharepoint.can_read} label={status.sharepoint.can_read ? 'SharePoint lesbar' : 'SharePoint noch nicht freigegeben'} />
            {!status.sharepoint.can_read && <p className="ml-5" style={{ color: COLORS.textMuted }}>{status.sharepoint.hint}</p>}
            {status.sharepoint.roles && <p className="ml-5" style={{ color: COLORS.textMuted }}>Berechtigungen der App: {status.sharepoint.roles.join(', ') || '—'}</p>}
          </div>
          {!s && !msg && <Spinner className="h-4 w-4" />}
          {s && (
            <fieldset disabled={!s.can_edit} className="space-y-3">
              <label className="block font-semibold" style={{ color: COLORS.navy }}>Modell der Faltin-KI
                <select value={s.workspace_model} onChange={(e) => setS({ ...s, workspace_model: e.target.value })} className="mt-1 block w-full rounded-lg border px-2 py-1.5 font-normal" style={{ borderColor: COLORS.stroke }}>
                  {s.models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 font-semibold" style={{ color: COLORS.navy }}>
                <input type="checkbox" checked={s.workspace_agent_enabled} onChange={(e) => setS({ ...s, workspace_agent_enabled: e.target.checked })} />
                Hintergrund-Agent aktiv (sortiert Mails, erinnert an Offenes)
              </label>
              <label className="block font-semibold" style={{ color: COLORS.navy }}>SharePoint-Region (App-Suche)
                <input value={s.sharepoint_region} onChange={(e) => setS({ ...s, sharepoint_region: e.target.value })} placeholder="leer = automatisch (CHE, EUR …)" className="mt-1 block w-full rounded-lg border px-2 py-1.5 font-normal" style={{ borderColor: COLORS.stroke }} />
              </label>
              <label className="block font-semibold" style={{ color: COLORS.navy }}>Nur diese SharePoint-Sites durchsuchen (optional, eine URL pro Zeile)
                <textarea value={s.sharepoint_sites} onChange={(e) => setS({ ...s, sharepoint_sites: e.target.value })} rows={3} placeholder="https://faltintravel.sharepoint.com/sites/Team" className="mt-1 block w-full rounded-lg border px-2 py-1.5 font-normal" style={{ borderColor: COLORS.stroke }} />
              </label>
              {!s.can_edit && <p style={{ color: COLORS.textMuted }}>Ändern können nur Admins.</p>}
            </fieldset>
          )}
          {msg && <p style={{ color: msg === 'Gespeichert.' ? COLORS.ok : COLORS.danger }}>{msg}</p>}
        </div>
        {s?.can_edit && (
          <div className="border-t px-5 py-3" style={{ borderColor: COLORS.stroke }}>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: COLORS.accent }}>
              {saving && <Spinner className="h-3.5 w-3.5" />} Speichern
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Workspace() {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [pane, setPane] = useState<Pane>('chat');
  const [side, setSide] = useState<SidePane>('post');
  const [request, setRequest] = useState<ChatRequest | null>(null);
  const [prefill, setPrefill] = useState<{ n: number; text: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    api<WorkspaceStatus>('/api/admin/workspace/status').then(setStatus).catch(() => {});
    const stored = readStored('ft-ws-side');
    if (stored === 'post' || stored === 'wissen' || stored === 'werkstatt') setSide(stored);
    // ?q=… aus der Schnellsuche: nur ins Eingabefeld übernehmen — gesendet wird erst per Klick/Enter
    // (ein fremder Link soll die KI nie im Namen der Person handeln lassen).
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && q.trim()) {
      setPrefill({ n: Date.now(), text: q.trim().slice(0, 2000) });
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  /** Aus Heute/Posteingang/Wissen/Werkstatt: eigenes Thema → eigener, neuer Chat. */
  const ask = useCallback((text: string, context?: string) => {
    setRequest({ n: Date.now(), text, context, newChat: true });
    setPane('chat');
  }, []);

  const chooseSide = (p: SidePane) => { setSide(p); writeStored('ft-ws-side', p); };
  const onActivity = useCallback(() => setRefreshKey((k) => k + 1), []);

  const personName = status?.person.name || '';
  const aiReady = status ? status.ai.configured : true;

  /** Sichtbarkeit: ≥xl fester Platz, darunter nur der gewählte Reiter. */
  const vis = (p: Pane, xlSlot: boolean) => `${pane === p ? 'flex' : 'hidden'} ${xlSlot ? 'xl:flex' : 'xl:hidden'}`;

  const sideContent = (p: SidePane) => (
    p === 'post' ? <InboxPanel personName={personName} onAsk={ask} />
      : p === 'wissen' ? <KnowledgePanel isAdmin={!!status?.person.is_admin} myKey={status?.person.key || null} onAsk={ask} />
        : <WorkshopPanel onAsk={ask} />
  );

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: COLORS.surfaceMuted }}>
      {/* Reiter (schmal) */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b bg-white px-2 py-1.5 [scrollbar-width:none] xl:hidden" style={{ borderColor: COLORS.stroke }} aria-label="Bereiche">
        {PANES.map((p) => (
          <button key={p.id} onClick={() => setPane(p.id)} aria-current={pane === p.id ? 'page' : undefined}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: pane === p.id ? COLORS.navy : 'transparent', color: pane === p.id ? '#fff' : COLORS.navy }}>
            {p.icon} {p.label}
          </button>
        ))}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_400px] 2xl:grid-cols-[320px_minmax(0,1fr)_440px]">
        <div className={`${vis('heute', true)} min-h-0 flex-col border-r`} style={{ borderColor: COLORS.stroke }}>
          <TodayPanel onAsk={ask} refreshKey={refreshKey} isAdmin={!!status?.person.is_admin} />
        </div>

        <div className={`${vis('chat', true)} min-h-0 flex-col`}>
          <ChatPanel personName={personName} request={request} prefill={prefill} onActivity={onActivity} aiReady={aiReady} />
        </div>

        {/* Rechte Spalte (≥xl): Reiter Posteingang / Wissen / Werkstatt */}
        <div className="hidden min-h-0 flex-col border-l bg-white xl:flex" style={{ borderColor: COLORS.stroke }}>
          <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: COLORS.stroke }} role="tablist" aria-label="Seitenbereich">
            {PANES.filter((p) => p.id === 'post' || p.id === 'wissen' || p.id === 'werkstatt').map((p) => (
              <button key={p.id} role="tab" aria-selected={side === p.id} onClick={() => chooseSide(p.id as SidePane)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                style={{ background: side === p.id ? COLORS.navy : 'transparent', color: side === p.id ? '#fff' : COLORS.navy }}>
                {p.icon} {p.label}
              </button>
            ))}
            <button onClick={() => setShowSettings(true)} className="ml-auto rounded-lg p-1.5 hover:bg-gray-100" aria-label="Verbindungen und Einstellungen" title="Verbindungen & Einstellungen">
              <Settings2 className="h-4 w-4" style={{ color: COLORS.textMuted }} />
            </button>
          </div>
          <div className="min-h-0 flex-1" role="tabpanel">{sideContent(side)}</div>
        </div>

        {/* Schmal: Seitenbereiche als eigene Reiter */}
        {(['post', 'wissen', 'werkstatt'] as const).map((p) => (
          <div key={p} className={`${pane === p ? 'flex' : 'hidden'} min-h-0 flex-col bg-white xl:hidden`}>
            {pane === p && sideContent(p)}
          </div>
        ))}
      </div>

      {/* Statuszeile */}
      {status && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t bg-white px-4 py-1.5 text-[11px]" style={{ borderColor: COLORS.stroke, color: COLORS.textMuted }}>
          <StatusDot ok={status.ai.configured} label="KI" hint={status.ai.model} />
          <StatusDot ok={status.mail.configured} label="Postfach" hint={status.mail.mailbox || 'nicht verbunden'} />
          <StatusDot ok={status.sharepoint.can_read} label="SharePoint" hint={status.sharepoint.hint} />
          <button onClick={() => setShowSettings(true)} className="ml-auto inline-flex items-center gap-1 hover:underline xl:hidden"><Settings2 className="h-3 w-3" /> Verbindungen</button>
        </div>
      )}

      {showSettings && status && <SettingsDialog status={status} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
