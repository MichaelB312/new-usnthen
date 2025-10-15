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
  visualAction: string;
  simpleDescription: string; // User-friendly simple description
}

/**
 * Extract ONLY the user-editable parts from visual_action
 * Users can ONLY edit: who is present + what they're doing (action/posture)
 * Everything else is LOCKED (camera angles, scene/setting, backgrounds, technical details)
 */
function extractSimpleDescription(visualAction: string, charactersOnPage: string[]): string {
  if (!visualAction) return '';

  // Remove ALL camera angle names and shot types
  let simple = visualAction
    .replace(/camera angle:.*?(?=\n|$)/gi, '')
    .replace(/shot:.*?(?=\n|$)/gi, '')
    .replace(/establishing wide|bird's-eye view|birds eye|discovery moment|over-the-shoulder|following behind|perfect profile|reflection shot|peek through frame|shadow silhouette|shadow & silhouette/gi, '')
    .replace(/close-up|wide shot|medium shot|macro|low angle|high angle|dutch angle|overhead|profile|silhouette/gi, '')
    // Remove ALL setting/scene/location descriptions
    .replace(/\b(beach|ocean|sea|water|sand|waves|shore|pool|park|garden|backyard|home|room|house|indoor|outdoor|setting|location|environment|scene|background|landscape)\b/gi, '')
    // Remove ALL technical photo/composition terms
    .replace(/lighting:.*?(?=\n|$)/gi, '')
    .replace(/color palette:.*?(?=\n|$)/gi, '')
    .replace(/background:.*?(?=\n|$)/gi, '')
    .replace(/composition:.*?(?=\n|$)/gi, '')
    .replace(/\b(lighting|shadows|highlights|contrast|exposure|focus|depth|framing|angle|perspective|view|shot)\b/gi, '')
    // Remove weather/time descriptions
    .replace(/\b(sunny|cloudy|rainy|sunset|sunrise|morning|afternoon|evening|night|golden hour|bright|dark)\b/gi, '')
    .trim();

  // Clean up extra whitespace and punctuation
  simple = simple
    .replace(/\s+/g, ' ')
    .replace(/[,.\s]+$/g, '')
    .replace(/^[,.\s]+/g, '')
    .trim();

  // If result is too short or empty, extract just the action verbs
  if (simple.length < 10) {
    // Try to extract action patterns like "sitting", "reaching", "playing", etc.
    const actionMatch = visualAction.match(/\b(sitting|standing|lying|crawling|reaching|grabbing|playing|laughing|smiling|looking|watching|holding|hugging|walking|running|jumping|splashing|discovering|exploring)\b/gi);
    if (actionMatch && actionMatch.length > 0) {
      const actors = charactersOnPage.length > 0 ? charactersOnPage.join(' and ') : 'Baby';
      simple = `${actors} ${actionMatch[0].toLowerCase()}`;
    }
  }

  // Truncate if too long (max 100 chars for simple description)
  if (simple.length > 100) {
    const firstSentence = simple.match(/^[^.!?]+[.!?]/)?.[0];
    simple = firstSentence || simple.substring(0, 100) + '...';
  }

  // Fallback if everything was filtered out
  return simple || `${charactersOnPage.join(' and ') || 'Baby'} in the scene`;
}

// Removed highlightOnomatopoeia function - no longer highlighting sound words

export function StoryReviewSpreads({ onContinue, onRegenerate }: StoryReviewProps) {
  const { storyData, babyProfile } = useBookStore();
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editedNarration, setEditedNarration] = useState('');
  const [editedSimpleDescription, setEditedSimpleDescription] = useState(''); // Only simple description
  const [currentPage, setCurrentPage] = useState(0);

  // Build pages array (NEW: Each page is displayed separately)
  const pages: PageData[] = [];
  if (storyData?.pages) {
    storyData.pages.forEach((page, index) => {
      const visualAction = page.visual_action || page.visual_prompt || '';
      pages.push({
        pageIndex: index,
        pageLabel: `Page ${page.page_number}`,
        text: page.narration || '',
        pageNumber: page.page_number,
        visualAction: visualAction, // Keep full technical version
        simpleDescription: extractSimpleDescription(visualAction, page.characters_on_page || [])
      });
    });
  }

  const handleEditPage = (pageIndex: number) => {
    const page = pages[pageIndex];
    if (page) {
      setEditingPage(pageIndex);
      setEditedNarration(page.text);
      setEditedSimpleDescription(page.simpleDescription); // Edit only simple description
    }
  };

  const savePageEdit = () => {
    if (editingPage === null || !storyData) return;

    // Update the specific page's narration and MERGE the simple description
    // Keep all technical details (camera angles, etc.) intact
    const updatedPages = storyData.pages.map((page, idx) => {
      if (idx === editingPage) {
        // Keep the original visual_action structure but update the core description
        // This preserves camera angles, lighting, etc. that the user shouldn't change
        const originalVisualAction = page.visual_action || page.visual_prompt || '';

        // Simple merge: if user edited the description, use it
        // Otherwise keep original
        const updatedVisualAction = editedSimpleDescription !== pages[editingPage].simpleDescription
          ? editedSimpleDescription
          : originalVisualAction;

        return {
          ...page,
          narration: editedNarration,
          visual_action: updatedVisualAction,
          visual_prompt: updatedVisualAction // Also update visual_prompt for compatibility
        };
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
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-magical text-center"
      >
        <div className="inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-3 sm:mb-4">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-purple-600" />
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-patrick gradient-text mb-2 sm:mb-3 px-4">
          {storyData.title}
        </h2>
        <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-4">
          A magical story for {babyProfile?.baby_name}
        </p>
        {storyData.refrain && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-purple-600 font-medium mt-2 sm:mt-3 italic text-sm sm:text-base px-4"
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
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 min-h-[250px] sm:min-h-[300px] flex items-center justify-center">
              {editingPage === currentPage ? (
                <div className="w-full space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                      Story Text
                    </label>
                    <textarea
                      value={editedNarration}
                      onChange={(e) => setEditedNarration(e.target.value)}
                      className="w-full p-3 sm:p-4 text-base sm:text-lg font-patrick text-gray-700 bg-white rounded-lg sm:rounded-xl resize-none focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-purple-200 shadow-inner"
                      rows={5}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2 sm:gap-3 justify-center">
                    <button
                      onClick={savePageEdit}
                      className="btn-primary text-xs sm:text-sm py-2 px-4 sm:px-6 flex items-center gap-2"
                    >
                      <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingPage(null)}
                      className="btn-secondary text-xs sm:text-sm py-2 px-4 sm:px-6"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-4 sm:space-y-6 max-w-3xl mx-auto px-2">
                  {/* Story Text */}
                  <div className="text-center">
                    <motion.p
                      className="text-lg sm:text-xl md:text-2xl font-patrick text-gray-700 leading-relaxed"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {pages[currentPage].text}
                    </motion.p>
                  </div>

                  <button
                    onClick={() => handleEditPage(currentPage)}
                    className="text-purple-600 hover:text-purple-700 text-xs sm:text-sm font-medium flex items-center gap-1 mx-auto mt-3 sm:mt-4"
                  >
                    <Edit2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    Edit Page
                  </button>
                </div>
              )}
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center text-xs sm:text-sm">
              <span className="text-purple-600 font-medium">
                Page {currentPage + 1} of {totalPages}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 sm:mt-8 gap-2 sm:gap-4">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="btn-secondary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </button>

          {/* Progress Dots */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto max-w-[150px] sm:max-w-none">
            {pages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index)}
                className={`transition-all flex-shrink-0 ${
                  currentPage === index
                    ? 'w-6 sm:w-8 h-1.5 sm:h-2 bg-purple-600 rounded-full'
                    : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gray-300 hover:bg-gray-400 rounded-full'
                }`}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage >= totalPages - 1}
            className="btn-secondary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">Next</span>
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={onRegenerate}
            className="btn-secondary flex items-center justify-center gap-2 text-sm sm:text-base py-3"
          >
            <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="whitespace-nowrap">Regenerate Story</span>
          </button>

          <button
            onClick={onContinue}
            className="btn-primary flex items-center justify-center gap-2 text-sm sm:text-base py-3"
          >
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="whitespace-nowrap">Continue to Illustrations</span>
          </button>
        </div>

        <p className="text-center text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4 px-2">
          Review your story and make any edits before continuing
        </p>
      </motion.div>
    </div>
  );
}