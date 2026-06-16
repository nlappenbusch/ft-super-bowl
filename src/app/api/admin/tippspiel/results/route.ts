import { NextResponse } from 'next/server';
import { getResults, setResult } from '@/lib/tippspielStore';

export async function GET() {
  return NextResponse.json({ success: true, results: await getResults() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const results = await setResult({
      match_id: Number(body.match_id),
      home_score: Number(body.home_score),
      away_score: Number(body.away_score),
    });
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
  }
}
