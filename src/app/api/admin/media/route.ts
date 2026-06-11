import { NextResponse } from 'next/server';
import { listMediaLibrary, saveUploadedMedia } from '@/lib/mediaLibrary';

export async function GET() {
  try {
    const items = await listMediaLibrary();
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Keine Datei erhalten.' },
        { status: 400 }
      );
    }

    const item = await saveUploadedMedia(file);
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}