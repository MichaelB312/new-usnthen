'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { convertToLegacyFormat, validateConversationData } from '@/lib/agents/conversationAdapter';

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

function ProgressBar({ progress, collectedFields }: { progress: number; collectedFields: string[] }) {
  return (
    <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-purple-50 rounded-lg">
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <span className="text-xs sm:text-sm font-medium text-purple-700">Story Progress</span>
        <span className="text-xs sm:text-sm font-bold text-purple-600">{progress}%</span>
      </div>
      <div className="w-full bg-purple-200 rounded-full h-1.5 sm:h-2 mb-1.5 sm:mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 sm:h-2 rounded-full"
        />
      </div>
      {collectedFields.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 sm:mt-2">
          {collectedFields.map(field => (
            <div key={field} className="flex items-center gap-1 bg-purple-100 text-purple-700 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
              <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="capitalize">{field.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HybridChatInterface({ babyName, onComplete }: HybridChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  const [progress, setProgress] = useState(0);
  const [collectedFields, setCollectedFields] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const hasInitialized = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const response = await fetch('/api/story-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          babyName,
          action: 'start'
        })
      });

      const data = await response.json();

      if (data.success) {
        addWizardMessage(data.message);
        setProgress(data.progress || 0);
        setCollectedFields(data.collectedFields || []);
      } else {
        addWizardMessage("I'm here to help create a magical story! Let's start by hearing about a special moment you'd like to capture.");
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      addWizardMessage("I'm here to help create a magical story! Let's start by hearing about a special moment you'd like to capture.");
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
      const response = await fetch('/api/story-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          babyName,
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

          // Convert Gemini data to legacy format for story generation
          const legacyConversation = convertToLegacyFormat(data.collectedData || {});

          // Validate we have minimum required data
          const validation = validateConversationData(data.collectedData || {});
          if (!validation.valid) {
            console.warn('Missing required fields:', validation.missing);
          }

          // Wait a bit then call onComplete with legacy format
          setTimeout(() => {
            onComplete(legacyConversation);
          }, 2000);
        }
      } else {
        addWizardMessage("I didn't quite catch that. Could you tell me more about this special moment?");
      }
    } catch (error) {
      console.error('Failed to continue conversation:', error);
      addWizardMessage("I'm having trouble understanding. Could you try describing that again?");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="card-magical max-w-4xl mx-auto">
      <div className="border-b border-purple-100 pb-4 sm:pb-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-patrick gradient-text">Story Wizard</h3>
            <p className="text-sm sm:text-base text-gray-600">Let's capture {babyName}'s precious memory</p>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <ProgressBar progress={progress} collectedFields={collectedFields} />

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
        <div className="flex gap-2 sm:gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isComplete ? "Story complete!" : "Share your memory..."}
            className="input-magical flex-1 text-sm sm:text-base"
            disabled={isComplete || isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isComplete || isTyping}
            className="btn-primary px-4 sm:px-6"
          >
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
