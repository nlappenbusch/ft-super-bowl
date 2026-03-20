import fs from 'fs';
import path from 'path';

export interface CategorySeoRecord {
  slug: string;
  title: string;
  intro_text: string;
  meta_description?: string | null;
  status?: 'active' | 'draft' | 'archived' | null;
}

const dataDir = path.join(process.cwd(), 'data');
const categorySeoPath = path.join(dataDir, 'category-seo.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function seedCategorySeo(): CategorySeoRecord[] {
  return [
    {
      slug: 'sportevents',
      title: 'Sport Events',
      intro_text:
        'In der Kategorie Sport Events finden Sie internationale Top-Highlights mit klar strukturierten Ticket- und Reiseloesungen. Von Planung bis Rueckreise profitieren Sie von festen Ansprechpartnern, nachvollziehbaren Leistungen und einer Organisation, die auf verlaessliche Umsetzbarkeit ausgerichtet ist.',
      meta_description:
        'Sport Events Reisen mit Faltin Travel: Premium Tickets, Hotels und professionelle Betreuung fuer internationale Top-Events.',
      status: 'active'
    },
    {
      slug: 'tennis',
      title: 'Tennis',
      intro_text:
        'Unsere Tennis Eventreisen verbinden Grand-Slam-Atmosphaere mit verlaesslicher Reiseplanung. Ob Wimbledon, ATP Finals oder weitere Top-Turniere: Sie erhalten abgestimmte Ticket-Optionen, passende Hotels und persoenliche Beratung fuer einen reibungslosen Ablauf vor Ort.',
      meta_description:
        'Tennis Tickets und Eventreisen mit Faltin Travel: Grand Slams, Top-Turniere, Hotels und persoenliche Betreuung aus einer Hand.',
      status: 'active'
    },
    {
      slug: 'motorsport-radsport',
      title: 'Motorsport & Radsport',
      intro_text:
        'Motorsport- und Radsportreisen mit Fokus auf Erlebnisqualitaet, Zugang und Timing. Sie erhalten Eventzugang, passende Hoteloptionen und eine Planung, die Anreise, Renntage und Zusatzprogramme sinnvoll aufeinander abstimmt.',
      meta_description:
        'Motorsport und Radsport Reisen mit Tickets, Hotels und strukturierter Planung fuer starke Live-Erlebnisse.',
      status: 'active'
    },
    {
      slug: 'super-bowl',
      title: 'Super Bowl',
      intro_text:
        'Der Super Bowl ist eines der gefragtesten Sportereignisse weltweit. Unsere Pakete kombinieren ausgewaehlte Ticketkategorien, hochwertige Hotels und eine belastbare Ablaufplanung, damit Sie das Event in Los Angeles entspannt und sicher erleben koennen.',
      meta_description:
        'Super Bowl Tickets und Reisepakete mit Hotel, Betreuung und klarer Organisation fuer Ihr NFL Highlight vor Ort.',
      status: 'active'
    },
    {
      slug: 'darts',
      title: 'Darts WM',
      intro_text:
        'Darts-WM Reisen mit Fokus auf Stimmung, Sitzplatzqualitaet und logistischer Klarheit. Von der Ticketloesung bis zur Hotelwahl werden alle Bausteine so kombiniert, dass Ihr Eventtrip stressfrei und planbar bleibt.',
      meta_description:
        'Darts WM Reisen mit Tickets und Hotels: optimal organisiert fuer ein unvergessliches Ally-Pally Erlebnis.',
      status: 'active'
    },
    {
      slug: 'kultur-events-konzerte',
      title: 'Kultur Events & Konzerte',
      intro_text:
        'Fuer Kultur- und Konzertreisen bieten wir kuratierte Arrangements mit Eventzugang, passenden Unterkuenften und abgestimmten Zeitplaenen. So entstehen hochwertige Erlebnisse, die Genuss, Komfort und Verlaesslichkeit verbinden.',
      meta_description:
        'Kultur und Konzertreisen mit Eventzugang, Hotels und durchdachter Planung fuer besondere Live-Momente.',
      status: 'active'
    }
  ];
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('Failed to read category SEO JSON:', filePath, error);
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getCategorySeoList(): CategorySeoRecord[] {
  return readJsonFile<CategorySeoRecord[]>(categorySeoPath, seedCategorySeo());
}

export function saveCategorySeoList(entries: CategorySeoRecord[]) {
  writeJsonFile(categorySeoPath, entries);
}

export function getCategorySeoBySlug(slug: string): CategorySeoRecord | null {
  return getCategorySeoList().find((entry) => entry.slug === slug) || null;
}

export function upsertCategorySeo(payload: CategorySeoRecord): CategorySeoRecord {
  const entries = getCategorySeoList();
  const index = entries.findIndex((entry) => entry.slug === payload.slug);

  if (index === -1) {
    entries.unshift(payload);
  } else {
    entries[index] = payload;
  }

  saveCategorySeoList(entries);
  return payload;
}

export function deleteCategorySeo(slug: string): boolean {
  const entries = getCategorySeoList();
  const filtered = entries.filter((entry) => entry.slug !== slug);
  if (filtered.length === entries.length) return false;

  saveCategorySeoList(filtered);
  return true;
}
