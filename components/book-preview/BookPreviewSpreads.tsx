// components/book-preview/BookPreviewSpreads.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, BookOpen, Grid, Eye,
  Check, Download, Settings, Maximize2
} from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

interface PageLayout {
  pageNumber: number;
  hasCharacter: boolean;
  characterBounds?: { x: number; y: number; width: number; height: number };
  captionBounds: { x: number; y: number; width: number; height: number };
  sfxBounds?: { x: number; y: number; width: number; height: number };
}

export function BookPreviewSpreads({ onComplete }: { onComplete: () => void }) {
  const { 
    storyData, 
    illustrations, 
    layouts,
    setPageLayout 
  } = useBookStore();
  
  const [currentSpread, setCurrentSpread] = useState(0);
  const [viewMode, setViewMode] = useState<'spread' | 'grid'>('spread');
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const [pageLayouts, setPageLayouts] = useState<PageLayout[]>([]);
  
  // Initialize page layouts
  useEffect(() => {
    if (!storyData?.pages) return;
    
    const layouts: PageLayout[] = storyData.pages.map(page => {
      const hasCharacter = page.characters_on_page?.length > 0;
      
      return {
        pageNumber: page.page_number,
        hasCharacter,
        characterBounds: hasCharacter ? {
          x: 50,
          y: 50,
          width: 300,
          height: 200
        } : undefined,
        captionBounds: {
          x: 20,
          y: 280,
          width: 360,
          height: 80
        },
        sfxBounds: page.has_sfx ? {
          x: 280,
          y: 100,
          width: 100,
          height: 40
        } : undefined
      };
    });
    
    setPageLayouts(layouts);
  }, [storyData]);
  
  // Calculate spreads
  const spreads = Math.ceil((storyData?.pages.length || 0) / 2);
  
  const renderSpread = (spreadIndex: number) => {
    const leftPageIndex = spreadIndex * 2;
    const rightPageIndex = leftPageIndex + 1;
    const leftPage = storyData?.pages[leftPageIndex];
    const rightPage = storyData?.pages[rightPageIndex];
    const leftLayout = pageLayouts[leftPageIndex];
    const rightLayout = pageLayouts[rightPageIndex];
    
    // Determine where character should appear (only one side!)
    let characterSide: 'left' | 'right' | 'none' = 'none';
    let characterIllustration = null;
    
    if (leftPage && leftPage.characters_on_page && leftPage.characters_on_page.length > 0) {
      characterSide = 'left';
      characterIllustration = illustrations?.find(ill => ill.page_number === leftPage.page_number);
    } else if (rightPage && rightPage.characters_on_page && rightPage.characters_on_page.length > 0) {
      characterSide = 'right';
      characterIllustration = illustrations?.find(ill => ill.page_number === rightPage.page_number);
    }
    
    return (
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ aspectRatio: '2/1' }}>
        <div className="flex h-full">
          {/* Left Page */}
          <div className="relative w-1/2 h-full bg-white p-8">
            {showSafeAreas && (
              <div className="absolute inset-4 border-2 border-green-400 border-dashed opacity-30 pointer-events-none" />
            )}
            
            {leftPage && (
              <>
                {/* Character on left side only */}
                {characterSide === 'left' && characterIllustration?.url && (
                  <div className="absolute inset-8 flex items-center justify-center">
                    <img 
                      src={characterIllustration.url}
                      alt={`Page ${leftPage.page_number}`}
                      className="max-w-full max-h-[60%] object-contain"
                    />
                  </div>
                )}
                
                {/* Caption */}
                <div className="absolute bottom-8 left-8 right-8">
                  <p className="text-center text-lg font-patrick text-gray-800">
                    {leftPage.narration}
                  </p>
                </div>
                
                {/* SFX */}
                {leftPage.has_sfx && leftPage.sfx_text && (
                  <div 
                    className="absolute"
                    style={{
                      right: '20px',
                      top: '80px',
                      transform: 'rotate(-15deg)'
                    }}
                  >
                    <span className="text-2xl font-bold text-purple-600 font-patrick">
                      {leftPage.sfx_text}
                    </span>
                  </div>
                )}
                
                {/* Page number */}
                <div className="absolute bottom-2 left-2 text-xs text-gray-400">
                  {leftPage.page_number}
                </div>
              </>
            )}
          </div>
          
          {/* Center spine */}
          <div className="w-px bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200" />
          
          {/* Right Page */}
          <div className="relative w-1/2 h-full bg-white p-8">
            {showSafeAreas && (
              <div className="absolute inset-4 border-2 border-green-400 border-dashed opacity-30 pointer-events-none" />
            )}
            
            {rightPage && (
              <>
                {/* Character on right side only */}
                {characterSide === 'right' && characterIllustration?.url && (
                  <div className="absolute inset-8 flex items-center justify-center">
                    <img 
                      src={characterIllustration.url}
                      alt={`Page ${rightPage.page_number}`}
                      className="max-w-full max-h-[60%] object-contain"
                    />
                  </div>
                )}
                
                {/* Caption */}
                <div className="absolute bottom-8 left-8 right-8">
                  <p className="text-center text-lg font-patrick text-gray-800">
                    {rightPage.narration}
                  </p>
                </div>
                
                {/* SFX */}
                {rightPage.has_sfx && rightPage.sfx_text && (
                  <div 
                    className="absolute"
                    style={{
                      left: '20px',
                      top: '80px',
                      transform: 'rotate(15deg)'
                    }}
                  >
                    <span className="text-2xl font-bold text-purple-600 font-patrick">
                      {rightPage.sfx_text}
                    </span>
                  </div>
                )}
                
                {/* Page number */}
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {rightPage.page_number}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Controls */}
      <div className="card-magical">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-patrick gradient-text">
            Book Preview
          </h2>
          
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('spread')}
                className={`px-3 py-2 rounded transition-all ${
                  viewMode === 'spread' ? 'bg-white shadow' : ''
                }`}
                title="Spread View"
              >
                <BookOpen className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded transition-all ${
                  viewMode === 'grid' ? 'bg-white shadow' : ''
                }`}
                title="Grid View"
              >
                <Grid className="h-5 w-5" />
              </button>
            </div>
            
            {/* Settings */}
            <button
              onClick={() => setShowSafeAreas(!showSafeAreas)}
              className={`px-3 py-2 rounded transition-all ${
                showSafeAreas ? 'bg-green-100 text-green-700' : 'bg-gray-100'
              }`}
              title="Toggle Safe Areas"
            >
              <Eye className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Spread View */}
      {viewMode === 'spread' && (
        <div className="card-magical">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSpread}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="relative"
            >
              {/* Book Spread */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-2xl overflow-hidden p-8">
                {renderSpread(currentSpread)}
              </div>
              
              {/* Info Bar */}
              <div className="flex items-center justify-between mt-4 p-4 bg-gray-50 rounded-lg">
                <span className="font-medium">
                  Pages {currentSpread * 2 + 1}–{Math.min((currentSpread + 1) * 2, storyData?.pages.length || 0)}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
          
          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setCurrentSpread(Math.max(0, currentSpread - 1))}
              disabled={currentSpread === 0}
              className="btn-secondary flex items-center gap-2"
            >
              <ChevronLeft className="h-5 w-5" />
              Previous
            </button>
            
            {/* Page Dots */}
            <div className="flex gap-2">
              {Array.from({ length: spreads }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSpread(index)}
                  className={`transition-all ${
                    currentSpread === index
                      ? 'w-8 h-2 bg-purple-600 rounded-full'
                      : 'w-2 h-2 bg-gray-300 hover:bg-gray-400 rounded-full'
                  }`}
                />
              ))}
            </div>
            
            <button
              onClick={() => setCurrentSpread(Math.min(spreads - 1, currentSpread + 1))}
              disabled={currentSpread >= spreads - 1}
              className="btn-secondary flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="card-magical">
          <div className="grid md:grid-cols-2 gap-8">
            {Array.from({ length: spreads }).map((_, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="cursor-pointer"
                onClick={() => {
                  setCurrentSpread(index);
                  setViewMode('spread');
                }}
              >
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="aspect-[2/1] bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                    <BookOpen className="h-12 w-12 text-purple-400" />
                  </div>
                  <div className="p-2 text-center bg-gray-50">
                    <p className="text-sm font-medium">Pages {index * 2 + 1}–{Math.min((index + 1) * 2, storyData?.pages.length || 0)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-center">
        <button
          onClick={onComplete}
          className="btn-primary text-xl px-10 py-4 flex items-center gap-3"
        >
          <Check className="h-6 w-6" />
          Looks Perfect!
        </button>
      </div>
    </div>
  );
}