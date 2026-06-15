import { NextResponse } from 'next/server';
import { isAiConfigured, getAiConfig, MODULE_SPECS } from '@/lib/aiAssist';

export async function GET() {
  const { model } = getAiConfig();
  return NextResponse.json({
    success: true,
    data: {
      configured: isAiConfigured(),
      model,
      modules: MODULE_SPECS.map((m) => ({ key: m.key, label: m.label })),
    },
  });
}
