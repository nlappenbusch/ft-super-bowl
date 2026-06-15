import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { BookingRequest, BookingMessage, Traveler } from './supabase';

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
}

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bookings.db');
export const db = new Database(dbPath);
db.pragma('busy_timeout = 15000');

// Schreibende Initialisierung (WAL-Switch) nur zur Laufzeit, NICHT während `next build`:
// der Build sammelt Page-Daten mit mehreren Parallel-Workern → sonst "database is locked".
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';
if (!IS_BUILD_PHASE) {
  db.pragma('journal_mode = WAL');
}

export function initDatabase() {
  db.exec(`
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
      assigned_to TEXT
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

    -- Fortlaufende Zähler (z.B. RQ-Anfragenummer)
    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );

    -- E-Mail-Konversation pro Anfrage (CRM)
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

    -- ==================== HR / TEAM ====================

    -- Mitarbeiter: automatisch angelegt beim Microsoft-Login (id = Entra oid)
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','mitarbeiter')),
      active INTEGER NOT NULL DEFAULT 1,
      -- Wochenarbeitszeit: JSON-Array [So,Mo,Di,Mi,Do,Fr,Sa] in Stunden
      weekly_hours TEXT NOT NULL DEFAULT '[0,8.4,8.4,8.4,8.4,8.4,0]',
      vacation_days_per_year REAL NOT NULL DEFAULT 25,
      employment_start TEXT,
      notes TEXT NOT NULL DEFAULT ''
    );

    -- Zeiterfassung: Stempeluhr + manuelle Einträge
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      date TEXT NOT NULL,                -- YYYY-MM-DD
      start_time TEXT NOT NULL,          -- HH:MM
      end_time TEXT,                     -- HH:MM, NULL = läuft (eingestempelt)
      break_minutes INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'stamp' CHECK(source IN ('stamp','manual')),
      note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- Urlaub / Abwesenheiten
    CREATE TABLE IF NOT EXISTS vacation_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      start_date TEXT NOT NULL,          -- YYYY-MM-DD
      end_date TEXT NOT NULL,            -- YYYY-MM-DD (inklusive)
      days REAL NOT NULL DEFAULT 0,      -- verbrauchte Arbeitstage (ZH-Feiertage exkl.)
      type TEXT NOT NULL DEFAULT 'urlaub' CHECK(type IN ('urlaub','krankheit','kompensation','sonstiges')),
      status TEXT NOT NULL DEFAULT 'beantragt' CHECK(status IN ('beantragt','genehmigt','abgelehnt')),
      comment TEXT NOT NULL DEFAULT '',
      decided_by TEXT,
      decided_at TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- Interne Aufgaben (optional mit Bezug auf eine Anfrage)
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

    -- Externe Nutzer des WM-Tippspiels
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

  // --- Migrationen für bestehende Installationen ---------------------------
  // SQLite kennt kein "ADD COLUMN IF NOT EXISTS"; mehrere Build-Worker können
  // parallel migrieren → "duplicate column" wird bewusst ignoriert (idempotent).
  const addColumn = (table: string, ddl: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch (e) {
      if (!String(e).includes('duplicate column')) throw e;
    }
  };
  const cols = db.prepare(`PRAGMA table_info(booking_requests)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'request_number')) addColumn('booking_requests', 'request_number TEXT');
  if (!cols.some((c) => c.name === 'assigned_to')) addColumn('booking_requests', 'assigned_to TEXT');

  // RQ-Zähler initialisieren (Start bei 10000 → erste Nummer RQ-10001)
  db.prepare(`INSERT OR IGNORE INTO counters (name, value) VALUES ('request_number', 10000)`).run();
}

// Tabellen/Migrationen nur zur Laufzeit anlegen, nicht während `next build` (Parallel-Worker-Race).
if (!IS_BUILD_PHASE) {
  initDatabase();
}

/**
 * Liefert die nächste fortlaufende Anfragenummer im Format "RQ-12345".
 * Atomar via Transaktion (better-sqlite3 ist synchron/serialisiert).
 */
export function getNextRequestNumber(): string {
  const tx = db.transaction(() => {
    db.prepare(`UPDATE counters SET value = value + 1 WHERE name = 'request_number'`).run();
    const row = db.prepare(`SELECT value FROM counters WHERE name = 'request_number'`).get() as { value: number };
    return row.value;
  });
  const value = tx();
  return `RQ-${value}`;
}

export function insertBooking(booking: Omit<BookingRequest, 'id' | 'created_at' | 'updated_at'>) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const requestNumber = (booking as { request_number?: string }).request_number || getNextRequestNumber();

  const stmt = db.prepare(`
    INSERT INTO booking_requests (
      id, created_at, updated_at, request_number, package_id, package_title, start_date,
      number_of_persons, double_rooms, single_rooms, travelers,
      email, phone, message, status, total_price, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id, now, now, requestNumber,
    booking.package_id,
    booking.package_title,
    booking.start_date,
    booking.number_of_persons,
    booking.double_rooms,
    booking.single_rooms,
    booking.travelers,
    booking.email,
    booking.phone,
    booking.message,
    booking.status,
    booking.total_price,
    booking.notes
  );

  return { id, created_at: now, updated_at: now, request_number: requestNumber, ...booking };
}

// ==================== MESSAGE (CRM-Konversation) FUNCTIONS ====================

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

export function insertMessage(
  msg: Omit<BookingMessage, 'id' | 'created_at'>
): BookingMessage {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO booking_messages (id, booking_id, created_at, direction, from_email, to_email, subject, body, graph_message_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, msg.booking_id, now, msg.direction,
    msg.from_email, msg.to_email, msg.subject, msg.body,
    msg.graph_message_id || null
  );
  return { id, created_at: now, ...msg };
}

export function getMessagesByBooking(bookingId: string): BookingMessage[] {
  const rows = db
    .prepare(`SELECT * FROM booking_messages WHERE booking_id = ? ORDER BY created_at ASC`)
    .all(bookingId) as MessageRow[];
  return rows as BookingMessage[];
}

export function findBookingByRequestNumber(requestNumber: string): BookingRequest | undefined {
  const row = db
    .prepare(`SELECT * FROM booking_requests WHERE request_number = ?`)
    .get(requestNumber) as BookingRow | undefined;
  if (!row) return undefined;
  return { ...row, travelers: JSON.parse(row.travelers) as Traveler[] };
}

export function messageExistsByGraphId(graphId: string): boolean {
  const row = db
    .prepare(`SELECT 1 FROM booking_messages WHERE graph_message_id = ? LIMIT 1`)
    .get(graphId);
  return !!row;
}

export function getAllBookings(): BookingRequest[] {
  const stmt = db.prepare('SELECT * FROM booking_requests ORDER BY created_at DESC');
  const rows = stmt.all() as BookingRow[];
  return rows.map(row => ({
    ...row,
    travelers: JSON.parse(row.travelers) as Traveler[]
  }));
}

export function getBookingById(id: string): BookingRequest | undefined {
  const stmt = db.prepare('SELECT * FROM booking_requests WHERE id = ?');
  const row = stmt.get(id) as BookingRow | undefined;
  if (!row) return undefined;
  return {
    ...row,
    travelers: JSON.parse(row.travelers) as Traveler[]
  };
}

export function updateBookingStatus(id: string, status: BookingRequest['status']) {
  const stmt = db.prepare('UPDATE booking_requests SET status = ? WHERE id = ?');
  const result = stmt.run(status, id);
  return result.changes > 0;
}

export function updateBookingNotes(id: string, notes: string) {
  const stmt = db.prepare('UPDATE booking_requests SET notes = ? WHERE id = ?');
  const result = stmt.run(notes, id);
  return result.changes > 0;
}

export function updateBookingAssignee(id: string, assignedTo: string | null) {
  const stmt = db.prepare('UPDATE booking_requests SET assigned_to = ? WHERE id = ?');
  const result = stmt.run(assignedTo, id);
  return result.changes > 0;
}

export function deleteBooking(id: string) {
  const stmt = db.prepare('DELETE FROM booking_requests WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ==================== INVOICE FUNCTIONS ====================

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

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const stmt = db.prepare(`
    SELECT invoice_number FROM invoices
    WHERE invoice_number LIKE ?
    ORDER BY invoice_number DESC
    LIMIT 1
  `);
  const lastInvoice = stmt.get(`RE-${year}-%`) as { invoice_number: string } | undefined;
  if (!lastInvoice) {
    return `RE-${year}-0001`;
  }
  const lastNumber = parseInt(lastInvoice.invoice_number.split('-')[2]);
  const newNumber = (lastNumber + 1).toString().padStart(4, '0');
  return `RE-${year}-${newNumber}`;
}

export function createInvoice(
  bookingId: string,
  items: Omit<InvoiceItem, 'id' | 'invoice_id'>[],
  dueInDays: number = 14,
  notes: string = ''
): Invoice {
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = generateInvoiceNumber();
  const now = new Date().toISOString();
  const invoiceDate = now;
  const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString();
  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

  const invoiceStmt = db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, booking_id, created_at, invoice_date, due_date,
      total_amount, paid_amount, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  invoiceStmt.run(
    invoiceId, invoiceNumber, bookingId, now, invoiceDate, dueDate,
    totalAmount, 0, 'open', notes || ''
  );

  const itemStmt = db.prepare(`
    INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  items.forEach(item => {
    const itemId = crypto.randomUUID();
    itemStmt.run(
      itemId, invoiceId, item.description, item.quantity, item.unit_price, item.total_price
    );
  });

  return {
    id: invoiceId,
    invoice_number: invoiceNumber,
    booking_id: bookingId,
    created_at: now,
    invoice_date: invoiceDate,
    due_date: dueDate,
    total_amount: totalAmount,
    paid_amount: 0,
    status: 'open',
    notes: ''
  };
}

export function getAllInvoices(): Invoice[] {
  const stmt = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC');
  return stmt.all() as Invoice[];
}

export function getInvoiceById(id: string): Invoice | undefined {
  const stmt = db.prepare('SELECT * FROM invoices WHERE id = ?');
  return stmt.get(id) as Invoice | undefined;
}

export function getInvoicesByBookingId(bookingId: string): Invoice[] {
  const stmt = db.prepare('SELECT * FROM invoices WHERE booking_id = ? ORDER BY created_at DESC');
  return stmt.all(bookingId) as Invoice[];
}

export function getInvoiceItems(invoiceId: string): InvoiceItem[] {
  const stmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
  return stmt.all(invoiceId) as InvoiceItem[];
}

export function updateInvoiceStatus(id: string, status: Invoice['status']) {
  const stmt = db.prepare('UPDATE invoices SET status = ? WHERE id = ?');
  const result = stmt.run(status, id);
  return result.changes > 0;
}

export function recordPayment(invoiceId: string, amount: number) {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) return false;

  const newPaidAmount = invoice.paid_amount + amount;
  let newStatus: Invoice['status'] = 'open';

  if (newPaidAmount >= invoice.total_amount) {
    newStatus = 'paid';
  } else if (newPaidAmount > 0) {
    newStatus = 'partial';
  }

  const stmt = db.prepare('UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?');
  const result = stmt.run(newPaidAmount, newStatus, invoiceId);
  return result.changes > 0;
}

// ==================== EXPENSE FUNCTIONS ====================

export type ExpenseCategory =
  | 'hotel'
  | 'tickets'
  | 'transfer'
  | 'flug'
  | 'catering'
  | 'personal'
  | 'marketing'
  | 'gebuehren'
  | 'sonstiges';

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

export function createExpense(input: Partial<ExpenseInput>): Expense {
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

  const stmt = db.prepare(`
    INSERT INTO expenses (
      id, created_at, expense_date, event_slug, booking_id,
      category, description, vendor, amount, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    row.id, row.created_at, row.expense_date, row.event_slug, row.booking_id,
    row.category, row.description, row.vendor, row.amount, row.notes
  );

  return row;
}

export function getAllExpenses(filter?: { eventSlug?: string; bookingId?: string }): Expense[] {
  if (filter?.bookingId) {
    return db.prepare('SELECT * FROM expenses WHERE booking_id = ? ORDER BY expense_date DESC').all(filter.bookingId) as Expense[];
  }
  if (filter?.eventSlug) {
    return db.prepare('SELECT * FROM expenses WHERE event_slug = ? ORDER BY expense_date DESC').all(filter.eventSlug) as Expense[];
  }
  return db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC').all() as Expense[];
}

export function getExpenseById(id: string): Expense | undefined {
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense | undefined;
}

export function updateExpense(id: string, updates: Partial<ExpenseInput>): boolean {
  const existing = getExpenseById(id);
  if (!existing) return false;
  const merged = { ...existing, ...updates };
  const stmt = db.prepare(`
    UPDATE expenses SET
      expense_date = ?, event_slug = ?, booking_id = ?,
      category = ?, description = ?, vendor = ?, amount = ?, notes = ?
    WHERE id = ?
  `);
  const result = stmt.run(
    merged.expense_date, merged.event_slug, merged.booking_id,
    merged.category, merged.description, merged.vendor, Number(merged.amount) || 0, merged.notes,
    id
  );
  return result.changes > 0;
}

export function deleteExpense(id: string): boolean {
  const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return result.changes > 0;
}

export default db;
