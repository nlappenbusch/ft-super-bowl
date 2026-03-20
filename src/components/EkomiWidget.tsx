'use client';

import { useEffect } from 'react';

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
  className
}: EkomiWidgetProps) {
  useEffect(() => {
    const w = window;

    w._ekomiWidgetsServerUrl =
      (document.location.protocol === 'https:' ? 'https:' : 'http:') + '//widgets.ekomi.com';
    w._customerId = customerId;
    w._ekomiDraftMode = draftMode;
    if (w._language == undefined || typeof w._language !== 'object') {
      w._language = {};
    }
    w._language[token] = language;

    if (typeof w._ekomiWidgetTokens !== 'undefined') {
      if (!w._ekomiWidgetTokens.includes(token)) {
        w._ekomiWidgetTokens.push(token);
      }
    } else {
      w._ekomiWidgetTokens = [token];
    }

    if (typeof w.ekomiWidgetJs === 'undefined') {
      w.ekomiWidgetJs = true;
      const scr = document.createElement('script');
      scr.src = 'https://sw-assets.ekomiapps.de/static_resources/widget.js';
      document.head.appendChild(scr);
      return;
    }

    if (typeof w.ekomiWidgetMain !== 'undefined') {
      w.ekomiWidgetMain('ajax', token);
    }
  }, [customerId, draftMode, language, token]);

  return (
    <div className={className}>
      <div
        id={`widget-container-${token}`}
        className={`ekomi-widget-container ekomi-widget-${token}`}
      />
    </div>
  );
}
