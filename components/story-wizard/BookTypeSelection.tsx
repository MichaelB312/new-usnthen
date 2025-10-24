'use client';

import { BookType, BOOK_TYPE_CONFIGS } from '@/lib/types/bookTypes3';
import { useBookStore } from '@/lib/store/bookStore';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Heart, Home, BookOpen } from 'lucide-react';

interface BookTypeSelectionProps {
  onSelect: (bookType: BookType) => void;
}

const iconMap = {
  [BookType.SPECIAL_MOMENT]: Sparkles,
  [BookType.GROWTH_STORY]: TrendingUp,
  [BookType.TRIBUTE_BOOK]: Heart,
  [BookType.SPECIAL_WORLD]: Home,
  [BookType.GUIDED_TEMPLATE]: BookOpen
};

const gradientMap = {
  [BookType.SPECIAL_MOMENT]: 'from-amber-500/20 via-orange-500/20 to-pink-500/20',
  [BookType.GROWTH_STORY]: 'from-green-500/20 via-emerald-500/20 to-teal-500/20',
  [BookType.TRIBUTE_BOOK]: 'from-pink-500/20 via-rose-500/20 to-red-500/20',
  [BookType.SPECIAL_WORLD]: 'from-blue-500/20 via-indigo-500/20 to-purple-500/20',
  [BookType.GUIDED_TEMPLATE]: 'from-purple-500/20 via-violet-500/20 to-fuchsia-500/20'
};

export default function BookTypeSelection({ onSelect }: BookTypeSelectionProps) {
  const setBookType = useBookStore((state) => state.setBookType);

  const handleSelect = (bookType: BookType) => {
    setBookType(bookType);
    onSelect(bookType);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h1 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">
            What kind of book would you like to create?
          </h1>
          <p className="text-xl text-gray-600">
            Choose the story type that feels right for this moment
          </p>
        </motion.div>

        {/* Book Type Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.values(BOOK_TYPE_CONFIGS).map((config, index) => {
            const Icon = iconMap[config.id];
            const gradient = gradientMap[config.id];

            return (
              <motion.button
                key={config.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                onClick={() => handleSelect(config.id)}
                className="group relative overflow-hidden rounded-2xl bg-white p-8 text-left shadow-lg transition-all hover:shadow-2xl hover:scale-105"
              >
                {/* Background Gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity group-hover:opacity-100`}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon & Emoji */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-3 text-white shadow-lg group-hover:shadow-xl transition-shadow">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-4xl">{config.emoji}</span>
                  </div>

                  {/* Title */}
                  <h3 className="mb-3 text-2xl font-bold text-gray-900">
                    {config.title}
                  </h3>

                  {/* Description */}
                  <p className="mb-4 text-gray-600 leading-relaxed">
                    {config.description}
                  </p>

                  {/* Example Prompt */}
                  <div className="mt-4 rounded-lg bg-gray-50 p-3 group-hover:bg-white/50 transition-colors">
                    <p className="text-sm italic text-gray-500">
                      "{config.examplePrompt}"
                    </p>
                  </div>

                  {/* Hover Arrow */}
                  <div className="mt-6 flex items-center text-purple-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Start this book</span>
                    <svg
                      className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Bottom Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-500">
            Don't worry, you can always customize your book later
          </p>
        </motion.div>
      </div>
    </div>
  );
}
