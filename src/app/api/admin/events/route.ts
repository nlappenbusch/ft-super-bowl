import { NextResponse } from 'next/server';
import { createEvent, getEvents } from '@/lib/contentStore';

export async function GET() {
  return NextResponse.json({ success: true, data: getEvents() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = createEvent({
      series_id: body.series_id || null,
      slug: body.slug,
      name: body.name,
      title: body.title,
      description: body.description || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      venue: body.venue || null,
      location_name: body.location_name || null,
      location_city: body.location_city || null,
      location_region: body.location_region || null,
      location_country: body.location_country || null,
      hero_image: body.hero_image || null,
      ticket_image: body.ticket_image || null,
      base_url: body.base_url || null,
      status: body.status || 'active'
    });

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
