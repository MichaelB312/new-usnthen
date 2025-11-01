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

  // COMING SOON MODE: Check environment variable
  // Set NEXT_PUBLIC_COMING_SOON_MODE=true in Vercel to enable coming soon mode
  // Set NEXT_PUBLIC_COMING_SOON_MODE=false (or unset) to go live
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';

  // Allow API routes and static files to always pass through
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return intlMiddleware(request);
  }

  // COMING SOON MODE: Redirect all non-home pages to home page
  if (isComingSoonMode) {
    // Extract locale from pathname (e.g., /en/create -> /en)
    const locale = pathname.split('/')[1];
    const pathWithoutLocale = pathname.slice(locale.length + 1); // Remove /locale part

    // Redirect any non-home pages to home page (with locale)
    if (pathWithoutLocale && pathWithoutLocale !== '/' && locales.includes(locale as any)) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
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
