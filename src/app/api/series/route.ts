import { NextResponse } from 'next/server';
import { getSeriesList } from '@/lib/eventData';

export async function GET() {
  const series = await getSeriesList();
  return NextResponse.json({ success: true, data: series });
}
