/**
 * customerStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Kundenstamm (CRM). Eindeutige Herleitung über die E-Mail-Adresse.
 * Läuft über die Backend-Abstraktion `dbq` (SQLite ODER Postgres je nach DB_BACKEND).
 * Das Schema (customers / customer_emails / booking_requests.customer_id) wird in
 * database.initDatabase() bzw. ensurePgSchema() angelegt.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import './database';
import { dbGet, dbAll, dbRun, withTx } from './dbq';

function normEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/** Vollständiger Name aus Vor-/Nachname (getrimmt, Einzelfelder optional). */
export function joinName(first?: string | null, last?: string | null): string {
  return `${(first || '').trim()} ${(last || '').trim()}`.trim();
}

/** Heuristischer Split eines kombinierten Namens: letztes Token = Nachname. */
export function splitName(full?: string | null): { first: string; last: string } {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export interface Customer {
  id: string;
  created_at: string;
  updated_at: string;
  salutation: string;
  first_name: string;
  last_name: string;
  name: string;
  company: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  notes: string;
}

export interface CustomerEmail {
  email: string;
  customer_id: string;
  is_primary: number;
  created_at: string;
}

/** Findet die customer_id zu einer E-Mail (oder null). */
export async function findCustomerIdByEmail(email: string): Promise<string | null> {
  const e = normEmail(email);
  if (!e) return null;
  const row = await dbGet<{ customer_id: string }>(`SELECT customer_id FROM customer_emails WHERE email = ?`, [e]);
  return row?.customer_id ?? null;
}

/** Legt einen Kunden zur E-Mail an oder liefert den bestehenden. */
export async function upsertCustomerByEmail(
  email: string,
  data?: { name?: string; firstName?: string; lastName?: string; phone?: string; salutation?: string }
): Promise<string> {
  const e = normEmail(email);
  if (!e) throw new Error('E-Mail fehlt');

  // Vor-/Nachname herleiten: explizite Felder bevorzugt, sonst aus name splitten.
  const sp = splitName(data?.name);
  const inFirst = (data?.firstName ?? '').trim() || sp.first;
  const inLast = (data?.lastName ?? '').trim() || sp.last;
  const inName = joinName(inFirst, inLast) || (data?.name || '').trim();

  const existingId = await findCustomerIdByEmail(e);
  if (existingId) {
    if (inFirst || inLast || inName || data?.phone || data?.salutation) {
      const cur = await dbGet<{ salutation: string; first_name: string; last_name: string; name: string; phone: string }>(
        `SELECT salutation, first_name, last_name, name, phone FROM customers WHERE id = ?`, [existingId]
      );
      if (cur) {
        const salutation = cur.salutation?.trim() ? cur.salutation : data?.salutation || '';
        const first_name = cur.first_name?.trim() ? cur.first_name : inFirst;
        const last_name = cur.last_name?.trim() ? cur.last_name : inLast;
        const name = cur.name?.trim() ? cur.name : (joinName(first_name, last_name) || inName);
        const phone = cur.phone?.trim() ? cur.phone : data?.phone || '';
        await dbRun(
          `UPDATE customers SET salutation = ?, first_name = ?, last_name = ?, name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`,
          [salutation, first_name, last_name, name, phone, existingId]
        );
      }
    }
    return existingId;
  }

  const id = crypto.randomUUID();
  await dbRun(
    `INSERT INTO customers (id, salutation, first_name, last_name, name, phone) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data?.salutation || '', inFirst, inLast, inName, data?.phone || '']
  );
  await dbRun(`INSERT INTO customer_emails (email, customer_id, is_primary) VALUES (?, ?, 1)`, [e, id]);
  return id;
}

/** Verknüpft eine bestehende Buchung mit (ggf. neuem) Kunden anhand der E-Mail. */
export async function linkBookingToCustomer(
  bookingId: string,
  email: string,
  data?: { name?: string; firstName?: string; lastName?: string; phone?: string; salutation?: string }
): Promise<string | null> {
  const e = normEmail(email);
  if (!e || !bookingId) return null;
  const cid = await upsertCustomerByEmail(e, data);
  try {
    await dbRun(`UPDATE booking_requests SET customer_id = ? WHERE id = ?`, [cid, bookingId]);
  } catch {
    /* ignore */
  }
  return cid;
}

export interface CustomerListRow extends Customer {
  primary_email: string;
  emails: string[];
  requests_count: number;
  bookings_count: number;
  revenue: number;
}

export async function listCustomers(search?: string): Promise<CustomerListRow[]> {
  const customers = await dbAll<Customer>(`SELECT * FROM customers ORDER BY updated_at DESC`);
  const result: CustomerListRow[] = [];
  for (const c of customers) {
    const emails = await dbAll<{ email: string; is_primary: number }>(
      `SELECT email, is_primary FROM customer_emails WHERE customer_id = ? ORDER BY is_primary DESC`, [c.id]
    );
    const stats = await dbGet<{ cnt: number; booked: number; revenue: number }>(
      `SELECT COUNT(*) AS cnt,
              SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) AS booked,
              SUM(CASE WHEN status = 'booked' THEN total_price ELSE 0 END) AS revenue
       FROM booking_requests WHERE customer_id = ?`, [c.id]
    );
    result.push({
      ...c,
      primary_email: emails.find((x) => x.is_primary)?.email || emails[0]?.email || '',
      emails: emails.map((x) => x.email),
      requests_count: Number(stats?.cnt) || 0,
      bookings_count: Number(stats?.booked) || 0,
      revenue: Number(stats?.revenue) || 0,
    });
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    return result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.emails.some((e) => e.includes(q))
    );
  }
  return result;
}

export interface CustomerBooking {
  id: string;
  request_number: string | null;
  package_title: string;
  start_date: string;
  status: string;
  total_price: number;
  created_at: string;
  email: string;
  offer_sent: number;
  docs_ready: number;
}

export interface CustomerInvoice {
  id: string;
  invoice_number: string;
  booking_id: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  invoice_date: string;
}

export interface CustomerDetail extends Customer {
  emails: CustomerEmail[];
  bookings: CustomerBooking[];
  invoices: CustomerInvoice[];
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const c = await dbGet<Customer>(`SELECT * FROM customers WHERE id = ?`, [id]);
  if (!c) return null;
  // Altdaten ohne getrennte Felder: aus kombiniertem Namen herleiten (nur Anzeige).
  if (!(c.first_name || '').trim() && !(c.last_name || '').trim() && (c.name || '').trim()) {
    const sp = splitName(c.name);
    c.first_name = sp.first;
    c.last_name = sp.last;
  }
  const emails = await dbAll<CustomerEmail>(`SELECT * FROM customer_emails WHERE customer_id = ? ORDER BY is_primary DESC, created_at ASC`, [id]);
  const bookings = await dbAll<CustomerBooking>(
    `SELECT id, request_number, package_title, start_date, status, total_price, created_at, email, offer_sent, docs_ready
     FROM booking_requests WHERE customer_id = ? ORDER BY created_at DESC`, [id]
  );
  let invoices: CustomerInvoice[] = [];
  try {
    invoices = await dbAll<CustomerInvoice>(
      `SELECT i.id, i.invoice_number, i.booking_id, i.total_amount, i.paid_amount, i.status, i.invoice_date
       FROM invoices i JOIN booking_requests b ON i.booking_id = b.id
       WHERE b.customer_id = ? ORDER BY i.invoice_date DESC`, [id]
    );
  } catch {
    invoices = [];
  }
  return { ...c, emails, bookings, invoices };
}

export type CustomerUpdate = Partial<Pick<Customer, 'salutation' | 'first_name' | 'last_name' | 'name' | 'company' | 'phone' | 'street' | 'zip' | 'city' | 'country' | 'notes'>>;

export async function updateCustomer(id: string, updates: CustomerUpdate): Promise<CustomerDetail | null> {
  const fields = ['salutation', 'first_name', 'last_name', 'name', 'company', 'phone', 'street', 'zip', 'city', 'country', 'notes'] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const f of fields) {
    if (f in updates && updates[f] !== undefined) {
      sets.push(`${f} = ?`);
      vals.push(String(updates[f] ?? ''));
    }
  }
  // Wenn Vor-/Nachname geändert werden, kombiniertes `name`-Feld konsistent halten.
  if (('first_name' in updates || 'last_name' in updates) && !('name' in updates)) {
    const cur = await dbGet<{ first_name: string; last_name: string }>(`SELECT first_name, last_name FROM customers WHERE id = ?`, [id]);
    const first = 'first_name' in updates ? String(updates.first_name ?? '') : (cur?.first_name || '');
    const last = 'last_name' in updates ? String(updates.last_name ?? '') : (cur?.last_name || '');
    sets.push(`name = ?`);
    vals.push(joinName(first, last));
  }
  if (sets.length) {
    sets.push(`updated_at = datetime('now')`);
    await dbRun(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  }
  return getCustomer(id);
}

export async function addEmailToCustomer(customerId: string, email: string): Promise<void> {
  const e = normEmail(email);
  if (!e) return;
  const existing = await findCustomerIdByEmail(e);
  if (existing && existing !== customerId) {
    throw new Error('E-Mail gehört bereits zu einem anderen Kunden – bitte mergen.');
  }
  await dbRun(`INSERT OR IGNORE INTO customer_emails (email, customer_id, is_primary) VALUES (?, ?, 0)`, [e, customerId]);
}

/** Führt zwei Kunden zusammen. targetId bleibt bestehen, sourceId wird aufgelöst. */
export async function mergeCustomers(targetId: string, sourceId: string): Promise<CustomerDetail | null> {
  if (targetId === sourceId) return getCustomer(targetId);
  const target = await dbGet<Customer>(`SELECT * FROM customers WHERE id = ?`, [targetId]);
  const source = await dbGet<Customer>(`SELECT * FROM customers WHERE id = ?`, [sourceId]);
  if (!target || !source) throw new Error('Kunde(n) nicht gefunden');

  await withTx(async (q) => {
    await q.run(`UPDATE booking_requests SET customer_id = ? WHERE customer_id = ?`, [targetId, sourceId]);
    await q.run(`UPDATE customer_emails SET customer_id = ?, is_primary = 0 WHERE customer_id = ?`, [targetId, sourceId]);
    const fillable = ['name', 'company', 'phone', 'street', 'zip', 'city', 'country'] as const;
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fillable) {
      if (!String(target[f] || '').trim() && String(source[f] || '').trim()) {
        sets.push(`${f} = ?`);
        vals.push(source[f]);
      }
    }
    const mergedNotes = [target.notes, source.notes].map((n) => (n || '').trim()).filter(Boolean).join('\n---\n');
    sets.push(`notes = ?`);
    vals.push(mergedNotes);
    sets.push(`updated_at = datetime('now')`);
    await q.run(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`, [...vals, targetId]);
    await q.run(`DELETE FROM customers WHERE id = ?`, [sourceId]);
  });
  return getCustomer(targetId);
}

/** Backfill: bestehende Buchungen ohne customer_id den Kunden zuordnen (idempotent). */
export async function backfillCustomers(): Promise<{ linked: number }> {
  let linked = 0;
  try {
    const rows = await dbAll<{ id: string; email: string; travelers: string }>(
      `SELECT id, email, travelers FROM booking_requests WHERE customer_id IS NULL OR customer_id = ''`
    );
    for (const r of rows) {
      if (!r.email) continue;
      let name = '';
      try {
        const t = JSON.parse(r.travelers || '[]');
        if (Array.isArray(t) && t[0]) {
          name = [t[0].firstName || t[0].first_name, t[0].lastName || t[0].last_name].filter(Boolean).join(' ');
        }
      } catch {
        /* ignore */
      }
      await linkBookingToCustomer(r.id, r.email, { name });
      linked++;
    }
  } catch {
    /* booking_requests evtl. leer/fehlend */
  }
  return { linked };
}
