import { NextResponse } from 'next/server';
import { getEventBySlug, getPackagesByEventSlug, type PackageRecord } from '@/lib/eventData';

/**
 * Liefert die Package-Karten eines Events als selbstenthaltenes HTML
 * (Inline-CSS, kein JS, absolute URLs) für die WordPress-Einbettung via
 * [faltin_packages]/[faltin_anfrage]-Shortcode. Antwortformat kompatibel zu
 * faltin_events_fetch: { success, data: { has_packages, count, event_name, html } }.
 * Keine aktiven Packages → has_packages:false, das Plugin rendert dann das
 * native Anfrageformular (gleiche Logik wie die eigene Event-Seite).
 *
 * ?site=<home_url der einbettenden Seite> → Buchungslinks erhalten
 * &embed=1 (Buchungsseite ohne Menü/Footer) und &ref=<host> (Affiliate-
 * Quelle, wird bei der Anfrage gespeichert).
 *
 * Theme-Festigkeit (zweistufig): (1) KEINE h3/p/ul-Tags — Theme-Selektoren
 * auf Überschriften/Absätze/Listen greifen ins Leere; (2) alle kritischen
 * Eigenschaften (Farbe, Font, Margins) als Inline-Styles MIT !important —
 * das ist die höchste Stufe der CSS-Kaskade und schlägt auch Theme-Regeln,
 * die selbst !important verwenden. Der <style>-Block liefert nur noch
 * Layout (Grid, Hover, Media-Positionierung).
 */

const NAVY = '#143047';
const ORANGE = '#d9531e';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

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

/* Inline-Styles mit !important — unschlagbar in der Kaskade (auch gegen
   Theme-Regeln mit !important). Jedes sichtbare Element trägt sie direkt. */
const S = {
  title: `display:block !important;color:${NAVY} !important;font-size:17px !important;font-weight:800 !important;line-height:1.35 !important;margin:0 0 4px !important;padding:0 !important;background:transparent !important;text-transform:none !important;letter-spacing:normal !important;text-shadow:none !important;font-family:${FONT} !important`,
  desc: `display:block !important;color:#5b6b7d !important;font-size:13px !important;font-weight:400 !important;line-height:1.55 !important;margin:0 !important;padding:0 !important;background:transparent !important;text-transform:none !important;text-shadow:none !important;font-family:${FONT} !important`,
  list: `display:flex !important;flex-direction:column !important;gap:8px !important;margin:14px 0 0 !important;padding:14px 0 0 !important;border-top:1px solid #eef2f7 !important;background:transparent !important`,
  li: `display:flex !important;gap:8px !important;align-items:flex-start !important;color:#33404d !important;font-size:13px !important;font-weight:400 !important;line-height:1.4 !important;margin:0 !important;padding:0 !important;background:transparent !important;text-shadow:none !important;font-family:${FONT} !important`,
  meta: `display:block !important;color:#8190a0 !important;font-size:11.5px !important;font-weight:400 !important;margin:14px 0 8px !important;padding:0 !important;font-family:${FONT} !important`,
  few: `display:block !important;color:${ORANGE} !important;font-size:11.5px !important;font-weight:700 !important;margin:0 0 6px !important;padding:0 !important;font-family:${FONT} !important`,
  ab: `display:block !important;color:#8190a0 !important;font-size:12px !important;margin:0 !important;padding:0 !important;font-family:${FONT} !important`,
  price: `display:block !important;color:${NAVY} !important;font-size:24px !important;font-weight:800 !important;line-height:1.1 !important;margin:0 !important;padding:0 !important;background:transparent !important;font-family:${FONT} !important`,
  priceSo: `display:block !important;color:#8190a0 !important;font-size:24px !important;font-weight:800 !important;line-height:1.1 !important;margin:0 !important;padding:0 !important;background:transparent !important;font-family:${FONT} !important`,
  per: `display:block !important;color:#8190a0 !important;font-size:11.5px !important;font-weight:400 !important;margin:0 !important;padding:0 !important;font-family:${FONT} !important`,
  hotelName: `color:#fff !important;font-size:13px !important;font-weight:700 !important;text-shadow:0 1px 3px rgba(0,0,0,.5) !important;background:transparent !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;font-family:${FONT} !important`,
  stars: `display:block !important;color:#f5b301 !important;font-size:11px !important;line-height:1.2 !important;background:transparent !important;text-shadow:none !important`,
  chipBadge: `display:inline-block !important;padding:4px 10px !important;border-radius:999px !important;font-size:11px !important;font-weight:700 !important;line-height:1.3 !important;background:rgba(255,255,255,.92) !important;color:${NAVY} !important;text-transform:none !important;letter-spacing:normal !important;text-shadow:none !important;border:0 !important;font-family:${FONT} !important`,
  chipHl: `display:inline-block !important;padding:4px 10px !important;border-radius:999px !important;font-size:11px !important;font-weight:700 !important;line-height:1.3 !important;background:${ORANGE} !important;color:#fff !important;text-transform:none !important;letter-spacing:normal !important;text-shadow:none !important;border:0 !important;font-family:${FONT} !important`,
  chipSo: `display:inline-block !important;padding:4px 10px !important;border-radius:999px !important;font-size:11px !important;font-weight:700 !important;line-height:1.3 !important;background:rgba(20,48,71,.92) !important;color:#fff !important;text-transform:uppercase !important;letter-spacing:.04em !important;text-shadow:none !important;border:0 !important;font-family:${FONT} !important`,
  fotos: `flex-shrink:0 !important;display:inline-flex !important;align-items:center !important;background:rgba(20,48,71,.55) !important;color:#fff !important;font-size:10.5px !important;font-weight:600 !important;padding:2px 8px !important;border-radius:999px !important;text-shadow:none !important;font-family:${FONT} !important`,
  cta: `display:block !important;margin:12px 0 0 !important;padding:11px 16px !important;border-radius:10px !important;text-align:center !important;font-size:13px !important;font-weight:700 !important;text-decoration:none !important;border:1.5px solid ${NAVY} !important;color:${NAVY} !important;background:#fff !important;box-shadow:none !important;text-transform:none !important;letter-spacing:normal !important;font-family:${FONT} !important;cursor:pointer !important`,
  ctaPop: `display:block !important;margin:12px 0 0 !important;padding:11px 16px !important;border-radius:10px !important;text-align:center !important;font-size:13px !important;font-weight:700 !important;text-decoration:none !important;border:1.5px solid ${ORANGE} !important;color:#fff !important;background:${ORANGE} !important;box-shadow:none !important;text-transform:none !important;letter-spacing:normal !important;font-family:${FONT} !important;cursor:pointer !important`,
  ctaSo: `display:block !important;margin:12px 0 0 !important;padding:11px 16px !important;border-radius:10px !important;text-align:center !important;font-size:13px !important;font-weight:700 !important;text-decoration:none !important;border:1.5px solid #d8e0ea !important;color:#8190a0 !important;background:#eef2f7 !important;box-shadow:none !important;font-family:${FONT} !important;cursor:not-allowed !important`,
  img: `position:absolute !important;inset:0 !important;width:100% !important;height:100% !important;max-width:none !important;object-fit:cover !important;margin:0 !important;padding:0 !important;display:block !important;border:0 !important;border-radius:0 !important;box-shadow:none !important`,
};

/* Nur noch Layout (Grid, Card, Media, Hover) — Inhalte sind inline gestylt. */
const STYLE = `
<style>
.ftpk-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))!important;gap:24px!important;margin:0!important;padding:0!important;font-family:${FONT}!important;line-height:1.5!important;text-align:left!important}
.ftpk-grid *{box-sizing:border-box!important}
.ftpk-card{position:relative!important;display:flex!important;flex-direction:column!important;background:#fff!important;border:1px solid #d8e0ea!important;border-radius:16px!important;overflow:hidden!important;box-shadow:0 2px 10px rgba(20,48,71,.06)!important;transition:transform .2s ease,box-shadow .2s ease!important;margin:0!important;padding:0!important}
.ftpk-card:hover{transform:translateY(-4px)!important;box-shadow:0 10px 26px rgba(20,48,71,.14)!important}
.ftpk-card--pop{border:2px solid ${NAVY}!important;box-shadow:0 10px 26px rgba(20,48,71,.16)!important}
.ftpk-media{position:relative!important;height:185px!important;overflow:hidden!important;background:#eef2f7!important;margin:0!important;padding:0!important}
.ftpk-media--so img{filter:grayscale(.55) brightness(.9)!important}
.ftpk-shade{position:absolute!important;inset:0!important;background:linear-gradient(180deg,rgba(20,48,71,.05) 40%,rgba(20,48,71,.68) 100%)!important}
.ftpk-badges{position:absolute!important;left:12px!important;top:12px!important;right:12px!important;display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin:0!important;padding:0!important}
.ftpk-hotel{position:absolute!important;left:12px!important;right:12px!important;bottom:10px!important;display:flex!important;justify-content:space-between!important;align-items:flex-end!important;gap:8px!important;margin:0!important;padding:0!important}
.ftpk-body{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;padding:18px 20px 20px!important;margin:0!important;background:#fff!important}
.ftpk-foot{margin-top:auto!important;padding-top:14px!important;border-top:1px solid #eef2f7!important}
a.ftpk-cta:hover{opacity:.85!important}
</style>`;

function renderCard(pkg: PackageRecord, base: string, eventSlug: string, linkSuffix: string): string {
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
  const bookingUrl = `${base}/booking?event=${encodeURIComponent(eventSlug)}&package=${encodeURIComponent(pkg.slug || pkg.id)}&persons=1${linkSuffix}`;

  const galleryAttr = `data-ftpk-gallery="${esc(JSON.stringify(images))}" data-ftpk-title="${esc(pkg.hotel || pkg.title || '')}"`;
  const media = images.length
    ? `<div class="ftpk-media${soldOut ? ' ftpk-media--so' : ''}" ${galleryAttr} style="cursor:pointer" title="Fotos ansehen">
        <img src="${esc(images[0])}" alt="${esc(pkg.hotel || pkg.title || '')}" loading="lazy" style="${S.img}" onerror="this.style.display='none'" />
        <div class="ftpk-shade"></div>
        <div class="ftpk-badges">
          ${pkg.badge_text ? `<span style="${S.chipBadge}">${esc(pkg.badge_text)}</span>` : ''}
          ${popular ? `<span style="${S.chipHl}">★ Highlight</span>` : ''}
          ${soldOut ? `<span style="${S.chipSo}">Ausgebucht</span>` : ''}
        </div>
        <div class="ftpk-hotel">
          <span style="min-width:0">
            ${pkg.hotel ? `<span style="${S.hotelName}">${esc(pkg.hotel)}</span>` : ''}
            ${stars ? `<span style="${S.stars}">${'★'.repeat(stars)}</span>` : ''}
          </span>
          ${images.length > 1 ? `<span style="${S.fotos};cursor:pointer">📷 ${images.length} Fotos</span>` : ''}
        </div>
      </div>`
    : '';

  const metaBits = [
    pkg.travel_period ? esc(pkg.travel_period) : '',
    nights ? `${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}` : '',
  ].filter(Boolean).join(' · ');

  const cta = soldOut
    ? `<span style="${S.ctaSo}">Ausgebucht</span>`
    : `<a class="ftpk-cta" href="${esc(bookingUrl)}" style="${popular ? S.ctaPop : S.cta}">Weiter zur Buchung →</a>`;

  /* Bewusst div/span statt h3/p/ul: Theme-Selektoren auf Überschriften,
     Absätze und Listen können hier gar nicht erst greifen. */
  return `<div class="ftpk-card${popular ? ' ftpk-card--pop' : ''}">
    ${media}
    <div class="ftpk-body">
      <div style="${S.title}">${esc(pkg.title || '')}</div>
      ${pkg.short_description ? `<div style="${S.desc}">${esc(pkg.short_description)}</div>` : ''}
      ${includes.length ? `<div style="${S.list}">${includes.map((i) => `<div style="${S.li}">${CHECK_SVG}<span>${esc(i.name)}</span></div>`).join('')}</div>` : ''}
      <div class="ftpk-foot">
        ${metaBits ? `<div style="${S.meta}">${metaBits}</div>` : ''}
        ${fewSpots ? `<div style="${S.few}">Nur noch wenige Plätze verfügbar</div>` : ''}
        <div style="${S.ab}">ab</div>
        <div style="${soldOut ? S.priceSo : S.price}">${fmtPrice(price, pkg.currency)}</div>
        <div style="${S.per}">pro Person im Doppelzimmer</div>
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

  // Einbettende Seite (Affiliate-Quelle): Plugin übergibt home_url() als ?site=
  const site = searchParams.get('site') || '';
  let refHost = '';
  if (site) {
    try { refHost = new URL(site).host; } catch { refHost = site.replace(/^https?:\/\//, '').split('/')[0]; }
  }
  // Externe Einstiege: Buchungsseite ohne Menü (&embed=1) + Quelle (&ref=)
  const linkSuffix = `&embed=1${refHost ? `&ref=${encodeURIComponent(refHost)}` : ''}`;

  const base = (event.base_url || process.env.NEXT_PUBLIC_SITE_URL || 'https://next.faltintravel.com').replace(/\/$/, '');
  const packages = (await getPackagesByEventSlug(eventSlug)).filter((p) => p.active !== false);

  if (packages.length === 0) {
    return NextResponse.json({
      success: true,
      data: { has_packages: false, count: 0, event_name: event.name || event.title, html: '' },
    });
  }

  // SEO/GEO-JSON-LD: SportsEvent (Termin/Ort) + ItemList mit Product/Offer
  // (Preise & Verfügbarkeit) — als @graph in einem Block.
  const sportsEventLd: Record<string, unknown> = {
    '@type': 'SportsEvent',
    name: event.name || event.title,
    url: `${base}/booking?event=${encodeURIComponent(eventSlug)}`,
  };
  if (event.start_date) sportsEventLd.startDate = event.start_date;
  if (event.end_date) sportsEventLd.endDate = event.end_date;
  if (event.hero_image) sportsEventLd.image = absUrl(base, event.hero_image);
  if (event.description) sportsEventLd.description = event.description;
  if (event.venue || event.location_city) {
    sportsEventLd.location = {
      '@type': 'Place',
      name: event.venue || event.location_city,
      address: [event.location_city, event.location_country].filter(Boolean).join(', '),
    };
  }

  const itemListLd = {
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

  const jsonLd = { '@context': 'https://schema.org', '@graph': [sportsEventLd, itemListLd] };

  const LIGHTBOX = `<script>(function(){
if(window.__ftpkLB)return;window.__ftpkLB=1;
var imgs=[],idx=0,ov=null,im=null,ct=null,tt=null;
function stop(fn){return function(e){e.stopPropagation();fn(e);};}
function build(){
  ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:2147483000;background:rgba(10,22,34,.93);display:flex;align-items:center;justify-content:center;flex-direction:column;padding:24px;box-sizing:border-box';
  im=document.createElement('img');
  im.style.cssText='max-width:92vw;max-height:78vh;object-fit:contain;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)';
  tt=document.createElement('div');
  tt.style.cssText='color:#fff;font:700 15px -apple-system,Segoe UI,Roboto,sans-serif;margin:14px 0 2px;text-align:center';
  ct=document.createElement('div');
  ct.style.cssText='color:rgba(255,255,255,.7);font:400 13px -apple-system,Segoe UI,Roboto,sans-serif';
  var x=btn('\u00d7','position:absolute;top:14px;right:18px;font-size:30px;line-height:1');x.onclick=stop(close);
  var pv=btn('\u2039','position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:34px');pv.onclick=stop(function(){go(-1);});
  var nx=btn('\u203a','position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:34px');nx.onclick=stop(function(){go(1);});
  ov.appendChild(im);ov.appendChild(tt);ov.appendChild(ct);ov.appendChild(x);ov.appendChild(pv);ov.appendChild(nx);
  ov.onclick=close;im.onclick=stop(function(){go(1);});
  document.body.appendChild(ov);
  document.addEventListener('keydown',key);
}
function btn(txt,extra){var b=document.createElement('button');b.textContent=txt;
  b.style.cssText='background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:999px;width:46px;height:46px;cursor:pointer;font-family:inherit;'+extra;return b;}
function key(e){if(!ov)return;if(e.key==='Escape')close();if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1);}
function show(){im.src=imgs[idx];ct.textContent=(idx+1)+' / '+imgs.length;}
function go(d){idx=(idx+d+imgs.length)%imgs.length;show();}
function close(){if(ov){document.removeEventListener('keydown',key);ov.remove();ov=null;}}
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target.closest('[data-ftpk-gallery]'):null;
  if(!t)return;e.preventDefault();e.stopPropagation();
  try{imgs=JSON.parse(t.getAttribute('data-ftpk-gallery'))||[];}catch(err){return;}
  if(!imgs.length)return;idx=0;
  if(!ov)build();tt.textContent=t.getAttribute('data-ftpk-title')||'';show();
});
})();</script>`;

  const html =
    STYLE +
    `<div class="ftpk-grid" data-ftv="1.6.4">${packages.map((p) => renderCard(p, base, eventSlug, linkSuffix)).join('')}</div>` +
    LIGHTBOX +
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

  return NextResponse.json({
    success: true,
    data: { has_packages: true, count: packages.length, event_name: event.name || event.title, html },
  });
}
