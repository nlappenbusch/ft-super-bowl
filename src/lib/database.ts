import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { BookingRequest, Traveler } from './supabase';

// Database row type (travelers is JSON string in SQLite)
interface BookingRow {
  id: string;
  created_at: string;
  updated_at: string;
  package_id: string;
  package_title: string;
  start_date: string;
  number_of_persons: number;
  double_rooms: number;
  single_rooms: number;
  travelers: string; // JSON string
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'in_progress' | 'booked' | 'rejected';
  total_price: number;
  notes: string;
}

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bookings.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      notes TEXT DEFAULT ''
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

    CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON booking_requests(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);
    CREATE INDEX IF NOT EXISTS idx_booking_requests_email ON booking_requests(email);
    CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

    CREATE TRIGGER IF NOT EXISTS update_booking_requests_updated_at
    AFTER UPDATE ON booking_requests
    FOR EACH ROW
    BEGIN
      UPDATE booking_requests SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
  `);
}

// Initialize on import
initDatabase();

// Insert new booking
export function insertBooking(booking: Omit<BookingRequest, 'id' | 'created_at' | 'updated_at'>) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO booking_requests (
      id, created_at, updated_at, package_id, package_title, start_date,
      number_of_persons, double_rooms, single_rooms, travelers,
      email, phone, message, status, total_price, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id, now, now,
    booking.package_id,
    booking.package_title,
    booking.start_date,
    booking.number_of_persons,
    booking.double_rooms,
    booking.single_rooms,
    booking.travelers, // Already JSON string
    booking.email,
    booking.phone,
    booking.message,
    booking.status,
    booking.total_price,
    booking.notes
  );

  return { id, created_at: now, updated_at: now, ...booking };
}

// Get all bookings
export function getAllBookings(): BookingRequest[] {
  const stmt = db.prepare('SELECT * FROM booking_requests ORDER BY created_at DESC');
  const rows = stmt.all() as BookingRow[];
  
  // Parse travelers JSON for each booking
  return rows.map(row => ({
    ...row,
    travelers: JSON.parse(row.travelers) as Traveler[]
  }));
}

// Get booking by ID
export function getBookingById(id: string): BookingRequest | undefined {
  const stmt = db.prepare('SELECT * FROM booking_requests WHERE id = ?');
  const row = stmt.get(id) as BookingRow | undefined;
  
  if (!row) return undefined;
  
  return {
    ...row,
    travelers: JSON.parse(row.travelers) as Traveler[]
  };
}

// Update booking status
export function updateBookingStatus(id: string, status: BookingRequest['status']) {
  const stmt = db.prepare('UPDATE booking_requests SET status = ? WHERE id = ?');
  const result = stmt.run(status, id);
  return result.changes > 0;
}

// Update booking notes
export function updateBookingNotes(id: string, notes: string) {
  const stmt = db.prepare('UPDATE booking_requests SET notes = ? WHERE id = ?');
  const result = stmt.run(notes, id);
  return result.changes > 0;
}

// Delete booking (optional)
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

// Generate invoice number (format: RE-2027-0001)
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

// Create invoice
export function createInvoice(
  bookingId: string,
  items: Omit<InvoiceItem, 'id' | 'invoice_id'>[],
  dueInDays: number = 14
): Invoice {
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = generateInvoiceNumber();
  const now = new Date().toISOString();
  const invoiceDate = now;
  const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString();
  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

  // Insert invoice
  const invoiceStmt = db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, booking_id, created_at, invoice_date, due_date,
      total_amount, paid_amount, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  invoiceStmt.run(
    invoiceId, invoiceNumber, bookingId, now, invoiceDate, dueDate,
    totalAmount, 0, 'open', ''
  );

  // Insert invoice items
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

// Get all invoices
export function getAllInvoices(): Invoice[] {
  const stmt = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC');
  return stmt.all() as Invoice[];
}

// Get invoice by ID
export function getInvoiceById(id: string): Invoice | undefined {
  const stmt = db.prepare('SELECT * FROM invoices WHERE id = ?');
  return stmt.get(id) as Invoice | undefined;
}

// Get invoices by booking ID
export function getInvoicesByBookingId(bookingId: string): Invoice[] {
  const stmt = db.prepare('SELECT * FROM invoices WHERE booking_id = ? ORDER BY created_at DESC');
  return stmt.all(bookingId) as Invoice[];
}

// Get invoice items
export function getInvoiceItems(invoiceId: string): InvoiceItem[] {
  const stmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
  return stmt.all(invoiceId) as InvoiceItem[];
}

// Update invoice status
export function updateInvoiceStatus(id: string, status: Invoice['status']) {
  const stmt = db.prepare('UPDATE invoices SET status = ? WHERE id = ?');
  const result = stmt.run(status, id);
  return result.changes > 0;
}

// Record payment
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

export default db;
