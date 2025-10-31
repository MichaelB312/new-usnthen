// lib/types/bookTypes3.ts - Us & Then 3.0 Type Definitions

/**
 * Book Types - The 5 core categories users can choose from
 */
export enum BookType {
  SPECIAL_MOMENT = 'special_moment',
  GROWTH_STORY = 'growth_story',
  TRIBUTE_BOOK = 'tribute_book',
  SPECIAL_WORLD = 'special_world',
  GUIDED_TEMPLATE = 'guided_template'
}

export interface BookTypeInfo {
  id: BookType;
  title: string;
  description: string;
  emoji: string;
  examplePrompt: string;
}

/**
 * Writing Styles - The 4 narrative voices users can choose from
 */
export enum WritingStyle {
  WARM_HEARTFELT = 'warm_heartfelt',
  RHYME_RHYTHM = 'rhyme_rhythm',
  FUNNY_PLAYFUL = 'funny_playful',
  SIMPLE_CLEAR = 'simple_clear'
}

export interface WritingStyleInfo {
  id: WritingStyle;
  title: string;
  description: string;
  microPreview: string; // Short example text showing the style
  emoji: string;
}

/**
 * Structured Data Schemas for Each Book Type
 *
 * These are the data objects the AI Guide will conversationally fill out
 */

// 1. Special Moment - A single vivid memory
export interface SpecialMomentData {
  moment_title?: string; // e.g., "The day at the beach"
  when_it_happened?: string; // Time/date context
  the_setting?: string; // Where it took place
  what_happened?: string[]; // Sequence of events (array for multiple moments)
  sensory_details?: string; // What they saw, heard, felt
  emotional_tone?: string; // The feeling of the moment
  why_special?: string; // Why this moment matters
}

// 2. Growth Story - A milestone or developmental journey
export interface GrowthStoryData {
  milestone_name?: string; // e.g., "Learning to walk"
  beginning?: string; // What it was like before
  middle_journey?: string[]; // The practice, attempts, helpers (array for multiple steps)
  breakthrough?: string; // The big moment when it clicked
  afterglow?: string; // How things are now
  helpers?: string; // Who supported this journey
  funny_moments?: string[]; // Optional: amusing fails or surprises
}

// 3. Tribute Book - A story for someone special
export interface TributeBookData {
  recipient?: string; // Who this book is for (e.g., "Grandma")
  relationship?: string; // Their relationship to baby
  reasons_to_love?: string[]; // Array of reasons/qualities
  shared_memory?: string; // A special moment together
  special_wish?: string; // Message or wish for them
  their_special_thing?: string; // Something unique about them (e.g., "her cookies")
}

// 4. Our Special World - The baby's world
export interface SpecialWorldData {
  world_theme?: string; // e.g., "Our neighborhood", "Our home"
  home_corner?: string; // A favorite spot at home
  daily_walk_sights?: string[]; // Things they see regularly (array)
  favorite_sounds?: string[]; // Sounds in their world
  cozy_routine?: string; // A daily ritual
  seasonal_moment?: string; // Optional: how their world changes with seasons
  neighborhood_friends?: string[]; // Pets, neighbors, etc.
}

// 5. Guided Template - Pre-structured story with customization slots
export interface GuidedTemplateData {
  template_id?: string; // e.g., "first_month", "first_birthday"
  slot_1?: string; // Template-specific customization slot
  slot_2?: string;
  slot_3?: string;
  slot_4?: string;
  slot_5?: string;
  custom_details?: string; // Any additional personalization
}

/**
 * Union type for all structured data schemas
 */
export type StructuredBookData =
  | { type: BookType.SPECIAL_MOMENT; data: SpecialMomentData }
  | { type: BookType.GROWTH_STORY; data: GrowthStoryData }
  | { type: BookType.TRIBUTE_BOOK; data: TributeBookData }
  | { type: BookType.SPECIAL_WORLD; data: SpecialWorldData }
  | { type: BookType.GUIDED_TEMPLATE; data: GuidedTemplateData };

/**
 * Conversation State - Tracks the guide's progress in filling out the schema
 */
export interface GuideConversationState {
  bookType: BookType;
  dataSchema: SpecialMomentData | GrowthStoryData | TributeBookData | SpecialWorldData | GuidedTemplateData;
  fieldsCollected: string[]; // Array of field names that have been filled
  currentField: string | null; // Field currently being collected
  conversationHistory: GuideMessage[];
  isComplete: boolean; // True when all required fields are collected
}

export interface GuideMessage {
  role: 'guide' | 'user';
  content: string;
  timestamp: number;
  fieldTarget?: string; // Which field this message is trying to collect
  extractedData?: Partial<any>; // Data extracted from user's response
}

/**
 * Generation Brief - The compiled data sent to AI for story generation
 */
export interface StoryGenerationBrief {
  bookType: BookType;
  writingStyle: WritingStyle;
  babyProfile: {
    name: string;
    age_group: string; // Calculated from birthdate
    gender: 'boy' | 'girl' | 'neutral';
    birthdate: string;
  };
  structuredData: SpecialMomentData | GrowthStoryData | TributeBookData | SpecialWorldData | GuidedTemplateData;
  constraints: {
    vocab_level: string; // e.g., "Age 0-3"
    rhyme_scheme?: string; // For rhyme style
    length: string; // e.g., "10-12 pages"
  };
  language: string; // ISO locale code
  recipient?: string; // Optional: for tribute books
}

/**
 * Layout Template Mapping - Book types map to specific visual templates
 */
export interface LayoutTemplateMapping {
  bookType: BookType;
  primaryTemplate: string; // Main spread template for this book type
  specialSpreads?: {
    [key: string]: string; // Special template for specific data fields
    // e.g., "middle_journey": "timeline_spread"
    // e.g., "reasons_to_love": "moments_grid"
  };
}

/**
 * Book Type Configurations
 */
export const BOOK_TYPE_CONFIGS: Record<BookType, BookTypeInfo> = {
  [BookType.SPECIAL_MOMENT]: {
    id: BookType.SPECIAL_MOMENT,
    title: 'A Special Moment',
    description: 'Capture a single, vivid memory, like a day at the beach or a magical cuddle.',
    emoji: '✨',
    examplePrompt: 'Tell me about a magical day you want to remember forever...'
  },
  [BookType.GROWTH_STORY]: {
    id: BookType.GROWTH_STORY,
    title: 'A Growth Story',
    description: 'Tell the journey of a first... like learning to walk, the first month, or finding their voice.',
    emoji: '🌱',
    examplePrompt: 'Let\'s capture this amazing milestone together...'
  },
  [BookType.TRIBUTE_BOOK]: {
    id: BookType.TRIBUTE_BOOK,
    title: 'A Tribute Book',
    description: 'A story for someone special, like "Why I Love Grandma" or a book for a new sibling.',
    emoji: '💝',
    examplePrompt: 'Who is this special person in your baby\'s life?'
  },
  [BookType.SPECIAL_WORLD]: {
    id: BookType.SPECIAL_WORLD,
    title: 'Our Special World',
    description: 'A book about your baby\'s world—your home, your neighborhood, daily routines, or favorite seasons.',
    emoji: '🏡',
    examplePrompt: 'Let\'s explore the magical world around your little one...'
  },
  [BookType.GUIDED_TEMPLATE]: {
    id: BookType.GUIDED_TEMPLATE,
    title: 'A Guided Template',
    description: 'Start with a pre-built story you just personalize, like "The First Month With You".',
    emoji: '📖',
    examplePrompt: 'Choose a template and we\'ll personalize it together...'
  }
};

/**
 * Writing Style Configurations
 */
export const WRITING_STYLE_CONFIGS: Record<WritingStyle, WritingStyleInfo> = {
  [WritingStyle.WARM_HEARTFELT]: {
    id: WritingStyle.WARM_HEARTFELT,
    title: 'Warm & Heartfelt',
    description: 'Emotional, tender, and full of love',
    microPreview: 'Yara looked at the world with wonder in her eyes...',
    emoji: '❤️'
  },
  [WritingStyle.RHYME_RHYTHM]: {
    id: WritingStyle.RHYME_RHYTHM,
    title: 'Rhyme & Rhythm',
    description: 'Musical, playful verses that dance',
    microPreview: 'The day was new, the sky was blue, a big new world was waiting for you.',
    emoji: '🎵'
  },
  [WritingStyle.FUNNY_PLAYFUL]: {
    id: WritingStyle.FUNNY_PLAYFUL,
    title: 'Funny & Playful',
    description: 'Silly, joyful, and full of giggles',
    microPreview: 'That silly dog went woof and boing! Yara giggled at the noise.',
    emoji: '😄'
  },
  [WritingStyle.SIMPLE_CLEAR]: {
    id: WritingStyle.SIMPLE_CLEAR,
    title: 'Simple & Clear',
    description: 'Perfect for the youngest readers',
    microPreview: 'Yara sees the cat. The cat is soft. Yara smiles.',
    emoji: '📚'
  }
};

/**
 * Layout Template Mappings
 */
export const LAYOUT_TEMPLATES: Record<BookType, LayoutTemplateMapping> = {
  [BookType.SPECIAL_MOMENT]: {
    bookType: BookType.SPECIAL_MOMENT,
    primaryTemplate: 'immersive_full_bleed',
    specialSpreads: {
      'what_happened': 'sequence_panels',
      'sensory_details': 'detail_focus'
    }
  },
  [BookType.GROWTH_STORY]: {
    bookType: BookType.GROWTH_STORY,
    primaryTemplate: 'narrative_flow',
    specialSpreads: {
      'middle_journey': 'timeline_3panel',
      'breakthrough': 'big_moment_full_bleed'
    }
  },
  [BookType.TRIBUTE_BOOK]: {
    bookType: BookType.TRIBUTE_BOOK,
    primaryTemplate: 'portrait_focus',
    specialSpreads: {
      'reasons_to_love': 'moments_grid',
      'shared_memory': 'immersive_full_bleed'
    }
  },
  [BookType.SPECIAL_WORLD]: {
    bookType: BookType.SPECIAL_WORLD,
    primaryTemplate: 'environment_exploration',
    specialSpreads: {
      'daily_walk_sights': 'map_spread',
      'home_corner': 'cozy_detail'
    }
  },
  [BookType.GUIDED_TEMPLATE]: {
    bookType: BookType.GUIDED_TEMPLATE,
    primaryTemplate: 'template_based', // Will vary by template_id
    specialSpreads: {}
  }
};

/**
 * Helper: Get required fields for a book type
 */
export function getRequiredFields(bookType: BookType): string[] {
  switch (bookType) {
    case BookType.SPECIAL_MOMENT:
      return ['the_setting', 'what_happened', 'why_special'];
    case BookType.GROWTH_STORY:
      return ['milestone_name', 'beginning', 'middle_journey', 'breakthrough'];
    case BookType.TRIBUTE_BOOK:
      return ['recipient', 'relationship', 'reasons_to_love', 'shared_memory'];
    case BookType.SPECIAL_WORLD:
      return ['world_theme', 'home_corner', 'daily_walk_sights', 'cozy_routine'];
    case BookType.GUIDED_TEMPLATE:
      return ['template_id', 'slot_1', 'slot_2', 'slot_3'];
    default:
      return [];
  }
}

/**
 * Helper: Create empty data schema for a book type
 */
export function createEmptyDataSchema(bookType: BookType): any {
  switch (bookType) {
    case BookType.SPECIAL_MOMENT:
      return {} as SpecialMomentData;
    case BookType.GROWTH_STORY:
      return {} as GrowthStoryData;
    case BookType.TRIBUTE_BOOK:
      return {} as TributeBookData;
    case BookType.SPECIAL_WORLD:
      return {} as SpecialWorldData;
    case BookType.GUIDED_TEMPLATE:
      return {} as GuidedTemplateData;
    default:
      return {};
  }
}

/**
 * Helper: Calculate completion percentage
 */
export function calculateCompletionPercentage(
  fieldsCollected: string[],
  requiredFields: string[]
): number {
  if (requiredFields.length === 0) return 0;
  const collected = fieldsCollected.filter(f => requiredFields.includes(f)).length;
  return Math.round((collected / requiredFields.length) * 100);
}
