import { NextResponse } from 'next/server';
import { deletePinIcon, updatePinIcon } from '@/lib/contentStore';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const payload: any = {};
    if (body.name !== undefined) payload.name = body.name.trim();
    if (body.image !== undefined) payload.image = body.image ? body.image.trim() : null;

    const updated = updatePinIcon(id, payload);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Pin-Icon nicht gefunden' },
        { status: 404 }
      );
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
    const success = deletePinIcon(id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Pin-Icon nicht gefunden' },
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
