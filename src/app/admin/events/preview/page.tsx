'use client';

/**
 * Live-Vorschau-Route für den Event-Editor.
 * Läuft in einem iframe. Empfängt den aktuellen Entwurf per postMessage vom
 * Editor und rendert die ECHTE Event-Ansicht (EventPageView) — dadurch ist die
 * Vorschau identisch mit der späteren öffentlichen Seite.
 */
import { useEffect, useState, useCallback } from 'react';
import EventPageView from '@/components/event/EventPageView';
import type { EventRecord, PackageRecord, EventFaqRecord, SeriesRecord } from '@/lib/eventData';

interface DraftMessage {
  type: 'ft-event-draft';
  event: EventRecord;
  faqs: EventFaqRecord[];
  series: Pick<SeriesRecord, 'slug' | 'title'> | null;
}

interface PinIcon { id: string; name: string; image?: string | null }

export default function EventPreviewPage() {
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [faqs, setFaqs] = useState<EventFaqRecord[]>([]);
  const [series, setSeries] = useState<Pick<SeriesRecord, 'slug' | 'title'> | null>(null);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [pinIcons, setPinIcons] = useState<PinIcon[]>([]);

  // Pin-Icons einmalig laden (für Lageplan-Marker)
  useEffect(() => {
    fetch('/api/admin/pin-icons')
      .then((r) => r.json())
      .then((d) => { if (d.success) setPinIcons(d.data || []); })
      .catch(() => {});
  }, []);

  const loadPackages = useCallback((eventId?: string) => {
    if (!eventId) { setPackages([]); return; }
    fetch(`/api/admin/packages?eventId=${encodeURIComponent(eventId)}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setPackages((d.data || []) as PackageRecord[]); })
      .catch(() => setPackages([]));
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as DraftMessage;
      if (!data || data.type !== 'ft-event-draft') return;
      setEvent(data.event);
      setFaqs(data.faqs || []);
      setSeries(data.series || null);
      loadPackages(data.event?.id);
    }
    window.addEventListener('message', onMessage);
    // Editor signalisieren, dass die Vorschau bereit ist
    window.parent?.postMessage({ type: 'ft-event-preview-ready' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, [loadPackages]);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] p-8 text-center">
        <div>
          <div className="mb-3 text-4xl">👀</div>
          <p className="text-sm text-gray-500">Live-Vorschau – Eingaben im Editor erscheinen hier sofort.</p>
        </div>
      </div>
    );
  }

  return <EventPageView event={event} series={series} packages={packages} faqs={faqs} pinIcons={pinIcons} />;
}
