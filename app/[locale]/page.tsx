'use client';

import { useState } from 'react';
import { useRouter } from '@/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Heart, BookOpen, Wand2, Star, Baby, Camera, Palette, Download, ChevronRight } from 'lucide-react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

// Coming Soon Page Component
function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Add email collection logic
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100/40 via-pink-50/30 to-purple-50/40 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-3xl">
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-2xl border border-white/50 p-8 sm:p-10 md:p-16">
          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-6 sm:mb-8"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={1.5} />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-center mb-4 sm:mb-6"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3 sm:mb-4">
              Us & Then
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-700 font-medium">
              Create Beautiful Memory Books
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-center text-gray-600 text-base sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto leading-relaxed px-2"
          >
            Transform your precious memories into personalized, illustrated storybooks.
            Powered by AI, crafted with love.
          </motion.p>

          {/* Divider */}
          <div className="flex items-center justify-center mb-6 sm:mb-8">
            <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-purple-300 to-transparent" />
            <span className="mx-3 sm:mx-4 text-xs sm:text-sm text-purple-400 font-medium tracking-wider">COMING SOON</span>
            <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-pink-300 to-transparent" />
          </div>

          {/* Email Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="max-w-md mx-auto mb-10"
          >
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="w-full px-6 py-4 rounded-xl bg-white/80 border-2 border-purple-200 focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all text-gray-800 placeholder:text-gray-400"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  Get Notified
                </motion.button>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 bg-purple-50 rounded-xl"
              >
                <p className="text-purple-700 font-semibold text-lg">
                  Thank you for joining our waitlist!
                </p>
                <p className="text-gray-600 mt-2">
                  We'll notify you when we launch.
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 md:gap-6 text-center"
          >
            <div className="px-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">AI Illustrations</h3>
              <p className="text-xs sm:text-sm text-gray-600">Beautiful paper-collage artwork</p>
            </div>

            <div className="px-4">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">Your Story</h3>
              <p className="text-xs sm:text-sm text-gray-600">Personalized narratives</p>
            </div>

            <div className="px-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">Hardcover Books</h3>
              <p className="text-xs sm:text-sm text-gray-600">Premium printed editions</p>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-center text-gray-500 text-sm mt-8"
        >
          © 2025 Us & Then
        </motion.p>
      </div>
    </div>
  );
}

// Full Landing Page Component
function LandingPage() {
  const router = useRouter();
  const t = useTranslations();
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const features = [
    {
      icon: Baby,
      title: t('landing.features.shareMemory.title'),
      description: t('landing.features.shareMemory.description'),
      gradient: "from-purple-400 to-pink-400"
    },
    {
      icon: Wand2,
      title: t('landing.features.aiMagic.title'),
      description: t('landing.features.aiMagic.description'),
      gradient: "from-blue-400 to-purple-400"
    },
    {
      icon: Camera,
      title: t('landing.features.babyStars.title'),
      description: t('landing.features.babyStars.description'),
      gradient: "from-pink-400 to-orange-400"
    },
    {
      icon: Palette,
      title: t('landing.features.artStyle.title'),
      description: t('landing.features.artStyle.description'),
      gradient: "from-green-400 to-blue-400"
    },
    {
      icon: BookOpen,
      title: t('landing.features.preview.title'),
      description: t('landing.features.preview.description'),
      gradient: "from-orange-400 to-red-400"
    },
    {
      icon: Download,
      title: t('landing.features.download.title'),
      description: t('landing.features.download.description'),
      gradient: "from-indigo-400 to-purple-400"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
            <span className="font-patrick text-xl sm:text-2xl gradient-text">{t('landing.title')}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <Link href="/dashboard" className="btn-ghost text-sm sm:text-base px-2 sm:px-4">{t('nav.myBooks')}</Link>
            <Link href="/create" className="btn-primary text-sm sm:text-base px-3 sm:px-6">{t('nav.create')}</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 sm:px-6 pt-24 pb-16 sm:pt-32 sm:pb-24 lg:py-40">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-5xl text-center"
        >
          <motion.div
            className="mb-6 sm:mb-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 px-3 py-1.5 sm:px-4 sm:py-2"
            whileHover={{ scale: 1.05 }}
          >
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            <span className="text-xs sm:text-sm font-medium text-purple-700">{t('landing.badge')}</span>
          </motion.div>

          <h1 className="font-patrick text-5xl sm:text-7xl md:text-8xl lg:text-9xl gradient-text mb-4 sm:mb-6 leading-tight">
            {t('landing.title')}
          </h1>

          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-gray-700 mb-6 sm:mb-8 font-light px-2">
            {t('landing.subtitle')}
            <span className="font-semibold gradient-text"> {t('landing.subtitleHighlight')}</span>
          </p>

          <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-4">
            {t('landing.description')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center px-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/create')}
              className="btn-primary text-base sm:text-lg md:text-xl px-6 py-3 sm:px-8 sm:py-4 md:px-10 md:py-5 flex items-center justify-center gap-2 sm:gap-3 shadow-2xl"
            >
              <Wand2 className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="whitespace-nowrap">{t('landing.ctaPrimary')}</span>
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/dashboard')}
              className="btn-secondary text-base sm:text-lg md:text-xl px-6 py-3 sm:px-8 sm:py-4 md:px-10 md:py-5 flex items-center justify-center gap-2 sm:gap-3"
            >
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="whitespace-nowrap">{t('landing.ctaSecondary')}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Floating decorative elements - hidden on mobile */}
        <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-20 left-10"
            animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Star className="h-8 w-8 lg:h-10 lg:w-10 text-yellow-400 fill-yellow-400" />
          </motion.div>
          <motion.div
            className="absolute top-40 right-20"
            animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            <Heart className="h-10 w-10 lg:h-12 lg:w-12 text-pink-400 fill-pink-400" />
          </motion.div>
          <motion.div
            className="absolute bottom-20 left-1/4"
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 3.5, repeat: Infinity }}
          >
            <Baby className="h-12 w-12 lg:h-14 lg:w-14 text-purple-400" />
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 lg:py-20 bg-white/50">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-patrick mb-3 sm:mb-4 gradient-text">
              {t('landing.howItWorks.title')}
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-4">
              {t('landing.howItWorks.subtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  onMouseEnter={() => setHoveredFeature(index)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  className="card-magical card-hover relative overflow-hidden group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                  <div className="relative z-10">
                    <div className={`mb-4 sm:mb-6 inline-flex p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg`}>
                      <Icon className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2 sm:mb-3 text-gray-800">{feature.title}</h3>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{feature.description}</p>
                    <div className="mt-3 sm:mt-4 flex items-center text-purple-600 font-medium">
                      <span className="text-3xl sm:text-4xl font-patrick mr-2 sm:mr-3">{index + 1}</span>
                      <ChevronRight className={`h-4 w-4 sm:h-5 sm:w-5 transform transition-transform ${hoveredFeature === index ? 'translate-x-2' : ''}`} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-purple-100 px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p className="mb-2 sm:mb-4 text-sm sm:text-base">{t('landing.footer.copyright')}</p>
        </div>
      </footer>
    </div>
  );
}

// Main Page Component with Conditional Rendering
export default function HomePage() {
  // Coming soon mode is ON by default unless explicitly disabled
  // Set NEXT_PUBLIC_COMING_SOON_MODE=false to show the full website
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE !== 'false';

  // Render coming soon page or full landing page based on environment variable
  return isComingSoonMode ? <ComingSoonPage /> : <LandingPage />;
}
