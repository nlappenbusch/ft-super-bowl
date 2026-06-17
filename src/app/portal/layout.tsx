import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Faltin Reiseportal',
  description: 'Ihr persönliches Reiseportal – Anfragen, Nachrichten und Unterlagen.',
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#eef1f5', fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif", color: '#143047' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e8ed' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/portal/app" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#143047', letterSpacing: 0.3 }}>Faltin&nbsp;Travel</span>
            <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: '#d9531e', textTransform: 'uppercase', letterSpacing: 2 }}>Reiseportal</span>
          </Link>
        </div>
        <div style={{ height: 3, background: '#d9531e' }} />
      </header>
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px 60px' }}>{children}</main>
      <footer style={{ textAlign: 'center', padding: '24px', fontSize: 12, color: '#9ca3af' }}>
        © 2026 Faltin Travel AG · Schweizer Reisegarantie
      </footer>
    </div>
  );
}
