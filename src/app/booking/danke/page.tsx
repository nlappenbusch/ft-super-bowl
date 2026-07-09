import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Phone, Mail, Clock, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Vielen Dank für Ihre Buchungsanfrage | Faltin Travel',
  robots: { index: false },
};

/**
 * Bestätigungsseite nach Absenden der verbindlichen Buchungsanfrage.
 * Ziel der Weiterleitung aus BookingForm (?rq=RQ-12345).
 */
export default async function BookingDankePage({
  searchParams,
}: {
  searchParams: Promise<{ rq?: string }>;
}) {
  const { rq } = await searchParams;

  return (
    <div className='min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16'>
      <div className='w-full max-w-2xl'>
        <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center'>
          <CheckCircle2 className='mx-auto h-16 w-16' style={{ color: '#16a34a' }} />
          <h1 className='mt-6 text-3xl font-bold text-gray-900'>Vielen Dank für Ihre Buchungsanfrage!</h1>
          <p className='mt-3 text-gray-600'>
            Ihre Anfrage ist bei uns eingegangen und wird persönlich geprüft.
          </p>

          {rq && (
            <div className='mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3' style={{ background: '#f0f5fa', border: '1px solid #d5e2ef' }}>
              <span className='text-sm text-gray-600'>Ihre Anfragenummer:</span>
              <span className='font-mono text-lg font-bold' style={{ color: '#184a7b' }}>{rq}</span>
            </div>
          )}

          <div className='mt-10 text-left'>
            <h2 className='text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4'>Wie geht es weiter?</h2>
            <ol className='space-y-4'>
              {[
                'Wir prüfen Verfügbarkeit von Tickets, Hotel und Leistungen für Ihren Wunschtermin.',
                'Sie erhalten von uns per E-Mail eine persönliche Bestätigung bzw. Ihr verbindliches Angebot.',
                'Ihr persönlicher Ansprechpartner meldet sich in der Regel innerhalb eines Werktages bei Ihnen.',
              ].map((step, i) => (
                <li key={i} className='flex items-start gap-3'>
                  <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white' style={{ background: '#184a7b' }}>{i + 1}</span>
                  <span className='text-gray-700 pt-0.5'>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className='mt-10 rounded-xl p-6 text-left' style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <p className='font-semibold text-gray-900 mb-3'>Fragen zu Ihrer Anfrage? Wir sind direkt für Sie da:</p>
            <div className='grid gap-3 sm:grid-cols-3 text-sm text-gray-700'>
              <a href='tel:+41447002277' className='flex items-center gap-2 hover:underline'>
                <Phone className='h-4 w-4 shrink-0' style={{ color: '#f14624' }} /> +41 44 700 22 77
              </a>
              <a href='mailto:info@faltintravel.com' className='flex items-center gap-2 hover:underline'>
                <Mail className='h-4 w-4 shrink-0' style={{ color: '#f14624' }} /> info@faltintravel.com
              </a>
              <span className='flex items-center gap-2'>
                <Clock className='h-4 w-4 shrink-0' style={{ color: '#f14624' }} /> Mo–Fr, 08:00–18:00 Uhr
              </span>
            </div>
            {rq && <p className='mt-3 text-xs text-gray-500'>Bitte geben Sie bei Rückfragen Ihre Anfragenummer {rq} an.</p>}
          </div>

          <Link
            href='/'
            className='mt-10 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white transition hover:opacity-90'
            style={{ background: '#184a7b' }}
          >
            Zur Startseite <ArrowRight className='h-4 w-4' />
          </Link>
        </div>
      </div>
    </div>
  );
}
