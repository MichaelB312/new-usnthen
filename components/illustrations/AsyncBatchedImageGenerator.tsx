// components/illustrations/AsyncBatchedImageGenerator.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wand2, Camera, Sparkles, Brush, Book, RefreshCw, 
  AlertCircle, Clock, Loader2, Home, Star, Heart, Palette,
  Users, Plus, Check
} from 'lucide-react';
import { useBookStore, PersonId, selectImageReferences } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { CastManager } from '@/components/cast-management/CastManager';

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
  camera_angle: string;
  action: string;
  characters_on_page?: PersonId[];
  status: 'pending' | 'generating' | 'success' | 'error';
  error?: string;
  elapsed_ms?: number;
}

const POLL_INTERVAL = 2000;
const MAX_POLL_TIME = 300000;

export function AsyncBatchedImageGenerator({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();
  const { 
    babyProfile, 
    storyData, 
    bookId,
    cast,
    uploadedPhotos,
    setIllustrations,
    illustrationStyle,
    setIllustrationStyle,
    setStyleAnchor
  } = useBookStore();
  
  const [phase, setPhase] = useState<'cast' | 'style' | 'generate' | 'complete'>('cast');
  const [generating, setGenerating] = useState(false);
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [visualProgress, setVisualProgress] = useState(0);
  const [page1Completed, setPage1Completed] = useState(false);
  
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const visualProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const generatedImagesRef = useRef<GeneratedImage[]>([]);
  
  // Update ref whenever generatedImages changes
  useEffect(() => {
    generatedImagesRef.current = generatedImages;
  }, [generatedImages]);
  
  // Style options - KEEP ORIGINAL SIMPLE STYLE
  const styles = [
    { 
      id: 'wondrous', 
      name: 'Watercolor', 
      icon: Sparkles,
      description: 'Soft, dreamy watercolor',
      gradient: 'from-purple-400 to-pink-400'
    },
    { 
      id: 'crayon', 
      name: 'Crayon', 
      icon: Brush,
      description: 'Bold, playful crayon',
      gradient: 'from-orange-400 to-red-400'
    },
    { 
      id: 'vintage', 
      name: 'Classic', 
      icon: Book,
      description: 'Timeless storybook style',
      gradient: 'from-amber-400 to-brown-400'
    }
  ];

  // Initialize images from story data
  useEffect(() => {
    if (storyData?.pages) {
      const initialImages: GeneratedImage[] = storyData.pages.map(page => ({
        page_number: page.page_number,
        dataUrl: '',
        style: illustrationStyle,
        camera_angle: page.camera_angle || 'wide',
        action: page.visual_action || page.action_label || '',
        characters_on_page: page.characters_on_page,
        status: 'pending'
      }));
      setGeneratedImages(initialImages);
    }
  }, [storyData, illustrationStyle]);
  
  // Add cleanup on component unmount
  useEffect(() => {
    return () => {
      // Cleanup all intervals on unmount
      console.log('Component unmounting, cleaning up polling intervals...');
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();
      
      if (visualProgressIntervalRef.current) {
        clearInterval(visualProgressIntervalRef.current);
        visualProgressIntervalRef.current = null;
      }
    };
  }, []);

  // Also cleanup when phase changes
  useEffect(() => {
    if (phase !== 'generate') {
      // Clear all polling when not in generate phase
      console.log('Phase changed from generate, cleaning up polling...');
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();
    }
  }, [phase]);

  // Visual progress animation
  useEffect(() => {
    if (generating && !visualProgressIntervalRef.current) {
      const totalPages = storyData?.pages.length || 0;
      const msPerPage = 15000;
      const totalMs = totalPages * msPerPage;
      
      const startTime = Date.now();
      visualProgressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / totalMs) * 100, 95);
        setVisualProgress(progress);
      }, 500);
    } else if (!generating && visualProgressIntervalRef.current) {
      clearInterval(visualProgressIntervalRef.current);
      visualProgressIntervalRef.current = null;
    }
  }, [generating, storyData]);

  const handleCastComplete = () => {
    // Validate that all story characters have photos
    const storyCharacters = new Set<PersonId>();
    
    storyData?.pages.forEach(page => {
      page.characters_on_page?.forEach(char => storyCharacters.add(char));
    });
    
    if (storyData?.cast_members) {
      storyData.cast_members.forEach(char => storyCharacters.add(char));
    }
    
    const missingPhotos = Array.from(storyCharacters).filter(
      charId => !uploadedPhotos.some(p => p.people.includes(charId))
    );
    
    if (missingPhotos.length > 0) {
      toast.error(`Missing photos for: ${missingPhotos.join(', ')}`);
      return;
    }
    
    setPhase('style');
    toast.success('Cast setup complete! Now choose your art style.');
  };

  const startImageGeneration = async (page: any): Promise<string | null> => {
    try {
      console.log(`Starting generation for page ${page.page_number}`);

      // Prepare minimal payload
      const payload: any = {
        bookId,
        pageNumber: page.page_number,
        pageData: {
          ...page,
          narration: page.narration,
          camera_angle: page.camera_angle,
          camera_prompt: page.camera_prompt,
          visual_action: page.visual_action || page.action_description,
          action_label: page.action_label,
          sensory_details: page.sensory_details,
          characters_on_page: page.characters_on_page,
          background_extras: page.background_extras
        },
        style: illustrationStyle
      };

      // For Page 1 ONLY: Include the best baby photo
      if (page.page_number === 1) {
        // Find the best baby photo (prefer identity anchor, then any baby photo)
        const babyPhoto = uploadedPhotos.find(p => 
          p.people.includes('baby') && p.is_identity_anchor
        ) || uploadedPhotos.find(p => 
          p.people.includes('baby')
        );
        
        if (babyPhoto?.fileUrl) {
          payload.babyPhotoUrl = babyPhoto.fileUrl;
        } else if (babyProfile?.baby_photo_url) {
          payload.babyPhotoUrl = babyProfile.baby_photo_url;
        } else {
          toast.error('No baby photo available for Page 1');
          return null;
        }
        
        console.log('Page 1: Sending single baby reference');
      } else {
        // For Pages 2+: Send minimal character references
        // The server will use the stored style anchor + minimal refs
        
        // Only send references for characters actually on this page
        const charactersOnPage = page.characters_on_page || [];
        const minimalPhotos = charactersOnPage.map((charId: PersonId) => {
          // Find best photo for this character
          const photo = uploadedPhotos.find(p => 
            p.people.includes(charId) && p.is_identity_anchor
          ) || uploadedPhotos.find(p => 
            p.people.includes(charId)
          );
          
          if (photo) {
            return {
              fileUrl: photo.fileUrl,
              people: [charId], // Only the relevant character
              is_identity_anchor: !!photo.is_identity_anchor
            };
          }
          return null;
        }).filter(Boolean);
        
        payload.uploadedPhotos = minimalPhotos;
        console.log(`Page ${page.page_number}: Sending ${minimalPhotos.length} character refs`);
      }

      // Send request with minimal payload
      const response = await fetch('/api/generate-image-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`API error for page ${page.page_number}:`, errorText);
        throw new Error(`Failed to start generation for page ${page.page_number}`);
      }

      const data = await response.json();
      if (data.success && data.jobId) {
        return data.jobId;
      }
      
      throw new Error(data.error || 'Failed to start job');
    } catch (error: any) {
      console.error(`Failed to start job for page ${page.page_number}:`, error);
      toast.error(`Page ${page.page_number}: ${error.message}`);
      return null;
    }
  };

  const pollJobStatus = (jobId: string, pageNumber: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let pollCount = 0;
      
      const interval = setInterval(async () => {
        pollCount++;
        
        try {
          // Check if already completed using ref
          const pageImage = generatedImagesRef.current.find(img => img.page_number === pageNumber);
          if (pageImage?.status === 'success') {
            console.log(`[Poll] Page ${pageNumber} already complete, stopping poll`);
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);
            resolve(true);
            return;
          }
          
          // Check timeout
          if (Date.now() - startTime > MAX_POLL_TIME) {
            console.log(`[Poll] Timeout for job ${jobId}`);
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);
            
            setGeneratedImages(prev => prev.map(img => 
              img.page_number === pageNumber 
                ? { ...img, status: 'error' as const, error: 'Timeout' }
                : img
            ));
            resolve(false);
            return;
          }
          
          // Check max poll attempts to prevent infinite polling
          if (pollCount > 150) { // 150 * 2s = 5 minutes max
            console.log(`[Poll] Max attempts reached for job ${jobId}`);
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);
            resolve(false);
            return;
          }
          
          const response = await fetch(`/api/generate-image-async?jobId=${jobId}`);
          
          if (!response.ok) {
            console.error(`[Poll] Bad response for ${jobId}: ${response.status}`);
            // Don't stop polling on network errors, just skip this attempt
            return;
          }
          
          const data = await response.json();
          
          if (!data.success) {
            console.error(`[Poll] API error for ${jobId}:`, data.error);
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
            console.log(`[Poll] Job ${jobId} completed for page ${pageNumber}`);
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);
            
            if (pageNumber === 1) {
              setStyleAnchor(job.result.dataUrl);
              setPage1Completed(true);
              toast.success('Style anchor created! 🎨', { duration: 3000 });
            }
            
            setGeneratedImages(prev => {
              const updated = prev.map(img => 
                img.page_number === pageNumber 
                  ? { 
                      ...img, 
                      dataUrl: job.result.dataUrl,
                      status: 'success' as const,
                      elapsed_ms: job.result.elapsed_ms,
                      characters_on_page: job.result.characters_on_page
                    }
                  : img
              );
              
              // Check overall completion
              checkCompletion(updated);
              
              return updated;
            });
            
            resolve(true);
            return; // Important: exit after resolving
          }
          
          // Handle failure
          if (job.status === 'failed') {
            console.log(`[Poll] Job ${jobId} failed:`, job.error);
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);
            
            setGeneratedImages(prev => prev.map(img => 
              img.page_number === pageNumber 
                ? { ...img, status: 'error' as const, error: job.error }
                : img
            ));
            
            resolve(false);
            return; // Important: exit after resolving
          }
          
        } catch (error) {
          console.error(`[Poll] Error polling ${jobId}:`, error);
          // Don't stop polling on errors, just log them
        }
      }, POLL_INTERVAL);
      
      // Store the interval
      pollingIntervalsRef.current.set(jobId, interval);
    });
  };

  // Updated checkCompletion to ensure cleanup
  const checkCompletion = (images: GeneratedImage[]) => {
    const totalPages = storyData?.pages.length || 0;
    const completed = images.filter(img => 
      img.status === 'success' || img.status === 'error'
    ).length;
    
    const successful = images.filter(img => img.status === 'success');
    
    console.log(`[Completion] ${completed}/${totalPages} pages done, ${successful.length} successful`);
    
    if (completed === totalPages) {
      // IMPORTANT: Clear all remaining intervals
      console.log('All pages complete, cleaning up polling...');
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();
      
      setVisualProgress(100);
      
      setTimeout(() => {
        setGenerating(false);
        setPhase('complete');
        
        if (successful.length > 0) {
          const illustrationsForStore = successful.map(img => ({
            page_number: img.page_number,
            url: img.dataUrl,
            style: img.style,
            shot: img.camera_angle,
            action_id: img.action,
            model: 'gpt-image-1'
          }));
          
          setIllustrations(illustrationsForStore);
          
          if (successful.length === totalPages) {
            toast.success('All illustrations generated! 🎉', { duration: 5000 });
            setTimeout(() => onComplete(), 1500);
          } else {
            toast(`Generated ${successful.length}/${totalPages} illustrations`, { 
  icon: '⚠️',
  duration: 5000 
});
          }
        }
      }, 1000);
    }
  };

  // Add a safety check in generateAllAsync
  const generateAllAsync = async () => {
    if (!storyData?.pages) {
      toast.error('Missing story data');
      return;
    }

    // Clear any existing intervals before starting
    pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
    pollingIntervalsRef.current.clear();

    // Validate minimal requirements - only need one photo per unique character
    const uniqueCharacters = new Set<PersonId>();
    storyData.pages.forEach(page => {
      page.characters_on_page?.forEach(char => uniqueCharacters.add(char));
    });
    
    const missingPhotos = Array.from(uniqueCharacters).filter(
      charId => !uploadedPhotos.some(p => p.people.includes(charId))
    );
    
    if (missingPhotos.length > 0) {
      toast.error(`Missing photos for: ${missingPhotos.join(', ')}`);
      return;
    }

    setGenerating(true);
    setPhase('generate');
    setJobs([]);
    setVisualProgress(0);
    setPage1Completed(false);

    toast('Creating vibrant illustrations with high contrast for baby vision! 🌈', { 
      icon: '✨', 
      duration: 5000 
    });

    try {
      // STEP 1: Generate Page 1 first (creates style anchor)
      const page1 = storyData.pages[0];
      console.log('Starting Page 1 generation to create style anchor...');

      setGeneratedImages(prev =>
        prev.map(img =>
          img.page_number === 1 ? { ...img, status: 'generating' as const } : img
        )
      );

      const page1JobId = await startImageGeneration(page1);
      if (!page1JobId) {
        throw new Error('Failed to start Page 1 generation');
      }

      const job1: ImageJob = {
        jobId: page1JobId,
        pageNumber: 1,
        status: 'pending',
        progress: 0,
        startTime: Date.now(),
      };
      setJobs([job1]);

      // Wait for Page 1 to complete (creates style anchor)
      const page1Success = await pollJobStatus(page1JobId, 1);

      if (!page1Success) {
        toast.error('Failed to create style anchor. Cannot continue.');
        setGenerating(false);
        // Clean up on failure
        pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
        pollingIntervalsRef.current.clear();
        return;
      }

      // Small delay to ensure style anchor is saved
      await new Promise(resolve => setTimeout(resolve, 1000));

      // STEP 2: Generate remaining pages (using style anchor)
      const remainingJobs: { jobId: string; pageNumber: number }[] = [];
      
      for (let i = 1; i < storyData.pages.length; i++) {
        const page = storyData.pages[i];

        setGeneratedImages(prev =>
          prev.map(img =>
            img.page_number === page.page_number
              ? { ...img, status: 'generating' as const }
              : img
          )
        );

        const jobId = await startImageGeneration(page);
        if (jobId) {
          const job: ImageJob = {
            jobId,
            pageNumber: page.page_number,
            status: 'pending',
            progress: 0,
            startTime: Date.now(),
          };
          setJobs(prev => [...prev, job]);
          remainingJobs.push({ jobId, pageNumber: page.page_number });

          // Small delay between starts
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          setGeneratedImages(prev =>
            prev.map(img =>
              img.page_number === page.page_number
                ? { ...img, status: 'error' as const, error: 'Failed to start' }
                : img
            )
          );
        }
      }
      
      // Poll all remaining jobs in parallel
      await Promise.all(
        remainingJobs.map(({ jobId, pageNumber }) => 
          pollJobStatus(jobId, pageNumber).catch(err => {
            console.error(`Polling failed for page ${pageNumber}:`, err);
            return false;
          })
        )
      );
      
    } catch (error: any) {
      console.error('Generation failed:', error);
      toast.error('Generation failed: ' + (error.message || 'Unknown error'));
      
      // Clean up on error
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();
      
      setGenerating(false);
      setPhase('style');
    }
  };

  // Updated cancelGeneration with better cleanup
  const cancelGeneration = () => {
    console.log('Cancelling generation, cleaning up...');
    
    // Clear all polling intervals
    pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
    pollingIntervalsRef.current.clear();
    
    // Clear visual progress interval
    if (visualProgressIntervalRef.current) {
      clearInterval(visualProgressIntervalRef.current);
      visualProgressIntervalRef.current = null;
    }
    
    // Reset state
    setGenerating(false);
    setPhase('style'); // Go back to style selection
    setJobs([]);
    setVisualProgress(0);
    
    toast('Generation cancelled', { icon: '🛑' });
  };

  // Render based on phase
  if (phase === 'cast') {
    return <CastManager onComplete={handleCastComplete} />;
  }
  
  if (generating) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 z-50 flex items-center justify-center"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-2xl px-8"
          >
            {/* Animated Book */}
            <div className="relative h-64 mb-12">
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                animate={{ 
                  rotateY: [0, 180, 360],
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Book className="h-32 w-32 text-purple-600" />
              </motion.div>
              
              {/* Floating elements */}
              <motion.div
                className="absolute left-1/4 top-1/4"
                animate={{ 
                  y: [-10, 10, -10],
                  rotate: [0, 10, 0]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Sparkles className="h-8 w-8 text-yellow-400" />
              </motion.div>
              
              <motion.div
                className="absolute right-1/4 top-1/4"
                animate={{ 
                  y: [10, -10, 10],
                  rotate: [0, -10, 0]
                }}
                transition={{ 
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                }}
              >
                <Star className="h-8 w-8 text-pink-400" />
              </motion.div>
              
              <motion.div
                className="absolute left-1/3 bottom-1/4"
                animate={{ 
                  y: [-5, 5, -5],
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1
                }}
              >
                <Heart className="h-6 w-6 text-red-400" />
              </motion.div>
              
              <motion.div
                className="absolute right-1/3 bottom-1/4"
                animate={{ 
                  y: [5, -5, 5],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.5
                }}
              >
                <Palette className="h-6 w-6 text-purple-400" />
              </motion.div>
            </div>

            <motion.h2 
              className="text-5xl font-patrick mb-4 gradient-text"
              animate={{ 
                scale: [1, 1.02, 1],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              Creating Your Magical Illustrations
            </motion.h2>
            
            <p className="text-xl text-gray-600 mb-2">
              Crafting something truly special for {babyProfile?.baby_name}
            </p>
            
            <p className="text-lg text-purple-600 font-medium mb-8">
              Each page is being lovingly illustrated with magic ✨
            </p>

            {/* Progress bar */}
            <div className="relative h-14 bg-white/50 backdrop-blur rounded-full overflow-hidden mb-4 shadow-inner max-w-md mx-auto">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600"
                animate={{ width: `${visualProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Tips */}
            <motion.p 
              className="text-sm text-gray-500"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              💡 Each illustration is uniquely crafted with consistent characters
            </motion.p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Style selection phase - KEEP ORIGINAL STYLE
  if (phase === 'style') {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <motion.div className="card-magical">
          <h2 className="text-3xl font-patrick gradient-text mb-6">
            Choose Your Art Style
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {styles.map((style) => {
              const Icon = style.icon;
              return (
                <motion.button
                  key={style.id}
                  whileHover={{ scale: 1.03 }}
                  onClick={() => setIllustrationStyle(style.id as any)}
                  className={`p-8 rounded-2xl border-3 ${
                    illustrationStyle === style.id
                      ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <Icon className="h-10 w-10 text-purple-600 mb-4 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2">{style.name}</h3>
                  <p className="text-sm text-gray-600">{style.description}</p>
                </motion.button>
              );
            })}
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={generateAllAsync}
            className="btn-primary w-full text-xl py-6 mt-8 flex items-center justify-center gap-3"
          >
            <Wand2 className="h-7 w-7" />
            <span>Create Your Magical Book</span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Results phase
  if (phase === 'complete' && generatedImages.some(img => img.status !== 'pending')) {
    return (
      <motion.div className="card-magical">
        <h3 className="text-2xl font-patrick gradient-text text-center mb-6">
          Your Character-Consistent Illustrations!
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          {generatedImages.map((image) => (
            <motion.div 
              key={image.page_number} 
              className="relative"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: image.page_number * 0.1 }}
            >
              {image.status === 'success' && image.dataUrl ? (
                <div>
                  <img
                    src={image.dataUrl}
                    alt={`Page ${image.page_number}`}
                    className="w-full aspect-square rounded-xl object-cover shadow-lg"
                  />
                  <div className="mt-2 text-center">
                    <p className="text-sm font-medium">Page {image.page_number}</p>
                    <p className="text-xs text-gray-500">{image.camera_angle}</p>
                    {image.characters_on_page && (
                      <p className="text-xs text-purple-600">
                        {image.characters_on_page.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ) : image.status === 'error' ? (
                <div className="aspect-square rounded-xl bg-red-50 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>
        
        <div className="flex gap-4 mt-8">
          <button onClick={() => window.location.reload()} className="btn-secondary flex-1">
            <RefreshCw className="h-5 w-5 mr-2" />
            Regenerate All
          </button>
          
          <button onClick={onComplete} className="btn-primary flex-1">
            Continue to Book Preview
          </button>
        </div>
      </motion.div>
    );
  }

  return null;
}