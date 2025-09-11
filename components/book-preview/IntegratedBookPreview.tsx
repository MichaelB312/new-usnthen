
// ===========================
// components/book-preview/IntegratedBookPreview.tsx
// Complete integrated book preview with all batches
// ===========================
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, BookOpen, Grid, Eye,
  Check, Download, Settings, Volume2, Sparkles
} from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import { DecorationGenerator } from '@/lib/decorations/DecorationGenerator';
import { SFXRenderer, SFXGenerator } from '@/components/book-preview/SFXRenderer';
import toast from 'react-hot-toast';

interface IntegratedSpread {
  spreadNumber: number;
  leftPage: any;
  rightPage: any;
  characterPlacement: 'left' | 'right' | 'center';
  decorations: {
    left: any[];
    right: any[];
  };
  sfx: {
    left?: any;
    right?: any;
  };
}

export function IntegratedBookPreview({ onComplete }: { onComplete: () => void }) {
  const { 
    storyData, 
    illustrations,
    bookId
  } = useBookStore();
  
  const [currentSpread, setCurrentSpread] = useState(0);
  const [viewMode, setViewMode] = useState<'spread' | 'grid'>('spread');
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const [spreads, setSpreads] = useState<IntegratedSpread[]>([]);
  const [decorationsLoading, setDecorationsLoading] = useState(false);
  
  const decorationGenerator = new DecorationGenerator();
  
  // Initialize spreads with all data
  useEffect(() => {
    if (!storyData?.pages) return;
    
    const initializeSpreads = async () => {
      setDecorationsLoading(true);
      const integratedSpreads: IntegratedSpread[] = [];
      
      for (let i = 0; i < storyData.pages.length; i += 2) {
        const leftPage = storyData.pages[i];
        const rightPage = storyData.pages[i + 1];
        const spreadNum = Math.floor(i / 2);
        
        // Determine character placement
        let placement: 'left' | 'right' | 'center' = spreadNum % 2 === 0 ? 'left' : 'right';
        
        // Center for opening/closing
        if (leftPage?.scene_type === 'opening' || rightPage?.scene_type === 'closing') {
          placement = 'center';
        }
        
        // Generate decorations
        const spreadDecorations = decorationGenerator.generateSpreadDecorations(
          spreadNum + 1,
          leftPage?.narration || '',
          rightPage?.narration || ''
        );
        
        // Detect and configure SFX
        const leftSFX = leftPage ? SFXGenerator.detectSFX(leftPage.narration) : null;
        const rightSFX = rightPage ? SFXGenerator.detectSFX(rightPage.narration) : null;
        
        integratedSpreads.push({
          spreadNumber: spreadNum + 1,
          leftPage,
          rightPage,
          characterPlacement: placement,
          decorations: {
            left: spreadDecorations.leftPageDecorations,
            right: spreadDecorations.rightPageDecorations
          },
          sfx: {
            left: leftSFX?.hasSFX ? {
              text: leftPage.sfx_text || leftSFX.suggestedSFX,
              config: SFXGenerator.generateSFXConfig(
                leftPage.sfx_text || leftSFX.suggestedSFX,
                { width: 400, height: 400 },
                placement === 'left' ? 'left' : undefined
              )
            } : undefined,
            right: rightSFX?.hasSFX ? {
              text: rightPage.sfx_text || rightSFX.suggestedSFX,
              config: SFXGenerator.generateSFXConfig(
                rightPage.sfx_text || rightSFX.suggestedSFX,
                { width: 400, height: 400 },
                placement === 'right' ? 'right' : undefined
              )
            } : undefined
          }
        });
      }
      
      setSpreads(integratedSpreads);
      setDecorationsLoading(false);
    };
    
    initializeSpreads();
  }, [storyData]);
  
  const renderPage = (page: any, side: 'left' | 'right', spread: IntegratedSpread) => {
    if (!page) return null;
    
    const illustration = illustrations?.find(ill => ill.page_number === page.page_number);
    const hasCharacter = (
      (spread.characterPlacement === side && page.characters_on_page?.length > 0) ||
      (spread.characterPlacement === 'center' && page.characters_on_page?.length > 0)
    );
    const decorations = side === 'left' ? spread.decorations.left : spread.decorations.right;
    const sfx = side === 'left' ? spread.sfx.left : spread.sfx.right;
    
    return (
      <div className="relative w-[400px] h-[400px] bg-white rounded-lg shadow-inner overflow-hidden">
        {/* Safe area guides */}
        {showSafeAreas && (
          <div className="absolute inset-4 border-2 border-green-400 border-dashed opacity-30 pointer-events-none" />
        )}
        
        {/* Decorations (behind everything) */}
        {decorations.map((decor, idx) => (
          <div
            key={idx}
            className="absolute"
            style={{
              left: `${decor.x}px`,
              top: `${decor.y}px`,
              width: `${decor.width}px`,
              height: `${decor.height}px`,
              opacity: 0.7
            }}
          >
            <div className="w-full h-full bg-gradient-to-br from-purple-200 to-pink-200 rounded" />
            <span className="absolute bottom-1 right-1 text-xs text-purple-600">
              {decor.storyRelevance}
            </span>
          </div>
        ))}
        
        {/* Character illustration */}
        {hasCharacter && illustration?.url && (
          <div className="absolute inset-8 flex items-center justify-center">
            <img 
              src={illustration.url}
              alt={`Page ${page.page_number}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
        
        {/* Caption */}
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-center text-lg font-patrick text-gray-800 bg-white/90 rounded-lg p-2">
            {page.narration}
          </p>
        </div>
        
        {/* SFX */}
        {sfx && page.has_sfx && (
          <SFXRenderer
            sfxConfig={sfx.config}
            pageWidth={400}
            pageHeight={400}
            safeMargins={{ top: 20, bottom: 80, left: 20, right: 20 }}
          />
        )}
        
        {/* Page number */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {page.page_number}
        </div>
      </div>
    );
  };
  
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="card-magical">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-patrick gradient-text">
            Complete Book Preview
          </h2>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode(viewMode === 'spread' ? 'grid' : 'spread')}
              className="btn-secondary flex items-center gap-2"
            >
              {viewMode === 'spread' ? <Grid className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
              {viewMode === 'spread' ? 'Grid View' : 'Spread View'}
            </button>
            
            <button
              onClick={() => setShowSafeAreas(!showSafeAreas)}
              className={`px-3 py-2 rounded transition-all ${
                showSafeAreas ? 'bg-green-100 text-green-700' : 'bg-gray-100'
              }`}
            >
              <Eye className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {decorationsLoading && (
        <div className="card-magical text-center py-12">
          <Sparkles className="h-12 w-12 text-purple-600 mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-gray-600">Generating decorations...</p>
        </div>
      )}

      {/* Spread View */}
      {!decorationsLoading && viewMode === 'spread' && spreads[currentSpread] && (
        <div className="card-magical">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSpread}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-2xl overflow-hidden p-8">
                <div className="flex gap-4 justify-center">
                  {renderPage(spreads[currentSpread].leftPage, 'left', spreads[currentSpread])}
                  {renderPage(spreads[currentSpread].rightPage, 'right', spreads[currentSpread])}
                </div>
                
                {/* Center binding */}
                <div className="absolute left-1/2 top-8 bottom-8 w-1 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-300 transform -translate-x-1/2" />
              </div>
              
              {/* Spread Info */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                <span className="font-medium">
                  Spread {currentSpread + 1} of {spreads.length}
                </span>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span>Character: {spreads[currentSpread].characterPlacement}</span>
                  <span>Decorations: {
                    spreads[currentSpread].decorations.left.length + 
                    spreads[currentSpread].decorations.right.length
                  }</span>
                  <span>SFX: {
                    (spreads[currentSpread].sfx.left ? 1 : 0) +
                    (spreads[currentSpread].sfx.right ? 1 : 0)
                  }</span>
                </div>
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
            
            <div className="flex gap-2">
              {spreads.map((_, index) => (
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
              onClick={() => setCurrentSpread(Math.min(spreads.length - 1, currentSpread + 1))}
              disabled={currentSpread >= spreads.length - 1}
              className="btn-secondary flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </button>
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