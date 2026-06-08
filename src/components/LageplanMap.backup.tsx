'use client';

import { useEffect, useMemo, useRef } from 'react';

declare let google: any;

interface Pin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  icon_id?: string | null;
  label?: string | null;
}

interface PinIcon {
  id: string;
  name: string;
  image?: string | null;
}

interface LageplanMapProps {
  pins: Pin[];
  pinIcons?: PinIcon[];
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#143047' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#143047' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0e2233' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#a5b8c7' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#184a7b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b1' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1c5b96' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1926' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

function getFallbackIconHtml(iconId: string | null | undefined): string {
  const id = (iconId || '').toLowerCase();
  if (id.includes('airport')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#1c5b96" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>`;
  }
  if (id.includes('hotel')) {
    return `<span style="color:#1c5b96;font-family:system-ui,-apple-system,sans-serif;font-weight:900;font-size:14px;line-height:1;">H</span>`;
  }
  if (id.includes('stadium')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#1c5b96" stroke-width="2.5"><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#1c5b96" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>`;
}

function getMarkerHtml(pin: Pin, iconImage: string | null | undefined): string {
  const label = pin.label || pin.name || '';
  const iconInnerHtml = iconImage
    ? `<img src="${iconImage}" alt="" style="width:20px;height:20px;object-fit:contain;" onerror="this.style.display='none'" />`
    : getFallbackIconHtml(pin.icon_id);

  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;font-family:system-ui,-apple-system,sans-serif;transform:translate(-50%,-100%);">
      <div style="width:40px;height:40px;background-color:#1c5b96;border-radius:50%;border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.45);">
        <div style="width:26px;height:26px;background-color:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 3px rgba(0,0,0,0.15);">
          ${iconInnerHtml}
        </div>
      </div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #1c5b96;margin-top:-1px;"></div>
      <div style="margin-top:3px;background-color:#0f2742;color:#ffffff;border:1.5px solid rgba(255,255,255,0.25);border-radius:6px;padding:4px 9px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35);">
        ${label}
      </div>
    </div>
  `;
}

export default function LageplanMap({ pins, pinIcons = [] }: LageplanMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const initCalledRef = useRef(false);

  // Stable icon lookup — only recomputes when pinIcons actually changes
  const iconMap = useMemo<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {};
    for (const ic of pinIcons) {
      map[ic.id] = ic.image || null;
    }
    return map;
  }, [pinIcons]);

  // Only valid (non-NaN) pins
  const validPins = useMemo(
    () => pins.filter((p) => typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lng === 'number' && !isNaN(p.lng)),
    [pins]
  );

  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    function initMap() {
      if (!mapRef.current || !(window as any).google?.maps) return;
      if (mapInstanceRef.current) return; // already initialized

      const gm = (window as any).google.maps;

      class CustomHTMLOverlay extends gm.OverlayView {
        private div: HTMLDivElement | null = null;
        constructor(
          private latlng: any,
          private html: string,
          map: any
        ) {
          super();
          this.setMap(map);
        }
        onAdd() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.cursor = 'pointer';
          div.innerHTML = this.html;
          this.div = div;
          this.getPanes()?.overlayMouseTarget.appendChild(div);
        }
        draw() {
          if (!this.div) return;
          const pos = this.getProjection()?.fromLatLngToDivPixel(this.latlng);
          if (pos) {
            this.div.style.left = pos.x + 'px';
            this.div.style.top = pos.y + 'px';
          }
        }
        onRemove() {
          this.div?.parentNode?.removeChild(this.div);
          this.div = null;
        }
      }

      const map = new gm.Map(mapRef.current, {
        zoom: 12,
        center: { lat: 48.8566, lng: 2.3522 },
        styles: darkMapStyle,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      mapInstanceRef.current = map;

      if (validPins.length > 0) {
        const bounds = new gm.LatLngBounds();

        validPins.forEach((pin) => {
          const latlng = new gm.LatLng(pin.lat, pin.lng);
          bounds.extend(latlng);
          const iconImage = iconMap[pin.icon_id || ''] ?? null;
          new CustomHTMLOverlay(latlng, getMarkerHtml(pin, iconImage), map);
        });

        if (validPins.length > 1) {
          map.fitBounds(bounds);
          const listener = gm.event.addListenerOnce(map, 'idle', () => {
            if (map.getZoom() > 14) map.setZoom(12);
          });
        } else {
          map.setCenter({ lat: validPins[0].lat, lng: validPins[0].lng });
          map.setZoom(13);
        }
      }
    }

    if ((window as any).google?.maps) {
      initMap();
    } else if (script) {
      script.addEventListener('load', initMap);
    }

    // Cleanup: nothing to do for map itself, but remove listener if needed
    return () => {
      // script load listener is a one-shot; no cleanup needed
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-lg relative min-h-[450px] bg-[#143047]">
      <div ref={mapRef} className="w-full h-full min-h-[450px]" />

      {/* Fallback list shown when no API key */}
      {validPins.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="text-sm text-gray-300">Keine Pins mit gültigen Koordinaten.</p>
        </div>
      )}
    </div>
  );
}
