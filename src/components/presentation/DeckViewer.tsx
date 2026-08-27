'use client';

/**
 * DeckViewer – Kundenansicht einer freigegebenen Präsentation.
 * Eine Folie im Blick, Navigation per Klick, Pfeiltasten oder Wischen.
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { SlideStage, type CompanyInfo } from './SlideCanvas';
import { DECK } from '@/lib/presentation/theme';
import type { Deck } from '@/lib/presentation/types';

export default function DeckViewer({ deck, company, pdfUrl }: { deck: Deck; company: CompanyInfo; pdfUrl: string }) {
  const [i, setI] = useState(0);
  const total = deck.slides.length;
  const go = useCallback((delta: number) => setI((cur) => Math.min(Math.max(cur + delta, 0), Math.max(0, total - 1))), [total]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go]);

  if (!total) {
    return <main style={{ background: DECK.bg, color: DECK.inkSoft, minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Diese Präsentation enthält noch keine Folien.</main>;
  }

  return (
    <main style={{ background: DECK.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2vh 2vw', gap: 16 }}>
      <div style={{ width: '100%', maxWidth: 1400 }}>
        <SlideStage slide={deck.slides[i]} deck={deck} company={company} style={{ borderRadius: 10 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: DECK.inkSoft, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="Vorherige Folie"
          style={{ background: 'transparent', border: 'none', color: i === 0 ? DECK.inkMuted : DECK.ink, cursor: i === 0 ? 'default' : 'pointer' }}>
          <ChevronLeft size={26} />
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          {deck.slides.map((s, idx) => (
            <button key={s.id} onClick={() => setI(idx)} aria-label={`Folie ${idx + 1}`}
              style={{ width: 9, height: 9, borderRadius: 999, border: 'none', cursor: 'pointer', background: idx === i ? DECK.accent : '#33465c' }} />
          ))}
        </div>

        <button onClick={() => go(1)} disabled={i >= total - 1} aria-label="Nächste Folie"
          style={{ background: 'transparent', border: 'none', color: i >= total - 1 ? DECK.inkMuted : DECK.ink, cursor: i >= total - 1 ? 'default' : 'pointer' }}>
          <ChevronRight size={26} />
        </button>

        <span style={{ fontSize: 13, color: DECK.inkMuted }}>{i + 1} / {total}</span>

        <a href={pdfUrl} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: DECK.accentSoft, textDecoration: 'none', border: `1px solid ${DECK.edge}`, borderRadius: 999, padding: '6px 14px' }}>
          <Download size={15} /> Als PDF
        </a>
      </div>
    </main>
  );
}
