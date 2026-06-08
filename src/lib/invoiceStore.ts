import {
  createInvoice as createInvoiceSqlite,
  getAllInvoices as getAllInvoicesSqlite,
  getInvoiceById as getInvoiceByIdSqlite,
  getInvoicesByBookingId as getInvoicesByBookingIdSqlite,
  getInvoiceItems as getInvoiceItemsSqlite,
  updateInvoiceStatus as updateInvoiceStatusSqlite,
  recordPayment as recordPaymentSqlite,
  generateInvoiceNumber as generateInvoiceNumberSqlite
} from './database';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

async function generateInvoiceNumberSupabase() {
  const year = new Date().getFullYear();
  const prefix = `RE-${year}-`;

  if (!supabase) {
    return `${prefix}0001`;
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .single();

  if (error || !data?.invoice_number) {
    return `${prefix}0001`;
  }

  const lastNumber = parseInt(data.invoice_number.split('-')[2], 10);
  const newNumber = (lastNumber + 1).toString().padStart(4, '0');
  return `${prefix}${newNumber}`;
}

export async function createInvoiceRecord(
  bookingId: string,
  items: InvoiceItemInput[],
  dueInDays: number = 14,
  notes: string = ''
) {
  if (!isSupabaseConfigured() || !supabase) {
    return createInvoiceSqlite(bookingId, items, dueInDays, notes);
  }

  const invoiceNumber = await generateInvoiceNumberSupabase();
  const now = new Date();
  const invoiceDate = now.toISOString();
  const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString();
  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      booking_id: bookingId,
      invoice_date: invoiceDate,
      due_date: dueDate,
      total_amount: totalAmount,
      paid_amount: 0,
      status: 'open',
      notes: notes || ''
    })
    .select('*')
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message || 'Failed to create invoice');
  }

  const itemsPayload = items.map((item) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price
  }));

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemsPayload);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return invoice;
}

export async function listInvoices(bookingId?: string | null) {
  if (!isSupabaseConfigured() || !supabase) {
    return bookingId
      ? getInvoicesByBookingIdSqlite(bookingId)
      : getAllInvoicesSqlite();
  }

  const query = supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  const { data, error } = bookingId
    ? await query.eq('booking_id', bookingId)
    : await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getInvoiceById(id: string) {
  if (!isSupabaseConfigured() || !supabase) {
    return getInvoiceByIdSqlite(id);
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getInvoiceItems(id: string) {
  if (!isSupabaseConfigured() || !supabase) {
    return getInvoiceItemsSqlite(id);
  }

  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function updateInvoiceStatus(id: string, status: string) {
  if (!isSupabaseConfigured() || !supabase) {
    return updateInvoiceStatusSqlite(id, status as any);
  }

  const { data, error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function recordPayment(id: string, amount: number) {
  if (!isSupabaseConfigured() || !supabase) {
    return recordPaymentSqlite(id, amount);
  }

  const invoice = await getInvoiceById(id);
  if (!invoice) return false;

  const newPaidAmount = Number(invoice.paid_amount || 0) + amount;
  let newStatus = 'open';

  if (newPaidAmount >= Number(invoice.total_amount)) {
    newStatus = 'paid';
  } else if (newPaidAmount > 0) {
    newStatus = 'partial';
  }

  const { error } = await supabase
    .from('invoices')
    .update({ paid_amount: newPaidAmount, status: newStatus })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export function generateInvoiceNumber() {
  if (!isSupabaseConfigured()) {
    return generateInvoiceNumberSqlite();
  }
  return undefined;
}
