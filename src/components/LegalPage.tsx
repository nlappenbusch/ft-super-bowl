import Breadcrumbs, { type Crumb } from '@/components/Breadcrumbs';

const NAVY_HERO: React.CSSProperties = {
  background: 'linear-gradient(180deg,#163e63 0%,#0e2842 100%)',
};

/**
 * Einheitliches Layout für rechtliche / textlastige Seiten
 * (Impressum, AGB, Datenschutz). Markenkonformer Header + lesbare Textspalte.
 */
export default function LegalPage({
  title,
  subtitle,
  breadcrumb,
  children,
}: {
  title: string;
  subtitle?: string;
  breadcrumb: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <>
      <Breadcrumbs items={breadcrumb} />

      <section className="px-4 py-12 text-white" style={NAVY_HERO}>
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl font-extrabold leading-tight md:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          <div className="my-4 h-1 w-14 rounded-full" style={{ background: '#d9531e' }} />
          {subtitle && <p className="max-w-2xl text-blue-100/85">{subtitle}</p>}
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-2xl bg-white p-6 shadow-sm md:p-10" style={{ border: '1px solid #e5e8ed' }}>
            <div className="legal-content space-y-5 text-[15px] leading-relaxed text-gray-700">
              {children}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* Wiederverwendbare Textbausteine für konsistente Typografie */

export function LegalH2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="scroll-mt-24 pt-4 text-xl font-bold md:text-2xl" style={{ color: '#143047' }}>
      {children}
    </h2>
  );
}

export function LegalH3({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-base font-semibold" style={{ color: '#18395a' }}>{children}</h3>;
}
