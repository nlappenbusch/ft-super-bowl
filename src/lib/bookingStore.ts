import { insertBooking, getAllBookings, updateBookingStatus, updateBookingNotes, getBookingById } from './database';
import type { Traveler } from './supabase';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getEventBySlug, getPackageBySlug } from './eventData';

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
      notes: ''
    } as any);
  }

  const event = input.eventSlug ? await getEventBySlug(input.eventSlug) : null;
  const packageRecord = input.eventSlug && input.packageSlug
    ? await getPackageBySlug(input.eventSlug, input.packageSlug)
    : null;

  const payload = {
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

export async function updateBooking(id: string, updates: { status?: string; notes?: string }) {
  if (!isSupabaseConfigured() || !supabase) {
    if (updates.status && ['new', 'in_progress', 'booked', 'rejected'].includes(updates.status)) {
      updateBookingStatus(id, updates.status as 'new' | 'in_progress' | 'booked' | 'rejected');
    }
    if (updates.notes !== undefined) {
      updateBookingNotes(id, updates.notes);
    }
    return getBookingById(id);
  }

  const { data, error } = await supabase
    .from('booking_requests')
    .update({
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {})
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
