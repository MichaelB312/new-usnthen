'use client';

import { useState } from 'react';
import { useRouter } from '@/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Heart, BookOpen, Wand2, Star, Baby, Camera, Palette, Download, ChevronRight, Play } from 'lucide-react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

export default function HomePage() {
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
      {/* Navigation - NO AUTH CHECK */}
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