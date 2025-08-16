// components/illustrations/AsyncBatchedImageGenerator.tsx
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
  Clock,
  Loader2
} from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

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

export function AsyncBatchedImageGenerator({ onComplete }: { onComplete: () => void }) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasShownCompletionToastRef = useRef(false);
  
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
    };
  }, []);

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
    }
  };

  /**
   * Start async generation for a single page
   */
  const startImageGeneration = async (page: any): Promise<string | null> => {
    try {
      const response = await fetch('/api/generate-image-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          pageNumber: page.page_number,
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
      
      const data = await response.json();
      
      if (data.success && data.jobId) {
        return data.jobId;
      } else {
        throw new Error(data.error || 'Failed to start job');
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
          {/* Important Notice */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">
                  Creating your magical illustrations
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Each illustration is carefully generated with AI. This takes a few minutes.
                </p>
              </div>
            </div>
          </div>

          {!generating && generatedImages.every(img => img.status === 'pending') && (
            <button
              onClick={generateAllAsync}
              className="btn-primary w-full text-xl py-6 flex items-center justify-center gap-3"
            >
              <Wand2 className="h-7 w-7" />
              Generate All Illustrations
            </button>
          )}

          {generating && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-patrick gradient-text mb-2">
                  Creating Your Illustrations
                </h3>
                <p className="text-gray-600">
                  {getCompletedCount()} of {storyData?.pages.length} pages complete
                </p>
              </div>
              
              {/* Simple Progress Bar */}
              <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center"
                  initial={{ width: '0%' }}
                  animate={{ width: `${overallProgress * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <span className="text-sm font-medium text-white px-2">
                    {Math.round(overallProgress * 100)}%
                  </span>
                </motion.div>
              </div>
              
              <button
                onClick={cancelGeneration}
                className="btn-secondary w-full"
              >
                Cancel Generation
              </button>
            </div>
          )}

          {/* Results Grid */}
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