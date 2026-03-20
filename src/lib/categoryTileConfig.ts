import { toCategorySlug } from '@/lib/category';

export interface CategoryTileStyle {
  title: string;
  description: string;
  panelColor: string;
  image: string;
}

const categoryTileConfig: Record<string, CategoryTileStyle> = {
  sportevents: {
    title: 'Sport Events',
    description:
      'Top-Sportreisen mit Premium-Tickets und perfekter Organisation zu den gefragtesten Events weltweit.',
    panelColor: '#5b3ac7',
    image: '/header-neu1260-1.webp'
  },
  tennis: {
    title: 'Tennis Events',
    description:
      'Erleben Sie Grand Slams und ATP-Highlights live mit exklusiven Tickets und ausgewahlten Reisepaketen.',
    panelColor: '#3f6de0',
    image: '/Super-Bowl-LXI-Tickets-Packages.webp'
  },
  motorsport: {
    title: 'Motorsport & Radsport',
    description:
      'Action pur auf den bekanntesten Strecken Europas und weltweit mit Zugang zu den besten Seats.',
    panelColor: '#0e9aa7',
    image: '/Super-Bowl-2027-Ticketkategorien-SoFi-Stadium.webp'
  },
  'super-bowl': {
    title: 'Super Bowl',
    description:
      'Sichern Sie sich Ihr Super-Bowl-Erlebnis mit Hospitality, Top-Hotels und Rundum-Service vor Ort.',
    panelColor: '#4d5ac4',
    image: '/Super-Bowl-2027-Tickets.webp'
  },
  darts: {
    title: 'Darts WM',
    description:
      'Legendare Stimmung live erleben und das Ally-Pally-Feeling mit unseren Darts-Paketen sichern.',
    panelColor: '#136f96',
    image: '/Super-Bowl-LXI-Tickets.webp'
  },
  kulturevents: {
    title: 'Kultur Events & Konzerte',
    description:
      'Von Opernball bis Konzertabend: besondere Kulturmomente mit sorgfaltig kuratierten Eventreisen.',
    panelColor: '#b54f97',
    image: '/Super-Bowl-Hotels-Santa-Monica.webp'
  }
};

export function getCategoryTileStyle(categoryName: string): CategoryTileStyle {
  const slug = toCategorySlug(categoryName);

  for (const [key, value] of Object.entries(categoryTileConfig)) {
    if (slug.includes(key)) return value;
  }

  return {
    title: categoryName,
    description: 'Exklusive Eventreisen mit Tickets, Hotels und Services in einer Kategorie.',
    panelColor: '#315b93',
    image: '/header-neu1260-1.webp'
  };
}
