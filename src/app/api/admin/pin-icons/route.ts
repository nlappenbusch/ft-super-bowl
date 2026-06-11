import { NextResponse } from 'next/server';
import { createPinIcon, getPinIcons } from '@/lib/contentStore';

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: getPinIcons() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const record = createPinIcon({
      name: body.name.trim(),
      image: body.image ? body.image.trim() : null
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
