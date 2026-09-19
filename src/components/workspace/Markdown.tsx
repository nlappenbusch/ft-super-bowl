'use client';

/**
 * Markdown.tsx — schlanker, sicherer Markdown-Renderer für Chat-Antworten.
 * Baut React-Elemente (kein dangerouslySetInnerHTML): Absätze, Überschriften,
 * Listen, Zitate, Code, einfache Tabellen, **fett**, *kursiv*, `code`, Links
 * (nur http(s), mailto und interne Pfade).
 */
import React from 'react';
import { COLORS } from '@/components/admin/ui';

function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  return null;
}

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*|(https?:\/\/[^\s)]+))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2]) out.push(<strong key={key} className="font-semibold">{m[2]}</strong>);
    else if (m[3]) out.push(<code key={key} className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em]">{m[3]}</code>);
    else if (m[4]) {
      const href = safeHref(m[5]);
      out.push(href
        ? <a key={key} href={href} target={href.startsWith('/') ? undefined : '_blank'} rel="noreferrer" className="font-medium underline underline-offset-2" style={{ color: COLORS.accent }}>{m[4]}</a>
        : m[4]);
    } else if (m[6]) out.push(<em key={key}>{m[6]}</em>);
    else if (m[7]) out.push(<a key={key} href={m[7]} target="_blank" rel="noreferrer" className="underline underline-offset-2 break-all" style={{ color: COLORS.accent }}>{m[7]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function withBreaks(text: string, keyBase: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.flatMap((l, i) => (i < lines.length - 1 ? [...inline(l, `${keyBase}-${i}`), <br key={`${keyBase}-br-${i}`} />] : inline(l, `${keyBase}-${i}`)));
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${k++}`;
    if (!line.trim()) { i++; continue; }

    if (line.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={key} className="my-2 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs leading-relaxed">{buf.join('\n')}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const size = h[1].length <= 2 ? 'text-[15px]' : 'text-sm';
      blocks.push(<p key={key} className={`mt-3 mb-1 font-bold ${size}`} style={{ color: COLORS.navy }}>{inline(h[2], key)}</p>);
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={key} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            {head && <thead><tr>{head.map((c, j) => <th key={j} className="border-b px-2 py-1.5 text-left font-semibold" style={{ borderColor: COLORS.stroke }}>{inline(c, `${key}h${j}`)}</th>)}</tr></thead>}
            <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border-b px-2 py-1.5 align-top" style={{ borderColor: COLORS.stroke }}>{inline(c, `${key}r${ri}c${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
        i++;
      }
      const cls = `my-1.5 space-y-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`;
      const children = items.map((it, j) => <li key={j}>{inline(it, `${key}-${j}`)}</li>);
      blocks.push(ordered ? <ol key={key} className={cls}>{children}</ol> : <ul key={key} className={cls}>{children}</ul>);
      continue;
    }
    if (line.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key} className="my-2 border-l-2 pl-3 italic" style={{ borderColor: COLORS.stroke, color: COLORS.textMuted }}>{withBreaks(buf.join('\n'), key)}</blockquote>);
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*([-*•]|\d+[.)])\s+|>|\s*\|.*\|\s*$)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    blocks.push(<p key={key} className="my-1.5">{withBreaks(buf.join('\n'), key)}</p>);
  }
  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
