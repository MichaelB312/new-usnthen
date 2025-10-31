'use client';

import { WritingStyle, WRITING_STYLE_CONFIGS } from '@/lib/types/bookTypes3';
import { useBookStore } from '@/lib/store/bookStore';
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { useState } from 'react';

interface WritingStyleSelectionProps {
  onSelect: (style: WritingStyle) => void;
}

const backgroundPatternMap = {
  [WritingStyle.WARM_HEARTFELT]: 'bg-gradient-to-br from-red-50 to-orange-50',
  [WritingStyle.RHYME_RHYTHM]: 'bg-gradient-to-br from-purple-50 to-pink-50',
  [WritingStyle.FUNNY_PLAYFUL]: 'bg-gradient-to-br from-yellow-50 to-amber-50',
  [WritingStyle.SIMPLE_CLEAR]: 'bg-gradient-to-br from-blue-50 to-cyan-50'
};

const accentColorMap = {
  [WritingStyle.WARM_HEARTFELT]: 'text-red-600 border-red-500',
  [WritingStyle.RHYME_RHYTHM]: 'text-purple-600 border-purple-500',
  [WritingStyle.FUNNY_PLAYFUL]: 'text-amber-600 border-amber-500',
  [WritingStyle.SIMPLE_CLEAR]: 'text-blue-600 border-blue-500'
};

export default function WritingStyleSelection({ onSelect }: WritingStyleSelectionProps) {
  const setWritingStyle = useBookStore((state) => state.setWritingStyle);
  const bookType = useBookStore((state) => state.bookType);
  const [hoveredStyle, setHoveredStyle] = useState<WritingStyle | null>(null);

  const handleSelect = (style: WritingStyle) => {
    setWritingStyle(style);
    onSelect(style);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 text-center"
        >
          <h1 className="font-patrick text-4xl sm:text-5xl md:text-6xl gradient-text mb-4 leading-tight">
            Choose your story's voice
          </h1>
          <p className="text-lg sm:text-xl text-gray-700 font-light">
            How would you like this story to sound?
          </p>
        </motion.div>

        {/* Style Cards - Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.values(WRITING_STYLE_CONFIGS).map((config, index) => {
            const bgPattern = backgroundPatternMap[config.id];
            const accentColor = accentColorMap[config.id];
            const isHovered = hoveredStyle === config.id;

            return (
              <motion.button
                key={config.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                onClick={() => handleSelect(config.id)}
                onMouseEnter={() => setHoveredStyle(config.id)}
                onMouseLeave={() => setHoveredStyle(null)}
                className={`group relative w-full overflow-hidden rounded-xl bg-white p-5 text-left shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02] ${
                  isHovered ? 'ring-4 ring-purple-400' : ''
                }`}
              >
                {/* Background Pattern */}
                <div
                  className={`absolute inset-0 ${bgPattern} opacity-0 transition-opacity group-hover:opacity-100`}
                />

                {/* Content */}
                <div className="relative z-10 flex items-start gap-4">
                  {/* Icon & Emoji */}
                  <div className="flex-shrink-0">
                    <div className={`rounded-lg border-3 ${accentColor} bg-white p-3 shadow-md group-hover:shadow-lg transition-shadow`}>
                      <span className="text-3xl">{config.emoji}</span>
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="flex-grow">
                    {/* Title & Description */}
                    <div className="mb-3">
                      <h3 className={`mb-1 text-xl sm:text-2xl font-patrick ${accentColor.split(' ')[0]}`}>
                        {config.title}
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 font-light">
                        {config.description}
                      </p>
                    </div>

                    {/* Micro Preview */}
                    <div className="relative rounded-lg bg-white/80 p-3 border-2 border-gray-200 group-hover:border-purple-300 transition-colors">
                      <div className="flex items-start gap-2">
                        <Volume2 className={`flex-shrink-0 h-4 w-4 mt-0.5 ${accentColor.split(' ')[0]}`} />
                        <p className={`text-sm sm:text-base italic leading-relaxed ${accentColor.split(' ')[0]} font-light`}>
                          "{config.microPreview}"
                        </p>
                      </div>
                    </div>

                    {/* Hover CTA */}
                    <div className={`mt-3 flex items-center text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity ${accentColor.split(' ')[0]}`}>
                      <span>Choose this style</span>
                      <svg
                        className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform"
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
          className="mt-8 text-center"
        >
          <p className="text-base text-gray-600 font-light">
            You'll be able to try different styles and compare them later
          </p>
        </motion.div>
      </div>
    </div>
  );
}
