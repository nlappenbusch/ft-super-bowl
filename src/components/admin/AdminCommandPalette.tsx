'use client';

/**
 * Schnellsuche (Cmd+K / Strg+K) für das Admin-Panel.
 *
 * Durchsucht alle Navigationspunkte aus `adminNav` (Label, Gruppe, Stichworte).
 * Bei einer Eingabe steht als letzter Treffer „Faltin-KI fragen" bereit, der die
 * Frage an den KI-Arbeitsplatz weiterreicht. Tastatur: ↑/↓ wählen, Enter öffnet
 * (mit Cmd/Strg in neuem Tab), Esc schliesst. Der Fokus bleibt im Eingabefeld.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search, Sparkles } from 'lucide-react';
import { COLORS } from './ui';
import { AI_WORKSPACE_HREF, isNavItemActive, searchAdminNav } from './adminNav';

interface PaletteOption {
  key: string;
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  ai?: boolean;
  current?: boolean;
}

export default function AdminCommandPalette({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  const options = useMemo<PaletteOption[]>(() => {
    const q = query.trim();
    const list: PaletteOption[] = searchAdminNav(q).map((r) => ({
      key: r.item.href,
      href: r.item.href,
      label: r.item.label,
      hint: r.groupName,
      icon: r.item.icon,
      current: isNavItemActive(pathname, r.item),
    }));
    if (q) {
      list.push({
        key: '__ai__',
        href: `${AI_WORKSPACE_HREF}?q=${encodeURIComponent(q)}`,
        label: `Faltin-KI fragen: „${q}“`,
        hint: 'KI-Arbeitsplatz',
        icon: Sparkles,
        ai: true,
      });
    }
    return list;
  }, [query, pathname]);

  const current = options.length ? Math.min(active, options.length - 1) : -1;
  const activeId = current >= 0 ? `${baseId}-opt-${current}` : undefined;

  // Fokus ins Eingabefeld (Layout-Effekt: vor dem ersten Tastendruck); beim Schliessen
  // zurück zum auslösenden Element.
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => { previous?.focus?.(); };
  }, []);

  // Esc schliesst auch dann, wenn der Fokus (z.B. per Maus) nicht im Eingabefeld liegt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Seite dahinter nicht mitscrollen.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Markierten Treffer sichtbar halten.
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const open = (opt: PaletteOption, newTab = false) => {
    onClose();
    if (newTab) {
      window.open(opt.href, '_blank', 'noopener');
      return;
    }
    router.push(opt.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = options.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (n) setActive((current + 1) % n);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (n) setActive((current - 1 + n) % n);
        break;
      case 'PageDown':
        e.preventDefault();
        if (n) setActive(Math.min(n - 1, current + 5));
        break;
      case 'PageUp':
        e.preventDefault();
        if (n) setActive(Math.max(0, current - 5));
        break;
      case 'Enter':
        e.preventDefault();
        if (current >= 0) open(options[current], e.metaKey || e.ctrlKey);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;
      case 'Tab':
        // Fokus bleibt im Eingabefeld (Fokusfalle).
        e.preventDefault();
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Schnellsuche"
        className="relative flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ border: `1px solid ${COLORS.stroke}` }}
        // Klicks im Dialog dürfen den Fokus nicht aus dem Eingabefeld nehmen.
        onMouseDown={(e) => { if (e.target !== inputRef.current) e.preventDefault(); }}
      >
        <div className="flex shrink-0 items-center gap-3 border-b px-4" style={{ borderColor: COLORS.stroke }}>
          <Search className="h-5 w-5 shrink-0" style={{ color: COLORS.textMuted }} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Seite oder Funktion suchen"
            placeholder="Seite suchen oder Faltin-KI fragen …"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            style={{ color: COLORS.navy }}
          />
          <kbd
            className="hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold sm:inline"
            style={{ borderColor: COLORS.stroke, color: COLORS.textMuted }}
          >
            Esc
          </kbd>
        </div>

        <ul id={listId} role="listbox" aria-label="Treffer" className="min-h-0 flex-1 overflow-y-auto p-2">
          {options.map((opt, i) => {
            const selected = i === current;
            const Icon = opt.icon;
            return (
              <li
                key={opt.key}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={selected}
                onMouseMove={() => { if (!selected) setActive(i); }}
                onClick={(e) => open(opt, e.metaKey || e.ctrlKey)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${opt.ai && i > 0 ? 'mt-1' : ''}`}
                style={{
                  background: selected ? 'rgba(217,83,30,0.08)' : 'transparent',
                  color: COLORS.navy,
                }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: opt.ai || selected ? COLORS.accent : 'rgba(20,48,71,0.06)',
                    color: opt.ai || selected ? '#fff' : COLORS.navy,
                  }}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`min-w-0 flex-1 truncate ${opt.ai ? 'font-semibold' : 'font-medium'}`} style={opt.ai ? { color: COLORS.accent } : undefined}>
                  {opt.label}
                </span>
                {opt.current && (
                  <span className="hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline" style={{ background: 'rgba(20,48,71,0.06)', color: COLORS.textMuted }}>
                    Aktuelle Seite
                  </span>
                )}
                <span className={`shrink-0 text-xs ${opt.ai ? 'hidden sm:inline' : ''}`} style={{ color: COLORS.textMuted }}>{opt.hint}</span>
                <CornerDownLeft
                  className={`h-3.5 w-3.5 shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`}
                  style={{ color: COLORS.textMuted }}
                  aria-hidden="true"
                />
              </li>
            );
          })}
        </ul>

        {options.length === 0 && (
          <p className="px-4 py-8 text-center text-sm" style={{ color: COLORS.textMuted }}>Keine Treffer.</p>
        )}

        <div
          className="hidden shrink-0 items-center gap-4 border-t px-4 py-2 text-[11px] sm:flex"
          style={{ borderColor: COLORS.stroke, color: COLORS.textMuted }}
          aria-hidden="true"
        >
          <span><kbd className="font-sans font-semibold">↑</kbd> <kbd className="font-sans font-semibold">↓</kbd> auswählen</span>
          <span><kbd className="font-sans font-semibold">↵</kbd> öffnen</span>
          <span><kbd className="font-sans font-semibold">Esc</kbd> schliessen</span>
        </div>
      </div>
    </div>
  );
}
