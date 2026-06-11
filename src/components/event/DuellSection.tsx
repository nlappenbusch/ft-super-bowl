'use client';

export interface DuellData {
  team_a: string;
  team_b: string;
  team_a_sub?: string | null;
  team_b_sub?: string | null;
  bilanz_basis?: string | null;
  siege_a?: number | null;
  remis?: number | null;
  siege_b?: number | null;
  letzte?: Array<{ date: string; competition?: string | null; match: string; result: string }> | null;
  note?: string | null;
}

/**
 * Duell-Modul (Head-to-Head): zwei Teams gegenüber, Bilanz-Balken und letzte Begegnungen.
 * Einsatz auf Topspiel-/Paarungs-Seiten (z.B. Der Klassiker), wiederverwendbar für K.-o.-Duelle.
 */
export default function DuellSection({ duell }: { duell: DuellData }) {
  const a = Number(duell.siege_a ?? 0);
  const x = Number(duell.remis ?? 0);
  const b = Number(duell.siege_b ?? 0);
  const total = a + x + b;
  const hasBilanz = total > 0;
  const pct = (n: number) => `${Math.max(4, Math.round((n / total) * 100))}%`;
  const letzte = (duell.letzte || []).filter((m) => m && m.match);

  return (
    <div>
      {/* Team-Karten + VS */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3 md:gap-6">
        {[{ name: duell.team_a, sub: duell.team_a_sub }, null, { name: duell.team_b, sub: duell.team_b_sub }].map((t, i) =>
          t === null ? (
            <div key="vs" className="flex items-center">
              <span
                className="rounded-full px-4 py-2 text-lg md:text-2xl font-extrabold text-white"
                style={{ background: '#d9531e', boxShadow: '0 6px 18px rgba(217,83,30,0.45)' }}
              >
                VS
              </span>
            </div>
          ) : (
            <div
              key={i}
              className={`flex flex-col justify-center rounded-2xl px-4 py-6 md:px-8 ${i === 0 ? 'text-right' : 'text-left'}`}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.16)' }}
            >
              <div className="text-xl md:text-3xl font-extrabold leading-tight text-white">{t.name}</div>
              {t.sub && <div className="mt-1.5 text-sm text-white/65">{t.sub}</div>}
            </div>
          )
        )}
      </div>

      {/* Bilanz-Balken */}
      {hasBilanz && (
        <div className="mt-8">
          <div className="mb-2 flex items-end justify-between text-white">
            <div className="text-2xl md:text-3xl font-extrabold">{a}<span className="ml-2 text-xs font-semibold text-white/60">Siege</span></div>
            <div className="text-lg md:text-xl font-bold text-white/75">{x}<span className="ml-2 text-xs font-semibold text-white/50">Remis</span></div>
            <div className="text-2xl md:text-3xl font-extrabold">{b}<span className="ml-2 text-xs font-semibold text-white/60">Siege</span></div>
          </div>
          <div className="flex h-3.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <div style={{ width: pct(a), background: '#f5c842' }} />
            <div style={{ width: pct(x), background: 'rgba(255,255,255,0.35)' }} />
            <div style={{ width: pct(b), background: '#d9531e' }} />
          </div>
          {duell.bilanz_basis && (
            <div className="mt-2 text-xs text-white/55">Bilanz: {duell.bilanz_basis}</div>
          )}
        </div>
      )}

      {/* Letzte Begegnungen */}
      {letzte.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/60">Letzte Begegnungen</div>
          <div className="space-y-2">
            {letzte.map((m, i) => (
              <div
                key={`${m.date}-${i}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-3 text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <span className="font-bold text-white/85 whitespace-nowrap">{m.date}</span>
                {m.competition && (
                  <span className="rounded-sm px-2 py-0.5 text-[11px] font-bold text-white/80" style={{ background: 'rgba(255,255,255,0.12)' }}>
                    {m.competition}
                  </span>
                )}
                <span className="flex-1 text-white/85">{m.match}</span>
                <span className="text-base font-extrabold" style={{ color: '#f5c842' }}>{m.result}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {duell.note && <p className="mt-6 text-sm leading-relaxed text-white/70">{duell.note}</p>}
    </div>
  );
}
