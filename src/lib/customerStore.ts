/**
 * customerStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Kundenstamm (CRM). Eindeutige Herleitung über die E-Mail-Adresse.
 * - customers: Stammsatz mit Adressdaten (für Rechnungsstellung).
 * - customer_emails: alle E-Mails eines Kunden (Primary + Aliase nach Merge).
 * - booking_requests.customer_id: Verknüpfung Anfrage/Buchung -> Kunde.
 *
 * Eigene better-sqlite3-Verbindung auf dieselbe data/bookings.db.
 * `import './database'` stellt sicher, dass booking_requests existiert.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import Database from 'better-sqlite3';
import path from 'path';
import './database';

const dbPath = path.join(process.cwd(), 'data', 'bookings.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

function normEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      salutation TEXT DEFAULT '',
      name TEXT DEFAULT '',
      company TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      street TEXT DEFAULT '',
      zip TEXT DEFAULT '',
      city TEXT DEFAULT '',
      country TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS customer_emails (
      email TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_customer_emails_cid ON customer_emails(customer_id);
  `);
  // customer_id an booking_requests ergänzen (falls noch nicht vorhanden)
  try {
    const cols = db.prepare(`PRAGMA table_info(booking_requests)`).all() as Array<{ name: string }>;
    if (cols.length && !cols.some((c) => c.name === 'customer_id')) {
      db.exec(`ALTER TABLE booking_requests ADD COLUMN customer_id TEXT`);
    }
  } catch {
    /* booking_requests evtl. noch nicht da – wird beim ersten Booking nachgezogen */
  }
  // salutation an bestehende customers-Tabelle nachziehen (Migration)
  try {
    const ccols = db.prepare(`PRAGMA table_info(customers)`).all() as Array<{ name: string }>;
    if (ccols.length && !ccols.some((c) => c.name === 'salutation')) {
      db.exec(`ALTER TABLE customers ADD COLUMN salutation TEXT DEFAULT ''`);
    }
  } catch {
    /* ignore */
  }
}
ensureSchema();

export interface Customer {
  id: string;
  created_at: string;
  updated_at: string;
  salutation: string;
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
export function findCustomerIdByEmail(email: string): string | null {
  const e = normEmail(email);
  if (!e) return null;
  const row = db.prepare(`SELECT customer_id FROM customer_emails WHERE email = ?`).get(e) as
    | { customer_id: string }
    | undefined;
  return row?.customer_id ?? null;
}

/**
 * Legt einen Kunden zur E-Mail an oder liefert den bestehenden.
 * Füllt leere Stammfelder (name/phone) opportunistisch nach.
 */
export function upsertCustomerByEmail(
  email: string,
  data?: { name?: string; phone?: string; salutation?: string }
): string {
  const e = normEmail(email);
  if (!e) throw new Error('E-Mail fehlt');

  const existingId = findCustomerIdByEmail(e);
  if (existingId) {
    if (data?.name || data?.phone || data?.salutation) {
      const cur = db.prepare(`SELECT salutation, name, phone FROM customers WHERE id = ?`).get(existingId) as
        | { salutation: string; name: string; phone: string }
        | undefined;
      if (cur) {
        const salutation = cur.salutation?.trim() ? cur.salutation : data?.salutation || '';
        const name = cur.name?.trim() ? cur.name : data?.name || '';
        const phone = cur.phone?.trim() ? cur.phone : data?.phone || '';
        db.prepare(`UPDATE customers SET salutation = ?, name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`).run(
          salutation,
          name,
          phone,
          existingId
        );
      }
    }
    return existingId;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO customers (id, salutation, name, phone) VALUES (?, ?, ?, ?)`
  ).run(id, data?.salutation || '', data?.name || '', data?.phone || '');
  db.prepare(
    `INSERT INTO customer_emails (email, customer_id, is_primary) VALUES (?, ?, 1)`
  ).run(e, id);
  return id;
}

/** Verknüpft eine bestehende Buchung mit (ggf. neuem) Kunden anhand der E-Mail. */
export function linkBookingToCustomer(
  bookingId: string,
  email: string,
  data?: { name?: string; phone?: string; salutation?: string }
): string | null {
  const e = normEmail(email);
  if (!e || !bookingId) return null;
  const cid = upsertCustomerByEmail(e, data);
  try {
    db.prepare(`UPDATE booking_requests SET customer_id = ? WHERE id = ?`).run(cid, bookingId);
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

export function listCustomers(search?: string): CustomerListRow[] {
  const customers = db.prepare(`SELECT * FROM customers ORDER BY updated_at DESC`).all() as Customer[];
  const result: CustomerListRow[] = customers.map((c) => {
    const emails = (db.prepare(`SELECT email, is_primary FROM customer_emails WHERE customer_id = ? ORDER BY is_primary DESC`).all(c.id) as Array<{ email: string; is_primary: number }>);
    const stats = db
      .prepare(
        `SELECT COUNT(*) AS cnt,
                SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) AS booked,
                SUM(CASE WHEN status = 'booked' THEN total_price ELSE 0 END) AS revenue
         FROM booking_requests WHERE customer_id = ?`
      )
      .get(c.id) as { cnt: number; booked: number; revenue: number };
    return {
      ...c,
      primary_email: emails.find((x) => x.is_primary)?.email || emails[0]?.email || '',
      emails: emails.map((x) => x.email),
      requests_count: stats?.cnt || 0,
      bookings_count: stats?.booked || 0,
      revenue: stats?.revenue || 0,
    };
  });

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

export function getCustomer(id: string): CustomerDetail | null {
  const c = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id) as Customer | undefined;
  if (!c) return null;
  const emails = db.prepare(`SELECT * FROM customer_emails WHERE customer_id = ? ORDER BY is_primary DESC, created_at ASC`).all(id) as CustomerEmail[];
  const bookings = db
    .prepare(
      `SELECT id, request_number, package_title, start_date, status, total_price, created_at, email
       FROM booking_requests WHERE customer_id = ? ORDER BY created_at DESC`
    )
    .all(id) as CustomerBooking[];
  let invoices: CustomerInvoice[] = [];
  try {
    invoices = db
      .prepare(
        `SELECT i.id, i.invoice_number, i.booking_id, i.total_amount, i.paid_amount, i.status, i.invoice_date
         FROM invoices i JOIN booking_requests b ON i.booking_id = b.id
         WHERE b.customer_id = ? ORDER BY i.invoice_date DESC`
      )
      .all(id) as CustomerInvoice[];
  } catch {
    invoices = [];
  }
  return { ...c, emails, bookings, invoices };
}

export type CustomerUpdate = Partial<Pick<Customer, 'salutation' | 'name' | 'company' | 'phone' | 'street' | 'zip' | 'city' | 'country' | 'notes'>>;

export function updateCustomer(id: string, updates: CustomerUpdate): CustomerDetail | null {
  const fields = ['salutation', 'name', 'company', 'phone', 'street', 'zip', 'city', 'country', 'notes'] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const f of fields) {
    if (f in updates && updates[f] !== undefined) {
      sets.push(`${f} = ?`);
      vals.push(String(updates[f] ?? ''));
    }
  }
  if (sets.length) {
    sets.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  }
  return getCustomer(id);
}

export function addEmailToCustomer(customerId: string, email: string): void {
  const e = normEmail(email);
  if (!e) return;
  const existing = findCustomerIdByEmail(e);
  if (existing && existing !== customerId) {
    throw new Error('E-Mail gehört bereits zu einem anderen Kunden – bitte mergen.');
  }
  db.prepare(`INSERT OR IGNORE INTO customer_emails (email, customer_id, is_primary) VALUES (?, ?, 0)`).run(e, customerId);
}

/**
 * Führt zwei Kunden zusammen. targetId bleibt bestehen, sourceId wird aufgelöst.
 * Buchungen & E-Mails wandern auf target; leere Stammfelder von target werden aus source gefüllt.
 */
export function mergeCustomers(targetId: string, sourceId: string): CustomerDetail | null {
  if (targetId === sourceId) return getCustomer(targetId);
  const target = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(targetId) as Customer | undefined;
  const source = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(sourceId) as Customer | undefined;
  if (!target || !source) throw new Error('Kunde(n) nicht gefunden');

  const tx = db.transaction(() => {
    // Buchungen umhängen
    db.prepare(`UPDATE booking_requests SET customer_id = ? WHERE customer_id = ?`).run(targetId, sourceId);
    // E-Mails umhängen (als Aliase, is_primary = 0)
    db.prepare(`UPDATE customer_emails SET customer_id = ?, is_primary = 0 WHERE customer_id = ?`).run(targetId, sourceId);
    // Leere Felder von target aus source füllen
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
    db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...vals, targetId);
    // Quelle entfernen
    db.prepare(`DELETE FROM customers WHERE id = ?`).run(sourceId);
  });
  tx();
  return getCustomer(targetId);
}

/** Backfill: bestehende Buchungen ohne customer_id den Kunden zuordnen (idempotent). */
export function backfillCustomers(): { linked: number } {
  let linked = 0;
  try {
    const rows = db
      .prepare(`SELECT id, email, travelers FROM booking_requests WHERE customer_id IS NULL OR customer_id = ''`)
      .all() as Array<{ id: string; email: string; travelers: string }>;
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
      linkBookingToCustomer(r.id, r.email, { name });
      linked++;
    }
  } catch {
    /* booking_requests evtl. leer/fehlend */
  }
  return { linked };
}
backfillCustomers();
