// components/book-preview/IntegratedBookPreview.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, BookOpen, Grid, Eye,
  Check, Download, Volume2
} from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import { DecorationGenerator, generateDecorationPlaceholder, type SpreadDecorations } from '@/lib/decorations/DecorationGenerator';
import toast from 'react-hot-toast';

interface PageSFX {
  text: string;
  position: { x: number; y: number };
  rotation: number;
  style: 'comic' | 'playful' | 'dramatic' | 'soft';
}

export function IntegratedBookPreview({ onComplete }: { onComplete: () => void }) {
  const { 
    storyData, 
    illustrations,
    babyProfile
  } = useBookStore();
  
  const [currentSpread, setCurrentSpread] = useState(0);
  const [viewMode, setViewMode] = useState<'spread' | 'grid'>('spread');
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const [pageSFX, setPageSFX] = useState<Record<number, PageSFX>>({});
  const [spreadDecorations, setSpreadDecorations] = useState<SpreadDecorations[]>([]);
  
  const decorationGenerator = new DecorationGenerator();
  
  // Generate SFX positions that don't overlap with character
  const generateSFXPosition = (hasCharacter: boolean, characterSide?: 'left' | 'right'): PageSFX['position'] => {
    if (!hasCharacter) {
      // No character - place in upper third
      return {
        x: 250 + Math.random() * 100,
        y: 80 + Math.random() * 60
      };
    }
    
    // Character present - place opposite and high
    if (characterSide === 'left') {
      return { x: 300, y: 80 }; // Right side, top
    } else if (characterSide === 'right') {
      return { x: 100, y: 80 }; // Left side, top
    } else {
      // Center character - place top corner
      return { x: 320, y: 60 };
    }
  };
  
  // Initialize SFX and decorations
  useEffect(() => {
    if (!storyData?.pages) return;
    
    const sfxMap: Record<number, PageSFX> = {};
    const decorations: SpreadDecorations[] = [];
    
    // Process spreads
    for (let i = 0; i < storyData.pages.length; i += 2) {
      const leftPage = storyData.pages[i];
      const rightPage = storyData.pages[i + 1];
      const spreadNum = Math.floor(i / 2);
      
      // Determine character placement (only one per spread!)
      let characterSide: 'left' | 'right' | 'none' = 'none';
      
      if (leftPage?.characters_on_page?.length > 0) {
        characterSide = 'left';
      } else if (rightPage?.characters_on_page?.length > 0) {
        characterSide = 'right';
      }
      
      // Handle SFX for left page
      if (leftPage?.has_sfx && leftPage.sfx_text) {
        sfxMap[leftPage.page_number] = {
          text: leftPage.sfx_text,
          position: generateSFXPosition(characterSide === 'left', 'left'),
          rotation: -15 + Math.random() * 30,
          style: leftPage.sfx_style || 'playful'
        };
      }
      
      // Handle SFX for right page
      if (rightPage?.has_sfx && rightPage.sfx_text) {
        sfxMap[rightPage.page_number] = {
          text: rightPage.sfx_text,
          position: generateSFXPosition(characterSide === 'right', 'right'),
          rotation: -15 + Math.random() * 30,
          style: rightPage.sfx_style || 'playful'
        };
      }
      
      // Generate proper decorations for this spread
      const spreadDecoration = decorationGenerator.generateSpreadDecorations(
        spreadNum + 1,
        leftPage?.narration || '',
        rightPage?.narration || '',
        characterSide === 'left',
        characterSide === 'right'
      );
      
      decorations.push(spreadDecoration);
    }
    
    setPageSFX(sfxMap);
    setSpreadDecorations(decorations);
  }, [storyData]);
  
  // Calculate spreads
  const spreads = storyData?.pages ? Math.ceil(storyData.pages.length / 2) : 0;
  
  const renderSpread = (spreadIndex: number) => {
    const leftPage = storyData?.pages[spreadIndex * 2];
    const rightPage = storyData?.pages[spreadIndex * 2 + 1];
    const decoration = spreadDecorations[spreadIndex];
    
    // Determine character placement - only ONE per spread!
    let characterSide: 'left' | 'right' | 'none' = 'none';
    let characterIllustration = null;
    
    // Strict rule: only one character per spread
    if (leftPage && leftPage.characters_on_page && leftPage.characters_on_page.length > 0 && 
        rightPage && rightPage.characters_on_page && rightPage.characters_on_page.length > 0) {
      // If both pages have characters, alternate by spread number
      if (spreadIndex % 2 === 0) {
        characterSide = 'left';
        characterIllustration = illustrations?.find(ill => ill.page_number === leftPage.page_number);
      } else {
        characterSide = 'right';
        characterIllustration = illustrations?.find(ill => ill.page_number === rightPage.page_number);
      }
    } else if (leftPage && leftPage.characters_on_page && leftPage.characters_on_page.length > 0) {
      characterSide = 'left';
      characterIllustration = illustrations?.find(ill => ill.page_number === leftPage.page_number);
    } else if (rightPage && rightPage.characters_on_page && rightPage.characters_on_page.length > 0) {
      characterSide = 'right';
      characterIllustration = illustrations?.find(ill => ill.page_number === rightPage.page_number);
    }
    
    return (
      <div className="relative bg-white rounded-xl shadow-inner" style={{ aspectRatio: '2/1' }}>
        <div className="flex h-full">
          {/* Left Page */}
          <div className="relative w-1/2 h-full bg-white overflow-hidden">
            {/* Safe area guides */}
            {showSafeAreas && (
              <div className="absolute inset-10 border-2 border-green-400/30 border-dashed pointer-events-none" />
            )}
            
            {/* Decoration (behind everything) */}
            {decoration?.leftPageDecoration && (
              <div
                className="absolute"
                style={{
                  left: `${decoration.leftPageDecoration.x}px`,
                  top: `${decoration.leftPageDecoration.y}px`,
                  width: `${decoration.leftPageDecoration.width}px`,
                  height: `${decoration.leftPageDecoration.height}px`,
                  zIndex: 1,
                  opacity: 0.6
                }}
              >
                <img 
                  src={generateDecorationPlaceholder(decoration.leftPageDecoration)}
                  alt="decoration"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            
            {/* Character illustration - only if on left */}
            {characterSide === 'left' && characterIllustration?.url && (
              <div 
                className="absolute flex items-center justify-center"
                style={{ 
                  left: '60px',
                  right: '60px',
                  top: '60px',
                  bottom: '140px',
                  zIndex: 2 
                }}
              >
                <img 
                  src={characterIllustration.url}
                  alt={`Page ${leftPage?.page_number}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            
            {/* Text - at bottom, never overlaps */}
            {leftPage && (
              <div 
                className="absolute flex items-center justify-center px-8"
                style={{ 
                  left: '40px',
                  right: '40px',
                  bottom: '40px',
                  height: '80px',
                  zIndex: 3 
                }}
              >
                <p className="text-center text-lg font-patrick text-gray-800 leading-relaxed">
                  {leftPage.narration}
                </p>
              </div>
            )}
            
            {/* SFX for left page - positioned to avoid overlaps */}
            {leftPage && pageSFX[leftPage.page_number] && (
              <motion.div
                className="absolute"
                style={{
                  left: characterSide === 'left' ? '280px' : '80px',
                  top: '60px',
                  transform: `rotate(${pageSFX[leftPage.page_number].rotation}deg)`,
                  zIndex: 4
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.3 }}
              >
                <span className={`text-3xl font-bold ${
                  pageSFX[leftPage.page_number].style === 'dramatic' ? 'text-red-500' :
                  pageSFX[leftPage.page_number].style === 'soft' ? 'text-blue-400' :
                  'text-purple-600'
                }`} style={{ fontFamily: 'Patrick Hand' }}>
                  {pageSFX[leftPage.page_number].text}
                </span>
              </motion.div>
            )}
            
            {/* Page number */}
            <div className="absolute bottom-2 left-3 text-xs text-gray-300">
              {leftPage?.page_number}
            </div>
          </div>
          
          {/* Center spine - subtle */}
          <div className="w-px bg-gradient-to-b from-gray-200/50 via-gray-300/50 to-gray-200/50" />
          
          {/* Right Page */}
          <div className="relative w-1/2 h-full bg-white overflow-hidden">
            {/* Safe area guides */}
            {showSafeAreas && (
              <div className="absolute inset-10 border-2 border-green-400/30 border-dashed pointer-events-none" />
            )}
            
            {/* Decoration */}
            {decoration?.rightPageDecoration && (
              <div
                className="absolute"
                style={{
                  left: `${decoration.rightPageDecoration.x}px`,
                  top: `${decoration.rightPageDecoration.y}px`,
                  width: `${decoration.rightPageDecoration.width}px`,
                  height: `${decoration.rightPageDecoration.height}px`,
                  zIndex: 1,
                  opacity: 0.6
                }}
              >
                <img 
                  src={generateDecorationPlaceholder(decoration.rightPageDecoration)}
                  alt="decoration"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            
            {/* Character illustration - only if on right */}
            {characterSide === 'right' && characterIllustration?.url && (
              <div 
                className="absolute flex items-center justify-center"
                style={{ 
                  left: '60px',
                  right: '60px',
                  top: '60px',
                  bottom: '140px',
                  zIndex: 2 
                }}
              >
                <img 
                  src={characterIllustration.url}
                  alt={`Page ${rightPage?.page_number}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            
            {/* Text */}
            {rightPage && (
              <div 
                className="absolute flex items-center justify-center px-8"
                style={{ 
                  left: '40px',
                  right: '40px',
                  bottom: '40px',
                  height: '80px',
                  zIndex: 3 
                }}
              >
                <p className="text-center text-lg font-patrick text-gray-800 leading-relaxed">
                  {rightPage.narration}
                </p>
              </div>
            )}
            
            {/* SFX for right page */}
            {rightPage && pageSFX[rightPage.page_number] && (
              <motion.div
                className="absolute"
                style={{
                  left: characterSide === 'right' ? '80px' : '280px',
                  top: '60px',
                  transform: `rotate(${pageSFX[rightPage.page_number].rotation}deg)`,
                  zIndex: 4
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.5 }}
              >
                <span className={`text-3xl font-bold ${
                  pageSFX[rightPage.page_number].style === 'dramatic' ? 'text-red-500' :
                  pageSFX[rightPage.page_number].style === 'soft' ? 'text-blue-400' :
                  'text-purple-600'
                }`} style={{ fontFamily: 'Patrick Hand' }}>
                  {pageSFX[rightPage.page_number].text}
                </span>
              </motion.div>
            )}
            
            {/* Page number */}
            <div className="absolute bottom-2 right-3 text-xs text-gray-300">
              {rightPage?.page_number}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="card-magical">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-patrick gradient-text">
            Your Storybook Preview
          </h2>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode(viewMode === 'spread' ? 'grid' : 'spread')}
              className="btn-secondary flex items-center gap-2"
            >
              {viewMode === 'spread' ? <Grid className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
              {viewMode === 'spread' ? 'Grid View' : 'Book View'}
            </button>
            
            <button
              onClick={() => setShowSafeAreas(!showSafeAreas)}
              className={`px-3 py-2 rounded-lg transition-all ${
                showSafeAreas ? 'bg-green-100 text-green-700' : 'bg-gray-100'
              }`}
              title="Show Safe Areas"
            >
              <Eye className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Book View */}
      {viewMode === 'spread' && (
        <div className="card-magical">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSpread}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Book container with proper aspect ratio */}
              <div className="bg-gradient-to-br from-purple-50/30 to-pink-50/30 rounded-2xl p-6">
                {renderSpread(currentSpread)}
              </div>
              
              {/* Info Bar */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                <span className="font-medium text-gray-700">
                  Pages {currentSpread * 2 + 1}–{Math.min((currentSpread * 2) + 2, storyData?.pages.length || 0)}
                </span>
                <div className="flex gap-3 text-sm">
                  {Object.keys(pageSFX).filter(pn => 
                    Number(pn) === (currentSpread * 2 + 1) || Number(pn) === (currentSpread * 2 + 2)
                  ).length > 0 && (
                    <span className="text-purple-600 flex items-center gap-1">
                      <Volume2 className="h-4 w-4" />
                      Sound Effects
                    </span>
                  )}
                  <span className="text-gray-600">
                    {babyProfile?.baby_name}'s Story
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          
          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setCurrentSpread(Math.max(0, currentSpread - 1))}
              disabled={currentSpread === 0}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <ChevronLeft className="h-5 w-5" />
              Previous
            </button>
            
            {/* Page dots */}
            <div className="flex gap-1.5">
              {Array.from({ length: spreads }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSpread(index)}
                  className={`transition-all ${
                    currentSpread === index
                      ? 'w-8 h-2 bg-purple-600 rounded-full'
                      : 'w-2 h-2 bg-gray-300 hover:bg-gray-400 rounded-full'
                  }`}
                  aria-label={`Go to spread ${index + 1}`}
                />
              ))}
            </div>
            
            <button
              onClick={() => setCurrentSpread(Math.min(spreads - 1, currentSpread + 1))}
              disabled={currentSpread >= spreads - 1}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
                  <div className="aspect-[2/1] bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-purple-300" />
                  </div>
                  <div className="p-2 text-center bg-gray-50">
                    <p className="text-xs font-medium">
                      Pages {index * 2 + 1}–{Math.min((index * 2) + 2, storyData?.pages.length || 0)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="card-magical flex justify-center gap-4">
        <button
          onClick={() => toast.success('Export functionality coming soon!')}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="h-5 w-5" />
          Export PDF
        </button>
        
        <button
          onClick={onComplete}
          className="btn-primary flex items-center gap-2"
        >
          <Check className="h-5 w-5" />
          Finalize Book
        </button>
      </div>
    </div>
  );
}