// components/story-review/StoryReviewSpreads.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, RefreshCw, Edit2, Check, Sparkles, ChevronRight, Volume2, X } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

interface StoryReviewProps {
  onContinue: () => void;
  onRegenerate: () => void;
}

interface SpreadData {
  spreadNumber: number;
  leftPage?: any;
  rightPage?: any;
  mergedCaption: string;
  hasSFX: boolean;
  sfxText?: string;
}

export function StoryReviewSpreads({ onContinue, onRegenerate }: StoryReviewProps) {
  const { storyData, babyProfile } = useBookStore();
  const [editingSpread, setEditingSpread] = useState<number | null>(null);
  const [editedCaption, setEditedCaption] = useState('');
  const [sfxToggles, setSfxToggles] = useState<Record<number, boolean>>({});
  const [sfxTexts, setSfxTexts] = useState<Record<number, string>>({});

  // Convert pages to spreads (pairs)
  const createSpreads = (): SpreadData[] => {
    if (!storyData?.pages) return [];
    
    const spreads: SpreadData[] = [];
    const pages = storyData.pages;
    
    for (let i = 0; i < pages.length; i += 2) {
      const leftPage = pages[i];
      const rightPage = pages[i + 1];
      
      // Merge captions from both pages
      const mergedCaption = [
        leftPage?.narration,
        rightPage?.narration
      ].filter(Boolean).join(' ');
      
      // Check if narration suggests SFX
      const hasSFX = detectPotentialSFX(mergedCaption);
      
      spreads.push({
        spreadNumber: Math.floor(i / 2) + 1,
        leftPage,
        rightPage,
        mergedCaption,
        hasSFX,
        sfxText: sfxTexts[Math.floor(i / 2)]
      });
    }
    
    return spreads;
  };

  const detectPotentialSFX = (text: string): boolean => {
    const sfxIndicators = [
      'splash', 'boom', 'giggle', 'laugh', 'cry', 'sneeze', 
      'whoosh', 'bang', 'pop', 'clap', 'stomp', 'zoom',
      'beep', 'ring', 'ding', 'crash', 'thump', 'squeak'
    ];
    const lowerText = text.toLowerCase();
    return sfxIndicators.some(indicator => lowerText.includes(indicator));
  };

  const handleEditSpread = (spreadIndex: number) => {
    const spreads = createSpreads();
    setEditingSpread(spreadIndex);
    setEditedCaption(spreads[spreadIndex].mergedCaption);
  };

  const saveSpreadEdit = () => {
    if (editingSpread === null || !storyData) return;
    
    const spreads = createSpreads();
    const spread = spreads[editingSpread];
    
    // Split the edited caption back to pages
    const words = editedCaption.split(' ');
    const midPoint = Math.ceil(words.length / 2);
    const leftCaption = words.slice(0, midPoint).join(' ');
    const rightCaption = words.slice(midPoint).join(' ');
    
    const updatedPages = [...storyData.pages];
    const leftIndex = editingSpread * 2;
    const rightIndex = leftIndex + 1;
    
    if (updatedPages[leftIndex]) {
      updatedPages[leftIndex].narration = leftCaption;
    }
    if (updatedPages[rightIndex]) {
      updatedPages[rightIndex].narration = rightCaption;
    }
    
    useBookStore.setState({
      storyData: {
        ...storyData,
        pages: updatedPages
      }
    });
    
    setEditingSpread(null);
    toast.success('Spread caption updated!');
  };

  const toggleSFX = (spreadIndex: number) => {
    setSfxToggles(prev => ({
      ...prev,
      [spreadIndex]: !prev[spreadIndex]
    }));
  };

  const updateSFXText = (spreadIndex: number, text: string) => {
    setSfxTexts(prev => ({
      ...prev,
      [spreadIndex]: text
    }));
  };

  const spreads = createSpreads();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="card-magical text-center">
        <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-4">
          <BookOpen className="h-12 w-12 text-purple-600" />
        </div>
        <h2 className="text-4xl font-patrick gradient-text mb-3">
          Your Story Spreads
        </h2>
        <p className="text-xl text-gray-600">
          Review your story as two-page spreads
        </p>
      </div>

      {/* Story Title */}
      <div className="card-magical">
        <h3 className="text-2xl font-patrick text-center mb-6 gradient-text">
          "{storyData?.title}"
        </h3>
        <p className="text-center text-gray-600">
          A magical story for {babyProfile?.baby_name}
        </p>
        {storyData?.refrain && (
          <p className="text-center text-purple-600 font-medium mt-3">
            Refrain: "{storyData.refrain}"
          </p>
        )}
      </div>

      {/* Story Spreads */}
      <div className="space-y-8">
        {spreads.map((spread, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card-magical"
          >
            {/* Spread Header */}
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-semibold text-purple-600">
                Pages {spread.leftPage?.page_number || '-'} – {spread.rightPage?.page_number || '-'}
              </h4>
              <div className="flex items-center gap-4">
                {/* SFX Toggle */}
                <button
                  onClick={() => toggleSFX(index)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                    sfxToggles[index] 
                      ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' 
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                  }`}
                >
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Add SFX?</span>
                </button>
                
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Spread {spread.spreadNumber} of {spreads.length}
                </span>
              </div>
            </div>

            {/* Page Layout Preview */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 min-h-[100px]">
                <p className="text-xs text-gray-500 mb-2">Left Page</p>
                <p className="text-sm text-gray-700">
                  {spread.leftPage?.narration || 'No content'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[100px]">
                <p className="text-xs text-gray-500 mb-2">Right Page</p>
                <p className="text-sm text-gray-700">
                  {spread.rightPage?.narration || 'No content'}
                </p>
              </div>
            </div>

            {/* Merged Caption */}
            <div className="border-t pt-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Merged Caption for Spread:
              </label>
              
              {editingSpread === index ? (
                <div className="space-y-3">
                  <textarea
                    value={editedCaption}
                    onChange={(e) => setEditedCaption(e.target.value)}
                    className="w-full p-3 border-2 border-purple-300 rounded-lg resize-none focus:outline-none focus:border-purple-500"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveSpreadEdit}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingSpread(null)}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <p className="text-gray-700 leading-relaxed pr-10 bg-white p-3 rounded-lg border-2 border-gray-200">
                    {spread.mergedCaption}
                  </p>
                  <button
                    onClick={() => handleEditSpread(index)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-purple-50 rounded-lg"
                  >
                    <Edit2 className="h-4 w-4 text-purple-600" />
                  </button>
                </div>
              )}
            </div>

            {/* SFX Field (shown when toggled) */}
            {sfxToggles[index] && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 bg-purple-50 rounded-lg"
              >
                <label className="text-sm font-medium text-purple-700 mb-2 block">
                  Sound Effect Text:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sfxTexts[index] || ''}
                    onChange={(e) => updateSFXText(index, e.target.value)}
                    placeholder="e.g., SPLASH! GIGGLE! ZOOM!"
                    className="flex-1 px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={() => {
                      setSfxToggles(prev => ({ ...prev, [index]: false }));
                      setSfxTexts(prev => ({ ...prev, [index]: '' }));
                    }}
                    className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {spread.hasSFX && (
                  <p className="text-xs text-purple-600 mt-2">
                    💡 We detected potential sound effects in this spread!
                  </p>
                )}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="card-magical">
        <div className="grid md:grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRegenerate}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-5 w-5" />
            Regenerate Entire Story
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              // Save SFX data to store before continuing
              if (storyData) {
                const updatedPages = storyData.pages.map((page, idx) => {
                  const spreadIdx = Math.floor(idx / 2);
                  return {
                    ...page,
                    has_sfx: sfxToggles[spreadIdx] || false,
                    sfx_text: sfxToggles[spreadIdx] ? sfxTexts[spreadIdx] : undefined
                  };
                });
                
                useBookStore.setState({
                  storyData: {
                    ...storyData,
                    pages: updatedPages
                  }
                });
              }
              onContinue();
            }}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Sparkles className="h-5 w-5" />
            Continue to Illustrations
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-4">
          Review spreads and add sound effects where appropriate
        </p>
      </div>
    </div>
  );
}