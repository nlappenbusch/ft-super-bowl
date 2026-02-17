import SuperBowlContent from '@/components/SuperBowlContent';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Super Bowl LXI 2027 Tickets & Packages | Faltin Travel',
  description: 'Offizielle Super Bowl LXI 2027 Packages inkl. Tickets, Hotel & VIP-Hospitality. 4 Nächte im Dream Hollywood Hotel + Premium Tickets. Jetzt buchen!',
  robots: {
    index: true,
    follow: true,
  },
};

// Diese Seite ist für WordPress-Embedding optimiert (ohne Header/Footer)
export default function EmbedPage() {
  return (
    <div className="wordpress-embed">
      <SuperBowlContent />
    </div>
  );
}
