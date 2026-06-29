import { NextResponse } from 'next/server';
import { revokeApiKey, deleteApiKey } from '@/lib/apiKeyStore';

/** DELETE ?hard=1 → Key löschen, sonst widerrufen (revoked=1). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hard = new URL(req.url).searchParams.get('hard') === '1';
  const ok = hard ? await deleteApiKey(id) : await revokeApiKey(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Key nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true });
}
