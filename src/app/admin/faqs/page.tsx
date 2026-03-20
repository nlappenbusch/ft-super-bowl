'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

interface EventOption {
  id: string;
  title: string;
  slug: string;
}

interface FaqFormState {
  id?: string;
  event_id: string;
  question: string;
  answer: string;
  sort_order: string;
}

const emptyForm: FaqFormState = {
  event_id: '',
  question: '',
  answer: '',
  sort_order: '0'
};

export default function AdminFaqsPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [faqs, setFaqs] = useState<FaqFormState[]>([]);
  const [form, setForm] = useState<FaqFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadEvents = async () => {
    const response = await fetch('/api/admin/events');
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Laden');
      return;
    }

    const eventData = (result.data || []) as EventOption[];
    setEvents(eventData);
    if (!selectedEvent && eventData.length > 0) {
      setSelectedEvent(eventData[0].id);
      setForm((prev) => ({ ...prev, event_id: eventData[0].id }));
    }
  };

  const loadFaqs = async (eventId: string) => {
    if (!eventId) return;
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/admin/faqs?eventId=${encodeURIComponent(eventId)}`);
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Laden');
      setLoading(false);
      return;
    }

    const mapped = (result.data || []).map((row: any) => ({
      id: row.id,
      event_id: row.event_id,
      question: row.question || '',
      answer: row.answer || '',
      sort_order: row.sort_order?.toString() || '0'
    }));

    setFaqs(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    loadFaqs(selectedEvent);
  }, [selectedEvent]);

  const updateField = (field: keyof FaqFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ ...emptyForm, event_id: selectedEvent || '' });
  };

  const handleSave = async () => {

    if (!form.event_id || !form.question.trim() || !form.answer.trim()) {
      alert('Bitte Frage und Antwort ausfüllen.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      event_id: form.event_id,
      question: form.question.trim(),
      answer: form.answer.trim(),
      sort_order: form.sort_order ? Number(form.sort_order) : 0
    };

    const response = await fetch(`/api/admin/faqs${form.id ? `/${form.id}` : ''}`, {
      method: form.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Speichern');
      setSaving(false);
      return;
    }

    await loadFaqs(form.event_id);
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (faqId: string) => {
    if (!confirm('FAQ wirklich löschen?')) return;

    const response = await fetch(`/api/admin/faqs/${faqId}`, { method: 'DELETE' });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Löschen');
      return;
    }

    await loadFaqs(selectedEvent);
    resetForm();
  };

  return (
    <AdminShell title="FAQs verwalten">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex flex-col gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">Event auswählen</label>
              <select
                value={selectedEvent}
                onChange={(event) => {
                  setSelectedEvent(event.target.value);
                  setForm((prev) => ({ ...prev, event_id: event.target.value }));
                }}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({event.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Suchen</label>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Frage oder Antwort"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {loading && <p className="text-gray-500">Lädt...</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="space-y-3">
            {faqs
              .filter((faq) => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return [faq.question, faq.answer]
                  .filter(Boolean)
                  .some((value) => value.toLowerCase().includes(term));
              })
              .map((faq) => (
              <button
                key={faq.id}
                onClick={() => setForm({ ...faq })}
                className={`w-full text-left p-4 border rounded-lg transition ${
                  form.id === faq.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="font-semibold text-gray-900">{faq.question}</div>
                <div className="text-xs text-gray-500 mt-1">Sortierung: {faq.sort_order}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {form.id ? 'FAQ bearbeiten' : 'Neue FAQ'}
            </h2>
            {form.id && (
              <button
                onClick={() => handleDelete(form.id as string)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Löschen
              </button>
            )}
          </div>

          <div className="grid gap-6">
            <section className="border border-gray-100 rounded-xl p-4 bg-gray-50/70">
              <h3 className="text-sm font-semibold text-gray-700">Inhalt</h3>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Event</label>
                  <select
                    value={form.event_id}
                    onChange={(event) => updateField('event_id', event.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title} ({event.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Frage</label>
                  <textarea
                    value={form.question}
                    onChange={(event) => updateField('question', event.target.value)}
                    rows={2}
                    placeholder="Wie kann ich bezahlen?"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Antwort</label>
                  <textarea
                    value={form.answer}
                    onChange={(event) => updateField('answer', event.target.value)}
                    rows={4}
                    placeholder="Antworttext fuer das Frontend"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Sortierung</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(event) => updateField('sort_order', event.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="border border-dashed border-purple-200 rounded-xl p-4 bg-purple-50">
              <h3 className="text-sm font-semibold text-purple-700">Live Vorschau</h3>
              <div className="mt-3 rounded-xl border bg-white overflow-hidden">
                <button className="w-full text-left px-4 py-3 bg-white flex items-center justify-between text-sm font-semibold text-gray-800">
                  {form.question || 'Frage'}
                  <span className="text-gray-400">⌄</span>
                </button>
                <div className="px-4 pb-4 text-sm text-gray-600">
                  {form.answer || 'Antworttext'}
                </div>
              </div>
            </section>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
            <button
              onClick={resetForm}
              className="flex-1 bg-gray-100 py-2 rounded-lg hover:bg-gray-200"
            >
              Zurücksetzen
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
