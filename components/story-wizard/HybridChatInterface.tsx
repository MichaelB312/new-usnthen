'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, CheckCircle2, Mic, Loader2 } from 'lucide-react';
import { useAudioRecording } from '@/lib/hooks/useAudioRecording';
import { useBookStore } from '@/lib/store/bookStore';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  type: 'wizard' | 'user';
  content: string;
  timestamp: Date;
}

interface HybridChatInterfaceProps {
  babyName: string;
  onComplete: (collectedData: any) => void;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.type === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 sm:mb-4 px-2 sm:px-0`}
    >
      {!isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mr-1.5 sm:mr-2 flex-shrink-0">
          <span className="text-white text-xs">✨</span>
        </div>
      )}
      <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ${
        isUser
          ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-2xl rounded-br-sm'
          : 'bg-gradient-to-br from-purple-50 to-pink-50 text-gray-800 rounded-2xl rounded-bl-sm'
      } px-3 py-2 sm:px-4 sm:py-3 shadow-md`}>
        <p className="text-xs sm:text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3 sm:mb-4 px-2 sm:px-0">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mr-1.5 sm:mr-2">
        <span className="text-white text-xs">✨</span>
      </div>
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl rounded-bl-sm px-3 py-2 sm:px-4 sm:py-3 shadow-md">
        <div className="flex gap-1">
          <span className="typing-dot w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full"></span>
          <span className="typing-dot w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full"></span>
          <span className="typing-dot w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full"></span>
        </div>
      </div>
    </div>
  );
}


function ProgressBar({ progress, collectedFields, t }: { progress: number; collectedFields: string[]; t: any }) {
  return (
    <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-purple-50 rounded-lg">
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <span className="text-xs sm:text-sm font-medium text-purple-700">{t('storyProgress')}</span>
        <span className="text-xs sm:text-sm font-bold text-purple-600">{progress}%</span>
      </div>
      <div className="w-full bg-purple-200 rounded-full h-1.5 sm:h-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 sm:h-2 rounded-full"
        />
      </div>
      {/* Hide field labels - they're confusing for users */}
    </div>
  );
}

export function HybridChatInterface({ babyName, onComplete }: HybridChatInterfaceProps) {
  const t = useTranslations('storyWizard');
  const locale = useBookStore((state) => state.locale);
  const bookType = useBookStore((state) => state.bookType);
  const writingStyle = useBookStore((state) => state.writingStyle);
  const setStructuredData = useBookStore((state) => state.setStructuredData);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => `guide-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  const [progress, setProgress] = useState(0);
  const [collectedFields, setCollectedFields] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [collectedData, setCollectedData] = useState<any>(null);
  const hasInitialized = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice recording hook
  const {
    isRecording,
    audioBlob,
    recordingDuration,
    error: recordingError,
    startRecording,
    stopRecording,
    reset: resetRecording
  } = useAudioRecording();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize conversation on mount (only once, even in Strict Mode)
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      startConversation();
    }
  }, []);

  const startConversation = async () => {
    setIsTyping(true);

    try {
      if (!bookType) {
        console.error('BookType not selected');
        addWizardMessage(t('welcomeInitial'));
        setIsTyping(false);
        return;
      }

      // Call AI-powered guide conversation API
      const response = await fetch('/api/guide-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          babyName,
          bookType,
          writingStyle,
          locale,
          action: 'start'
        })
      });

      const data = await response.json();

      if (data.success) {
        addWizardMessage(data.message);
        setProgress(data.progress || 0);
        setCollectedFields(data.collectedFields || []);
      } else {
        addWizardMessage(t('welcomeInitial'));
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      addWizardMessage(t('welcomeInitial'));
    } finally {
      setIsTyping(false);
    }
  };

  const addUserMessage = (content: string) => {
    const newMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const addWizardMessage = (content: string) => {
    const newMessage: Message = {
      id: `wizard-${Date.now()}`,
      type: 'wizard',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userInput = input;
    addUserMessage(userInput);
    setInput('');
    setIsTyping(true);

    try {
      // Call AI-powered guide conversation API
      const response = await fetch('/api/guide-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          babyName,
          bookType,
          writingStyle,
          locale,
          userMessage: userInput,
          action: 'continue'
        })
      });

      const data = await response.json();

      if (data.success) {
        // Simulate typing delay for natural feel
        await new Promise(resolve => setTimeout(resolve, 1000));

        addWizardMessage(data.message);
        setProgress(data.progress || 0);
        setCollectedFields(data.collectedFields || []);

        // Check if conversation is complete
        if (data.isComplete) {
          setIsComplete(true);
          setCollectedData(data.collectedData || {});

          // Save structured data to store
          setStructuredData(data.collectedData || {});
        }
      } else {
        addWizardMessage(t('didntCatch'));
      }
    } catch (error) {
      console.error('Failed to continue conversation:', error);
      addWizardMessage(t('tryAgain'));
    } finally {
      setIsTyping(false);
    }
  };

  // Handle audio transcription
  const handleTranscribe = async (blob: Blob) => {
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append('audio', blob);
      formData.append('babyName', babyName);
      formData.append('duration', recordingDuration.toString());
      formData.append('locale', locale);

      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Add transcribed text to input field for review
        setInput(prev => {
          const newText = data.transcription;
          // If there's existing text, add a space before appending
          return prev ? `${prev} ${newText}` : newText;
        });

        // Note: Emotion context is available in data.emotion if needed for future enhancements

        toast.success(t('voiceSuccess'));
      } else {
        // Handle specific error cases
        if (data.error === 'no_speech_detected') {
          toast.error(t('noSpeechDetected'));
        } else if (data.error === 'transcription_too_long') {
          toast.error(t('recordingError'));
        } else {
          toast.error(t('transcriptionError'));
        }
      }
    } catch (error) {
      console.error('[Voice] Transcription error:', error);
      toast.error(t('generalError'));
    } finally {
      setIsTranscribing(false);
      resetRecording();
    }
  };

  // Handle voice button interactions
  const handleVoiceStart = async () => {
    try {
      await startRecording();
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error(t('micAccessDenied'));
      } else if (error.name === 'NotFoundError') {
        toast.error(t('noMicFound'));
      } else {
        toast.error(t('recordingFailed'));
      }
    }
  };

  // Watch for recording completion
  useEffect(() => {
    if (audioBlob && !isRecording) {
      // Check minimum audio size (avoid empty recordings)
      if (audioBlob.size < 1000) {
        toast.error(t('noAudioDetected'));
        resetRecording();
        return;
      }

      // Check minimum recording duration (at least 1 second)
      if (recordingDuration < 1) {
        toast.error(t('recordingTooShort'));
        resetRecording();
        return;
      }

      handleTranscribe(audioBlob);
    }
  }, [audioBlob, isRecording, recordingDuration]);

  // Handle create story button click
  const handleCreateStory = () => {
    if (!collectedData) {
      toast.error('No data collected yet');
      return;
    }

    // Structured data already saved to store in handleSend
    // Pass empty conversation array - the story generation will use structuredData from store
    // The 3.0 API detects when structuredData is present and uses it instead
    onComplete([]);
  };

  // Show recording error if any
  useEffect(() => {
    if (recordingError) {
      toast.error(recordingError);
    }
  }, [recordingError]);

  return (
    <div className="card-magical max-w-4xl mx-auto">
      <div className="border-b border-purple-100 pb-4 sm:pb-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-patrick gradient-text">{t('title')}</h3>
            <p className="text-sm sm:text-base text-gray-600">{t('subtitle', { babyName })}</p>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      {progress > 0 && <ProgressBar progress={progress} collectedFields={collectedFields} t={t} />}

      {/* Messages */}
      <div className="h-[350px] sm:h-[400px] md:h-[450px] overflow-y-auto space-y-2 sm:space-y-4 mb-4 sm:mb-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isTyping && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-purple-100 pt-4 sm:pt-6">
        {/* Create Story Button (shown when conversation is complete) */}
        {isComplete && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">
                ✨ Perfect! I have everything I need to create your magical story.
              </p>
              <button
                onClick={handleCreateStory}
                className="btn-primary px-8 py-4 text-lg flex items-center justify-center gap-3 mx-auto"
              >
                <Sparkles className="h-6 w-6" />
                Create Your Story
              </button>
            </div>
          </div>
        )}

        {/* Recording Indicator */}
        {!isComplete && isRecording && (
          <div className="mb-3 flex items-center justify-center gap-2 text-sm text-purple-600 bg-purple-50 rounded-lg py-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-3 h-3 bg-red-500 rounded-full"
            />
            <span className="font-medium">
              {t('recordingTime', {
                time: `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')}`
              })}
              {recordingDuration >= 270 && <span className="ml-2 text-xs">{t('recordingTimeRemaining')}</span>}
            </span>
          </div>
        )}

        {/* Transcribing Indicator */}
        {!isComplete && isTranscribing && (
          <div className="mb-3 flex items-center justify-center gap-2 text-sm text-purple-600 bg-purple-50 rounded-lg py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-medium">{t('transcribing')}</span>
          </div>
        )}

        {/* Input Fields (hidden when complete) */}
        {!isComplete && (
          <div className="flex gap-2 sm:gap-3">
          {/* Text Input */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isComplete ? t('placeholderComplete') :
              isRecording ? t('placeholderRecording') :
              isTranscribing ? t('placeholderTranscribing') :
              t('placeholderTyping')
            }
            className="input-magical flex-1 text-sm sm:text-base"
            disabled={isTyping || isRecording || isTranscribing}
          />

          {/* Voice Button (Hold to Record) */}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              handleVoiceStart();
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              stopRecording();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              handleVoiceStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              stopRecording();
            }}
            disabled={isTyping || isTranscribing}
            className={`
              px-4 sm:px-5 py-2 sm:py-3 rounded-xl font-semibold
              transition-all duration-200 shadow-md
              ${isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white scale-105'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
              ${!isTyping && !isTranscribing ? 'ring-2 ring-purple-300 ring-offset-2' : ''}
            `}
            title={t('holdToRecord')}
          >
            {isRecording ? (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
              </motion.div>
            ) : (
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || isRecording || isTranscribing}
            className="btn-primary px-4 sm:px-6"
          >
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
        )}

        {/* Help Text (only when not complete) */}
        {!isComplete && (
          <p className="text-xs text-gray-500 text-center mt-2">
            {isRecording
              ? t('helpTextRecording', { duration: recordingDuration })
              : t('helpText')
            }
          </p>
        )}
      </div>
    </div>
  );
}
