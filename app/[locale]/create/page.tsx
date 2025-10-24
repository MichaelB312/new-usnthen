// app/create/page.tsx - Updated with all batches
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { Baby, MessageCircle, BookOpen, Wand2, Image, Eye, CreditCard, Check, Home, ArrowLeft, Sparkles, Palette } from 'lucide-react';
import { ChatInterface } from '@/components/story-wizard/ChatInterface';
import { HybridChatInterface } from '@/components/story-wizard/HybridChatInterface';
import { ProfileForm } from '@/components/baby-profile/ProfileForm';
import { StoryReviewSpreads } from '@/components/story-review/StoryReviewSpreads';
import { IntegratedBookPreview } from '@/components/book-preview/IntegratedBookPreview';
import { AsyncBatchedImageGenerator as ImageGenerator } from '@/components/illustrations/AsyncBatchedImageGenerator';
import { useBookStore } from '@/lib/store/bookStore';
import BookTypeSelection from '@/components/story-wizard/BookTypeSelection';
import WritingStyleSelection from '@/components/story-wizard/WritingStyleSelection';
import { BookType, WritingStyle } from '@/lib/types/bookTypes3';
import { isFeatureEnabled } from '@/lib/features/flags';
import { TEST_BABY_PROFILE, TEST_STORY_DATA, TEST_CONVERSATION } from '@/lib/testing/testStoryData';
import { SaveProgressButton } from '@/components/common/SaveProgressButton';
import { ResumeProgressModal } from '@/components/common/ResumeProgressModal';
import { loadProgress, hasSavedProgress, saveProgress } from '@/lib/store/progressStore';
import toast from 'react-hot-toast';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { v4 as uuidv4 } from 'uuid';

// Steps will be populated with translations in the component

const POLL_INTERVAL = 2000;
const MAX_POLL_TIME = 120000;

export default function CreateBookPage() {
  const router = useRouter();
  const t = useTranslations();
  const { width, height } = useWindowSize();
  const [currentStep, setCurrentStep] = useState(-2); // Start at -2 (BookType), -1 (WritingStyle), then 1+ for main flow

  // Define steps with translations - BookType and WritingStyle are NOT in progress bar
  const steps = [
    { id: 1, name: t('createPage.steps.babyProfile'), icon: Baby },
    { id: 2, name: t('createPage.steps.memoryChat'), icon: MessageCircle },
    { id: 3, name: t('createPage.steps.storyReview'), icon: BookOpen },
    { id: 4, name: t('createPage.steps.illustrations'), icon: Image },
    { id: 5, name: t('createPage.steps.bookLayout'), icon: Eye },
    { id: 6, name: t('createPage.steps.order'), icon: CreditCard }
  ];
  const [showConfetti, setShowConfetti] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedProgress, setSavedProgress] = useState<any>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number>(0);

  const {
    bookId,
    setBookId,
    babyProfile,
    storyData,
    setProfile,
    setConversation,
    setStory,
    illustrationStyle,
    locale,
    reset,
    // 3.0 fields
    bookType,
    writingStyle,
    structuredData,
    recipient,
    setBookType,
    setWritingStyle
  } = useBookStore();

  // Check for saved progress and TEST MODE on mount
  useEffect(() => {
    if (!bookId) {
      setBookId(uuidv4());
    }

    // TEST MODE: Auto-populate with test data and skip to Story Review
    if (isFeatureEnabled('test_mode')) {
      console.log('🧪 TEST MODE ENABLED - Loading test data...');

      // Force load test data regardless of existing state
      setProfile(TEST_BABY_PROFILE);
      setConversation(TEST_CONVERSATION);
      setStory(TEST_STORY_DATA);
      setCurrentStep(3); // Jump to Story Review

      toast.success('🧪 Test mode: Loaded Yara\'s beach story', {
        duration: 3000,
        icon: '🧪'
      });
      return; // Skip resume check in test mode
    }

    // Check for saved progress (only if NOT in test mode)
    if (hasSavedProgress()) {
      const progress = loadProgress();
      if (progress) {
        setSavedProgress(progress);
        setShowResumeModal(true);
      }
    }
  }, []); // Run only once on mount

  // Auto-save progress whenever key data changes
  useEffect(() => {
    if (currentStep >= 1 && !isGeneratingStory && !isFeatureEnabled('test_mode')) { // Only save when in main flow (step 1+)
      const conversation = useBookStore.getState().conversation;
      const illustrations = useBookStore.getState().illustrations;

      saveProgress({
        savedAt: new Date().toISOString(),
        currentStep,
        babyProfile,
        conversation,
        storyData,
        generatedImages: illustrations,
        bookId: bookId || undefined
      });
    }
  }, [currentStep, babyProfile, storyData]);

  // Separate effect for bookId
  useEffect(() => {
    if (!bookId) {
      setBookId(uuidv4());
    }
  }, [bookId, setBookId]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Handler for BookType selection (step -2)
  const handleBookTypeSelect = (type: BookType) => {
    toast.success('Book type selected!');
    setCurrentStep(-1); // Move to WritingStyle
  };

  // Handler for WritingStyle selection (step -1)
  const handleWritingStyleSelect = (style: WritingStyle) => {
    toast.success('Writing style selected!');
    setCurrentStep(1); // Move to Profile (start of main flow)
  };

  const handleProfileComplete = (profile: any) => {
    setProfile(profile);
    setCurrentStep(2); // Move to Chat
  };

  const handleChatComplete = async (conversation: any) => {
    setConversation(conversation);
    setIsGeneratingStory(true);
    setGenerationProgress(0);
    setGenerationMessage('Starting story generation...');
    startStoryGeneration(conversation);
  };

  const startStoryGeneration = async (conversation: any) => {
    try {
      const storyLengthEntry = conversation.find((c: any) => c.question === 'story_length');
      const storyLength = storyLengthEntry?.answer || 'medium';

      // Build request body - include 3.0 data if available
      const requestBody: any = {
        babyProfile,
        conversation,
        illustrationStyle,
        storyLength,
        locale
      };

      // If 3.0 data is available, include it (this triggers 3.0 mode in API)
      if (bookType && writingStyle && structuredData) {
        requestBody.bookType = bookType;
        requestBody.writingStyle = writingStyle;
        requestBody.structuredData = structuredData;
        requestBody.recipient = recipient;
        console.log('🎉 Using 3.0 mode for story generation');
      }

      const res = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        throw new Error(`Failed to start story generation: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success && data.jobId) {
        setCurrentJobId(data.jobId);
        pollStartTimeRef.current = Date.now();
        startPollingForStory(data.jobId);
      } else if (data.story) {
        handleStoryComplete(data.story);
      } else {
        throw new Error('Invalid response from story generation');
      }
      
    } catch (error: any) {
      console.error('Error starting story generation:', error);
      toast.error('Failed to start story generation. Please try again.');
      setIsGeneratingStory(false);
      setGenerationProgress(0);
      setCurrentStep(2); // Back to Chat
    }
  };

  const startPollingForStory = (jobId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        if (Date.now() - pollStartTimeRef.current > MAX_POLL_TIME) {
          console.error('Story generation timed out');
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          
          toast.error('Story generation is taking too long. Please try with a simpler memory.');
          setIsGeneratingStory(false);
          setGenerationProgress(0);
          setCurrentStep(2); // Back to Chat
          return;
        }

        const res = await fetch(`/api/generate-story?jobId=${jobId}`);

        if (!res.ok) {
          if (res.status === 404) {
            console.error('Story job not found');
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;

            toast.error('Story generation job was lost. Please try again.');
            setIsGeneratingStory(false);
            setGenerationProgress(0);
            setCurrentStep(2); // Back to Chat
            return;
          }
          throw new Error(`Failed to check story status: ${res.status}`);
        }

        const data = await res.json();

        if (data.success && data.job) {
          const { status, progress, message, result, error } = data.job;

          setGenerationProgress(progress || 0);
          setGenerationMessage(message || 'Generating story...');

          if (status === 'completed' && result) {
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;
            handleStoryComplete(result);
          } else if (status === 'failed') {
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;

            console.error('Story generation failed:', error);
            toast.error(error || 'Failed to generate story. Please try again.');
            setIsGeneratingStory(false);
            setGenerationProgress(0);
            setCurrentStep(2); // Back to Chat
          }
        }
        
      } catch (error: any) {
        console.error('Error polling for story:', error);
      }
    }, POLL_INTERVAL);
  };

  const handleStoryComplete = (story: any) => {
    setStory(story);
    setGenerationProgress(100);
    setGenerationMessage('Story complete!');

    setTimeout(() => {
      setIsGeneratingStory(false);
      setCurrentStep(3); // Story Review
      setCurrentJobId(null);
    }, 500);
  };

  const handleStoryRegenerate = () => {
    const conversation = useBookStore.getState().conversation;
    setIsGeneratingStory(true);
    setGenerationProgress(0);
    setGenerationMessage('Regenerating story...');
    startStoryGeneration(conversation);
  };

  const handleStoryContinue = () => {
    setCurrentStep(4); // Illustrations
  };

  const handleIllustrationsComplete = () => {
    setCurrentStep(5); // Layout
  };

  const handleLayoutComplete = () => {
    setCurrentStep(6); // Order
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
  };

  const handleBack = () => {
    if (currentStep > -2) { // Can go back to BookType selection
      setCurrentStep(currentStep - 1);
    } else {
      router.push('/');
    }
  };

  const handleResumeProgress = () => {
    if (savedProgress) {
      setCurrentStep(savedProgress.currentStep);
      if (savedProgress.babyProfile) setProfile(savedProgress.babyProfile);
      if (savedProgress.conversation) setConversation(savedProgress.conversation);
      if (savedProgress.storyData) setStory(savedProgress.storyData);
      if (savedProgress.bookId) setBookId(savedProgress.bookId);

      setShowResumeModal(false);
      toast.success('Progress restored!');
    }
  };

  const handleStartNew = () => {
    setShowResumeModal(false);
    setSavedProgress(null);
    // Progress is already cleared in ResumeProgressModal
  };

  return (
    <div className={`min-h-screen ${currentStep >= 1 ? 'p-4 sm:p-6 pt-20 sm:pt-24' : ''}`}>
      {showConfetti && <Confetti width={width} height={height} />}

      {/* Resume Progress Modal */}
      {showResumeModal && savedProgress && (
        <ResumeProgressModal
          progress={savedProgress}
          onResume={handleResumeProgress}
          onStartNew={handleStartNew}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header - Only show when in main flow (currentStep >= 1) */}
        {currentStep >= 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={handleBack} className="btn-ghost flex items-center gap-2 text-sm sm:text-base px-2 sm:px-4">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{t('createPage.back')}</span>
            </button>
            <button onClick={() => router.push('/')} className="btn-ghost flex items-center gap-2 text-sm sm:text-base px-2 sm:px-4">
              <Home className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{t('nav.home')}</span>
            </button>
          </div>

          <h1 className="font-patrick text-xl sm:text-2xl lg:text-3xl gradient-text pb-1 text-center">{t('createPage.title')}</h1>

          {/* Desktop only - hide on mobile */}
          <div className="hidden sm:flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentStep < 6 && !isGeneratingStory && (
              <SaveProgressButton
                currentStep={currentStep}
                babyProfile={babyProfile}
                conversation={useBookStore.getState().conversation}
                storyData={storyData}
                generatedImages={useBookStore.getState().illustrations}
                bookId={bookId || undefined}
              />
            )}
          </div>
        </div>
        )}

        {/* Progress Bar - Only show when in main flow (currentStep >= 1) */}
        {currentStep >= 1 && !isGeneratingStory && (
          <div className="mb-8 sm:mb-12">
            <div className="card-magical px-2 sm:px-4">
              <div className="grid grid-cols-6 gap-1 sm:gap-2 items-start relative">
                <div className="absolute top-4 sm:top-6 md:top-8 left-4 right-4 sm:left-8 sm:right-8 h-0.5 sm:h-1 bg-gray-200 z-0">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                    initial={{ width: '0%' }}
                    animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {steps.map((step) => {
                  const Icon = step.icon;
                  const isCurrentStep = currentStep === step.id;
                  const isPastStep = currentStep > step.id;

                  return (
                    <div key={step.id} className="relative z-10">
                      <div className="flex flex-col items-center justify-start">
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{
                            scale: isCurrentStep ? 1.1 : 0.95
                          }}
                          className={`w-8 h-8 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-white border-2 sm:border-3 md:border-4 transition-all flex-shrink-0 ${
                            isCurrentStep
                              ? 'border-purple-600 shadow-lg'
                              : isPastStep
                              ? 'border-green-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {isPastStep ? (
                            <Check className="h-3 w-3 sm:h-5 sm:w-5 md:h-6 md:w-6 text-green-500" />
                          ) : (
                            <Icon
                              className={`h-3 w-3 sm:h-5 sm:w-5 md:h-6 md:w-6 ${
                                isCurrentStep ? 'text-purple-600' : 'text-gray-400'
                              }`}
                            />
                          )}
                        </motion.div>
                        {/* Only show name on mobile if it's the current step */}
                        <p
                          className={`mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-center px-1 transition-opacity leading-tight whitespace-nowrap ${
                            isCurrentStep ? 'text-purple-600 opacity-100' : 'text-gray-600 opacity-0 sm:opacity-100'
                          }`}
                        >
                          {step.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {isGeneratingStory ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card-magical text-center py-12 sm:py-16 lg:py-20 px-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="inline-block mb-6 sm:mb-8"
              >
                <Wand2 className="h-16 w-16 sm:h-20 sm:w-20 text-purple-600" />
              </motion.div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-patrick mb-3 sm:mb-4 gradient-text">{t('createPage.generating.title')}</h2>
              <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-4 sm:mb-6 px-2">
                {t('createPage.generating.subtitle', {babyName: babyProfile?.baby_name || ''})}
              </p>

              <div className="max-w-md mx-auto px-4">
                <div className="bg-gray-200 rounded-full h-2 sm:h-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                    initial={{ width: '0%' }}
                    animate={{ width: `${generationProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                  {generationMessage}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Step -2: BookType Selection (not in progress bar) */}
              {currentStep === -2 && <BookTypeSelection onSelect={handleBookTypeSelect} />}

              {/* Step -1: WritingStyle Selection (not in progress bar) */}
              {currentStep === -1 && <WritingStyleSelection onSelect={handleWritingStyleSelect} />}

              {/* Step 1: Profile */}
              {currentStep === 1 && <ProfileForm onComplete={handleProfileComplete} />}

              {/* Step 2: Chat */}
              {currentStep === 2 && babyProfile && (
                isFeatureEnabled('hybrid_agent') ? (
                  <HybridChatInterface babyName={babyProfile.baby_name} onComplete={handleChatComplete} />
                ) : (
                  <ChatInterface babyName={babyProfile.baby_name} onComplete={handleChatComplete} />
                )
              )}

              {/* Step 3: Story Review */}
              {currentStep === 3 && storyData && (
                <StoryReviewSpreads
                  onContinue={handleStoryContinue}
                  onRegenerate={handleStoryRegenerate}
                />
              )}

              {/* Step 4: Illustrations */}
              {currentStep === 4 && storyData && (
                <ImageGenerator onComplete={handleIllustrationsComplete} />
              )}

              {/* Step 5: Book Layout */}
              {currentStep === 5 && (
                <IntegratedBookPreview onComplete={handleLayoutComplete} />
              )}

              {/* Step 6: Order */}
              {currentStep === 6 && (
                <div className="card-magical text-center py-12 sm:py-16 lg:py-20 px-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                    className="inline-block mb-6 sm:mb-8"
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                  </motion.div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-patrick mb-3 sm:mb-4 gradient-text">{t('createPage.completion.title')}</h2>
                  <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-3 sm:mb-4 px-2">
                    {t('createPage.completion.spreadsCount', {count: Math.ceil((storyData?.pages?.length || 0) / 2), babyName: babyProfile?.baby_name || ''})}
                  </p>
                  <p className="text-sm sm:text-base lg:text-lg text-gray-600 px-2">
                    {t('createPage.completion.withEffects')}
                  </p>
                  <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-4 justify-center px-4">
                    <button className="btn-primary text-sm sm:text-base px-6 py-3">
                      {t('createPage.completion.orderPrinted')}
                    </button>
                  </div>
                </div>
              )}

              {/* Mobile only - Save button below step content */}
              {currentStep >= 1 && currentStep < 6 && (
                <div className="sm:hidden mt-6">
                  <SaveProgressButton
                    currentStep={currentStep}
                    babyProfile={babyProfile}
                    conversation={useBookStore.getState().conversation}
                    storyData={storyData}
                    generatedImages={useBookStore.getState().illustrations}
                    bookId={bookId || undefined}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}