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
    cast, // This is now Partial<Record<PersonId, CastMember>>
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
  
  // Style options
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
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      if (visualProgressIntervalRef.current) {
        clearInterval(visualProgressIntervalRef.current);
      }
    };
  }, []);

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
    
    // Get characters from pages
    storyData?.pages.forEach(page => {
      page.characters_on_page?.forEach(char => storyCharacters.add(char));
    });
    
    // Also check cast_members if available
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
      console.log(`Characters on page: ${page.characters_on_page?.join(', ')}`);
      
      // Get appropriate reference images for this page
      const styleAnchor = useBookStore.getState().styleAnchorUrl;
      let references: string[] = [];
      
      if (page.page_number === 1) {
        // For page 1, just use the main baby photo
        const babyPhoto = uploadedPhotos.find(p => p.people.includes('baby'));
        if (babyPhoto) {
          references = [babyPhoto.fileUrl];
        }
      } else if (styleAnchor) {
        // For other pages, use the selection algorithm
        references = selectImageReferences(
          page,
          cast,
          uploadedPhotos,
          styleAnchor
        );
      }
      
      const response = await fetch('/api/generate-image-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          pageNumber: page.page_number,
          babyPhotoUrl: references[0] || babyProfile?.baby_photo_url,
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
          style: illustrationStyle,
          cast,
          uploadedPhotos,
          identityAnchors: {} // Will be populated as we generate
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.jobId) {
        return data.jobId;
      }
      
      throw new Error(data.error || 'Failed to start job');
    } catch (error: any) {
      console.error(`Failed to start job for page ${page.page_number}:`, error);
      return null;
    }
  };

  const pollJobStatus = (jobId: string, pageNumber: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const interval = setInterval(async () => {
        try {
          if (Date.now() - startTime > MAX_POLL_TIME) {
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
          
          const response = await fetch(`/api/generate-image-async?jobId=${jobId}`);
          const data = await response.json();
          
          if (!data.success) return;
          
          const { job } = data;
          
          setJobs(prev => prev.map(j => 
            j.jobId === jobId 
              ? { ...j, status: job.status, progress: job.progress || 0 }
              : j
          ));
          
          if (job.status === 'completed' && job.result) {
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);
            
            // Store style anchor if this is page 1
            if (pageNumber === 1) {
              setStyleAnchor(job.result.dataUrl);
              setPage1Completed(true);
              toast.success('Style anchor created! Using it for all pages...', { 
                icon: '🎨',
                duration: 3000 
              });
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
              
              if (pageNumber !== 1) {
                checkCompletion(updated);
              }
              
              return updated;
            });
            
            resolve(true);
          }
          
          if (job.status === 'failed') {
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);
            
            setGeneratedImages(prev => prev.map(img => 
              img.page_number === pageNumber 
                ? { ...img, status: 'error' as const, error: job.error }
                : img
            ));
            
            resolve(false);
          }
          
        } catch (error) {
          console.error(`Polling error for job ${jobId}:`, error);
        }
      }, POLL_INTERVAL);
      
      pollingIntervalsRef.current.set(jobId, interval);
    });
  };

  const checkCompletion = (images: GeneratedImage[]) => {
    const totalPages = storyData?.pages.length || 0;
    const completed = images.filter(img => 
      img.status === 'success' || img.status === 'error'
    ).length;
    
    const successful = images.filter(img => img.status === 'success');
    
    if (completed === totalPages) {
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
            toast.success('All illustrations generated with consistent characters! 🎉', { duration: 5000 });
            setTimeout(() => onComplete(), 1500);
          }
        }
      }, 1000);
    }
  };

  const generateAllAsync = async () => {
    if (!storyData?.pages) {
      toast.error('Missing story data');
      return;
    }
    
    // Validate cast photos
    const hasRequiredPhotos = storyData.pages.every(page => 
      page.characters_on_page?.every(charId => 
        uploadedPhotos.some(p => p.people.includes(charId))
      ) ?? true
    );
    
    if (!hasRequiredPhotos) {
      toast.error('Missing character photos. Please upload photos for all characters.');
      return;
    }
    
    setGenerating(true);
    setPhase('generate');
    setJobs([]);
    setVisualProgress(0);
    setPage1Completed(false);
    
    toast('Creating character-consistent illustrations...', { icon: '🎨', duration: 5000 });
    
    try {
      // Generate Page 1 first (style anchor)
      const page1 = storyData.pages[0];
      console.log('Starting Page 1 generation (style anchor)...');
      
      setGeneratedImages(prev => prev.map(img => 
        img.page_number === 1 
          ? { ...img, status: 'generating' as const }
          : img
      ));
      
      const page1JobId = await startImageGeneration(page1);
      
      if (page1JobId) {
        const job1: ImageJob = {
          jobId: page1JobId,
          pageNumber: 1,
          status: 'pending',
          progress: 0,
          startTime: Date.now()
        };
        setJobs([job1]);
        
        // Wait for Page 1
        const page1Success = await pollJobStatus(page1JobId, 1);
        
        if (!page1Success) {
          toast.error('Failed to create style anchor. Cannot continue.');
          setGenerating(false);
          return;
        }
        
        // Small delay for anchor storage
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate remaining pages
        const remainingJobPromises = storyData.pages.slice(1).map(async (page) => {
          setGeneratedImages(prev => prev.map(img => 
            img.page_number === page.page_number 
              ? { ...img, status: 'generating' as const }
              : img
          ));
          
          const jobId = await startImageGeneration(page);
          
          if (jobId) {
            const job: ImageJob = {
              jobId,
              pageNumber: page.page_number,
              status: 'pending',
              progress: 0,
              startTime: Date.now()
            };
            
            setJobs(prev => [...prev, job]);
            pollJobStatus(jobId, page.page_number);
            return job;
          }
          return null;
        });
        
        await Promise.all(remainingJobPromises);
        
      } else {
        throw new Error('Failed to start Page 1 generation');
      }
      
    } catch (error: any) {
      console.error('Generation failed:', error);
      toast.error('Generation failed: ' + error.message);
      setGenerating(false);
    }
  };

  const getCompletedCount = () => {
    return generatedImages.filter(img => 
      img.status === 'success' || img.status === 'error'
    ).length;
  };

  const cancelGeneration = () => {
    pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
    pollingIntervalsRef.current.clear();
    setGenerating(false);
    toast('Generation cancelled', { icon: '🛑' });
  };

  // Render based on phase
  if (phase === 'cast') {
    return <CastManager onComplete={handleCastComplete} />;
  }
  
  if (generating) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen flex items-center justify-center p-6"
        >
          <button
            onClick={() => router.push('/')}
            className="absolute top-6 left-6 btn-ghost flex items-center gap-2"
          >
            <Home className="h-5 w-5" />
            Home
          </button>

          <motion.div className="card-magical text-center py-20 px-16 max-w-2xl w-full">
            <div className="relative h-32 mb-8">
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                transition={{ 
                  rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity }
                }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <Users className="h-24 w-24 text-purple-600" />
              </motion.div>
            </div>

            <h2 className="text-4xl font-patrick mb-4 gradient-text">
              Creating Character-Consistent Illustrations...
            </h2>
            
            <p className="text-xl text-gray-600 mb-8">
              {getCompletedCount() === 0 
                ? 'Creating style anchor with character references...'
                : page1Completed 
                  ? `Generating page ${getCompletedCount() + 1} of ${storyData?.pages.length} with consistent characters`
                  : 'Processing character references...'
              }
            </p>

            <div className="relative h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full overflow-hidden mb-4 shadow-inner">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-pink-600"
                animate={{ width: `${visualProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <button onClick={cancelGeneration} className="btn-secondary mt-8">
              Cancel Generation
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Style selection phase
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
          
          <button
            onClick={generateAllAsync}
            className="btn-primary w-full text-xl py-6 mt-8"
          >
            <Wand2 className="h-7 w-7 mr-3" />
            Generate Character-Consistent Illustrations
          </button>
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
            <motion.div key={image.page_number} className="relative">
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
                        Characters: {image.characters_on_page.join(', ')}
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