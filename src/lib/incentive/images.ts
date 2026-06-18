/**
 * incentive/images.ts – Bildbeschaffung.
 * Reihenfolge: Unsplash → Pexels (falls Settings-Key vorhanden) → Wikipedia (keyless Fallback).
 * Settings-Keys (optional) unter settings.incentive: unsplash_key, pexels_key.
 */
import { getSettings } from '../settingsStore';

export interface FoundImage { url: string; credit?: string }

function incentiveCfg(): Record<string, string> {
  return ((getSettings() as unknown as { incentive?: Record<string, string> }).incentive) || {};
}

async function fromUnsplash(query: string, key: string): Promise<FoundImage | undefined> {
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Client-ID ${key}` } });
    if (!res.ok) return undefined;
    const j = await res.json() as { results?: Array<{ urls?: { regular?: string }; user?: { name?: string } }> };
    const r = j.results?.[0];
    if (!r?.urls?.regular) return undefined;
    return { url: r.urls.regular, credit: r.user?.name ? `Foto: ${r.user.name} / Unsplash` : 'Unsplash' };
  } catch { return undefined; }
}

async function fromPexels(query: string, key: string): Promise<FoundImage | undefined> {
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: key } });
    if (!res.ok) return undefined;
    const j = await res.json() as { photos?: Array<{ src?: { large2x?: string; large?: string }; photographer?: string }> };
    const p = j.photos?.[0];
    const url = p?.src?.large2x || p?.src?.large;
    if (!url) return undefined;
    return { url, credit: p?.photographer ? `Foto: ${p.photographer} / Pexels` : 'Pexels' };
  } catch { return undefined; }
}

async function fromWikipedia(query: string, lang = 'de'): Promise<FoundImage | undefined> {
  try {
    const title = encodeURIComponent(query.trim().replace(/\s+/g, '_'));
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`,
      { headers: { 'accept': 'application/json' } });
    if (!res.ok) return lang === 'de' ? fromWikipedia(query, 'en') : undefined;
    const j = await res.json() as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
    const url = j.originalimage?.source || j.thumbnail?.source;
    if (!url) return lang === 'de' ? fromWikipedia(query, 'en') : undefined;
    return { url, credit: 'Bild: Wikimedia Commons' };
  } catch { return undefined; }
}

/** Findet ein Bild für eine Suchanfrage über die beste verfügbare Quelle. */
export async function findImage(query: string): Promise<FoundImage | undefined> {
  const cfg = incentiveCfg();
  if (cfg.unsplash_key) {
    const r = await fromUnsplash(query, cfg.unsplash_key);
    if (r) return r;
  }
  if (cfg.pexels_key) {
    const r = await fromPexels(query, cfg.pexels_key);
    if (r) return r;
  }
  return fromWikipedia(query);
}
