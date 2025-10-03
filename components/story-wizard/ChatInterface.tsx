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

// Enhanced question tree with conditional branching
const questions = [
  {
    id: 'memory_anchor',
    text: 'What special memory would you like to capture today?',
    placeholder: 'Describe a precious moment...',
    examples: 'Examples: "First time at the beach", "Playing with grandma", "Learning to crawl"'
  },
  {
    id: 'location',
    text: 'Where did this happen?',
    placeholder: 'The location or setting...',
    examples: 'Examples: "At the beach", "In our backyard", "At grandma\'s house"'
  },
  {
    id: 'who_was_there',
    text: 'Who was there with {name}?',
    placeholder: 'Family members or friends...',
    examples: 'Examples: "Just mom and me", "The whole family", "Grandma and grandpa"'
  },
  {
    id: 'special_object',
    text: 'Was there a special toy, food, or object in this memory?',
    placeholder: 'Any special item...',
    examples: 'Examples: "A red bucket", "Birthday cake", "Daddy\'s hat" (or just say "No")'
  },
  {
    id: 'milestone_check',
    text: 'Was this a special milestone or first time?',
    placeholder: 'Type: "first time", "milestone", or "no"',
    examples: 'Examples: "Yes, first time!", "Yes, a milestone!", "No, just a beautiful moment"',
    isChoice: true,
    choices: ['Yes, first time!', 'Yes, a milestone!', 'No, just beautiful']
  },
  {
    id: 'milestone_detail',
    text: 'What was the first time or milestone?',
    placeholder: 'Describe the achievement...',
    examples: 'Examples: "First steps", "First time in water", "Started crawling"',
    conditional: true // Only shown if milestone_check is yes
  },
  {
    id: 'why_special',
    text: 'What made this moment so special for you?',
    placeholder: 'Share what touched your heart...',
    examples: 'Examples: "She was so brave", "The look of pure joy", "A bonding moment"'
  },
  {
    id: 'story_beginning',
    text: 'Let\'s build your story! How did this moment START?',
    placeholder: 'What caught {name}\'s attention first?',
    examples: 'Examples: "She saw the waves", "Grandma called her over", "A toy fell nearby"'
  },
  {
    id: 'story_middle',
    text: 'What was the EXCITING part in the middle?',
    placeholder: 'What did {name} do? Any small challenge?',
    examples: 'Examples: "Scared at first but crawled forward", "Tried hard to reach the toy", "Laughed and splashed"'
  },
  {
    id: 'story_end',
    text: 'How did it END?',
    placeholder: 'The sweet conclusion or feeling...',
    examples: 'Examples: "Fell asleep happy", "Gave grandma a hug", "Smiled with joy"'
  },
  {
    id: 'sensory_details',
    text: 'What sounds, smells, or feelings do you remember?',
    placeholder: 'Sensory details that stood out...',
    examples: 'Examples: "Warm sand, sound of waves", "Sweet smell of cake", "Soft grass under her feet"'
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mr-2 flex-shrink-0">
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
      content: `I'm here to help you create a magical story about ${babyName}'s special moment. I'll ask you a few questions to capture all the beautiful details.`,
      timestamp: new Date()
    },
    {
      id: 'init-3',
      type: 'wizard',
      content: questions[0].text.replace('{name}', babyName),
      timestamp: new Date()
    },
    {
      id: 'init-4',
      type: 'wizard',
      content: questions[0].examples || '',
      timestamp: new Date()
    }
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [conversation, setConversation] = useState<any[]>([]);
  const [skipMilestoneDetail, setSkipMilestoneDetail] = useState(false);
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

  const getNextQuestion = (currentIndex: number, userAnswer: string) => {
    const currentQuestion = questions[currentIndex];

    // Handle milestone conditional logic
    if (currentQuestion.id === 'milestone_check') {
      const answer = userAnswer.toLowerCase();
      if (answer.includes('no') || answer.includes('just') || answer.includes('beautiful')) {
        // Skip milestone_detail question
        setSkipMilestoneDetail(true);
        return currentIndex + 2; // Skip next question
      } else {
        setSkipMilestoneDetail(false);
        return currentIndex + 1; // Go to milestone_detail
      }
    }

    return currentIndex + 1;
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const currentQuestion = questions[currentQuestionIndex];

    // Add user message
    addUserMessage(input);

    // Save to conversation
    const newConversation = [...conversation, {
      question: currentQuestion.id,
      answer: input
    }];
    setConversation(newConversation);

    // Clear input
    setInput('');

    // Get next question index (handles conditional logic)
    const nextIndex = getNextQuestion(currentQuestionIndex, input);
    setCurrentQuestionIndex(nextIndex);

    // Check if we have more questions
    if (nextIndex < questions.length) {
      const nextQuestion = questions[nextIndex];

      // Skip conditional questions if needed
      if (nextQuestion.conditional && skipMilestoneDetail) {
        // Already handled in getNextQuestion
        return;
      }

      // Show typing indicator
      setIsTyping(true);

      // Add encouraging response after a delay
      setTimeout(() => {
        const responses = [
          "That's wonderful! 💕",
          "How beautiful! ✨",
          "That sounds amazing! 🌟",
          "I can feel the love in that memory! 💖",
          "Perfect! 🎨",
          "What a special moment! 💝"
        ];
        addWizardMessage(responses[currentQuestionIndex % responses.length]);

        // Add next question after another delay
        setTimeout(() => {
          addWizardMessage(nextQuestion.text.replace('{name}', babyName));
          if (nextQuestion.examples) {
            setTimeout(() => {
              addWizardMessage(nextQuestion.examples || '');
              setIsTyping(false);
            }, 800);
          } else {
            setIsTyping(false);
          }
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

  const handleChoice = (choice: string) => {
    // Simulate user clicking a button choice
    setInput(choice);
    setTimeout(() => handleSend(), 100);
  };

  const currentQuestion = questions[currentQuestionIndex];
  const showChoices = currentQuestion?.isChoice && !isTyping;

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
        {showChoices ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600 mb-2">Choose one:</p>
            {currentQuestion.choices?.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => handleChoice(choice)}
                className="btn-secondary text-left"
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
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
              placeholder={currentQuestion?.placeholder?.replace('{name}', babyName) || "Type your answer..."}
              className="input-magical flex-1"
              disabled={currentQuestionIndex >= questions.length || isTyping}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || currentQuestionIndex >= questions.length || isTyping}
              className="btn-primary px-6"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
