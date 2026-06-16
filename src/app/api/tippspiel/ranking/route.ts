import { NextResponse } from 'next/server';
import { getTippspielSession } from '@/lib/tippspielAuth';
import { getRanking } from '@/lib/tippspielStore';

export async function GET() {
  const session = await getTippspielSession();
  if (!session) return NextResponse.json({ success: false, error: 'Bitte zuerst anmelden.' }, { status: 401 });
  return NextResponse.json({ success: true, ranking: await getRanking() });
}
