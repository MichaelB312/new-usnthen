// app/create/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Baby, MessageCircle, BookOpen, Wand2, Image, Eye, CreditCard, Check, Home } from 'lucide-react';
import { ChatInterface } from '@/components/story-wizard/ChatInterface';
import { ProfileForm } from '@/components/baby-profile/ProfileForm';
import { StoryReview } from '@/components/story-review/StoryReview';
import { AsyncBatchedImageGenerator as ImageGenerator } from '@/components/illustrations/AsyncBatchedImageGenerator';
import { EnhancedBookPreview as BookPreview } from '@/components/book-preview/BookPreview';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { v4 as uuidv4 } from 'uuid';

const steps = [
  { id: 1, name: 'Baby Profile', icon: Baby },
  { id: 2, name: 'Memory Chat', icon: MessageCircle },
  { id: 3, name: 'Story Review', icon: BookOpen },
  { id: 4, name: 'Illustrations', icon: Image },
  { id: 5, name: 'Book Layout', icon: Eye },
  { id: 6, name: 'Order', icon: CreditCard }
];

export default function CreateBookPage() {
  const router = useRouter();
  const { width, height } = useWindowSize();
  const [currentStep, setCurrentStep] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const {
    bookId,
    setBookId,
    babyProfile,
    storyData,
    setProfile,
    setConversation,
    setStory,
    illustrationStyle,
    reset
  } = useBookStore();

  useEffect(() => {
    if (!bookId) {
      setBookId(uuidv4());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress animation during generation
  useEffect(() => {
    if (isGeneratingStory) {
      const interval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) return prev; // Cap at 90% until complete
          return prev + 5; // Increment by 5% every second
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setGenerationProgress(0);
    }
  }, [isGeneratingStory]);

  const handleProfileComplete = (profile: any) => {
    setProfile(profile);
    setCurrentStep(2);
  };

  const handleChatComplete = async (conversation: any) => {
    setConversation(conversation);
    setIsGeneratingStory(true);

    // Small delay to show the transition
    setTimeout(() => {
      generateStory(conversation);
    }, 500);
  };

  // Safe fetch with longer timeout for story generation
  const generateStory = async (conversation: any, retryCount = 0) => {
    try {
      // Longer timeout for complex story generation - 45 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45_000); // Increased from 25s to 45s

      const res = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          babyProfile,
          conversation,
          illustrationStyle
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Read raw body first to avoid "Unexpected end of JSON input"
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} – ${text || 'No body'}`);
      }
      if (!text) {
        throw new Error('Empty response body from /api/generate-story');
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Malformed JSON from /api/generate-story');
      }

      if (!data?.success || !data?.story) {
        throw new Error('Malformed response payload from /api/generate-story');
      }

      setStory(data.story);
      setGenerationProgress(100);

      // Delay before transitioning to story review
      setTimeout(() => {
        setIsGeneratingStory(false);
        setCurrentStep(3);
      }, 500);
    } catch (error: any) {
      console.error('Error generating story:', error?.message || error);
      
      // Handle timeout specifically
      if (error?.name === 'AbortError') {
        if (retryCount < 1) {
          // Retry once on timeout
          console.log('Story generation timed out, retrying...');
          toast.loading('Taking a bit longer than expected... Please wait.');
          generateStory(conversation, retryCount + 1);
          return;
        } else {
          toast.error('Story generation is taking too long. Please try with a simpler memory.');
        }
      } else {
        toast.error('Failed to generate story. Please try again.');
      }
      
      setIsGeneratingStory(false);
      setGenerationProgress(0);
      setCurrentStep(2);
    }
  };

  const handleStoryRegenerate = () => {
    const conversation = useBookStore.getState().conversation;
    setIsGeneratingStory(true);
    setGenerationProgress(0);
    setTimeout(() => {
      generateStory(conversation);
    }, 500);
  };

  const handleStoryContinue = () => {
    setCurrentStep(4);
  };

  const handleIllustrationsComplete = () => {
    setCurrentStep(5);
  };

  const handleLayoutComplete = () => {
    setCurrentStep(6);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
  };

  return (
    <div className="min-h-screen p-6 pt-24">
      {showConfetti && <Confetti width={width} height={height} />}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.push('/')} className="btn-ghost flex items-center gap-2">
            <Home className="h-5 w-5" />
            Home
          </button>

          <h1 className="font-patrick text-3xl gradient-text">Create Your Magical Storybook</h1>

          <div className="w-20" />
        </div>

        {/* Progress Bar - Hide during story generation */}
        {!isGeneratingStory && (
          <div className="mb-12">
            <div className="card-magical">
              <div className="flex justify-between items-center relative">
                <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200 z-0">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                    initial={{ width: '0%' }}
                    animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {steps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex-1 relative z-10">
                      <div className="flex flex-col items-center">
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{
                            scale:
                              currentStep === step.id ? 1.2 : currentStep > step.id ? 1 : 0.9
                          }}
                          className={`w-16 h-16 rounded-full flex items-center justify-center bg-white border-4 transition-all ${
                            currentStep === step.id
                              ? 'border-purple-600 shadow-lg'
                              : currentStep > step.id
                              ? 'border-green-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {currentStep > step.id ? (
                            <Check className="h-6 w-6 text-green-500" />
                          ) : (
                            <Icon
                              className={`h-6 w-6 ${
                                currentStep === step.id ? 'text-purple-600' : 'text-gray-400'
                              }`}
                            />
                          )}
                        </motion.div>
                        <p
                          className={`mt-2 text-sm font-medium ${
                            currentStep === step.id ? 'text-purple-600' : 'text-gray-600'
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
              className="card-magical text-center py-20"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="inline-block mb-8"
              >
                <Wand2 className="h-20 w-20 text-purple-600" />
              </motion.div>
              <h2 className="text-4xl font-patrick mb-4 gradient-text">Creating Your Story...</h2>
              <p className="text-xl text-gray-600 mb-6">
                Our AI is crafting a beautiful tale for {babyProfile?.baby_name}
              </p>
              
              {/* Progress bar */}
              <div className="max-w-md mx-auto">
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                    initial={{ width: '0%' }}
                    animate={{ width: `${generationProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {generationProgress < 30 
                    ? 'Analyzing memory...' 
                    : generationProgress < 60 
                    ? 'Creating narrative arc...'
                    : generationProgress < 90
                    ? 'Adding emotional depth...'
                    : 'Finalizing your story...'}
                </p>
              </div>
              
              {generationProgress > 60 && (
                <p className="text-xs text-gray-400 mt-6">
                  Creating emotionally engaging stories takes a moment...
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {currentStep === 1 && <ProfileForm onComplete={handleProfileComplete} />}

              {currentStep === 2 && babyProfile && (
                <ChatInterface babyName={babyProfile.baby_name} onComplete={handleChatComplete} />
              )}

              {currentStep === 3 && storyData && (
                <StoryReview onContinue={handleStoryContinue} onRegenerate={handleStoryRegenerate} />
              )}

              {currentStep === 4 && storyData && (
                <ImageGenerator onComplete={handleIllustrationsComplete} />
              )}

              {currentStep === 5 && <BookPreview onComplete={handleLayoutComplete} />}

              {currentStep === 6 && (
                <div className="card-magical text-center py-20">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                    className="inline-block mb-8"
                  >
                    <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-12 w-12 text-white" />
                    </div>
                  </motion.div>
                  <h2 className="text-4xl font-patrick mb-4 gradient-text">Your Book is Ready!</h2>
                  <p className="text-xl text-gray-600">Download your PDF or order a printed copy</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}