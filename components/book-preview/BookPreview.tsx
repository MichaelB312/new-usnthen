'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Edit2, Check, Download, Eye, Grid, BookOpen } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import { LayoutEngine } from '@/lib/layout/LayoutEngine';
import { Canvas } from '@/components/book-preview/Canvas';
import toast from 'react-hot-toast';

export function BookPreview({ onComplete }: { onComplete: () => void }) {
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
  const [generatingLayouts, setGeneratingLayouts] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    generateLayouts();
  }, []);
  
  const generateLayouts = async () => {
    if (!storyData || !illustrations.length) return;
    
    setGeneratingLayouts(true);
    
    for (let i = 0; i < storyData.pages.length; i++) {
      const page = storyData.pages[i];
      const illustration = illustrations.find(ill => ill.page_number === page.page_number);
      
      if (illustration) {
        const engine = new LayoutEngine(bookId || 'default', page.page_number);
        const layout = engine.generateLayout(
          page.layout_template,
          page.narration,
          illustration.url
        );
        
        setPageLayout(page.page_number, layout);
      }
    }
    
    setGeneratingLayouts(false);
    toast.success('Layouts generated!');
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
      const engine = new LayoutEngine(bookId || 'default', editingPage + 1);
      const illustration = illustrations.find(ill => ill.page_number === editingPage + 1);
      
      if (illustration) {
        const layout = engine.generateLayout(
          updatedPages[editingPage].layout_template,
          editedText,
          illustration.url
        );
        setPageLayout(editingPage + 1, layout);
      }
      
      setEditingPage(null);
      toast.success('Text updated!');
    }
  };
  
  const exportPage = async (pageNumber: number) => {
    const layout = layouts[pageNumber];
    if (!layout || !canvasRef.current) return;
    
    // Render at print resolution
    await renderPageToCanvas(canvasRef.current, layout, 300);
    
    // Export as PNG
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `page-${pageNumber}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png', 1.0);
  };
  
  const renderPageToCanvas = async (
    canvas: HTMLCanvasElement, 
    layout: any, 
    dpi: number
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size for print
    canvas.width = layout.canvas.width;
    canvas.height = layout.canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render each element
    for (const element of layout.elements) {
      ctx.save();
      
      // Apply transformations
      ctx.translate(element.x, element.y);
      ctx.rotate((element.rotation * Math.PI) / 180);
      
      if (element.type === 'image' && element.url) {
        const img = new Image();
        img.src = element.url;
        await new Promise(resolve => {
          img.onload = resolve;
        });
        ctx.drawImage(
          img, 
          -element.width / 2, 
          -element.height / 2, 
          element.width, 
          element.height
        );
      } else if (element.type === 'text' && element.content) {
        ctx.font = `${element.style.font_size_pt}pt ${element.style.font_family}`;
        ctx.fillStyle = element.style.color;
        ctx.textAlign = element.style.text_align || 'left';
        
        // Simple text wrapping
        const words = element.content.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine + word + ' ';
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > element.width && currentLine !== '') {
            lines.push(currentLine);
            currentLine = word + ' ';
          } else {
            currentLine = testLine;
          }
        }
        lines.push(currentLine);
        
        // Draw each line
        const lineHeight = element.style.font_size_pt * 1.2;
        lines.forEach((line, index) => {
          ctx.fillText(
            line, 
            0, 
            -element.height / 2 + (index + 1) * lineHeight
          );
        });
      }
      
      ctx.restore();
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Controls */}
      <div className="card-magical">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-patrick gradient-text">
            Preview Your Book
          </h2>
          
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-2 rounded ${viewMode === 'single' ? 'bg-white shadow' : ''}`}
              >
                <BookOpen className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('spread')}
                className={`px-3 py-2 rounded ${viewMode === 'spread' ? 'bg-white shadow' : ''}`}
              >
                <Eye className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
              >
                <Grid className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

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
              {/* Page Display */}
              <div className="bg-white rounded-2xl shadow-2xl aspect-[3/4] relative overflow-hidden">
                {layouts[currentPage + 1] ? (
                  <Canvas 
                    layout={layouts[currentPage + 1]} 
                    width={800}
                    height={1067}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-gray-400">Generating layout...</p>
                  </div>
                )}
                
                {/* Page Number */}
                <div className="absolute top-4 right-4 bg-white/90 px-3 py-1 rounded-full shadow">
                  <span className="text-sm font-medium">
                    Page {currentPage + 1} of {storyData?.pages.length || 0}
                  </span>
                </div>
                
                {/* Edit Button */}
                <button
                  onClick={() => handleEditText(currentPage)}
                  className="absolute bottom-4 right-4 btn-secondary"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Text
                </button>
              </div>
              
              {/* Text Edit Modal */}
              {editingPage === currentPage && (
                <div className="mt-6 p-6 bg-purple-50 rounded-xl">
                  <h3 className="font-semibold mb-3">Edit Page Text</h3>
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full p-4 border-2 border-purple-300 rounded-lg resize-none"
                    rows={3}
                  />
                  <div className="flex gap-3 mt-4">
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
              Previous
            </button>
            
            {/* Page Dots */}
            <div className="flex gap-2">
              {storyData?.pages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPage(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    currentPage === index
                      ? 'w-8 bg-purple-600'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
            
            <button
              onClick={() => setCurrentPage(Math.min((storyData?.pages.length || 1) - 1, currentPage + 1))}
              disabled={currentPage === (storyData?.pages.length || 1) - 1}
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
          <div className="grid md:grid-cols-3 gap-6">
            {storyData?.pages.map((page, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="cursor-pointer"
                onClick={() => {
                  setCurrentPage(index);
                  setViewMode('single');
                }}
              >
                <div className="bg-white rounded-lg shadow-lg aspect-[3/4] overflow-hidden">
                  {layouts[page.page_number] ? (
                    <Canvas 
                      layout={layouts[page.page_number]} 
                      width={300}
                      height={400}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100" />
                  )}
                </div>
                <p className="text-center mt-2 text-sm font-medium">
                  Page {page.page_number}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="card-magical">
        <div className="flex gap-4">
          <button
            onClick={() => exportPage(currentPage + 1)}
            className="btn-secondary flex-1"
          >
            <Download className="h-5 w-5 mr-2" />
            Export Current Page
          </button>
          
          <button
            onClick={onComplete}
            className="btn-primary flex-1"
          >
            Looks Perfect! Continue to Checkout
          </button>
        </div>
      </div>
      
      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}