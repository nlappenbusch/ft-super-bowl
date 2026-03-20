import Image from 'next/image';
import EkomiWidget from '@/components/EkomiWidget';

const socialLinks = [
  {
    href: 'https://www.facebook.com/FaltinTravel/',
    src: 'https://faltintravel.com/wp-content/uploads/2020/10/Facebook_1.png',
    alt: 'Facebook'
  },
  {
    href: 'http://instagram.com/faltin_travel/?hl=de',
    src: 'https://faltintravel.com/wp-content/uploads/2020/10/Instagram_1.png',
    alt: 'Instagram'
  },
  {
    href: 'https://ch.linkedin.com/in/stefan-faltin-727a5352',
    src: 'https://faltintravel.com/wp-content/uploads/2020/10/Linkedin_1.png',
    alt: 'LinkedIn'
  },
  {
    href: 'https://faltintravel.tumblr.com',
    src: 'https://faltintravel.com/wp-content/uploads/2020/10/Tumblr_1.png',
    alt: 'Tumblr'
  },
  {
    href: 'https://twitter.com/faltintravel',
    src: 'https://faltintravel.com/wp-content/uploads/2020/10/Twitter_1.png',
    alt: 'Twitter'
  },
  {
    href: 'https://www.youtube.com/channel/UCETTVQNuO08Nww4Cldv_OJQ',
    src: 'https://faltintravel.com/wp-content/uploads/2020/10/Youtube_1.png',
    alt: 'YouTube'
  }
];

export default function Footer() {
  return (
    <footer style={{ backgroundColor: '#143047' }} className="text-gray-300 py-12 px-4">
      <div className="container mx-auto">
        <div className="mb-10 rounded-2xl border border-white/16 bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-white/[0.08] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="shrink-0 rounded-xl bg-white p-2 border border-slate-200 shadow-[0_4px_14px_rgba(0,0,0,0.22)]">
              <Image
                src="/RC_MatchShield_2027_RGB (1).svg"
                alt="Ryder Cup 2027 Match Shield"
                width={74}
                height={74}
                className="shrink-0"
              />
            </div>
            <div className="text-center sm:text-left">
              <p className="inline-flex items-center rounded-full border border-white/25 bg-[#0f2742]/60 px-3 py-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-blue-100">
                Ryder Cup 2027 | Authorized Distributor
              </p>
              <p className="text-base sm:text-lg font-semibold text-white mt-2">
                Offizieller Vertriebspartner fuer Ryder Cup 2027 Reisepakete
              </p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                Faltin Travel ist stolz darauf, als Authorized Distributor offizieller Vertriebspartner fuer den Ryder Cup 2027 zu sein.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-10 -mx-4 sm:-mx-6 lg:-mx-8 bg-white py-8 sm:py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <EkomiWidget
              token="sf1193615db15cb28a8dd"
              draftMode={true}
              language="de"
              className="w-full overflow-hidden"
            />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div>
            <h4 className="text-white font-bold mb-4">Faltin Travel AG</h4>
            <p className="text-sm">Riedthofstrasse 172</p>
            <p className="text-sm">8105 Regensdorf, Schweiz</p>
            <div className="mt-4 space-y-1 text-sm">
              <p>Tel.: <a href="tel:0041447002277" className="hover:opacity-80 transition">+41 44 700 22 77</a></p>
              <p>Fax: +41 44 740 33 27</p>
              <p>Mail: <a href="mailto:info@faltintravel.com" className="hover:opacity-80 transition">info@faltintravel.com</a></p>
            </div>
            <div className="mt-5 flex items-center gap-2.5">
              {socialLinks.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-90 hover:opacity-100 transition"
                  aria-label={social.alt}
                >
                  <Image src={social.src} alt={social.alt} width={36} height={36} />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Unternehmen</h4>
            <div className="text-sm space-y-1">
              <p>Inhaber: Stefan Faltin</p>
              <p>Geschaeftsfuehrer: Stefan Faltin</p>
              <p className="pt-2">Sitz und Gerichtsstand: Regensdorf</p>
              <p>USt-ID: CHE-267.347.685 MWST</p>
              <p>HrID: CH-020.3.037.547-2</p>
            </div>
            <p className="text-sm mt-4">
              <a href="https://faltintravel.com/impressum/" className="hover:opacity-80 transition">Impressum</a>
              <span className="mx-1.5 text-gray-500">|</span>
              <a href="https://faltintravel.com/allgemeine-geschaeftsbedingungen/" className="hover:opacity-80 transition">AGB</a>
              <span className="mx-1.5 text-gray-500">|</span>
              <a href="https://faltintravel.com/datenschutzerklaerung/" className="hover:opacity-80 transition">Datenschutzerklaerung</a>
            </p>
          </div>
          <div className="lg:items-end lg:text-right flex flex-col gap-3">
            <Image
              src="/Schweizer-Reisegarantie-300x120-1.webp"
              alt="Schweizer Reisegarantie"
              width={240}
              height={96}
              className="h-auto"
            />
            <a href="https://specialolympics.ch/" target="_blank" rel="noopener noreferrer">
              <Image
                src="https://faltintravel.com/wp-content/uploads/2020/11/Special-Olympics-Switzerland.png"
                alt="Special Olympics Switzerland"
                width={240}
                height={73}
                className="h-auto"
              />
            </a>
            <a href="https://www.ekomi.de/bewertungen-faltintravelcom.html" className="text-sm italic font-semibold text-gray-200 hover:text-white transition">
              Ausgezeichnet durch das eKomi Siegel Gold!
            </a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm">
          <p>© 2026 Faltin Travel AG. Alle Rechte vorbehalten.</p>
        </div>
      </div>
    </footer>
  );
}
