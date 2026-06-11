'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    _ekomiWidgetsServerUrl?: string;
    _customerId?: number;
    _ekomiDraftMode?: boolean;
    _language?: any;
    _ekomiWidgetTokens?: string[];
    ekomiWidgetJs?: boolean;
    ekomiWidgetMain?: (action: string, token: string) => void;
  }
}

interface EkomiWidgetProps {
  token: string;
  customerId?: number;
  language?: string;
  draftMode?: boolean;
  className?: string;
}

export default function EkomiWidget({
  token,
  customerId = 119361,
  language = 'de',
  draftMode = false,
  className,
}: EkomiWidgetProps) {
  const [blocked, setBlocked] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lädt automatisch beim Mounten (kein Klick nötig)
  useEffect(() => {
    const w = window;

    w._ekomiWidgetsServerUrl =
      (document.location.protocol === 'https:' ? 'https:' : 'http:') + '//widgets.ekomi.com';
    w._customerId = customerId;
    w._ekomiDraftMode = draftMode;
    if (w._language == undefined || typeof w._language !== 'object') w._language = {};
    w._language[token] = language;

    if (typeof w._ekomiWidgetTokens !== 'undefined') {
      if (!w._ekomiWidgetTokens.includes(token)) w._ekomiWidgetTokens.push(token);
    } else {
      w._ekomiWidgetTokens = [token];
    }

    if (typeof w.ekomiWidgetJs === 'undefined') {
      w.ekomiWidgetJs = true;
      const scr = document.createElement('script');
      scr.src = 'https://sw-assets.ekomiapps.de/static_resources/widget.js';
      scr.async = true;
      scr.onerror = () => setBlocked(true);
      document.head.appendChild(scr);
    } else if (typeof w.ekomiWidgetMain !== 'undefined') {
      w.ekomiWidgetMain('ajax', token);
    }

    // Adblocker-Erkennung: bleibt der Container leer, dezenten Fallback zeigen
    checkTimer.current = setTimeout(() => {
      const el = document.getElementById(`widget-container-${token}`);
      if (!el || el.childElementCount === 0) setBlocked(true);
    }, 4500);

    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [customerId, draftMode, language, token]);

  return (
    <div className={className}>
      <div
        id={`widget-container-${token}`}
        className={`ekomi-widget-container ekomi-widget-${token}`}
      />
      {blocked && (
        <div className="rounded-xl border border-[#143047]/15 bg-[#f5f7fa] px-5 py-3 text-center">
          <p className="text-xs leading-relaxed text-gray-500">
            Die eKomi-Bewertungen konnten nicht geladen werden (evtl. durch einen Adblocker blockiert).{' '}
            <a
              href="https://www.ekomi.de/bewertungen-faltin-travel.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
              style={{ color: '#d9531e' }}
            >
              Bewertungen direkt bei eKomi ansehen
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
