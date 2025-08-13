import type { Metadata } from 'next';
import { Patrick_Hand, Inter, Caveat } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/components/providers/AuthProvider';

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

export const metadata: Metadata = {
  title: 'Us & Then - Baby Memory Storybooks',
  description: 'Transform your precious baby memories into magical AI-illustrated storybooks',
  icons: {
    icon: '/favicon.ico'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${patrickHand.variable} ${caveat.variable}`}>
      <body className="font-sans bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 min-h-screen">
        <AuthProvider>
          {children}
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
