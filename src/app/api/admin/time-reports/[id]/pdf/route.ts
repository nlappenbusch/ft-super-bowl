import { NextResponse } from 'next/server';
import { getTimeReport, formatReportNo, formatTicketNo, type TimeEntryDetail } from '@/lib/staffStore';
import { getSettings } from '@/lib/settingsStore';
import { jsPDF } from 'jspdf';

/**
 * GET /api/admin/time-reports/[id]/pdf → strukturierter Zeitrapport als PDF.
 * Aufbau: Kopf (Rapport-Nr., Zeitraum, Status) → Positionen gruppiert nach Ticket
 * (Datum, Mitarbeiter, Tätigkeit, Zeit) mit Zwischensummen → Gesamtsumme
 * (+ Betrag bei hinterlegtem Stundensatz) → Auswertung pro Mitarbeiter.
 */

const NAVY: [number, number, number] = [20, 48, 71];
const ORANGE: [number, number, number] = [217, 83, 30];
const MUTED: [number, number, number] = [100, 116, 139];
const STROKE: [number, number, number] = [226, 232, 240];

const M = 18; // Seitenrand mm
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - 2 * M;

function fmtHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')} h`;
}

function fmtDec(min: number): string {
  return (min / 60).toFixed(2).replace('.', ',');
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (d || '–');
}

function employeeLabel(e: TimeEntryDetail): string {
  return e.employee_name || 'Extern (API)';
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getTimeReport(id);
  if (!data) return NextResponse.json({ success: false, error: 'Rapport nicht gefunden' }, { status: 404 });

  const { report, entries, total_minutes } = data;
  const company = getSettings().company;
  const no = formatReportNo(report.report_number) || 'RAP';
  const rate = report.hourly_rate;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 0;

  const newPage = (first = false) => {
    if (!first) doc.addPage();
    y = M + 4;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 22) newPage();
  };

  const line = (yy: number) => {
    doc.setDrawColor(...STROKE);
    doc.setLineWidth(0.25);
    doc.line(M, yy, PAGE_W - M, yy);
  };

  // Spalten: Datum | Mitarbeiter | Tätigkeit | Zeit
  const COL_DATE = M;
  const COL_EMP = M + 24;
  const COL_NOTE = M + 60;
  const COL_TIME_R = PAGE_W - M; // rechtsbündig
  const NOTE_W = COL_TIME_R - 20 - COL_NOTE;

  const tableHead = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('DATUM', COL_DATE, y);
    doc.text('MITARBEITER', COL_EMP, y);
    doc.text('TÄTIGKEIT', COL_NOTE, y);
    doc.text('ZEIT', COL_TIME_R, y, { align: 'right' });
    y += 2;
    line(y);
    y += 4.5;
  };

  // ─── Kopf ───
  newPage(true);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(company?.name || 'Faltin Travel AG', M, y);
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text('Zeitrapport', PAGE_W - M, y + 2, { align: 'right' });
  doc.setFontSize(12);
  doc.setTextColor(...ORANGE);
  doc.text(no, PAGE_W - M, y + 9, { align: 'right' });
  y += 16;
  line(y);
  y += 7;

  doc.setFontSize(10);
  const meta: Array<[string, string]> = [
    ['Titel', report.title || '–'],
    ['Zeitraum', report.period_from ? `${fmtDate(report.period_from)} – ${fmtDate(report.period_to)}` : '–'],
    ['Erstellt am', fmtDate(report.created_at?.slice(0, 10) || '')],
    ['Status', report.status === 'final' ? `Finalisiert${report.finalized_at ? ` am ${fmtDate(report.finalized_at.slice(0, 10))}` : ''}` : 'Entwurf'],
  ];
  if (rate != null) meta.push(['Stundensatz', `${fmtMoney(rate)} ${report.currency}/h`]);
  for (const [k, v] of meta) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(k, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...NAVY);
    doc.text(v, M + 32, y);
    y += 5.5;
  }
  if (report.note) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const noteLines = doc.splitTextToSize(report.note, CONTENT_W);
    doc.text(noteLines, M, y);
    y += noteLines.length * 4.2 + 2;
  }
  y += 4;

  // ─── Positionen, gruppiert nach Ticket ───
  const groups = new Map<string, { label: string; items: TimeEntryDetail[] }>();
  for (const e of entries) {
    const key = e.task_id;
    if (!groups.has(key)) {
      const ticket = formatTicketNo(e.ticket_number);
      groups.set(key, { label: `${ticket ? `${ticket} · ` : ''}${e.task_title || 'Ohne Ticket'}`, items: [] });
    }
    groups.get(key)!.items.push(e);
  }

  tableHead();
  doc.setFontSize(9);

  for (const group of groups.values()) {
    ensureSpace(14);
    // Gruppenkopf
    doc.setFillColor(244, 246, 249);
    doc.rect(M - 2, y - 4, CONTENT_W + 4, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    const groupSum = group.items.reduce((s, e) => s + (e.minutes || 0), 0);
    doc.text(doc.splitTextToSize(group.label, CONTENT_W - 30)[0], M, y);
    doc.text(fmtHM(groupSum), COL_TIME_R, y, { align: 'right' });
    y += 7;

    for (const e of group.items) {
      const noteLines = doc.splitTextToSize(e.note || '–', NOTE_W);
      const rowH = Math.max(noteLines.length * 4.2, 4.2) + 2.2;
      ensureSpace(rowH + 2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...NAVY);
      doc.text(fmtDate(e.work_date), COL_DATE, y);
      doc.text(employeeLabel(e), COL_EMP, y);
      doc.text(noteLines, COL_NOTE, y);
      doc.setFont('helvetica', 'bold');
      doc.text(fmtHM(e.minutes || 0), COL_TIME_R, y, { align: 'right' });
      y += rowH;
    }
    y += 2;
  }

  // ─── Summen ───
  ensureSpace(rate != null ? 30 : 20);
  line(y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('Gesamtzeit', COL_NOTE, y);
  doc.text(`${fmtHM(total_minutes)}  (${fmtDec(total_minutes)} h)`, COL_TIME_R, y, { align: 'right' });
  y += 6;
  if (rate != null) {
    doc.setFont('helvetica', 'normal');
    doc.text(`${fmtDec(total_minutes)} h × ${fmtMoney(rate)} ${report.currency}`, COL_NOTE, y);
    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ORANGE);
    doc.text('Gesamtbetrag', COL_NOTE, y);
    doc.text(`${fmtMoney((total_minutes / 60) * rate)} ${report.currency}`, COL_TIME_R, y, { align: 'right' });
    y += 6;
  }

  // ─── Auswertung pro Mitarbeiter ───
  const byEmp = new Map<string, number>();
  for (const e of entries) byEmp.set(employeeLabel(e), (byEmp.get(employeeLabel(e)) || 0) + (e.minutes || 0));
  if (byEmp.size > 1) {
    ensureSpace(12 + byEmp.size * 5.5);
    y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text('AUSWERTUNG PRO MITARBEITER', M, y);
    y += 5;
    doc.setTextColor(...NAVY);
    for (const [name, min] of [...byEmp.entries()].sort((a, b) => b[1] - a[1])) {
      doc.setFont('helvetica', 'normal');
      doc.text(name, M, y);
      doc.setFont('helvetica', 'bold');
      doc.text(rate != null ? `${fmtHM(min)}  ·  ${fmtMoney((min / 60) * rate)} ${report.currency}` : fmtHM(min), COL_TIME_R, y, { align: 'right' });
      y += 5.5;
    }
  }

  // ─── Fußzeile auf allen Seiten ───
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${company?.name || 'Faltin Travel AG'} · Zeitrapport ${no}`, M, PAGE_H - 12);
    doc.text(`Seite ${i}/${pages}`, PAGE_W - M, PAGE_H - 12, { align: 'right' });
  }

  const filename = `zeitrapport-${no}.pdf`;
  return new NextResponse(Buffer.from(doc.output('arraybuffer')), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
