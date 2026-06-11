import type { Metadata } from "next";
import Script from "next/script";
import "./embed-styles.css";

export const metadata: Metadata = {
  title: 'Super Bowl LXI 2027 Tickets & Packages | Faltin Travel',
  description: 'Offizielle Super Bowl LXI 2027 Packages inkl. Tickets, Hotel & VIP-Hospitality.',
};

// Minimales Layout für WordPress-Embedding (ohne Navigation)
// WICHTIG: Kein <html>/<body> hier - wird vom Root-Layout übernommen
export default function EmbedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      
      {/* Auto-Resize für WordPress iFrame */}
      <Script id="iframe-resize" strategy="afterInteractive">
        {`
          // Sendet die Höhe an das Parent-Window (WordPress)
          const sendHeight = () => {
            const height = document.body.scrollHeight;
            window.parent.postMessage({ frameHeight: height }, '*');
          };
          
          // Bei Seitenload und Resize
          if (window.self !== window.top) {
            // Nur wenn in iframe
            window.addEventListener('load', sendHeight);
            window.addEventListener('resize', sendHeight);
            
            // Für dynamische Inhalte
            const observer = new MutationObserver(sendHeight);
            observer.observe(document.body, { 
              childList: true, 
              subtree: true,
              attributes: true 
            });
            
            // Initial nach kurzer Verzögerung
            setTimeout(sendHeight, 100);
            setTimeout(sendHeight, 500);
            setTimeout(sendHeight, 1000);
          }
        `}
      </Script>
    </>
  );
}
