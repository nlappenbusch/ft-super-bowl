import { NextResponse } from 'next/server';
import { localizeRemoteImage } from '@/lib/mediaLibrary';
import {
  getEvents, saveEvents, getSeries, saveSeries, getPackages, savePackages,
} from '@/lib/contentStore';

/**
 * POST /api/admin/media/localize-all
 * Scannt alle Events/Serien/Packages nach Remote-Bild-URLs, lädt sie lokal
 * herunter (/public/uploads/media) und schreibt die lokalen Pfade zurück.
 * Bereits lokale Bilder werden übersprungen.
 */
export async function POST() {
  const cache = new Map<string, string>();
  const errors: string[] = [];
  let localized = 0;

  const isRemote = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//i.test(u);

  async function loc(u?: string | null): Promise<string | null | undefined> {
    if (!isRemote(u)) return u;
    if (cache.has(u)) return cache.get(u)!;
    try {
      const local = await localizeRemoteImage(u);
      cache.set(u, local);
      if (local !== u) localized++;
      return local;
    } catch (e) {
      errors.push(`${u} → ${(e as Error).message}`);
      return u; // Original behalten, wenn Download scheitert
    }
  }

  try {
    // Events
    const events = getEvents();
    for (const ev of events) {
      if (isRemote(ev.hero_image)) ev.hero_image = (await loc(ev.hero_image)) as string;
      if (isRemote(ev.ticket_image)) ev.ticket_image = (await loc(ev.ticket_image)) as string;
      if (isRemote(ev.leistungen_image)) ev.leistungen_image = (await loc(ev.leistungen_image)) as string;
      if (isRemote(ev.stadionplan_image)) ev.stadionplan_image = (await loc(ev.stadionplan_image)) as string;
      if (isRemote(ev.first_paragraph_image_1)) ev.first_paragraph_image_1 = (await loc(ev.first_paragraph_image_1)) as string;
      if (isRemote(ev.first_paragraph_image_2)) ev.first_paragraph_image_2 = (await loc(ev.first_paragraph_image_2)) as string;
      if (isRemote(ev.first_paragraph_image_3)) ev.first_paragraph_image_3 = (await loc(ev.first_paragraph_image_3)) as string;
    }
    saveEvents(events);

    // Serien
    const series = getSeries();
    for (const s of series) {
      if (isRemote(s.hero_image)) s.hero_image = (await loc(s.hero_image)) as string;
    }
    saveSeries(series);

    // Packages (hotel_images[])
    const packages = getPackages();
    for (const pkg of packages) {
      if (Array.isArray(pkg.hotel_images)) {
        const out: string[] = [];
        for (const img of pkg.hotel_images) {
          const localImg = await loc(img);
          if (typeof localImg === 'string' && localImg) out.push(localImg);
        }
        pkg.hotel_images = out;
      }
    }
    savePackages(packages);

    return NextResponse.json({ success: true, localized, errors });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message, localized, errors }, { status: 500 });
  }
}
