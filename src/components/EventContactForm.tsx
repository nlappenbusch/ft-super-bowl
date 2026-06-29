'use client';

import { useEffect, useState } from 'react';
import { Mail, Phone, User, Send, CheckCircle, CalendarDays, Ticket } from 'lucide-react';

interface EventContactFormProps {
  eventSlug: string;
  eventName?: string;
  /** Optional: Auswahl aus mehreren Events (z.B. auf der Serien-Seite). */
  events?: { slug: string; name: string }[];
  /** Optional: Wunschspiel-Auswahl, gespeist aus dem Spielplan-Modul des Events. */
  matchOptions?: string[];
  /** Vorbelegtes Wunschspiel (z.B. via "Anfragen"-Button im Spielplan). */
  selectedMatch?: string;
  /** Überschrift-/Intro-Override */
  title?: string;
  intro?: string;
}

export default function EventContactForm({ eventSlug, eventName, events, matchOptions, selectedMatch, title, intro }: EventContactFormProps) {
  const hasEventChoice = !!(events && events.length > 0);
  const hasMatchChoice = !!(matchOptions && matchOptions.length > 0);
  const [selectedEvent, setSelectedEvent] = useState<string>(events?.[0]?.slug || eventSlug);
  const [match, setMatch] = useState<string>(selectedMatch || '');
  // Externe Vorbelegung (Klick auf "Anfragen" im Spielplan) übernehmen
  useEffect(() => {
    if (selectedMatch !== undefined) setMatch(selectedMatch);
  }, [selectedMatch]);
  const [form, setForm] = useState({
    salutation: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
  });
  const [accepted, setAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = hasEventChoice ? selectedEvent : eventSlug;
  const effectiveName = hasEventChoice
    ? (events!.find((e) => e.slug === selectedEvent)?.name || eventName)
    : eventName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.phone) {
      setError('Bitte E-Mail und Telefonnummer angeben.');
      return;
    }
    if (!accepted) {
      setError('Bitte stimmen Sie den AGB und der Datenschutzerklärung zu.');
      return;
    }
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug: effectiveSlug,
          packageSlug: null,
          packageId: 'contact-inquiry',
          packageTitle: match
            ? `Anfrage – ${effectiveName || effectiveSlug} – ${match}`
            : `Allgemeine Anfrage – ${effectiveName || effectiveSlug}`,
          startDate: '',
          numberOfPersons: 1,
          doubleRooms: 0,
          singleRooms: 0,
          travelers: [{ salutation: form.salutation, firstName: form.firstName, lastName: form.lastName, email: form.email }],
          salutation: form.salutation,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          message: match ? `Wunschspiel: ${match}\n\n${form.message}`.trim() : form.message,
          totalPrice: 0,
          consent: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRequestNumber(data.requestNumber || null);
        setSent(true);
      } else {
        setError(data.error || 'Ein Fehler ist aufgetreten.');
      }
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ background: '#f5f7fa', border: '1.5px solid #e5e8ed' }}
      >
        <CheckCircle className="w-14 h-14 mx-auto mb-4" style={{ color: '#2ecc71' }} />
        <h3 className="text-2xl font-extrabold mb-2" style={{ color: '#143047' }}>
          Vielen Dank für Ihre Anfrage!
        </h3>
        <p className="text-gray-600 max-w-md mx-auto">
          Wir haben Ihre Nachricht erhalten und melden uns schnellstmöglich bei Ihnen.
          Unser Team ist in der Regel innerhalb von 24 Stunden für Sie da.
        </p>
        {requestNumber && (
          <div className="mt-5 inline-flex flex-col items-center gap-1 rounded-xl px-6 py-3" style={{ background: '#143047' }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Ihre Anfragenummer</span>
            <span className="text-xl font-extrabold text-white tracking-wide">{requestNumber}</span>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">Eine Bestätigung mit dieser Nummer wurde an Ihre E-Mail gesendet.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1.5px solid #e5e8ed', boxShadow: '0 4px 24px rgba(20,48,71,0.08)' }}
    >
      {/* Header */}
      <div className="px-8 pt-8 pb-6" style={{ background: '#143047' }}>
        <div className="flex items-center gap-3 mb-2">
          <Mail className="w-6 h-6" style={{ color: '#d9531e' }} />
          <h3 className="text-xl font-extrabold text-white">{title || 'Jetzt unverbindlich anfragen'}</h3>
        </div>
        <p className="text-white/70 text-sm">
          {intro || (
            <>
              Kein passendes Package sichtbar? Kontaktieren Sie uns direkt — wir erstellen Ihnen ein individuelles Angebot für{' '}
              <strong className="text-white">{effectiveName || 'dieses Event'}</strong>.
            </>
          )}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-8 bg-white space-y-4">
        {hasEventChoice && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              <CalendarDays className="inline w-3.5 h-3.5 mr-1 -mt-0.5" /> Für welches Event interessieren Sie sich?
            </label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none transition bg-white"
              style={{ borderColor: '#e5e8ed' }}
              onFocus={(e) => (e.target.style.borderColor = '#143047')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e8ed')}
            >
              {events!.map((ev) => (
                <option key={ev.slug} value={ev.slug}>{ev.name}</option>
              ))}
            </select>
          </div>
        )}
        {hasMatchChoice && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              <Ticket className="inline w-3.5 h-3.5 mr-1 -mt-0.5" /> Wunschspiel / Paarung
            </label>
            <select
              value={match}
              onChange={(e) => setMatch(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none transition bg-white"
              style={{ borderColor: match ? '#143047' : '#e5e8ed' }}
              onFocus={(e) => (e.target.style.borderColor = '#143047')}
              onBlur={(e) => (e.target.style.borderColor = match ? '#143047' : '#e5e8ed')}
            >
              <option value="">Noch unentschieden / allgemeine Anfrage</option>
              {matchOptions!.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            <User className="inline w-3.5 h-3.5 mr-1 -mt-0.5" /> Anrede
          </label>
          <select
            value={form.salutation}
            onChange={(e) => setForm((f) => ({ ...f, salutation: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none transition bg-white"
            style={{ borderColor: '#e5e8ed' }}
            onFocus={(e) => (e.target.style.borderColor = '#143047')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e8ed')}
          >
            <option value="">Keine Angabe</option>
            <option value="herr">Herr</option>
            <option value="frau">Frau</option>
            <option value="divers">Divers</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              <User className="inline w-3.5 h-3.5 mr-1 -mt-0.5" /> Vorname
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              placeholder="Max"
              className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition"
              style={{ borderColor: '#e5e8ed' }}
              onFocus={(e) => (e.target.style.borderColor = '#143047')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e8ed')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nachname</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              placeholder="Mustermann"
              className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition"
              style={{ borderColor: '#e5e8ed' }}
              onFocus={(e) => (e.target.style.borderColor = '#143047')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e8ed')}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            <Mail className="inline w-3.5 h-3.5 mr-1 -mt-0.5" /> E-Mail *
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="max@example.com"
            className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition"
            style={{ borderColor: '#e5e8ed' }}
            onFocus={(e) => (e.target.style.borderColor = '#143047')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e8ed')}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            <Phone className="inline w-3.5 h-3.5 mr-1 -mt-0.5" /> Telefon *
          </label>
          <input
            type="tel"
            required
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+49 151 234 567 89"
            className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition"
            style={{ borderColor: '#e5e8ed' }}
            onFocus={(e) => (e.target.style.borderColor = '#143047')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e8ed')}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Nachricht / Wunsch</label>
          <textarea
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            rows={3}
            placeholder="Ich interessiere mich für... (Reisezeitraum, Personenanzahl, besondere Wünsche)"
            className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition resize-none"
            style={{ borderColor: '#e5e8ed' }}
            onFocus={(e) => (e.target.style.borderColor = '#143047')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e8ed')}
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ accentColor: '#143047' }}
            className="mt-0.5 w-4 h-4 shrink-0 border-gray-300 rounded"
          />
          <span className="text-xs text-gray-600 leading-relaxed">
            Ich habe die{' '}
            <a href="https://faltintravel.com/allgemeine-geschaeftsbedingungen/" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: '#143047' }} onClick={(e) => e.stopPropagation()}>AGB</a>
            {' '}und die{' '}
            <a href="https://faltintravel.com/datenschutzerklaerung/" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: '#143047' }} onClick={(e) => e.stopPropagation()}>Datenschutzerklärung</a>
            {' '}gelesen und stimme diesen zu. *
          </span>
        </label>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200">{error}</p>
        )}

        <button
          type="submit"
          disabled={sending || !accepted}
          className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 px-6 rounded-lg text-base transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: '#d9531e', boxShadow: '0 4px 12px rgba(217,83,30,0.25)' }}
        >
          <Send className="w-4 h-4" />
          {sending ? 'Wird gesendet…' : 'Unverbindlich anfragen'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          ✓ Kostenlos & unverbindlich &nbsp;·&nbsp; ✓ Antwort innerhalb 24h &nbsp;·&nbsp; ✓ Schweizer Reisegarantie
        </p>
      </form>
    </div>
  );
}
