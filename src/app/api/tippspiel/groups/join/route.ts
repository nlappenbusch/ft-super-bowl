import { NextResponse } from 'next/server';
import { getTippspielSession } from '@/lib/tippspielAuth';
import { joinGroup } from '@/lib/tippspielStore';

export async function POST(request: Request) {
  const session = await getTippspielSession();
  if (!session) return NextResponse.json({ success: false, error: 'Bitte zuerst anmelden.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.inviteCode !== 'string') {
    return NextResponse.json({ success: false, error: 'Ungültiger Einladungslink.' }, { status: 400 });
  }
  const group = await joinGroup(session.user.id, body.inviteCode);
  if (!group) return NextResponse.json({ success: false, error: 'Die Gruppe wurde nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ success: true, group });
}
