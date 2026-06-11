import { NextResponse } from 'next/server';
import { deleteCategorySeo, getCategorySeoBySlug, upsertCategorySeo } from '@/lib/categorySeoStore';
import { toCategorySlug } from '@/lib/category';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const normalizedSlug = toCategorySlug(slug);

    const existing = getCategorySeoBySlug(normalizedSlug);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Kategorie nicht gefunden' },
        { status: 404 }
      );
    }

    const record = upsertCategorySeo({
      slug: normalizedSlug,
      title: String(body.title || existing.title || normalizedSlug),
      intro_text: String(body.intro_text || existing.intro_text || '').trim(),
      meta_description:
        body.meta_description !== undefined
          ? String(body.meta_description || '').trim() || null
          : existing.meta_description || null,
      status: body.status || existing.status || 'active'
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const success = deleteCategorySeo(toCategorySlug(slug));

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Kategorie nicht gefunden' },
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
