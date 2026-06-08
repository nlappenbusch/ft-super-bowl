import { NextResponse } from 'next/server';
import { deleteEvent, updateEvent, getFaqs, saveFaqs } from '@/lib/contentStore';
import { randomUUID } from 'crypto';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { faqs, ...eventPayload } = body;

    const updated = updateEvent(id, eventPayload);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Event nicht gefunden' },
        { status: 404 }
      );
    }

    if (Array.isArray(faqs)) {
      const allFaqs = getFaqs();
      const otherFaqs = allFaqs.filter((faq) => faq.event_id !== id);
      const updatedFaqs = faqs.map((faq, idx) => ({
        id: faq.id || randomUUID(),
        event_id: id,
        question: faq.question || '',
        answer: faq.answer || '',
        sort_order: idx + 1
      }));
      saveFaqs([...otherFaqs, ...updatedFaqs]);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = deleteEvent(id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Event nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
