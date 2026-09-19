import { redirect } from 'next/navigation';

/** /admin/working-dashboard → der KI-Arbeitsplatz liegt unter /working-dashboard. */
export default function AdminWorkingDashboardRedirect() {
  redirect('/working-dashboard');
}
