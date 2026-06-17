'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Yoast-artiger Meta-Editor: Fokus-Keyword, Meta-Titel & -Description mit
 * Längen-Ampel, Google-SERP-Vorschau und On-Page-Keyword-Checks.
 * Speichert über onChange(field, value) (wie die übrigen Editor-Felder).
 */
type Status = 'ok' | 'warn' | 'bad' | 'info';

const DOT: Record<Status, string> = { ok: '#16a34a', warn: '#d97706', bad: '#dc2626', info: '#94a3b8' };

function norm(s: string) { return (s || '').toLowerCase().trim(); }
function has(haystack: string, needle: string) {
  const n = norm(needle); return !!n && norm(haystack).includes(n);
}

export default function SeoMetaEditor({
  seoTitle, seoDescription, focusKeyword, pageTitle, bodyText, imagesTotal = 0, imagesWithAlt = 0, onChange,
}: {
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  pageTitle: string;
  bodyText: string;
  imagesTotal?: number;
  imagesWithAlt?: number;
  onChange: (field: string, value: string) => void;
}) {
  const [title, setTitle] = useState(seoTitle);
  const [desc, setDesc] = useState(seoDescription);
  const [kw, setKw] = useState(focusKeyword);
  const [url, setUrl] = useState<{ host: string; path: string }>({ host: 'next.faltintravel.com', path: '/' });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const runAi = async () => {
    setAiBusy(true); setAiError(null);
    try {
      const r = await fetch('/api/admin/seo/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: url.path }) });
      const d = await r.json();
      if (d.success) {
        if (d.title) { setTitle(d.title); onChange('seo_title', d.title); }
        if (d.description) { setDesc(d.description); onChange('seo_description', d.description); }
        if (d.keyword) { setKw(d.keyword); onChange('focus_keyword', d.keyword); }
      } else setAiError(d.error || 'KI-Fehler');
    } catch { setAiError('KI-Fehler'); } finally { setAiBusy(false); }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl({ host: window.location.host, path: decodeURIComponent(window.location.pathname) });
    }
  }, []);

  const effTitle = (title || pageTitle || '').trim();
  const effDesc = (desc || '').trim();

  const titleLen = effTitle.length;
  const descLen = effDesc.length;

  const titleStatus: Status = titleLen === 0 ? 'bad' : titleLen < 30 ? 'warn' : titleLen <= 60 ? 'ok' : titleLen <= 65 ? 'warn' : 'bad';
  const descStatus: Status = descLen === 0 ? 'bad' : descLen < 80 ? 'warn' : descLen <= 160 ? 'ok' : descLen <= 175 ? 'warn' : 'bad';

  const checks = useMemo(() => {
    const k = norm(kw);
    const list: { label: string; status: Status; hint: string }[] = [];
    list.push({
      label: 'Meta-Titel-Länge',
      status: titleStatus,
      hint: titleLen === 0 ? 'Kein Titel – Google nimmt den Seitentitel.' : `${titleLen} Zeichen (optimal 40–60).`,
    });
    list.push({
      label: 'Meta-Description-Länge',
      status: descStatus,
      hint: descLen === 0 ? 'Keine Description – Google generiert selbst eine.' : `${descLen} Zeichen (optimal 120–160).`,
    });
    if (!k) {
      list.push({ label: 'Fokus-Keyword', status: 'info', hint: 'Kein Keyword gesetzt – ohne Keyword keine Keyword-Checks.' });
    } else {
      list.push({ label: 'Keyword im Meta-Titel', status: has(effTitle, k) ? 'ok' : 'warn', hint: has(effTitle, k) ? 'Vorhanden.' : 'Keyword fehlt im Titel.' });
      list.push({ label: 'Keyword in der Description', status: has(effDesc, k) ? 'ok' : 'warn', hint: has(effDesc, k) ? 'Vorhanden.' : 'Keyword fehlt in der Description.' });
      list.push({ label: 'Keyword in der URL', status: has(url.path.replace(/-/g, ' '), k) || has(url.path, k) ? 'ok' : 'warn', hint: 'Im URL-Pfad.' });
      list.push({ label: 'Keyword im Seitentext', status: has(`${pageTitle} ${bodyText}`, k) ? 'ok' : 'warn', hint: has(`${pageTitle} ${bodyText}`, k) ? 'Kommt im Inhalt vor.' : 'Keyword im Seiteninhalt nicht gefunden.' });
    }
    // Inhaltslänge
    const words = (bodyText || '').split(/\s+/).filter(Boolean).length;
    list.push({
      label: 'Inhaltslänge',
      status: words >= 300 ? 'ok' : words >= 120 ? 'warn' : 'bad',
      hint: `${words} Wörter (≥300 empfohlen).`,
    });
    // Bild-Alt-Abdeckung
    if (imagesTotal === 0) {
      list.push({ label: 'Bild-Alt-Texte', status: 'info', hint: 'Keine Bilder auf dieser Seite erfasst.' });
    } else {
      list.push({
        label: 'Bild-Alt-Texte',
        status: imagesWithAlt >= imagesTotal ? 'ok' : imagesWithAlt > 0 ? 'warn' : 'bad',
        hint: `${imagesWithAlt}/${imagesTotal} Bildern mit Alt-Text.`,
      });
    }
    return list;
  }, [kw, effTitle, effDesc, titleLen, descLen, titleStatus, descStatus, url.path, pageTitle, bodyText, imagesTotal, imagesWithAlt]);

  const score = useMemo(() => {
    const rel = checks.filter((c) => c.status !== 'info');
    if (rel.length === 0) return 0;
    const pts = rel.reduce((s, c) => s + (c.status === 'ok' ? 1 : c.status === 'warn' ? 0.4 : 0), 0);
    return Math.round((pts / rel.length) * 100);
  }, [checks]);
  const scoreColor = score >= 75 ? DOT.ok : score >= 45 ? DOT.warn : DOT.bad;

  const set = (field: 'seo_title' | 'seo_description' | 'focus_keyword', v: string, local: (s: string) => void) => {
    local(v);
    onChange(field, v);
  };

  const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm text-gray-900';
  const inputStyle = { borderColor: '#d8dde4' } as React.CSSProperties;
  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

  return (
    <div className="space-y-4">
      {/* Gesamt-Ampel + KI */}
      <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: '#f6f8fa' }}>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: scoreColor }}>{score}</span>
        <div className="flex-1 text-xs text-gray-600">SEO-Score dieser Seite · {score >= 75 ? 'gut' : score >= 45 ? 'verbesserbar' : 'schwach'}</div>
        <button type="button" onClick={runAi} disabled={aiBusy} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>
          {aiBusy ? '… denkt' : '✨ KI-Vorschlag'}
        </button>
      </div>
      {aiError && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>{aiError}</div>}

      {/* Google SERP-Vorschau */}
      <div className="rounded-xl border p-3" style={{ borderColor: '#e5e8ed' }}>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Google-Vorschau</div>
        <div className="text-[12px] text-[#202124]">{url.host}{url.path}</div>
        <div className="text-[18px] leading-snug" style={{ color: '#1a0dab' }}>{truncate(effTitle || 'Kein Titel', 60)}</div>
        <div className="text-[13px] leading-snug" style={{ color: '#4d5156' }}>
          {effDesc ? truncate(effDesc, 160) : <span className="italic text-gray-400">Keine Description – Google generiert sie automatisch aus dem Seiteninhalt.</span>}
        </div>
      </div>

      {/* Fokus-Keyword */}
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-gray-600">Fokus-Keyword</span>
        <input type="text" value={kw} onChange={(e) => set('focus_keyword', e.target.value, setKw)} placeholder="z.B. Super Bowl Reise" className={inputCls} style={inputStyle} />
      </label>

      {/* Meta-Titel */}
      <label className="block">
        <span className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-600">
          <span>Meta-Titel</span>
          <span style={{ color: DOT[titleStatus] }}>{titleLen}/60</span>
        </span>
        <input type="text" value={title} onChange={(e) => set('seo_title', e.target.value, setTitle)} placeholder={pageTitle || 'Suchergebnis-Titel'} className={inputCls} style={{ ...inputStyle, borderColor: DOT[titleStatus] }} />
      </label>

      {/* Meta-Description */}
      <label className="block">
        <span className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-600">
          <span>Meta-Description</span>
          <span style={{ color: DOT[descStatus] }}>{descLen}/160</span>
        </span>
        <textarea rows={3} value={desc} onChange={(e) => set('seo_description', e.target.value, setDesc)} placeholder="Suchergebnis-Text (120–160 Zeichen)" className={inputCls} style={{ ...inputStyle, borderColor: DOT[descStatus] }} />
      </label>

      {/* Checkliste */}
      <div className="rounded-xl border p-3" style={{ borderColor: '#e5e8ed' }}>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Analyse</div>
        <ul className="space-y-1.5">
          {checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[c.status] }} />
              <span className="text-gray-700"><b>{c.label}:</b> {c.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] italic text-gray-400">Leer lassen = Titel/Description werden automatisch aus dem Event generiert. Änderungen werden automatisch gespeichert.</p>
    </div>
  );
}
