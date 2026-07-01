/**
 * navMenu.ts – baut das Hauptmenü dynamisch aus den echten Serien/Kategorien.
 * Serverseitig (layout.tsx) aufgerufen, serialisierbar an die Client-NavBar.
 */
import { getSeriesList, getEventsList } from '@/lib/eventData';
import { toCategorySlug } from '@/lib/category';

export type NavLink = { label: string; href: string; desc?: string };
export type NavCard = { label: string; href: string; image?: string; dateLabel?: string; place?: string };
export type NavColumn = { title: string; iconKey: string; href: string; count: number; items: NavLink[]; cards: NavCard[] };
export type MegaItem = {
  type: 'mega';
  label: string;
  key: string;
  columns: NavColumn[];
  featured?: { title: string; desc: string; href: string; image: string };
};
export type LinkItem = { type: 'link'; label: string; href: string; external?: boolean };
export type DropdownItem = { type: 'dropdown'; label: string; href: string; key: string; items: NavLink[] };
export type CalPreview = { name: string; href: string; category: string; dateLabel: string; startISO: string };
export type CalendarItem = { type: 'calendar'; label: string; href: string; events: CalPreview[] };
export type NavItem = MegaItem | LinkItem | DropdownItem | CalendarItem;

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
const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
const fmtShort = (d: Date) => {
  const M = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${M[d.getMonth()]} ${d.getFullYear()}`;
};
const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function iconKeyFor(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes('tennis')) return 'tennis';
  if (c.includes('motor') || c.includes('rad') || c.includes('formel') || c.includes('grand prix')) return 'gauge';
  if (c.includes('kultur') || c.includes('konzert') || c.includes('oper') || c.includes('klassik')) return 'music';
  if (c.includes('super bowl') || c.includes('american') || c.includes('nfl') || c.includes('olympia') || c.includes('darts')) return 'star';
  if (c.includes('fussball') || c.includes('fußball') || c.includes('football')) return 'trophy';
  return 'trophy';
}
function isKultur(cat: string): boolean {
  const c = cat.toLowerCase();
  return c.includes('kultur') || c.includes('konzert') || c.includes('oper') || c.includes('klassik') || c.includes('festival');
}

export const FALLBACK_NAV: NavItem[] = [
  { type: 'link', label: 'Home', href: '/' },
  { type: 'link', label: 'Kalender', href: '/kalender' },
  { type: 'link', label: 'Über uns', href: '/ueber-uns' },
  { type: 'link', label: 'Kontakt', href: '/kontakt' },
];

export async function buildNavMenu(): Promise<NavItem[]> {
  let series: Awaited<ReturnType<typeof getSeriesList>> = [];
  try {
    series = await getSeriesList();
  } catch {
    return FALLBACK_NAV;
  }
  let events: Awaited<ReturnType<typeof getEventsList>> = [];
  try {
    events = await getEventsList();
  } catch {
    events = [];
  }

  const active = series.filter((s) => (s.status ?? 'active') !== 'archived');
  const seriesById = new Map(active.map((s) => [s.id, s]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Serien-Links + Event-Vorschaukarten pro Kategorie sammeln
  const linksByCat = new Map<string, NavLink[]>();
  const heroByCat = new Map<string, string>();
  for (const s of active) {
    const cat = (s.category || 'Sonstiges').trim();
    if (!linksByCat.has(cat)) linksByCat.set(cat, []);
    linksByCat.get(cat)!.push({ label: s.title, href: `/${s.slug}` });
    if (s.hero_image && !heroByCat.has(cat)) heroByCat.set(cat, s.hero_image);
  }

  type Tmp = { card: NavCard; future: boolean; key: string };
  const cardsByCat = new Map<string, Tmp[]>();
  for (const e of events) {
    const status = (e as { status?: string }).status;
    if (status === 'archived' || status === 'draft') continue;
    const s = e.series_id ? seriesById.get(e.series_id) : null;
    if (!s) continue;
    const cat = (s.category || 'Sonstiges').trim();
    const start = parseDate(e.start_date);
    const seg = e.url_segment || e.slug;
    const place = [e.location_city, e.location_country].filter(Boolean).join(', ');
    const card: NavCard = {
      label: e.name || e.title || s.title,
      href: `/${s.slug}/${seg}`,
      image: e.hero_image || s.hero_image || '',
      dateLabel: start ? fmtShort(start) : '',
      place,
    };
    const future = start ? start.getTime() >= today.getTime() : false;
    const key = start ? isoDate(start) : '';
    if (!cardsByCat.has(cat)) cardsByCat.set(cat, []);
    cardsByCat.get(cat)!.push({ card, future, key });
  }

  function buildCol(cat: string): NavColumn {
    const items = (linksByCat.get(cat) || []).slice().sort((a, b) => a.label.localeCompare(b.label));
    const count = items.length;
    items.push({ label: `Alle ${cat}`, href: `/kategorie/${toCategorySlug(cat)}` });
    const tmp = (cardsByCat.get(cat) || []).slice().sort((a, b) => {
      if (a.future !== b.future) return a.future ? -1 : 1;       // kommende zuerst
      if (a.future) return a.key.localeCompare(b.key);            // bald zuerst
      return b.key.localeCompare(a.key);                          // vergangene: neueste zuerst
    });
    const cards = tmp.map((t) => t.card).slice(0, 12);
    return { title: cat, iconKey: iconKeyFor(cat), href: `/kategorie/${toCategorySlug(cat)}`, count, items, cards };
  }

  const sportCols: NavColumn[] = [];
  const kulturCols: NavColumn[] = [];
  for (const cat of linksByCat.keys()) {
    (isKultur(cat) ? kulturCols : sportCols).push(buildCol(cat));
  }
  sportCols.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  kulturCols.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  const upcoming: CalPreview[] = events
    .map((e): CalPreview | null => {
      const status = (e as { status?: string }).status;
      if (status === 'archived' || status === 'draft') return null;
      const start = parseDate(e.start_date);
      if (!start) return null;
      const end = parseDate(e.end_date) || start;
      if (end.getTime() < today.getTime()) return null;
      const s = e.series_id ? seriesById.get(e.series_id) : null;
      const seg = e.url_segment || e.slug;
      return {
        name: e.name || e.title || 'Event',
        href: s ? `/${s.slug}/${seg}` : `/events/${e.slug}`,
        category: s?.category || 'Event',
        dateLabel: fmtDate(start),
        startISO: isoDate(start),
      };
    })
    .filter((x): x is CalPreview => x !== null)
    .sort((a, b) => a.startISO.localeCompare(b.startISO))
    .slice(0, 6);

  const menu: NavItem[] = [
    { type: 'link', label: 'Home', href: '/' },
    { type: 'calendar', label: 'Kalender', href: '/kalender', events: upcoming },
  ];
  if (sportCols.length) menu.push({ type: 'mega', label: 'Sportevents', key: 'sport', columns: sportCols });
  if (kulturCols.length) menu.push({ type: 'mega', label: 'Kulturevents', key: 'kultur', columns: kulturCols });
  menu.push({ type: 'link', label: 'Incentive', href: 'https://incentive-agentur.ch/', external: true });
  menu.push({
    type: 'dropdown',
    label: 'Über uns',
    href: '/ueber-uns',
    key: 'about',
    items: [
      { label: 'Über Faltin Travel', href: '/ueber-uns', desc: 'Wer wir sind & wofür wir stehen' },
      { label: 'Ryder Cup 2027 – Authorized Distributor', href: '/ryder-cup-2027', desc: 'Offizieller Vertriebspartner' },
      { label: 'UEFA Nations League 2026/27', href: '/uefa-nations-league-2026-27', desc: 'Gruppen, Spielplan & Termine' },
      { label: 'Verhaltenskodex', href: '/verhaltenskodex', desc: 'Unser Code of Conduct' },
    ],
  });
  menu.push({ type: 'link', label: 'Kontakt', href: '/kontakt' });

  const fe = events.find((e) => (e as { featured?: boolean }).featured);
  if (fe) {
    const s = fe.series_id ? seriesById.get(fe.series_id) : null;
    const seg = fe.url_segment || fe.slug;
    const featured = {
      title: fe.name || fe.title || 'Event',
      desc: ((fe.description || '').trim().slice(0, 110)) || 'Jetzt frühzeitig sichern.',
      href: s ? `/${s.slug}/${seg}` : `/events/${fe.slug}`,
      image: fe.hero_image || '/og-image.webp',
    };
    const targetKey = isKultur(s?.category || '') ? 'kultur' : 'sport';
    const mega = menu.find((m): m is MegaItem => m.type === 'mega' && m.key === targetKey)
      || menu.find((m): m is MegaItem => m.type === 'mega');
    if (mega) mega.featured = featured;
  }

  return menu;
}
