'use client';

/**
 * Create3Flow - The complete Us & Then 3.0 book creation orchestrator
 *
 * Flow: BookType → WritingStyle → Profile → GuideChat → StoryGeneration → Review
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBookStore } from '@/lib/store/bookStore';
import { BookType, WritingStyle } from '@/lib/types/bookTypes3';
import { GuideAgent, createGuideAgent } from '@/lib/agents/GuideAgent';
import BookTypeSelection from './BookTypeSelection';
import WritingStyleSelection from './WritingStyleSelection';
import { ProfileForm } from '@/components/baby-profile/ProfileForm';
import toast from 'react-hot-toast';

type FlowStep =
  | 'book_type'
  | 'writing_style'
  | 'profile'
  | 'recipient' // Only for tribute books
  | 'guide_chat'
  | 'story_generation'
  | 'story_review';

interface Create3FlowProps {
  onComplete?: () => void;
}

export default function Create3Flow({ onComplete }: Create3FlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('book_type');
  const [guideAgent, setGuideAgent] = useState<GuideAgent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    bookType,
    writingStyle,
    babyProfile,
    structuredData,
    guideConversationState,
    setBookType,
    setWritingStyle,
    setProfile,
    setRecipient,
    updateStructuredDataField,
    setGuideConversationState,
    locale
  } = useBookStore();

  // Handle book type selection
  const handleBookTypeSelect = (type: BookType) => {
    setCurrentStep('writing_style');
    toast.success('Book type selected!');
  };

  // Handle writing style selection
  const handleWritingStyleSelect = (style: WritingStyle) => {
    setCurrentStep('profile');
    toast.success('Writing style selected!');
  };

  // Handle profile completion
  const handleProfileComplete = (profile: any) => {
    setProfile(profile);

    // Check if this is a tribute book
    if (bookType === BookType.TRIBUTE_BOOK) {
      setCurrentStep('recipient');
    } else {
      initializeGuideChat(profile.baby_name);
    }
    toast.success(`Welcome, ${profile.baby_name}!`);
  };

  // Handle recipient input (for tribute books)
  const handleRecipientComplete = (recipientName: string) => {
    setRecipient(recipientName);
    initializeGuideChat(babyProfile?.baby_name || 'Baby');
  };

  // Initialize the guide chat
  const initializeGuideChat = (babyName: string) => {
    if (!bookType) return;

    const agent = createGuideAgent(bookType, babyName);
    setGuideAgent(agent);

    // Get initial greeting
    const greeting = agent.getInitialGreeting(babyName);

    // Update store with conversation state
    setGuideConversationState(agent.getState());

    setCurrentStep('guide_chat');
  };

  // Handle user message in guide chat
  const handleUserMessage = async (message: string) => {
    if (!guideAgent) return;

    // Process user response
    guideAgent.processUserResponse(message);

    // Update store
    setGuideConversationState(guideAgent.getState());

    // Check if we should ask follow-up or move to next field
    const shouldFollowUp = guideAgent.shouldAskFollowUp(message.length);

    if (shouldFollowUp) {
      const followUp = guideAgent.getFollowUpQuestion();
      if (followUp) {
        setGuideConversationState(guideAgent.getState());
        return;
      }
    }

    // Move to next question
    const nextQuestion = guideAgent.getNextQuestion();
    setGuideConversationState(guideAgent.getState());

    // Check if guide is complete
    if (guideAgent.getState().isComplete) {
      // Show completion message
      toast.success('Your story details are complete! Generating...');
      setCurrentStep('story_generation');
      generateStory();
    }
  };

  // Generate the story using API
  const generateStory = async () => {
    if (!babyProfile || !bookType || !writingStyle || !structuredData) {
      toast.error('Missing required data for story generation');
      return;
    }

    setIsGenerating(true);

    try {
      // Call the generate-story API with 3.0 data
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          babyProfile: {
            baby_name: babyProfile.baby_name,
            birthdate: babyProfile.birthdate,
            gender: babyProfile.gender
          },
          bookType,
          writingStyle,
          structuredData,
          locale,
          recipient: useBookStore.getState().recipient
        })
      });

      const data = await response.json();

      if (data.success && data.jobId) {
        // Poll for completion
        pollStoryJob(data.jobId);
      } else {
        throw new Error('Failed to start story generation');
      }
    } catch (error: any) {
      console.error('Story generation error:', error);
      toast.error('Failed to generate story. Please try again.');
      setIsGenerating(false);
    }
  };

  // Poll for story job completion
  const pollStoryJob = async (jobId: string) => {
    const maxAttempts = 60; // 2 minutes max (2s intervals)
    let attempts = 0;

    const poll = async () => {
      attempts++;

      try {
        const response = await fetch(`/api/generate-story?jobId=${jobId}`);
        const data = await response.json();

        if (data.job.status === 'completed') {
          // Story is ready!
          useBookStore.getState().setStory(data.job.result);
          setIsGenerating(false);
          setCurrentStep('story_review');
          toast.success('Your story is ready!');
        } else if (data.job.status === 'failed') {
          throw new Error(data.job.error || 'Story generation failed');
        } else if (attempts < maxAttempts) {
          // Still processing, poll again
          setTimeout(poll, 2000);
        } else {
          throw new Error('Story generation timed out');
        }
      } catch (error: any) {
        console.error('Polling error:', error);
        toast.error('Story generation failed');
        setIsGenerating(false);
      }
    };

    poll();
  };

  // Render the appropriate step
  const renderStep = () => {
    switch (currentStep) {
      case 'book_type':
        return <BookTypeSelection onSelect={handleBookTypeSelect} />;

      case 'writing_style':
        return <WritingStyleSelection onSelect={handleWritingStyleSelect} />;

      case 'profile':
        return (
          <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 px-4 py-12">
            <div className="mx-auto max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 text-center"
              >
                <h1 className="mb-4 text-4xl font-bold text-gray-900">
                  Tell us about your little one
                </h1>
                <p className="text-xl text-gray-600">
                  This helps us personalize the story just for them
                </p>
              </motion.div>

              <ProfileForm onComplete={handleProfileComplete} />
            </div>
          </div>
        );

      case 'recipient':
        return (
          <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-red-50 px-4 py-12">
            <div className="mx-auto max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <h1 className="mb-4 text-4xl font-bold text-gray-900">
                  Who is this book for?
                </h1>
                <p className="mb-8 text-xl text-gray-600">
                  Tell us the name of the special person
                </p>

                <div className="mx-auto max-w-md">
                  <input
                    type="text"
                    placeholder="e.g., Grandma, Dad, Uncle Mike"
                    className="w-full rounded-xl border-2 border-gray-200 px-6 py-4 text-lg focus:border-pink-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        handleRecipientComplete(e.currentTarget.value.trim());
                      }
                    }}
                    autoFocus
                  />
                  <p className="mt-4 text-sm text-gray-500">
                    Press Enter to continue
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        );

      case 'guide_chat':
        return (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-12">
            <div className="mx-auto max-w-4xl">
              {/* Chat interface would go here */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl bg-white p-8 shadow-xl"
              >
                <h2 className="mb-6 text-3xl font-bold text-gray-900">
                  Let's create your story together
                </h2>

                {/* Progress indicator */}
                {guideAgent && (
                  <div className="mb-6">
                    <div className="mb-2 flex justify-between text-sm text-gray-600">
                      <span>Progress</span>
                      <span>{guideAgent.getProgressPercentage()}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${guideAgent.getProgressPercentage()}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}

                {/* Conversation display */}
                <div className="mb-6 space-y-4">
                  {guideConversationState?.conversationHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-6 py-3 ${
                          msg.role === 'user'
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type your answer..."
                    className="flex-grow rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-purple-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        handleUserMessage(e.currentTarget.value.trim());
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button
                    className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-medium text-white hover:from-purple-600 hover:to-pink-600"
                    onClick={() => {
                      const input = document.querySelector('input') as HTMLInputElement;
                      if (input?.value.trim()) {
                        handleUserMessage(input.value.trim());
                        input.value = '';
                      }
                    }}
                  >
                    Send
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        );

      case 'story_generation':
        return (
          <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="mb-8">
                <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse">
                  <span className="text-5xl">✨</span>
                </div>
              </div>
              <h2 className="mb-4 text-4xl font-bold text-gray-900">
                Creating your magical story...
              </h2>
              <p className="text-xl text-gray-600">
                This usually takes about 30-60 seconds
              </p>
            </motion.div>
          </div>
        );

      case 'story_review':
        return (
          <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 px-4 py-12">
            <div className="mx-auto max-w-4xl text-center">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h1 className="mb-4 text-4xl font-bold text-gray-900">
                  Your story is ready!
                </h1>
                <p className="text-xl text-gray-600">
                  Review your story and move on to illustrations
                </p>
              </motion.div>
              {/* Story review component would go here */}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {renderStep()}
    </AnimatePresence>
  );
}
