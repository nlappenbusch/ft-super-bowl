-- Supabase SQL Setup fuer Multi-Event Daten
-- Kopieren Sie diesen Code in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  venue TEXT,
  location_name TEXT,
  location_city TEXT,
  location_region TEXT,
  location_country TEXT,
  hero_image TEXT,
  ticket_image TEXT,
  base_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

-- Packages pro Event
CREATE TABLE IF NOT EXISTS packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  package_name TEXT,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  hotel TEXT,
  stars INTEGER,
  nights INTEGER,
  price NUMERIC(10, 2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  single_supplement NUMERIC(10, 2),
  popular BOOLEAN NOT NULL DEFAULT false,
  available_spots INTEGER,
  rating NUMERIC(3, 1),
  reviews INTEGER,
  hotel_images TEXT[],
  distances JSONB,
  room_categories TEXT[],
  extension_nights TEXT,
  badge_text TEXT,
  UNIQUE(event_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_packages_event_id ON packages(event_id);

-- Package Inhalte
CREATE TABLE IF NOT EXISTS package_includes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  type TEXT,
  name TEXT NOT NULL,
  category TEXT,
  status TEXT,
  icon TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_package_includes_package_id ON package_includes(package_id);

-- FAQs pro Event
CREATE TABLE IF NOT EXISTS event_faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_event_faqs_event_id ON event_faqs(event_id);

-- Buchungsanfragen
CREATE TABLE IF NOT EXISTS booking_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  event_slug TEXT,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  package_slug TEXT,
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

-- Rechnungen
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'cancelled')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL
);

-- Fehlende Spalten bei bestehenden Installationen nachziehen
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS event_slug TEXT;
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS package_id UUID;
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS package_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON booking_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_email ON booking_requests(email);
CREATE INDEX IF NOT EXISTS idx_booking_requests_event_id ON booking_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

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
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_includes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Policies: Lesen fuer alle (Public Content)
CREATE POLICY "Enable read access for events" ON events FOR SELECT USING (true);
CREATE POLICY "Enable read access for packages" ON packages FOR SELECT USING (true);
CREATE POLICY "Enable read access for package includes" ON package_includes FOR SELECT USING (true);
CREATE POLICY "Enable read access for event faqs" ON event_faqs FOR SELECT USING (true);

-- Policies: Buchungen
CREATE POLICY "Enable read access for bookings" ON booking_requests FOR SELECT USING (true);
CREATE POLICY "Enable insert for bookings" ON booking_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for bookings" ON booking_requests FOR UPDATE USING (true);
CREATE POLICY "Enable read access for invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Enable insert for invoices" ON invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for invoices" ON invoices FOR UPDATE USING (true);
CREATE POLICY "Enable read access for invoice items" ON invoice_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for invoice items" ON invoice_items FOR INSERT WITH CHECK (true);

-- Seed-Daten: Super Bowl 2027
WITH upsert_event AS (
  INSERT INTO events (
    slug,
    name,
    title,
    description,
    start_date,
    end_date,
    venue,
    location_name,
    location_city,
    location_region,
    location_country,
    hero_image,
    ticket_image,
    base_url
  ) VALUES (
    'super-bowl-2027',
    'Super Bowl LXI',
    'Super Bowl LXI 2027 Tickets & Packages',
    'NFL Super Bowl LXI 2027 in Los Angeles',
    '2027-02-07',
    '2027-02-07',
    'SoFi Stadium',
    'SoFi Stadium',
    'Inglewood',
    'CA',
    'US',
    'https://superbowl.faltintravel.com/header-neu1260-1.webp',
    'https://superbowl.faltintravel.com/Super-Bowl-2027-Ticketkategorien-SoFi-Stadium.webp',
    'https://superbowl.faltintravel.com'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue,
    location_name = EXCLUDED.location_name,
    location_city = EXCLUDED.location_city,
    location_region = EXCLUDED.location_region,
    location_country = EXCLUDED.location_country,
    hero_image = EXCLUDED.hero_image,
    ticket_image = EXCLUDED.ticket_image,
    base_url = EXCLUDED.base_url
  RETURNING id
), upsert_package AS (
  INSERT INTO packages (
    event_id,
    slug,
    package_name,
    title,
    short_description,
    description,
    hotel,
    stars,
    nights,
    price,
    currency,
    single_supplement,
    popular,
    available_spots,
    rating,
    reviews,
    hotel_images,
    distances,
    room_categories,
    extension_nights,
    badge_text
  )
  SELECT
    upsert_event.id,
    'dream-hollywood',
    'Ticket- & Hotel-Package',
    'Dream Hollywood, by Hyatt',
    'Boutique-Hotel im Herzen von Hollywood mit Rooftop-Pool und Blick auf das Hollywood Sign',
    'Boutique-Hotel im Herzen von Hollywood mit Rooftop-Pool und Blick auf das Hollywood Sign',
    'Dream Hollywood, by Hyatt',
    4,
    4,
    8950.00,
    'EUR',
    1485.00,
    true,
    12,
    4.8,
    156,
    ARRAY[
      'https://superbowl.faltintravel.com/bilder-hotel/540997872.jpg',
      'https://superbowl.faltintravel.com/bilder-hotel/540998091.jpg',
      'https://superbowl.faltintravel.com/bilder-hotel/568783347.jpg'
    ],
    '{"airport":"40 Min. / ca. 30 km (LAX)","stadium":"35 Min. / ca. 29 km (SoFi Stadium)","downtown":"20 Min. / ca. 11 km"}'::jsonb,
    ARRAY['Doppelzimmer','Einzelzimmer'],
    'Verlaengerungsnaechte auf Anfrage gegen Aufpreis buchbar',
    'Offizielles Hospitality-Package'
  FROM upsert_event
  ON CONFLICT (event_id, slug) DO UPDATE SET
    package_name = EXCLUDED.package_name,
    title = EXCLUDED.title,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description,
    hotel = EXCLUDED.hotel,
    stars = EXCLUDED.stars,
    nights = EXCLUDED.nights,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    single_supplement = EXCLUDED.single_supplement,
    popular = EXCLUDED.popular,
    available_spots = EXCLUDED.available_spots,
    rating = EXCLUDED.rating,
    reviews = EXCLUDED.reviews,
    hotel_images = EXCLUDED.hotel_images,
    distances = EXCLUDED.distances,
    room_categories = EXCLUDED.room_categories,
    extension_nights = EXCLUDED.extension_nights,
    badge_text = EXCLUDED.badge_text
  RETURNING id
)
INSERT INTO package_includes (
  package_id,
  type,
  name,
  category,
  status,
  icon,
  description,
  sort_order
)
SELECT
  upsert_package.id,
  include_data.type,
  include_data.name,
  include_data.category,
  include_data.status,
  include_data.icon,
  include_data.description,
  include_data.sort_order
FROM upsert_package,
LATERAL (
  VALUES
    ('ticket', 'Super Bowl LXI Premium Ticket', '500er Level (Lower Bowl)', 'OK', 'ticket', 'Offizielles NFL Premium-Ticket mit VIP-Zugang', 1),
    ('hotel', 'Dream Hollywood, by Hyatt', '4-Sterne Superior', 'OK', 'hotel', 'Boutique-Hotel mit Rooftop-Pool und Hollywood Sign Blick', 2),
    ('transfer', 'Flughafen-Hotel-Stadium Transfers', 'Hin- und Rueckfahrt', 'OK', 'transfer', 'Komfortable Shuttles zu allen wichtigen Locations', 3),
    ('hospitality', 'VIP Pregame-Party', 'Inkl. Catering & Getraenke', 'OK', 'hospitality', 'Exklusiver Zugang zur offiziellen Pregame-Party', 4)
) AS include_data(type, name, category, status, icon, description, sort_order)
ON CONFLICT DO NOTHING;

WITH event_ref AS (
  SELECT id FROM events WHERE slug = 'super-bowl-2027' LIMIT 1
)
INSERT INTO event_faqs (event_id, question, answer, sort_order)
SELECT
  event_ref.id,
  faq.question,
  faq.answer,
  faq.sort_order
FROM event_ref,
LATERAL (
  VALUES
    ('Sind meine Plaetze nebeneinander?', 'Ja, bei Buchungen werden die Sitzplaetze im gleichen Block reserviert.', 1),
    ('Wie kann ich bezahlen?', 'Zahlung per Ueberweisung auf unser Schweizer Bankkonto (CHF oder EUR moeglich).', 2),
    ('Was ist das Hospitality-Package?', 'Das Package beinhaltet VIP-Eingang, offizielle Pregame-Party mit Catering & Getraenken, Live-Entertainment und reservierte Sitzplaetze im 500er Level.', 3)
) AS faq(question, answer, sort_order)
ON CONFLICT DO NOTHING;

-- Testdaten fuer Buchungsanfragen (optional)
INSERT INTO booking_requests (
  event_id,
  event_slug,
  package_id,
  package_slug,
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
  (SELECT id FROM events WHERE slug = 'super-bowl-2027' LIMIT 1),
  'super-bowl-2027',
  (SELECT id FROM packages WHERE slug = 'dream-hollywood' LIMIT 1),
  'dream-hollywood',
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
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION: "Unsere Leistungen"-Modul pro Event
-- ============================================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_leistungen BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS leistungen_title TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS leistungen_image TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS leistungen_items JSONB DEFAULT '[]'::jsonb;

-- "Unsere Tickets" (Ticket-Kategorien in Reitern)
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_ticket_categories BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_categories_title TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_categories_intro TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_categories JSONB DEFAULT '[]'::jsonb;

-- SEO: kurzes URL-Segment je Event + Serien-Hub-Inhalte
ALTER TABLE events ADD COLUMN IF NOT EXISTS url_segment TEXT;
ALTER TABLE series ADD COLUMN IF NOT EXISTS intro_text TEXT;
ALTER TABLE series ADD COLUMN IF NOT EXISTS highlights JSONB DEFAULT '[]'::jsonb;
ALTER TABLE series ADD COLUMN IF NOT EXISTS seo_text TEXT;

-- ============================================================================
-- MIGRATION: RQ-Anfragenummern + CRM-Konversation (E-Mail-Thread)
-- Idempotent – kann gefahrlos erneut ausgeführt werden.
-- ============================================================================

-- 1) Fortlaufende Anfragenummer auf booking_requests
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS request_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_requests_request_number
  ON booking_requests(request_number) WHERE request_number IS NOT NULL;

-- 2) Sequenz + Funktion, die "RQ-12345" liefert (Start bei 10001)
CREATE SEQUENCE IF NOT EXISTS request_number_seq START WITH 10001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION next_request_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'RQ-' || nextval('request_number_seq')::text;
$$;

-- RPC für anon/service-Rolle aufrufbar machen
GRANT EXECUTE ON FUNCTION next_request_number() TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE request_number_seq TO anon, authenticated, service_role;

-- 3) Konversations-Nachrichten (ein-/ausgehende E-Mails pro Anfrage)
CREATE TABLE IF NOT EXISTS booking_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('out','in')),
  from_email TEXT NOT NULL DEFAULT '',
  to_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  graph_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id ON booking_messages(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_messages_graph_id
  ON booking_messages(graph_message_id) WHERE graph_message_id IS NOT NULL;

ALTER TABLE booking_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for messages" ON booking_messages;
DROP POLICY IF EXISTS "Enable insert for messages" ON booking_messages;
CREATE POLICY "Enable read access for messages" ON booking_messages FOR SELECT USING (true);
CREATE POLICY "Enable insert for messages" ON booking_messages FOR INSERT WITH CHECK (true);

SELECT 'Supabase Multi-Event Setup erfolgreich erstellt!' as message;
