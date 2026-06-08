import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface ContentEventRecord {
  id: string;
  series_id?: string | null;
  slug: string;
  name: string;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  venue?: string | null;
  location_name?: string | null;
  location_city?: string | null;
  location_region?: string | null;
  location_country?: string | null;
  hero_image?: string | null;
  ticket_image?: string | null;
  base_url?: string | null;
  first_paragraph_heading?: string | null;
  first_paragraph_text?: string | null;
  first_paragraph_image_1?: string | null;
  first_paragraph_image_2?: string | null;
  first_paragraph_image_3?: string | null;
  status?: 'active' | 'draft' | 'archived' | null;
  show_about?: boolean | null;
  show_packages?: boolean | null;
  show_faqs?: boolean | null;
  show_spielplan?: boolean | null;
  spielplan?: Array<{
    date: string;
    session: string;
    matchup: string;
    round: string;
  }> | null;
  show_wissenswertes?: boolean | null;
  wissenswertes_title?: string | null;
  wissenswertes_text?: string | null;
  wissenswertes_accordion_title?: string | null;
  wissenswertes_accordion_text?: string | null;
  show_stadionplan?: boolean | null;
  stadionplan_title?: string | null;
  stadionplan_venue_name?: string | null;
  stadionplan_image?: string | null;
  stadionplan_description?: string | null;
  show_lageplan?: boolean | null;
  lageplan_pins?: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    icon_id: string;
    label?: string | null;
  }> | null;
  show_leistungen?: boolean | null;
  leistungen_title?: string | null;
  leistungen_image?: string | null;
  leistungen_items?: string[] | null;
  show_ticket_categories?: boolean | null;
  ticket_categories_title?: string | null;
  ticket_categories_intro?: string | null;
  ticket_categories?: Array<{ name: string; items: string[]; note?: string | null }> | null;
}

export interface ContentPackageInclude {
  type?: string | null;
  name: string;
  category?: string | null;
  status?: string | null;
  icon?: string | null;
  description?: string | null;
  sort_order?: number | null;
}

export interface ContentSeriesRecord {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category: string;
  category_seo_text?: string | null;
  hero_image?: string | null;
  status?: 'active' | 'draft' | 'archived' | null;
}

export interface ContentPackageRecord {
  id: string;
  event_id: string;
  slug: string;
  package_name?: string | null;
  title: string;
  short_description?: string | null;
  description?: string | null;
  hotel?: string | null;
  stars?: number | null;
  nights?: number | null;
  price?: number | null;
  currency?: string | null;
  single_supplement?: number | null;
  popular?: boolean | null;
  available_spots?: number | null;
  rating?: number | null;
  reviews?: number | null;
  hotel_images?: string[] | null;
  distances?: { airport?: string; stadium?: string; downtown?: string } | null;
  room_categories?: string[] | null;
  extension_nights?: string | null;
  badge_text?: string | null;
  includes?: ContentPackageInclude[] | null;
  active?: boolean | null;
}

export interface ContentFaqRecord {
  id: string;
  event_id: string;
  question: string;
  answer: string;
  sort_order?: number | null;
}

export interface ContentPinRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'airport' | 'hotel' | 'stadium' | 'other';
  label?: string | null;
}

export interface ContentPinIconRecord {
  id: string;
  name: string;
  image?: string | null;
}

const dataDir = path.join(process.cwd(), 'data');
const eventsPath = path.join(dataDir, 'events.json');
const seriesPath = path.join(dataDir, 'series.json');
const packagesPath = path.join(dataDir, 'packages.json');
const faqsPath = path.join(dataDir, 'faqs.json');
const pinsPath = path.join(dataDir, 'pins.json');
const pinIconsPath = path.join(dataDir, 'pin-icons.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
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
    console.error('Failed to read JSON:', filePath, error);
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

const defaultSeriesId = 'series-super-bowl';

function seedSeries(): ContentSeriesRecord[] {
  return [
    {
      id: defaultSeriesId,
      slug: 'super-bowl',
      title: 'Super Bowl',
      description: 'Die groesste Sportshow der Welt mit exklusiven Hospitality-Packages.',
      category: 'Sportevents',
      category_seo_text:
        'In der Kategorie Sportevents finden Sie ausgewaehlte Eventreisen mit verifizierten Tickets, passenden Hotels und planbarer Betreuung durch das Team von Faltin Travel.',
      hero_image: 'https://superbowl.faltintravel.com/header-neu1260-1.webp',
      status: 'active'
    }
  ];
}

function seedEvents(): ContentEventRecord[] {
  return [
    {
      id: 'event-super-bowl-2027',
      series_id: defaultSeriesId,
      slug: 'super-bowl-2027',
      name: 'Super Bowl LXI',
      title: 'Super Bowl LXI 2027 Tickets & Packages',
      description: 'NFL Super Bowl LXI 2027 in Los Angeles',
      start_date: '2027-02-07',
      end_date: '2027-02-07',
      venue: 'SoFi Stadium',
      location_name: 'SoFi Stadium',
      location_city: 'Inglewood',
      location_region: 'CA',
      location_country: 'US',
      hero_image: 'https://superbowl.faltintravel.com/header-neu1260-1.webp',
      ticket_image: 'https://superbowl.faltintravel.com/Super-Bowl-2027-Ticketkategorien-SoFi-Stadium.webp',
      base_url: 'https://superbowl.faltintravel.com',
      first_paragraph_heading: 'Erleben Sie den Super Bowl LXI 2027 live!',
      first_paragraph_text:
        'Der Super Bowl ist das groesste Einzelsportevent der Welt. Mit Faltin Travel erleben Sie das Event in Los Angeles mit ausgewaehlten Tickets, Top-Hotel und exklusiven Services vor Ort.',
      first_paragraph_image_1: 'https://superbowl.faltintravel.com/bilder-hotel/540997872.jpg',
      first_paragraph_image_2: 'https://superbowl.faltintravel.com/bilder-hotel/540998091.jpg',
      first_paragraph_image_3: 'https://superbowl.faltintravel.com/bilder-hotel/568783347.jpg',
      status: 'active'
    }
  ];
}

function seedPackages(): ContentPackageRecord[] {
  return [
    {
      id: 'package-dream-hollywood',
      event_id: 'event-super-bowl-2027',
      slug: 'dream-hollywood',
      package_name: 'Ticket- & Hotel-Package',
      title: 'Dream Hollywood, by Hyatt',
      short_description: 'Boutique-Hotel im Herzen von Hollywood mit Rooftop-Pool und Blick auf das Hollywood Sign',
      description: 'Boutique-Hotel im Herzen von Hollywood mit Rooftop-Pool und Blick auf das Hollywood Sign',
      hotel: 'Dream Hollywood, by Hyatt',
      stars: 4,
      nights: 4,
      price: 8950,
      currency: 'EUR',
      single_supplement: 1485,
      popular: true,
      available_spots: 12,
      rating: 4.8,
      reviews: 156,
      hotel_images: [
        'https://superbowl.faltintravel.com/bilder-hotel/540997872.jpg',
        'https://superbowl.faltintravel.com/bilder-hotel/540998091.jpg',
        'https://superbowl.faltintravel.com/bilder-hotel/568783347.jpg'
      ],
      distances: {
        airport: '40 Min. / ca. 30 km (LAX)',
        stadium: '35 Min. / ca. 29 km (SoFi Stadium)',
        downtown: '20 Min. / ca. 11 km'
      },
      room_categories: ['Doppelzimmer', 'Einzelzimmer'],
      extension_nights: 'Verlaengerungsnaechte auf Anfrage gegen Aufpreis buchbar',
      badge_text: 'Offizielles Hospitality-Package',
      includes: [
        {
          type: 'ticket',
          name: 'Super Bowl LXI Premium Ticket',
          category: '500er Level (Lower Bowl)',
          status: 'OK',
          icon: 'ticket',
          description: 'Offizielles NFL Premium-Ticket mit VIP-Zugang',
          sort_order: 1
        },
        {
          type: 'hotel',
          name: 'Dream Hollywood, by Hyatt',
          category: '4-Sterne Superior',
          status: 'OK',
          icon: 'hotel',
          description: 'Boutique-Hotel mit Rooftop-Pool und Hollywood Sign Blick',
          sort_order: 2
        },
        {
          type: 'transfer',
          name: 'Flughafen-Hotel-Stadium Transfers',
          category: 'Hin- und Rueckfahrt',
          status: 'OK',
          icon: 'transfer',
          description: 'Komfortable Shuttles zu allen wichtigen Locations',
          sort_order: 3
        },
        {
          type: 'hospitality',
          name: 'VIP Pregame-Party',
          category: 'Inkl. Catering & Getraenke',
          status: 'OK',
          icon: 'hospitality',
          description: 'Exklusiver Zugang zur offiziellen Pregame-Party',
          sort_order: 4
        }
      ]
    }
  ];
}

function seedFaqs(): ContentFaqRecord[] {
  return [
    {
      id: 'faq-1',
      event_id: 'event-super-bowl-2027',
      question: 'Sind meine Plaetze nebeneinander?',
      answer: 'Ja, bei Buchungen werden die Sitzplaetze im gleichen Block reserviert.',
      sort_order: 1
    },
    {
      id: 'faq-2',
      event_id: 'event-super-bowl-2027',
      question: 'Wie kann ich bezahlen?',
      answer: 'Zahlung per Ueberweisung auf unser Schweizer Bankkonto (CHF oder EUR moeglich).',
      sort_order: 2
    },
    {
      id: 'faq-3',
      event_id: 'event-super-bowl-2027',
      question: 'Was ist das Hospitality-Package?',
      answer: 'Das Package beinhaltet VIP-Eingang, offizielle Pregame-Party mit Catering & Getraenken, Live-Entertainment und reservierte Sitzplaetze im 500er Level.',
      sort_order: 3
    }
  ];
}

export function getEvents(): ContentEventRecord[] {
  return readJsonFile<ContentEventRecord[]>(eventsPath, seedEvents());
}

export function saveEvents(events: ContentEventRecord[]) {
  writeJsonFile(eventsPath, events);
}

export function getSeries(): ContentSeriesRecord[] {
  return readJsonFile<ContentSeriesRecord[]>(seriesPath, seedSeries());
}

export function saveSeries(series: ContentSeriesRecord[]) {
  writeJsonFile(seriesPath, series);
}

export function getPackages(): ContentPackageRecord[] {
  return readJsonFile<ContentPackageRecord[]>(packagesPath, seedPackages());
}

export function savePackages(packages: ContentPackageRecord[]) {
  writeJsonFile(packagesPath, packages);
}

export function getFaqs(): ContentFaqRecord[] {
  return readJsonFile<ContentFaqRecord[]>(faqsPath, seedFaqs());
}

export function saveFaqs(faqs: ContentFaqRecord[]) {
  writeJsonFile(faqsPath, faqs);
}

export function findEventBySlug(slug: string): ContentEventRecord | null {
  return getEvents().find((event) => event.slug === slug) || null;
}

export function findSeriesBySlug(slug: string): ContentSeriesRecord | null {
  return getSeries().find((series) => series.slug === slug) || null;
}

export function findSeriesById(id: string): ContentSeriesRecord | null {
  return getSeries().find((series) => series.id === id) || null;
}

export function findEventsBySeriesId(seriesId: string): ContentEventRecord[] {
  return getEvents()
    .filter((event) => event.series_id === seriesId)
    .sort((a, b) => {
      const aDate = a.start_date || '';
      const bDate = b.start_date || '';
      return aDate.localeCompare(bDate);
    });
}

export function findPackageBySlug(eventId: string, slug: string): ContentPackageRecord | null {
  return getPackages().find((pkg) => pkg.event_id === eventId && pkg.slug === slug) || null;
}

export function findPackagesByEvent(eventId: string, activeOnly = true): ContentPackageRecord[] {
  return getPackages()
    .filter((pkg) => pkg.event_id === eventId && (!activeOnly || pkg.active !== false))
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

export function findFaqsByEvent(eventId: string): ContentFaqRecord[] {
  return getFaqs().filter((faq) => faq.event_id === eventId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

export function createEvent(payload: Omit<ContentEventRecord, 'id'>): ContentEventRecord {
  const events = getEvents();
  const record: ContentEventRecord = { id: randomUUID(), ...payload };
  events.unshift(record);
  saveEvents(events);
  return record;
}

export function updateEvent(id: string, updates: Partial<ContentEventRecord>): ContentEventRecord | null {
  const events = getEvents();
  const index = events.findIndex((event) => event.id === id);
  if (index === -1) return null;
  const updated = { ...events[index], ...updates };
  events[index] = updated;
  saveEvents(events);
  return updated;
}

export function deleteEvent(id: string): boolean {
  const events = getEvents();
  const filtered = events.filter((event) => event.id !== id);
  if (filtered.length === events.length) return false;
  saveEvents(filtered);

  const packages = getPackages().filter((pkg) => pkg.event_id !== id);
  savePackages(packages);

  const faqs = getFaqs().filter((faq) => faq.event_id !== id);
  saveFaqs(faqs);

  return true;
}

export function createSeries(payload: Omit<ContentSeriesRecord, 'id'>): ContentSeriesRecord {
  const series = getSeries();
  const record: ContentSeriesRecord = { id: randomUUID(), ...payload };
  series.unshift(record);
  saveSeries(series);
  return record;
}

export function updateSeries(id: string, updates: Partial<ContentSeriesRecord>): ContentSeriesRecord | null {
  const series = getSeries();
  const index = series.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const updated = { ...series[index], ...updates };
  series[index] = updated;
  saveSeries(series);
  return updated;
}

export function deleteSeries(id: string): boolean {
  const series = getSeries();
  const filtered = series.filter((item) => item.id !== id);
  if (filtered.length === series.length) return false;
  saveSeries(filtered);

  const events = getEvents().map((event) =>
    event.series_id === id ? { ...event, series_id: null } : event
  );
  saveEvents(events);

  return true;
}

export function createPackage(payload: Omit<ContentPackageRecord, 'id'>): ContentPackageRecord {
  const packages = getPackages();
  const record: ContentPackageRecord = { id: randomUUID(), ...payload };
  packages.unshift(record);
  savePackages(packages);
  return record;
}

export function updatePackage(id: string, updates: Partial<ContentPackageRecord>): ContentPackageRecord | null {
  const packages = getPackages();
  const index = packages.findIndex((pkg) => pkg.id === id);
  if (index === -1) return null;
  const updated = { ...packages[index], ...updates };
  packages[index] = updated;
  savePackages(packages);
  return updated;
}

export function deletePackage(id: string): boolean {
  const packages = getPackages();
  const filtered = packages.filter((pkg) => pkg.id !== id);
  if (filtered.length === packages.length) return false;
  savePackages(filtered);
  return true;
}

export function createFaq(payload: Omit<ContentFaqRecord, 'id'>): ContentFaqRecord {
  const faqs = getFaqs();
  const record: ContentFaqRecord = { id: randomUUID(), ...payload };
  faqs.push(record);
  saveFaqs(faqs);
  return record;
}

export function updateFaq(id: string, updates: Partial<ContentFaqRecord>): ContentFaqRecord | null {
  const faqs = getFaqs();
  const index = faqs.findIndex((faq) => faq.id === id);
  if (index === -1) return null;
  const updated = { ...faqs[index], ...updates };
  faqs[index] = updated;
  saveFaqs(faqs);
  return updated;
}

export function deleteFaq(id: string): boolean {
  const faqs = getFaqs();
  const filtered = faqs.filter((faq) => faq.id !== id);
  if (filtered.length === faqs.length) return false;
  saveFaqs(filtered);
  return true;
}

export function reorderFaqs(updates: { id: string; sort_order: number }[]): boolean {
  const faqs = getFaqs();
  let changed = false;
  updates.forEach((u) => {
    const faq = faqs.find((f) => f.id === u.id);
    if (faq) {
      faq.sort_order = u.sort_order;
      changed = true;
    }
  });
  if (changed) {
    saveFaqs(faqs);
  }
  return changed;
}

export function getPins(): ContentPinRecord[] {
  return readJsonFile<ContentPinRecord[]>(pinsPath, []);
}

export function savePins(pins: ContentPinRecord[]) {
  writeJsonFile(pinsPath, pins);
}

export function createPin(payload: Omit<ContentPinRecord, 'id'>): ContentPinRecord {
  const pins = getPins();
  const record: ContentPinRecord = { id: randomUUID(), ...payload };
  pins.push(record);
  savePins(pins);
  return record;
}

export function updatePin(id: string, updates: Partial<ContentPinRecord>): ContentPinRecord | null {
  const pins = getPins();
  const index = pins.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const updated = { ...pins[index], ...updates };
  pins[index] = updated;
  savePins(pins);
  return updated;
}

export function deletePin(id: string): boolean {
  const pins = getPins();
  const filtered = pins.filter((p) => p.id !== id);
  if (filtered.length === pins.length) return false;
  savePins(filtered);
  return true;
}

// ── Pin Icons (central icon library) ─────────────────────────────

function seedPinIcons(): ContentPinIconRecord[] {
  return [
    { id: 'icon-airport', name: 'Flughafen', image: null },
    { id: 'icon-hotel', name: 'Hotel', image: null },
    { id: 'icon-stadium', name: 'Stadion / Spielort', image: null },
    { id: 'icon-other', name: 'Sonstiges', image: null },
  ];
}

export function getPinIcons(): ContentPinIconRecord[] {
  return readJsonFile<ContentPinIconRecord[]>(pinIconsPath, seedPinIcons());
}

export function savePinIcons(icons: ContentPinIconRecord[]) {
  writeJsonFile(pinIconsPath, icons);
}

export function createPinIcon(payload: Omit<ContentPinIconRecord, 'id'>): ContentPinIconRecord {
  const icons = getPinIcons();
  const record: ContentPinIconRecord = { id: randomUUID(), ...payload };
  icons.push(record);
  savePinIcons(icons);
  return record;
}

export function updatePinIcon(id: string, updates: Partial<ContentPinIconRecord>): ContentPinIconRecord | null {
  const icons = getPinIcons();
  const index = icons.findIndex((ic) => ic.id === id);
  if (index === -1) return null;
  const updated = { ...icons[index], ...updates };
  icons[index] = updated;
  savePinIcons(icons);
  return updated;
}

export function deletePinIcon(id: string): boolean {
  const icons = getPinIcons();
  const filtered = icons.filter((ic) => ic.id !== id);
  if (filtered.length === icons.length) return false;
  savePinIcons(filtered);
  return true;
}
