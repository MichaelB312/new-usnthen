// components/illustrations/AsyncBatchedImageGenerator.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2, Camera, Sparkles, Book, RefreshCw,
  AlertCircle, Clock, Loader2, Home, Star, Heart, Palette,
  Users, Plus, Check, Baby, Scissors
} from 'lucide-react';
import { useBookStore, PersonId, selectImageReferences } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { CastManagerWithDescriptions } from '@/components/cast-management/CastManagerWithDescriptions';

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
const MIN_LOADING_TIME = 180000; // 3 minutes minimum

export function AsyncBatchedImageGenerator({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();
  const {
    babyProfile,
    storyData,
    bookId,
    cast,
    uploadedPhotos,
    setIllustrations,
    setStyleAnchor
  } = useBookStore();

  const [phase, setPhase] = useState<'cast' | 'generate' | 'complete'>('cast');
  const [generating, setGenerating] = useState(false);
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [visualProgress, setVisualProgress] = useState(0);
  const [page1Completed, setPage1Completed] = useState(false);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [currentLoadingTip, setCurrentLoadingTip] = useState(0);
  const [generationStartTime, setGenerationStartTime] = useState<number>(0);
  const [actualGenerationComplete, setActualGenerationComplete] = useState(false);

  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const visualProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const generatedImagesRef = useRef<GeneratedImage[]>([]);

  // Paper Collage specific loading tips
  const loadingTips = [
    "Cutting paper pieces...",
    "Layering colorful shapes...",
    "Adding texture and depth...",
    "Creating paper magic...",
    "Arranging the collage...",
    "Adding torn paper edges...",
    "Building dimensional layers...",
    "Crafting your story..."
  ];

  // Update ref whenever generatedImages changes
  useEffect(() => {
    generatedImagesRef.current = generatedImages;
  }, [generatedImages]);

  // Rotate tips every 4 seconds
  useEffect(() => {
    if (generating) {
      const interval = setInterval(() => {
        setCurrentLoadingTip(prev => (prev + 1) % loadingTips.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [generating, loadingTips.length]);

  // Initialize images from story data - Simple: one slot per page (always 4 pages)
  useEffect(() => {
    if (storyData?.pages) {
      const pageCount = storyData.pages.length; // Always 4 pages
      const initialImages: GeneratedImage[] = [];

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const page = storyData.pages[pageIndex];

        initialImages.push({
          page_number: pageIndex + 1,
          dataUrl: '',
          style: 'paper-collage',
          camera_angle: page?.shot_id || page?.camera_angle || 'wide',
          action: page?.visual_action || page?.action_label || '',
          characters_on_page: page?.characters_on_page || [],
          status: 'pending'
        });
      }

      setGeneratedImages(initialImages);
    }
  }, [storyData]);


  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up polling intervals...');
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();

      if (visualProgressIntervalRef.current) {
        clearInterval(visualProgressIntervalRef.current);
        visualProgressIntervalRef.current = null;
      }
    };
  }, []);

  // Cleanup when phase changes
  useEffect(() => {
    if (phase !== 'generate') {
      console.log('Phase changed from generate, cleaning up polling...');
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();
    }
  }, [phase]);

  // Slow, smooth progress animation (3 minutes minimum)
  useEffect(() => {
    if (generating && !visualProgressIntervalRef.current) {
      const startTime = Date.now();
      setGenerationStartTime(startTime);

      visualProgressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const targetProgress = Math.min((elapsed / MIN_LOADING_TIME) * 95, 95);

        if (actualGenerationComplete && elapsed >= MIN_LOADING_TIME) {
          setVisualProgress(100);
          clearInterval(visualProgressIntervalRef.current!);
          visualProgressIntervalRef.current = null;
          handleFinalCompletion();
        } else {
          setVisualProgress(targetProgress);
        }
      }, 100);
    } else if (!generating && visualProgressIntervalRef.current) {
      clearInterval(visualProgressIntervalRef.current);
      visualProgressIntervalRef.current = null;
    }
  }, [generating, actualGenerationComplete]);

  const handleFinalCompletion = () => {
    setTimeout(() => {
      setGenerating(false);
      setShowCompletionScreen(true);

      // Transition to book preview after 4 seconds
      setTimeout(() => {
        setPhase('complete');
        setShowCompletionScreen(false);
        onComplete();
      }, 4000);
    }, 500);
  };

  const handleCastComplete = () => {
    const storyCharacters = new Set<PersonId>();

    storyData?.pages.forEach(page => {
      page.characters_on_page?.forEach(char => storyCharacters.add(char));
    });

    if (storyData?.cast_members) {
      storyData.cast_members.forEach(char => storyCharacters.add(char));
    }

    // Check if each character has either a photo OR a description
    const missingInput = Array.from(storyCharacters).filter(charId => {
      const hasPhoto = uploadedPhotos.some(p => p.people.includes(charId));
      const hasDescription = cast[charId]?.features_lock; // Check for description
      return !hasPhoto && !hasDescription;
    });

    if (missingInput.length > 0) {
      toast.error(`Missing photos or descriptions for: ${missingInput.join(', ')}`);
      return;
    }

    // Skip style selection, go directly to generate
    setPhase('generate');
    // Start generation automatically
    setTimeout(() => generateAllAsync(), 100);
  };

  const startImageGeneration = async (page: any): Promise<string | null> => {
    try {
      console.log(`Starting Paper Collage generation for page ${page.page_number}`);
      const payload: any = {
        bookId,
        pageNumber: page.page_number,
        babyProfile,
        pageData: {
          ...page,
          narration: page.narration,
          shot_id: page.shot_id,
          shot_description: page.shot_description,
          camera_angle: page.camera_angle,
          camera_prompt: page.camera_prompt,
          visual_action: page.visual_action || page.action_description,
          action_label: page.action_label,
          sensory_details: page.sensory_details,
          emotion: page.emotion,
          visual_focus: page.visual_focus,
          scene_type: page.scene_type,
          characters_on_page: page.characters_on_page,
          background_extras: page.background_extras
        },
        // Pass cast with descriptions
        cast: cast,
        // CRITICAL: Pass all pages for sequential storytelling
        allPages: storyData?.pages || []
      };

      // For page 0 (character anchor) or page 1, we need baby photo/description
      if (page.page_number === 0 || page.page_number === 1) {
        const babyPhoto = uploadedPhotos.find(p =>
          p.people.includes('baby') && p.is_identity_anchor
        ) || uploadedPhotos.find(p =>
          p.people.includes('baby')
        );
        if (babyPhoto?.fileUrl) {
          payload.babyPhotoUrl = babyPhoto.fileUrl;
        } else if (babyProfile?.baby_photo_url) {
          payload.babyPhotoUrl = babyProfile.baby_photo_url;
        } else if (cast.baby?.features_lock) {
          // No photo but we have description - don't throw error
          console.log(`Page ${page.page_number}: Using baby description instead of photo`);
          payload.babyDescription = cast.baby.features_lock;
        } else {
          console.error(`No baby photo or description available for Page ${page.page_number}`);
          return null;
        }

        // Also pass uploadedPhotos for character anchor to work properly
        payload.uploadedPhotos = uploadedPhotos;

        console.log(`Page ${page.page_number}: ${page.page_number === 0 ? 'Creating character anchor' : 'Creating Paper Collage style anchor'} for ${babyProfile?.gender} baby`);
      } else {
        const charactersOnPage = page.characters_on_page || [];
        const minimalPhotos = charactersOnPage.map((charId: PersonId) => {
          const photo = uploadedPhotos.find(p =>
            p.people.includes(charId) && p.is_identity_anchor
          ) || uploadedPhotos.find(p =>
            p.people.includes(charId)
          );
          if (photo) {
            return {
              fileUrl: photo.fileUrl,
              people: [charId],
              is_identity_anchor: !!photo.is_identity_anchor
            };
          }
          return null;
        }).filter(Boolean);
        payload.uploadedPhotos = minimalPhotos;
        console.log(`Page ${page.page_number}: Paper Collage with ${minimalPhotos.length} character refs`);
      }
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
          const pageImage = generatedImagesRef.current.find(img => img.page_number === pageNumber);
          if (pageImage?.status === 'success') {
            console.log(`[Poll] Page ${pageNumber} already complete, stopping poll`);
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);
            resolve(true);
            return;
          }

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

          if (pollCount > 150) {
            console.log(`[Poll] Max attempts reached for job ${jobId}`);
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);
            resolve(false);
            return;
          }

          const response = await fetch(`/api/generate-image-async?jobId=${jobId}`);

          if (!response.ok) {
            console.error(`[Poll] Bad response for ${jobId}: ${response.status}`);
            return;
          }

          const data = await response.json();

          if (!data.success) {
            console.error(`[Poll] API error for ${jobId}:`, data.error);
            return;
          }

          const { job } = data;

          setJobs(prev => prev.map(j =>
            j.jobId === jobId
              ? { ...j, status: job.status, progress: job.progress || 0 }
              : j
          ));

          if (job.status === 'completed' && job.result) {
            console.log(`[Poll] Job ${jobId} completed for page ${job.result.page_number}`);
            clearInterval(interval);
            pollingIntervalsRef.current.delete(jobId);

            // Page 0 is the style anchor - save it separately, NOT as a book page
            if (job.result.page_number === 0) {
              console.log('[Poll] Character anchor (page 0) saved - not added to book pages');
              setStyleAnchor(job.result.dataUrl);
              resolve(true);
              return;
            }

            // Simple! Page number is just 1, 2, 3, or 4 - no mapping needed
            // Page number already available from job.result

            console.log(`[Poll] Page ${pageNumber} completed`);

            if (pageNumber === 1) {
              setPage1Completed(true);
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
            return;
          }

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
            return;
          }

        } catch (error) {
          console.error(`[Poll] Error polling ${jobId}:`, error);
        }
      }, POLL_INTERVAL);

      pollingIntervalsRef.current.set(jobId, interval);
    });
  };

  const checkCompletion = (images: GeneratedImage[]) => {
    const totalPages = images.length; // Total pages to generate (always 4)
    const completed = images.filter(img =>
      img.status === 'success' || img.status === 'error'
    ).length;

    const successful = images.filter(img => img.status === 'success');

    console.log(`[Completion] ${completed}/${totalPages} pages done, ${successful.length} successful`);

    if (completed === totalPages) {
      console.log('All pages complete, cleaning up polling...');
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();

      if (successful.length > 0) {
        const illustrationsForStore = successful.map(img => ({
          page_number: img.page_number,
          url: img.dataUrl,
          style: 'paper-collage',
          shot: img.camera_angle,
          action_id: img.action,
          model: 'gpt-image-1'
        }));

        setIllustrations(illustrationsForStore);
      }

      setActualGenerationComplete(true);

      const elapsed = Date.now() - generationStartTime;
      if (elapsed >= MIN_LOADING_TIME) {
        setVisualProgress(100);
        handleFinalCompletion();
      }
    }
  };

  const generateAllAsync = async () => {
    if (!storyData?.pages) {
      return;
    }

    pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
    pollingIntervalsRef.current.clear();

    const uniqueCharacters = new Set<PersonId>();
    storyData.pages.forEach(page => {
      page.characters_on_page?.forEach(char => uniqueCharacters.add(char));
    });

    // Updated validation to check for either photos OR descriptions
    const missingInput = Array.from(uniqueCharacters).filter(charId => {
      const hasPhoto = uploadedPhotos.some(p => p.people.includes(charId));
      const hasDescription = cast[charId]?.features_lock;
      return !hasPhoto && !hasDescription;
    });

    if (missingInput.length > 0) {
      toast.error(`Missing photos or descriptions for: ${missingInput.join(', ')}`);
      return;
    }

    setGenerating(true);
    setJobs([]);
    setVisualProgress(0);
    setPage1Completed(false);
    setCurrentLoadingTip(0);
    setActualGenerationComplete(false);

    try {
      // STEP 1: Generate Character Anchor (Page 0) FIRST
      console.log('🎨 Generating character anchor (Page 0) - NOT a story page...');

      const anchorPage = {
        ...storyData.pages[0],
        page_number: 0,
        narration: 'Character reference anchor',
        is_character_free: false, // MUST be false - this is a character anchor!
        characters_on_page: ['baby']
      };

      const anchorJobId = await startImageGeneration(anchorPage);
      if (!anchorJobId) {
        throw new Error('Failed to start character anchor generation');
      }

      const anchorJob: ImageJob = {
        jobId: anchorJobId,
        pageNumber: 0,
        status: 'pending',
        progress: 0,
        startTime: Date.now(),
      };
      setJobs([anchorJob]);

      console.log('⏳ Waiting for character anchor to complete...');
      const anchorSuccess = await pollJobStatus(anchorJobId, 0);

      if (!anchorSuccess) {
        throw new Error('Character anchor generation failed');
      }

      console.log('✅ Character anchor completed!');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // STEP 2: Generate pages 1, 2, 3, 4 (simple!)
      console.log('📖 Starting page generation...');

      const pageCount = storyData.pages.length; // Always 4 pages
      console.log(`🎨 Generating ${pageCount} landscape pages`);

      // Generate Page 1 first
      setGeneratedImages(prev =>
        prev.map(img =>
          img.page_number === 1 ? { ...img, status: 'generating' as const } : img
        )
      );

      const page1JobId = await startImageGeneration(storyData.pages[0]);
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
        setGenerating(false);
        pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
        pollingIntervalsRef.current.clear();
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // PARALLEL GENERATION: Start pages 2, 3, 4 in parallel
      console.log(`🚀 Starting ${pageCount - 1} pages in parallel...`);

      const pagePromises: Promise<void>[] = [];

      for (let pageIndex = 1; pageIndex < pageCount; pageIndex++) {
        const page = storyData.pages[pageIndex];
        const pageNumber = pageIndex + 1;

        if (!page) {
          console.warn(`No page data for page ${pageNumber}`);
          continue;
        }

        console.log(`🎨 Starting Page ${pageNumber}`);

        setGeneratedImages(prev =>
          prev.map(img =>
            img.page_number === pageNumber ? { ...img, status: 'generating' as const } : img
          )
        );

        const pagePromise = (async () => {
          const jobId = await startImageGeneration(page);

          if (jobId) {
            const job: ImageJob = {
              jobId,
              pageNumber,
              status: 'pending',
              progress: 0,
              startTime: Date.now(),
            };
            setJobs(prev => [...prev, job]);

            const pageSuccess = await pollJobStatus(jobId, pageNumber);

            if (!pageSuccess) {
              console.error(`Page ${pageNumber} generation failed`);
              setGeneratedImages(prev =>
                prev.map(img =>
                  img.page_number === pageNumber
                    ? { ...img, status: 'error' as const, error: 'Generation failed' }
                    : img
                )
              );
            }
          } else {
            setGeneratedImages(prev =>
              prev.map(img =>
                img.page_number === pageNumber
                  ? { ...img, status: 'error' as const, error: 'Failed to start' }
                  : img
              )
            );
          }
        })();

        pagePromises.push(pagePromise);

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await Promise.all(pagePromises);

      console.log('✅ All pages generation complete!');


    } catch (error: any) {
      console.error('Generation failed:', error);

      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();

      setGenerating(false);
      setPhase('cast');
    }
  };

  // Elegant, Paper Collage themed loading screen
  if (generating) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gradient-to-b from-white to-purple-50/30 z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-lg px-8"
          >
            {/* Paper Collage animation */}
            <div className="mb-12">
              <motion.div
                className="inline-block relative"
                animate={{
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Scissors className="h-24 w-24 text-purple-400 stroke-1" />

                {/* Paper pieces floating */}
                <motion.div
                  className="absolute -top-2 -right-2"
                  animate={{
                    y: [-5, 5, -5],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="w-4 h-4 bg-pink-300 transform rotate-12" />
                </motion.div>

                <motion.div
                  className="absolute -bottom-2 -left-2"
                  animate={{
                    y: [5, -5, 5],
                    rotate: [0, -360],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1
                  }}
                >
                  <div className="w-3 h-3 bg-purple-300 transform -rotate-12" />
                </motion.div>
              </motion.div>
            </div>

            {/* Clean typography */}
            <h2 className="text-4xl font-patrick text-gray-800 mb-3">
              Creating Your Paper Collage Book
            </h2>

            <p className="text-lg text-gray-600 mb-2">
              for {babyProfile?.baby_name}
            </p>

            {/* Rotating tips */}
            <motion.p
              key={currentLoadingTip}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-sm text-purple-600 mb-12 h-6"
            >
              {loadingTips[currentLoadingTip]}
            </motion.p>

            {/* Progress bar */}
            <div className="relative">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
                  style={{ width: `${visualProgress}%` }}
                  transition={{ duration: 0.3, ease: "linear" }}
                />
              </div>

              <div className="mt-6 text-sm text-gray-500">
                {Math.round(visualProgress)}% complete
              </div>
            </div>

            {/* Quality message */}
            <motion.div
              className="mt-12 text-xs text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
            >
              Each page is handcrafted with paper collage magic
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Simple completion screen
  if (showCompletionScreen) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gradient-to-b from-white to-purple-50/30 z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-8"
            >
              <Check className="h-10 w-10 text-white" strokeWidth={2} />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-4xl font-patrick text-gray-800 mb-3"
            >
              Your Paper Collage Book is Ready
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-lg text-gray-600"
            >
              Let's see your beautiful creation!
            </motion.p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Render based on phase
  if (phase === 'cast') {
    return <CastManagerWithDescriptions onComplete={handleCastComplete} />;
  }

  if (phase === 'generate') {
    // This shows briefly before auto-starting generation
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="card-magical"
        >
          <Scissors className="h-20 w-20 text-purple-600 mx-auto mb-6" />
          <h2 className="text-3xl font-patrick gradient-text mb-4">
            Ready to Create Your Paper Collage Book
          </h2>
          <p className="text-lg text-gray-600 mb-2">
            Our unique paper collage style will bring {babyProfile?.baby_name}'s story to life
          </p>
          <p className="text-sm text-purple-600">
            Starting generation...
          </p>
        </motion.div>
      </div>
    );
  }

  // Results phase
  if (phase === 'complete' && generatedImages.some(img => img.status !== 'pending')) {
    return (
      <motion.div className="card-magical">
        <h3 className="text-2xl font-patrick gradient-text text-center mb-6">
          Your Paper Collage Illustrations!
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
                    <p className="text-xs text-gray-500">Paper Collage</p>
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
