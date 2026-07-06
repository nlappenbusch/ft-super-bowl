'use client';

import { useState, useEffect, useMemo } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { PageHeader, SectionCard, Badge, SelectInput, TextInput, COLORS } from '@/components/admin/ui';
import { Copy, Check, Code2, Send, Boxes, HelpCircle, LayoutGrid } from 'lucide-react';

interface Param { name: string; def?: string; required?: boolean; desc: string }
interface Shortcode { code: string; example: string; title: string; desc: string; params: Param[]; note?: string; recommended?: boolean }
interface Plugin { file: string; label: string; tone: 'ok' | 'warn'; desc: string; shortcodes: Shortcode[] }

const PLUGINS: Plugin[] = [
  {
    file: 'faltin-events.php',
    label: 'Empfohlen · generisch',
    tone: 'ok',
    desc: 'Die aktuelle, generische Integration für alle Serien & Events (serverseitig gerendert, kein iFrame).',
    shortcodes: [
      {
        code: '[faltin_events]',
        example: '[faltin_events serie="super-bowl" columns="3" cta="Zum Event"]',
        title: 'Event-Liste einer Serie',
        desc: 'Zeigt alle Events einer Serie als Karten-Grid mit Link zum jeweiligen Event.',
        params: [
          { name: 'serie', required: true, desc: 'Slug der Serie, z.B. super-bowl, ryder-cup.' },
          { name: 'columns', def: '3', desc: 'Spaltenanzahl des Grids.' },
          { name: 'limit', def: '0', desc: 'Max. Anzahl Events (0 = alle).' },
          { name: 'cta', def: 'Zum Event', desc: 'Text des Buttons je Karte.' },
          { name: 'cache', def: '600', desc: 'Cache-Dauer in Sekunden.' },
          { name: 'api_url', def: 'Standard', desc: 'Überschreibt den API-Server (selten nötig).' },
        ],
      },
      {
        code: '[faltin_event]',
        example: '[faltin_event event="super-bowl-2027" cta="Zum Event"]',
        title: 'Einzelnes Event',
        desc: 'Zeigt eine Karte/Teaser für ein einzelnes Event.',
        params: [
          { name: 'event', required: true, desc: 'Slug oder url_segment des Events.' },
          { name: 'cta', def: 'Zum Event', desc: 'Button-Text.' },
          { name: 'cache', def: '600', desc: 'Cache-Dauer in Sekunden.' },
          { name: 'api_url', def: 'Standard', desc: 'API-Server überschreiben.' },
        ],
      },
      {
        code: '[faltin_packages]',
        example: '[faltin_packages event="super-bowl-2027"]',
        title: 'Package-Karten (mit Formular-Fallback)',
        desc: 'Zeigt die buchbaren Packages des Events als Karten-Grid (Fotos, Leistungen, Preise, Ausgebucht-Status, Buchungslink). Ohne aktive Packages wird automatisch das Anfrageformular gerendert — gleiche Logik wie die Event-Seite.',
        recommended: true,
        params: [
          { name: 'event', required: true, desc: 'Event-Slug, z.B. super-bowl-2027.' },
          { name: 'name', def: '(leer)', desc: 'Anzeigename fürs Fallback-Formular.' },
          { name: 'cache', def: '600', desc: 'Cache-Dauer in Sekunden (0 = aus).' },
          { name: 'api_url', def: 'Standard', desc: 'API-Server überschreiben (selten nötig).' },
        ],
      },
      {
        code: '[faltin_anfrage]',
        example: '[faltin_anfrage event="super-bowl-2027" title="Jetzt unverbindlich anfragen"]',
        title: 'Anfrage-/Kontaktformular (mit Package-Auto-Logik)',
        desc: 'Eingebettetes Anfrageformular (serverseitig), sendet an /api/bookings. Ab Plugin 1.5.0: Hat das Event buchbare Packages, werden automatisch die Package-Karten ausgeliefert — bestehende Einbettungen bleiben gültig und upgraden von selbst. packages="0" erzwingt das reine Formular. Ab 1.7.0 liefert auch der Formular-Fall SportsEvent-JSON-LD (SEO/GEO) mit.',
        recommended: true,
        params: [
          { name: 'packages', def: 'auto', desc: 'auto = Package-Karten zeigen, wenn vorhanden; 0 = immer Formular.' },
          { name: 'event', def: 'allgemeine-anfrage', desc: 'Event-Slug, dem die Anfrage zugeordnet wird.' },
          { name: 'name', def: '(leer)', desc: 'Anzeigename des Events im Formular (sonst = event).' },
          { name: 'title', def: 'Jetzt unverbindlich anfragen', desc: 'Überschrift des Formulars.' },
          { name: 'intro', def: '(leer)', desc: 'Einleitungstext über dem Formular.' },
          { name: 'api_url', def: 'Standard', desc: 'API-Server überschreiben.' },
        ],
      },
    ],
  },
  {
    file: 'superbowl-integration.php',
    label: 'Älter · Super-Bowl-spezifisch',
    tone: 'warn',
    desc: 'Ältere Integration. Paket-/FAQ-Shortcodes sind weiter nützlich; die *_embed/_anfrage-Varianten nutzen iFrames (Scroll-Probleme möglich).',
    shortcodes: [
      {
        code: '[superbowl_package]',
        example: '[superbowl_package event="super-bowl-2027"]',
        title: 'Paketkarte (Festpreis)',
        desc: 'Zeigt eine Paketkarte mit festem Preis – ohne Interaktion.',
        params: [
          { name: 'event', desc: 'Event-Slug (lädt dessen Pakete).' },
          { name: 'package', desc: 'Optional: bestimmtes Paket per Slug/ID.' },
          { name: 'api_url', def: '…/api/package', desc: 'API-Endpoint überschreiben.' },
        ],
      },
      {
        code: '[superbowl_package_advanced]',
        example: '[superbowl_package_advanced event="super-bowl-2027"]',
        title: 'Paketkarte mit Personen-Auswahl ⭐',
        desc: 'Wie oben, aber mit Personen-Dropdown (1–10) und Live-Preisberechnung (Preis pro Person).',
        recommended: true,
        params: [
          { name: 'event', desc: 'Event-Slug.' },
          { name: 'package', desc: 'Optional: bestimmtes Paket.' },
          { name: 'api_url', def: '…/api/package-advanced', desc: 'API-Endpoint überschreiben.' },
        ],
      },
      {
        code: '[superbowl_faqs]',
        example: '[superbowl_faqs event="super-bowl-2027"]',
        title: 'FAQ-Accordion',
        desc: 'Häufige Fragen als aufklappbares Accordion.',
        params: [
          { name: 'event', desc: 'Event-Slug (dessen FAQs).' },
          { name: 'api_url', def: '…/api/faqs', desc: 'API-Endpoint überschreiben.' },
        ],
      },
      {
        code: '[superbowl_embed]',
        example: '[superbowl_embed url="https://next.faltintravel.com/embed" height="3000"]',
        title: 'Voll-Embed (iFrame)',
        desc: 'Bettet eine komplette Next.js-Seite als iFrame ein.',
        note: 'iFrame – kann Scroll-/Höhenprobleme verursachen. Wenn möglich die serverseitigen Shortcodes nutzen.',
        params: [
          { name: 'url', def: '…/embed', desc: 'Einzubettende URL.' },
          { name: 'height', def: '3000', desc: 'iFrame-Höhe in Pixel.' },
        ],
      },
      {
        code: '[superbowl_anfrage]',
        example: '[superbowl_anfrage event="super-bowl-2027" height="880"]',
        title: 'Anfrage-Embed (iFrame)',
        desc: 'Anfrageformular als iFrame (/embed/anfrage).',
        note: 'iFrame-Variante. Das serverseitige [faltin_anfrage] ist meist die bessere Wahl.',
        params: [
          { name: 'event', desc: 'Event-Slug für die Anfrage.' },
          { name: 'name', desc: 'Anzeigename des Events.' },
          { name: 'url', def: '…/embed/anfrage', desc: 'Einzubettende URL.' },
          { name: 'height', def: '880', desc: 'iFrame-Höhe in Pixel.' },
        ],
      },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
      style={{ background: copied ? COLORS.ok : COLORS.navy }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Kopiert' : 'Kopieren'}
    </button>
  );
}

function ShortcodeCard({ sc }: { sc: Shortcode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: COLORS.stroke }}>
      <div className="mb-1 flex items-center gap-2">
        <code className="rounded bg-gray-100 px-2 py-0.5 text-sm font-bold" style={{ color: COLORS.navy }}>{sc.code}</code>
        {sc.recommended && <Badge tone="ok">empfohlen</Badge>}
      </div>
      <p className="mb-3 text-sm text-gray-600">{sc.desc}</p>

      <div className="mb-3 flex items-center gap-2 rounded-lg p-2.5" style={{ background: '#0f1f30' }}>
        <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-green-300">{sc.example}</code>
        <CopyButton text={sc.example} />
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
            <th className="py-1 pr-3">Parameter</th>
            <th className="py-1 pr-3">Standard</th>
            <th className="py-1">Bedeutung</th>
          </tr>
        </thead>
        <tbody>
          {sc.params.map((p) => (
            <tr key={p.name} className="border-t align-top" style={{ borderColor: COLORS.stroke }}>
              <td className="py-1.5 pr-3 font-mono font-semibold" style={{ color: COLORS.navy }}>
                {p.name}{p.required && <span className="ml-1 text-red-500" title="Pflicht">*</span>}
              </td>
              <td className="py-1.5 pr-3 text-gray-500">{p.def ?? '—'}</td>
              <td className="py-1.5 text-gray-600">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sc.note && (
        <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>⚠️ {sc.note}</p>
      )}
    </div>
  );
}

const EVENT_TEMPLATES: { key: string; label: string; tpl: (slug: string, name: string) => string }[] = [
  { key: 'anfrage', label: '[faltin_anfrage] – Anfrageformular', tpl: (s, n) => `[faltin_anfrage event="${s}" name="${n}"]` },
  { key: 'event', label: '[faltin_event] – Event-Teaser', tpl: (s) => `[faltin_event event="${s}"]` },
  { key: 'pkg_adv', label: '[superbowl_package_advanced] – Paket + Personen', tpl: (s) => `[superbowl_package_advanced event="${s}"]` },
  { key: 'pkg', label: '[superbowl_package] – Paket (Festpreis)', tpl: (s) => `[superbowl_package event="${s}"]` },
  { key: 'faqs', label: '[superbowl_faqs] – FAQ-Accordion', tpl: (s) => `[superbowl_faqs event="${s}"]` },
];

interface Ev { slug: string; name?: string; title?: string; status?: string }

function ResolvedPerEvent() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tplKey, setTplKey] = useState('anfrage');
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    fetch('/api/events').then((r) => r.json()).then((d) => { if (d.success) setEvents(d.data || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const tpl = EVENT_TEMPLATES.find((t) => t.key === tplKey) || EVENT_TEMPLATES[0];
  const rows = useMemo(() => {
    const list = events
      .filter((e) => (e.status || 'active') !== 'archived')
      .map((e) => { const name = e.name || e.title || e.slug; return { name, slug: e.slug, code: tpl.tpl(e.slug, name) }; })
      .sort((a, b) => a.name.localeCompare(b.name));
    const k = q.trim().toLowerCase();
    return k ? list.filter((r) => r.name.toLowerCase().includes(k) || r.slug.toLowerCase().includes(k)) : list;
  }, [events, tpl, q]);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(rows.map((r) => `${r.name}: ${r.code}`).join('\n')); setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1500); } catch { /* ignore */ }
  };

  return (
    <SectionCard
      className="mt-6"
      title="Aufgelöst je Event"
      icon={<Send className="h-4 w-4" />}
      description="Fertige Shortcodes mit eingesetztem Event-Slug – pro Event kopieren oder alle auf einmal. Vorlage oben umschalten."
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SelectInput value={tplKey} onChange={(e) => setTplKey(e.target.value)} className="w-auto">
          {EVENT_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </SelectInput>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Event suchen…" className="w-56" />
        <button type="button" onClick={copyAll} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: COLORS.navy }}>
          {copiedAll ? '✓ Alle kopiert' : `Alle kopieren (${rows.length})`}
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Lädt Events…</p>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto rounded-xl border" style={{ borderColor: COLORS.stroke }}>
          {rows.map((r) => (
            <div key={r.slug} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0" style={{ borderColor: COLORS.stroke }}>
              <div className="w-48 shrink-0 truncate text-sm font-semibold" style={{ color: COLORS.navy }} title={r.name}>{r.name}</div>
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded px-2 py-1 text-xs" style={{ background: '#0f1f30', color: '#86efac' }}>{r.code}</code>
              <CopyButton text={r.code} />
            </div>
          ))}
          {rows.length === 0 && <p className="px-3 py-3 text-sm text-gray-500">Keine Events gefunden.</p>}
        </div>
      )}
    </SectionCard>
  );
}

interface SugItem { event_slug: string; event_name: string; score: number; shortcode: string }
interface SugRes { title: string; id?: string; suggestion: SugItem | null; alternatives: SugItem[] }

function scoreColor(s: number) { return s >= 0.6 ? COLORS.ok : s >= 0.34 ? '#d97706' : '#dc2626'; }

function SugLine({ s, faint }: { s: SugItem; faint?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${faint ? 'opacity-80' : ''}`}>
      <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: scoreColor(s.score) }}>{Math.round(s.score * 100)}%</span>
      <span className="text-xs font-semibold" style={{ color: COLORS.navy }}>{s.event_name}</span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap rounded px-2 py-1 text-[11px]" style={{ background: '#0f1f30', color: '#86efac' }}>{s.shortcode}</code>
      <CopyButton text={s.shortcode} />
    </div>
  );
}

function Cf7Migrator() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SugRes[] | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const lines = input.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    setLoading(true);
    try {
      const r = await fetch('/api/wp/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines }) });
      const d = await r.json();
      setResults(d.success ? d.results : []);
    } catch { setResults([]); } finally { setLoading(false); }
  };

  return (
    <SectionCard
      className="mt-6"
      title="CF7 → Anfrage migrieren"
      icon={<Send className="h-4 w-4" />}
      description="Contact-Form-7-Shortcodes (oder nur die Titel) reinkopieren – pro Stück kommt der passende [faltin_anfrage]-Vorschlag mit Konfidenz zum Kopieren. Eine Zeile pro Formular."
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        placeholder={'[contact-form-7 id="35398" title="_Wimbledon Tennis"]\n[contact-form-7 id="35401" title="Ryder Cup 2027"]'}
        className="w-full rounded-lg border px-3 py-2 font-mono text-xs"
        style={{ borderColor: COLORS.stroke }}
      />
      <div className="mt-2">
        <button type="button" onClick={run} disabled={loading} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>
          {loading ? '… analysiert' : 'Vorschläge holen'}
        </button>
      </div>

      {results && (
        <div className="mt-4 space-y-3">
          {results.length === 0 && <p className="text-sm text-gray-500">Keine Eingabe erkannt.</p>}
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border p-3" style={{ borderColor: COLORS.stroke }}>
              <div className="mb-2 text-xs text-gray-500">CF7: <b style={{ color: COLORS.navy }}>{r.title}</b>{r.id ? ` (id ${r.id})` : ''}</div>
              {r.suggestion ? (
                <SugLine s={r.suggestion} />
              ) : (
                <p className="text-xs" style={{ color: '#b45309' }}>Kein sicherer Treffer – bitte manuell wählen{r.alternatives.length ? ':' : '.'}</p>
              )}
              {r.alternatives.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t pt-2" style={{ borderColor: COLORS.stroke }}>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Alternativen</div>
                  {r.alternatives.map((a, j) => <SugLine key={j} s={a} faint />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/** Download-Karte: liefert immer die aktuell deployte Plugin-Version als ZIP. */
function PluginDownloadCard() {
  const [version, setVersion] = useState<string>('');
  useEffect(() => {
    fetch('/api/admin/plugin?info=1')
      .then((r) => r.json())
      .then((j) => { if (j?.success) setVersion(j.data.version); })
      .catch(() => { /* Karte zeigt dann keinen Versionsstand */ });
  }, []);
  return (
    <SectionCard title="WordPress-Plugin herunterladen" icon={<Boxes className="h-4 w-4" />}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-gray-700">
          <p className="m-0">
            Immer die <b>aktuell deployte Version</b> — die ZIP wird live vom Server gepackt.
            {version && <> Aktuell: <Badge tone="ok">v{version}</Badge></>}
          </p>
          <p className="m-0 mt-1 text-xs text-gray-500">
            In WordPress: Plugins → Installieren → Plugin hochladen → ZIP wählen → „Jetzt ersetzen".
          </p>
        </div>
        <a
          href="/api/admin/plugin"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: '#d9531e' }}
          download
        >
          ⬇ faltin-events{version ? `-${version}` : ''}.zip
        </a>
      </div>
    </SectionCard>
  );
}

export default function ShortcodesPage() {
  return (
    <AdminShell title="WP-Shortcodes">
      <PageHeader
        title="WordPress-Shortcodes"
        description="Alle Shortcodes, mit denen Inhalte dieser Plattform in die WordPress-Seite (faltintravel.com) eingebunden werden. Snippet kopieren, in eine WordPress-Seite/Block einfügen, Parameter anpassen."
      />

      <PluginDownloadCard />

      <SectionCard title="So funktioniert's" icon={<Code2 className="h-4 w-4" />}>
        <ol className="list-inside list-decimal space-y-1 text-sm text-gray-700">
          <li>WordPress-Plugin aktiv? (<code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">wordpress-plugin/faltin-events.php</code> bzw. <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">superbowl-integration.php</code>)</li>
          <li>Unten den passenden Shortcode <b>kopieren</b>.</li>
          <li>In WordPress in eine Seite / einen Shortcode-Block einfügen.</li>
          <li><b>Parameter anpassen</b> (z.B. <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">event="…"</code> / <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">serie="…"</code>). Mit <span className="text-red-500">*</span> markierte sind Pflicht.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> Pakete</span>
          <span className="inline-flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> FAQs</span>
          <span className="inline-flex items-center gap-1"><Send className="h-3.5 w-3.5" /> Anfrage</span>
          <span className="inline-flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" /> Listen/Embeds</span>
        </div>
      </SectionCard>

      <Cf7Migrator />

      <ResolvedPerEvent />

      {PLUGINS.map((plugin) => (
        <SectionCard
          key={plugin.file}
          className="mt-6"
          title={plugin.file}
          icon={<Code2 className="h-4 w-4" />}
          description={plugin.desc}
        >
          <div className="mb-3"><Badge tone={plugin.tone}>{plugin.label}</Badge></div>
          <div className="grid gap-4 lg:grid-cols-2">
            {plugin.shortcodes.map((sc) => <ShortcodeCard key={sc.code} sc={sc} />)}
          </div>
        </SectionCard>
      ))}
    </AdminShell>
  );
}
