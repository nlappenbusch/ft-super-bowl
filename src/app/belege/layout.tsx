import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Faltin Belege',
  description: 'Belege und Spesen erfassen – Faltin Travel',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Belege', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#143047',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function BelegeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
