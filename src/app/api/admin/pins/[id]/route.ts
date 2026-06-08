import { NextResponse } from 'next/server';
import { deletePin, updatePin } from '@/lib/contentStore';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const payload: any = {};
    if (body.name !== undefined) payload.name = body.name.trim();
    if (body.lat !== undefined) payload.lat = Number(body.lat);
    if (body.lng !== undefined) payload.lng = Number(body.lng);
    if (body.type !== undefined) payload.type = body.type;
    if (body.label !== undefined) payload.label = body.label ? body.label.trim() : null;

    const updated = updatePin(id, payload);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Pin nicht gefunden' },
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
    const success = deletePin(id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Pin nicht gefunden' },
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
