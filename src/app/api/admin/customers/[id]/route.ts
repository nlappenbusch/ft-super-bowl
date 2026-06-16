import { NextResponse } from 'next/server';
import { getCustomer, updateCustomer, addEmailToCustomer, type CustomerUpdate } from '@/lib/customerStore';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCustomer(id);
  if (!c) return NextResponse.json({ success: false, error: 'Kunde nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: c });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Alias-E-Mail hinzufügen
    if (typeof body.addEmail === 'string' && body.addEmail.trim()) {
      await addEmailToCustomer(id, body.addEmail);
      return NextResponse.json({ success: true, data: await getCustomer(id) });
    }

    const fields = ['salutation', 'name', 'company', 'phone', 'street', 'zip', 'city', 'country', 'notes'] as const;
    const updates: CustomerUpdate = {};
    for (const f of fields) {
      if (f in body) updates[f] = String(body[f] ?? '');
    }
    const updated = await updateCustomer(id, updates);
    if (!updated) return NextResponse.json({ success: false, error: 'Kunde nicht gefunden' }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
  }
}
