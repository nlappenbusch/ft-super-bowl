import React from 'react';
import ShortcodePreviewLoader from './ShortcodePreviewLoader';

export const metadata = {
  title: 'WordPress Shortcode Test | Super Bowl LXI 2027',
  description: 'Test-Seite für alle WordPress Shortcode Varianten',
};

export default function ShortcodeTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-blue-900 mb-4">
            WordPress Shortcode Test
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Alle verfügbaren Shortcode-Varianten im Überblick
          </p>
          
          {/* Info Box */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg max-w-3xl mx-auto mb-8">
            <h3 className="text-lg font-bold text-blue-900 mb-3">🎯 Verfügbare Shortcodes:</h3>
            <div className="text-left space-y-2 text-sm font-mono bg-white p-4 rounded">
              <p>1. <code className="text-blue-600">[superbowl_package]</code></p>
              <p>2. <code className="text-green-600">[superbowl_package_advanced]</code> ⭐ MIT PERSONEN-AUSWAHL</p>
              <p>3. <code className="text-purple-600">[superbowl_faqs]</code></p>
              <p>4. <code className="text-orange-600">[superbowl_embed]</code></p>
            </div>
          </div>
        </div>

        {/* Variante 1: Standard Package Card */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                1. Standard Package Card
              </h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                Einfach
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded mb-4 border-l-4 border-blue-500">
              <p className="font-mono text-sm text-gray-700">
                [superbowl_package]
              </p>
            </div>
            <p className="text-gray-600 mb-4">
              Zeigt die Package-Karte mit festem Preis. Ideal für einfache Darstellung ohne Interaktion.
            </p>
          </div>
          
          {/* Live Preview */}
          <div className="bg-linear-to-br from-gray-50 to-gray-100 p-6 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-xs text-gray-500 mb-4 text-center">LIVE PREVIEW:</p>
            <div id="shortcode-preview-1">
              {/* Hier wird das Package geladen */}
            </div>
          </div>
        </section>

        {/* Variante 2: Advanced Package Card */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                2. Advanced Package Card ⭐
              </h2>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
                Empfohlen
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded mb-4 border-l-4 border-green-500">
              <p className="font-mono text-sm text-gray-700">
                [superbowl_package_advanced]
              </p>
            </div>
            <p className="text-gray-600 mb-4">
              <strong>NEU:</strong> Mit interaktiver Personen-Auswahl (1-10 Personen) und Live-Preisberechnung!
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm">
              <li>Dropdown zur Personenauswahl</li>
              <li>Preis passt sich automatisch an</li>
              <li>Zeigt Preis pro Person</li>
              <li>Voll responsive Design</li>
            </ul>
          </div>
          
          {/* Live Preview */}
          <div className="bg-linear-to-br from-green-50 to-green-100 p-6 rounded-lg border-2 border-dashed border-green-300">
            <p className="text-xs text-gray-500 mb-4 text-center">LIVE PREVIEW:</p>
            <div id="shortcode-preview-2">
              {/* Hier wird das Advanced Package geladen */}
            </div>
          </div>
        </section>

        {/* Variante 3: FAQs */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                3. FAQ Accordion
              </h2>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-semibold rounded-full">
                Content
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded mb-4 border-l-4 border-purple-500">
              <p className="font-mono text-sm text-gray-700">
                [superbowl_faqs]
              </p>
            </div>
            <p className="text-gray-600 mb-4">
              Zeigt häufig gestellte Fragen in einem Accordion-Design. Perfekt für Info-Seiten.
            </p>
          </div>
          
          {/* Live Preview */}
          <div className="bg-linear-to-br from-purple-50 to-purple-100 p-6 rounded-lg border-2 border-dashed border-purple-300">
            <p className="text-xs text-gray-500 mb-4 text-center">LIVE PREVIEW:</p>
            <div id="shortcode-preview-3">
              {/* Hier werden die FAQs geladen */}
            </div>
          </div>
        </section>

        {/* Variante 4: Full Page Embed */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                4. Full Page Embed (iFrame)
              </h2>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-semibold rounded-full">
                Vollansicht
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded mb-4 border-l-4 border-orange-500">
              <p className="font-mono text-sm text-gray-700">
                [superbowl_embed page=&quot;/&quot;]
              </p>
            </div>
            <p className="text-gray-600 mb-4">
              Bettet die komplette Next.js App als iFrame ein. Für eigenständige Seiten.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              ⚠️ Hinweis: Nutzt iFrame - kann Scroll-Probleme verursachen. Shortcodes 1-3 sind meist besser!
            </div>
          </div>
          
          {/* Info statt Preview */}
          <div className="bg-linear-to-br from-orange-50 to-orange-100 p-6 rounded-lg border-2 border-dashed border-orange-300">
            <p className="text-center text-gray-600">
              📺 Diese Variante würde die komplette App in einem iFrame laden.<br/>
              Aus Performance-Gründen hier nicht dargestellt.
            </p>
          </div>
        </section>

        {/* Technische Infos */}
  <section className="bg-linear-to-r from-blue-900 to-blue-800 text-white rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">💻 Technische Details</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold mb-3 text-blue-200">Installation:</h3>
              <ol className="space-y-2 text-sm">
                <li>1. Plugin hochladen: <code className="bg-blue-700 px-2 py-1 rounded">wordpress-plugin/superbowl-integration.php</code></li>
                <li>2. In WordPress aktivieren</li>
                <li>3. Shortcodes in Seiten einfügen</li>
              </ol>
            </div>
            
            <div>
              <h3 className="font-bold mb-3 text-blue-200">API Endpoints:</h3>
              <ul className="space-y-2 text-sm font-mono">
                <li className="bg-blue-700 px-2 py-1 rounded">/api/package</li>
                <li className="bg-blue-700 px-2 py-1 rounded">/api/package-advanced ⭐</li>
                <li className="bg-blue-700 px-2 py-1 rounded">/api/faqs</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 bg-blue-800 rounded-lg p-4">
            <p className="text-sm">
              📚 Vollständige Dokumentation: <code className="bg-blue-700 px-2 py-1 rounded ml-2">WORDPRESS-SHORTCODES-GUIDE.md</code>
            </p>
          </div>
        </section>

      </div>

      <ShortcodePreviewLoader />
    </div>
  );
}
