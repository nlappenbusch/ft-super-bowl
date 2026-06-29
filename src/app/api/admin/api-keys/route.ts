import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { listApiKeys, createApiKey } from '@/lib/apiKeyStore';

/** GET → Liste aller API-Keys (ohne Klartext/Hash). */
export async function GET() {
  const data = await listApiKeys();
  return NextResponse.json({ success: true, data });
}

/** POST { name } → neuer Key. Klartext wird NUR EINMAL zurückgegeben. */
export async function POST(req: Request) {
  const ctx = await getSessionEmployee();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  if (!name) return NextResponse.json({ success: false, error: 'name erforderlich' }, { status: 400 });
  const { key, plaintext } = await createApiKey(name, ctx?.session.name || ctx?.employee?.name || '');
  return NextResponse.json({ success: true, data: { ...key, plaintext } });
}
