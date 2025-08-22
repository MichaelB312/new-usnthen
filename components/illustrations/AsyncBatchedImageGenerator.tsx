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

    // Build the references we need on the client ONLY to decide if page 1 has a baby photo.
    // Do NOT send the style anchor (base64) back to the server for pages 2+.
    let babyPhotoForPage1: string | undefined;

    if (page.page_number === 1) {
      // Page 1: ONLY send a baby photo as base64/URL
      const babyPhoto = uploadedPhotos.find(p => p.people.includes('baby'));
      if (babyPhoto?.fileUrl) {
        babyPhotoForPage1 = babyPhoto.fileUrl;
      } else if (babyProfile?.baby_photo_url) {
        babyPhotoForPage1 = babyProfile.baby_photo_url;
      }
      if (!babyPhotoForPage1) {
        toast.error('No baby photo provided for Page 1');
        return null;
      }
    } else {
      // Page 2+: Server will build refs using the style anchor it already stored,
      // identity anchors, and uploaded photos. Do not send babyPhotoUrl (avoid huge base64).
      // (We keep this branch empty on purpose.)
    }

    // Send a slim version of uploadedPhotos (avoid large/unused props).
    const slimUploadedPhotos = uploadedPhotos.map(p => ({
      fileUrl: p.fileUrl,                  // can be URL or base64 that YOU uploaded
      people: p.people,                    // PersonId[]
      is_identity_anchor: !!p.is_identity_anchor,
      is_group_photo: !!p.is_group_photo,
    }));

    const payload: any = {
      bookId,
      pageNumber: page.page_number,
      // IMPORTANT: Only include babyPhotoUrl on page 1
      ...(page.page_number === 1 ? { babyPhotoUrl: babyPhotoForPage1 } : {}),
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
      uploadedPhotos: slimUploadedPhotos,
      identityAnchors: {} // let server resolve stored anchors
    };

    const response = await fetch('/api/generate-image-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`API error for page ${page.page_number}:`, errorText);
      let errorMessage = `Failed to start generation for page ${page.page_number}`;
      try {
        const errorData = errorText ? JSON.parse(errorText) : null;
        if (errorData?.error) errorMessage = errorData.error;
      } catch {
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
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
            
            if (pageNumber === 1) {
              setStyleAnchor(job.result.dataUrl);
              setPage1Completed(true);
              toast.success('Style anchor created! 🎨', { 
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
              
              checkCompletion(updated);
              
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
            toast.success('All illustrations generated! 🎉', { duration: 5000 });
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

  // Ensure every character on every page has at least one uploaded photo
  const hasRequiredPhotos =
    storyData.pages.every(page =>
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

  toast('Creating your magical illustrations...', { icon: '✨', duration: 5000 });

  try {
    // --- PAGE 1: create style anchor first ---
    const page1 = storyData.pages[0];
    console.log('Starting Page 1 generation (style anchor)...');

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

    const page1Success = await pollJobStatus(page1JobId, 1);
    if (!page1Success) {
      toast.error('Failed to create style anchor. Cannot continue.');
      setGenerating(false);
      return;
    }

    // Give the store a moment to persist the style anchor and then verify
    await new Promise(resolve => setTimeout(resolve, 2000));
    const anchor = useBookStore.getState().styleAnchorUrl;
    if (!anchor) {
      toast.error('Style anchor not ready yet. Please try again.');
      setGenerating(false);
      return;
    }

    // --- REMAINING PAGES: kick off jobs using stored style anchor ---
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

        // Poll in the background; don't block the loop
        pollJobStatus(jobId, page.page_number);

        // Small spacing between job starts
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // Mark page as error if job didn't start
        setGeneratedImages(prev =>
          prev.map(img =>
            img.page_number === page.page_number
              ? { ...img, status: 'error' as const, error: 'Failed to start job' }
              : img
          )
        );
      }
    }
  } catch (error: any) {
    console.error('Generation failed:', error);
    toast.error('Generation failed: ' + (error.message || 'Unknown error'));
    setGenerating(false);
  }
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