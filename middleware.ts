import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Hide locale prefix for default locale (English)
  // URLs: /create (English), /de/create (German), /fr/create (French), etc.
  localePrefix: 'as-needed'
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // COMING SOON MODE: Check environment variable
  // Set NEXT_PUBLIC_COMING_SOON_MODE=true in Vercel to enable coming soon mode
  // Set NEXT_PUBLIC_COMING_SOON_MODE=false (or unset) to go live with full website
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';

  // Allow API routes and static files to always pass through
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return intlMiddleware(request);
  }

  // COMING SOON MODE: Redirect all pages to /coming-soon
  if (isComingSoonMode) {
    // Check if the first path segment is a locale (e.g., /de/create)
    const firstSegment = pathname.split('/')[1];
    const isLocaleInPath = firstSegment && locales.includes(firstSegment as any);

    if (isLocaleInPath) {
      // Non-English locale (e.g., /de/create)
      const pathWithoutLocale = pathname.slice(firstSegment.length + 1);
      // If not already on coming-soon page, redirect to it
      if (pathWithoutLocale !== '/coming-soon') {
        return NextResponse.redirect(new URL(`/${firstSegment}/coming-soon`, request.url));
      }
    } else {
      // English (default locale) - no prefix (e.g., /create)
      // If not already on coming-soon page, redirect to it
      if (pathname !== '/coming-soon') {
        return NextResponse.redirect(new URL('/coming-soon', request.url));
      }
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
