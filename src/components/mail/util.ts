import type { MailAddress, MailboxInfo } from './types';

export async function api<T = Record<string, unknown>>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const opts: RequestInit = { ...init };
  if (init?.json !== undefined) {
    opts.body = JSON.stringify(init.json);
    opts.headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
    opts.method = init.method || 'POST';
  }
  const res = await fetch(`/api/admin/mailbox/${path}`, opts);
  const data = await res.json().catch(() => ({ success: false, error: `Fehler ${res.status}` }));
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = `/admin/login?from=${encodeURIComponent('/mail')}`;
  }
  if (!res.ok || data.success === false) throw new Error(data.error || `Fehler ${res.status}`);
  return data as T;
}

/** Stabile Farbe je Postfach (Faltin-nahe Palette, gut unterscheidbar). */
const PALETTE = ['#143047', '#d9531e', '#2f7d6d', '#7a4fb3', '#b8862b', '#2c6fbb', '#a23d5c', '#4f6b2a', '#5b5f97', '#c0582b'];
export function mailboxColor(address: string, all: MailboxInfo[]): string {
  const i = all.findIndex((m) => m.address === address);
  if (i >= 0) return PALETTE[i % PALETTE.length];
  let h = 0;
  for (const c of address) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function shortMailbox(m: Pick<MailboxInfo, 'name' | 'address'>): string {
  return m.name && !m.name.includes('@') ? m.name : m.address.split('@')[0];
}

export function initials(name: string, address = ''): string {
  const n = (name || address.split('@')[0] || '?').replace(/[^\p{L}\s.-]/gu, ' ').trim();
  const parts = n.split(/[\s.-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || '')).toUpperCase();
}

export function personColor(s: string): string {
  let h = 0;
  for (const c of s) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 45% 42%)`;
}

const dayFmt = new Intl.DateTimeFormat('de-CH', { weekday: 'short' });
const dateFmt = new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });
const longFmt = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function listTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return timeFmt.format(d);
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 6) return `${dayFmt.format(d)} ${timeFmt.format(d)}`;
  return dateFmt.format(d);
}

export function longTime(iso: string): string {
  return iso ? longFmt.format(new Date(iso)) : '';
}

export function dayGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86400000);
  if (days <= 0) return 'Heute';
  if (days === 1) return 'Gestern';
  if (days < 7) return 'Diese Woche';
  if (days < 14) return 'Letzte Woche';
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'Diesen Monat';
  return new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' }).format(d);
}

export function fileSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Klartext → einfaches HTML (Absätze, Zeilenumbrüche, Aufzählungen, Links). */
export function textToHtml(text: string): string {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return blocks.map((b) => {
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li>${linkify(escapeHtml(l.replace(/^\s*[-•*]\s+/, '')))}</li>`).join('')}</ul>`;
    }
    return `<p>${lines.map((l) => linkify(escapeHtml(l))).join('<br>')}</p>`;
  }).join('');
}

function linkify(s: string): string {
  return s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

/** Editor-HTML → Klartext (für KI und Vorschau). */
export function htmlToText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const div = document.createElement('div');
  div.innerHTML = html
    .replace(/<\/(p|div|h\d)>/gi, '</$1>\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n');
  return (div.textContent || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function formatAddr(a: MailAddress): string {
  return a.name && a.name.toLowerCase() !== a.address ? `${a.name} <${a.address}>` : a.address;
}

/** RQ-/TASK-/FT-Nummern im Betreff für Chips */
export function refsIn(text: string): string[] {
  return [...new Set((text.match(/RQ-\d{3,}|TASK-\d{3,}|\bFT\d{2}-\d{3,5}\b/gi) || []).map((x) => x.toUpperCase()))].slice(0, 3);
}

/** Briefanrede aus Name (+ optional Anrede-Wort) */
export function salutation(name: string, anrede = '', lang = 'de'): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  if (lang === 'en') {
    if (/herr|mr/i.test(anrede) && last) return `Dear Mr ${last}`;
    if (/frau|ms|mrs/i.test(anrede) && last) return `Dear Ms ${last}`;
    return name ? `Dear ${name}` : 'Dear Sir or Madam';
  }
  if (/herr/i.test(anrede) && last) return `Guten Tag Herr ${last}`;
  if (/frau/i.test(anrede) && last) return `Guten Tag Frau ${last}`;
  return name ? `Guten Tag ${name}` : 'Guten Tag';
}

/** Platzhalter {{key}} ersetzen; fehlende als markierte Lücke [[key]] stehen lassen. */
export function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => (vars[k] ? vars[k] : `[[${k}]]`));
}
