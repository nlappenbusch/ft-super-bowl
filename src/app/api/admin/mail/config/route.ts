import { NextResponse } from 'next/server';
import { getSettings, saveSettings, type MailSettings } from '@/lib/settingsStore';

/** Liefert die bearbeitbaren Mail-Werte (Secrets nur als "gesetzt"-Flag). */
export async function GET() {
  const m = getSettings().mail;
  return NextResponse.json({
    success: true,
    data: {
      tenant_id: m.tenant_id,
      client_id: m.client_id,
      mailbox: m.mailbox,
      from_name: m.from_name,
      inbound_poll_secret: m.inbound_poll_secret,
      login_base_url: m.login_base_url || '',
      notify_to: m.notify_to || '',
      ticket_auto_create: !!m.ticket_auto_create,
      ticket_auto_create_domains: m.ticket_auto_create_domains ?? 'faltintravel.com',
      daily_briefing_enabled: m.daily_briefing_enabled !== false,
      daily_briefing_hour: m.daily_briefing_hour ?? 7,
      release_notes_enabled: m.release_notes_enabled !== false,
      has_client_secret: !!(m.client_secret || process.env.GRAPH_CLIENT_SECRET),
      has_brevo: !!(m.brevo_api_key || process.env.BREVO_API_KEY),
      env_fallback: {
        tenant_id: !!process.env.GRAPH_TENANT_ID,
        client_id: !!process.env.GRAPH_CLIENT_ID,
        client_secret: !!process.env.GRAPH_CLIENT_SECRET,
        mailbox: !!process.env.GRAPH_MAILBOX,
      },
    },
  });
}

/** Speichert die Mail-Werte. Secrets nur überschreiben, wenn ein Wert übergeben wird. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updates: Partial<MailSettings> = {};

    for (const key of ['tenant_id', 'client_id', 'mailbox', 'from_name', 'inbound_poll_secret', 'login_base_url', 'notify_to', 'ticket_auto_create_domains'] as const) {
      if (key in body) updates[key] = String(body[key] ?? '');
    }
    if ('ticket_auto_create' in body) updates.ticket_auto_create = !!body.ticket_auto_create;
    if ('daily_briefing_enabled' in body) updates.daily_briefing_enabled = !!body.daily_briefing_enabled;
    if ('release_notes_enabled' in body) updates.release_notes_enabled = !!body.release_notes_enabled;
    if ('daily_briefing_hour' in body) {
      const h = Number(body.daily_briefing_hour);
      if (Number.isFinite(h)) updates.daily_briefing_hour = Math.min(23, Math.max(0, Math.round(h)));
    }
    // Secrets nur setzen, wenn nicht leer (leer = unverändert lassen)
    if (body.client_secret) updates.client_secret = String(body.client_secret);
    if (body.brevo_api_key) updates.brevo_api_key = String(body.brevo_api_key);

    saveSettings({ mail: updates as MailSettings });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
