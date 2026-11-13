/**
 * files/config.ts — Konstanten und Host-Erkennung für Faltin Files.
 * Edge-tauglich (wird auch von der Middleware importiert): keine Node-Module.
 */

/** Standard-Aufbewahrung einer Freigabe in Tagen. */
export const FILES_DEFAULT_DAYS = 30;
/** Längste wählbare Aufbewahrung (ab heute). */
export const FILES_MAX_DAYS = 365;
/** Grösste einzelne Datei. */
export const FILES_MAX_FILE_BYTES = 20 * 1024 ** 3;
/** Grösse eines Upload-Stücks (bleibt unter allen Proxy-/Body-Limits). */
export const FILES_CHUNK_BYTES = 16 * 1024 ** 2;
/** Schnellwahl für die Aufbewahrung in Tagen. */
export const FILES_DAY_PRESETS = [7, 14, 30, 90] as const;

/** Öffentliche Basisadresse der Teil-Links. */
export function filesPublicBase(): string {
  return (process.env.FILES_PUBLIC_URL || 'https://files.faltintravel.com').replace(/\/+$/, '');
}

/** Ist das die eigene Adresse von Faltin Files (files.faltintravel.com)? */
export function isFilesHost(host: string | null | undefined): boolean {
  const h = (host || '').toLowerCase().split(':')[0];
  const configured = (process.env.FILES_HOST || 'files.faltintravel.com').toLowerCase();
  return h === configured || h.startsWith('files.');
}
