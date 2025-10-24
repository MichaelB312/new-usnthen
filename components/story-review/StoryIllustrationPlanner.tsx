'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { type Page } from '@/lib/store/bookStore';

interface StoryIllustrationPlannerProps {
  isOpen: boolean;
  pages: Page[];
  onClose: () => void;
  onApprove: (feedback: string[]) => void;
}

export function StoryIllustrationPlanner({
  isOpen,
  pages,
  onClose,
  onApprove
}: StoryIllustrationPlannerProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [feedback, setFeedback] = useState<string[]>(
    new Array(pages.length).fill('')
  );

  if (!isOpen || !pages || pages.length === 0) return null;

  const currentPage = pages[currentPageIndex];
  const totalPages = pages.length;
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex === totalPages - 1;

  const handleNext = () => {
    if (!isLastPage) {
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstPage) {
      setCurrentPageIndex(prev => prev - 1);
    }
  };

  const handleFeedbackChange = (value: string) => {
    const newFeedback = [...feedback];
    newFeedback[currentPageIndex] = value;
    setFeedback(newFeedback);
  };

  const handleApprove = () => {
    onApprove(feedback);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-patrick font-bold">Plan Your Illustrations</h2>
                    <p className="text-sm text-purple-100">You're the art director! Make sure every detail is just right.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/20 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentPageIndex + 1) / totalPages) * 100}%` }}
                    className="bg-white h-2 rounded-full"
                  />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  Page {currentPageIndex + 1} of {totalPages}
                </span>
              </div>
            </div>

            {/* Page Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPageIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Page number badge */}
                  <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium">
                    <span className="text-lg">📖</span>
                    Page {currentPage.page_number}
                  </div>

                  {/* Story + Illustration plan - Combined view */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Left: Full Story Text */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-5 border border-purple-100">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-lg">📝</span>
                        <h3 className="font-semibold text-purple-900">Story Page {currentPage.page_number}:</h3>
                      </div>
                      <p className="text-gray-700 italic leading-relaxed pl-7 text-base font-patrick">
                        {currentPage.narration}
                      </p>
                    </div>

                    {/* Right: Illustration Plan */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-100">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-lg">🎨</span>
                        <h3 className="font-semibold text-blue-900">Illustration Plan:</h3>
                      </div>
                      <p className="text-gray-700 leading-relaxed pl-7 text-base">
                        {currentPage.illustration_description || currentPage.visual_prompt || 'Illustration description'}
                      </p>
                      <div className="flex items-center gap-2 mt-3 pl-7">
                        <span className="text-xs text-gray-500 font-medium">Who appears:</span>
                        <div className="flex flex-wrap gap-1">
                          {currentPage.characters_on_page?.map((char, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full capitalize"
                            >
                              {char}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Art Direction Notes */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-5 border border-amber-200">
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-lg">🎬</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-amber-900">Art Direction Notes (Optional)</h3>
                        <p className="text-xs text-amber-700 mt-1">
                          Want to add specific details? Colors, objects, pets, or anything special you'd like in this scene?
                        </p>
                      </div>
                    </div>
                    <textarea
                      value={feedback[currentPageIndex]}
                      onChange={(e) => handleFeedbackChange(e.target.value)}
                      placeholder='e.g., "add our golden retriever Rufus" or "make the bucket bright red"'
                      className="w-full px-4 py-3 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:border-transparent resize-none text-sm"
                      rows={3}
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer with navigation */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex items-center justify-between gap-4">
                {/* Previous button */}
                <button
                  onClick={handlePrev}
                  disabled={isFirstPage}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    isFirstPage
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  <ChevronLeft className="h-5 w-5" />
                  Previous
                </button>

                {/* Center - Approve or Next */}
                {isLastPage ? (
                  <button
                    onClick={handleApprove}
                    className="flex-1 max-w-md btn-primary flex items-center justify-center gap-2 text-base"
                  >
                    <Sparkles className="h-5 w-5" />
                    Perfect! Continue
                  </button>
                ) : (
                  <div className="flex-1 text-center">
                    <p className="text-sm text-gray-500">
                      {totalPages - currentPageIndex - 1} more page{totalPages - currentPageIndex - 1 !== 1 ? 's' : ''} to plan
                    </p>
                  </div>
                )}

                {/* Next button */}
                <button
                  onClick={handleNext}
                  disabled={isLastPage}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    isLastPage
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  Next
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Helper text */}
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  💡 Navigate freely between pages. Your art direction notes are saved automatically.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  If you provide feedback, we'll refine the story to perfectly match your vision!
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
