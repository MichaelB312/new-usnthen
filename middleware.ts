import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Always show locale prefix in URL
  // URLs: /en/create, /de/create, /fr/create, etc.
  localePrefix: 'always'
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // COMING SOON MODE: Redirect all pages except home to home page
  // Extract locale from pathname (e.g., /en/create -> /en)
  const locale = pathname.split('/')[1];
  const pathWithoutLocale = pathname.slice(locale.length + 1); // Remove /locale part

  // Allow API routes and static files to pass through
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return intlMiddleware(request);
  }

  // Redirect any non-home pages to home page (with locale)
  if (pathWithoutLocale && pathWithoutLocale !== '/' && locales.includes(locale as any)) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - API routes
  // - _next (Next.js internals)
  // - files with extensions (e.g. .png, .jpg, .ico)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
