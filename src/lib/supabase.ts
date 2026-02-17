// Database types
export interface BookingRequest {
  id: string;
  created_at: string;
  package_id: string;
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
