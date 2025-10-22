'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { localeNames, type Locale } from '@/i18n';
import { useBookStore } from '@/lib/store/bookStore';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const setLocale = useBookStore((state) => state.setLocale);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    // Update Zustand store
    setLocale(newLocale);

    // Close dropdown
    setIsOpen(false);

    // Navigate to the same page with new locale
    router.replace(pathname, { locale: newLocale });
  };

  const locales: Locale[] = ['en', 'de', 'fr', 'es', 'pt', 'it'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors"
        aria-label="Change language"
      >
        <Globe className="h-5 w-5 text-purple-600" />
        <span className="text-sm font-medium text-gray-700">{localeNames[locale]}</span>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-purple-100 py-1 z-50">
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-purple-50 transition-colors ${
                locale === loc ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700'
              }`}
            >
              {localeNames[loc]}
              {locale === loc && (
                <span className="ml-2 text-purple-600">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
