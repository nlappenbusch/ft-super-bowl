import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Faltin Travel - Super Bowl LXI 2027 Packages',
    short_name: 'Faltin Travel',
    description: 'Offizielle Super Bowl LXI 2027 Packages inkl. Tickets, Hotel & VIP-Hospitality',
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
