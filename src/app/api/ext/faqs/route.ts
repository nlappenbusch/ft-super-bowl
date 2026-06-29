import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getEventFaqs } from '@/lib/eventData';

/** GET /api/ext/faqs?event=<slug> → FAQs eines Events (read-only). */
export async function GET(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const event = new URL(req.url).searchParams.get('event');
  if (!event) return NextResponse.json({ success: false, error: 'event (Slug) erforderlich' }, { status: 400 });
  const data = await getEventFaqs(event);
  return NextResponse.json({ success: true, data });
}
