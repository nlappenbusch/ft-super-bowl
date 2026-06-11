import { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/siteConfig'

export default function robots(): MetadataRoute.Robots {
  // Globaler Noindex (Staging / vor Go-Live). Abschalten mit NOINDEX=false in der .env.
  if (process.env.NOINDEX !== 'false') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${siteConfig.url.replace(/\/+$/, '')}/sitemap.xml`,
  }
}
