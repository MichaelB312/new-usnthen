// components/book-preview/LandscapeSpreadViewer.tsx
'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import { buildSpreads } from '@/lib/utils/buildSpreads';
import { exportBookToPDF, validatePagesForExport, estimatePDFSize } from '@/lib/utils/pdfExport';
import toast from 'react-hot-toast';

interface LandscapeSpreadViewerProps {
  onComplete: () => void;
}

export function LandscapeSpreadViewer({ onComplete }: LandscapeSpreadViewerProps) {
  const { storyData, illustrations, babyProfile } = useBookStore();
  const [currentSpread, setCurrentSpread] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Build spreads array from pages
  const spreads = useMemo(() => {
    if (!storyData?.pages) return [];
    return buildSpreads(storyData.pages, illustrations || []);
  }, [storyData?.pages, illustrations]);

  // Export handler
  const handleExportPDF = async () => {
    try {
      setIsExporting(true);

      // Get all spread image URLs
      const spreadImages = spreads
        .map(spread => spread.imageUrl)
        .filter(url => url && url.length > 0);

      // Validate pages
      const validation = validatePagesForExport(spreadImages);

      if (!validation.valid) {
        toast.error(`Cannot export: ${validation.errors.join(', ')}`);
        return;
      }

      if (validation.warnings.length > 0) {
        console.warn('[PDF Export] Warnings:', validation.warnings);
      }

      // Show estimated size
      const estimatedMB = estimatePDFSize(spreadImages);
      toast.loading(`Preparing PDF (est. ${estimatedMB.toFixed(1)}MB)...`, { id: 'pdf-export' });

      // Export
      const bookTitle = `${babyProfile?.baby_name || 'Baby'}'s Story`;
      await exportBookToPDF(spreadImages, bookTitle, true);

      toast.success('PDF downloaded successfully!', { id: 'pdf-export' });
    } catch (error) {
      console.error('[PDF Export] Failed:', error);
      toast.error('Failed to export PDF', { id: 'pdf-export' });
    } finally {
      setIsExporting(false);
    }
  };

  if (spreads.length === 0) return null;

  const renderSpread = (spreadIndex: number) => {
    const spread = spreads[spreadIndex];

    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-50/30 to-pink-50/30 p-8">
        {/* Landscape Image Container - 1536×1024 ratio, IS the book (not on a book) */}
        <div className="relative w-full max-w-7xl shadow-2xl overflow-hidden rounded-sm" style={{ aspectRatio: '1536/1024' }}>
          {/* The landscape spread image */}
          {spread.imageUrl ? (
            <div className="relative w-full h-full">
              {/* Full landscape image - scaled slightly to ensure full bleed, no white edges */}
              <img
                src={spread.imageUrl}
                alt={spread.pageRangeLabel}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  display: 'block',
                  transform: 'scale(1.02)', // Slight scale ensures no white padding/edges
                  transformOrigin: 'center'
                }}
              />

              {/* Open book spine effect - divider with shadows overlaid directly on image */}
              <div className="absolute inset-y-0 pointer-events-none z-10" style={{ left: '50%', transform: 'translateX(-50%)', width: '3px' }}>
                {/* Center spine line - darker for book binding effect */}
                <div className="absolute inset-0 bg-gray-700/40" />

                {/* Left page shadow (inner edge shadow) - deeper for realism */}
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    right: '100%',
                    width: '32px',
                    background: 'linear-gradient(to left, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.12) 30%, rgba(0,0,0,0.05) 60%, transparent 100%)',
                  }}
                />

                {/* Right page shadow (inner edge shadow) - deeper for realism */}
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: '100%',
                    width: '32px',
                    background: 'linear-gradient(to right, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.12) 30%, rgba(0,0,0,0.05) 60%, transparent 100%)',
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <p className="text-gray-500 font-patrick text-lg">Generating illustration...</p>
            </div>
          )}
        </div>

        {/* Page range label below the spread */}
        <div className="mt-4 text-sm font-medium text-gray-600 bg-white/80 px-4 py-2 rounded-full shadow">
          {spread.pageRangeLabel}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 bg-white shadow-sm flex items-center justify-between">
        <h2 className="font-patrick text-2xl gradient-text">
          {babyProfile?.baby_name}'s Story
        </h2>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Spread {currentSpread + 1} of {spreads.length}
          </div>

          <button
            onClick={handleExportPDF}
            disabled={isExporting || spreads.some(s => !s.imageUrl)}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Spread Viewer */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSpread}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="w-full h-full"
          >
            {renderSpread(currentSpread)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="p-4 bg-white shadow-lg flex items-center justify-between">
        <button
          onClick={() => setCurrentSpread(Math.max(0, currentSpread - 1))}
          disabled={currentSpread === 0}
          className="btn-ghost flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-5 w-5" />
          Previous
        </button>

        <div className="flex gap-2">
          {spreads.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSpread(idx)}
              className={`w-3 h-3 rounded-full transition-colors ${
                idx === currentSpread
                  ? 'bg-purple-600'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to spread ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => {
            if (currentSpread === spreads.length - 1) {
              onComplete();
            } else {
              setCurrentSpread(currentSpread + 1);
            }
          }}
          className="btn-primary flex items-center gap-2"
        >
          {currentSpread === spreads.length - 1 ? 'Complete' : 'Next'}
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}