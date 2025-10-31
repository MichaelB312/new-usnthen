'use client';

import { BookType, BOOK_TYPE_CONFIGS } from '@/lib/types/bookTypes3';
import { useBookStore } from '@/lib/store/bookStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Heart, Home, BookOpen, Play, X, Info } from 'lucide-react';
import { useState } from 'react';

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

// Example data for each book type
const bookExamples = {
  [BookType.SPECIAL_MOMENT]: {
    videoPlaceholder: '/videos/special-moment-example.mp4',
    bookImages: [
      '/images/examples/special-moment-cover.jpg',
      '/images/examples/special-moment-spread1.jpg',
      '/images/examples/special-moment-spread2.jpg'
    ],
    realExample: 'A Day at the Beach with Emma',
    pages: [
      'Emma saw the ocean for the very first time...',
      'The waves went whoooosh! She giggled and clapped...',
      'Daddy held her hand as tiny toes touched the water...'
    ]
  },
  [BookType.GROWTH_STORY]: {
    videoPlaceholder: '/videos/growth-story-example.mp4',
    bookImages: [
      '/images/examples/growth-story-cover.jpg',
      '/images/examples/growth-story-spread1.jpg',
      '/images/examples/growth-story-spread2.jpg'
    ],
    realExample: 'Oliver Learns to Walk',
    pages: [
      'First, Oliver pulled himself up on the coffee table...',
      'He practiced with his little walker, back and forth...',
      'Then one day—one magical day—he took his first steps!'
    ]
  },
  [BookType.TRIBUTE_BOOK]: {
    videoPlaceholder: '/videos/tribute-book-example.mp4',
    bookImages: [
      '/images/examples/tribute-book-cover.jpg',
      '/images/examples/tribute-book-spread1.jpg',
      '/images/examples/tribute-book-spread2.jpg'
    ],
    realExample: 'Why I Love Grandma Sarah',
    pages: [
      'Grandma makes the best cookies in the whole world...',
      'She reads me stories with funny voices...',
      'Her hugs are warm like sunshine...'
    ]
  },
  [BookType.SPECIAL_WORLD]: {
    videoPlaceholder: '/videos/special-world-example.mp4',
    bookImages: [
      '/images/examples/special-world-cover.jpg',
      '/images/examples/special-world-spread1.jpg',
      '/images/examples/special-world-spread2.jpg'
    ],
    realExample: 'Mia\'s Neighborhood',
    pages: [
      'Every morning, we walk past the blue house with the cat...',
      'The park has a big tree where birds sing...',
      'Our favorite coffee shop smells like cinnamon...'
    ]
  },
  [BookType.GUIDED_TEMPLATE]: {
    videoPlaceholder: '/videos/guided-template-example.mp4',
    bookImages: [
      '/images/examples/guided-template-cover.jpg',
      '/images/examples/guided-template-spread1.jpg',
      '/images/examples/guided-template-spread2.jpg'
    ],
    realExample: 'Your First Birthday',
    pages: [
      'One year ago, you arrived and changed everything...',
      'You learned to smile, to laugh, to crawl...',
      'Now you\'re ONE! Let\'s celebrate!'
    ]
  }
};

export default function BookTypeSelection({ onSelect }: BookTypeSelectionProps) {
  const setBookType = useBookStore((state) => state.setBookType);
  const [selectedForPreview, setSelectedForPreview] = useState<BookType | null>(null);

  const handleSelect = (bookType: BookType) => {
    setBookType(bookType);
    onSelect(bookType);
  };

  const handlePreview = (bookType: BookType, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    setSelectedForPreview(bookType);
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
          <h1 className="font-patrick text-5xl sm:text-6xl md:text-7xl gradient-text mb-6 leading-tight">
            What kind of book would you like to create?
          </h1>
          <p className="text-xl sm:text-2xl text-gray-700 font-light">
            Choose the story type that feels right for this moment
          </p>
        </motion.div>

        {/* Book Type Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.values(BOOK_TYPE_CONFIGS).map((config, index) => {
            const Icon = iconMap[config.id];
            const gradient = gradientMap[config.id];
            const example = bookExamples[config.id];

            return (
              <motion.div
                key={config.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all hover:shadow-2xl"
              >
                {/* Background Gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity group-hover:opacity-100`}
                />

                {/* Content */}
                <div className="relative z-10 p-8">
                  {/* Title */}
                  <h3 className="mb-3 text-2xl sm:text-3xl font-patrick text-gray-900">
                    {config.title}
                  </h3>

                  {/* Description */}
                  <p className="mb-4 text-base sm:text-lg text-gray-600 font-light leading-relaxed">
                    {config.description}
                  </p>

                  {/* Example Book Preview - Video Placeholder */}
                  <div className="mb-4 overflow-hidden rounded-lg">
                    {/* Video Thumbnail Placeholder */}
                    <div className="relative w-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg aspect-video flex items-center justify-center">
                      <Play className="h-8 w-8 text-gray-400" />
                      <div className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded">
                        30s
                      </div>
                    </div>
                  </div>

                  {/* Real Example Name */}
                  <div className="mb-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 p-3 border border-purple-100">
                    <p className="text-xs text-purple-600 font-medium mb-1">Real Example:</p>
                    <p className="text-sm font-semibold text-gray-900">{example.realExample}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handlePreview(config.id, e)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Info className="h-4 w-4" />
                      See Example
                    </button>
                    <button
                      onClick={() => handleSelect(config.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Choose
                      <svg
                        className="h-4 w-4"
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
                    </button>
                  </div>
                </div>
              </motion.div>
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
          <p className="text-lg text-gray-600 font-light">
            Not sure which one? Click "See Example" to preview each book type
          </p>
        </motion.div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {selectedForPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedForPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedForPreview(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>

              {/* Modal Content */}
              <div className="p-8">
                {/* Header */}
                <div className="mb-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-4 text-white shadow-lg">
                      {(() => {
                        const Icon = iconMap[selectedForPreview];
                        return <Icon className="h-8 w-8" />;
                      })()}
                    </div>
                    <div>
                      <h2 className="text-3xl sm:text-4xl font-patrick gradient-text">
                        {BOOK_TYPE_CONFIGS[selectedForPreview].title}
                      </h2>
                      <p className="text-lg sm:text-xl text-gray-700 font-light">
                        {bookExamples[selectedForPreview].realExample}
                      </p>
                    </div>
                  </div>
                  <p className="text-base sm:text-lg text-gray-700 font-light leading-relaxed">
                    {BOOK_TYPE_CONFIGS[selectedForPreview].description}
                  </p>
                </div>

                {/* Video Placeholder */}
                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-patrick text-gray-900 mb-4 flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Watch Example Video
                  </h3>
                  <div className="relative w-full aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
                    <div className="text-center">
                      <Play className="h-16 w-16 text-white/80 mb-4 mx-auto" />
                      <p className="text-white/90 text-lg font-medium mb-2">
                        Video Example
                      </p>
                      <p className="text-white/60 text-sm">
                        See how "{bookExamples[selectedForPreview].realExample}" was created
                      </p>
                      <p className="text-white/40 text-xs mt-4">
                        Video placeholder - actual video coming soon
                      </p>
                    </div>
                  </div>
                </div>

                {/* Book Example Images */}
                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-patrick text-gray-900 mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Sample Pages
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {bookExamples[selectedForPreview].bookImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-xl overflow-hidden border-2 border-purple-100"
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center p-4">
                            <BookOpen className="h-12 w-12 text-purple-400 mb-3 mx-auto" />
                            <p className="text-sm text-gray-600 font-medium mb-2">
                              {idx === 0 ? 'Cover' : `Spread ${idx}`}
                            </p>
                            <p className="text-xs text-gray-500 italic leading-relaxed">
                              {bookExamples[selectedForPreview].pages[idx]}
                            </p>
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 text-xs bg-white/80 px-2 py-1 rounded">
                          {idx === 0 ? 'Cover' : `Page ${idx * 2}-${idx * 2 + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample Story Text */}
                <div className="mb-8 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                  <h3 className="text-xl sm:text-2xl font-patrick text-gray-900 mb-4">
                    Story Preview
                  </h3>
                  <div className="space-y-3">
                    {bookExamples[selectedForPreview].pages.map((page, idx) => (
                      <p key={idx} className="text-gray-700 italic leading-relaxed pl-4 border-l-4 border-purple-300">
                        "{page}"
                      </p>
                    ))}
                  </div>
                </div>

                {/* Choose Button */}
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      handleSelect(selectedForPreview);
                      setSelectedForPreview(null);
                    }}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-3"
                  >
                    Choose This Book Type
                    <svg
                      className="h-5 w-5"
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
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
