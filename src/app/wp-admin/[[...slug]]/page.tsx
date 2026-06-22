'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Gag-/Komfort-Weiterleitung: Wer aus WordPress-Gewohnheit /wp-admin (oder
 * /wp-admin/irgendwas) aufruft, bekommt kurz einen Spruch und landet dann im
 * echten Next-Admin (/admin).
 */
export default function WpAdminGag() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/admin'), 1900);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #143047 0%, #0d2030 100%)',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        zIndex: 9999,
      }}
    >
      <style>{`@keyframes ftpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.09) rotate(-3deg)}}@keyframes ftbar{from{width:0%}to{width:100%}}`}</style>

      <div style={{ fontSize: 76, animation: 'ftpulse 1s ease-in-out infinite' }}>🤦‍♂️</div>

      <h1 style={{ fontSize: 30, fontWeight: 900, margin: '20px 0 10px', lineHeight: 1.2 }}>
        Das ist kein WordPress, du Depp! <span style={{ color: '#d9531e' }}>😄</span>
      </h1>

      <p style={{ fontSize: 16, opacity: 0.82, maxWidth: 440, lineHeight: 1.55, margin: 0 }}>
        Alte Gewohnheit, was? Ich schmeiß dich ins <strong style={{ color: '#d9531e' }}>richtige</strong> Admin…
      </p>

      <div
        style={{
          marginTop: 30,
          width: 240,
          height: 6,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.15)',
          overflow: 'hidden',
        }}
      >
        <div style={{ height: '100%', borderRadius: 99, background: '#d9531e', animation: 'ftbar 1.9s linear forwards' }} />
      </div>

      <a
        href="/admin"
        style={{
          marginTop: 22,
          fontSize: 13,
          fontWeight: 700,
          color: '#fff',
          textDecoration: 'none',
          opacity: 0.7,
          borderBottom: '1px solid rgba(255,255,255,0.4)',
        }}
      >
        … oder direkt rein →
      </a>

      <p style={{ marginTop: 24, fontSize: 11, opacity: 0.45, letterSpacing: 1.5 }}>FALTIN&nbsp;TRAVEL · NEXT-ADMIN</p>
    </div>
  );
}
