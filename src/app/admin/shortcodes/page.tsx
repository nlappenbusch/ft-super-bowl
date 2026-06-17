'use client';

import { useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { PageHeader, SectionCard, Badge, COLORS } from '@/components/admin/ui';
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
        code: '[faltin_anfrage]',
        example: '[faltin_anfrage event="super-bowl-2027" title="Jetzt unverbindlich anfragen"]',
        title: 'Anfrage-/Kontaktformular',
        desc: 'Eingebettetes Anfrageformular (serverseitig). Sendet an /api/bookings.',
        recommended: true,
        params: [
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

export default function ShortcodesPage() {
  return (
    <AdminShell title="WP-Shortcodes">
      <PageHeader
        title="WordPress-Shortcodes"
        description="Alle Shortcodes, mit denen Inhalte dieser Plattform in die WordPress-Seite (faltintravel.com) eingebunden werden. Snippet kopieren, in eine WordPress-Seite/Block einfügen, Parameter anpassen."
      />

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
