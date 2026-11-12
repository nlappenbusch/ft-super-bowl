/**
 * voicemailBoard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Anbindung an den Voicemail-Dienst (CT 7003, /opt/apps/voicemail): Er holt die
 * Teams-Voicemails aller Gruppen aus kontakt@faltintravel.com, transkribiert sie
 * lokal (Whisper) und stellt sie hier intern bereit – nur im Docker-Netz, mit Token.
 *
 *   VOICEMAIL_API_URL    default http://voicemail:8080
 *   VOICEMAIL_API_TOKEN  gemeinsamer Schlüssel (steht auch in /opt/apps/voicemail/.env)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Voicemail {
  key: string;
  empfangen: string;
  linie: string;
  anrufer: string;
  tel: string;
  dauer: number;
  text: string;
  erledigt_von: string | null;
  erledigt_am: string | null;
  notiz: string | null;
  refs: string[];
  anruf_nr?: number;
  anrufe_gesamt: number;
  aufgabe_id: string | null;
  aufgabe_nr: string | null;
}

/** Zu einer erkannten RQ-Nummer gefundene Anfrage in next (für den Direktlink ins CRM). */
export interface VoicemailAnfrage {
  id: string;
  request_number: string;
  package_title: string | null;
  status: string | null;
  customer_name: string | null;
}

const BASE = (process.env.VOICEMAIL_API_URL || 'http://voicemail:8080').replace(/\/+$/, '');

export function voicemailConfigured(): boolean {
  return !!process.env.VOICEMAIL_API_TOKEN;
}

export async function voicemailFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(BASE + path, {
    ...init,
    cache: 'no-store',
    headers: { ...(init.headers || {}), 'X-Token': process.env.VOICEMAIL_API_TOKEN || '' },
    signal: AbortSignal.timeout(15_000),
  });
}
