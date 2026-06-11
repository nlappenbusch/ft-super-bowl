import { NextResponse } from 'next/server';
import { createEvent, getEvents } from '@/lib/contentStore';

export async function GET() {
  return NextResponse.json({ success: true, data: getEvents() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { faqs, ...eventPayload } = body;

    const event = createEvent({
      series_id: eventPayload.series_id || null,
      slug: eventPayload.slug,
      url_segment: eventPayload.url_segment || null,
      name: eventPayload.name,
      title: eventPayload.title,
      description: eventPayload.description || null,
      start_date: eventPayload.start_date || null,
      end_date: eventPayload.end_date || null,
      venue: eventPayload.venue || null,
      location_name: eventPayload.location_name || null,
      location_city: eventPayload.location_city || null,
      location_region: eventPayload.location_region || null,
      location_country: eventPayload.location_country || null,
      hero_image: eventPayload.hero_image || null,
      ticket_image: eventPayload.ticket_image || null,
      base_url: eventPayload.base_url || null,
      first_paragraph_heading: eventPayload.first_paragraph_heading ?? null,
      first_paragraph_text: eventPayload.first_paragraph_text ?? null,
      first_paragraph_image_1: eventPayload.first_paragraph_image_1 ?? null,
      first_paragraph_image_2: eventPayload.first_paragraph_image_2 ?? null,
      first_paragraph_image_3: eventPayload.first_paragraph_image_3 ?? null,
      status: eventPayload.status || 'active',
      show_about: eventPayload.show_about ?? true,
      show_packages: eventPayload.show_packages ?? true,
      show_faqs: eventPayload.show_faqs ?? true,
      show_spielplan: eventPayload.show_spielplan ?? false,
      spielplan: eventPayload.spielplan || [],
      show_wissenswertes: eventPayload.show_wissenswertes ?? false,
      wissenswertes_title: eventPayload.wissenswertes_title || null,
      wissenswertes_text: eventPayload.wissenswertes_text || null,
      wissenswertes_accordion_title: eventPayload.wissenswertes_accordion_title || null,
      wissenswertes_accordion_text: eventPayload.wissenswertes_accordion_text || null,
      show_stadionplan: eventPayload.show_stadionplan ?? false,
      stadionplan_title: eventPayload.stadionplan_title || null,
      stadionplan_venue_name: eventPayload.stadionplan_venue_name || null,
      stadionplan_image: eventPayload.stadionplan_image || null,
      stadionplan_description: eventPayload.stadionplan_description || null,
      show_lageplan: eventPayload.show_lageplan ?? false,
      lageplan_pins: eventPayload.lageplan_pins || [],
      show_leistungen: eventPayload.show_leistungen ?? false,
      leistungen_title: eventPayload.leistungen_title || null,
      leistungen_image: eventPayload.leistungen_image || null,
      leistungen_items: eventPayload.leistungen_items || [],
      show_ticket_categories: eventPayload.show_ticket_categories ?? false,
      ticket_categories_title: eventPayload.ticket_categories_title || null,
      ticket_categories_intro: eventPayload.ticket_categories_intro || null,
      ticket_categories: eventPayload.ticket_categories || []
    });

    if (Array.isArray(faqs)) {
      const { getFaqs, saveFaqs } = require('@/lib/contentStore');
      const { randomUUID } = require('crypto');
      const allFaqs = getFaqs();
      const updatedFaqs = faqs.map((faq: any, idx: number) => ({
        id: faq.id || randomUUID(),
        event_id: event.id,
        question: faq.question || '',
        answer: faq.answer || '',
        sort_order: idx + 1
      }));
      saveFaqs([...allFaqs, ...updatedFaqs]);
    }

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
