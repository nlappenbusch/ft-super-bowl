'use client';

import AdminShell from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/ui';
import BelegeDesk from '@/components/belege/BelegeDesk';
import { ExternalLink } from 'lucide-react';

export default function AdminBelegePage() {
  return (
    <AdminShell title="Belege & Spesen">
      <PageHeader
        title="Belege & Spesen"
        description="Quittungen und Rechnungen prüfen, kontieren, freigeben und an die Buchhaltung exportieren. Erfassen geht am schnellsten mit dem Handy."
        actions={
          <a href="https://belege.faltintravel.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ background: '#fff', color: '#143047', border: '1px solid #e5e8ed' }}>
            belege.faltintravel.com <ExternalLink className="h-4 w-4" />
          </a>
        }
      />
      <BelegeDesk />
    </AdminShell>
  );
}
