import { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/siteConfig'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${siteConfig.url.replace(/\/+$/, '')}/sitemap.xml`,
  }
}
