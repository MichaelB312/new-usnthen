// components/illustrations/StyleSelector.tsx
'use client';
import { motion } from 'framer-motion';
import { Scissors, Droplets, Check } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';

type IllustrationStyle = 'paper-collage' | 'watercolor-ink';

interface StyleOption {
  id: IllustrationStyle;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
}

const styles: StyleOption[] = [
  {
    id: 'paper-collage',
    name: 'Paper Collage',
    description: 'Soft torn edges and pastel colors',
    icon: Scissors,
    recommended: true
  },
  {
    id: 'watercolor-ink',
    name: 'Watercolor & Ink',
    description: 'Transparent washes and delicate lines',
    icon: Droplets
  }
];

export function StyleSelector() {
  const { illustrationStyle, setIllustrationStyle } = useBookStore();

  return (
    <div className="mt-8 pt-6 border-t border-purple-200">
      <h3 className="text-lg sm:text-xl font-patrick text-center mb-4 text-gray-800">
        Choose Your Illustration Style
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto">
        {styles.map((style) => {
          const Icon = style.icon;
          const isSelected = illustrationStyle === style.id;

          return (
            <motion.button
              key={style.id}
              onClick={() => setIllustrationStyle(style.id)}
              className={`
                relative p-4 sm:p-5 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-purple-500 bg-purple-50/50 shadow-lg'
                  : 'border-purple-200 bg-white hover:border-purple-300 hover:shadow-md'
                }
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Recommended badge */}
              {style.recommended && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-md">
                  Recommended
                </div>
              )}

              {/* Selection indicator */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
                >
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                </motion.div>
              )}

              {/* Icon */}
              <div className={`
                mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-3
                ${isSelected
                  ? 'bg-purple-100'
                  : 'bg-purple-50'
                }
              `}>
                <Icon className={`
                  h-6 w-6 sm:h-7 sm:w-7
                  ${isSelected ? 'text-purple-600' : 'text-purple-500'}
                `} />
              </div>

              {/* Text */}
              <div className="text-center">
                <h4 className={`
                  font-semibold text-sm sm:text-base mb-1
                  ${isSelected ? 'text-purple-700' : 'text-gray-800'}
                `}>
                  {style.name}
                </h4>
                <p className="text-xs text-gray-600 leading-snug">
                  {style.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-xs sm:text-sm text-center text-gray-500 mt-4">
        The style will be applied to all illustrations in your book
      </p>
    </div>
  );
}
