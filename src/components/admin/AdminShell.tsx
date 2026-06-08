'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminGate from './AdminGate';

interface AdminShellProps {
  title: string;
  children: React.ReactNode;
}

const navItems = [
  { href: '/admin', label: 'Buchungen' },
  { href: '/admin/crm', label: '🗂 CRM' },
  { href: '/admin/finanzen', label: '💶 Finanzen' },
  { href: '/admin/series', label: 'Serien' },
  { href: '/admin/categories', label: 'Kategorien SEO' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/packages', label: 'Packages' },
  { href: '/admin/faqs', label: 'FAQs' },
  { href: '/admin/pins', label: 'Lageplan-Icons' },
  { href: '/admin/settings', label: '⚙️ Einstellungen' },
];

export default function AdminShell({ title, children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <AdminGate title={title}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                  <p className="text-gray-600 mt-1">Admin Bereich</p>
                </div>
                <button
                  onClick={() => {
                    sessionStorage.removeItem('admin_authenticated');
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Abmelden
                </button>
              </div>
              <nav className="flex flex-wrap gap-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </AdminGate>
  );
}
