import type { Metadata } from "next";
import { DM_Serif_Display, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBarWrapper from '@/components/NavBarWrapper';
import FooterWrapper from '@/components/FooterWrapper';
import { siteConfig } from '@/lib/siteConfig';
import { buildNavMenu } from '@/lib/navMenu';

// Inhalte (Menü, Events, Serien) kommen aus dateibasierten Stores, die zur Laufzeit
// im Volume liegen. Daher dynamisch rendern (sonst „friert" der Build-Zeit-Stand ein,
// da data/ beim Docker-Build via .dockerignore fehlt).
export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displayFont = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400"
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: '%s | Faltin Travel'
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords.split(',').map(k => k.trim()),
  authors: [{ name: siteConfig.company }],
  creator: siteConfig.company,
  publisher: siteConfig.company,
  openGraph: {
    type: 'website',
    locale: 'de_CH',
    url: siteConfig.url,
    siteName: 'Faltin Travel',
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.title
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.title,
    description: siteConfig.description,
    images: [siteConfig.ogImage]
  },
  // Globaler Noindex (Staging / vor Go-Live). Abschalten mit NOINDEX=false in der .env.
  robots: process.env.NOINDEX !== 'false'
    ? { index: false, follow: false, googleBot: { index: false, follow: false } }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
  verification: {
    google: 'your-google-verification-code',
  }
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const navMenu = await buildNavMenu();
  return (
    <html lang="de-CH" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} antialiased`}
        suppressHydrationWarning
      >
        <NavBarWrapper menu={navMenu} />
        {children}
        <FooterWrapper />
      </body>
    </html>
  );
}
