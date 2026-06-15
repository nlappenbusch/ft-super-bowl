import { NextResponse } from 'next/server';
import { listCustomers, backfillCustomers } from '@/lib/customerStore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  if (searchParams.get('backfill') === '1') backfillCustomers();
  return NextResponse.json({ success: true, data: listCustomers(search) });
}
