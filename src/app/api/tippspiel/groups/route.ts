import { NextResponse } from 'next/server';
import { getTippspielSession } from '@/lib/tippspielAuth';
import { createGroup, getGroups } from '@/lib/tippspielStore';

export async function GET() {
  const session = await getTippspielSession();
  if (!session) return NextResponse.json({ success: false, error: 'Bitte zuerst anmelden.' }, { status: 401 });
  return NextResponse.json({ success: true, groups: await getGroups(session.user.id) });
}

export async function POST(request: Request) {
  const session = await getTippspielSession();
  if (!session) return NextResponse.json({ success: false, error: 'Bitte zuerst anmelden.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.name !== 'string' || body.name.trim().length < 2) {
    return NextResponse.json({ success: false, error: 'Bitte gib einen Gruppennamen ein.' }, { status: 400 });
  }
  const group = await createGroup(session.user.id, body.name, typeof body.description === 'string' ? body.description : '');
  return NextResponse.json({ success: true, group });
}
