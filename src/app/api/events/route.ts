import { NextResponse } from 'next/server';
import { getEventsList } from '@/lib/eventData';

export async function GET() {
  const events = await getEventsList();
  return NextResponse.json({ success: true, data: events });
}
