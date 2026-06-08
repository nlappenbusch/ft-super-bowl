/**
 * siteConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central source of truth for all site-level branding.
 * Override any value via environment variables so the same codebase works for
 * any event (French Open, Super Bowl, Wimbledon, …) without code changes.
 *
 * Env vars (all optional – sensible defaults are provided):
 *   NEXT_PUBLIC_SITE_NAME          e.g. "French Open 2027"
 *   NEXT_PUBLIC_SITE_TITLE         e.g. "French Open 2027 Tickets & Packages | Faltin Travel"
 *   NEXT_PUBLIC_SITE_DESCRIPTION   SEO description
 *   NEXT_PUBLIC_SITE_KEYWORDS      comma-separated keywords
 *   NEXT_PUBLIC_SITE_URL           canonical URL  e.g. "https://frenchopen.faltintravel.com"
 *   NEXT_PUBLIC_OG_IMAGE           path to OG image, e.g. "/french-open-og.webp"
 *   NEXT_PUBLIC_ADMIN_PASSWORD     admin panel password
 *   NEXT_PUBLIC_BRAND_COLOR        primary hex color  e.g. "#143047"
 *   NEXT_PUBLIC_BRAND_ACCENT       accent hex color   e.g. "#d9531e"
 * ─────────────────────────────────────────────────────────────────────────────
 */

function env(key: string, fallback: string): string {
  return (typeof process !== 'undefined' && process.env?.[key]) || fallback;
}

export const siteConfig = {
  /** Short human-readable event/brand name, e.g. "French Open 2027" */
  name: env('NEXT_PUBLIC_SITE_NAME', 'Faltin Travel Sports Events'),

  /** Full <title> tag value */
  title: env(
    'NEXT_PUBLIC_SITE_TITLE',
    'Exklusive Sport-Reisepakete | Faltin Travel'
  ),

  /** Meta description */
  description: env(
    'NEXT_PUBLIC_SITE_DESCRIPTION',
    'Exklusive Reisepakete zu den weltgrößten Sportereignissen – Tickets, Hotel & VIP-Service aus einer Hand.'
  ),

  /** SEO keywords (comma-separated string → split at render time) */
  keywords: env(
    'NEXT_PUBLIC_SITE_KEYWORDS',
    'Sportreisen, VIP Tickets, Hospitality Packages, Faltin Travel'
  ),

  /** Canonical base URL */
  url: env('NEXT_PUBLIC_SITE_URL', 'https://faltintravel.com'),

  /** Open-Graph / Twitter card image */
  ogImage: env('NEXT_PUBLIC_OG_IMAGE', '/og-image.webp'),

  /** Admin panel password (fallback – always set via real env var in production) */
  adminPassword: env('NEXT_PUBLIC_ADMIN_PASSWORD', 'faltin-admin-2025'),

  /** Brand primary color */
  brandColor: env('NEXT_PUBLIC_BRAND_COLOR', '#143047'),

  /** Brand accent color */
  brandAccent: env('NEXT_PUBLIC_BRAND_ACCENT', '#d9531e'),

  /** Company name shown in footer / emails */
  company: env('NEXT_PUBLIC_COMPANY_NAME', 'Faltin Travel GmbH'),
} as const;

export type SiteConfig = typeof siteConfig;
