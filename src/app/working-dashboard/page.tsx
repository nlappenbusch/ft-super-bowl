import type { Metadata } from 'next';
import AdminShell from '@/components/admin/AdminShell';
import Workspace from '@/components/workspace/Workspace';

export const metadata: Metadata = {
  title: 'KI-Arbeitsplatz',
  robots: { index: false, follow: false },
};

/**
 * /working-dashboard — der KI-Arbeitsplatz für Mitarbeitende: persönliche Faltin-KI
 * (Chat mit Portal-Werkzeugen), Tagesüberblick, sortierter Posteingang, Teamwissen
 * und Werkstatt für neue Werkzeuge. Geschützt über die Middleware (Admin-Login).
 */
export default function WorkingDashboardPage() {
  return (
    <AdminShell title="KI-Arbeitsplatz" fullBleed>
      <Workspace />
    </AdminShell>
  );
}
