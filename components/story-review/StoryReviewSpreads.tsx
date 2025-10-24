// components/story-review/StoryReviewSpreads.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, Sparkles, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

interface StoryReviewProps {
  onContinue: () => void;
  onRegenerate: () => void;
}

export function StoryReviewSpreads({ onContinue, onRegenerate }: StoryReviewProps) {
  const { storyData, babyProfile, locale, setStory } = useBookStore();
  const [currentPage, setCurrentPage] = useState(0);
  const [manualEdits, setManualEdits] = useState<Record<number, string>>({});
  const [illustrationFeedback, setIllustrationFeedback] = useState<Record<number, string>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!storyData?.pages || storyData.pages.length === 0) return null;

  const pages = storyData.pages;
  const totalPages = pages.length;
  const page = pages[currentPage];

  // Handle narration edit for current page
  const handleNarrationEdit = (newText: string) => {
    setManualEdits(prev => ({
      ...prev,
      [currentPage]: newText
    }));
  };

  // Handle illustration feedback for current page
  const handleIllustrationFeedbackChange = (feedback: string) => {
    setIllustrationFeedback(prev => ({
      ...prev,
      [currentPage]: feedback
    }));
  };

  // Navigation
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Handle continue with regeneration if needed
  const handleContinue = async () => {
    const hasManualEdits = Object.keys(manualEdits).length > 0;
    const hasFeedback = Object.values(illustrationFeedback).some(f => f && f.trim());

    if (hasManualEdits || hasFeedback) {
      // Need to regenerate to maintain correlation
      setIsRegenerating(true);
      const loadingToast = toast.loading('Finalizing your story with your changes... ✨');

      try {
        // Convert illustration feedback to array format
        const feedbackArray = pages.map((_, idx) => illustrationFeedback[idx] || '');

        const response = await fetch('/api/regenerate-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalStory: storyData,
            illustrationFeedback: feedbackArray,
            manualNarrationEdits: manualEdits,
            locale
          })
        });

        const result = await response.json();

        if (result.success && result.story) {
          // Update store with regenerated story
          setStory(result.story);

          // Clear edits since they've been applied
          setManualEdits({});
          setIllustrationFeedback({});

          toast.dismiss(loadingToast);
          toast.success('Your story has been updated perfectly!');

          // Continue after a brief delay
          setTimeout(() => {
            onContinue();
          }, 1500);
        } else {
          throw new Error(result.error || 'Regeneration failed');
        }
      } catch (error) {
        console.error('Regeneration error:', error);
        toast.dismiss(loadingToast);
        toast.error('Failed to update story. Continuing with your changes...');

        // Apply changes locally and continue
        const updatedPages = pages.map((page, idx) => ({
          ...page,
          narration: manualEdits[idx] || page.narration
        }));

        setStory({
          ...storyData,
          pages: updatedPages
        });

        setTimeout(() => {
          onContinue();
        }, 1000);
      } finally {
        setIsRegenerating(false);
      }
    } else {
      // No changes, just continue
      onContinue();
    }
  };

  const currentNarration = manualEdits[currentPage] !== undefined
    ? manualEdits[currentPage]
    : page.narration;
  const currentFeedback = illustrationFeedback[currentPage] || '';
  const hasAnyChanges = Object.keys(manualEdits).length > 0 || Object.values(illustrationFeedback).some(f => f && f.trim());
  const totalEdits = Object.keys(manualEdits).length + Object.values(illustrationFeedback).filter(f => f && f.trim()).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-magical text-center"
      >
        <div className="inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-3 sm:mb-4">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-purple-600" />
        </div>
        <p className="text-sm font-medium text-purple-600 mb-3">✨ Your Magical Story ✨</p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-patrick gradient-text px-4 py-3">
          {storyData.title}
        </h2>
      </motion.div>

      {/* Page Slider */}
      <div className="card-magical">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-purple-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-purple-600 text-sm">
                {page.page_number}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Page {page.page_number} of {totalPages}
              </h3>
            </div>
          </div>

          {/* Page indicators (dots) */}
          <div className="flex gap-1.5">
            {pages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx)}
                className={`transition-all ${
                  currentPage === idx
                    ? 'w-8 h-2 bg-purple-600 rounded-full'
                    : 'w-2 h-2 bg-gray-300 hover:bg-gray-400 rounded-full'
                }`}
                aria-label={`Go to page ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Characters Badge */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Characters:</span>
          <div className="flex flex-wrap gap-2">
            {page.characters_on_page?.map((char, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700"
              >
                {char}
              </span>
            )) || <span className="text-sm text-gray-400">None specified</span>}
          </div>
        </div>

        {/* Page Content with Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* Story Text (Editable) - Full width at top */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📝</span>
                <h4 className="font-semibold text-purple-900">Story Text</h4>
                {manualEdits[currentPage] && (
                  <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                    ✓ Edited
                  </span>
                )}
              </div>
              <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg h-[240px] flex items-center justify-center p-8">
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => handleNarrationEdit(e.currentTarget.textContent || '')}
                  className="w-full text-3xl leading-relaxed font-patrick text-gray-700 bg-transparent border-0 focus:outline-none text-center"
                  dangerouslySetInnerHTML={{ __html: currentNarration }}
                />
              </div>
            </div>

            {/* Illustration Plan (left) and Art Direction Notes (right) */}
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              {/* Left: Illustration Plan (Read-only) */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 h-8 mb-3">
                  <span className="text-lg">🎨</span>
                  <h4 className="font-semibold text-blue-900">Illustration Plan</h4>
                </div>
                <div className="px-4 py-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg h-[180px] overflow-y-auto">
                  <p className="text-base text-gray-700 leading-relaxed">
                    {page.illustration_description || page.visual_prompt || 'Illustration description'}
                  </p>
                </div>
              </div>

              {/* Right: Art Direction Notes (Editable) */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 h-8 mb-3">
                  <span className="text-lg">🎬</span>
                  <h4 className="font-semibold text-amber-900">Art Direction Notes</h4>
                  {currentFeedback && (
                    <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                      ✓ Notes added
                    </span>
                  )}
                </div>
                <textarea
                  value={currentFeedback}
                  onChange={(e) => handleIllustrationFeedbackChange(e.target.value)}
                  className="w-full h-[180px] px-4 py-3 text-sm text-gray-700 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                  placeholder='Add details: "include golden retriever Rufus" or "bright red bucket in foreground"'
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-purple-100">
          <button
            onClick={goToPrevPage}
            disabled={currentPage === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              currentPage === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-purple-600 hover:bg-purple-50'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              {currentPage < totalPages - 1
                ? `${totalPages - currentPage - 1} more page${totalPages - currentPage - 1 !== 1 ? 's' : ''} to review`
                : 'All pages reviewed!'}
            </p>
          </div>

          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages - 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              currentPage >= totalPages - 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-purple-600 hover:bg-purple-50'
            }`}
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
        className="card-magical sticky bottom-4 bg-white shadow-xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="btn-secondary flex items-center justify-center gap-2 text-sm sm:text-base py-3"
          >
            <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="whitespace-nowrap">Regenerate Story</span>
          </button>

          <button
            onClick={handleContinue}
            disabled={isRegenerating}
            className="btn-primary flex items-center justify-center gap-2 text-sm sm:text-base py-3"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                <span className="whitespace-nowrap">Finalizing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="whitespace-nowrap">Continue to Illustrations</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4 px-2">
          {hasAnyChanges
            ? 'Your changes will be applied when you continue'
            : 'Review all pages, edit if needed, then continue'}
        </p>
      </motion.div>
    </div>
  );
}
