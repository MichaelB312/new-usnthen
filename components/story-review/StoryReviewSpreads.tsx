// components/story-review/StoryReviewSpreads.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, Edit2, Check, Sparkles, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

interface StoryReviewProps {
  onContinue: () => void;
  onRegenerate: () => void;
}

// Auto-detect SFX from narration
function detectSFX(narration: string): { text: string; confidence: number } | null {
  const sfxPatterns = [
    { pattern: /splash|splish/i, sfx: 'SPLASH!' },
    { pattern: /giggle|laugh/i, sfx: 'GIGGLE!' },
    { pattern: /boom|bang|crash/i, sfx: 'BOOM!' },
    { pattern: /whoosh|zoom|dash/i, sfx: 'WHOOSH!' },
    { pattern: /pop|bubble/i, sfx: 'POP!' },
    { pattern: /yawn/i, sfx: 'YAAAWN!' },
    { pattern: /cry|wail/i, sfx: 'WAAH!' },
    { pattern: /snore|sleep/i, sfx: 'ZZZ...' },
    { pattern: /munch|eat|yum/i, sfx: 'MUNCH!' },
    { pattern: /beep|honk/i, sfx: 'BEEP BEEP!' },
    { pattern: /squeak|creak/i, sfx: 'SQUEAK!' },
    { pattern: /thump|stomp/i, sfx: 'THUMP!' },
    { pattern: /ring|ding/i, sfx: 'RING!' },
    { pattern: /quack|duck/i, sfx: 'QUACK!' },
  ];
  
  for (const { pattern, sfx } of sfxPatterns) {
    if (pattern.test(narration)) {
      return { text: sfx, confidence: 0.9 };
    }
  }
  
  return null;
}

export function StoryReviewSpreads({ onContinue, onRegenerate }: StoryReviewProps) {
  const { storyData, babyProfile } = useBookStore();
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editedNarration, setEditedNarration] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [detectedSFX, setDetectedSFX] = useState<Record<number, string>>({});

  // Auto-detect SFX for all pages
  useEffect(() => {
    if (!storyData?.pages) return;
    
    const sfxMap: Record<number, string> = {};
    storyData.pages.forEach((page) => {
      const detection = detectSFX(page.narration);
      if (detection && detection.confidence > 0.7) {
        sfxMap[page.page_number] = detection.text;
      }
    });
    setDetectedSFX(sfxMap);
  }, [storyData]);

  const handleEditPage = (pageNumber: number) => {
    const page = storyData?.pages.find(p => p.page_number === pageNumber);
    if (page) {
      setEditingPage(pageNumber);
      setEditedNarration(page.narration);
    }
  };

  const savePageEdit = () => {
    if (editingPage === null || !storyData) return;
    
    const updatedPages = storyData.pages.map(page => 
      page.page_number === editingPage 
        ? { ...page, narration: editedNarration }
        : page
    );
    
    useBookStore.setState({
      storyData: {
        ...storyData,
        pages: updatedPages
      }
    });
    
    // Re-detect SFX for edited page
    const detection = detectSFX(editedNarration);
    if (detection && detection.confidence > 0.7) {
      setDetectedSFX(prev => ({ ...prev, [editingPage]: detection.text }));
    } else {
      setDetectedSFX(prev => {
        const updated = { ...prev };
        delete updated[editingPage];
        return updated;
      });
    }
    
    setEditingPage(null);
    toast.success('Page updated!');
  };

  const saveAndContinue = () => {
    if (storyData) {
      // Add detected SFX to pages before continuing
      const updatedPages = storyData.pages.map(page => ({
        ...page,
        has_sfx: !!detectedSFX[page.page_number],
        sfx_text: detectedSFX[page.page_number]
      }));
      
      useBookStore.setState({
        storyData: {
          ...storyData,
          pages: updatedPages
        }
      });
    }
    onContinue();
  };

  if (!storyData?.pages) return null;

  const totalPages = storyData.pages.length;

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
              {editingPage === storyData.pages[currentPage].page_number ? (
                <div className="w-full space-y-4">
                  <textarea
                    value={editedNarration}
                    onChange={(e) => setEditedNarration(e.target.value)}
                    className="w-full p-4 text-lg font-patrick text-gray-700 bg-white rounded-xl resize-none focus:outline-none focus:ring-4 focus:ring-purple-200 shadow-inner"
                    rows={4}
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
                    {storyData.pages[currentPage].narration}
                  </motion.p>
                  
                  {/* Auto-detected SFX */}
                  {detectedSFX[storyData.pages[currentPage].page_number] && (
                    <motion.div
                      initial={{ scale: 0, rotate: -15 }}
                      animate={{ scale: 1, rotate: 15 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="inline-block mt-4"
                    >
                      <div className="bg-gradient-to-br from-yellow-300 to-orange-400 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
                        <Volume2 className="h-5 w-5" />
                        <span className="font-bold text-lg">
                          {detectedSFX[storyData.pages[currentPage].page_number]}
                        </span>
                      </div>
                    </motion.div>
                  )}
                  
                  <button
                    onClick={() => handleEditPage(storyData.pages[currentPage].page_number)}
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1 mx-auto mt-4"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit this page
                  </button>
                </div>
              )}
            </div>

            {/* Page Info */}
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-2">
                {storyData.pages[currentPage].characters_on_page?.length > 0 && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                    {storyData.pages[currentPage].characters_on_page.join(', ')}
                  </span>
                )}
                {detectedSFX[storyData.pages[currentPage].page_number] && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
                    <Volume2 className="h-3 w-3" />
                    SFX
                  </span>
                )}
              </div>
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

          {/* Page Dots */}
          <div className="flex gap-2">
            {storyData.pages.map((_, index) => (
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
            onClick={saveAndContinue}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Sparkles className="h-5 w-5" />
            Continue to Illustrations
          </button>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-4">
          {Object.keys(detectedSFX).length > 0 
            ? `✨ Found ${Object.keys(detectedSFX).length} sound effects in your story!`
            : 'Review your story and make any edits'
          }
        </p>
      </motion.div>
    </div>
  );
}