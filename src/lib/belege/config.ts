/**
 * belege/config.ts — Konstanten und Host-Erkennung für Faltin Belege (belege.faltintravel.com).
 * Edge-tauglich (wird auch von der Middleware importiert): keine Node-Module.
 */

/** Grösste Belegdatei (Foto oder PDF). Fotos verkleinert der Client vorher auf ~1–2 MB. */
export const BELEGE_MAX_FILE_BYTES = 25 * 1024 ** 2;

/** Erlaubte Dateitypen. HEIC wandelt iOS beim Hochladen selbst in JPEG um. */
export const BELEGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'] as const;

/** Ist das die eigene Adresse von Faltin Belege (belege.faltintravel.com)? */
export function isBelegeHost(host: string | null | undefined): boolean {
  const h = (host || '').toLowerCase().split(':')[0];
  const configured = (process.env.BELEGE_HOST || 'belege.faltintravel.com').toLowerCase();
  return h === configured || h.startsWith('belege.');
}
