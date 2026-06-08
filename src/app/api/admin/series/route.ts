import { NextResponse } from 'next/server';
import { createSeries, getSeries } from '@/lib/contentStore';

export async function GET() {
  return NextResponse.json({ success: true, data: getSeries() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const series = createSeries({
      slug: body.slug,
      title: body.title,
      description: body.description || null,
      category: body.category || 'Sonstiges',
      category_seo_text: body.category_seo_text || null,
      hero_image: body.hero_image || null,
      status: body.status || 'active',
      intro_text: body.intro_text || null,
      highlights: body.highlights || [],
      seo_text: body.seo_text || null
    });

    return NextResponse.json({ success: true, data: series });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
