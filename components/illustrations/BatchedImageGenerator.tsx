// components/illustrations/BatchedImageGenerator.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Wand2, 
  Camera, 
  Sparkles, 
  Brush, 
  Book, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Lock,
  Clock
} from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

interface GeneratedImage {
  page_number: number;
  dataUrl: string; // CHANGED: Use dataUrl instead of url
  style: string;
  shot: string;
  action_id: string;
  prompt?: string;
  status: 'pending' | 'generating' | 'success' | 'error';
  error?: string;
  elapsed_ms?: number;
  model?: string;
  timestamp?: number;
}

// Constants for timing
const PAGE_TIMEOUT_MS = 300000; // 5 minutes per page (minimum 3 minutes requested)
const GAP_BETWEEN_PAGES_MS = 3000; // 3 second gap between pages

export function BatchedImageGenerator({ onComplete }: { onComplete: () => void }) {
  const { 
    babyProfile, 
    storyData, 
    bookId,
    setIllustrations,
    illustrationStyle,
    setIllustrationStyle 
  } = useBookStore();
  
  // State
  const [photoPreview, setPhotoPreview] = useState<string>(babyProfile?.baby_photo_url || '');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentGeneratingPage, setCurrentGeneratingPage] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pageStartTime, setPageStartTime] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // CRITICAL: Generation lock and runId to prevent parallel runs
  const generationLockRef = useRef<boolean>(false);
  const runIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Enhanced style options
  const styles = [
    { 
      id: 'wondrous', 
      name: 'Wondrous', 
      icon: Sparkles,
      description: 'Magical, airy watercolor',
      gradient: 'from-purple-400 to-pink-400'
    },
    { 
      id: 'crayon', 
      name: 'Crayon', 
      icon: Brush,
      description: 'Waxy, hand-drawn style',
      gradient: 'from-orange-400 to-red-400'
    },
    { 
      id: 'vintage', 
      name: 'Vintage', 
      icon: Book,
      description: 'Mid-century print aesthetic',
      gradient: 'from-amber-400 to-brown-400'
    }
  ];

  // Initialize images when story data is available
  useEffect(() => {
    if (storyData?.pages) {
      const initialImages: GeneratedImage[] = storyData.pages.map(page => ({
        page_number: page.page_number,
        dataUrl: '', // CHANGED: Initialize with empty dataUrl
        style: illustrationStyle,
        shot: page.shot || 'medium',
        action_id: page.action_id || '',
        status: 'pending'
      }));
      setGeneratedImages(initialImages);
    }
  }, [storyData, illustrationStyle]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Photo must be less than 10MB');
      return;
    }
    
    setUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setPhotoPreview(base64);
        
        // Update store
        useBookStore.setState((state) => ({
          babyProfile: {
            ...state.babyProfile!,
            baby_photo_url: base64
          }
        }));
        
        toast.success('Photo uploaded successfully!');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  /**
   * TRUE SEQUENTIAL GENERATION - One page at a time with data URLs
   */
  const generateAllSequentially = async () => {
    // CRITICAL: Check and acquire lock
    if (generationLockRef.current) {
      console.warn('⚠️ Generation already in progress! Ignoring duplicate request.');
      toast.error('Generation already in progress!', { 
        icon: '🔒',
        duration: 3000 
      });
      return;
    }
    
    if (!photoPreview || !storyData?.pages) {
      toast.error('Missing required data');
      return;
    }
    
    // Acquire lock and set runId
    generationLockRef.current = true;
    runIdRef.current = crypto.randomUUID();
    const currentRunId = runIdRef.current;
    
    console.log(`🔒 Generation lock acquired - RunID: ${currentRunId}`);
    
    setGenerating(true);
    setProgress(0);
    setCurrentGeneratingPage(null);
    setStartTime(Date.now());
    
    // Create new abort controller for this run
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    const totalPages = storyData.pages.length;
    let successCount = 0;
    const successfulImages: any[] = [];
    
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🚀 STARTING TRUE SEQUENTIAL GENERATION');
      console.log(`📚 Total pages: ${totalPages}`);
      console.log(`🎨 Style: ${illustrationStyle}`);
      console.log(`⏰ Start time: ${new Date().toISOString()}`);
      console.log(`🔑 RunID: ${currentRunId}`);
      console.log(`⏱️ Timeout per page: ${PAGE_TIMEOUT_MS / 1000}s`);
      console.log(`⏸️ Gap between pages: ${GAP_BETWEEN_PAGES_MS / 1000}s`);
      console.log(`${'='.repeat(60)}\n`);
      
      // Show info toast
      toast('Generating illustrations sequentially...', {
        icon: '🎨',
        duration: 5000
      });
      
      // PROCESS EACH PAGE STRICTLY SEQUENTIALLY
      for (let i = 0; i < totalPages; i++) {
        // Check if this run was cancelled
        if (runIdRef.current !== currentRunId) {
          console.log('❌ Run cancelled - RunID mismatch');
          break;
        }
        
        if (abortControllerRef.current?.signal.aborted) {
          console.log('❌ Generation aborted by user');
          break;
        }
        
        const page = storyData.pages[i];
        const pageNumber = page.page_number;
        
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`📄 PAGE ${pageNumber} / ${totalPages}`);
        console.log(`🎬 Shot: ${page.shot || 'medium'}`);
        console.log(`🎭 Action: ${page.action_id || 'default'}`);
        console.log(`⏰ Page start: ${new Date().toISOString()}`);
        console.log(`${'─'.repeat(50)}`);
        
        setCurrentGeneratingPage(pageNumber);
        setPageStartTime(Date.now());
        
        // Update UI to show generating
        setGeneratedImages(prev => prev.map(img => 
          img.page_number === pageNumber 
            ? { ...img, status: 'generating' as const }
            : img
        ));
        
        try {
          // Create page-specific abort controller with timeout
          const pageController = new AbortController();
          const timeoutId = setTimeout(() => {
            console.log(`⏱️ Page ${pageNumber} timeout after ${PAGE_TIMEOUT_MS / 1000}s`);
            pageController.abort();
          }, PAGE_TIMEOUT_MS);
          
          console.log(`📤 Sending POST request for page ${pageNumber}...`);
          const startTime = Date.now();
          
          // MAKE THE API CALL - POST only
          const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: pageController.signal,
            body: JSON.stringify({
              bookId,
              pageNumber,
              babyPhotoUrl: photoPreview,
              pageData: {
                narration: page.narration,
                shot: page.shot || page.closest_shot || 'medium',
                action_id: page.action_id || '',
                action_label: page.action_label
              },
              style: illustrationStyle
            })
          });
          
          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
          
          console.log(`📥 Response for page ${pageNumber}:`);
          console.log(`   Status: ${response.status}`);
          console.log(`   Time: ${(elapsed / 1000).toFixed(1)}s`);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }
          
          const data = await response.json();
          
          // IMPORTANT: Use dataUrl from response
          if (data.success && data.dataUrl) {
            // SUCCESS!
            successCount++;
            
            // Store with dataUrl for direct display
            successfulImages.push({
              page_number: pageNumber,
              url: data.dataUrl, // Store as url for compatibility with store
              style: illustrationStyle,
              shot: data.shot || page.shot || 'medium',
              action_id: data.action_id || page.action_id || '',
              prompt: data.prompt,
              model: data.model
            });
            
            // Update UI with dataUrl
            setGeneratedImages(prev => prev.map(img => 
              img.page_number === pageNumber 
                ? { 
                    ...img, 
                    dataUrl: data.dataUrl, // IMPORTANT: Store dataUrl
                    prompt: data.prompt,
                    status: 'success' as const,
                    elapsed_ms: data.elapsed_ms,
                    model: data.model,
                    timestamp: Date.now()
                  }
                : img
            ));
            
            console.log(`✅ PAGE ${pageNumber} SUCCESS`);
            console.log(`   Model: ${data.model || 'gpt-image-1'}`);
            console.log(`   Time: ${(data.elapsed_ms / 1000).toFixed(1)}s`);
            console.log(`   Quality: ${data.settings?.quality || 'high'}`);
            console.log(`   Data URL length: ${data.dataUrl.length} chars`);
            
            toast.success(`Page ${pageNumber} complete!`, { 
              duration: 2000,
              icon: '✅'
            });
          } else {
            throw new Error(data.error || 'No image data received');
          }
          
        } catch (error: any) {
          console.error(`❌ PAGE ${pageNumber} FAILED:`, error.message);
          
          // Update UI with error
          setGeneratedImages(prev => prev.map(img => 
            img.page_number === pageNumber 
              ? { 
                  ...img, 
                  status: 'error' as const,
                  error: error.message 
                }
              : img
          ));
          
          toast.error(`Page ${pageNumber} failed: ${error.message}`, { 
            duration: 3000,
            icon: '❌'
          });
        }
        
        // Update progress
        setProgress((i + 1) / totalPages);
        
        // CRITICAL: WAIT BETWEEN PAGES (except for last page)
        if (i < totalPages - 1) {
          console.log(`⏳ Waiting ${GAP_BETWEEN_PAGES_MS / 1000}s before next page...`);
          await new Promise(resolve => setTimeout(resolve, GAP_BETWEEN_PAGES_MS));
        }
      }
      
      const totalTime = Date.now() - (startTime || Date.now());
      console.log(`\n${'='.repeat(60)}`);
      console.log('🏁 GENERATION COMPLETE');
      console.log(`✅ Success: ${successCount}/${totalPages} pages`);
      console.log(`⏱️ Total time: ${(totalTime / 1000).toFixed(1)}s`);
      console.log(`⏰ End time: ${new Date().toISOString()}`);
      console.log(`${'='.repeat(60)}\n`);
      
      // Save successful images to store
      if (successfulImages.length > 0) {
        setIllustrations(successfulImages);
        console.log(`💾 Saved ${successfulImages.length} images to store`);
        
        if (successCount === totalPages) {
          toast.success('All illustrations generated successfully! 🎉', {
            duration: 5000
          });
          setTimeout(onComplete, 1500);
        } else {
          toast(`Generated ${successCount} of ${totalPages} images`, {
            icon: '⚠️',
            duration: 5000
          });
        }
      } else {
        toast.error('Failed to generate any images');
      }
      
    } catch (error: any) {
      console.error('💥 Fatal error:', error);
      toast.error('Generation failed: ' + error.message);
    } finally {
      // RELEASE LOCK
      generationLockRef.current = false;
      runIdRef.current = null;
      console.log('🔓 Generation lock released');
      
      setGenerating(false);
      setCurrentGeneratingPage(null);
      setStartTime(null);
      setPageStartTime(null);
      abortControllerRef.current = null;
    }
  };

  /**
   * Cancel generation
   */
  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      console.log('🛑 Cancelling generation...');
      abortControllerRef.current.abort();
      runIdRef.current = null; // Clear runId to stop the loop
      toast('Generation cancelled', { icon: '🛑' });
    }
  };

  /**
   * Get status icon for a page
   */
  const getStatusIcon = (status: GeneratedImage['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
      case 'generating':
        return <div className="w-4 h-4 rounded-full bg-yellow-400 animate-pulse" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  /**
   * Format elapsed time
   */
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Step 1: Upload Baby Photo */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-magical"
      >
        <h2 className="text-3xl font-patrick gradient-text mb-6">
          Step 1: Baby's Reference Photo
        </h2>
        
        {!photoPreview ? (
          <label className="block cursor-pointer">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="border-3 border-dashed border-purple-300 rounded-2xl p-12 hover:border-purple-500 transition-all hover:bg-purple-50"
            >
              <Camera className="h-20 w-20 text-purple-400 mx-auto mb-4" />
              <p className="text-xl font-medium text-center mb-2">
                Click to Upload Photo
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={uploading || generating}
              />
            </motion.div>
          </label>
        ) : (
          <div className="text-center">
            <img 
              src={photoPreview} 
              alt={babyProfile?.baby_name}
              className="w-48 h-48 rounded-2xl mx-auto mb-4 object-cover shadow-xl"
            />
            <button 
              onClick={() => {
                if (!generating && !generationLockRef.current) {
                  setPhotoPreview('');
                  setGeneratedImages(prev => prev.map(img => ({ 
                    ...img, 
                    dataUrl: '', 
                    status: 'pending' as const 
                  })));
                }
              }}
              className="btn-secondary"
              disabled={generating || generationLockRef.current}
            >
              Change Photo
            </button>
          </div>
        )}
      </motion.div>

      {/* Step 2: Choose Art Style */}
      {photoPreview && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-magical"
        >
          <h2 className="text-3xl font-patrick gradient-text mb-6">
            Step 2: Choose Art Style
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {styles.map((style) => {
              const Icon = style.icon;
              return (
                <motion.button
                  key={style.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => !generating && !generationLockRef.current && setIllustrationStyle(style.id as any)}
                  disabled={generating || generationLockRef.current}
                  className={`relative p-8 rounded-2xl border-3 transition-all ${
                    illustrationStyle === style.id
                      ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  } ${(generating || generationLockRef.current) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon className="h-10 w-10 text-purple-600 mb-4 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2">{style.name}</h3>
                  <p className="text-sm text-gray-600">{style.description}</p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Generation Control */}
      {photoPreview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-magical"
        >
          {/* Important Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Sequential Processing - Please be patient
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Each page is generated one at a time with GPT-IMAGE-1. 
                  This can take 1-3 minutes per page. Please don't close this tab.
                </p>
              </div>
            </div>
          </div>

          {!generating && generatedImages.every(img => img.status === 'pending') && (
            <button
              onClick={generateAllSequentially}
              disabled={generationLockRef.current}
              className="btn-primary w-full text-xl py-6 flex items-center justify-center gap-3"
            >
              {generationLockRef.current ? (
                <>
                  <Lock className="h-7 w-7" />
                  Generation Locked...
                </>
              ) : (
                <>
                  <Wand2 className="h-7 w-7" />
                  Generate All Illustrations Sequentially
                </>
              )}
            </button>
          )}

          {generating && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-patrick gradient-text">
                    Generating Page {currentGeneratingPage} of {storyData?.pages.length}
                  </h3>
                  {startTime && (
                    <p className="text-sm text-gray-600 mt-1">
                      Total time: {formatTime(Date.now() - startTime)}
                    </p>
                  )}
                  {pageStartTime && currentGeneratingPage && (
                    <p className="text-xs text-gray-500">
                      Current page: {formatTime(Date.now() - pageStartTime)}
                    </p>
                  )}
                </div>
                <button
                  onClick={cancelGeneration}
                  className="btn-secondary px-4 py-2"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Cancel
                </button>
              </div>
              
              {/* Progress Bar */}
              <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-pink-600"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white">
                  {Math.round(progress * 100)}%
                </span>
              </div>
              
              {/* Page Status Grid */}
              <div className="grid grid-cols-6 gap-2">
                {generatedImages.map((img) => (
                  <div
                    key={img.page_number}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      img.status === 'generating' 
                        ? 'bg-yellow-50 border-yellow-400 scale-110 shadow-lg animate-pulse' 
                        : img.status === 'success'
                        ? 'bg-green-50 border-green-400'
                        : img.status === 'error'
                        ? 'bg-red-50 border-red-400'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <span className="text-sm font-bold">P{img.page_number}</span>
                    {getStatusIcon(img.status)}
                    {img.elapsed_ms && (
                      <span className="text-xs text-gray-600">
                        {(img.elapsed_ms / 1000).toFixed(0)}s
                      </span>
                    )}
                    {img.model && (
                      <span className="text-xs text-purple-600 font-mono">
                        {img.model === 'gpt-image-1' ? 'GPT' : 'D2'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Current Page Info */}
              {currentGeneratingPage && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-700">
                    <strong>Processing:</strong> Page {currentGeneratingPage} - {
                      storyData?.pages[currentGeneratingPage - 1]?.shot || 'medium'
                    } shot - {
                      storyData?.pages[currentGeneratingPage - 1]?.action_id?.replace(/_/g, ' ') || 'scene'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Results Grid - USING DATA URLs */}
          {!generating && generatedImages.some(img => img.status !== 'pending') && (
            <div className="space-y-6">
              <h3 className="text-2xl font-patrick gradient-text">
                Generated Illustrations
              </h3>
              
              <div className="grid md:grid-cols-3 gap-6">
                {generatedImages.map((image) => (
                  <motion.div
                    key={image.page_number}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative"
                  >
                    {image.status === 'success' && image.dataUrl ? (
                      <div className="aspect-[3/2] rounded-xl overflow-hidden shadow-lg">
                        {/* IMPORTANT: Use dataUrl directly, no API calls */}
                        <img
                          src={image.dataUrl}
                          alt={`Page ${image.page_number}`}
                          className="w-full h-full object-cover"
                        />
                        {image.timestamp && (
                          <div className="absolute top-2 right-2 bg-white/90 rounded-lg px-2 py-1">
                            <p className="text-xs text-gray-600">
                              {formatTime(Date.now() - image.timestamp)} ago
                            </p>
                          </div>
                        )}
                      </div>
                    ) : image.status === 'error' ? (
                      <div className="aspect-[3/2] rounded-xl bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center p-4">
                        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                        <p className="text-sm text-red-600 text-center">
                          Failed: {image.error?.slice(0, 50)}
                        </p>
                      </div>
                    ) : (
                      <div className="aspect-[3/2] rounded-xl bg-gray-100" />
                    )}
                    
                    <div className="mt-2">
                      <p className="font-medium">Page {image.page_number}</p>
                      <p className="text-xs text-gray-500">
                        {image.shot} • {image.action_id?.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    if (!generationLockRef.current) {
                      setGeneratedImages(prev => prev.map(img => ({
                        ...img,
                        dataUrl: '',
                        status: 'pending' as const,
                        error: undefined,
                        elapsed_ms: undefined,
                        timestamp: undefined
                      })));
                      generateAllSequentially();
                    }
                  }}
                  disabled={generationLockRef.current}
                  className="btn-secondary flex-1"
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Regenerate All
                </button>
                
                <button
                  onClick={onComplete}
                  disabled={generatedImages.filter(img => img.status === 'success').length !== storyData?.pages.length}
                  className="btn-primary flex-1"
                >
                  Continue to Book Preview
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}