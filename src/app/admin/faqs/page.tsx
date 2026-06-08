'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  COLORS,
  Card,
  SectionCard,
  PageHeader,
  Button,
  Field,
  TextInput,
  SelectInput,
  InputField,
  TextAreaField,
  EmptyState,
  Spinner,
} from '@/components/admin/ui';
import {
  HelpCircle,
  Search,
  ChevronUp,
  ChevronDown,
  Trash2,
  Save,
  RotateCcw,
  Plus,
} from 'lucide-react';

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

    const sorted = (result.data || [])
      .map((row: any) => ({
        id: row.id,
        event_id: row.event_id,
        question: row.question || '',
        answer: row.answer || '',
        sort_order: row.sort_order?.toString() || '0'
      }))
      .sort((a: any, b: any) => Number(a.sort_order) - Number(b.sort_order));

    setFaqs(sorted);
    setLoading(false);

    const maxOrder = sorted.reduce((max: number, faq: any) => {
      const order = Number(faq.sort_order) || 0;
      return order > max ? order : max;
    }, -1);
    setForm({ ...emptyForm, event_id: eventId, sort_order: String(maxOrder + 1) });
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
    const maxOrder = faqs.reduce((max, faq) => {
      const order = Number(faq.sort_order) || 0;
      return order > max ? order : max;
    }, -1);
    setForm({ ...emptyForm, event_id: selectedEvent || '', sort_order: String(maxOrder + 1) });
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
  };

  const handleMove = async (index: number, direction: number) => {
    const newFaqs = [...faqs];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newFaqs.length) return;

    const temp = newFaqs[index];
    newFaqs[index] = newFaqs[targetIndex];
    newFaqs[targetIndex] = temp;

    const updatedFaqs = newFaqs.map((faq, idx) => ({
      ...faq,
      sort_order: String(idx)
    }));

    setFaqs(updatedFaqs);

    try {
      const response = await fetch('/api/admin/faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faqs: updatedFaqs.map((faq) => ({
            id: faq.id,
            sort_order: Number(faq.sort_order)
          }))
        })
      });
      const result = await response.json();
      if (!result.success) {
        alert('Fehler beim Speichern der neuen Reihenfolge: ' + result.error);
        loadFaqs(selectedEvent);
      }
    } catch (err) {
      console.error('Fehler beim Sortieren:', err);
      alert('Fehler beim Speichern der neuen Reihenfolge.');
      loadFaqs(selectedEvent);
    }
  };

  const isFiltered = Boolean(searchTerm.trim());

  const filteredFaqs = faqs.filter((faq) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return [faq.question, faq.answer]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
  });

  return (
    <AdminShell title="FAQs verwalten">
      <PageHeader
        title="FAQs verwalten"
        description="Häufige Fragen pro Event pflegen, sortieren und live vorschauen."
        actions={
          <Button variant="accent" onClick={resetForm}>
            <Plus size={16} /> Neue FAQ
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Liste */}
        <SectionCard
          title="FAQ-Liste"
          description="Event wählen, suchen und Reihenfolge anpassen."
          icon={<HelpCircle size={18} />}
        >
          <div className="flex flex-col gap-4 mb-5">
            <Field label="Event auswählen">
              <SelectInput
                value={selectedEvent}
                onChange={(event) => {
                  setSelectedEvent(event.target.value);
                  setForm((prev) => ({ ...prev, event_id: event.target.value }));
                }}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({event.slug})
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Suchen">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: COLORS.textMuted }}
                />
                <TextInput
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Frage oder Antwort"
                  className="pl-9"
                />
              </div>
            </Field>
          </div>

          {error && (
            <p className="mb-4 text-sm" style={{ color: COLORS.danger }}>
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12" style={{ color: COLORS.textMuted }}>
              <Spinner /> <span className="text-sm">Lädt...</span>
            </div>
          ) : filteredFaqs.length === 0 ? (
            <EmptyState
              icon={<HelpCircle size={32} />}
              title={isFiltered ? 'Keine Treffer' : 'Noch keine FAQs'}
              description={
                isFiltered
                  ? 'Für diesen Suchbegriff wurden keine FAQs gefunden.'
                  : 'Lege rechts eine neue FAQ für dieses Event an.'
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredFaqs.map((faq, index) => {
                const isFirst = index === 0;
                const isLast = index === faqs.length - 1;
                const isActive = form.id === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="flex overflow-hidden rounded-xl transition"
                    style={{
                      border: `1.5px solid ${isActive ? COLORS.accent : COLORS.stroke}`,
                      background: isActive ? '#fff1ea' : '#fff',
                    }}
                  >
                    <button
                      onClick={() => setForm({ ...faq })}
                      className="flex-1 text-left p-4 focus:outline-none"
                    >
                      <div className="font-semibold" style={{ color: COLORS.navy }}>
                        {faq.question}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>
                        Sortierung: {faq.sort_order}
                      </div>
                    </button>
                    <div
                      className="flex w-12 flex-col divide-y"
                      style={{ borderLeft: `1px solid ${COLORS.stroke}`, background: COLORS.surfaceMuted }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMove(index, -1);
                        }}
                        disabled={isFirst || isFiltered}
                        className="flex flex-1 items-center justify-center hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent"
                        style={{ color: COLORS.textMuted }}
                        title={isFiltered ? 'Sortierung nur ohne Suchfilter möglich' : 'Nach oben'}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMove(index, 1);
                        }}
                        disabled={isLast || isFiltered}
                        className="flex flex-1 items-center justify-center hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent"
                        style={{ color: COLORS.textMuted }}
                        title={isFiltered ? 'Sortierung nur ohne Suchfilter möglich' : 'Nach unten'}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Editor */}
        <SectionCard
          title={form.id ? 'FAQ bearbeiten' : 'Neue FAQ'}
          description="Inhalt pflegen und live prüfen."
          icon={<HelpCircle size={18} />}
          actions={
            form.id ? (
              <Button variant="danger" size="sm" onClick={() => handleDelete(form.id as string)}>
                <Trash2 size={14} /> Löschen
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-6">
            <div className="grid gap-4">
              <Field label="Event">
                <SelectInput
                  value={form.event_id}
                  onChange={(event) => updateField('event_id', event.target.value)}
                >
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} ({event.slug})
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <TextAreaField
                label="Frage"
                required
                rows={2}
                value={form.question}
                onChange={(event) => updateField('question', event.target.value)}
                placeholder="Wie kann ich bezahlen?"
              />

              <TextAreaField
                label="Antwort"
                required
                rows={4}
                value={form.answer}
                onChange={(event) => updateField('answer', event.target.value)}
                placeholder="Antworttext fuer das Frontend"
              />

              <InputField
                label="Sortierung"
                type="number"
                value={form.sort_order}
                onChange={(event) => updateField('sort_order', event.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
                Live Vorschau
              </p>
              <Card padded={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold" style={{ color: COLORS.navy }}>
                  <span>{form.question || 'Frage'}</span>
                  <ChevronDown size={16} style={{ color: COLORS.textMuted }} />
                </div>
                <div className="px-4 pb-4 text-sm" style={{ color: COLORS.textMuted }}>
                  {form.answer || 'Antworttext'}
                </div>
              </Card>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Spinner className="h-4 w-4" /> : <Save size={16} />}
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
            <Button variant="secondary" onClick={resetForm} className="flex-1">
              <RotateCcw size={16} /> Zurücksetzen
            </Button>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
