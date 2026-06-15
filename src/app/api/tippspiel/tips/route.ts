import { NextResponse } from 'next/server';
import { getTippspielSession } from '@/lib/tippspielAuth';
import { getTips, saveTips, type StoredTip } from '@/lib/tippspielStore';

export async function GET() {
  const session = await getTippspielSession();
  if (!session) return NextResponse.json({ success: false, error: 'Bitte zuerst anmelden.' }, { status: 401 });
  return NextResponse.json({ success: true, tips: getTips(session.user.id) });
}

export async function POST(request: Request) {
  const session = await getTippspielSession();
  if (!session) return NextResponse.json({ success: false, error: 'Bitte zuerst anmelden.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.tips)) {
    return NextResponse.json({ success: false, error: 'Ungültige Tipps.' }, { status: 400 });
  }
  const tips = body.tips as StoredTip[];
  if (tips.some((tip) => !Number.isInteger(tip.match_id) || !Number.isInteger(tip.home_score) || !Number.isInteger(tip.away_score))) {
    return NextResponse.json({ success: false, error: 'Ungültige Tipps.' }, { status: 400 });
  }
  return NextResponse.json({ success: true, tips: saveTips(session.user.id, tips) });
}
