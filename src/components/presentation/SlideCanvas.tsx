'use client';

/**
 * SlideCanvas – Web-Darstellung einer Deck-Folie.
 * ─────────────────────────────────────────────────────────────────────────────
 * Die Folie wird immer in einer festen Bühne von 1280×720 px aufgebaut und per
 * `transform: scale()` auf die verfügbare Breite gebracht. Dadurch stimmen
 * Proportionen und Schriftgrössen exakt mit dem PDF- und dem PPTX-Export überein
 * (dort ist die Folie 960×540 pt — dasselbe Verhältnis, dieselben relativen Masse).
 */
import React, { useEffect, useRef, useState } from 'react';
import { buildBlocks, buildPanel, type Block } from '@/lib/presentation/blocks';
import {
  DECK, FS, LEADING, PAD, PAD_PANEL, slideLayout, usedImageCount, parseRuns, plain, type Rect,
} from '@/lib/presentation/theme';
import type { Deck, Slide } from '@/lib/presentation/types';

export const STAGE_W = 1280;
export const STAGE_H = 720;

/** Firmenangaben für Kontaktpanels – im Client aus den Settings gereicht. */
export interface CompanyInfo {
  name: string; street: string; zip: string; city: string; country: string;
  phone?: string; email?: string; website?: string;
}

export const FALLBACK_COMPANY: CompanyInfo = {
  name: 'Faltin Travel AG', street: 'Riedthofstrasse 172', zip: '8105', city: 'Regensdorf',
  country: 'Schweiz', phone: '+41 44 700 22 77', email: 'kontakt@faltintravel.com', website: 'faltintravel.com',
};

const GRADIENT = `linear-gradient(to top right, ${DECK.panelTop} 0%, #071a2e 52%, ${DECK.bg} 100%)`;

const px = (rel: number) => rel * STAGE_H;

function box(r: Rect): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${r.x * STAGE_W}px`, top: `${r.y * STAGE_H}px`,
    width: `${r.w * STAGE_W}px`, height: `${r.h * STAGE_H}px`,
  };
}

/** Fett-Auszeichnung (**…**) in Spans übersetzen. */
function Rich({ text, upper }: { text: string; upper?: boolean }) {
  if (upper) return <>{plain(text).toUpperCase()}</>;
  return (
    <>
      {parseRuns(text).map((r, i) => (
        r.bold ? <strong key={i} style={{ fontWeight: 700, color: DECK.ink }}>{r.text}</strong> : <span key={i}>{r.text}</span>
      ))}
    </>
  );
}

function BlockView({ block, dense }: { block: Block; dense: boolean }) {
  const b = block;
  const bodySize = px(dense ? FS.bodySm : FS.body);
  const gap = b.gap ? px(0.012) * b.gap * 1.6 : 0;

  switch (b.kind) {
    case 'kicker':
      return <div style={{ marginTop: gap, marginBottom: px(0.016), fontSize: px(FS.kicker), fontWeight: 700, letterSpacing: '0.16em', color: DECK.accentSoft }}><Rich text={b.text || ''} upper /></div>;
    case 'titleBig':
      return <h1 style={{ margin: `${gap}px 0 ${px(0.020)}px`, fontSize: px(FS.h1), fontWeight: 400, lineHeight: LEADING.title, color: DECK.ink }}><Rich text={b.text || ''} /></h1>;
    case 'title':
      return <h2 style={{ margin: `${gap}px 0 ${px(0.018)}px`, fontSize: px(FS.h2), fontWeight: 400, lineHeight: LEADING.title, color: DECK.ink }}><Rich text={b.text || ''} /></h2>;
    case 'meta':
      return <div style={{ marginTop: gap, marginBottom: px(0.004), fontSize: px(FS.small), lineHeight: LEADING.dense, color: DECK.inkMuted }}><Rich text={b.text || ''} /></div>;
    case 'para':
      return <p style={{ margin: `${gap}px 0 ${px(0.012)}px`, fontSize: bodySize, lineHeight: dense ? LEADING.dense : LEADING.body, color: DECK.inkSoft, textAlign: 'justify' }}><Rich text={b.text || ''} /></p>;
    case 'bullet':
      return <div style={{ marginTop: gap, marginBottom: px(0.008), fontSize: bodySize, lineHeight: LEADING.dense, color: DECK.inkSoft, display: 'flex', gap: '0.6em' }}><span style={{ color: DECK.accent }}>—</span><span><Rich text={b.text || ''} /></span></div>;
    case 'subhead':
      return <div style={{ marginTop: gap || px(0.008), fontSize: px(FS.h3), fontWeight: 700, lineHeight: LEADING.dense, color: DECK.ink }}><Rich text={b.text || ''} /></div>;
    case 'contact':
      return <div style={{ fontSize: px(FS.small), lineHeight: LEADING.dense, color: DECK.inkMuted }}><Rich text={b.text || ''} /></div>;
    case 'link':
      return <div style={{ marginBottom: px(0.010), fontSize: px(FS.small), lineHeight: LEADING.dense, color: DECK.accentSoft, textDecoration: 'underline' }}>{plain(b.text || '')}</div>;
    case 'label':
      return <div style={{ marginTop: gap || px(0.016), marginBottom: px(0.010), fontSize: px(FS.kicker), fontWeight: 700, letterSpacing: '0.14em', color: DECK.accent }}>{plain(b.text || '').toUpperCase()}</div>;
    case 'highlight':
      return (
        <div style={{ marginTop: gap || px(0.016) }}>
          <span style={{ display: 'inline-block', background: DECK.accent, color: DECK.ink, borderRadius: 999, padding: `${px(0.008)}px ${px(0.018)}px`, fontSize: px(FS.bodySm), fontWeight: 700 }}>
            <Rich text={b.text || ''} />
          </span>
        </div>
      );
    case 'serviceRow':
      return (
        <div style={{ display: 'flex', gap: '0.7em', marginBottom: px(0.007), fontSize: px(FS.bodySm), lineHeight: LEADING.dense, color: b.included ? DECK.inkSoft : DECK.inkMuted }}>
          <span style={{ color: b.included ? DECK.accent : DECK.inkMuted, fontWeight: 700 }}>{b.included ? '✓' : '✕'}</span>
          <span><Rich text={b.text || ''} /></span>
        </div>
      );
    case 'priceRow':
      return (
        <div style={{ marginTop: gap, borderBottom: `1px solid ${DECK.edge}`, padding: `${px(0.007)}px 0`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1.5em' }}>
          <div style={{ fontSize: px(FS.bodySm), lineHeight: LEADING.dense, color: DECK.inkSoft }}>
            <Rich text={b.text || ''} />
            {b.note && <div style={{ fontSize: px(FS.small), color: DECK.inkMuted }}>{plain(b.note)}</div>}
          </div>
          <div style={{ fontSize: px(FS.bodySm), fontWeight: 700, color: DECK.ink, whiteSpace: 'nowrap' }}>{plain(b.value || '')}</div>
        </div>
      );
    case 'programCell':
      return (
        <div style={{ marginTop: gap || px(0.010), marginBottom: px(0.010), background: 'rgba(255,255,255,0.07)', borderRadius: px(0.008), padding: `${px(0.014)}px ${px(0.016)}px` }}>
          <div style={{ fontSize: px(FS.kicker), fontWeight: 700, letterSpacing: '0.12em', color: DECK.accent, marginBottom: px(0.005) }}>{plain(b.label || '').toUpperCase()}</div>
          <div style={{ fontSize: px(FS.bodySm), lineHeight: LEADING.dense, color: DECK.inkSoft }}><Rich text={b.text || ''} /></div>
        </div>
      );
    default:
      return null;
  }
}

function Column({ blocks, dense, style }: { blocks: Block[]; dense: boolean; style?: React.CSSProperties }) {
  const padX = PAD.x * STAGE_W * (dense ? 0.82 : 1);
  const padY = PAD.y * STAGE_H * 0.5;
  return (
    <div style={{ height: '100%', padding: `${padY}px ${padX}px`, overflow: 'hidden', ...style }}>
      {blocks.map((b, i) => <BlockView key={i} block={b} dense={dense} />)}
    </div>
  );
}

export function SlideCanvas({ slide, deck, company = FALLBACK_COMPANY }: { slide: Slide; deck: Deck; company?: CompanyInfo }) {
  const imgs = (slide.images || []).filter((i) => i.url);
  const layout = slideLayout(slide.kind, usedImageCount(slide));
  const dense = ['hotels', 'services', 'pricing', 'program'].includes(slide.kind);
  const blocks = buildBlocks(slide, deck);
  const panel = layout.panel ? buildPanel(slide, deck, company) : null;

  return (
    <div style={{ position: 'relative', width: STAGE_W, height: STAGE_H, background: DECK.bg, overflow: 'hidden', fontFamily: 'var(--font-deck, "Segoe UI", Corbel, Candara, system-ui, sans-serif)' }}>
      {layout.images.map((r, i) => (
        <div key={`img-${i}`} style={{ ...box(r), background: GRADIENT, overflow: 'hidden' }}>
          {imgs[i]?.url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={imgs[i].url} alt={imgs[i].caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          {imgs[i]?.caption && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(4,7,12,0.62)', color: DECK.inkSoft, fontSize: px(FS.tiny), padding: `${px(0.008)}px ${px(0.012)}px` }}>
              {imgs[i].caption}
            </div>
          )}
        </div>
      ))}

      {layout.text && (
        <div style={{ ...box(layout.text), background: GRADIENT }}>
          <Column blocks={blocks} dense={dense} />
          {slide.kind === 'about' && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src="/api/presentation/seal" alt="Schweizer Reisegarantie"
              style={{ position: 'absolute', left: PAD.x * STAGE_W, bottom: PAD.y * STAGE_H * 0.5, width: layout.text.w * STAGE_W * 0.2 }}
            />
          )}
        </div>
      )}

      {layout.panel && panel && (
        <div style={{ ...box(layout.panel), background: GRADIENT }}>
          <div style={{ height: '100%', padding: `${PAD_PANEL.y * STAGE_H}px ${PAD_PANEL.x * STAGE_W}px`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              {panel.kicker && <div style={{ fontSize: px(FS.kicker), fontWeight: 700, letterSpacing: '0.16em', color: DECK.accentSoft, marginBottom: px(0.010) }}>{plain(panel.kicker).toUpperCase()}</div>}
              {panel.title && <div style={{ fontSize: px(FS.h2), lineHeight: LEADING.title, color: DECK.ink, marginBottom: px(0.014) }}><Rich text={panel.title} /></div>}
              {panel.lines.map((l, i) => (
                <div key={i} style={{ fontSize: px(FS.small), lineHeight: LEADING.dense, color: i === 0 && !panel.title ? DECK.ink : DECK.inkMuted, fontWeight: i === 0 && !panel.title ? 700 : 400 }}>{l}</div>
              ))}
            </div>
            {panel.showLogo && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src="/faltin-logo.svg" alt="Faltin Travel" style={{ width: '62%', marginTop: px(0.02) }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Bühne, die eine Folie proportional auf die verfügbare Breite skaliert. */
export function SlideStage({ slide, deck, company, className, style }: {
  slide: Slide; deck: Deck; company?: CompanyInfo; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / STAGE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', background: DECK.bg, ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `scale(${scale})` }}>
        <SlideCanvas slide={slide} deck={deck} company={company} />
      </div>
    </div>
  );
}
