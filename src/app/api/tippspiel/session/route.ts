import { NextResponse } from 'next/server';
import { getTippspielSession, TIPPSPIEL_SESSION_COOKIE } from '@/lib/tippspielAuth';

export async function GET() {
  const session = await getTippspielSession();
  return NextResponse.json({
    authenticated: !!session,
    user: session ? {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.display_name,
    } : null,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(TIPPSPIEL_SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
