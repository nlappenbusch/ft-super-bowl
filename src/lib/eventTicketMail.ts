/**
 * eventTicketMail.ts — Ticketmail bauen und als Outlook-Entwurf ablegen (Server).
 * ─────────────────────────────────────────────────────────────────────────────
 * Gesendet wird hier NIE: Der Entwurf landet im gewählten Postfach, ein Mensch prüft
 * und schickt ihn ab (Outlook / Faltin Mail). Bilder gehen als eingebettete Anhänge
 * mit (`cid:`), die Apple-Wallet-Datei (.pkpass) wird — wenn der Link sie direkt
 * liefert — zusätzlich angehängt.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { getEvents } from './contentStore';
import { sendMessage, type OutgoingAttachment } from './mailbox/graph';
import {
  resolveTicket, renderTicketMail, mailImages, imageCid, passFileName, checkMailGroup,
  type EventTicket,
} from './eventTicketModel';

/** Leere Spielangaben aus den verknüpften Events füllen. */
export function resolveAll(tickets: EventTicket[]): EventTicket[] {
  const events = tickets.some((t) => t.event_id) ? getEvents() : [];
  return tickets.map((t) => resolveTicket(t, t.event_id ? events.find((e) => e.id === t.event_id) : null));
}

function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const l = ip.toLowerCase();
    return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l.startsWith('::ffff:10.') || l.startsWith('::ffff:192.168.');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

const MAX_PASS_BYTES = 6 * 1024 * 1024;
// Ticketanbieter liefern je nach Gerät eine Datei oder eine Weiterleitung (Google) — wir fragen als iPhone.
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Lädt die .pkpass hinter einem Apple-Wallet-Link. Nur https, keine internen Adressen,
 * höchstens 6 MB. Liefert null, wenn der Link keine Wallet-Datei ist (dann bleibt es beim Knopf).
 */
export async function fetchPass(url: string): Promise<{ bytes: Buffer } | null> {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  try {
    const addrs = await lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => privateAddress(a.address))) return null;
  } catch {
    return null;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const r = await fetch(u, { headers: { 'User-Agent': IPHONE_UA, Accept: 'application/vnd.apple.pkpass,*/*' }, redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) return null;
    const type = (r.headers.get('content-type') || '').toLowerCase();
    const disp = (r.headers.get('content-disposition') || '').toLowerCase();
    if (!type.includes('pkpass') && !disp.includes('.pkpass')) return null;
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_PASS_BYTES) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_PASS_BYTES || buf.length < 100) return null;
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) return null; // .pkpass ist ein ZIP («PK»)
    return { bytes: buf };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function inlineImages(branding: EventTicket['branding']): Promise<OutgoingAttachment[]> {
  const out: OutgoingAttachment[] = [];
  for (const file of mailImages(branding)) {
    const bytes = await fs.readFile(path.join(process.cwd(), 'public', 'mail', file));
    out.push({ name: file, contentType: 'image/png', contentBytes: bytes.toString('base64'), isInline: true, contentId: imageCid(file) });
  }
  return out;
}

export interface DraftResult {
  draftId: string;
  webLink: string;
  subject: string;
  to: string;
  attached: number;
  /** Plätze, deren Wallet-Datei nicht geladen werden konnte (bleiben als Knopf in der Mail). */
  notAttached: string[];
}

/** Baut die Mail für die Tickets eines Empfängers und legt sie als Entwurf in `mailbox` ab. */
export async function createTicketDraft(input: EventTicket[], mailbox: string, attach: boolean): Promise<DraftResult> {
  const tickets = resolveAll(input);
  const errs = checkMailGroup(tickets);
  if (errs.length) throw new Error(errs.join(' '));

  const files: OutgoingAttachment[] = [];
  const notAttached: string[] = [];
  if (attach) {
    const passes = await Promise.all(tickets.map((t) => (t.apple_url ? fetchPass(t.apple_url) : Promise.resolve(null))));
    passes.forEach((p, i) => {
      const t = tickets[i];
      if (p) files.push({ name: passFileName(t), contentType: 'application/vnd.apple.pkpass', contentBytes: p.bytes.toString('base64') });
      else notAttached.push(t.seat || t.id);
    });
  }

  const mail = renderTicketMail(tickets, { assets: { base: '', cid: true }, attachedSeats: files.length });
  const images = await inlineImages(tickets[0].branding);
  const to = tickets[0].recipient_email;
  const r = await sendMessage({
    mailbox,
    // Ohne Anzeigenamen: Empfänger ist oft ein Wiederverkäufer, nicht der Ticketinhaber.
    to: [{ name: '', address: to }],
    subject: mail.subject,
    html: mail.html,
    attachments: [...images, ...files],
    draftOnly: true,
  });
  return { draftId: r.draftId, webLink: r.webLink, subject: mail.subject, to, attached: files.length, notAttached };
}

/** Vorschau (ohne Netz, Bilder über die eigene Seite). */
export function previewTicketMail(input: EventTicket[], attach: boolean): { subject: string; html: string; errors: string[] } {
  const tickets = resolveAll(input);
  const errors = checkMailGroup(tickets);
  const mail = renderTicketMail(tickets, { assets: { base: '' }, attachedSeats: attach ? tickets.filter((t) => t.apple_url).length : 0 });
  return { subject: mail.subject, html: mail.html, errors };
}
