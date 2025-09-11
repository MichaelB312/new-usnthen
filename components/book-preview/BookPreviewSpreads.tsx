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

interface SpreadLayout {
  spreadNumber: number;
  leftPage: PageLayout | null;
  rightPage: PageLayout | null;
  characterPlacement: 'left' | 'right' | 'center';
}

interface PageLayout {
  pageNumber: number;
  hasCharacter: boolean;
  characterBounds: { x: number; y: number; width: number; height: number };
  captionBounds: { x: number; y: number; width: number; height: number };
  sfxBounds?: { x: number; y: number; width: number; height: number };
  decorations: any[];
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
  const [spreadLayouts, setSpreadLayouts] = useState<SpreadLayout[]>([]);
  
  // Calculate spreads from pages
  useEffect(() => {
    if (!storyData?.pages) return;
    
    const spreads: SpreadLayout[] = [];
    const pages = storyData.pages;
    
    for (let i = 0; i < pages.length; i += 2) {
      const spreadNum = Math.floor(i / 2);
      const leftPage = pages[i];
      const rightPage = pages[i + 1];
      
      // Determine character placement (alternating by default)
      let placement: 'left' | 'right' | 'center' = 'left';
      if (spreadNum % 2 === 0) {
        placement = 'left';
      } else {
        placement = 'right';
      }
      
      // Check if centered placement makes sense
      const isBigReveal = leftPage?.scene_type === 'opening' || 
                          rightPage?.scene_type === 'closing';
      if (isBigReveal) {
        placement = 'center';
      }
      
      const leftLayout = createPageLayout(leftPage, placement === 'left');
      const rightLayout = rightPage ? createPageLayout(rightPage, placement === 'right') : null;
      
      spreads.push({
        spreadNumber: spreadNum + 1,
        leftPage: leftLayout,
        rightPage: rightLayout,
        characterPlacement: placement
      });
    }
    
    setSpreadLayouts(spreads);
  }, [storyData]);
  
  const createPageLayout = (page: any, hasCharacter: boolean): PageLayout | null => {
    if (!page) return null;
    
    const PAGE_WIDTH = 400; // 1:1 square pages
    const PAGE_HEIGHT = 400;
    const SAFE_MARGIN = 20;
    const INNER_PADDING = 30;
    
    const layout: PageLayout = {
      pageNumber: page.page_number,
      hasCharacter: hasCharacter && page.characters_on_page?.length > 0,
      characterBounds: { x: 0, y: 0, width: 0, height: 0 },
      captionBounds: { x: 0, y: 0, width: 0, height: 0 },
      decorations: []
    };
    
    // Calculate character bounds
    if (layout.hasCharacter) {
      layout.characterBounds = {
        x: SAFE_MARGIN + INNER_PADDING,
        y: SAFE_MARGIN + INNER_PADDING,
        width: PAGE_WIDTH - (2 * SAFE_MARGIN) - (2 * INNER_PADDING),
        height: PAGE_HEIGHT * 0.6
      };
    }
    
    // Calculate caption bounds
    const captionHeight = 80;
    layout.captionBounds = {
      x: SAFE_MARGIN,
      y: PAGE_HEIGHT - SAFE_MARGIN - captionHeight,
      width: PAGE_WIDTH - (2 * SAFE_MARGIN),
      height: captionHeight
    };
    
    // Add SFX bounds if needed
    if (page.has_sfx && page.sfx_text) {
      layout.sfxBounds = {
        x: PAGE_WIDTH * 0.6,
        y: PAGE_HEIGHT * 0.3,
        width: 100,
        height: 40
      };
    }
    
    return layout;
  };
  
  const renderPageContent = (
    page: any, 
    layout: PageLayout | null,
    isLeftPage: boolean
  ) => {
    if (!page || !layout) return null;
    
    const illustration = illustrations?.find(ill => ill.page_number === page.page_number);
    
    return (
      <div className="relative w-[400px] h-[400px] bg-white rounded-lg shadow-inner overflow-hidden">
        {/* Safe area guides */}
        {showSafeAreas && (
          <div className="absolute inset-4 border-2 border-green-400 border-dashed opacity-30 pointer-events-none" />
        )}
        
        {/* Character illustration */}
        {layout.hasCharacter && illustration?.url && (
          <div 
            className="absolute"
            style={{
              left: `${layout.characterBounds.x}px`,
              top: `${layout.characterBounds.y}px`,
              width: `${layout.characterBounds.width}px`,
              height: `${layout.characterBounds.height}px`
            }}
          >
            <img 
              src={illustration.url}
              alt={`Page ${page.page_number}`}
              className="w-full h-full object-contain"
            />
          </div>
        )}
        
        {/* Caption */}
        <div 
          className="absolute flex items-center justify-center"
          style={{
            left: `${layout.captionBounds.x}px`,
            top: `${layout.captionBounds.y}px`,
            width: `${layout.captionBounds.width}px`,
            height: `${layout.captionBounds.height}px`
          }}
        >
          <p className="text-center text-lg font-patrick text-gray-800 px-4">
            {page.narration}
          </p>
        </div>
        
        {/* SFX */}
        {layout.sfxBounds && page.sfx_text && (
          <div 
            className="absolute flex items-center justify-center"
            style={{
              left: `${layout.sfxBounds.x}px`,
              top: `${layout.sfxBounds.y}px`,
              width: `${layout.sfxBounds.width}px`,
              height: `${layout.sfxBounds.height}px`,
              transform: 'rotate(-15deg)'
            }}
          >
            <span className="text-2xl font-bold text-purple-600 font-patrick">
              {page.sfx_text}
            </span>
          </div>
        )}
        
        {/* Page number */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {page.page_number}
        </div>
      </div>
    );
  };
  
  const renderCenteredSpread = (spread: SpreadLayout) => {
    const leftPage = storyData?.pages[(spread.spreadNumber - 1) * 2];
    const rightPage = storyData?.pages[(spread.spreadNumber - 1) * 2 + 1];
    const illustration = illustrations?.find(ill => 
      ill.page_number === leftPage?.page_number || 
      ill.page_number === rightPage?.page_number
    );
    
    return (
      <div className="relative w-[800px] h-[400px] bg-white rounded-lg shadow-inner overflow-hidden flex">
        {/* Centered character across spread */}
        {illustration?.url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src={illustration.url}
              alt={`Spread ${spread.spreadNumber}`}
              className="max-w-[60%] max-h-[70%] object-contain"
            />
          </div>
        )}
        
        {/* Left caption */}
        {leftPage && (
          <div className="absolute bottom-8 left-8 max-w-[300px]">
            <p className="text-lg font-patrick text-gray-800">
              {leftPage.narration}
            </p>
          </div>
        )}
        
        {/* Right caption */}
        {rightPage && (
          <div className="absolute bottom-8 right-8 max-w-[300px] text-right">
            <p className="text-lg font-patrick text-gray-800">
              {rightPage.narration}
            </p>
          </div>
        )}
        
        {/* Center binding */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 transform -translate-x-1/2" />
      </div>
    );
  };
  
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Controls */}
      <div className="card-magical">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-patrick gradient-text">
            Book Layout Viewer
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
                {spreadLayouts[currentSpread] && (
                  spreadLayouts[currentSpread].characterPlacement === 'center' ? (
                    renderCenteredSpread(spreadLayouts[currentSpread])
                  ) : (
                    <div className="flex gap-4">
                      {/* Left Page */}
                      {renderPageContent(
                        storyData?.pages[(currentSpread * 2)],
                        spreadLayouts[currentSpread].leftPage,
                        true
                      )}
                      
                      {/* Right Page */}
                      {renderPageContent(
                        storyData?.pages[(currentSpread * 2) + 1],
                        spreadLayouts[currentSpread].rightPage,
                        false
                      )}
                    </div>
                  )
                )}
                
                {/* Center binding line */}
                {spreadLayouts[currentSpread]?.characterPlacement !== 'center' && (
                  <div className="absolute left-1/2 top-8 bottom-8 w-1 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-300 transform -translate-x-1/2 shadow-inner" />
                )}
              </div>
              
              {/* Info Bar */}
              <div className="flex items-center justify-between mt-4 p-4 bg-gray-50 rounded-lg">
                <span className="font-medium">
                  Spread {currentSpread + 1} of {spreadLayouts.length}
                </span>
                <span className="text-sm text-gray-600">
                  Character: {spreadLayouts[currentSpread]?.characterPlacement}
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
              {spreadLayouts.map((_, index) => (
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
              onClick={() => setCurrentSpread(Math.min(spreadLayouts.length - 1, currentSpread + 1))}
              disabled={currentSpread >= spreadLayouts.length - 1}
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
            {spreadLayouts.map((spread, index) => (
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
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="flex">
                    <div className="w-32 h-32 bg-gradient-to-br from-purple-100 to-pink-100" />
                    <div className="w-32 h-32 bg-gradient-to-br from-pink-100 to-purple-100" />
                  </div>
                  <div className="p-2 text-center bg-gray-50">
                    <p className="text-sm font-medium">Spread {spread.spreadNumber}</p>
                    <p className="text-xs text-gray-500">
                      Pages {(index * 2) + 1}–{(index * 2) + 2}
                    </p>
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