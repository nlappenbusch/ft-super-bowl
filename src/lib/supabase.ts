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
  /** Verknüpfter Kundenstammsatz (customers.id). */
  customer_id?: string | null;
  /** Anzeige-Reisezeitraum, beim Anlegen aus dem Package fixiert (z.B. "Do. 11.02. – Mo. 15.02.2027 · 4 Nächte"). */
  travel_period?: string;
  // Anzeige-Felder aus dem Customer-JOIN (nur lesend, nicht persistiert):
  customer_name?: string;
  customer_salutation?: string;
  customer_street?: string;
  customer_zip?: string;
  customer_city?: string;
  customer_country?: string;
  /** Affiliate-/Herkunfts-Quelle: Host der einbettenden Website (WP-Shortcode). */
  source?: string;
  offer_sent?: number;
  docs_ready?: number;
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
