import { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/siteConfig'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `Faltin Travel – ${siteConfig.name}`,
    short_name: 'Faltin Travel',
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#184a7b',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
