import { NextResponse } from 'next/server';
import '@/lib/database';
import { dbAll } from '@/lib/dbq';
import { voicemailConfigured, voicemailFetch, type Voicemail, type VoicemailAnfrage } from '@/lib/voicemailBoard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/voicemails – alle transkribierten Voicemails (neueste zuerst)
 * plus die Anfragen zu den im Gesprochenen erkannten RQ-Nummern (Direktlink ins CRM).
 */
export async function GET() {
  if (!voicemailConfigured()) {
    return NextResponse.json({ success: false, error: 'Voicemail-Dienst nicht eingerichtet (VOICEMAIL_API_TOKEN fehlt).' }, { status: 503 });
  }
  let voicemails: Voicemail[];
  try {
    const r = await voicemailFetch('/api/liste');
    if (!r.ok) throw new Error(`Dienst antwortet ${r.status}`);
    voicemails = (await r.json()).voicemails ?? [];
  } catch (e) {
    return NextResponse.json({ success: false, error: `Voicemail-Dienst nicht erreichbar: ${(e as Error).message}` }, { status: 502 });
  }

  const rqs = [...new Set(voicemails.flatMap((v) => v.refs.filter((r) => r.startsWith('RQ-'))))];
  const anfragen: Record<string, VoicemailAnfrage> = {};
  if (rqs.length) {
    try {
      const rows = await dbAll<VoicemailAnfrage>(
        `SELECT b.id, b.request_number, b.package_title, b.status, c.name AS customer_name
           FROM booking_requests b LEFT JOIN customers c ON c.id = b.customer_id
          WHERE b.request_number IN (${rqs.map(() => '?').join(',')})`,
        rqs,
      );
      for (const row of rows) anfragen[row.request_number] = row;
    } catch (e) {
      console.warn('[voicemails] RQ-Abgleich fehlgeschlagen:', (e as Error).message);
    }
  }

  return NextResponse.json({ success: true, voicemails, anfragen });
}
