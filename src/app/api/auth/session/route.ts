import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function GET() {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  return NextResponse.json({
    authenticated: !!session,
    user: session ? { name: session.name, email: session.email, src: session.src } : null,
  });
}
