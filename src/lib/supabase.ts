// Database types
export interface BookingRequest {
  id: string;
  created_at: string;
  request_number?: string | null;
  event_id?: string | null;
  event_slug?: string | null;
  package_id: string;
  package_slug?: string | null;
  package_title: string;
  start_date: string;
  number_of_persons: number;
  double_rooms: number;
  single_rooms: number;
  travelers: Traveler[];
  email: string;
  phone: string;
  message?: string;
  status: 'new' | 'in_progress' | 'booked' | 'rejected';
  total_price: number;
  notes?: string;
}

export interface Traveler {
  salutation: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  passportNumber?: string;
}

/** Conversation message linked to a booking request (CRM email thread) */
export interface BookingMessage {
  id: string;
  booking_id: string;
  created_at: string;
  direction: 'out' | 'in';
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  graph_message_id?: string | null;
}
