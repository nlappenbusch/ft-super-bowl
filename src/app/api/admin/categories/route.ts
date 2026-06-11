import { NextResponse } from 'next/server';
import { getCategorySeoList, upsertCategorySeo } from '@/lib/categorySeoStore';
import { toCategorySlug } from '@/lib/category';

export async function GET() {
  return NextResponse.json({ success: true, data: getCategorySeoList() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slug = toCategorySlug(String(body.slug || body.title || ''));

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug fehlt' }, { status: 400 });
    }

    const record = upsertCategorySeo({
      slug,
      title: String(body.title || slug),
      intro_text: String(body.intro_text || '').trim(),
      meta_description: body.meta_description ? String(body.meta_description).trim() : null,
      status: body.status || 'active'
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
