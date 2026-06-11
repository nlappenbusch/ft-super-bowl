'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import EkomiScripts from '@/components/EkomiScripts';
import CategoryTile from '@/components/CategoryTile';
import { generateOrganizationSchema } from '@/lib/schema';
import { toCategorySlug } from '@/lib/category';
import { getCategoryTileStyle } from '@/lib/categoryTileConfig';

export default function Home() {
  const [series, setSeries] = useState<
    Array<{
      id: string;
      slug: string;
      title: string;
      description?: string | null;
      category: string;
      hero_image?: string | null;
      status?: string | null;
    }>
  >([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  useEffect(() => {
    const loadSeries = async () => {
      setSeriesLoading(true);
      try {
        const response = await fetch('/api/series');
        const result = await response.json();
        if (result?.success) {
          setSeries(result.data || []);
        }
      } catch (error) {
        console.error('Series load error:', error);
      } finally {
        setSeriesLoading(false);
      }
    };

    loadSeries();
  }, []);

  const activeSeries = series.filter((item) => item.status !== 'archived');
  const groupedSeries = Object.entries(
    activeSeries.reduce((groups: Record<string, typeof series>, item) => {
      const key = item.category || 'Sonstiges';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {})
  );

  const categoryTiles = groupedSeries.map(([category]) => {
    const slug = toCategorySlug(category);
    const style = getCategoryTileStyle(category);

    return {
      href: `/kategorie/${slug}`,
      title: style.title,
      description: style.description,
      image: style.image,
      panelColor: style.panelColor
    };
  });

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationSchema()) }}
      />

      <section className="py-16 px-4 relative overflow-hidden" style={{ backgroundImage: 'linear-gradient(202deg, #184a7b 0%, #143047 100%)' }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.22), transparent 55%), radial-gradient(circle at 80% 10%, rgba(241, 70, 36, 0.2), transparent 50%)'
          }}
        />
        <div className="container mx-auto relative">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-[0.3em] text-blue-100/80">Faltin Travel</div>
            <h1
              className="text-4xl md:text-5xl font-bold mt-3 text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Unsere Eventreise Kategorien
            </h1>
            <p className="text-blue-100/85 max-w-2xl mx-auto mt-3">
              Waehlen Sie eine Kategorie und entdecken Sie passende Serien und Events.
            </p>
          </div>

          {seriesLoading && (
            <p className="text-center text-blue-100/80">Serien werden geladen...</p>
          )}

          {!seriesLoading && series.length === 0 && (
            <p className="text-center text-blue-100/80">Aktuell sind keine Serien hinterlegt.</p>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {categoryTiles.map((tile, index) => (
              <div
                key={tile.href}
                className={`ft-category-column et_pb_column et_pb_column_1_3 et_pb_css_mix_blend_mode_passthrough${index === categoryTiles.length - 1 ? ' et_pb_column_4 et-last-child' : ''}`}
              >
                <CategoryTile
                  href={tile.href}
                  title={tile.title}
                  description={tile.description}
                  image={tile.image}
                  panelColor={tile.panelColor}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ backgroundColor: '#143047' }} className="text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="mb-10 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="shrink-0 rounded-xl bg-white p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                <Image
                  src="/RC_MatchShield_2027_RGB (1).svg"
                  alt="Ryder Cup 2027 Match Shield"
                  width={82}
                  height={82}
                  className="shrink-0"
                />
              </div>
              <div className="text-center sm:text-left">
                <p className="inline-flex items-center rounded-full border border-[#d89e2c]/45 bg-[#0f2742]/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-[#f2d49b]">
                  Authorized Distributor | Ryder Cup 2027
                </p>
                <p className="text-sm sm:text-base font-semibold text-white mt-2">
                  Offizieller Vertriebspartner
                </p>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5 leading-relaxed">
                  Faltin Travel ist stolz darauf, als Authorized Distributor offizieller Vertriebspartner für den Ryder Cup 2027 zu sein.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-white font-bold mb-4">Faltin Travel AG</h4>
              <p className="text-sm">Riedthofstrasse 172</p>
              <p className="text-sm">8105 Regensdorf, Schweiz</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Kontakt</h4>
              <p className="text-sm">TEL: +41 44 700 22 77</p>
              <p className="text-sm">info@faltintravel.com</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Rechtliches</h4>
              <ul className="text-sm space-y-2">
                <li><Link href="/impressum" className="hover:opacity-80 transition">Impressum</Link></li>
                <li><Link href="/datenschutz" className="hover:opacity-80 transition">Datenschutz</Link></li>
                <li><Link href="/agb" className="hover:opacity-80 transition">AGB</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Geschaeftsfuehrung</h4>
              <p className="text-sm">Inhaber: Stefan Faltin</p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm">
            <p>© 2026 Faltin Travel AG. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>

      <EkomiScripts />
    </div>
  );
}
