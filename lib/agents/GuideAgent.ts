// lib/agents/GuideAgent.ts - Conversational AI Guide for Data Collection

import {
  BookType,
  WritingStyle,
  GuideConversationState,
  GuideMessage,
  SpecialMomentData,
  GrowthStoryData,
  TributeBookData,
  SpecialWorldData,
  GuidedTemplateData,
  getRequiredFields
} from '@/lib/types/bookTypes3';

/**
 * Field Collection Strategies - Defines how to ask about each field
 */
interface FieldStrategy {
  field: string;
  initialQuestion: string;
  followUpQuestions?: string[];
  dependencies?: string[]; // Fields that should be collected first
  isArray?: boolean; // If the field collects multiple items
}

/**
 * Book Type Strategies - Each book type has its own conversation flow
 */
const SPECIAL_MOMENT_STRATEGY: FieldStrategy[] = [
  {
    field: 'moment_title',
    initialQuestion: "Let's capture this special moment together! What would you like to call this memory? For example, 'The day at the beach' or 'Our first cuddle.'",
    followUpQuestions: ["That's beautiful! Can you tell me a bit more about what made this moment so special?"]
  },
  {
    field: 'when_it_happened',
    initialQuestion: "When did this special moment take place? You can be as specific or as general as you'd like.",
    followUpQuestions: ["Perfect! That helps me picture when this happened."]
  },
  {
    field: 'the_setting',
    initialQuestion: "Where did this moment unfold? Tell me about the place.",
    followUpQuestions: ["I can almost see it! What else do you remember about that place?"]
  },
  {
    field: 'what_happened',
    initialQuestion: "Now, tell me the story! What happened during this special moment?",
    followUpQuestions: [
      "That's wonderful! Were there any other moments or details from that time?",
      "I love that! Anything else you'd like to add?"
    ],
    isArray: true
  },
  {
    field: 'sensory_details',
    initialQuestion: "Let's make this come alive! What did you see, hear, smell, or feel during this moment?",
    followUpQuestions: ["Those details are perfect! They'll make the story so vivid."]
  },
  {
    field: 'why_special',
    initialQuestion: "Finally, why does this moment matter to you? What makes it worth remembering forever?",
    followUpQuestions: ["That's so meaningful. This is going to be a beautiful book!"]
  }
];

const GROWTH_STORY_STRATEGY: FieldStrategy[] = [
  {
    field: 'milestone_name',
    initialQuestion: "I'm so excited to tell this growth story! What milestone or journey are we celebrating? For example, 'Learning to walk' or 'Finding their voice.'",
    followUpQuestions: ["That's such an amazing milestone! Let's capture every part of this journey."]
  },
  {
    field: 'beginning',
    initialQuestion: "Let's start at the very beginning. What was it like before this journey started?",
    followUpQuestions: ["That's a perfect starting point. Can you tell me a bit more about that early stage?"]
  },
  {
    field: 'middle_journey',
    initialQuestion: "Now, let's talk about the middle part—the practice, the little steps, the helpers, or even the funny fails. What happened during this journey?",
    followUpQuestions: [
      "I love that! Were there any other moments or attempts you remember?",
      "That's great! Anything else from this practice time?"
    ],
    isArray: true
  },
  {
    field: 'breakthrough',
    initialQuestion: "This is my favorite part! Tell me about the big moment when it finally 'clicked.' When did they get it?",
    followUpQuestions: ["What an incredible moment! How did it feel when it happened?"]
  },
  {
    field: 'afterglow',
    initialQuestion: "And now? How have things changed since that breakthrough?",
    followUpQuestions: ["That's wonderful! It's amazing to see how far they've come."]
  },
  {
    field: 'helpers',
    initialQuestion: "Who supported them through this journey? Were there special helpers or cheerleaders along the way?",
    followUpQuestions: ["They sound wonderful! Support makes all the difference."]
  }
];

const TRIBUTE_BOOK_STRATEGY: FieldStrategy[] = [
  {
    field: 'recipient',
    initialQuestion: "This is such a beautiful idea! Who is this book for? Who is the special person in your baby's life?",
    followUpQuestions: ["What a wonderful person to celebrate! Let's create something magical for them."]
  },
  {
    field: 'relationship',
    initialQuestion: "How would you describe their relationship with your little one?",
    followUpQuestions: ["That bond is so special! Let's capture it in this book."]
  },
  {
    field: 'reasons_to_love',
    initialQuestion: "Now, tell me the reasons why they're so special. What do you love about them?",
    followUpQuestions: [
      "That's beautiful! What else makes them wonderful?",
      "I love that! Any other reasons you'd like to include?"
    ],
    isArray: true
  },
  {
    field: 'shared_memory',
    initialQuestion: "Can you share a special memory or moment they've shared together?",
    followUpQuestions: ["What a precious memory! That will be perfect for the book."]
  },
  {
    field: 'special_wish',
    initialQuestion: "Finally, what message or wish would you like to give them through this book?",
    followUpQuestions: ["That's so heartfelt. They're going to treasure this forever!"]
  },
  {
    field: 'their_special_thing',
    initialQuestion: "Is there something unique about them? A special talent, tradition, or quirk that makes them who they are?",
    followUpQuestions: ["That's what makes them unforgettable! Perfect addition to the story."]
  }
];

const SPECIAL_WORLD_STRATEGY: FieldStrategy[] = [
  {
    field: 'world_theme',
    initialQuestion: "Let's explore your baby's magical world! What aspect would you like to focus on? Their home? Neighborhood? Daily routines? Or something else?",
    followUpQuestions: ["Perfect! Let's bring that world to life in this book."]
  },
  {
    field: 'home_corner',
    initialQuestion: "Tell me about a favorite spot in your home. Where does your little one love to be?",
    followUpQuestions: ["I can picture it! What makes that spot so special?"]
  },
  {
    field: 'daily_walk_sights',
    initialQuestion: "What are some things you see regularly in your world together? During walks, errands, or daily adventures?",
    followUpQuestions: [
      "That's lovely! What else do you encounter in your world?",
      "Great! Any other regular sights or places?"
    ],
    isArray: true
  },
  {
    field: 'favorite_sounds',
    initialQuestion: "What sounds fill your world? Birds chirping? Music playing? The dog barking?",
    followUpQuestions: ["Those sounds paint such a vivid picture!"],
    isArray: true
  },
  {
    field: 'cozy_routine',
    initialQuestion: "Tell me about a daily ritual or cozy routine you share together.",
    followUpQuestions: ["That sounds so comforting and special!"]
  },
  {
    field: 'seasonal_moment',
    initialQuestion: "Optional: Is there a way their world changes with the seasons? A favorite seasonal activity or sight?",
    followUpQuestions: ["That's a beautiful touch! Seasons add such richness to the story."]
  }
];

const GUIDED_TEMPLATE_STRATEGY: FieldStrategy[] = [
  {
    field: 'template_id',
    initialQuestion: "Let's start with a template! Which one speaks to you? 'The First Month With You,' 'Your First Birthday,' or something else?",
    followUpQuestions: ["Great choice! Now let's personalize it together."]
  },
  {
    field: 'slot_1',
    initialQuestion: "Tell me about the first special detail for this template.",
    followUpQuestions: ["Perfect! That's going to fit beautifully."]
  },
  {
    field: 'slot_2',
    initialQuestion: "Next, tell me about another key detail.",
    followUpQuestions: ["Wonderful! We're bringing this to life."]
  },
  {
    field: 'slot_3',
    initialQuestion: "And one more important piece?",
    followUpQuestions: ["Excellent! This is coming together nicely."]
  },
  {
    field: 'custom_details',
    initialQuestion: "Is there anything else you'd like to add to make this uniquely yours?",
    followUpQuestions: ["Those personal touches make all the difference!"]
  }
];

/**
 * Get the strategy for a specific book type
 */
function getStrategy(bookType: BookType): FieldStrategy[] {
  switch (bookType) {
    case BookType.SPECIAL_MOMENT:
      return SPECIAL_MOMENT_STRATEGY;
    case BookType.GROWTH_STORY:
      return GROWTH_STORY_STRATEGY;
    case BookType.TRIBUTE_BOOK:
      return TRIBUTE_BOOK_STRATEGY;
    case BookType.SPECIAL_WORLD:
      return SPECIAL_WORLD_STRATEGY;
    case BookType.GUIDED_TEMPLATE:
      return GUIDED_TEMPLATE_STRATEGY;
    default:
      return [];
  }
}

/**
 * GuideAgent Class - The conversational AI coordinator
 */
export class GuideAgent {
  private bookType: BookType;
  private strategy: FieldStrategy[];
  private state: GuideConversationState;

  constructor(bookType: BookType, babyName: string) {
    this.bookType = bookType;
    this.strategy = getStrategy(bookType);
    this.state = {
      bookType,
      dataSchema: {},
      fieldsCollected: [],
      currentField: null,
      conversationHistory: [],
      isComplete: false
    };
  }

  /**
   * Get the initial greeting message from the Guide
   */
  getInitialGreeting(babyName: string): GuideMessage {
    const greetings = {
      [BookType.SPECIAL_MOMENT]: `Hi! I'm so excited to help you capture this special moment with ${babyName}! ✨ Let's create something magical together.`,
      [BookType.GROWTH_STORY]: `Hello! I'm here to help you celebrate ${babyName}'s amazing growth journey! 🌱 Let's tell this story together.`,
      [BookType.TRIBUTE_BOOK]: `Hi! What a beautiful idea—creating a tribute book! 💝 Let's celebrate someone special in ${babyName}'s life.`,
      [BookType.SPECIAL_WORLD]: `Hello! Let's explore the wonderful world around ${babyName}! 🏡 I'm excited to bring it to life.`,
      [BookType.GUIDED_TEMPLATE]: `Hi! I'm here to help you create a personalized book with ${babyName}! 📖 Let's make it uniquely yours.`
    };

    const message: GuideMessage = {
      role: 'guide',
      content: greetings[this.bookType],
      timestamp: Date.now()
    };

    this.state.conversationHistory.push(message);
    return message;
  }

  /**
   * Get the next question based on conversation state
   */
  getNextQuestion(): GuideMessage | null {
    // Check if we're done
    const requiredFields = getRequiredFields(this.bookType);
    const allCollected = requiredFields.every(field =>
      this.state.fieldsCollected.includes(field)
    );

    if (allCollected) {
      this.state.isComplete = true;
      const message: GuideMessage = {
        role: 'guide',
        content: "You've shared such wonderful details! I have everything I need to create your story. Let me work my magic! ✨",
        timestamp: Date.now()
      };
      this.state.conversationHistory.push(message);
      return message;
    }

    // Find the next field to collect
    const nextFieldStrategy = this.strategy.find(
      s => !this.state.fieldsCollected.includes(s.field)
    );

    if (!nextFieldStrategy) {
      return null;
    }

    this.state.currentField = nextFieldStrategy.field;

    const message: GuideMessage = {
      role: 'guide',
      content: nextFieldStrategy.initialQuestion,
      timestamp: Date.now(),
      fieldTarget: nextFieldStrategy.field
    };

    this.state.conversationHistory.push(message);
    return message;
  }

  /**
   * Process user's response and extract data
   */
  processUserResponse(userMessage: string): void {
    const message: GuideMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    };

    this.state.conversationHistory.push(message);

    // Extract data for current field
    if (this.state.currentField) {
      const fieldStrategy = this.strategy.find(s => s.field === this.state.currentField);

      if (fieldStrategy?.isArray) {
        // Handle array fields
        const existing = (this.state.dataSchema as any)[this.state.currentField] || [];
        (this.state.dataSchema as any)[this.state.currentField] = [
          ...existing,
          userMessage
        ];
      } else {
        // Handle single value fields
        (this.state.dataSchema as any)[this.state.currentField] = userMessage;
      }

      // Mark field as collected
      if (!this.state.fieldsCollected.includes(this.state.currentField)) {
        this.state.fieldsCollected.push(this.state.currentField);
      }
    }
  }

  /**
   * Get follow-up question for more details on current field
   */
  getFollowUpQuestion(): GuideMessage | null {
    if (!this.state.currentField) return null;

    const fieldStrategy = this.strategy.find(s => s.field === this.state.currentField);
    if (!fieldStrategy || !fieldStrategy.followUpQuestions) return null;

    // Randomly select a follow-up question
    const followUp = fieldStrategy.followUpQuestions[
      Math.floor(Math.random() * fieldStrategy.followUpQuestions.length)
    ];

    const message: GuideMessage = {
      role: 'guide',
      content: followUp,
      timestamp: Date.now(),
      fieldTarget: this.state.currentField
    };

    this.state.conversationHistory.push(message);
    return message;
  }

  /**
   * Get the current state of the conversation
   */
  getState(): GuideConversationState {
    return this.state;
  }

  /**
   * Calculate progress percentage
   */
  getProgressPercentage(): number {
    const requiredFields = getRequiredFields(this.bookType);
    if (requiredFields.length === 0) return 0;

    const collected = this.state.fieldsCollected.filter(f =>
      requiredFields.includes(f)
    ).length;

    return Math.round((collected / requiredFields.length) * 100);
  }

  /**
   * Get a contextual acknowledgment for user input
   */
  getAcknowledgment(): string {
    const acknowledgments = [
      "That's wonderful!",
      "I love that!",
      "That's perfect!",
      "Beautiful!",
      "That's so special!",
      "How lovely!",
      "That's amazing!",
      "Wonderful!"
    ];

    return acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
  }

  /**
   * Determine if we should ask a follow-up or move to next field
   * This creates a natural, adaptive flow
   */
  shouldAskFollowUp(userMessageLength: number): boolean {
    // If user gave a short response, maybe ask for more
    if (userMessageLength < 50) {
      return Math.random() > 0.3; // 70% chance of follow-up
    }

    // If user gave detailed response, move on
    return Math.random() > 0.7; // 30% chance of follow-up
  }
}

/**
 * Helper: Create a new Guide Agent instance
 */
export function createGuideAgent(bookType: BookType, babyName: string): GuideAgent {
  return new GuideAgent(bookType, babyName);
}
