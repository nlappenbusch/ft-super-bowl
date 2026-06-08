import { NextResponse } from 'next/server';
import { createFaq, getFaqs, reorderFaqs } from '@/lib/contentStore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const faqs = getFaqs();
  const filtered = eventId ? faqs.filter((faq) => faq.event_id === eventId) : faqs;

  return NextResponse.json({ success: true, data: filtered });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const record = createFaq({
      event_id: body.event_id,
      question: body.question,
      answer: body.answer,
      sort_order: body.sort_order ?? 0
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { faqs } = body;
    if (!Array.isArray(faqs)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload: faqs array required' },
        { status: 400 }
      );
    }

    reorderFaqs(faqs);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

