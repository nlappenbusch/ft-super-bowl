import { NextResponse } from 'next/server';
import { localizeRemoteImage } from '@/lib/mediaLibrary';

// POST { url } -> { success, url } : lädt ein Remote-Bild lokal herunter.
export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ success: false, error: 'Keine URL übergeben.' }, { status: 400 });
    }
    const local = await localizeRemoteImage(url);
    return NextResponse.json({ success: true, url: local });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
