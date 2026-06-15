import { NextResponse } from 'next/server';
import { mergeCustomers } from '@/lib/customerStore';

/** Body: { targetId, sourceId } – sourceId wird in targetId zusammengeführt. */
export async function POST(req: Request) {
  try {
    const { targetId, sourceId } = await req.json();
    if (!targetId || !sourceId) {
      return NextResponse.json({ success: false, error: 'targetId und sourceId erforderlich' }, { status: 400 });
    }
    const merged = mergeCustomers(String(targetId), String(sourceId));
    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
  }
}
