import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker Production Build
  output: 'standalone',

  // @hello-pangea/dnd (Drag&Drop) bricht unter React-StrictMode im Dev-Modus -> aus.
  reactStrictMode: false,
  
  // SEO & Performance Optimierungen
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'superbowl.faltintravel.com'
      },
      {
        protocol: 'https',
        hostname: 'faltintravel.com'
      },
      {
        protocol: 'https',
        hostname: 'www.faltintravel.com'
      }
    ]
  },
  
  // Komprimierung aktivieren
  compress: true,
  
  // Strikte Sicherheit
  poweredByHeader: false,
  
  // Trailing Slash für SEO
  trailingSlash: false,
  
  // Headers für SEO & Sicherheit
  async headers() {
    // Globaler Noindex (Staging / vor Go-Live). Abschalten mit NOINDEX=false in der .env.
    const noindex = process.env.NOINDEX !== 'false';
    return [
      ...(noindex
        ? [{
            source: '/:path*',
            headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
          }]
        : []),
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      },
      // CORS für API Routes (WordPress läuft auf anderem Server!)
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://faltintravel.com' // Nur WordPress erlaubt
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS' // POST: Anfrageformular [faltin_anfrage] auf WordPress
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type'
          }
        ]
      },
      // WordPress Embedding erlauben (iFrame)
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL' // Erlaubt Embedding von überall
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *" // Erlaubt alle Parent-Domains
          }
        ]
      },
      // Booking Route ebenfalls
      {
        source: '/booking/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'
          }
        ]
      }
    ]
  },
  
  // Redirects (falls WordPress-URLs umgeleitet werden sollen)
  async redirects() {
    return [
      // Harte http -> https Weiterleitung (hinter Reverse-Proxy via x-forwarded-proto).
      // Behebt u.a. den Microsoft-SSO Redirect-URI-Mismatch (AADSTS50011) bei http-Aufruf.
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: 'https://next.faltintravel.com/:path*',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
