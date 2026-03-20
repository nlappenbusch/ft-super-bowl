import Image from 'next/image';
import Link from 'next/link';

interface CategoryTileProps {
  href: string;
  title: string;
  description: string;
  image: string;
  panelColor: string;
}

export default function CategoryTile({ href, title, description, image, panelColor }: CategoryTileProps) {
  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-2xl shadow-[0_8px_22px_rgba(15,23,42,0.16)] bg-slate-900 block h-full flex flex-col transition-all duration-250 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(15,23,42,0.22)]"
    >
      <div className="relative h-44 w-full">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover transition-[filter] duration-400 ease-out group-hover:brightness-110 group-hover:saturate-115"
          sizes="(max-width: 1024px) 100vw, 33vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 to-transparent opacity-70 group-hover:opacity-55 transition-opacity duration-300" />
      </div>
      <div className="p-5 min-h-[200px] flex-1" style={{ backgroundColor: panelColor }}>
        <h3 className="text-white text-3xl font-semibold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        <p className="text-white/95 text-xl leading-relaxed mt-3">
          {description}
        </p>
      </div>
    </Link>
  );
}
