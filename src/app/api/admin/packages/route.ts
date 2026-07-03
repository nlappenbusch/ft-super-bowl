import { NextResponse } from 'next/server';
import { createPackage, getPackages } from '@/lib/contentStore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const packages = getPackages();
  const filtered = eventId ? packages.filter((pkg) => pkg.event_id === eventId) : packages;

  return NextResponse.json({ success: true, data: filtered });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const record = createPackage({
      event_id: body.event_id,
      slug: body.slug,
      package_name: body.package_name || null,
      title: body.title,
      short_description: body.short_description || null,
      description: body.description || null,
      hotel: body.hotel || null,
      stars: body.stars ?? null,
      nights: body.nights ?? null,
      price: body.price ?? null,
      currency: body.currency || 'EUR',
      single_supplement: body.single_supplement ?? null,
      travel_period: body.travel_period || null,
      popular: Boolean(body.popular),
      available_spots: body.available_spots ?? null,
      rating: body.rating ?? null,
      reviews: body.reviews ?? null,
      hotel_images: body.hotel_images || [],
      distances: body.distances || {},
      room_categories: body.room_categories || [],
      extension_nights: body.extension_nights || null,
      badge_text: body.badge_text || null,
      includes: body.includes || []
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
