import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Faltin Files',
  robots: { index: false, follow: false },
};

export default function FilesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
