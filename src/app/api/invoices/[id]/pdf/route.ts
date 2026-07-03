import { NextResponse } from 'next/server';
import { getInvoiceById, getInvoiceItems, getBookingById } from '@/lib/database';
import { findEventBySlug, findPackagesByEvent, getPackages, getEvents } from '@/lib/contentStore';
import { getCustomer, normalizeSalutation } from '@/lib/customerStore';
import { getSettings } from '@/lib/settingsStore';
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Rechnung nicht gefunden' },
        { status: 404 }
      );
    }

    const items = await getInvoiceItems(id);
    const booking = await getBookingById(invoice.booking_id);
    // Rechnungsempfaenger: Kundenstammdaten (inkl. Adresse aus dem Buchungsformular)
    const customer = booking?.customer_id ? await getCustomer(booking.customer_id) : null;

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Buchung nicht gefunden' },
        { status: 404 }
      );
    }

    // ─── Load settings & event data dynamically ───────────────────────────
    const settings = getSettings();
    const company = settings.company;
    const bank = settings.bank;
    const inv = settings.invoice;

    // Parse PDF meta from invoice.notes (set by admin when creating invoice)
    let noteMeta: {
      event_name?: string;
      destination?: string;
      hotel_description?: string;
      ticket_details?: string;
      thank_you_text?: string;
    } = {};
    try {
      if (invoice.notes) {
        noteMeta = JSON.parse(invoice.notes);
      }
    } catch { /* ignore parse errors */ }

    // Try to find the real event from booking's event_slug
    let eventRecord = booking.event_slug ? findEventBySlug(booking.event_slug) : null;
    const eventPackages = eventRecord ? findPackagesByEvent(eventRecord.id) : [];
    let bookedPackage = eventPackages.find((p: any) => p.slug === booking.package_slug || p.title === booking.package_title);
    // Fallback für Bestandsbuchungen ohne gespeicherte Slugs: Package über
    // Slug/Titel global suchen, Event über dessen event_id herleiten.
    if (!bookedPackage) {
      bookedPackage = (getPackages() as any[]).find((p: any) =>
        (booking.package_slug && p.slug === booking.package_slug) || p.title === booking.package_title);
      if (bookedPackage && !eventRecord) {
        eventRecord = (getEvents() as any[]).find((e: any) => e.id === (bookedPackage as any).event_id) || null;
      }
    }

    // Build event display strings — noteMeta (admin edits) wins over auto-lookup
    const eventName = noteMeta.event_name ||
      eventRecord?.name || eventRecord?.title || booking.event_slug || 'Sport-Event';
    const destination = noteMeta.destination || [
      eventRecord?.location_name || eventRecord?.venue,
      eventRecord?.location_city,
      eventRecord?.location_country
    ].filter(Boolean).join(', ') || 'auf Anfrage';
    const hotelDescription = noteMeta.hotel_description ||
      bookedPackage?.title || booking.package_title || 'Unterbringung gemäß Package';

    // Ticket detail bullet points — from noteMeta or default list
    const ticketDetailLines: string[] = noteMeta.ticket_details
      ? noteMeta.ticket_details.split('\n').map((l: string) => l.trim()).filter(Boolean)
      : [
          'Kategorie 1 Sitzplatz im Unterrang',
          'Inkl. Zutritt zum VIP-Bereich mit Catering & Getränken',
          'Inkl. Faltin Travel Lanyard',
          'Inkl. detaillierte Reiseinformation & Schweizer Reisegarantie',
        ];

    // Dates: use event's start/end or booking's start_date
    const baseCheckIn = eventRecord?.start_date
      ? new Date(eventRecord.start_date)
      : booking.start_date ? new Date(booking.start_date) : new Date();
    const baseCheckOut = eventRecord?.end_date
      ? new Date(eventRecord.end_date)
      : baseCheckIn;

    // ─── Extra nights calculation (generic) ──────────────────────────────────
    const extraNightsBefore = items.filter(item => 
      item.description.toLowerCase().includes('zusatznacht') &&
      item.description.toLowerCase().includes('vorab')
    );
    const extraNightsAfter = items.filter(item => 
      item.description.toLowerCase().includes('zusatznacht') &&
      item.description.toLowerCase().includes('verlängerung')
    );
    
    const nightsBefore = extraNightsBefore.reduce((sum, item) => sum + item.quantity, 0);
    const nightsAfter = extraNightsAfter.reduce((sum, item) => sum + item.quantity, 0);
    
    // Angepasste Check-in/Check-out mit Zusatznächten
    const adjustedCheckIn = new Date(baseCheckIn);
    adjustedCheckIn.setDate(adjustedCheckIn.getDate() - nightsBefore);
    
    const adjustedCheckOut = new Date(baseCheckOut);
    adjustedCheckOut.setDate(adjustedCheckOut.getDate() + nightsAfter);
    
    // Formatierung für Anzeige
    const formatDate = (date: Date) => {
      const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      const day = days[date.getDay()];
      const dateStr = date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
      return `${day}. ${dateStr}.`;
    };
    
    const checkInFormatted = formatDate(adjustedCheckIn);
    const checkOutFormatted = formatDate(adjustedCheckOut);
    const msPerDay = 1000 * 60 * 60 * 24;
    const baseNights = Math.max(1, Math.round((baseCheckOut.getTime() - baseCheckIn.getTime()) / msPerDay));
    const totalNights = baseNights + nightsBefore + nightsAfter;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    
    let currentY = 12;
    const leftMargin = 20;
    const rightMargin = 130; // Rechte Spalte für Firmenadresse

    let faltinLogoBase64 = '';
    const logoFile = company.logo_path?.replace(/^\//, '') || 'faltin_logo_black-1 (2).png';
    try {
      const logoPath = path.join(process.cwd(), 'public', logoFile);
      if (fs.existsSync(logoPath)) {
        const logoData = fs.readFileSync(logoPath);
        faltinLogoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
        doc.addImage(faltinLogoBase64, 'PNG', leftMargin, currentY, 60, 0);
      } else {
        doc.setFontSize(16);
        doc.setTextColor(24, 74, 123);
        doc.setFont('helvetica', 'bold');
        doc.text(company.name, leftMargin, currentY);
      }
    } catch {
      doc.setFontSize(16);
      doc.setTextColor(24, 74, 123);
      doc.setFont('helvetica', 'bold');
      doc.text(company.name, leftMargin, currentY);
    }
    
    // Firmenadresse rechts oben
    let firmY = 15;
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`${company.name}${company.legal_form ? ' ' + company.legal_form : ''}`, rightMargin, firmY);
    firmY += 3;
    doc.setFont('helvetica', 'normal');
    doc.text(company.street, rightMargin, firmY);
    firmY += 3;
    doc.text(`${company.zip} ${company.city}, ${company.country}`, rightMargin, firmY);
    firmY += 3;
    if (company.phone) { doc.text(`TEL ${company.phone}`, rightMargin, firmY); firmY += 3; }
    if (company.fax)   { doc.text(`FAX ${company.fax}`, rightMargin, firmY);   firmY += 3; }
    if (company.email) { doc.text(company.email, rightMargin, firmY); firmY += 3; }
    if (company.website) { doc.text(company.website, rightMargin, firmY); }

    currentY = 48;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const absenderText = `${company.name} · ${company.street} · ${company.zip} ${company.city}`;
    doc.text(absenderText, leftMargin, currentY);
    // Unterstreichung der Absenderzeile
    const absenderWidth = doc.getTextWidth(absenderText);
    doc.setLineWidth(0.1);
    doc.line(leftMargin, currentY + 0.5, leftMargin + absenderWidth, currentY + 0.5);
    
    // Kundenadresse LINKS (unter der Absenderzeile)
    currentY = 55; // Von 63 auf 55 - höher beginnen
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const traveler = booking.travelers[0];
    const recipientName = (customer?.name || [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim())
      || `${traveler.firstName} ${traveler.lastName}`.trim();
    const recipientLine1 = [normalizeSalutation(customer?.salutation), recipientName].filter(Boolean).join(' ');
    doc.text(recipientLine1, leftMargin, currentY);
    currentY += 4;
    if (customer?.street) { doc.text(customer.street, leftMargin, currentY); currentY += 4; }
    const zipCity = [customer?.zip, customer?.city].filter(Boolean).join(' ');
    if (zipCity) { doc.text(customer?.country ? `${zipCity}, ${customer.country}` : zipCity, leftMargin, currentY); currentY += 4; }
    doc.text(booking.email, leftMargin, currentY);
    currentY += 4;
    doc.text(booking.phone, leftMargin, currentY);
    currentY += 15; // Von 10 auf 15 - mehr Abstand vor "Bestätigung / Rechnung"

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bestätigung / Rechnung', leftMargin, currentY);
    currentY += 8;

    // Optimierte Rechnungsdetail-Box (alles in einer Zeile)
    doc.setFillColor(245, 245, 245); // Hellgrau
    doc.setDrawColor(200, 200, 200); // Grauer Rahmen
    doc.setLineWidth(0.3);
    doc.rect(leftMargin, currentY - 2, 170, 6, 'FD'); // Kleinere Box, nur 6mm hoch
    
    doc.setFontSize(8);
    const boxY = currentY + 1.5;
    
    // Rechnungsnummer
    doc.setFont('helvetica', 'bold');
    doc.text('Rechnungsnummer:', leftMargin + 2, boxY);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.invoice_number, leftMargin + 30, boxY);
    
    // Rechnungsdatum
    doc.setFont('helvetica', 'bold');
    doc.text('Rechnungsdatum:', leftMargin + 60, boxY);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(invoice.invoice_date).toLocaleDateString('de-CH'), leftMargin + 85, boxY);
    
    // Fälligkeitsdatum
    doc.setFont('helvetica', 'bold');
    doc.text('Fälligkeitsdatum:', leftMargin + 110, boxY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 0, 0); // Rot für Fälligkeit
    doc.text(new Date(invoice.due_date).toLocaleDateString('de-CH'), leftMargin + 140, boxY);
    doc.setTextColor(0, 0, 0); // Zurück zu Schwarz
    
    currentY += 10;
    
    // Reisegarantie-Logo rechts - auf gleicher X-Position wie Absenderadresse
    try {
      const reisegarantiePath = path.join(process.cwd(), 'public', 'reisegarantielogo-de-768x258.webp');
      if (fs.existsSync(reisegarantiePath)) {
        const reisegarantieData = fs.readFileSync(reisegarantiePath);
        const reisegarantieBase64 = reisegarantieData.toString('base64');
        // X=rightMargin (130mm) statt 155mm - gleiche Position wie "Faltin Travel AG"
        doc.addImage(`data:image/webp;base64,${reisegarantieBase64}`, 'WEBP', rightMargin, 38, 45, 0); // Von 35 auf 45mm - größer
      }
    } catch (error) {
      // Ignorieren wenn Logo nicht verfügbar
    }

    const labelX = leftMargin;
    const valueX = leftMargin + 38;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Personenanzahl:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(booking.travelers.length.toString(), valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Reisetermin:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    // Anzeige-Reisezeitraum des Pakets ist die verlaesslichste Quelle;
    // Datums-Arithmetik bleibt Fallback (deckt Zusatznaechte ab).
    const pkgTravelPeriod = (bookedPackage as { travel_period?: string } | undefined)?.travel_period || '';
    const computedRange = `${checkInFormatted}${adjustedCheckIn.getFullYear()} - ${checkOutFormatted}${adjustedCheckOut.getFullYear()}`;
    const extraCount = nightsBefore + nightsAfter;
    const extraNightsNote = extraCount > 0 ? ` (+${extraCount} Zusatznacht${extraCount === 1 ? '' : 'e'})` : '';
    const travelRangeText = pkgTravelPeriod ? `${pkgTravelPeriod}${extraNightsNote}` : computedRange;
    doc.text(travelRangeText, valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Anreise:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('Eigene Anreise', valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Destination:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(destination, valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Hotel:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(hotelDescription, valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Unterbringung:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    const pkgNights = Number((bookedPackage as { nights?: number } | undefined)?.nights || 0);
    const displayNights = (pkgNights > 0 ? pkgNights : baseNights) + nightsBefore + nightsAfter;
    const nightText = displayNights === 1 ? 'Übernachtung' : 'Übernachtungen';
    const dblRooms = Number(booking.double_rooms || 0);
    const sglRooms = Number(booking.single_rooms || 0);
    const occupancy = (dblRooms > 0 || sglRooms > 0)
      ? [dblRooms ? `${dblRooms}× Doppelbelegung` : '', sglRooms ? `${sglRooms}× Einzelbelegung` : ''].filter(Boolean).join(', ')
      : `${Math.ceil(booking.travelers.length / 2)}× Doppelzimmer`;
    doc.text(`${occupancy} · ${displayNights} ${nightText}/Frühstück · ${travelRangeText}`, valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Veranstaltung:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(eventName, valueX, currentY);
    currentY += 5.5;

    // Event date line
    if (eventRecord?.start_date) {
      const evDate = new Date(eventRecord.start_date);
      const evDateStr = evDate.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
      doc.text(`${evDateStr} – ${eventName}${eventRecord?.venue ? ' – ' + eventRecord.venue : ''}`, valueX, currentY);
      currentY += 5.5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Ticketkategorie:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    const pkgIncludes = ((bookedPackage as { includes?: Array<{ type?: string; name?: string; category?: string }> } | undefined)?.includes || []);
    const ticketInclude = pkgIncludes.find((i) => i && i.type === 'ticket' && i.name);
    const ticketLabel = ticketInclude
      ? `${booking.travelers.length}x ${ticketInclude.name}${ticketInclude.category ? ` (${ticketInclude.category})` : ''}`
      : `${booking.travelers.length}x ${booking.package_title}`;
    doc.text(ticketLabel, valueX, currentY);
    currentY += 5;

    ticketDetailLines.forEach((line: string) => {
      doc.text(line, valueX, currentY);

      currentY += 3.8;
    });
    
    currentY += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Reiseteilnehmer:', labelX, currentY);
    
    doc.setFont('helvetica', 'normal');
    booking.travelers.forEach((t: any, index: number) => {
      const sal = String(t.salutation || '').trim().toLowerCase();
      const salutation = sal.startsWith('herr') || sal === 'mr' ? 'Herr' : (sal.startsWith('frau') || sal === 'mrs' || sal === 'ms' ? 'Frau' : '');
      const nameLine = [salutation, t.firstName, t.lastName].filter(Boolean).join(' ').trim();
      doc.text(nameLine || '–', valueX, currentY);
      if (index < booking.travelers.length - 1) currentY += 3.8;
    });
    
    currentY += 6;

    // Rechnungspositionen als Teil der Struktur
    doc.setFont('helvetica', 'bold');
    doc.text('Leistungen:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    
    // Package Position
    const packageItem = items.find((item: any) => 
      item.description.toLowerCase().includes('package') || 
      item.description.toLowerCase().includes('paket')
    );
    
    if (packageItem) {
      const packageLines = packageItem.description.split('\n');
      doc.text(packageLines[0], valueX, currentY);
      currentY += 3.8;
      
      // Zusatzzeilen (z.B. "2 Personen, 1 DZ, 0 EZ") - OHNE Preis
      doc.setFont('helvetica', 'normal');
      for (let i = 1; i < packageLines.length; i++) {
        if (packageLines[i].trim()) {
          doc.text(packageLines[i], valueX, currentY);
          currentY += 3.5;
        }
      }
    }
    
    // Zusatznächte VORAB - nur Beschreibung, kein Preis
    const vorabItems = items.filter((item: any) => 
      item.description.toLowerCase().includes('zusatznacht') &&
      item.description.toLowerCase().includes('vorab')
    );
    
    vorabItems.forEach((item: any) => {
      const lines = item.description.split('\n');
      doc.setFont('helvetica', 'normal');
      doc.text(lines[0], valueX, currentY);
      currentY += 3.5;
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          doc.text(lines[i], valueX, currentY);
          currentY += 3.2;
        }
      }
    });
    
    // Zusatznächte VERLÄNGERUNG - nur Beschreibung, kein Preis
    const verlaengerungItems = items.filter((item: any) => 
      item.description.toLowerCase().includes('zusatznacht') &&
      item.description.toLowerCase().includes('verlängerung')
    );
    
    verlaengerungItems.forEach((item: any) => {
      const lines = item.description.split('\n');
      doc.setFont('helvetica', 'normal');
      doc.text(lines[0], valueX, currentY);
      currentY += 3.5;
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          doc.text(lines[i], valueX, currentY);
          currentY += 3.2;
        }
      }
    });
    
    // Einzelbelegungs-/EZ-Zuschlaege als eigene Kategorie (Stefans Preismodell)
    const surchargeItems = items.filter((item: any) =>
      item.description.toLowerCase().includes('zuschlag')
    );

    // Andere Positionen - nur Beschreibung, kein Preis
    const otherItems = items.filter((item: any) => 
      !item.description.toLowerCase().includes('package') &&
      !item.description.toLowerCase().includes('paket') &&
      !item.description.toLowerCase().includes('zusatznacht') &&
      !item.description.toLowerCase().includes('zuschlag')
    );
    
    surchargeItems.forEach((item: any) => {
      const lines = item.description.split('\n');
      doc.setFont('helvetica', 'normal');
      doc.text(lines[0], valueX, currentY);
      const sPrice = item.quantity > 1
        ? `${item.quantity}x EUR ${item.unit_price.toFixed(2).replace('.', ',')} = EUR ${item.total_price.toFixed(2).replace('.', ',')}`
        : `EUR ${item.total_price.toFixed(2).replace('.', ',')}`;
      doc.text(sPrice, 190, currentY, { align: 'right' });
      currentY += 3.5;
    });

    otherItems.forEach((item: any) => {
      const lines = item.description.split('\n');
      doc.setFont('helvetica', 'normal');
      doc.text(lines[0], valueX, currentY);
      
      const priceText = item.quantity > 1 
        ? `${item.quantity}x EUR ${item.unit_price.toFixed(2).replace('.', ',')} = EUR ${item.total_price.toFixed(2).replace('.', ',')}`
        : `EUR ${item.total_price.toFixed(2).replace('.', ',')}`;
      doc.text(priceText, 190, currentY, { align: 'right' });
      currentY += 3.5;
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          doc.text(lines[i], valueX, currentY);
          currentY += 3.2;
        }
      }
    });
    
    currentY += 6;

    // Preis-Tabelle rechts ausgerichtet mit genug Platz
    const priceLabelX = 105;   // Label ganz links
    const currencyX = 162;     // "Euro" Spalte
    const amountX = 190;       // Betrag rechtsbündig (ganz rechts)
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Berechne Package-Preis, Zuschlaege und Zusatznaechte separat
    const packagePrice = packageItem ? packageItem.total_price : 0;
    const surchargePrice = surchargeItems.reduce((sum: number, item: any) => sum + item.total_price, 0);
    const surchargeCount = surchargeItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const extraNightsPrice = [...vorabItems, ...verlaengerungItems].reduce((sum, item) => sum + item.total_price, 0);
    const otherItemsPrice = otherItems.reduce((sum: number, item: any) => sum + item.total_price, 0);
    
    // Reisepreis pro Person: Ankerpreis aus dem Package (Fallback: Positionswert)
    const pkgUnitPrice = Number((bookedPackage as { price?: number } | undefined)?.price || 0);
    const pricePerPerson = pkgUnitPrice > 0
      ? pkgUnitPrice
      : (packageItem && packageItem.quantity > 1
          ? packageItem.unit_price
          : (booking.travelers.length > 0 ? packagePrice / booking.travelers.length : 0));
    doc.text('Reisepreis pro Person:', priceLabelX, currentY);
    doc.text('Euro', currencyX, currentY);
    doc.text(pricePerPerson.toFixed(2).replace('.', ','), amountX, currentY, { align: 'right' });
    currentY += 5;
    
    // Einzelbelegungs-Zuschlag (falls vorhanden)
    if (surchargePrice > 0) {
      doc.text(`Einzelbelegungs-Zuschlag (${surchargeCount}x):`, priceLabelX, currentY);
      doc.text('Euro', currencyX, currentY);
      doc.text(surchargePrice.toFixed(2).replace('.', ','), amountX, currentY, { align: 'right' });
      currentY += 5;
    }
    
    doc.text('Gesamtreisepreis:', priceLabelX, currentY);
    doc.text('Euro', currencyX, currentY);
    doc.text((packagePrice + surchargePrice).toFixed(2).replace('.', ','), amountX, currentY, { align: 'right' });
    currentY += 5;
    
    // Zusatznächte (falls vorhanden)
    if (extraNightsPrice > 0) {
      const totalExtraNights = nightsBefore + nightsAfter;
      doc.text(`Zusatznächte (${totalExtraNights}x):`, priceLabelX, currentY);
      doc.text('Euro', currencyX, currentY);
      doc.text(extraNightsPrice.toFixed(2).replace('.', ','), amountX, currentY, { align: 'right' });
      currentY += 5;
    }
    
    // Andere Positionen (falls vorhanden)
    if (otherItemsPrice > 0) {
      doc.text('Weitere Leistungen:', priceLabelX, currentY);
      doc.text('Euro', currencyX, currentY);
      doc.text(otherItemsPrice.toFixed(2).replace('.', ','), amountX, currentY, { align: 'right' });
      currentY += 5;
    }
    
    doc.text('Versandkosten:', priceLabelX, currentY);
    doc.text('Euro', currencyX, currentY);
    doc.text('0,00', amountX, currentY, { align: 'right' });
    currentY += 5;
    
    doc.text('Mehrwertsteuer 0%:', priceLabelX, currentY);
    doc.text('Euro', currencyX, currentY);
    doc.text('0,00', amountX, currentY, { align: 'right' });
    currentY += 6;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Rechnungsbetrag TOTAL:', priceLabelX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text('Euro', currencyX, currentY);
    doc.text(invoice.total_amount.toFixed(2).replace('.', ','), amountX, currentY, { align: 'right' });
    
    doc.setLineWidth(0.5);
    doc.line(amountX - 28, currentY + 1, amountX + 2, currentY + 1);
    
    currentY += 12;

    // Zahlungsbedingungen und wichtige Hinweise
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    
    const paymentText = `Der Rechnungsbetrag ist zahlbar bis ${new Date(invoice.due_date).toLocaleDateString('de-CH')} auf unten genanntes ${bank.currency}-Konto. ${inv.payment_note}`;
    
    const splitText = doc.splitTextToSize(paymentText, 170);
    doc.text(splitText, leftMargin, currentY);
    currentY += splitText.length * 3 + 8;
    
    // Bankverbindung in übersichtlicher Box
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Bankverbindung:', leftMargin, currentY);
    currentY += 4;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Bank: ${bank.bank_name}`, leftMargin, currentY);
    doc.text(`SWIFT/BIC: ${bank.bic_swift}`, leftMargin + 70, currentY);
    currentY += 4;
    
    doc.setFont('helvetica', 'bold');
    // Format IBAN in groups of 4
    const formattedIbanFooter = bank.iban.replace(/(.{4})/g, '$1 ').trim();
    doc.text(`IBAN: ${formattedIbanFooter}`, leftMargin, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 4;
    
    doc.setFontSize(7);
    doc.text(`Verwendungszweck: Rechnung Nr. ${invoice.invoice_number}`, leftMargin, currentY);
    currentY += 8;

    // Footer mit Firmendaten (besser lesbar)
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    
    const footerY = 282;
    const footerRightX = 125;
    
    if (company.ceo) {
      doc.text(`Inhaberverwaltungsrat: ${company.ceo}`, leftMargin, footerY);
      doc.text(company.uid || '', footerRightX, footerY);
      doc.text(`Geschäftsführer: ${company.ceo}`, leftMargin, footerY + 3.5);
      doc.text(company.hr_id || '', footerRightX, footerY + 3.5);
    }
    doc.text(`Sitz der Gesellschaft und Gerichtsstand: ${company.city}`, leftMargin, footerY + 7);

    // ========== SEITE 2: Swiss QR-Rechnung ==========
    doc.addPage();
    
    // Header auf Seite 2 mit beiden Logos
    if (faltinLogoBase64) {
      doc.addImage(faltinLogoBase64, 'PNG', leftMargin, 10, 60, 0);
    }
    
    // Reisegarantie Logo laden (für Titel und Info-Box) - WEBP statt SVG
    let garantieLogoBase64Small = '';
    try {
      const garantieLogoPathSmall = path.join(process.cwd(), 'public', 'Schweizer-Reisegarantie-300x120-1.webp');
      if (fs.existsSync(garantieLogoPathSmall)) {
        const garantieLogoDataSmall = fs.readFileSync(garantieLogoPathSmall);
        garantieLogoBase64Small = garantieLogoDataSmall.toString('base64');
      }
    } catch (error) {
      console.log('Garantie Logo konnte nicht geladen werden');
    }
    
    // Reisegarantie Logo rechts oben (Header)
    try {
      const garantieLogoPath = path.join(process.cwd(), 'public', 'reisegarantielogo-de-768x258.webp');
      if (fs.existsSync(garantieLogoPath)) {
        const garantieLogoData = fs.readFileSync(garantieLogoPath);
        const garantieLogoBase64 = garantieLogoData.toString('base64');
        doc.addImage(`data:image/webp;base64,${garantieLogoBase64}`, 'WEBP', 145, 12, 45, 0);
      }
    } catch (error) {
      console.log('Garantie Logo konnte nicht geladen werden');
    }
    
    // MEHR ABSTAND nach Logos
    currentY = 45;
    
    // Titel mit Untertitel
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('Zahlungsinformationen', leftMargin, currentY);
    
    currentY += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Verwenden Sie den unten stehenden QR-Code für eine schnelle und sichere Zahlung.', leftMargin, currentY);
    
    // Swiss QR-Code Daten ZUERST definieren
    const firstTraveler = booking.travelers[0];
    const debtorName = (customer?.name || [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim())
      || `${firstTraveler.firstName} ${firstTraveler.lastName}`;
    const debtorStreet = customer?.street || '';
    const debtorZipCity = [customer?.zip, customer?.city].filter(Boolean).join(' ');
    const countryMap: Record<string, string> = { schweiz: 'CH', ch: 'CH', deutschland: 'DE', de: 'DE', 'österreich': 'AT', oesterreich: 'AT', at: 'AT', liechtenstein: 'LI', li: 'LI', frankreich: 'FR', fr: 'FR', italien: 'IT', it: 'IT' };
    const rawCountry = String(customer?.country || '').trim().toLowerCase();
    const debtorCountryCode = countryMap[rawCountry] || (rawCountry.length === 2 ? rawCountry.toUpperCase() : 'CH');
    const qrAmount = invoice.total_amount.toFixed(2);
    const creditorName = company.name;
    const creditorAddress = company.street;
    const creditorZip = company.zip;
    const creditorCity = company.city;
    const creditorCountry = company.country || 'CH';
    const creditorIBAN = bank.iban.replace(/\s/g, '');
    const formattedIBAN = creditorIBAN.match(/.{1,4}/g)?.join(' ') || creditorIBAN;
    
    // BESSERE STRUKTUR: Saubere Detail-Box (druckfreundlich)
    currentY += 12;
    doc.setFillColor(248, 250, 252);  // Sehr helles Blau-Grau
    doc.setDrawColor(203, 213, 225);  // Sanftes Blau-Grau
    doc.setLineWidth(0.5);
    doc.rect(leftMargin, currentY - 3, 170, 38, 'FD');
    
    // Linke Spalte
    let detailY = currentY + 2;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);  // Modernes Grau
    doc.text('RECHNUNG', leftMargin + 5, detailY);
    detailY += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);  // Fast schwarz
    doc.text(invoice.invoice_number, leftMargin + 5, detailY);
    
    detailY += 7;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('RECHNUNGSDATUM', leftMargin + 5, detailY);
    detailY += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(new Date(invoice.invoice_date).toLocaleDateString('de-CH'), leftMargin + 5, detailY);
    
    detailY += 6;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('FÄLLIG AM', leftMargin + 5, detailY);
    detailY += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(new Date(invoice.due_date).toLocaleDateString('de-CH'), leftMargin + 5, detailY);
    
    // Mittlere Spalte
    detailY = currentY + 2;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('REISETERMIN', leftMargin + 60, detailY);
    detailY += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`${adjustedCheckIn.toLocaleDateString('de-CH')} -`, leftMargin + 60, detailY);
    detailY += 4;
    doc.text(adjustedCheckOut.toLocaleDateString('de-CH'), leftMargin + 60, detailY);
    
    detailY += 6;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('KUNDE', leftMargin + 60, detailY);
    detailY += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(debtorName, leftMargin + 60, detailY);
    
    // Rechte Spalte - Betrag Box
    detailY = currentY + 2;
    const amountBoxX = leftMargin + 120;
    doc.setFillColor(0, 51, 102);  // Dunkles Blau
    doc.rect(amountBoxX, detailY - 2, 45, 16, 'F');
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GESAMTBETRAG', amountBoxX + 3, detailY + 1);
    detailY += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`EUR ${invoice.total_amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, amountBoxX + 3, detailY + 4);
    
    currentY += 38;
    
    // ZAHLUNGSSCHUTZ - Clean und druckfreundlich
    currentY += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('Zahlungsschutz & Wichtige Hinweise', leftMargin, currentY);
    
    currentY += 8;
    
    // Saubere Info-Box
    const infoBoxY = currentY - 2;
    
    doc.setFillColor(248, 252, 255);
    doc.setDrawColor(200, 220, 240);
    doc.setLineWidth(0.3);
    doc.rect(leftMargin, infoBoxY, 170, 26, 'FD');
    
    // Text
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    let infoY = infoBoxY + 5;
    doc.text('Ihre Anzahlung ist vollständig durch den Schweizer Reisegarantiefonds abgesichert.', leftMargin + 5, infoY);
    infoY += 5;
    doc.text('Im Insolvenzfall erhalten Sie Ihre Zahlung garantiert zurück.', leftMargin + 5, infoY);
    infoY += 5;
    doc.text('Diese Rechnung ist verbindlich und zahlbar bis zum oben genannten Fälligkeitsdatum.', leftMargin + 5, infoY);
    infoY += 6;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 51, 102);
    doc.text('Mehr Informationen: www.garantiefonds.ch', leftMargin + 5, infoY);
    
    currentY += 30;
    
    // DANKESNACHRICHT - Elegant und professionell
    currentY += 1;
    
    // Elegante Trennlinie
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.8);
    doc.line(leftMargin + 60, currentY, leftMargin + 110, currentY);
    
    currentY += 8;
    
    // Dankestext zentriert - mit richtigen Umlauten
    doc.setTextColor(0, 51, 102);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Vielen Dank für Ihr Vertrauen!', leftMargin + 85, currentY, { align: 'center' });
    
    currentY += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(noteMeta.thank_you_text || settings.event.thank_you_text || `Wir freuen uns, Sie bei ${eventName} begleiten zu dürfen.`, leftMargin + 85, currentY, { align: 'center' });
    currentY += 4;
    
    currentY += 10;
    
    // Faltin Logo zentriert am Ende
    const footerLogoY = currentY;
    
    if (faltinLogoBase64) {
      doc.addImage(faltinLogoBase64, 'PNG', leftMargin + 60, footerLogoY, 50, 0);
    }
    
    currentY += 25;
    
    // Signatur-Text - weiter unten
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Ihr Team von Faltin Travel', leftMargin + 85, currentY, { align: 'center' });
    
    currentY += 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 140, 140);
    doc.text(`${company.street} | ${company.zip} ${company.city} | ${company.email}`, leftMargin + 85, currentY, { align: 'center' });
    
    currentY += 10;
    
    // Swiss QR-Code String (32 Felder gemäß ISO 20022)
    const qrData = [
      'SPC', '0200', '1', creditorIBAN, 'K',
      creditorName, creditorAddress, `${creditorZip} ${creditorCity}`, '', '', creditorCountry,
      '', '', '', '', '', '', '',
      qrAmount, bank.currency || 'EUR', 'K',
      debtorName, debtorStreet, debtorZipCity, '', '', debtorCountryCode,
      'NON', '', `Rechnung ${invoice.invoice_number}`, 'EPD', ''
    ].join('\r\n');
    
    // QR-Code generieren
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 0,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    
    // ===== SWISS QR LAYOUT zeichnen =====
    const receiptWidth = 62;
    const paymentLeft = receiptWidth + 5;
    const topMargin = 220;  // Noch tiefer!
    
    // RESET FARBEN FÜR QR-CODE!
    doc.setTextColor(0, 0, 0);  // SCHWARZ!
    doc.setFillColor(255, 255, 255);  // Weiß für Hintergrund
    
    // Trennlinien (gestrichelt)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);
    // Horizontale Trennlinie oben
    for (let x = 0; x < 210; x += 3) {
      doc.line(x, topMargin, Math.min(x + 1.5, 210), topMargin);
    }
    // Vertikale Trennlinie zwischen Empfangsschein und Zahlteil
    for (let y = topMargin; y < 297; y += 3) {
      doc.line(receiptWidth, y, receiptWidth, Math.min(y + 1.5, 297));
    }
    
    // ===== EMPFANGSSCHEIN (Links, 62mm breit) =====
    let yPos = topMargin + 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Empfangsschein', 5, yPos);
    
    yPos += 5;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Konto / Zahlbar an', 5, yPos);
    yPos += 3;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(formattedIBAN, 5, yPos);
    yPos += 3;
    doc.text(creditorName, 5, yPos);
    yPos += 3;
    doc.text(creditorAddress, 5, yPos);
    yPos += 3;
    doc.text(`${creditorCountry}-${creditorZip} ${creditorCity}`, 5, yPos);
    
    yPos += 6;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Zahlbar durch', 5, yPos);
    yPos += 3;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(debtorName, 5, yPos);
    
    // Währung und Betrag (Empfangsschein)
    yPos = topMargin + 43;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Währung', 5, yPos);
    doc.text('Betrag', 18, yPos);
    yPos += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('EUR', 5, yPos);
    doc.text(qrAmount.replace('.', ','), 18, yPos);
    
    // Annahmestelle (rechts unten im Empfangsschein)
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    const receiptRight = receiptWidth - 2;
    doc.text('Annahmestelle', receiptRight, topMargin + 52, { align: 'right' });
    
    // ===== ZAHLTEIL (Rechts, 148mm breit) =====
    yPos = topMargin + 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Zahlteil', paymentLeft, yPos);
    
    // QR-Code platzieren (46x46mm) - HÖHER!
    const qrSize = 46;
    const qrX = paymentLeft;
    const qrY = topMargin + 12;
    doc.addImage(qrCodeDataURL, 'PNG', qrX, qrY, qrSize, qrSize);
    
    // Swiss Cross in der Mitte des QR-Codes (7x7mm)
    const crossSize = 7;
    const crossX = qrX + (qrSize / 2) - (crossSize / 2);
    const crossY = qrY + (qrSize / 2) - (crossSize / 2);
    
    // Weißer Hintergrund für das Kreuz
    doc.setFillColor(255, 255, 255);
    doc.rect(crossX, crossY, crossSize, crossSize, 'F');
    
    // Schwarzer Rahmen
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(crossX, crossY, crossSize, crossSize);
    
    // Schweizer Kreuz (Balken)
    doc.setFillColor(0, 0, 0);
    const crossCenter = crossSize / 2;
    const barWidth = 1.4;
    const barLength = 4.5;
    // Vertikaler Balken
    doc.rect(crossX + crossCenter - barWidth/2, crossY + crossCenter - barLength/2, barWidth, barLength, 'F');
    // Horizontaler Balken
    doc.rect(crossX + crossCenter - barLength/2, crossY + crossCenter - barWidth/2, barLength, barWidth, 'F');
    
    // Währung und Betrag (rechts neben QR-Code)
    const infoX = qrX + qrSize + 5;
    yPos = qrY + 2;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Währung', infoX, yPos);
    doc.text('Betrag', infoX + 15, yPos);
    yPos += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('EUR', infoX, yPos);
    doc.text(qrAmount.replace('.', ','), infoX + 15, yPos);
    
    // Konto / Zahlbar an (rechts)
    yPos += 7;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Konto / Zahlbar an', infoX, yPos);
    yPos += 3;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(formattedIBAN, infoX, yPos);
    yPos += 3;
    doc.text(creditorName, infoX, yPos);
    yPos += 3;
    doc.text(creditorAddress, infoX, yPos);
    yPos += 3;
    doc.text(`${creditorCountry}-${creditorZip} ${creditorCity}`, infoX, yPos);
    
    // Zahlbar durch (rechts)
    yPos += 6;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Zahlbar durch', infoX, yPos);
    yPos += 3;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(debtorName, infoX, yPos);
    
    // Zusätzliche Informationen (rechts)
    yPos += 6;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Zusätzliche Informationen', infoX, yPos);
    yPos += 3;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rechnung ${invoice.invoice_number}`, infoX, yPos);
    yPos += 3.5;
    doc.text(`Fällig: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}`, infoX, yPos);

    const pdfBuffer = doc.output('arraybuffer');

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Rechnung_${invoice.invoice_number}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Fehler bei PDF-Generierung: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
