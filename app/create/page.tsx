// app/create/page.tsx - Updated with all batches
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Baby, MessageCircle, BookOpen, Wand2, Image, Eye, CreditCard, Check, Home } from 'lucide-react';
import { ChatInterface } from '@/components/story-wizard/ChatInterface';
import { ProfileForm } from '@/components/baby-profile/ProfileForm';
import { StoryReviewSpreads } from '@/components/story-review/StoryReviewSpreads';
import { IntegratedBookPreview } from '@/components/book-preview/IntegratedBookPreview';
import { AsyncBatchedImageGenerator as ImageGenerator } from '@/components/illustrations/AsyncBatchedImageGenerator';
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

const POLL_INTERVAL = 2000;
const MAX_POLL_TIME = 120000;

export default function CreateBookPage() {
  const router = useRouter();
  const { width, height } = useWindowSize();
  const [currentStep, setCurrentStep] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
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
    reset
  } = useBookStore();

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

  const handleProfileComplete = (profile: any) => {
    setProfile(profile);
    setCurrentStep(2);
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
      
      const res = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          babyProfile,
          conversation,
          illustrationStyle,
          storyLength
        })
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
      setCurrentStep(2);
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
          setCurrentStep(2);
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
            setCurrentStep(2);
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
            setCurrentStep(2);
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
    
    const pageCount = story?.pages?.length || 10;
    toast.success(`Created a ${pageCount}-page story for ${babyProfile?.baby_name}!`);
    
    setTimeout(() => {
      setIsGeneratingStory(false);
      setCurrentStep(3);
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

        {/* Progress Bar */}
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
                            scale: currentStep === step.id ? 1.2 : currentStep > step.id ? 1 : 0.9
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
              {currentStep === 1 && <ProfileForm onComplete={handleProfileComplete} />}

              {currentStep === 2 && babyProfile && (
                <ChatInterface babyName={babyProfile.baby_name} onComplete={handleChatComplete} />
              )}

              {currentStep === 3 && storyData && (
                <StoryReviewSpreads 
                  onContinue={handleStoryContinue} 
                  onRegenerate={handleStoryRegenerate} 
                />
              )}

              {currentStep === 4 && storyData && (
                <ImageGenerator onComplete={handleIllustrationsComplete} />
              )}

              {currentStep === 5 && (
                <IntegratedBookPreview onComplete={handleLayoutComplete} />
              )}

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
                  <p className="text-xl text-gray-600 mb-4">
                    {Math.ceil((storyData?.pages?.length || 0) / 2)} beautiful spreads featuring {babyProfile?.baby_name}
                  </p>
                  <p className="text-lg text-gray-600">
                    With story-relevant decorations and sound effects!
                  </p>
                  <div className="mt-8 flex gap-4 justify-center">
                    <button className="btn-secondary">
                      Download PDF
                    </button>
                    <button className="btn-primary">
                      Order Printed Copy
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}