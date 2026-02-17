-- Supabase SQL Setup für Buchungsanfragen
-- Kopieren Sie diesen Code in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Tabelle für Buchungsanfragen erstellen
CREATE TABLE IF NOT EXISTS booking_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  package_id TEXT NOT NULL,
  package_title TEXT NOT NULL,
  start_date DATE NOT NULL,
  number_of_persons INTEGER NOT NULL,
  double_rooms INTEGER NOT NULL DEFAULT 0,
  single_rooms INTEGER NOT NULL DEFAULT 0,
  travelers JSONB NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'booked', 'rejected')),
  total_price NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON booking_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_email ON booking_requests(email);

-- Automatisches Update des updated_at Feldes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_booking_requests_updated_at BEFORE UPDATE ON booking_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) aktivieren
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Alle können lesen (für Admin Dashboard)
CREATE POLICY "Enable read access for all users" ON booking_requests FOR SELECT USING (true);

-- Policy: Alle können einfügen (für Booking-Form)
CREATE POLICY "Enable insert for all users" ON booking_requests FOR INSERT WITH CHECK (true);

-- Policy: Alle können updaten (für Admin Dashboard - in Produktion besser absichern)
CREATE POLICY "Enable update for all users" ON booking_requests FOR UPDATE USING (true);

-- Testdaten einfügen (optional)
INSERT INTO booking_requests (
  package_id,
  package_title,
  start_date,
  number_of_persons,
  double_rooms,
  single_rooms,
  travelers,
  email,
  phone,
  message,
  status,
  total_price
) VALUES (
  'dream_hollywood',
  'Dream Hollywood, by Hyatt',
  '2027-02-12',
  2,
  1,
  0,
  '[{"salutation":"herr","firstName":"Max","lastName":"Mustermann","birthDate":"1985-05-15","passportNumber":""},{"salutation":"frau","firstName":"Maria","lastName":"Musterfrau","birthDate":"1987-08-20","passportNumber":""}]'::jsonb,
  'max.mustermann@example.com',
  '+41 79 123 45 67',
  'Wir freuen uns sehr auf den Super Bowl!',
  'new',
  17900.00
);

-- Erfolgsmeldung
SELECT 'Tabelle booking_requests erfolgreich erstellt!' as message;
