import type { Metadata } from 'next';
import HostessGame from '@/components/games/HostessGame';

export const metadata: Metadata = {
  title: 'Hospitality Hunt | FT Arcade',
  robots: { index: false, follow: false },
};

export default function HostessGamePage() {
  return <HostessGame />;
}
