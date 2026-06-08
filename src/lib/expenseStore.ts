import {
  createExpense as createExpenseSqlite,
  getAllExpenses as getAllExpensesSqlite,
  getExpenseById as getExpenseByIdSqlite,
  updateExpense as updateExpenseSqlite,
  deleteExpense as deleteExpenseSqlite,
  type Expense,
  type ExpenseInput,
} from './database';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export type { Expense, ExpenseInput } from './database';

export interface ExpenseFilter {
  eventSlug?: string | null;
  bookingId?: string | null;
}

export async function createExpenseRecord(input: Partial<ExpenseInput>) {
  if (!isSupabaseConfigured() || !supabase) {
    return createExpenseSqlite(input);
  }

  const payload = {
    expense_date: input.expense_date || new Date().toISOString(),
    event_slug: input.event_slug || '',
    booking_id: input.booking_id || '',
    category: input.category || 'sonstiges',
    description: input.description || '',
    vendor: input.vendor || '',
    amount: Number(input.amount) || 0,
    notes: input.notes || '',
  };

  const { data, error } = await supabase
    .from('expenses')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Expense;
}

export async function listExpenses(filter?: ExpenseFilter): Promise<Expense[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return getAllExpensesSqlite({
      eventSlug: filter?.eventSlug || undefined,
      bookingId: filter?.bookingId || undefined,
    });
  }

  let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false });
  if (filter?.bookingId) query = query.eq('booking_id', filter.bookingId);
  else if (filter?.eventSlug) query = query.eq('event_slug', filter.eventSlug);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as Expense[]) || [];
}

export async function getExpense(id: string): Promise<Expense | null | undefined> {
  if (!isSupabaseConfigured() || !supabase) {
    return getExpenseByIdSqlite(id);
  }
  const { data, error } = await supabase.from('expenses').select('*').eq('id', id).single();
  if (error) return null;
  return data as Expense;
}

export async function updateExpenseRecord(id: string, updates: Partial<ExpenseInput>) {
  if (!isSupabaseConfigured() || !supabase) {
    return updateExpenseSqlite(id, updates);
  }
  const { error } = await supabase.from('expenses').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function deleteExpenseRecord(id: string) {
  if (!isSupabaseConfigured() || !supabase) {
    return deleteExpenseSqlite(id);
  }
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}
