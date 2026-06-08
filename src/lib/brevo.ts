/**
 * Brevo (Sendinblue) API helper
 * Requires BREVO_API_KEY in environment variables
 */

const BREVO_API_URL = 'https://api.brevo.com/v3';

interface BrevoContactAttributes {
  FIRSTNAME?: string;
  LASTNAME?: string;
  SMS?: string;
  [key: string]: string | undefined;
}

export async function addContactToBrevoList(
  email: string,
  firstName: string,
  lastName: string,
  phone: string,
  listId: number
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('[Brevo] BREVO_API_KEY not set — skipping Brevo sync');
    return { success: false, error: 'No API key configured' };
  }

  if (!listId) {
    return { success: false, error: 'No list ID provided' };
  }

  try {
    const attributes: BrevoContactAttributes = {};
    if (firstName) attributes.FIRSTNAME = firstName;
    if (lastName) attributes.LASTNAME = lastName;
    if (phone) attributes.SMS = phone;

    // Create or update contact
    const response = await fetch(`${BREVO_API_URL}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds: [listId],
        updateEnabled: true, // update if already exists
      }),
    });

    if (response.ok || response.status === 204) {
      return { success: true };
    }

    const errorBody = await response.json().catch(() => ({}));
    const msg = (errorBody as any)?.message || response.statusText;
    console.error('[Brevo] API error:', msg);
    return { success: false, error: msg };
  } catch (err) {
    console.error('[Brevo] Network error:', err);
    return { success: false, error: String(err) };
  }
}
