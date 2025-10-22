import { Patrick_Hand, Inter, Caveat } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/components/providers/AuthProvider';
import '../globals.css';

const patrickHand = Patrick_Hand({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-patrick'
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter'
});

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat'
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Validate that the incoming locale is valid
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Fetch messages for the current locale
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${patrickHand.variable} ${caveat.variable}`}>
      <body className="font-sans bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 min-h-screen">
        <AuthProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#363636',
                borderRadius: '1rem',
                padding: '1rem',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff'
                }
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff'
                }
              }
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
