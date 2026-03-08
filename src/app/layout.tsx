import type { Metadata } from "next";
import { DM_Serif_Display, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  metadataBase: new URL('https://faltintravel.com'),
  title: {
    default: 'Super Bowl LXI 2027 Tickets & Packages | Faltin Travel',
    template: '%s | Faltin Travel'
  },
  description: 'Offizielle Super Bowl LXI 2027 Packages inkl. Tickets, Hotel & VIP-Hospitality. 4 Nächte im Dream Hollywood Hotel + Premium Tickets. Jetzt buchen!',
  keywords: ['Super Bowl 2027', 'Super Bowl LXI', 'Super Bowl Tickets', 'Super Bowl Packages', 'Los Angeles', 'SoFi Stadium', 'NFL Tickets', 'Sportreisen USA'],
  authors: [{ name: 'Faltin Travel' }],
  creator: 'Faltin Travel',
  publisher: 'Faltin Travel',
  openGraph: {
    type: 'website',
    locale: 'de_CH',
    url: 'https://faltintravel.com',
    siteName: 'Faltin Travel',
    title: 'Super Bowl LXI 2027 Tickets & Packages | Faltin Travel',
    description: 'Offizielle Super Bowl LXI 2027 Packages inkl. Tickets, Hotel & VIP-Hospitality. 4 Nächte im Dream Hollywood Hotel + Premium Tickets.',
    images: [
      {
        url: '/Super-Bowl-LXI-Tickets-Packages.webp',
        width: 1200,
        height: 630,
        alt: 'Super Bowl LXI 2027 Tickets & Packages'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Super Bowl LXI 2027 Tickets & Packages',
    description: 'Offizielle Super Bowl LXI 2027 Packages inkl. Tickets, Hotel & VIP-Hospitality.',
    images: ['/Super-Bowl-LXI-Tickets-Packages.webp']
  },
  robots: {
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
    google: 'your-google-verification-code', // TODO: Google Search Console Code einfügen
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de-CH" suppressHydrationWarning>
      <head>
        <link rel="canonical" href="https://faltintravel.com" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
