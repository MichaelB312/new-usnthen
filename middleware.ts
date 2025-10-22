import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Always show locale prefix in URL
  // URLs: /en/create, /de/create, /fr/create, etc.
  localePrefix: 'always'
});

export const config = {
  // Match all pathnames except for
  // - API routes
  // - _next (Next.js internals)
  // - files with extensions (e.g. .png, .jpg, .ico)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
