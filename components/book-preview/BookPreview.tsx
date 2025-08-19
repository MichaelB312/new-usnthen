// components/book-preview/BookPreview.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Edit2, 
  Check, 
  Download, 
  Eye, 
  Grid, 
  BookOpen,
  Settings,
  FileDown,
  Printer,
  Home
} from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import { EnhancedLayoutEngine } from '@/lib/layout/EnhancedLayoutEngine';
import { sanitizePageLayout, detectDeprecatedContent } from '@/lib/layout/sanitizer';
import { EnhancedCanvas } from '@/components/book-preview/Canvas';
import { PDFDocument, rgb } from 'pdf-lib';
import toast from 'react-hot-toast';

export function EnhancedBookPreview({ onComplete }: { onComplete: () => void }) {
  const { 
    bookId,
    storyData, 
    illustrations, 
    layouts,
    setPageLayout 
  } = useBookStore();
  
  const [currentPage, setCurrentPage] = useState(0);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');
  const [viewMode, setViewMode] = useState<'single' | 'spread' | 'grid'>('single');
  const [showGuides, setShowGuides] = useState(false);
  const [showBleed, setShowBleed] = useState(false);
  const [showGutter, setShowGutter] = useState(false);
  const [generatingLayouts, setGeneratingLayouts] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  
  useEffect(() => {
    // Check for deprecated content on mount
    const deprecationCheck = detectDeprecatedContent({ layouts, storyData });
    if (deprecationCheck.hasDeprecations) {
      console.info('Legacy decorations detected and will be ignored:', deprecationCheck);
    }
    
    generateLayouts();
  }, []);
  
  const generateLayouts = async () => {
    if (!storyData || !illustrations || illustrations.length === 0) {
      console.log('Missing data for layout generation:', { 
        hasStory: !!storyData, 
        illustrationCount: illustrations?.length || 0 
      });
      return;
    }
    
    setGeneratingLayouts(true);
    
    try {
      for (let i = 0; i < storyData.pages.length; i++) {
        const page = storyData.pages[i];
        const illustration = illustrations.find(ill => ill.page_number === page.page_number);
        
        if (illustration && illustration.url) {
          // Use enhanced layout engine with new print specs
          const engine = new EnhancedLayoutEngine(bookId || 'default', page.page_number);
          const layout = engine.generateLayout(
            page.layout_template || 'auto',
            page.narration,
            illustration.url, // Make sure URL exists
            page.shot || page.closest_shot,
            page.action_id,
            page.emotion
          );
          
          setPageLayout(page.page_number, layout);
        } else {
          console.warn(`No illustration found for page ${page.page_number}`);
        }
      }
    } catch (error) {
      console.error('Error generating layouts:', error);
      toast.error('Failed to generate some layouts');
    } finally {
      setGeneratingLayouts(false);
      toast.success('Layouts generated!');
    }
  };
  
  const handleEditText = (pageNumber: number) => {
    setEditingPage(pageNumber);
    setEditedText(storyData?.pages[pageNumber].narration || '');
  };
  
  const saveEdit = () => {
    if (editingPage !== null && storyData) {
      const updatedPages = [...storyData.pages];
      updatedPages[editingPage].narration = editedText;
      
      useBookStore.setState({
        storyData: {
          ...storyData,
          pages: updatedPages
        }
      });
      
      // Regenerate layout for this page
      const engine = new EnhancedLayoutEngine(bookId || 'default', editingPage + 1);
      const illustration = illustrations.find(ill => ill.page_number === editingPage + 1);
      
      if (illustration) {
        const page = updatedPages[editingPage];
        const layout = engine.generateLayout(
          page.layout_template || 'auto',
          editedText,
          illustration.url,
          page.shot || page.closest_shot,
          page.action_id,
          page.emotion
        );
        setPageLayout(editingPage + 1, layout);
      }
      
      setEditingPage(null);
      toast.success('Text updated and layout regenerated!');
    }
  };
  
  const exportPageAsPNG = (dataUrl: string, pageNumber: number) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `page-${pageNumber}-print-ready.png`;
    link.click();
    toast.success(`Page ${pageNumber} exported at print resolution!`);
  };
  
  const exportAllAsPDF = async () => {
    setExportingPDF(true);
    
    try {
      const pdfDoc = await PDFDocument.create();
      
      // Set metadata
      pdfDoc.setTitle(storyData?.title || 'My Storybook');
      pdfDoc.setAuthor('Us & Then');
      pdfDoc.setCreationDate(new Date());
      
      // For each page, capture canvas and add to PDF
      for (let i = 0; i < (storyData?.pages.length || 0); i++) {
        const layout = layouts[i + 1];
        if (!layout) continue;
        
        // Sanitize layout before processing
        const cleanLayout = sanitizePageLayout(layout);
        
        // Create a temporary canvas for export
        const canvas = document.createElement('canvas');
        canvas.width = cleanLayout.canvas.width;
        canvas.height = cleanLayout.canvas.height;
        
        // This would need actual canvas rendering logic
        // For now, we'll create a placeholder page
        const page = pdfDoc.addPage([
          cleanLayout.canvas.width * 0.75, // Convert to points (roughly)
          cleanLayout.canvas.height * 0.75
        ]);
        
        // Add page number
        page.drawText(`Page ${i + 1}`, {
          x: 50,
          y: 50,
          size: 12,
          color: rgb(0.5, 0.5, 0.5)
        });
      }
      
      // Generate PDF
      const pdfBytes = await pdfDoc.save();
      
      // FIX: Use slice() to create proper ArrayBuffer view
      const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${storyData?.title || 'storybook'}-print-ready.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExportingPDF(false);
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Controls */}
      <div className="card-magical">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-patrick gradient-text">
            Your Book Layout
          </h2>
          
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-2 rounded transition-all ${
                  viewMode === 'single' ? 'bg-white shadow' : ''
                }`}
                title="Single Page"
              >
                <BookOpen className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('spread')}
                className={`px-3 py-2 rounded transition-all ${
                  viewMode === 'spread' ? 'bg-white shadow' : ''
                }`}
                title="Two-Page Spread"
              >
                <Eye className="h-5 w-5" />
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
            
            {/* Print Settings */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowGuides(!showGuides)}
                className={`px-3 py-2 rounded transition-all ${
                  showGuides ? 'bg-green-100 text-green-700' : 'bg-gray-100'
                }`}
                title="Toggle Safe Area Guides"
              >
                Safe Area
              </button>
              <button
                onClick={() => setShowBleed(!showBleed)}
                className={`px-3 py-2 rounded transition-all ${
                  showBleed ? 'bg-red-100 text-red-700' : 'bg-gray-100'
                }`}
                title="Toggle Bleed Area"
              >
                Bleed
              </button>
              <button
                onClick={() => setShowGutter(!showGutter)}
                className={`px-3 py-2 rounded transition-all ${
                  showGutter ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
                }`}
                title="Toggle Gutter Guide"
              >
                Gutter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Book Display */}
     {/* Book Display */}
{viewMode === 'single' && (
  <div className="card-magical">
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="relative"
      >
        {/* Book Spread View - Two Pages Side by Side */}
        <div className="bg-gray-100 rounded-2xl shadow-2xl overflow-hidden p-8">
          <div className="grid grid-cols-2 gap-4">
            {/* Left Page */}
            <div className="bg-white rounded-lg shadow-inner">
              {currentPage * 2 < (storyData?.pages.length || 0) && layouts[currentPage * 2 + 1] ? (
                <EnhancedCanvas 
                  layout={layouts[currentPage * 2 + 1]} 
                  width={800}
                  height={600}
                  showGuides={showGuides}
                  showBleed={showBleed}
                  showGutter={showGutter}
                  onExport={(dataUrl) => exportPageAsPNG(dataUrl, currentPage * 2 + 1)}
                />
              ) : (
                <div className="w-[800px] h-[600px] flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                  {currentPage * 2 >= (storyData?.pages.length || 0) ? (
                    <p className="text-gray-400 text-2xl font-patrick">The End</p>
                  ) : (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-gray-500">Generating layout...</p>
                    </div>
                  )}
                </div>
              )}
              <div className="text-center py-2 border-t">
                <span className="text-sm text-gray-500">Page {currentPage * 2 + 1}</span>
              </div>
            </div>
            
            {/* Right Page */}
            <div className="bg-white rounded-lg shadow-inner">
              {currentPage * 2 + 1 < (storyData?.pages.length || 0) && layouts[currentPage * 2 + 2] ? (
                <EnhancedCanvas 
                  layout={layouts[currentPage * 2 + 2]} 
                  width={800}
                  height={600}
                  showGuides={showGuides}
                  showBleed={showBleed}
                  showGutter={showGutter}
                  onExport={(dataUrl) => exportPageAsPNG(dataUrl, currentPage * 2 + 2)}
                />
              ) : (
                <div className="w-[800px] h-[600px] flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                  {currentPage * 2 + 1 >= (storyData?.pages.length || 0) ? (
                    <p className="text-gray-400 text-2xl font-patrick">The End</p>
                  ) : (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-gray-500">Generating layout...</p>
                    </div>
                  )}
                </div>
              )}
              <div className="text-center py-2 border-t">
                <span className="text-sm text-gray-500">Page {currentPage * 2 + 2}</span>
              </div>
            </div>
          </div>
          
          {/* Center binding line */}
          <div className="absolute left-1/2 top-8 bottom-8 w-1 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-300 transform -translate-x-1/2 shadow-inner"></div>
        </div>
        
        {/* Page Info Bar */}
        <div className="flex items-center justify-between mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="font-medium">
              Spread {currentPage + 1} of {Math.ceil((storyData?.pages.length || 0) / 2)}
            </span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                const leftPage = currentPage * 2;
                if (leftPage < (storyData?.pages.length || 0)) {
                  handleEditText(leftPage);
                }
              }}
              className="btn-secondary text-sm"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Left Page
            </button>
            <button
              onClick={() => {
                const rightPage = currentPage * 2 + 1;
                if (rightPage < (storyData?.pages.length || 0)) {
                  handleEditText(rightPage);
                }
              }}
              className="btn-secondary text-sm"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Right Page
            </button>
          </div>
        </div>
        
        {/* Text Edit Modal */}
        {editingPage !== null && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-6 bg-purple-50 rounded-xl"
          >
            <h3 className="font-semibold mb-3">Edit Page {editingPage + 1} Text</h3>
            <p className="text-sm text-gray-600 mb-3">
              Remember: Maximum 20 words for ages 0-3
            </p>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full p-4 border-2 border-purple-300 rounded-lg resize-none focus:outline-none focus:border-purple-500"
              rows={3}
              maxLength={100}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-gray-500">
                {editedText.split(' ').length} words
              </span>
              <div className="flex gap-3">
                <button onClick={saveEdit} className="btn-primary">
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </button>
                <button 
                  onClick={() => setEditingPage(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
    
    {/* Navigation */}
    <div className="flex items-center justify-between mt-8">
      <button
        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className="btn-secondary flex items-center gap-2"
      >
        <ChevronLeft className="h-5 w-5" />
        Previous Spread
      </button>
      
      {/* Page Dots */}
      <div className="flex gap-2">
        {Array.from({ length: Math.ceil((storyData?.pages.length || 0) / 2) }, (_, index) => (
          <button
            key={index}
            onClick={() => setCurrentPage(index)}
            className={`transition-all ${
              currentPage === index
                ? 'w-8 h-2 bg-purple-600 rounded-full'
                : 'w-2 h-2 bg-gray-300 hover:bg-gray-400 rounded-full'
            }`}
          />
        ))}
      </div>
      
      <button
        onClick={() => setCurrentPage(Math.min(Math.ceil((storyData?.pages.length || 0) / 2) - 1, currentPage + 1))}
        disabled={currentPage >= Math.ceil((storyData?.pages.length || 0) / 2) - 1}
        className="btn-secondary flex items-center gap-2"
      >
        Next Spread
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  </div>
)}

      {/* Spread View */}
      {viewMode === 'spread' && (
        <div className="card-magical">
          <div className="grid grid-cols-2 gap-8">
            {/* Left Page */}
            <div>
              <div className="text-center mb-2 text-sm text-gray-500">
                Page {currentPage * 2 + 1}
              </div>
              {layouts[currentPage * 2 + 1] ? (
                <EnhancedCanvas 
                  layout={layouts[currentPage * 2 + 1]} 
                  width={450}
                  height={300}
                  showGuides={showGuides}
                  showBleed={showBleed}
                  showGutter={showGutter}
                />
              ) : (
                <div className="w-full h-[300px] bg-gray-100 rounded-lg" />
              )}
            </div>
            
            {/* Right Page */}
            <div>
              <div className="text-center mb-2 text-sm text-gray-500">
                Page {currentPage * 2 + 2}
              </div>
              {layouts[currentPage * 2 + 2] ? (
                <EnhancedCanvas 
                  layout={layouts[currentPage * 2 + 2]} 
                  width={450}
                  height={300}
                  showGuides={showGuides}
                  showBleed={showBleed}
                  showGutter={showGutter}
                />
              ) : (
                <div className="w-full h-[300px] bg-gray-100 rounded-lg" />
              )}
            </div>
          </div>
          
          {/* Spread Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="btn-secondary"
            >
              Previous Spread
            </button>
            
            <span className="text-sm text-gray-600">
              Spread {currentPage + 1} of {Math.ceil((storyData?.pages.length || 0) / 2)}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(Math.ceil((storyData?.pages.length || 0) / 2) - 1, currentPage + 1))}
              disabled={currentPage >= Math.ceil((storyData?.pages.length || 0) / 2) - 1}
              className="btn-secondary"
            >
              Next Spread
            </button>
          </div>
        </div>
      )}

      {/* Grid View */}
      {/* Grid View */}
{viewMode === 'grid' && (
  <div className="card-magical">
    <div className="grid md:grid-cols-3 gap-6">
      {storyData?.pages.map((page, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="cursor-pointer group"
          onClick={() => {
            setCurrentPage(index);
            setViewMode('single');
          }}
        >
          <div className="bg-white rounded-lg shadow-lg overflow-hidden transform transition-transform group-hover:scale-105">
            {layouts[page.page_number] ? (
              <EnhancedCanvas 
                layout={layouts[page.page_number]} 
                width={300}
                height={200}
                showGuides={false}
                showBleed={false}
                showGutter={false}
              />
            ) : (
              <div className="w-full h-[200px] bg-gradient-to-br from-purple-100 to-pink-100" />
            )}
          </div>
          <div className="mt-2 text-center">
            <p className="font-medium">Page {page.page_number}</p>
            <p className="text-xs text-gray-500">
              {page.shot} • {page.action_id?.replace(/_/g, ' ')}
            </p>
            {/* Use optional chaining to safely access visual_focus */}
            {(page as any).visual_focus && (
              <p className="text-xs text-purple-600 font-medium">
                Focus: {(page as any).visual_focus.replace(/_/g, ' ')}
              </p>
            )}
            {layouts[page.page_number]?.mode && (
              <p className="text-xs text-purple-600 font-medium">
                Layout: {layouts[page.page_number].mode}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  </div>
)}

      {/* Export Actions */}
      <div className="card-magical">
        <h3 className="text-xl font-semibold mb-4">Export Options</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <button
            onClick={exportAllAsPDF}
            disabled={exportingPDF}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            {exportingPDF ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent"></div>
                Generating PDF...
              </>
            ) : (
              <>
                <FileDown className="h-5 w-5" />
                Export Print-Ready PDF
              </>
            )}
          </button>
          
          <button
            className="btn-secondary flex items-center justify-center gap-2"
            onClick={() => toast('Print specifications exported!', { icon: '📋' })}
          >
            <Printer className="h-5 w-5" />
            Export Print Specs
          </button>
          
          <button
            onClick={onComplete}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Check className="h-5 w-5" />
            Looks Perfect!
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Enhanced Print Specifications:</h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <strong>Dimensions:</strong> 12" × 8" (3600×2400px)
            </div>
            <div>
              <strong>Resolution:</strong> 300 DPI
            </div>
            <div>
              <strong>Color Mode:</strong> RGB
            </div>
            <div>
              <strong>Bleed:</strong> 3mm (36px)
            </div>
            <div>
              <strong>Safe Margin:</strong> 12mm (142px)
            </div>
            <div>
              <strong>Gutter:</strong> 10mm (100px)
            </div>
            <div className="col-span-3 mt-2 pt-2 border-t">
              <strong>Layout Modes:</strong> image70, text70, fullBleed, closeup, spread
            </div>
            <div className="col-span-3">
              <strong>Text Size:</strong> 42-56pt for toddler readability
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Also export as default for compatibility
export default EnhancedBookPreview;