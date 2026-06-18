/**
 * database.ts — Buchungen, CRM-Nachrichten, Rechnungen, Ausgaben.
 * Läuft über die Backend-Abstraktion `dbq` (SQLite ODER Postgres je nach DB_BACKEND).
 * Alle Funktionen sind async (auch im SQLite-Modus), damit ein Flip von DB_BACKEND
 * keine Signaturänderung erfordert.
 */
import { sqlite, dbGet, dbAll, dbRun, ensurePgSchema, db } from './dbq';
import { pgEnabled } from './pg';
import type { BookingRequest, BookingMessage, Traveler } from './supabase';

export { db };

interface BookingRow {
  id: string;
  created_at: string;
  updated_at: string;
  request_number: string | null;
  package_id: string;
  package_title: string;
  start_date: string;
  number_of_persons: number;
  double_rooms: number;
  single_rooms: number;
  travelers: string;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'in_progress' | 'booked' | 'rejected';
  total_price: number;
  notes: string;
  offer_sent?: number;
  docs_ready?: number;
}

const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

/** Legt das komplette SQLite-Schema an (nur im SQLite-Modus relevant). */
export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      request_number TEXT,
      package_id TEXT NOT NULL,
      package_title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      number_of_persons INTEGER NOT NULL,
      double_rooms INTEGER NOT NULL DEFAULT 0,
      single_rooms INTEGER NOT NULL DEFAULT 0,
      travelers TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'booked', 'rejected')),
      total_price REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      assigned_to TEXT,
      customer_id TEXT,
      offer_sent INTEGER NOT NULL DEFAULT 0,
      docs_ready INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      booking_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'partial', 'paid', 'cancelled')),
      notes TEXT DEFAULT '',
      FOREIGN KEY (booking_id) REFERENCES booking_requests(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expense_date TEXT NOT NULL,
      event_slug TEXT DEFAULT '',
      booking_id TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'sonstiges',
      description TEXT NOT NULL,
      vendor TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON booking_requests(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);
    CREATE INDEX IF NOT EXISTS idx_booking_requests_email ON booking_requests(email);
    CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_expenses_event_slug ON expenses(event_slug);
    CREATE INDEX IF NOT EXISTS idx_expenses_booking_id ON expenses(booking_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date DESC);

    CREATE TRIGGER IF NOT EXISTS update_booking_requests_updated_at
    AFTER UPDATE ON booking_requests
    FOR EACH ROW
    BEGIN
      UPDATE booking_requests SET updated_at = datetime('now') WHERE id = OLD.id;
    END;

    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS booking_messages (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      direction TEXT NOT NULL CHECK(direction IN ('out','in')),
      from_email TEXT NOT NULL DEFAULT '',
      to_email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      graph_message_id TEXT,
      FOREIGN KEY (booking_id) REFERENCES booking_requests(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id ON booking_messages(booking_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_messages_graph_id ON booking_messages(graph_message_id) WHERE graph_message_id IS NOT NULL;

    -- ==================== CRM-Kundenstamm ====================
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      salutation TEXT DEFAULT '',
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
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

    -- ==================== KUNDENPORTAL ====================
    -- Magic-Link-Login: Einmal-Token (gehasht) mit Ablauf.
    CREATE TABLE IF NOT EXISTS portal_login_tokens (
      token_hash TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_portal_tokens_cid ON portal_login_tokens(customer_id);

    -- Datei-Anhänge an Nachrichten (beide Richtungen). Inhalt als base64-TEXT.
    CREATE TABLE IF NOT EXISTS booking_message_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      filename TEXT NOT NULL DEFAULT 'datei',
      mime TEXT NOT NULL DEFAULT 'application/octet-stream',
      size INTEGER NOT NULL DEFAULT 0,
      data_b64 TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_bma_message ON booking_message_attachments(message_id);

    -- Kuratierte Dokumente / digitale Reiseakte (Tickets, Hotel-Infos, Voucher, Angebote).
    CREATE TABLE IF NOT EXISTS customer_documents (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      booking_id TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other',
      title TEXT NOT NULL DEFAULT '',
      filename TEXT NOT NULL DEFAULT 'datei',
      mime TEXT NOT NULL DEFAULT 'application/octet-stream',
      size INTEGER NOT NULL DEFAULT 0,
      data_b64 TEXT NOT NULL DEFAULT '',
      visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_cdoc_customer ON customer_documents(customer_id);
    CREATE INDEX IF NOT EXISTS idx_cdoc_booking ON customer_documents(booking_id);

    -- Incentive Builder: gespeicherte KI-Reisepläne (brief/plan als JSON-TEXT).
    CREATE TABLE IF NOT EXISTS incentive_plans (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      title TEXT NOT NULL DEFAULT 'Incentive',
      status TEXT NOT NULL DEFAULT 'draft',
      brief TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT ''
    );

    -- ==================== HR / TEAM ====================
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','mitarbeiter')),
      active INTEGER NOT NULL DEFAULT 1,
      weekly_hours TEXT NOT NULL DEFAULT '[0,8.4,8.4,8.4,8.4,8.4,0]',
      vacation_days_per_year REAL NOT NULL DEFAULT 25,
      employment_start TEXT,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'stamp' CHECK(source IN ('stamp','manual')),
      note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vacation_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days REAL NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'urlaub' CHECK(type IN ('urlaub','krankheit','kompensation','sonstiges')),
      status TEXT NOT NULL DEFAULT 'beantragt' CHECK(status IN ('beantragt','genehmigt','abgelehnt')),
      comment TEXT NOT NULL DEFAULT '',
      decided_by TEXT,
      decided_at TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS staff_tasks (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee_id TEXT,
      booking_id TEXT,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('niedrig','normal','hoch')),
      status TEXT NOT NULL DEFAULT 'offen' CHECK(status IN ('offen','in_arbeit','erledigt')),
      created_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON time_entries(employee_id, date);
    CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee ON vacation_requests(employee_id, start_date);
    CREATE INDEX IF NOT EXISTS idx_staff_tasks_assignee ON staff_tasks(assignee_id, status);

    CREATE TABLE IF NOT EXISTS tippspiel_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tippspiel_users_email ON tippspiel_users(email);

    CREATE TABLE IF NOT EXISTS tippspiel_magic_tokens (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS tippspiel_tips (
      user_id TEXT NOT NULL,
      match_id INTEGER NOT NULL,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, match_id),
      FOREIGN KEY (user_id) REFERENCES tippspiel_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tippspiel_results (
      match_id INTEGER PRIMARY KEY,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tippspiel_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      invite_code TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES tippspiel_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tippspiel_group_members (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES tippspiel_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES tippspiel_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tippspiel_tips_user ON tippspiel_tips(user_id);
    CREATE INDEX IF NOT EXISTS idx_tippspiel_group_members_user ON tippspiel_group_members(user_id);
  `);

  // --- Migrationen für bestehende SQLite-Installationen ---
  const addColumn = (table: string, ddl: string) => {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch (e) {
      if (!String(e).includes('duplicate column')) throw e;
    }
  };
  const cols = sqlite.prepare(`PRAGMA table_info(booking_requests)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'request_number')) addColumn('booking_requests', 'request_number TEXT');
  if (!cols.some((c) => c.name === 'assigned_to')) addColumn('booking_requests', 'assigned_to TEXT');
  if (!cols.some((c) => c.name === 'customer_id')) addColumn('booking_requests', 'customer_id TEXT');
  if (!cols.some((c) => c.name === 'offer_sent')) addColumn('booking_requests', 'offer_sent INTEGER NOT NULL DEFAULT 0');
  if (!cols.some((c) => c.name === 'docs_ready')) addColumn('booking_requests', 'docs_ready INTEGER NOT NULL DEFAULT 0');
  const icols = sqlite.prepare(`PRAGMA table_info(incentive_plans)`).all() as Array<{ name: string }>;
  if (icols.length && !icols.some((c) => c.name === 'error')) addColumn('incentive_plans', "error TEXT NOT NULL DEFAULT ''");
  const ccols = sqlite.prepare(`PRAGMA table_info(customers)`).all() as Array<{ name: string }>;
  if (ccols.length && !ccols.some((c) => c.name === 'salutation')) addColumn('customers', "salutation TEXT DEFAULT ''");
  if (ccols.length && !ccols.some((c) => c.name === 'first_name')) addColumn('customers', "first_name TEXT DEFAULT ''");
  if (ccols.length && !ccols.some((c) => c.name === 'last_name')) addColumn('customers', "last_name TEXT DEFAULT ''");

  sqlite.prepare(`INSERT OR IGNORE INTO counters (name, value) VALUES ('request_number', 10000)`).run();
}

// Initialisierung nur zur Laufzeit (nicht während `next build`).
if (!IS_BUILD_PHASE) {
  if (pgEnabled()) {
    void ensurePgSchema();
  } else {
    initDatabase();
  }
}

/** Nächste fortlaufende Anfragenummer "RQ-12345" (atomar via UPDATE … RETURNING). */
export async function getNextRequestNumber(): Promise<string> {
  const row = await dbGet<{ value: number }>(
    `UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value`,
    ['request_number']
  );
  return `RQ-${row?.value ?? Date.now()}`;
}

export async function insertBooking(booking: Omit<BookingRequest, 'id' | 'created_at' | 'updated_at'>) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const requestNumber = (booking as { request_number?: string }).request_number || (await getNextRequestNumber());

  await dbRun(
    `INSERT INTO booking_requests (
      id, created_at, updated_at, request_number, package_id, package_title, start_date,
      number_of_persons, double_rooms, single_rooms, travelers,
      email, phone, message, status, total_price, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, now, now, requestNumber,
      booking.package_id, booking.package_title, booking.start_date,
      booking.number_of_persons, booking.double_rooms, booking.single_rooms,
      booking.travelers, booking.email, booking.phone, booking.message,
      booking.status, booking.total_price, booking.notes,
    ]
  );

  return { id, created_at: now, updated_at: now, request_number: requestNumber, ...booking };
}

// ==================== MESSAGE (CRM) ====================

interface MessageRow {
  id: string;
  booking_id: string;
  created_at: string;
  direction: 'out' | 'in';
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  graph_message_id: string | null;
}

export async function insertMessage(msg: Omit<BookingMessage, 'id' | 'created_at'>): Promise<BookingMessage> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO booking_messages (id, booking_id, created_at, direction, from_email, to_email, subject, body, graph_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, msg.booking_id, now, msg.direction, msg.from_email, msg.to_email, msg.subject, msg.body, msg.graph_message_id || null]
  );
  return { id, created_at: now, ...msg };
}

export async function getMessagesByBooking(bookingId: string): Promise<BookingMessage[]> {
  const rows = await dbAll<MessageRow>(
    `SELECT * FROM booking_messages WHERE booking_id = ? ORDER BY created_at ASC`,
    [bookingId]
  );
  return rows as BookingMessage[];
}

export async function findBookingByRequestNumber(requestNumber: string): Promise<BookingRequest | undefined> {
  const row = await dbGet<BookingRow>(`SELECT * FROM booking_requests WHERE request_number = ?`, [requestNumber]);
  if (!row) return undefined;
  return { ...row, travelers: JSON.parse(row.travelers) as Traveler[] };
}

export async function messageExistsByGraphId(graphId: string): Promise<boolean> {
  const row = await dbGet(`SELECT 1 AS ok FROM booking_messages WHERE graph_message_id = ? LIMIT 1`, [graphId]);
  return !!row;
}

export async function getAllBookings(): Promise<BookingRequest[]> {
  const rows = await dbAll<BookingRow>('SELECT * FROM booking_requests ORDER BY created_at DESC');
  return rows.map((row) => ({ ...row, travelers: JSON.parse(row.travelers) as Traveler[] }));
}

export async function getBookingById(id: string): Promise<BookingRequest | undefined> {
  const row = await dbGet<BookingRow>('SELECT * FROM booking_requests WHERE id = ?', [id]);
  if (!row) return undefined;
  return { ...row, travelers: JSON.parse(row.travelers) as Traveler[] };
}

export async function updateBookingStatus(id: string, status: BookingRequest['status']) {
  const { changes } = await dbRun('UPDATE booking_requests SET status = ? WHERE id = ?', [status, id]);
  return changes > 0;
}

export async function updateBookingNotes(id: string, notes: string) {
  const { changes } = await dbRun('UPDATE booking_requests SET notes = ? WHERE id = ?', [notes, id]);
  return changes > 0;
}

export async function updateBookingMilestones(id: string, m: { offer_sent?: boolean; docs_ready?: boolean }) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (m.offer_sent !== undefined) { sets.push('offer_sent = ?'); vals.push(m.offer_sent ? 1 : 0); }
  if (m.docs_ready !== undefined) { sets.push('docs_ready = ?'); vals.push(m.docs_ready ? 1 : 0); }
  if (!sets.length) return false;
  const { changes } = await dbRun(`UPDATE booking_requests SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  return changes > 0;
}

export async function updateBookingAssignee(id: string, assignedTo: string | null) {
  const { changes } = await dbRun('UPDATE booking_requests SET assigned_to = ? WHERE id = ?', [assignedTo, id]);
  return changes > 0;
}

export async function deleteBooking(id: string) {
  const { changes } = await dbRun('DELETE FROM booking_requests WHERE id = ?', [id]);
  return changes > 0;
}

// ==================== INVOICE ====================

export interface Invoice {
  id: string;
  invoice_number: string;
  booking_id: string;
  created_at: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: 'open' | 'partial' | 'paid' | 'cancelled';
  notes: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const lastInvoice = await dbGet<{ invoice_number: string }>(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`,
    [`RE-${year}-%`]
  );
  if (!lastInvoice) return `RE-${year}-0001`;
  const lastNumber = parseInt(lastInvoice.invoice_number.split('-')[2]);
  const newNumber = (lastNumber + 1).toString().padStart(4, '0');
  return `RE-${year}-${newNumber}`;
}

export async function createInvoice(
  bookingId: string,
  items: Omit<InvoiceItem, 'id' | 'invoice_id'>[],
  dueInDays: number = 14,
  notes: string = ''
): Promise<Invoice> {
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = await generateInvoiceNumber();
  const now = new Date().toISOString();
  const invoiceDate = now;
  const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString();
  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

  await dbRun(
    `INSERT INTO invoices (id, invoice_number, booking_id, created_at, invoice_date, due_date, total_amount, paid_amount, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoiceId, invoiceNumber, bookingId, now, invoiceDate, dueDate, totalAmount, 0, 'open', notes || '']
  );

  for (const item of items) {
    await dbRun(
      `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), invoiceId, item.description, item.quantity, item.unit_price, item.total_price]
    );
  }

  return {
    id: invoiceId, invoice_number: invoiceNumber, booking_id: bookingId,
    created_at: now, invoice_date: invoiceDate, due_date: dueDate,
    total_amount: totalAmount, paid_amount: 0, status: 'open', notes: '',
  };
}

export async function getAllInvoices(): Promise<Invoice[]> {
  return dbAll<Invoice>('SELECT * FROM invoices ORDER BY created_at DESC');
}

export async function getInvoiceById(id: string): Promise<Invoice | undefined> {
  return dbGet<Invoice>('SELECT * FROM invoices WHERE id = ?', [id]);
}

export async function getInvoicesByBookingId(bookingId: string): Promise<Invoice[]> {
  return dbAll<Invoice>('SELECT * FROM invoices WHERE booking_id = ? ORDER BY created_at DESC', [bookingId]);
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  return dbAll<InvoiceItem>('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
}

export async function updateInvoiceStatus(id: string, status: Invoice['status']) {
  const { changes } = await dbRun('UPDATE invoices SET status = ? WHERE id = ?', [status, id]);
  return changes > 0;
}

export async function recordPayment(invoiceId: string, amount: number) {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return false;

  const newPaidAmount = invoice.paid_amount + amount;
  let newStatus: Invoice['status'] = 'open';
  if (newPaidAmount >= invoice.total_amount) newStatus = 'paid';
  else if (newPaidAmount > 0) newStatus = 'partial';

  const { changes } = await dbRun('UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?', [newPaidAmount, newStatus, invoiceId]);
  return changes > 0;
}

// ==================== EXPENSE ====================

export type ExpenseCategory =
  | 'hotel' | 'tickets' | 'transfer' | 'flug' | 'catering'
  | 'personal' | 'marketing' | 'gebuehren' | 'sonstiges';

export interface Expense {
  id: string;
  created_at: string;
  expense_date: string;
  event_slug: string;
  booking_id: string;
  category: ExpenseCategory | string;
  description: string;
  vendor: string;
  amount: number;
  notes: string;
}

export type ExpenseInput = Omit<Expense, 'id' | 'created_at'>;

export async function createExpense(input: Partial<ExpenseInput>): Promise<Expense> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: Expense = {
    id,
    created_at: now,
    expense_date: input.expense_date || now,
    event_slug: input.event_slug || '',
    booking_id: input.booking_id || '',
    category: input.category || 'sonstiges',
    description: input.description || '',
    vendor: input.vendor || '',
    amount: Number(input.amount) || 0,
    notes: input.notes || '',
  };

  await dbRun(
    `INSERT INTO expenses (id, created_at, expense_date, event_slug, booking_id, category, description, vendor, amount, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.created_at, row.expense_date, row.event_slug, row.booking_id, row.category, row.description, row.vendor, row.amount, row.notes]
  );
  return row;
}

export async function getAllExpenses(filter?: { eventSlug?: string; bookingId?: string }): Promise<Expense[]> {
  if (filter?.bookingId) {
    return dbAll<Expense>('SELECT * FROM expenses WHERE booking_id = ? ORDER BY expense_date DESC', [filter.bookingId]);
  }
  if (filter?.eventSlug) {
    return dbAll<Expense>('SELECT * FROM expenses WHERE event_slug = ? ORDER BY expense_date DESC', [filter.eventSlug]);
  }
  return dbAll<Expense>('SELECT * FROM expenses ORDER BY expense_date DESC');
}

export async function getExpenseById(id: string): Promise<Expense | undefined> {
  return dbGet<Expense>('SELECT * FROM expenses WHERE id = ?', [id]);
}

export async function updateExpense(id: string, updates: Partial<ExpenseInput>): Promise<boolean> {
  const existing = await getExpenseById(id);
  if (!existing) return false;
  const merged = { ...existing, ...updates };
  const { changes } = await dbRun(
    `UPDATE expenses SET expense_date = ?, event_slug = ?, booking_id = ?, category = ?, description = ?, vendor = ?, amount = ?, notes = ? WHERE id = ?`,
    [merged.expense_date, merged.event_slug, merged.booking_id, merged.category, merged.description, merged.vendor, Number(merged.amount) || 0, merged.notes, id]
  );
  return changes > 0;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const { changes } = await dbRun('DELETE FROM expenses WHERE id = ?', [id]);
  return changes > 0;
}

export default db;
