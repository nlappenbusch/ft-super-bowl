/**
 * GET /api/admin/belege/meta — alles für die Erfassung: Kategorien, Zahlungsarten, Kontenplan,
 * Lieferanten aus dem Verlauf, eigene Standardwerte, Punkte/Abzeichen und Rangliste.
 * PUT (nur Prüfende) — Gegenkonto-Regeln speichern.
 */
import { NextResponse } from 'next/server';
import { requireBelegeUser, jsonError } from '@/lib/belege/actor';
import { getRegeln, leaderboard, personDefaults, playerStats, saveRegeln, searchAssoc, supplierHistory } from '@/lib/belege/store';
import { KATEGORIEN, KONTEN, ZAHLUNGSARTEN } from '@/lib/belege/kontenplan';
import { isBelegeAiConfigured } from '@/lib/belege/ai';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  const sp = new URL(req.url).searchParams;
  const q = sp.get('assoc');
  if (q !== null) return NextResponse.json({ success: true, data: { candidates: await searchAssoc(q) } });
  const [suppliers, defaults, stats, board] = await Promise.all([
    supplierHistory(400), personDefaults(user.id), playerStats(user.id), leaderboard(30),
  ]);
  return NextResponse.json({
    success: true,
    data: {
      me: user,
      kategorien: KATEGORIEN.map(({ words: _w, ...k }) => k),
      zahlungsarten: ZAHLUNGSARTEN,
      konten: KONTEN,
      regeln: getRegeln(),
      suppliers,
      defaults,
      stats,
      leaderboard: board,
      ai: isBelegeAiConfigured(),
    },
  });
}

export async function PUT(req: Request) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  if (!user.reviewer) return jsonError('Nur die Buchhaltung kann die Regeln ändern.', 403);
  try {
    const body = await req.json();
    return NextResponse.json({ success: true, data: { regeln: saveRegeln(body) } });
  } catch (e) {
    return jsonError((e as Error).message);
  }
}
