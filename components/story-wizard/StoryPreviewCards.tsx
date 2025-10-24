// components/story-wizard/StoryPreviewCards.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Edit2, X } from 'lucide-react';

interface PreviewPage {
  page_number: number;
  brief_narration: string;
  illustration_description: string;
  characters: string[];
}

interface StoryPreviewCardsProps {
  preview: {
    title: string;
    pages: PreviewPage[];
  };
  onApprove: () => void;
  onProvideFeedback: (feedback: string, editedPages?: PreviewPage[]) => void;
}

export function StoryPreviewCards({ preview, onApprove, onProvideFeedback }: StoryPreviewCardsProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [editedPages, setEditedPages] = useState<PreviewPage[]>(preview.pages);
  const [isEditingNarration, setIsEditingNarration] = useState(false);
  const [isEditingIllustration, setIsEditingIllustration] = useState(false);
  const [editedNarration, setEditedNarration] = useState('');
  const [editedIllustration, setEditedIllustration] = useState('');
  const [pageFeedback, setPageFeedback] = useState<Record<number, string>>({});
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);

  const currentPage = editedPages[currentPageIndex];
  const isLastPage = currentPageIndex === editedPages.length - 1;
  const totalPages = editedPages.length;

  const handleEditNarration = () => {
    setIsEditingNarration(true);
    setEditedNarration(currentPage.brief_narration);
  };

  const handleEditIllustration = () => {
    setIsEditingIllustration(true);
    setEditedIllustration(currentPage.illustration_description);
  };

  const handleSaveNarration = () => {
    const updatedPages = [...editedPages];
    updatedPages[currentPageIndex] = {
      ...currentPage,
      brief_narration: editedNarration
    };
    setEditedPages(updatedPages);
    setIsEditingNarration(false);
  };

  const handleSaveIllustration = () => {
    const updatedPages = [...editedPages];
    updatedPages[currentPageIndex] = {
      ...currentPage,
      illustration_description: editedIllustration
    };
    setEditedPages(updatedPages);
    setIsEditingIllustration(false);
  };

  const handleNextPage = () => {
    if (isLastPage) {
      setShowFinalConfirm(true);
    } else {
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const handleFinalApproval = () => {
    const hasChanges = JSON.stringify(editedPages) !== JSON.stringify(preview.pages);
    const hasFeedback = Object.keys(pageFeedback).length > 0;

    if (hasChanges || hasFeedback) {
      // Compile feedback
      let feedback = '';

      if (hasFeedback) {
        const feedbackEntries = Object.entries(pageFeedback).map(([pageNum, text]) =>
          `Page ${pageNum}: ${text}`
        );
        feedback = feedbackEntries.join('\n');
      }

      if (hasChanges) {
        const changedPages = editedPages
          .map((page, idx) => {
            const original = preview.pages[idx];
            if (page.brief_narration !== original.brief_narration ||
                page.illustration_description !== original.illustration_description) {
              return `Page ${page.page_number} updated`;
            }
            return null;
          })
          .filter(Boolean);

        if (changedPages.length > 0) {
          feedback += (feedback ? '\n\n' : '') + 'Updated pages:\n' + changedPages.join('\n');
        }
      }

      onProvideFeedback(feedback || 'approved', hasChanges ? editedPages : undefined);
    } else {
      onApprove();
    }
  };

  if (showFinalConfirm) {
    return (
      <div className="w-full space-y-3 px-2 sm:px-0">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl rounded-bl-sm p-4 shadow-md"
        >
          <p className="text-sm text-gray-700 mb-3">
            Perfect! We've gone through all {totalPages} pages. Ready to create your full story with these details?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFinalConfirm(false)}
              className="btn-secondary text-xs py-2 px-4"
            >
              Review Again
            </button>
            <button
              onClick={handleFinalApproval}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1"
            >
              <Check className="h-4 w-4" />
              Create My Story!
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 px-2 sm:px-0">
      {/* Page Counter */}
      <div className="text-center">
        <span className="text-xs text-gray-500">
          Page {currentPage.page_number} of {totalPages}
        </span>
      </div>

      {/* Current Page */}
      <motion.div
        key={currentPageIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl rounded-bl-sm p-4 shadow-md space-y-3"
      >
        {/* Page Number Badge */}
        <div className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
          Page {currentPage.page_number}
        </div>

        {/* Narration */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">📖 Story:</p>
            {!isEditingNarration && (
              <button
                onClick={handleEditNarration}
                className="text-purple-400 hover:text-purple-600 transition-colors"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            )}
          </div>

          {isEditingNarration ? (
            <div className="space-y-2">
              <textarea
                value={editedNarration}
                onChange={(e) => setEditedNarration(e.target.value)}
                className="w-full p-2 text-sm text-gray-700 bg-white rounded-lg border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                rows={2}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNarration}
                  className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  Save
                </button>
                <button
                  onClick={() => setIsEditingNarration(false)}
                  className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 font-patrick italic">
              "{currentPage.brief_narration}"
            </p>
          )}
        </div>

        {/* Illustration */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">🎨 Illustration:</p>
            {!isEditingIllustration && (
              <button
                onClick={handleEditIllustration}
                className="text-purple-400 hover:text-purple-600 transition-colors"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            )}
          </div>

          {isEditingIllustration ? (
            <div className="space-y-2">
              <textarea
                value={editedIllustration}
                onChange={(e) => setEditedIllustration(e.target.value)}
                className="w-full p-2 text-sm text-gray-700 bg-white rounded-lg border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                rows={2}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveIllustration}
                  className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  Save
                </button>
                <button
                  onClick={() => setIsEditingIllustration(false)}
                  className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              {currentPage.illustration_description}
            </p>
          )}
        </div>

        {/* Characters */}
        <div className="flex flex-wrap gap-1">
          {currentPage.characters.map((char, idx) => (
            <span
              key={idx}
              className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full"
            >
              {char}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Action - Next or Done */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <button
          onClick={handleNextPage}
          className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-2"
        >
          {isLastPage ? (
            <>
              <Check className="h-4 w-4" />
              All Pages Look Good!
            </>
          ) : (
            <>
              Looks Good, Next Page
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
