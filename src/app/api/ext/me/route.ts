import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';

/** GET → prüft den API-Key und gibt dessen Bezeichnung zurück (Health-Check). */
export async function GET(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  return NextResponse.json({ success: true, data: { name: a.key.name, key_prefix: a.key.key_prefix, ok: true } });
}
