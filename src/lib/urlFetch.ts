/**
 * urlFetch.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Holt eine öffentliche Webseite und extrahiert lesbaren Text (für KI-Import).
 * Nur serverseitig. Nur http/https. Begrenzt auf ~18k Zeichen.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface UrlFetchResult {
  ok: boolean;
  title?: string;
  text?: string;
  error?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&euro;/gi, '€')
    .replace(/&[a-z0-9#]+;/gi, ' ');
}

export async function fetchUrlText(url: string): Promise<UrlFetchResult> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, error: 'Ungültige URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'Nur http/https erlaubt' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(u.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; FaltinTravelImporter/1.0; +https://faltintravel.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { ok: false, error: `HTTP ${res.status} beim Abruf` };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html') && !ct.includes('text')) {
      return { ok: false, error: `Kein HTML-Inhalt (${ct || 'unbekannt'})` };
    }

    const html = await res.text();
    const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim());

    // Hauptinhalt grob isolieren: <main> oder <article> bevorzugen, sonst <body>
    const main =
      html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
      html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
      html.match(/<body[\s\S]*?<\/body>/i)?.[0] ||
      html;

    const text = decodeEntities(
      main
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    )
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    return { ok: true, title, text: text.slice(0, 18000) };
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'Zeitüberschreitung' : (e as Error).message;
    return { ok: false, error: msg };
  }
}
