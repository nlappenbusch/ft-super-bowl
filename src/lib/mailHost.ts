/**
 * mailHost.ts — Erkennt die eigene Adresse des Mail-Clients (mail.faltintravel.com).
 * Dort zeigt "/" direkt den Mail-Client; Login kehrt auf denselben Host zurück.
 * Edge-tauglich (keine Node-Abhängigkeiten).
 */
export function isMailHost(host: string | null | undefined): boolean {
  const h = (host || '').toLowerCase().split(':')[0];
  const configured = (process.env.MAIL_CLIENT_HOST || 'mail.faltintravel.com').toLowerCase();
  return h === configured || h.startsWith('mail.');
}

export function requestHost(req: Request): string {
  return req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
}
