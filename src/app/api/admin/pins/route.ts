import { NextResponse } from 'next/server';
import { createPin, getPins } from '@/lib/contentStore';

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: getPins() });
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
    
    if (!body.name || body.lat === undefined || body.lng === undefined || !body.type) {
      return NextResponse.json(
        { success: false, error: 'Name, Latitude, Longitude, and Type are required' },
        { status: 400 }
      );
    }

    const record = createPin({
      name: body.name.trim(),
      lat: Number(body.lat),
      lng: Number(body.lng),
      type: body.type,
      label: body.label ? body.label.trim() : null
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
