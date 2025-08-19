// components/illustrations/AsyncBatchedImageGenerator.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Clock,
  Loader2,
  Home,
  Star,
  Heart,
  Palette
} from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface ImageJob {
  jobId: string;
  pageNumber: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  startTime: number;
}

interface GeneratedImage {
  page_number: number;
  dataUrl: string;
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

// Polling interval in milliseconds
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 300000; // 5 minutes max per image
const PROGRESS_DURATION = 180000; // 180 seconds (3 minutes) for the progress bar

export function AsyncBatchedImageGenerator({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();
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
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentGeneratingPage, setCurrentGeneratingPage] = useState<number | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [visualProgress, setVisualProgress] = useState(0); // For the visual progress bar only
  const [showLongerMessage, setShowLongerMessage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasShownCompletionToastRef = useRef(false);
  const visualProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
        dataUrl: '',
        style: illustrationStyle,
        shot: page.shot || 'medium',
        action_id: page.action_id || '',
        status: 'pending'
      }));
      setGeneratedImages(initialImages);
    }
  }, [storyData, illustrationStyle]);
  
  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();
      if (visualProgressIntervalRef.current) {
        clearInterval(visualProgressIntervalRef.current);
      }
    };
  }, []);

  // Visual progress timer effect (only for display)
  useEffect(() => {
    if (generating && !visualProgressIntervalRef.current) {
      const startTime = Date.now();
      visualProgressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / PROGRESS_DURATION) * 100, 99);
        setVisualProgress(progress);
        
        // Show longer message after 180 seconds
        if (elapsed > PROGRESS_DURATION && !showLongerMessage) {
          setShowLongerMessage(true);
        }
      }, 500);
    } else if (!generating && visualProgressIntervalRef.current) {
      clearInterval(visualProgressIntervalRef.current);
      visualProgressIntervalRef.current = null;
      setVisualProgress(0);
      setShowLongerMessage(false);
    }
    
    return () => {
      if (visualProgressIntervalRef.current) {
        clearInterval(visualProgressIntervalRef.current);
        visualProgressIntervalRef.current = null;
      }
    };
  }, [generating, showLongerMessage]);

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
   * Check if all images are completed and trigger next step
   */
  const checkCompletion = (images: GeneratedImage[]) => {
    const totalPages = storyData?.pages.length || 0;
    const completed = images.filter(img => 
      img.status === 'success' || img.status === 'error'
    ).length;
    
    const successful = images.filter(img => img.status === 'success');
    
    console.log(`Completion check: ${completed}/${totalPages} done, ${successful.length} successful`);
    
    // Update overall progress
    setOverallProgress(completed / totalPages);
    
    // Check if all pages are done
    if (completed === totalPages) {
      console.log('All pages completed!');
      
      // Complete the visual progress animation
      setVisualProgress(100);
      
      setTimeout(() => {
        setGenerating(false);
        setCurrentGeneratingPage(null);
        
        if (successful.length > 0) {
          // Save to store - COMPRESS images to avoid localStorage quota
          const illustrationsForStore = successful.map(img => ({
            page_number: img.page_number,
            url: img.dataUrl,
            style: img.style,
            shot: img.shot,
            action_id: img.action_id,
            prompt: img.prompt,
            model: 'gpt-image-1'
          }));
          
          console.log('Saving illustrations to store:', illustrationsForStore.length);
          setIllustrations(illustrationsForStore);
          
          if (successful.length === totalPages && !hasShownCompletionToastRef.current) {
            console.log('All pages successful - triggering onComplete');
            hasShownCompletionToastRef.current = true;
            toast.success('All illustrations generated successfully! 🎉', {
              duration: 5000,
              id: 'generation-complete' // Unique ID to prevent duplicates
            });
            // Trigger completion after a short delay
            setTimeout(() => {
              console.log('Calling onComplete callback');
              onComplete();
            }, 1500);
          } else if (successful.length < totalPages && !hasShownCompletionToastRef.current) {
            hasShownCompletionToastRef.current = true;
            toast(`Generated ${successful.length} of ${totalPages} images`, {
              icon: '⚠️',
              duration: 5000,
              id: 'generation-partial'
            });
          }
        } else {
          toast.error('No images were generated successfully', {
            duration: 5000,
            id: 'generation-failed'
          });
        }
      }, 1000);
    }
  };

  /**
   * Start async generation for a single page with camera angles and enhanced visual details
   */
  const startImageGeneration = async (page: any): Promise<string | null> => {
    try {
      console.log(`Starting generation for page ${page.page_number}`);
      console.log(`  Camera: ${page.camera_angle || page.shot}`);
      console.log(`  Focus: ${page.visual_focus}`);
      console.log(`  Action: ${page.visual_action || page.action_id}`);
      
      // Add timeout handling for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout for initial request
      
      try {
        const response = await fetch('/api/generate-image-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            bookId,
            pageNumber: page.page_number,
            babyPhotoUrl: photoPreview,
            pageData: {
              narration: page.narration,
              camera_angle: page.camera_angle,
              camera_angle_description: page.camera_angle_description,
              shot: page.shot || page.closest_shot || 'medium',
              action_id: page.action_id || '',
              action_label: page.action_label,
              visual_focus: page.visual_focus,
              visual_action: page.visual_action,
              detail_prompt: page.detail_prompt,
              sensory_details: page.sensory_details,
              pose_description: page.pose_description
            },
            style: illustrationStyle
          })
        });
        
        clearTimeout(timeoutId);
        
        // Check if response is ok and has content
        if (!response.ok) {
          console.error(`HTTP error! status: ${response.status}`);
          return null;
        }
        
        const text = await response.text();
        if (!text) {
          console.error('Empty response from server');
          return null;
        }
        
        const data = JSON.parse(text);
        
        if (data.success && data.jobId) {
          console.log(`Job started for page ${page.page_number} with camera: ${page.camera_angle}`);
          return data.jobId;
        } else {
          throw new Error(data.error || 'Failed to start job');
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.error(`Request timeout for page ${page.page_number}`);
        } else {
          console.error(`Failed to start job for page ${page.page_number}:`, error);
        }
        return null;
      }
    } catch (error: any) {
      console.error(`Failed to start job for page ${page.page_number}:`, error);
      return null;
    }
  };

  /**
   * Poll for job status
   */
  const pollJobStatus = (jobId: string, pageNumber: number) => {
    const startTime = Date.now();
    
    const interval = setInterval(async () => {
      try {
        // Check if we've exceeded max poll time
        if (Date.now() - startTime > MAX_POLL_TIME) {
          clearInterval(interval);
          pollingIntervalsRef.current.delete(jobId);
          
          setJobs(prev => prev.map(job => 
            job.jobId === jobId 
              ? { ...job, status: 'failed', error: 'Timeout' }
              : job
          ));
          
          setGeneratedImages(prev => {
            const updated = prev.map(img => 
              img.page_number === pageNumber 
                ? { ...img, status: 'error' as const, error: 'Generation timeout' }
                : img
            );
            checkCompletion(updated);
            return updated;
          });
          
          return;
        }
        
        // Poll the job status
        const response = await fetch(`/api/generate-image-async?jobId=${jobId}`);
        const data = await response.json();
        
        if (!data.success) {
          console.error(`Failed to poll job ${jobId}:`, data.error);
          return;
        }
        
        const { job } = data;
        
        // Update job status
        setJobs(prev => prev.map(j => 
          j.jobId === jobId 
            ? { ...j, status: job.status, progress: job.progress || 0 }
            : j
        ));
        
        // Handle completion
        if (job.status === 'completed' && job.result) {
          clearInterval(interval);
          pollingIntervalsRef.current.delete(jobId);
          
          // Update generated images and check for overall completion
          setGeneratedImages(prev => {
            const updated = prev.map(img => 
              img.page_number === pageNumber 
                ? { 
                    ...img, 
                    dataUrl: job.result.dataUrl,
                    prompt: job.result.prompt,
                    status: 'success' as const,
                    elapsed_ms: job.result.elapsed_ms,
                    model: 'gpt-image-1',
                    timestamp: Date.now()
                  }
                : img
            );
            
            // Check if all pages are done
            checkCompletion(updated);
            return updated;
          });
          
          // NO individual page completion toasts
          console.log(`Page ${pageNumber} complete!`);
        }
        
        // Handle failure
        if (job.status === 'failed') {
          clearInterval(interval);
          pollingIntervalsRef.current.delete(jobId);
          
          setGeneratedImages(prev => {
            const updated = prev.map(img => 
              img.page_number === pageNumber 
                ? { 
                    ...img, 
                    status: 'error' as const,
                    error: job.error || 'Generation failed'
                  }
                : img
            );
            checkCompletion(updated);
            return updated;
          });
          
          // Only show error toast for failures
          toast.error(`Page ${pageNumber} failed: ${job.error}`, { 
            duration: 3000,
            icon: '❌'
          });
        }
        
      } catch (error) {
        console.error(`Polling error for job ${jobId}:`, error);
      }
    }, POLL_INTERVAL);
    
    pollingIntervalsRef.current.set(jobId, interval);
  };

  /**
   * Generate all images using async pattern
   */
  const generateAllAsync = async () => {
    if (!photoPreview || !storyData?.pages) {
      toast.error('Missing required data');
      return;
    }
    
    setGenerating(true);
    setJobs([]);
    setOverallProgress(0);
    setVisualProgress(0);
    setShowLongerMessage(false);
    hasShownCompletionToastRef.current = false; // Reset flag
    
    // Create abort controller
    abortControllerRef.current = new AbortController();
    
    const totalPages = storyData.pages.length;
    
    console.log('🚀 Starting async generation for', totalPages, 'pages');
    toast('Starting image generation...', { icon: '🎨', duration: 5000 });
    
    try {
      // Start all jobs simultaneously
      const jobPromises = storyData.pages.map(async (page) => {
        const pageNumber = page.page_number;
        
        // Update UI to show generating
        setGeneratedImages(prev => prev.map(img => 
          img.page_number === pageNumber 
            ? { ...img, status: 'generating' as const }
            : img
        ));
        
        // Start the job
        const jobId = await startImageGeneration(page);
        
        if (jobId) {
          const job: ImageJob = {
            jobId,
            pageNumber,
            status: 'pending',
            progress: 0,
            startTime: Date.now()
          };
          
          setJobs(prev => [...prev, job]);
          
          // Start polling for this job
          pollJobStatus(jobId, pageNumber);
          
          return { success: true, pageNumber, jobId };
        } else {
          // Mark as failed if job couldn't start
          setGeneratedImages(prev => prev.map(img => 
            img.page_number === pageNumber 
              ? { ...img, status: 'error' as const, error: 'Failed to start job' }
              : img
          ));
          return { success: false, pageNumber };
        }
      });
      
      // Wait for all jobs to start
      const results = await Promise.all(jobPromises);
      
      const startedJobs = results.filter(r => r.success).length;
      console.log(`Started ${startedJobs}/${totalPages} jobs`);
      
      if (startedJobs === 0) {
        throw new Error('Failed to start any jobs');
      }
      
      // Note: Completion will be handled by checkCompletion() function
      // which is called after each image update in pollJobStatus
      
    } catch (error: any) {
      console.error('Generation failed:', error);
      toast.error('Generation failed: ' + error.message);
      setGenerating(false);
    }
  };

  /**
   * Cancel all active generations
   */
  const cancelGeneration = () => {
    // Clear all polling intervals
    pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
    pollingIntervalsRef.current.clear();
    
    // Abort if we have a controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setGenerating(false);
    toast('Generation cancelled', { icon: '🛑' });
  };

  /**
   * Get completed count for progress display
   */
  const getCompletedCount = () => {
    return generatedImages.filter(img => 
      img.status === 'success' || img.status === 'error'
    ).length;
  };

  /**
   * Get success count
   */
  const getSuccessCount = () => {
    return generatedImages.filter(img => img.status === 'success').length;
  };

  // If generating, show ONLY the cute animation
  if (generating) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen flex items-center justify-center p-6"
        >
          {/* Home button in top left */}
          <button
            onClick={() => router.push('/')}
            className="absolute top-6 left-6 btn-ghost flex items-center gap-2"
          >
            <Home className="h-5 w-5" />
            Home
          </button>

          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="card-magical text-center py-20 px-16 max-w-2xl w-full"
          >
            {/* Animated Icons */}
            <div className="relative h-32 mb-8">
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity }
                }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <Palette className="h-24 w-24 text-purple-600" />
              </motion.div>
              
              {/* Floating decorative elements */}
              <motion.div
                animate={{ 
                  x: [-20, 20, -20],
                  y: [-10, 10, -10],
                  rotate: [0, 180, 360]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute left-1/4 top-1/4"
              >
                <Sparkles className="h-8 w-8 text-pink-400" />
              </motion.div>
              
              <motion.div
                animate={{ 
                  x: [20, -20, 20],
                  y: [10, -10, 10],
                  rotate: [360, 180, 0]
                }}
                transition={{ duration: 3.5, repeat: Infinity }}
                className="absolute right-1/4 top-1/4"
              >
                <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
              </motion.div>
              
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                  rotate: [-10, 10, -10]
                }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="absolute left-1/3 bottom-0"
              >
                <Heart className="h-7 w-7 text-red-400 fill-red-400" />
              </motion.div>
              
              <motion.div
                animate={{ 
                  y: [-5, 5, -5],
                  x: [-3, 3, -3]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute right-1/3 top-0"
              >
                <Brush className="h-8 w-8 text-orange-400" />
              </motion.div>
            </div>

            <h2 className="text-4xl font-patrick mb-4 gradient-text">
              Painting Your Illustrations...
            </h2>
            
            <p className="text-xl text-gray-600 mb-8">
              Our AI artist is creating beautiful {illustrationStyle} illustrations for {babyProfile?.baby_name}
            </p>

            {/* Cute Progress Bar */}
            <div className="relative h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full overflow-hidden mb-4 shadow-inner">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-end pr-3"
                initial={{ width: '0%' }}
                animate={{ width: `${visualProgress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                {visualProgress > 10 && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="h-6 w-6 text-white" />
                  </motion.div>
                )}
              </motion.div>
              
              {/* Percentage text - changes color based on progress */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold transition-colors duration-300 ${
                  visualProgress > 50 ? 'text-white' : 'text-purple-800'
                }`}>
                  {Math.round(visualProgress)}%
                </span>
              </div>
            </div>

            {/* Status message */}
            {!showLongerMessage ? (
              <p className="text-sm text-gray-500">
                {getCompletedCount() > 0 
                  ? `Completed ${getCompletedCount()} of ${storyData?.pages.length} pages`
                  : `Creating your magical illustrations...`
                }
              </p>
            ) : (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-purple-600 font-medium"
              >
                ✨ It's taking a little longer, but your magical book is almost ready!<br/>
                Please don't close the screen...
              </motion.p>
            )}

            {/* Cancel button */}
            <button
              onClick={cancelGeneration}
              className="btn-secondary mt-8"
            >
              Cancel Generation
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Normal interface when not generating
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
                if (!generating) {
                  setPhotoPreview('');
                  setGeneratedImages(prev => prev.map(img => ({ 
                    ...img, 
                    dataUrl: '', 
                    status: 'pending' as const 
                  })));
                }
              }}
              className="btn-secondary"
              disabled={generating}
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
                  onClick={() => !generating && setIllustrationStyle(style.id as any)}
                  disabled={generating}
                  className={`relative p-8 rounded-2xl border-3 transition-all ${
                    illustrationStyle === style.id
                      ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  } ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          {!generating && generatedImages.every(img => img.status === 'pending') && (
            <button
              onClick={generateAllAsync}
              className="btn-primary w-full text-xl py-6 flex items-center justify-center gap-3"
            >
              <Wand2 className="h-7 w-7" />
              Generate All Illustrations
            </button>
          )}

          {/* Results Grid - Only shown after generation completes */}
          {!generating && generatedImages.some(img => img.status !== 'pending') && (
            <div className="space-y-6">
              <h3 className="text-2xl font-patrick gradient-text text-center">
                Your Illustrations Are Ready!
              </h3>
              
              <div className="text-center text-gray-600">
                {getSuccessCount()} of {storyData?.pages.length} illustrations generated successfully
              </div>
              
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
                        <img
                          src={image.dataUrl}
                          alt={`Page ${image.page_number}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : image.status === 'error' ? (
                      <div className="aspect-[3/2] rounded-xl bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center p-4">
                        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                        <p className="text-sm text-red-600 text-center">
                          Failed to generate
                        </p>
                      </div>
                    ) : (
                      <div className="aspect-[3/2] rounded-xl bg-gray-100" />
                    )}
                    
                    <div className="mt-2 text-center">
                      <p className="text-sm font-medium">Page {image.page_number}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setGeneratedImages(prev => prev.map(img => ({
                      ...img,
                      dataUrl: '',
                      status: 'pending' as const,
                      error: undefined,
                      elapsed_ms: undefined,
                      timestamp: undefined
                    })));
                    setJobs([]);
                    hasShownCompletionToastRef.current = false;
                    generateAllAsync();
                  }}
                  className="btn-secondary flex-1"
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Regenerate All
                </button>
                
                <button
                  onClick={() => {
                    console.log('Manual continue clicked');
                    const successful = generatedImages.filter(img => img.status === 'success');
                    if (successful.length > 0) {
                      // Save to store
                      const illustrationsForStore = successful.map(img => ({
                        page_number: img.page_number,
                        url: img.dataUrl,
                        style: img.style,
                        shot: img.shot,
                        action_id: img.action_id,
                        prompt: img.prompt,
                        model: 'gpt-image-1'
                      }));
                      
                      console.log('Manually saving illustrations:', illustrationsForStore.length);
                      setIllustrations(illustrationsForStore);
                      onComplete();
                    }
                  }}
                  disabled={getSuccessCount() === 0}
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