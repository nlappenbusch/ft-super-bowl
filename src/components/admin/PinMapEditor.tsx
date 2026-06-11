'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps global is untyped */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COLORS,
  Button,
  Field,
  InputField,
  Badge,
  EmptyState,
  cn,
} from '@/components/admin/ui';
import { MapPin, Search, Trash2, Plus, AlertTriangle, Info } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

export interface PinDraft {
  id: string;
  name: string;
  lat: string;
  lng: string;
  icon_id: string;
  label: string;
}

export interface PinIconOption {
  id: string;
  name: string;
  image?: string | null;
}

export interface PinMapEditorProps {
  pins: PinDraft[];
  onChange: (pins: PinDraft[]) => void;
  pinIcons: PinIconOption[];
}

type MapStatus = 'loading' | 'ready' | 'nokey' | 'error';

const SCRIPT_ID = 'google-maps-script';
const PLACES_SCRIPT_ID = 'google-maps-places-script';

/**
 * Lädt die Google-Maps-JS-API inkl. `places`-Library robust und nur einmalig.
 *
 * Sonderfall: Das in der App bereits vorhandene Script (id="google-maps-script")
 * wird OHNE `places` geladen. Wir prüfen daher gezielt `window.google.maps.places`
 * und ergänzen die Library bei Bedarf via `importLibrary('places')` (neue Loader-API)
 * oder – als Fallback – über ein zusätzliches Script mit `&libraries=places`.
 */
function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('no-window'));
      return;
    }

    const ensurePlaces = (): Promise<void> => {
      const g = window.google;
      if (g?.maps?.places) return Promise.resolve();
      if (g?.maps?.importLibrary) {
        return g.maps.importLibrary('places').then(() => undefined);
      }
      // Fallback: zusätzliches Script ausschliesslich für places nachladen.
      return new Promise<void>((res, rej) => {
        const existingPlaces = document.getElementById(PLACES_SCRIPT_ID) as HTMLScriptElement | null;
        if (existingPlaces) {
          if (window.google?.maps?.places) {
            res();
          } else {
            existingPlaces.addEventListener('load', () => res());
            existingPlaces.addEventListener('error', () => rej(new Error('places-load-failed')));
          }
          return;
        }
        const ps = document.createElement('script');
        ps.id = PLACES_SCRIPT_ID;
        ps.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        ps.async = true;
        ps.defer = true;
        ps.onload = () => res();
        ps.onerror = () => rej(new Error('places-load-failed'));
        document.head.appendChild(ps);
      });
    };

    // 1) Maps bereits geladen → ggf. places ergänzen.
    if (window.google?.maps) {
      ensurePlaces().then(resolve).catch(reject);
      return;
    }

    // 2) Ein Maps-Script existiert bereits (z.B. von einer anderen Komponente) → auf load warten.
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => {
        ensurePlaces().then(resolve).catch(reject);
      });
      existing.addEventListener('error', () => reject(new Error('maps-load-failed')));
      // Falls das Script zwischenzeitlich schon fertig geladen hat:
      if (window.google?.maps) {
        ensurePlaces().then(resolve).catch(reject);
      }
      return;
    }

    // 3) Frisch laden – direkt inkl. places.
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => ensurePlaces().then(resolve).catch(reject);
    script.onerror = () => reject(new Error('maps-load-failed'));
    document.head.appendChild(script);
  });
}

function isValidCoord(lat: string, lng: string): boolean {
  const la = parseFloat(lat);
  const ln = parseFloat(lng);
  return !Number.isNaN(la) && !Number.isNaN(ln);
}

export default function PinMapEditor({ pins, onChange, pinIcons }: PinMapEditorProps) {
  const [status, setStatus] = useState<MapStatus>('loading');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const gmRef = useRef<any>(null);

  // Immer aktuelle Werte für Event-Handler (vermeidet stale closures).
  const pinsRef = useRef(pins);
  const onChangeRef = useRef(onChange);
  const iconsRef = useRef(pinIcons);
  useEffect(() => { pinsRef.current = pins; }, [pins]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { iconsRef.current = pinIcons; }, [pinIcons]);

  /* ── Mutationen ─────────────────────────────────────────────────────────── */

  const updatePin = useCallback((id: string, patch: Partial<PinDraft>) => {
    onChangeRef.current(pinsRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePin = useCallback((id: string) => {
    onChangeRef.current(pinsRef.current.filter((p) => p.id !== id));
  }, []);

  const appendPin = useCallback((partial: Partial<PinDraft>) => {
    const current = pinsRef.current;
    const newPin: PinDraft = {
      id: `pin-${Date.now()}-${current.length}`,
      name: '',
      lat: '',
      lng: '',
      icon_id: iconsRef.current[0]?.id ?? '',
      label: '',
      ...partial,
    };
    onChangeRef.current([...current, newPin]);
  }, []);

  /* ── Google Maps laden & initialisieren ─────────────────────────────────── */

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!key) {
      setStatus('nokey');
      return;
    }

    let cancelled = false;

    loadGoogleMaps(key)
      .then(() => {
        if (cancelled || !mapContainerRef.current) return;
        const gm = window.google.maps;
        gmRef.current = gm;

        // Karte mittig auf vorhandenem Pin oder als Fallback (Paris) zentrieren.
        const first = pinsRef.current.find((p) => isValidCoord(p.lat, p.lng));
        const center = first
          ? { lat: parseFloat(first.lat), lng: parseFloat(first.lng) }
          : { lat: 48.8566, lng: 2.3522 };

        const map = new gm.Map(mapContainerRef.current, {
          zoom: first ? 13 : 5,
          center,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        mapRef.current = map;

        // Klick auf leere Karte → neuen Pin anlegen.
        map.addListener('click', (e: any) => {
          if (!e.latLng) return;
          appendPin({ lat: String(e.latLng.lat()), lng: String(e.latLng.lng()) });
        });

        // Places Autocomplete für die Ortssuche.
        if (gm.places?.Autocomplete && searchInputRef.current) {
          const autocomplete = new gm.places.Autocomplete(searchInputRef.current, {
            fields: ['geometry', 'name', 'formatted_address'],
          });
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const loc = place?.geometry?.location;
            if (!loc) return;
            const lat = loc.lat();
            const lng = loc.lng();
            appendPin({
              name: place.name || place.formatted_address || '',
              lat: String(lat),
              lng: String(lng),
            });
            map.setCenter({ lat, lng });
            map.setZoom(14);
            if (searchInputRef.current) searchInputRef.current.value = '';
          });
        }

        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
    // Bewusst nur einmalig beim Mount – appendPin ist stabil (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Marker mit Pins synchronisieren ────────────────────────────────────── */

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !gmRef.current) return;
    const gm = gmRef.current;
    const map = mapRef.current;
    const markers = markersRef.current;

    const validIds = new Set<string>();

    pins.forEach((pin, index) => {
      if (!isValidCoord(pin.lat, pin.lng)) return;
      validIds.add(pin.id);
      const position = { lat: parseFloat(pin.lat), lng: parseFloat(pin.lng) };
      const title = pin.label || pin.name || `Pin ${index + 1}`;

      let marker = markers[pin.id];
      if (!marker) {
        marker = new gm.Marker({
          position,
          map,
          draggable: true,
          title,
          label: { text: String(index + 1), color: '#ffffff', fontWeight: '700', fontSize: '12px' },
        });
        marker.addListener('dragend', (e: any) => {
          if (!e.latLng) return;
          updatePin(pin.id, { lat: String(e.latLng.lat()), lng: String(e.latLng.lng()) });
        });
        markers[pin.id] = marker;
      } else {
        marker.setPosition(position);
        marker.setTitle(title);
        marker.setLabel({ text: String(index + 1), color: '#ffffff', fontWeight: '700', fontSize: '12px' });
      }
    });

    // Verwaiste Marker entfernen.
    Object.keys(markers).forEach((id) => {
      if (!validIds.has(id)) {
        markers[id].setMap(null);
        delete markers[id];
      }
    });
  }, [pins, status, updatePin]);

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const mapUnavailable = status === 'nokey' || status === 'error';

  return (
    <div className="space-y-5">
      {/* Ortssuche */}
      {!mapUnavailable && (
        <Field
          label="Ort suchen"
          hint="Adresse oder Ort eingeben und aus der Liste wählen – ein Pin wird automatisch gesetzt."
        >
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: COLORS.textMuted }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="z.B. SoFi Stadium, Inglewood…"
              disabled={status !== 'ready'}
              className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 transition focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{ borderColor: COLORS.stroke }}
            />
          </div>
        </Field>
      )}

      {/* Karte / Hinweis */}
      {mapUnavailable ? (
        <div
          className="flex items-start gap-2 rounded-xl p-4 text-sm leading-relaxed"
          style={{ color: COLORS.warn, background: '#fffbeb', border: '1px solid #fde68a' }}
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            {status === 'nokey' ? (
              <>
                Karte nicht verfügbar – es ist kein Google-Maps-API-Key hinterlegt
                (<code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>). Die Pins
                können unten weiterhin manuell mit Koordinaten bearbeitet werden.
              </>
            ) : (
              <>
                Die Karte konnte nicht geladen werden. Bitte API-Key/Verbindung prüfen. Die Pins
                können unten weiterhin manuell mit Koordinaten bearbeitet werden.
              </>
            )}
          </span>
        </div>
      ) : (
        <div
          className="relative w-full overflow-hidden rounded-2xl"
          style={{ height: 420, border: `1px solid ${COLORS.stroke}` }}
        >
          <div ref={mapContainerRef} className="h-full w-full" />
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: COLORS.surfaceMuted }}>
              <span className="text-sm" style={{ color: COLORS.textMuted }}>
                Karte wird geladen…
              </span>
            </div>
          )}
          {status === 'ready' && (
            <div
              className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow"
              style={{ background: 'rgba(255,255,255,0.92)', color: COLORS.navy }}
            >
              <Info size={13} /> Klick auf die Karte setzt einen neuen Pin · Marker ziehen zum Verschieben
            </div>
          )}
        </div>
      )}

      {/* Aktionen */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold" style={{ color: COLORS.navy }}>
          Pins{' '}
          <Badge tone="navy">{pins.length}</Badge>
        </h3>
        <Button type="button" variant="secondary" size="sm" onClick={() => appendPin({})}>
          <Plus size={14} /> Pin manuell hinzufügen
        </Button>
      </div>

      {/* Pin-Liste */}
      {pins.length === 0 ? (
        <EmptyState
          icon={<MapPin size={32} />}
          title="Noch keine Pins"
          description={
            mapUnavailable
              ? 'Fügen Sie einen Pin manuell hinzu und tragen Sie die Koordinaten ein.'
              : 'Suchen Sie einen Ort oder klicken Sie auf die Karte, um den ersten Pin zu setzen.'
          }
        />
      ) : (
        <div className="space-y-3">
          {pins.map((pin, index) => {
            const valid = isValidCoord(pin.lat, pin.lng);
            return (
              <div
                key={pin.id}
                className="rounded-xl p-4"
                style={{ border: `1.5px solid ${COLORS.stroke}`, background: '#fff' }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: COLORS.navy }}
                    >
                      {index + 1}
                    </span>
                    {!valid && (
                      <Badge tone="warn">
                        <AlertTriangle size={12} /> Ohne Koordinaten
                      </Badge>
                    )}
                  </div>
                  <Button type="button" variant="danger" size="sm" onClick={() => removePin(pin.id)}>
                    <Trash2 size={14} /> Löschen
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InputField
                    label="Name"
                    value={pin.name}
                    onChange={(e) => updatePin(pin.id, { name: e.target.value })}
                    placeholder="z.B. SoFi Stadium"
                  />
                  <InputField
                    label="Label (auf Karte)"
                    value={pin.label}
                    onChange={(e) => updatePin(pin.id, { label: e.target.value })}
                    placeholder="z.B. Stadion"
                  />
                </div>

                {/* Icon-Auswahl */}
                <Field label="Icon" className="mt-3">
                  {pinIcons.length === 0 ? (
                    <p className="text-xs" style={{ color: COLORS.textMuted }}>
                      Keine Icons vorhanden – legen Sie unter „Lageplan-Icons" Icons an.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {pinIcons.map((icon) => {
                        const active = pin.icon_id === icon.id;
                        return (
                          <button
                            key={icon.id}
                            type="button"
                            onClick={() => updatePin(pin.id, { icon_id: icon.id })}
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition'
                            )}
                            style={{
                              border: `1.5px solid ${active ? COLORS.navy : COLORS.stroke}`,
                              background: active ? '#eef2f7' : '#fff',
                              color: COLORS.navy,
                            }}
                          >
                            {icon.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={icon.image} alt="" className="h-4 w-4 object-contain" />
                            ) : (
                              <MapPin size={14} style={{ color: '#9ca3af' }} />
                            )}
                            {icon.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>

                {/* Koordinaten */}
                {mapUnavailable ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <InputField
                      label="Breitengrad (lat)"
                      type="number"
                      value={pin.lat}
                      onChange={(e) => updatePin(pin.id, { lat: e.target.value })}
                      placeholder="48.8566"
                      className="font-mono"
                    />
                    <InputField
                      label="Längengrad (lng)"
                      type="number"
                      value={pin.lng}
                      onChange={(e) => updatePin(pin.id, { lng: e.target.value })}
                      placeholder="2.3522"
                      className="font-mono"
                    />
                  </div>
                ) : (
                  <div className="mt-3">
                    <span
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: COLORS.textMuted }}
                    >
                      Koordinaten
                    </span>
                    <code
                      className="inline-block rounded-lg px-3 py-2 text-xs"
                      style={{ background: COLORS.surfaceMuted, color: COLORS.navy }}
                    >
                      {valid ? `${parseFloat(pin.lat).toFixed(6)}, ${parseFloat(pin.lng).toFixed(6)}` : '— nicht gesetzt —'}
                    </code>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
