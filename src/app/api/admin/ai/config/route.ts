import { NextResponse } from 'next/server';
import { getSettings, saveSettings, type AiSettings } from '@/lib/settingsStore';

/** Liefert KI-Settings (Key nur als "gesetzt"-Flag). */
export async function GET() {
  const a = getSettings().ai;
  return NextResponse.json({
    success: true,
    data: {
      model: a.model || 'claude-sonnet-4-6',
      has_api_key: !!(a.anthropic_api_key || process.env.ANTHROPIC_API_KEY),
      env_fallback: !!process.env.ANTHROPIC_API_KEY,
    },
  });
}

/** Speichert KI-Settings. Key nur überschreiben, wenn ein Wert übergeben wird. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updates: Partial<AiSettings> = {};
    if (typeof body.model === 'string' && body.model.trim()) updates.model = body.model.trim();
    if (typeof body.anthropic_api_key === 'string' && body.anthropic_api_key.trim()) {
      updates.anthropic_api_key = body.anthropic_api_key.trim();
    }
    saveSettings({ ai: updates as AiSettings });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
