// components/story-review/StoryReviewSpreads.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, Edit2, Check, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

interface StoryReviewProps {
  onContinue: () => void;
  onRegenerate: () => void;
}

interface PageData {
  pageIndex: number;
  pageLabel: string;
  text: string;
  pageNumber: number;
}

/**
 * Detect and highlight onomatopoeia (sound words) in text
 */
function highlightOnomatopoeia(text: string): JSX.Element[] {
  // Common onomatopoeia patterns
  const soundWords = [
    'splash', 'woosh', 'thump', 'bang', 'crash', 'pop', 'boom', 'zip',
    'giggle', 'laugh', 'cry', 'wah', 'haha', 'heehee', 'giggle',
    'swoosh', 'swish', 'whoosh', 'whizz', 'zoom',
    'munch', 'crunch', 'chomp', 'slurp', 'gulp',
    'knock', 'tap', 'click', 'clack', 'tick', 'tock',
    'beep', 'honk', 'vroom', 'choo', 'quack', 'moo', 'woof', 'meow',
    'squelch', 'squish', 'splat', 'plop', 'drip',
    'rustle', 'crackle', 'snap', 'crinkle',
    'pitter', 'patter', 'flutter', 'whisper'
  ];

  // Pattern 1: Uppercase words (e.g., SPLASH, WOOSH)
  // Pattern 2: Repeated words (e.g., splash, splash)
  // Pattern 3: Known sound words with punctuation (e.g., Splash!)

  const parts: JSX.Element[] = [];
  const regex = /\b([A-Z]{2,}(?:,?\s+[A-Z]{2,})*!?)|(\b\w+,\s*\w+!?)|(Splash!|Woosh!|Bang!|Thump!|Giggle!|Pop!|Boom!)/g;

  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const matchedText = match[0];
    const matchStart = match.index;

    // Check if it's uppercase or a known sound word
    const isUppercase = /^[A-Z]/.test(matchedText);
    const lowerMatch = matchedText.toLowerCase().replace(/[!,.\s]+/g, '');
    const isKnownSound = soundWords.some(word => lowerMatch.includes(word));
    const isRepeated = /(\w+),\s*\1/i.test(matchedText); // e.g., "splash, splash"

    if (isUppercase || isKnownSound || isRepeated) {
      // Add text before the match
      if (matchStart > lastIndex) {
        parts.push(<span key={`text-${keyIndex++}`}>{text.slice(lastIndex, matchStart)}</span>);
      }

      // Add highlighted sound word
      parts.push(
        <span
          key={`sound-${keyIndex++}`}
          className="onomatopoeia font-bold bg-gradient-to-r from-yellow-100 to-yellow-200 px-1.5 py-0.5 rounded-md inline-block mx-0.5"
        >
          {matchedText}
        </span>
      );

      lastIndex = matchStart + matchedText.length;
    }
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${keyIndex++}`}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [<span key="all">{text}</span>];
}

export function StoryReviewSpreads({ onContinue, onRegenerate }: StoryReviewProps) {
  const { storyData, babyProfile } = useBookStore();
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editedNarration, setEditedNarration] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  // Build pages array (NEW: Each page is displayed separately)
  const pages: PageData[] = [];
  if (storyData?.pages) {
    storyData.pages.forEach((page, index) => {
      pages.push({
        pageIndex: index,
        pageLabel: `Page ${page.page_number}`,
        text: page.narration || '',
        pageNumber: page.page_number
      });
    });
  }

  const handleEditPage = (pageIndex: number) => {
    const page = pages[pageIndex];
    if (page) {
      setEditingPage(pageIndex);
      setEditedNarration(page.text);
    }
  };

  const savePageEdit = () => {
    if (editingPage === null || !storyData) return;

    // Update the specific page's narration
    const updatedPages = storyData.pages.map((page, idx) => {
      if (idx === editingPage) {
        return { ...page, narration: editedNarration };
      }
      return page;
    });

    useBookStore.setState({
      storyData: {
        ...storyData,
        pages: updatedPages
      }
    });

    setEditingPage(null);
    toast.success('Page updated!');
  };

  if (!storyData?.pages || pages.length === 0) return null;

  const totalPages = pages.length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-magical text-center"
      >
        <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-4">
          <BookOpen className="h-12 w-12 text-purple-600" />
        </div>
        <h2 className="text-4xl font-patrick gradient-text mb-3">
          {storyData.title}
        </h2>
        <p className="text-xl text-gray-600">
          A magical story for {babyProfile?.baby_name}
        </p>
        {storyData.refrain && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-purple-600 font-medium mt-3 italic"
          >
            ✨ "{storyData.refrain}" ✨
          </motion.p>
        )}
      </motion.div>

      {/* Story Pages Carousel */}
      <div className="card-magical">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Page Content */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 min-h-[300px] flex items-center justify-center">
              {editingPage === currentPage ? (
                <div className="w-full space-y-4">
                  <textarea
                    value={editedNarration}
                    onChange={(e) => setEditedNarration(e.target.value)}
                    className="w-full p-4 text-lg font-patrick text-gray-700 bg-white rounded-xl resize-none focus:outline-none focus:ring-4 focus:ring-purple-200 shadow-inner"
                    rows={6}
                    autoFocus
                  />
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={savePageEdit}
                      className="btn-primary text-sm py-2 px-6 flex items-center gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingPage(null)}
                      className="btn-secondary text-sm py-2 px-6"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4 max-w-2xl">
                  <motion.p
                    className="text-2xl font-patrick text-gray-700 leading-relaxed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {highlightOnomatopoeia(pages[currentPage].text)}
                  </motion.p>

                  <button
                    onClick={() => handleEditPage(currentPage)}
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1 mx-auto mt-4"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center text-sm">
              <span className="text-purple-600 font-medium">
                Page {currentPage + 1} of {totalPages}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </button>

          {/* Progress Dots */}
          <div className="flex gap-2">
            {pages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index)}
                className={`transition-all ${
                  currentPage === index
                    ? 'w-8 h-2 bg-purple-600 rounded-full'
                    : 'w-2 h-2 bg-gray-300 hover:bg-gray-400 rounded-full'
                }`}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage >= totalPages - 1}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card-magical"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={onRegenerate}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-5 w-5" />
            Regenerate Story
          </button>
          
          <button
            onClick={onContinue}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Sparkles className="h-5 w-5" />
            Continue to Illustrations
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Review your story and make any edits before continuing
        </p>
      </motion.div>
    </div>
  );
}