'use client';

import AdminShell from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/ui';
import FilesApp from '@/components/files/FilesApp';
import { ExternalLink } from 'lucide-react';

export default function AdminFilesPage() {
  return (
    <AdminShell title="Dateien teilen">
      <PageHeader
        title="Dateien teilen"
        description="Dateien hochladen, Link an Kunden und Partner schicken. Nach Ablauf wird automatisch gelöscht."
        actions={
          <a href="https://files.faltintravel.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ background: '#fff', color: '#143047', border: '1px solid #e5e8ed' }}>
            files.faltintravel.com <ExternalLink className="h-4 w-4" />
          </a>
        }
      />
      <FilesApp />
    </AdminShell>
  );
}
