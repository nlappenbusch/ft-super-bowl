import { getEventsList, getSeriesList } from '@/lib/eventData';
import { siteConfig } from '@/lib/siteConfig';

export const dynamic = 'force-dynamic';

const SITE = siteConfig.url.replace(/\/+$/, '');

function parseDate(s?: string | null): Date | null {
  const t = (s || '').trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(`${t.slice(0, 10)}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const g = new Date(t);
  return isNaN(g.getTime()) ? null : g;
}
const pad = (n: number) => String(n).padStart(2, '0');
const icsDate = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const esc = (t: string) => (t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export async function GET() {
  const [events, series] = await Promise.all([getEventsList(), getSeriesList()]);
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Faltin Travel//Event-Kalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Faltin Travel Events',
    'X-WR-TIMEZONE:Europe/Zurich',
  ];

  for (const e of events) {
    const status = (e as { status?: string }).status;
    if (status === 'archived' || status === 'draft') continue;
    const start = parseDate(e.start_date);
    if (!start) continue;
    const end = parseDate(e.end_date) || start;
    if (end.getTime() < today.getTime()) continue;

    const s = e.series_id ? seriesById.get(e.series_id) : null;
    const seg = e.url_segment || e.slug;
    const url = `${SITE}${s ? `/${s.slug}/${seg}` : `/events/${e.slug}`}`;
    const loc = [e.location_city, e.location_country].filter(Boolean).join(', ') || e.venue || '';
    const dtEnd = new Date(end);
    dtEnd.setDate(dtEnd.getDate() + 1); // All-Day: DTEND ist exklusiv

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${(e.slug || e.id)}@faltintravel.com`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(start)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(dtEnd)}`);
    lines.push(`SUMMARY:${esc(e.name || e.title || 'Event')}`);
    if (loc) lines.push(`LOCATION:${esc(loc)}`);
    lines.push(`URL:${esc(url)}`);
    lines.push(`DESCRIPTION:${esc(`${(e.description || '').slice(0, 280)} ${url}`.trim())}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  const body = lines.join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="faltin-travel-events.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
