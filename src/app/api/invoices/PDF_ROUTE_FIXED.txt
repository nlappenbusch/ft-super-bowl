import { NextResponse } from 'next/server';
import { getInvoiceById, getInvoiceItems, getBookingById } from '@/lib/database';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const invoice = getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Rechnung nicht gefunden' },
        { status: 404 }
      );
    }

    const items = getInvoiceItems(id);
    const booking = getBookingById(invoice.booking_id);

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Buchung nicht gefunden' },
        { status: 404 }
      );
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    
    let currentY = 20;
    const leftMargin = 20;

    doc.setFontSize(14);
    doc.setTextColor(24, 74, 123);
    doc.setFont('helvetica', 'bold');
    doc.text('Faltin Travel AG', leftMargin, currentY);
    currentY += 6;
    
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.text('Limmatquai 3', leftMargin, currentY);
    currentY += 3.5;
    doc.text('8001 Zürich, Schweiz', leftMargin, currentY);
    currentY += 3.5;
    doc.text('Tel: +41 44 700 22 77', leftMargin, currentY);
    currentY += 3.5;
    doc.text('E-Mail: info@faltintravel.com', leftMargin, currentY);
    currentY += 3.5;
    doc.text('Web: www.faltintravel.com', leftMargin, currentY);

    const detailsX = 130;
    let detailsY = 20;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Rechnungsnummer:', detailsX, detailsY);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.invoice_number, detailsX + 40, detailsY);
    detailsY += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.text('Rechnungsdatum:', detailsX, detailsY);
    doc.text(new Date(invoice.invoice_date).toLocaleDateString('de-CH'), detailsX + 40, detailsY);
    detailsY += 5;
    
    doc.text('Fälligkeitsdatum:', detailsX, detailsY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0);
    doc.text(new Date(invoice.due_date).toLocaleDateString('de-CH'), detailsX + 40, detailsY);
    doc.setTextColor(0, 0, 0);
    
    currentY = 48;

    doc.setFontSize(18);
    doc.setTextColor(24, 74, 123);
    doc.setFont('helvetica', 'bold');
    doc.text('RECHNUNG', leftMargin, currentY);
    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const traveler = booking.travelers[0];
    doc.text(`${traveler.firstName} ${traveler.lastName}`, leftMargin, currentY);
    currentY += 4;
    doc.text(booking.email, leftMargin, currentY);
    currentY += 4;
    doc.text(booking.phone, leftMargin, currentY);
    currentY += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bestätigung / Rechnung', leftMargin, currentY);
    currentY += 8;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(leftMargin, currentY - 2, 170, 8, 'S');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const boxY = currentY + 2.5;
    doc.text('Rechnungsnummer: ' + invoice.invoice_number, leftMargin + 3, boxY);
    doc.text('Rechnungsdatum: ' + new Date(invoice.invoice_date).toLocaleDateString('de-CH'), leftMargin + 100, boxY);
    currentY += 12;

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
    doc.text('Fr. 09.02. - Mo. 11.02.2027', valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Anreise:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('Eigene Anreise', valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Destination:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('USA – Los Angeles', valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Hotel:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('5* Luxushotel in Santa Monica', valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Unterbringung:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    const roomCount = Math.ceil(booking.travelers.length / 2);
    doc.text(`${roomCount}x Übernachtung/Frühstück im Doppelzimmer von Fr. 09.02.2027 - Mo. 11.02.2027`, valueX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.text('Veranstaltung:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('Super Bowl LXI 2027', valueX, currentY);
    currentY += 5.5;

    doc.text('So. 11.02.2027 – Super Bowl LXI – SoFi Stadium', valueX, currentY);
    currentY += 5.5;

    doc.setFont('helvetica', 'bold');
    doc.text('Ticketkategorie:', labelX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${booking.travelers.length}x ${booking.package_title}`, valueX, currentY);
    currentY += 5;

    const ticketDetails = [
      'Kategorie 1 Sitzplatz im Unterrang',
      'Inkl. Zutritt zum VIP-Bereich mit Catering & Getränken',
      'Inkl. Super Bowl Program & Merchandise',
      'Inkl. Faltin Travel Lanyard',
      'Inkl. detaillierte Reiseinformation & Schweizer Reisegarantie'
    ];
    
    ticketDetails.forEach(line => {
      doc.text(line, valueX, currentY);
      currentY += 3.8;
    });
    
    currentY += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Reiseteilnehmer:', labelX, currentY);
    currentY += 4;
    
    doc.setFont('helvetica', 'normal');
    booking.travelers.forEach((t: any) => {
      const salutation = t.salutation === 'Herr' ? 'Mr.' : 'Mrs.';
      doc.text(`${salutation}    ${t.firstName} ${t.lastName}`, valueX, currentY);
      currentY += 3.8;
    });
    
    currentY += 6;

    const tableData = items.map((item: any) => [
      item.description,
      item.quantity.toString(),
      item.unit_price.toFixed(2),
      item.total_price.toFixed(2)
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Beschreibung', 'Menge', 'Preis (CHF)', 'Total (CHF)']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [24, 74, 123],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 90, halign: 'left', valign: 'top' },
        1: { cellWidth: 20, halign: 'center', valign: 'middle' },
        2: { cellWidth: 30, halign: 'right', valign: 'middle' },
        3: { cellWidth: 30, halign: 'right', valign: 'middle' }
      },
      margin: { left: leftMargin, right: 20 },
      tableLineColor: [200, 200, 200],
      tableLineWidth: 0.1,
      styles: {
        overflow: 'linebreak',
        cellWidth: 'wrap'
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    const priceTableX = 115;
    const currencyX = 163;
    const priceValueX = 185;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const pricePerPerson = booking.travelers.length > 0 ? invoice.total_amount / booking.travelers.length : 0;
    doc.text('Reisepreis pro Person:', priceTableX, currentY);
    doc.text('Euro', currencyX, currentY);
    doc.text(pricePerPerson.toFixed(2).replace('.', ','), priceValueX, currentY, { align: 'right' });
    currentY += 5;
    
    doc.text('Gesamtreisepreis:', priceTableX, currentY);
    doc.text('Euro', currencyX, currentY);
    doc.text(invoice.total_amount.toFixed(2).replace('.', ','), priceValueX, currentY, { align: 'right' });
    currentY += 5;
    
    doc.text('Versandkosten:', priceTableX, currentY);
    doc.text('Euro', currencyX, currentY);
    doc.text('0,00', priceValueX, currentY, { align: 'right' });
    currentY += 5;
    
    doc.text('Mehrwertsteuer 0%:', priceTableX, currentY);
    doc.text('Euro', currencyX, currentY);
    doc.text('0,00', priceValueX, currentY, { align: 'right' });
    currentY += 6;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Rechnungsbetrag TOTAL:', priceTableX, currentY);
    doc.text('Euro', currencyX, currentY);
    doc.text(invoice.total_amount.toFixed(2).replace('.', ','), priceValueX, currentY, { align: 'right' });
    
    doc.setLineWidth(0.5);
    doc.line(priceValueX - 30, currentY + 1, priceValueX + 2, currentY + 1);
    
    currentY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    
    const paymentText = `Der Rechnungsbetrag ist zahlbar bis ${new Date(invoice.due_date).toLocaleDateString('de-CH')} auf unten genanntes Euro-Konto bei der Credit Suisse. Unter Angabe der IBAN-Nummer sowie SWIFT/BIC Code fallen keine Gebühren an. Mit der Buchung akzeptieren Sie unsere AGB (www.faltintravel.com/AGB). Tickets sind nicht stornierbar. Wir empfehlen den Abschluss einer Reiserücktrittskostenversicherung. Vielen Dank, dass Sie sich für Faltin Travel entschieden haben.`;
    
    const splitText = doc.splitTextToSize(paymentText, 170);
    doc.text(splitText, leftMargin, currentY);
    currentY += splitText.length * 3 + 5;
    
    doc.setFontSize(7);
    doc.text('Bank:', leftMargin, currentY);
    doc.text('Credit Suisse / SWIFT-Code: CRESCHZZ80A', leftMargin + 25, currentY);
    currentY += 3.5;
    
    doc.text('IBAN-Nr. für CHF:', leftMargin, currentY);
    doc.text('CH30 0483 5183 2342 2100 0', leftMargin + 25, currentY);
    currentY += 3.5;
    
    doc.text('IBAN-Nr. für EUR:', leftMargin, currentY);
    doc.text('CH63 0483 5183 2342 2200 0', leftMargin + 25, currentY);

    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    
    const footerY = 282;
    doc.text('Inhaberverwaltungsrat: Stefan Faltin', leftMargin, footerY);
    doc.text('CHE-267.343.865 MWST', 115, footerY);
    
    doc.text('Geschäftsführer: Stefan Faltin', leftMargin, footerY + 3);
    doc.text('HRD: CH-020.3.037.547-2', 115, footerY + 3);
    
    doc.text('Sitz der Gesellschaft und Gerichtsstand: Regensdorf', leftMargin, footerY + 6);
    doc.text('Bank: Credit Suisse / SWIFT-Code: CRESCHZZ80A', 115, footerY + 6);
    
    doc.text('IBAN-Nr. für CHF: CH30 0483 5183 2342 2100 0', 115, footerY + 9);
    doc.text('IBAN-Nr. für EUR: CH63 0483 5183 2342 2200 0', 115, footerY + 12);

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
