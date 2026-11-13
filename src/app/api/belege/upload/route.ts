/**
 * POST /api/belege/upload — Beleg hochladen (multipart: file, source=handy|desktop).
 * Bewusst AUSSERHALB von /api/admin (die Middleware puffert Bodies), darum eigener Session-Guard.
 * Antwortet sofort mit dem neuen Beleg; die Analyse (Text/OCR → KI) läuft im Hintergrund.
 */
import { NextResponse } from 'next/server';
import { requireBelegeUser, jsonError } from '@/lib/belege/actor';
import { createReceipt } from '@/lib/belege/store';
import { startAnalysis } from '@/lib/belege/analyze';
import { BELEGE_MIME } from '@/lib/belege/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function sniffMime(buf: Buffer, declared: string, name: string): string {
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 12).toString('latin1').startsWith('ftyphei') || buf.subarray(4, 12).toString('latin1').startsWith('ftypmif')) return 'image/heic';
  if (/\.pdf$/i.test(name)) return 'application/pdf';
  return declared;
}

export async function POST(req: Request) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError('Upload unvollständig – bitte nochmal versuchen.');
  }
  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('Keine Datei erhalten.');
  const source = form.get('source') === 'desktop' ? 'desktop' : 'handy';
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buffer, file.type, file.name);
  if (!(BELEGE_MIME as readonly string[]).includes(mime)) return jsonError('Nur Fotos (JPG, PNG, WebP, HEIC) oder PDF.');
  try {
    const receipt = await createReceipt({ user, source, buffer, fileName: file.name || 'beleg', mime });
    void startAnalysis(receipt.id);
    return NextResponse.json({ success: true, data: { ...receipt, analysis_status: 'laeuft' } });
  } catch (e) {
    return jsonError((e as Error).message);
  }
}
