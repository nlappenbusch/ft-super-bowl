import {
  insertBooking,
  getAllBookings,
  updateBookingStatus,
  ensureBookingNumber,
  updateBookingNotes,
  updateBookingAssignee,
  updateBookingMilestones,
  getBookingById,
  getNextRequestNumber,
  insertMessage,
  getMessagesByBooking,
  findBookingByRequestNumber as findBookingByRequestNumberSqlite,
  messageExistsByGraphId,
} from './database';
import type { Traveler, BookingMessage } from './supabase';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getEventBySlug, getPackageBySlug } from './eventData';

/** Nächste fortlaufende Anfragenummer "RQ-12345" (DB-agnostisch). */
async function nextRequestNumber(): Promise<string> {
  if (!isSupabaseConfigured() || !supabase) {
    return getNextRequestNumber();
  }
  // Postgres-Sequenz via RPC (siehe supabase-setup.sql: next_request_number())
  const { data, error } = await supabase.rpc('next_request_number');
  if (error || !data) {
    console.warn('[RQ] RPC next_request_number fehlgeschlagen, nutze Fallback:', error?.message);
    return `RQ-${Date.now().toString().slice(-7)}`;
  }
  return String(data);
}

export interface BookingInput {
  eventSlug?: string | null;
  packageSlug?: string | null;
  packageId: string;
  packageTitle: string;
  startDate: string;
  numberOfPersons: number;
  doubleRooms: number;
  singleRooms: number;
  travelers: Traveler[];
  email: string;
  phone: string;
  message?: string;
  totalPrice: number;
  /** Affiliate-/Herkunfts-Quelle (Host der einbettenden Website), wird in notes gespeichert. */
  source?: string;
}

export async function createBooking(input: BookingInput) {
  if (!isSupabaseConfigured() || !supabase) {
    return insertBooking({
      package_id: input.packageId,
      package_title: input.packageTitle,
      start_date: input.startDate,
      number_of_persons: input.numberOfPersons,
      double_rooms: input.doubleRooms,
      single_rooms: input.singleRooms,
      travelers: JSON.stringify(input.travelers),
      email: input.email,
      phone: input.phone,
      message: input.message || '',
      status: 'new',
      total_price: input.totalPrice || 0,
      notes: input.source ? 'Quelle: ' + input.source : ''
    } as any);
  }

  const event = input.eventSlug ? await getEventBySlug(input.eventSlug) : null;
  const packageRecord = input.eventSlug && input.packageSlug
    ? await getPackageBySlug(input.eventSlug, input.packageSlug)
    : null;

  const payload = {
    request_number: await nextRequestNumber(),
    event_id: event?.id || null,
    event_slug: input.eventSlug || null,
    package_id: packageRecord?.id || null,
    package_slug: input.packageSlug || null,
    package_title: input.packageTitle,
    start_date: input.startDate,
    number_of_persons: input.numberOfPersons,
    double_rooms: input.doubleRooms,
    single_rooms: input.singleRooms,
    travelers: input.travelers,
    email: input.email,
    phone: input.phone,
    message: input.message || '',
    status: 'new',
    total_price: input.totalPrice || 0,
    notes: ''
  };

  const { data, error } = await supabase
    .from('booking_requests')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function listBookings() {
  if (!isSupabaseConfigured() || !supabase) {
    return getAllBookings();
  }

  const { data, error } = await supabase
    .from('booking_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function updateBooking(id: string, updates: { status?: string; notes?: string; assigned_to?: string | null; offer_sent?: boolean; docs_ready?: boolean }) {
  if (!isSupabaseConfigured() || !supabase) {
    if (updates.status && ['new', 'in_progress', 'booked', 'rejected'].includes(updates.status)) {
      await updateBookingStatus(id, updates.status as 'new' | 'in_progress' | 'booked' | 'rejected');
    }
    if (updates.status === 'booked') {
      await ensureBookingNumber(id);
    }
    if (updates.notes !== undefined) {
      await updateBookingNotes(id, updates.notes);
    }
    if (updates.assigned_to !== undefined) {
      await updateBookingAssignee(id, updates.assigned_to);
    }
    if (updates.offer_sent !== undefined || updates.docs_ready !== undefined) {
      await updateBookingMilestones(id, { offer_sent: updates.offer_sent, docs_ready: updates.docs_ready });
    }
    return getBookingById(id);
  }

  const { data, error } = await supabase
    .from('booking_requests')
    .update({
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      ...(updates.assigned_to !== undefined ? { assigned_to: updates.assigned_to } : {}),
      ...(updates.offer_sent !== undefined ? { offer_sent: updates.offer_sent ? 1 : 0 } : {}),
      ...(updates.docs_ready !== undefined ? { docs_ready: updates.docs_ready ? 1 : 0 } : {})
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getBooking(id: string) {
  if (!isSupabaseConfigured() || !supabase) {
    return getBookingById(id);
  }

  const { data, error } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/* ─── CRM-Konversation (E-Mail-Verlauf pro Anfrage) ───────────────────── */

export async function addMessage(
  msg: Omit<BookingMessage, 'id' | 'created_at'>
): Promise<BookingMessage> {
  if (!isSupabaseConfigured() || !supabase) {
    return insertMessage(msg);
  }
  const { data, error } = await supabase
    .from('booking_messages')
    .insert(msg)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as BookingMessage;
}

export async function listMessages(bookingId: string): Promise<BookingMessage[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return getMessagesByBooking(bookingId);
  }
  const { data, error } = await supabase
    .from('booking_messages')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as BookingMessage[];
}

export async function findBookingByRequestNumber(requestNumber: string) {
  if (!isSupabaseConfigured() || !supabase) {
    return findBookingByRequestNumberSqlite(requestNumber);
  }
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('request_number', requestNumber)
    .limit(1)
    .maybeSingle();
  if (error) return undefined;
  return data || undefined;
}

export async function graphMessageExists(graphId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return messageExistsByGraphId(graphId);
  }
  const { data } = await supabase
    .from('booking_messages')
    .select('id')
    .eq('graph_message_id', graphId)
    .limit(1)
    .maybeSingle();
  return !!data;
}
