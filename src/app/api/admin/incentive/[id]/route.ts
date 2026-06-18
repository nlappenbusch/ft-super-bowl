import { NextResponse } from 'next/server';
import { getIncentivePlan, deleteIncentivePlan, updateIncentivePlan } from '@/lib/incentive/store';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await getIncentivePlan(id);
  if (!rec) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: rec });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await updateIncentivePlan(id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    status: typeof body.status === 'string' ? body.status : undefined,
    plan: body.plan || undefined,
  });
  const rec = await getIncentivePlan(id);
  return NextResponse.json({ success: true, data: rec });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteIncentivePlan(id);
  return NextResponse.json({ success: true });
}
