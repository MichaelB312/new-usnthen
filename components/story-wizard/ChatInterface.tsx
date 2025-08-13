'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  type: 'wizard' | 'user';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  babyName: string;
  onComplete: (conversation: any) => void;
}

const questions = [
  {
    id: 'memory_anchor',
    text: 'What special memory would you like to capture today?',
    placeholder: 'Describe a precious moment...'
  },
  {
    id: 'why_special',
    text: 'What made this moment so special for you?',
    placeholder: 'Share what touched your heart...'
  },
  {
    id: 'baby_action',
    text: 'What did {name} do in this moment?',
    placeholder: 'Describe their adorable actions...'
  },
  {
    id: 'baby_reaction',
    text: 'How did {name} react emotionally?',
    placeholder: 'Their expressions or feelings...'
  }
];

// Message components inline
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.type === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mr-2">
          <span className="text-white text-xs">✨</span>
        </div>
      )}
      <div className={`max-w-[70%] ${
        isUser 
          ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-2xl rounded-br-sm' 
          : 'bg-gradient-to-br from-purple-50 to-pink-50 text-gray-800 rounded-2xl rounded-bl-sm'
      } px-4 py-3 shadow-md`}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mr-2">
        <span className="text-white text-xs">✨</span>
      </div>
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-md">
        <div className="flex gap-1">
          <span className="typing-dot w-2 h-2 bg-purple-400 rounded-full"></span>
          <span className="typing-dot w-2 h-2 bg-purple-400 rounded-full"></span>
          <span className="typing-dot w-2 h-2 bg-purple-400 rounded-full"></span>
        </div>
      </div>
    </div>
  );
}

export function ChatInterface({ babyName, onComplete }: ChatInterfaceProps) {
  // Initialize with the first messages already in state
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'init-1',
      type: 'wizard',
      content: `Hello! I'm your Story Wizard ✨`,
      timestamp: new Date()
    },
    {
      id: 'init-2',
      type: 'wizard',
      content: `I'm here to help you create a magical story about ${babyName}'s special moment.`,
      timestamp: new Date()
    },
    {
      id: 'init-3',
      type: 'wizard',
      content: questions[0].text.replace('{name}', babyName),
      timestamp: new Date()
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [conversation, setConversation] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleSend = () => {
    if (!input.trim() || currentQuestionIndex >= questions.length) return;

    // Add user message
    addUserMessage(input);
    
    // Save to conversation
    const newConversation = [...conversation, {
      question: questions[currentQuestionIndex].id,
      answer: input
    }];
    setConversation(newConversation);
    
    // Clear input
    setInput('');
    
    // Move to next question
    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    
    // Check if we have more questions
    if (nextIndex < questions.length) {
      // Show typing indicator
      setIsTyping(true);
      
      // Add encouraging response after a delay
      setTimeout(() => {
        const responses = [
          "That's wonderful! 💕",
          "How beautiful! ✨",
          "That sounds amazing! 🌟",
          "I can feel the love in that memory! 💖"
        ];
        addWizardMessage(responses[currentQuestionIndex % responses.length]);
        
        // Add next question after another delay
        setTimeout(() => {
          setIsTyping(false);
          addWizardMessage(questions[nextIndex].text.replace('{name}', babyName));
        }, 1500);
      }, 1000);
    } else {
      // All questions answered - complete the conversation
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addWizardMessage("Perfect! I have everything I need to create your magical story! 📚✨");
        setTimeout(() => {
          onComplete(newConversation);
        }, 2000);
      }, 1500);
    }
  };

  return (
    <div className="card-magical max-w-4xl mx-auto">
      <div className="border-b border-purple-100 pb-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-patrick gradient-text">Story Wizard</h3>
            <p className="text-gray-600">Let's capture {babyName}'s precious memory</p>
          </div>
        </div>
      </div>

      <div className="h-[400px] overflow-y-auto space-y-4 mb-6 px-2">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-purple-100 pt-6">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={questions[currentQuestionIndex]?.placeholder || "Type your answer..."}
            className="input-magical flex-1"
            disabled={currentQuestionIndex >= questions.length}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || currentQuestionIndex >= questions.length}
            className="btn-primary px-6"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}