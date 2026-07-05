import type { Metadata } from 'next';
import SpaceGame from '@/components/games/SpaceGame';

export const metadata: Metadata = {
  title: 'Faltin One – Space Shooter | FT Arcade',
  robots: { index: false, follow: false },
};

export default function SpaceGamePage() {
  return <SpaceGame />;
}
