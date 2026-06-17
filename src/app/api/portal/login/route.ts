import { NextResponse } from 'next/server';
import { findCustomerIdByEmail, getCustomer } from '@/lib/customerStore';
import { createLoginToken, purgeExpiredLoginTokens, LOGIN_TOKEN_TTL_MIN } from '@/lib/portalStore';
import { sendGraphMail, isGraphConfigured } from '@/lib/graphMailer';
import { magicLinkEmailHtml, magicLinkSubject, publicBaseUrl } from '@/lib/emailTemplates';

/**
 * POST /api/portal/login  { email }
 * Sendet – falls die E-Mail einem Kunden gehört – einen Magic-Link.
 * Antwortet IMMER mit success:true (verrät nicht, welche Adressen existieren).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const generic = NextResponse.json({ success: true });

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, { status: 400 });
    }

    const cid = await findCustomerIdByEmail(email);
    if (!cid) return generic; // keine Auskunft über (nicht-)existierende Adressen

    void purgeExpiredLoginTokens();
    const raw = await createLoginToken(cid, email);
    const link = `${publicBaseUrl()}/api/portal/verify?token=${encodeURIComponent(raw)}`;

    if (isGraphConfigured()) {
      const cust = await getCustomer(cid);
      const name = (cust?.first_name || '').trim() || undefined;
      await sendGraphMail({
        to: email,
        subject: magicLinkSubject(),
        html: magicLinkEmailHtml({ link, recipientName: name, ttlMinutes: LOGIN_TOKEN_TTL_MIN }),
      }).catch((e) => console.warn('[portal] Magic-Link-Versand:', (e as Error).message));
    } else {
      console.warn('[portal] Graph nicht konfiguriert – Magic-Link nicht versendet. Link:', link);
    }

    return generic;
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
