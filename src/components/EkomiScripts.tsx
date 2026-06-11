'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    _ekomiWidgetsServerUrl?: string;
    _customerId?: number;
    _language?: any;
    _ekomiWidgetTokens?: string[];
    ekomiWidgetJs?: boolean;
    ekomiWidgetMain?: (action: string, token: string) => void;
  }
}

export default function EkomiScripts() {
  useEffect(() => {
    // Register Horizontal Responsive Widget (sf1193616993086c0b0e7) - Landing Page Reviews
    registerWidget(window, 'sf1193616993086c0b0e7');
    
    // Register Sidebar Widget (sf11936169930865af963) - Booking Sidebar
    registerWidget(window, 'sf11936169930865af963');
  }, []);

  return null;
}

function registerWidget(w: Window, token: string) {
  w._ekomiWidgetsServerUrl = 'https://widgets.ekomi.com';
  w._customerId = 119361;
  
  if (w._language == undefined || typeof w._language !== 'object') {
    w._language = {};
  }
  w._language[token] = 'auto';
  
  if (typeof w._ekomiWidgetTokens !== 'undefined') {
    w._ekomiWidgetTokens[w._ekomiWidgetTokens.length] = token;
  } else {
    w._ekomiWidgetTokens = [token];
  }
  
  if (typeof w.ekomiWidgetJs == 'undefined') {
    w.ekomiWidgetJs = true;
    const scr = document.createElement('script');
    scr.src = 'https://sw-assets.ekomiapps.de/static_resources/widget.js';
    const head = document.getElementsByTagName('head')[0];
    head.appendChild(scr);
  } else {
    if (typeof w.ekomiWidgetMain != 'undefined') {
      w.ekomiWidgetMain('ajax', token);
    }
  }
  
  return true;
}
