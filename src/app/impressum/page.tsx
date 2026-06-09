import type { Metadata } from 'next';
import LegalPage, { LegalH2 } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Impressum | Faltin Travel AG',
  description: 'Impressum und Anbieterkennzeichnung der Faltin Travel AG, Regensdorf (Schweiz).',
  alternates: { canonical: '/impressum' },
};

export default function ImpressumPage() {
  return (
    <LegalPage
      title="Impressum"
      breadcrumb={[
        { name: 'Start', href: '/' },
        { name: 'Impressum', href: '/impressum' },
      ]}
    >
      <p>Angaben gemäss § 5 TMG:</p>

      <p>
        <strong>Faltin Travel AG</strong><br />
        Riedthofstrasse 172<br />
        CH-8105 Regensdorf
      </p>

      <LegalH2>Vertreten durch</LegalH2>
      <p>
        Verwaltungsrat: Stefan Faltin<br />
        Geschäftsführer: Stefan Faltin
      </p>

      <LegalH2>Kontakt</LegalH2>
      <p>
        Telefon: <a href="tel:+41447002277" className="font-semibold text-[#18395a] hover:underline">+41 44 700 22 77</a><br />
        E-Mail: <a href="mailto:info@faltintravel.com" className="font-semibold text-[#18395a] hover:underline">info@faltintravel.com</a>
      </p>

      <LegalH2>Handelsregister</LegalH2>
      <p>
        Registereintrag / Registergericht: Regensdorf<br />
        Registernummer: CH-020.3.037.547-2
      </p>

      <LegalH2>Umsatzsteuer-ID</LegalH2>
      <p>
        Umsatzsteuer-Identifikationsnummer gemäss § 27 a Umsatzsteuergesetz:<br />
        CHE-267.347.685 MWST
      </p>
    </LegalPage>
  );
}
