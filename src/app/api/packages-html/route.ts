import { NextResponse } from 'next/server';
import { getEventBySlug, getPackagesByEventSlug, type PackageRecord } from '@/lib/eventData';

/**
 * Liefert die Package-Karten eines Events als selbstenthaltenes HTML
 * (Inline-CSS, kein JS, absolute URLs) für die WordPress-Einbettung via
 * [faltin_packages]-Shortcode. Antwortformat kompatibel zu faltin_events_fetch:
 * { success, data: { has_packages, count, event_name, html } }.
 * Keine aktiven Packages → has_packages:false, das Plugin rendert dann das
 * native Anfrageformular (gleiche Logik wie die eigene Event-Seite).
 */

const NAVY = '#143047';
const ORANGE = '#d9531e';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absUrl(base: string, src: string): string {
  if (!src) return src;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  return base.replace(/\/$/, '') + (src.startsWith('/') ? src : `/${src}`);
}

function fmtPrice(amount: number, currency?: string | null): string {
  const cur = (currency || 'EUR').toUpperCase();
  if (cur === 'EUR') return `${amount.toLocaleString('de-DE')} €`;
  return `${cur} ${amount.toLocaleString('de-CH')}`;
}

const CHECK_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${ORANGE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px"><path d="M20 6 9 17l-5-5"/></svg>`;

const STYLE = `
<style>
.ftpk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin:0;padding:0}
.ftpk-card{position:relative;display:flex;flex-direction:column;background:#fff;border:1px solid #d8e0ea;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(20,48,71,.06);transition:transform .2s ease,box-shadow .2s ease}
.ftpk-card:hover{transform:translateY(-4px);box-shadow:0 10px 26px rgba(20,48,71,.14)}
.ftpk-card--pop{border:2px solid ${NAVY};box-shadow:0 10px 26px rgba(20,48,71,.16)}
.ftpk-media{position:relative;height:185px;overflow:hidden;background:#eef2f7}
.ftpk-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;margin:0;display:block}
.ftpk-media--so img{filter:grayscale(.55) brightness(.9)}
.ftpk-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,48,71,.05) 40%,rgba(20,48,71,.68) 100%)}
.ftpk-badges{position:absolute;left:12px;top:12px;display:flex;flex-wrap:wrap;gap:6px}
.ftpk-chip{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;line-height:1.3}
.ftpk-chip--badge{background:rgba(255,255,255,.92);color:${NAVY}}
.ftpk-chip--hl{background:${ORANGE};color:#fff}
.ftpk-chip--so{position:absolute;right:12px;top:12px;background:rgba(20,48,71,.92);color:#fff;text-transform:uppercase;letter-spacing:.04em}
.ftpk-hotel{position:absolute;left:12px;right:12px;bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;gap:8px}
.ftpk-hotel b{color:#fff;font-size:13px;text-shadow:0 1px 3px rgba(0,0,0,.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ftpk-stars{color:#f5b301;font-size:11px;line-height:1.2}
.ftpk-fotos{flex-shrink:0;background:rgba(20,48,71,.55);color:#fff;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px}
.ftpk-body{display:flex;flex-direction:column;flex:1;padding:18px 20px 20px}
.ftpk-title{margin:0 0 4px;font-size:17px;font-weight:800;line-height:1.35;color:${NAVY}}
.ftpk-desc{margin:0;font-size:13px;line-height:1.55;color:#5b6b7d}
.ftpk-list{list-style:none;margin:14px 0 0;padding:14px 0 0;border-top:1px solid #eef2f7;display:flex;flex-direction:column;gap:8px}
.ftpk-list li{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.4;color:#33404d;margin:0}
.ftpk-foot{margin-top:auto;padding-top:14px;border-top:1px solid #eef2f7}
.ftpk-meta{font-size:11.5px;color:#8190a0;margin:14px 0 8px}
.ftpk-few{font-size:11.5px;font-weight:700;color:${ORANGE};margin:0 0 6px}
.ftpk-ab{font-size:12px;color:#8190a0}
.ftpk-price{font-size:24px;font-weight:800;line-height:1.1;color:${NAVY}}
.ftpk-price--so{color:#8190a0}
.ftpk-per{font-size:11.5px;color:#8190a0}
.ftpk-cta{display:block;margin-top:12px;padding:11px 16px;border-radius:10px;text-align:center;font-size:13px;font-weight:700;text-decoration:none;border:1.5px solid ${NAVY};color:${NAVY};transition:opacity .15s}
.ftpk-cta:hover{opacity:.85;text-decoration:none;color:${NAVY}}
.ftpk-cta--pop{background:${ORANGE};border-color:${ORANGE};color:#fff}
.ftpk-cta--pop:hover{color:#fff}
.ftpk-cta--so{background:#eef2f7;border:1.5px solid #d8e0ea;color:#8190a0;cursor:not-allowed}
</style>`;

function renderCard(pkg: PackageRecord, base: string, eventSlug: string): string {
  const soldOut = pkg.available_spots === 0;
  const spots = typeof pkg.available_spots === 'number' ? pkg.available_spots : null;
  const fewSpots = !soldOut && spots !== null && spots > 0 && spots <= 10;
  const popular = Boolean(pkg.popular) && !soldOut;
  const images = (pkg.hotel_images || []).filter(Boolean).map((i) => absUrl(base, i));
  const includes = (pkg.package_includes || (pkg as PackageRecord & { includes?: Array<{ name: string }> }).includes || [])
    .filter((i) => i && i.name)
    .slice(0, 6);
  const stars = Math.max(0, Math.min(5, Number(pkg.stars || 0)));
  const nights = Number(pkg.nights || 0);
  const price = Number(pkg.price || 0);
  const bookingUrl = `${base}/booking?event=${encodeURIComponent(eventSlug)}&package=${encodeURIComponent(pkg.slug || pkg.id)}&persons=2`;

  const media = images.length
    ? `<div class="ftpk-media${soldOut ? ' ftpk-media--so' : ''}">
        <img src="${esc(images[0])}" alt="${esc(pkg.hotel || pkg.title || '')}" loading="lazy" />
        <div class="ftpk-shade"></div>
        <div class="ftpk-badges">
          ${pkg.badge_text ? `<span class="ftpk-chip ftpk-chip--badge">${esc(pkg.badge_text)}</span>` : ''}
          ${popular ? `<span class="ftpk-chip ftpk-chip--hl">★ Highlight</span>` : ''}
        </div>
        ${soldOut ? `<span class="ftpk-chip ftpk-chip--so">Ausgebucht</span>` : ''}
        <div class="ftpk-hotel">
          <span style="min-width:0">
            ${pkg.hotel ? `<b>${esc(pkg.hotel)}</b>` : ''}
            ${stars ? `<span class="ftpk-stars" style="display:block">${'★'.repeat(stars)}</span>` : ''}
          </span>
          ${images.length > 1 ? `<span class="ftpk-fotos">📷 ${images.length} Fotos</span>` : ''}
        </div>
      </div>`
    : '';

  const metaBits = [
    pkg.travel_period ? esc(pkg.travel_period) : '',
    nights ? `${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}` : '',
  ].filter(Boolean).join(' · ');

  const cta = soldOut
    ? `<span class="ftpk-cta ftpk-cta--so">Ausgebucht</span>`
    : `<a class="ftpk-cta${popular ? ' ftpk-cta--pop' : ''}" href="${esc(bookingUrl)}">Unverbindlich anfragen →</a>`;

  return `<div class="ftpk-card${popular ? ' ftpk-card--pop' : ''}">
    ${media}
    <div class="ftpk-body">
      <h3 class="ftpk-title">${esc(pkg.title || '')}</h3>
      ${pkg.short_description ? `<p class="ftpk-desc">${esc(pkg.short_description)}</p>` : ''}
      ${includes.length ? `<ul class="ftpk-list">${includes.map((i) => `<li>${CHECK_SVG}<span>${esc(i.name)}</span></li>`).join('')}</ul>` : ''}
      <div class="ftpk-foot">
        ${metaBits ? `<div class="ftpk-meta">${metaBits}</div>` : ''}
        ${fewSpots ? `<div class="ftpk-few">Nur noch wenige Plätze verfügbar</div>` : ''}
        <div class="ftpk-ab">ab</div>
        <div class="ftpk-price${soldOut ? ' ftpk-price--so' : ''}">${fmtPrice(price, pkg.currency)}</div>
        <div class="ftpk-per">pro Person im Doppelzimmer</div>
        ${cta}
      </div>
    </div>
  </div>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventSlug = searchParams.get('event') || '';
  if (!eventSlug) {
    return NextResponse.json({ success: false, error: 'event fehlt' }, { status: 400 });
  }

  const event = await getEventBySlug(eventSlug);
  if (!event) {
    return NextResponse.json({ success: false, error: 'Event nicht gefunden' }, { status: 404 });
  }

  const base = (event.base_url || process.env.NEXT_PUBLIC_SITE_URL || 'https://next.faltintravel.com').replace(/\/$/, '');
  const packages = (await getPackagesByEventSlug(eventSlug)).filter((p) => p.active !== false);

  if (packages.length === 0) {
    return NextResponse.json({
      success: true,
      data: { has_packages: false, count: 0, event_name: event.name || event.title, html: '' },
    });
  }

  // Product/Offer-JSON-LD (GEO/SEO): Preise & Verfügbarkeit maschinenlesbar
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: packages.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: `${event.name || event.title} – ${p.title}`,
        description: p.short_description || undefined,
        image: (p.hotel_images || []).filter(Boolean).slice(0, 1).map((img) => absUrl(base, img)),
        offers: {
          '@type': 'Offer',
          price: Number(p.price || 0),
          priceCurrency: (p.currency || 'EUR').toUpperCase(),
          availability: p.available_spots === 0 ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
          url: `${base}/booking?event=${encodeURIComponent(eventSlug)}&package=${encodeURIComponent(p.slug || p.id)}`,
        },
      },
    })),
  };

  const html =
    STYLE +
    `<div class="ftpk-grid" data-ftv="1.4.0">${packages.map((p) => renderCard(p, base, eventSlug)).join('')}</div>` +
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

  return NextResponse.json({
    success: true,
    data: { has_packages: true, count: packages.length, event_name: event.name || event.title, html },
  });
}
