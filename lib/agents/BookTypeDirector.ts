/**
 * BookType Director (3.0 State Manager)
 *
 * Manages conversation state for the 3.0 book creation system.
 * Works with AI to collect structured data based on book type.
 */

import {
  BookType,
  WritingStyle,
  SpecialMomentData,
  GrowthStoryData,
  TributeBookData,
  SpecialWorldData,
  GuidedTemplateData,
  getRequiredFields
} from '@/lib/types/bookTypes3';

// Language name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'it': 'Italian'
};

// Book type descriptions for AI
const BOOK_TYPE_DESCRIPTIONS: Record<BookType, string> = {
  [BookType.SPECIAL_MOMENT]: 'A Special Moment - A single vivid memory or special moment with the baby',
  [BookType.GROWTH_STORY]: 'A Growth Story - A milestone or developmental journey showing growth and progress',
  [BookType.TRIBUTE_BOOK]: 'A Tribute Book - A heartfelt gift celebrating someone special in the baby\'s life',
  [BookType.SPECIAL_WORLD]: 'Our Special World - The baby\'s everyday environment, routines, and familiar places',
  [BookType.GUIDED_TEMPLATE]: 'A Guided Template - A pre-built story template with customizable slots'
};

// Writing style descriptions for AI
const WRITING_STYLE_DESCRIPTIONS: Record<WritingStyle, string> = {
  [WritingStyle.WARM_HEARTFELT]: 'Warm & Heartfelt - Emotional, tender, full of love and connection',
  [WritingStyle.RHYME_RHYTHM]: 'Rhyme & Rhythm - Musical verses with playful rhyming patterns',
  [WritingStyle.FUNNY_PLAYFUL]: 'Funny & Playful - Silly, joyful, full of giggles and fun',
  [WritingStyle.SIMPLE_CLEAR]: 'Simple & Clear - Perfect for youngest readers with simple, direct language'
};

// Field descriptions for each book type (what we want to collect)
const FIELD_SCHEMAS: Record<BookType, { field: string; description: string; type: 'string' | 'array' }[]> = {
  [BookType.SPECIAL_MOMENT]: [
    { field: 'moment_title', description: 'A short title for this special moment', type: 'string' },
    { field: 'when_it_happened', description: 'When this moment took place (date, time of day, or life stage)', type: 'string' },
    { field: 'the_setting', description: 'Where this moment happened (location, environment, atmosphere)', type: 'string' },
    { field: 'what_happened', description: 'The sequence of events - what actually happened (can be multiple parts)', type: 'array' },
    { field: 'sensory_details', description: 'What they saw, heard, smelled, felt during this moment', type: 'string' },
    { field: 'why_special', description: 'Why this moment is worth remembering forever', type: 'string' }
  ],
  [BookType.GROWTH_STORY]: [
    { field: 'milestone_name', description: 'What milestone or journey are we celebrating', type: 'string' },
    { field: 'beginning', description: 'How things were before this journey started - what they could NOT do yet', type: 'string' },
    { field: 'middle_journey', description: 'The practice attempts, small steps, learning process - the journey before success (multiple moments)', type: 'array' },
    { field: 'breakthrough', description: 'THE MOMENT they finally achieved it - the actual first time they did it successfully', type: 'string' },
    { field: 'afterglow', description: 'How things are NOW after achieving this milestone - what changed', type: 'string' }
  ],
  [BookType.TRIBUTE_BOOK]: [
    { field: 'recipient', description: 'Who is this book for (the special person)', type: 'string' },
    { field: 'relationship', description: 'Their relationship with the baby', type: 'string' },
    { field: 'reasons_to_love', description: 'Why they are so special (can be multiple reasons)', type: 'array' },
    { field: 'shared_memory', description: 'A special memory or moment they shared together', type: 'string' },
    { field: 'special_wish', description: 'A message or wish for them', type: 'string' },
    { field: 'their_special_thing', description: 'Something unique about them (talent, tradition, quirk)', type: 'string' }
  ],
  [BookType.SPECIAL_WORLD]: [
    { field: 'world_theme', description: 'What aspect of their world to focus on', type: 'string' },
    { field: 'home_corner', description: 'A favorite spot in the home', type: 'string' },
    { field: 'daily_walk_sights', description: 'Things they see regularly in their world (can be multiple)', type: 'array' },
    { field: 'favorite_sounds', description: 'Sounds that fill their world (can be multiple)', type: 'array' },
    { field: 'cozy_routine', description: 'A daily ritual or cozy routine they share', type: 'string' },
    { field: 'seasonal_moment', description: 'How their world changes with seasons (optional)', type: 'string' }
  ],
  [BookType.GUIDED_TEMPLATE]: [
    { field: 'template_id', description: 'Which template they chose', type: 'string' },
    { field: 'slot_1', description: 'First customizable detail', type: 'string' },
    { field: 'slot_2', description: 'Second customizable detail', type: 'string' },
    { field: 'slot_3', description: 'Third customizable detail', type: 'string' },
    { field: 'custom_details', description: 'Additional personalization', type: 'string' }
  ]
};

export interface ConversationState {
  sessionId: string;
  babyName: string;
  bookType: BookType;
  writingStyle: WritingStyle | null;
  locale: string;
  collectedData: Record<string, any>;
  completedFields: Set<string>;
  conversationHistory: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  isComplete: boolean;
}

export class BookTypeDirector {
  private state: ConversationState;
  private bookType: BookType;
  private fieldSchema: { field: string; description: string; type: 'string' | 'array' }[];

  constructor(
    sessionId: string,
    babyName: string,
    bookType: BookType,
    writingStyle: WritingStyle | null,
    locale: string = 'en'
  ) {
    this.bookType = bookType;
    this.fieldSchema = FIELD_SCHEMAS[bookType];

    this.state = {
      sessionId,
      babyName,
      bookType,
      writingStyle,
      locale,
      collectedData: {},
      completedFields: new Set(),
      conversationHistory: [],
      isComplete: false
    };
  }

  /**
   * Get the system prompt for the AI
   */
  getSystemPrompt(): string {
    const languageName = LANGUAGE_NAMES[this.state.locale] || 'English';
    const bookTypeDesc = BOOK_TYPE_DESCRIPTIONS[this.bookType];
    const styleDesc = this.state.writingStyle
      ? WRITING_STYLE_DESCRIPTIONS[this.state.writingStyle]
      : 'No specific style chosen yet';

    return `You are a warm, enthusiastic assistant helping parents create a personalized children's book about ${this.state.babyName}.

**Book Type:** ${bookTypeDesc}

**Writing Style:** ${styleDesc}

**Your Role:**
1. Have a natural, warm conversation with the parent
2. Guide them to tell the COMPLETE story with all necessary details
3. Listen carefully and ask follow-up questions to get deeper, richer details
4. NEVER finish the conversation until you have the FULL, COMPLETE story
5. Be patient - getting rich details takes time and multiple questions

**Critical Story Requirements by Book Type:**

${this.bookType === BookType.GROWTH_STORY ? `
**Growth Story - Complete Journey Arc:**
- Beginning: What they COULDN'T do yet (before the milestone)
- Middle: The practice, attempts, small wins, struggles (multiple moments)
- Breakthrough: THE MOMENT they finally achieved it (the climax!)
- Afterglow: How things are different NOW

DO NOT finish until you have ALL 4 parts with rich details!
` : ''}

${this.bookType === BookType.SPECIAL_MOMENT ? `
**Special Moment - Complete Memory:**
- When & Where: Specific time and place
- What Happened: FULL sequence of events (not just one thing - the whole story!)
- Sensory Details: What they saw, heard, felt, smelled
- Why Special: Deep emotional significance

DO NOT finish until you have the COMPLETE memory from start to end!
` : ''}

${this.bookType === BookType.TRIBUTE_BOOK ? `
**Tribute Book - Complete Tribute:**
- Who & Relationship: The special person and their bond
- Multiple Reasons: At least 3-4 specific reasons why they're special
- Shared Memory: A complete, vivid memory together
- Special Wish: Heartfelt message for them

DO NOT finish until you have RICH, SPECIFIC details about why they're special!
` : ''}

${this.bookType === BookType.SPECIAL_WORLD ? `
**Special World - Complete World Picture:**
- Theme & Setting: What aspect of their world
- Multiple Sights: At least 3-4 specific things they see regularly
- Multiple Sounds: At least 2-3 sounds that fill their world
- Routines: Specific daily rituals with rich details

DO NOT finish until you have a VIVID, COMPLETE picture of their world!
` : ''}

**DO NOT finish until:**
- You have asked follow-up questions to get deeper details
- Arrays have multiple items (not just one!)
- You have the COMPLETE narrative/story/picture
- The parent confirms they have nothing more to add

**Communication Language:** ${languageName}
- You MUST communicate entirely in ${languageName}
- Keep questions clear and conversational
- Be warm, enthusiastic, and encouraging

**Important:**
- Ask ONE question at a time
- Build naturally on what they've already shared
- Don't repeat information they've already given
- If they give a short answer, ask follow-ups for more details
- Keep asking until you have RICH, VIVID details for each part of the story
- NEVER assume the story is complete - always ask if there's more`;
  }

  /**
   * Get the data extraction prompt
   */
  getExtractionPrompt(userMessage: string): string {
    const fieldDescriptions = this.fieldSchema
      .map(f => `- ${f.field} (${f.type}): ${f.description}`)
      .join('\n');

    const alreadyCollected = Array.from(this.state.completedFields).map(f => `- ${f}`).join('\n') || 'None yet';

    return `Extract structured data from the user's message.

**User's message:**
"${userMessage}"

**Book Type:** ${this.bookType}

**Data Schema (fields to collect):**
${fieldDescriptions}

**Already Collected:**
${alreadyCollected}

**Current Data:**
${JSON.stringify(this.state.collectedData, null, 2)}

**Task:**
Extract any new information from the user's message and return it as JSON.
- Only include fields that have clear values from this message
- For array fields, append new items to existing ones
- Don't make assumptions - only extract what's clearly stated
- Return empty object {} if no extractable data

**Output Format (JSON only):**
{
  "field_name": "extracted value",
  "array_field": ["item1", "item2"]
}`;
  }

  /**
   * Get the next prompt instruction for the AI
   */
  getNextPromptInstruction(): string {
    const missingFields = this.fieldSchema
      .filter(f => !this.state.completedFields.has(f.field))
      .map(f => `- ${f.field}: ${f.description}`)
      .join('\n');

    const collectedSummary = this.fieldSchema
      .filter(f => this.state.completedFields.has(f.field))
      .map(f => {
        const data = this.state.collectedData[f.field];
        const preview = Array.isArray(data)
          ? `[${data.length} items]`
          : typeof data === 'string' && data.length > 50
            ? data.substring(0, 50) + '...'
            : data;
        return `- ${f.field}: ✓ "${preview}"`;
      })
      .join('\n') || 'Nothing collected yet';

    // Special validation based on book type
    if (missingFields.length === 0) {
      // Growth Story: Must have complete journey arc
      if (this.bookType === BookType.GROWTH_STORY) {
        const hasBreakthrough = this.state.collectedData['breakthrough'];
        const hasAfterglow = this.state.collectedData['afterglow'];
        const middleJourney = this.state.collectedData['middle_journey'] as any[];

        if (!hasBreakthrough || !hasAfterglow || !middleJourney || middleJourney.length < 2) {
          return `**CRITICAL:** Growth Story is INCOMPLETE!

**What You Have:**
${collectedSummary}

**MISSING CRITICAL ELEMENTS:**
${!hasBreakthrough ? '❌ breakthrough: The ACTUAL moment they achieved the milestone (THE CLIMAX!)\n' : ''}${!hasAfterglow ? '❌ afterglow: How things are NOW after achieving it\n' : ''}${(!middleJourney || middleJourney.length < 2) ? '❌ middle_journey: Need MORE practice/attempt moments (only have ' + (middleJourney?.length || 0) + ')\n' : ''}
**Your Task:**
The parent hasn't told you the COMPLETE journey yet! Ask about the missing elements.`;
        }
      }

      // Special Moment: Must have complete event sequence
      if (this.bookType === BookType.SPECIAL_MOMENT) {
        const whatHappened = this.state.collectedData['what_happened'] as any[];
        const sensoryDetails = this.state.collectedData['sensory_details'];
        const whySpecial = this.state.collectedData['why_special'];

        if (!whatHappened || whatHappened.length < 2 || !sensoryDetails || !whySpecial) {
          return `**CRITICAL:** Special Moment is INCOMPLETE!

**What You Have:**
${collectedSummary}

**MISSING CRITICAL ELEMENTS:**
${(!whatHappened || whatHappened.length < 2) ? '❌ what_happened: Need the FULL sequence of events (only have ' + (whatHappened?.length || 0) + ')\n' : ''}${!sensoryDetails ? '❌ sensory_details: What did they see, hear, feel, smell?\n' : ''}${!whySpecial ? '❌ why_special: Why is this moment worth remembering?\n' : ''}
**Your Task:**
The parent hasn't told you the COMPLETE moment yet! Ask for more details.`;
        }
      }

      // Tribute Book: Must have multiple reasons and rich details
      if (this.bookType === BookType.TRIBUTE_BOOK) {
        const reasonsToLove = this.state.collectedData['reasons_to_love'] as any[];
        const sharedMemory = this.state.collectedData['shared_memory'];
        const specialWish = this.state.collectedData['special_wish'];

        if (!reasonsToLove || reasonsToLove.length < 3 || !sharedMemory || !specialWish) {
          return `**CRITICAL:** Tribute Book is INCOMPLETE!

**What You Have:**
${collectedSummary}

**MISSING CRITICAL ELEMENTS:**
${(!reasonsToLove || reasonsToLove.length < 3) ? '❌ reasons_to_love: Need at least 3-4 specific reasons (only have ' + (reasonsToLove?.length || 0) + ')\n' : ''}${!sharedMemory ? '❌ shared_memory: Need a complete, vivid shared memory\n' : ''}${!specialWish ? '❌ special_wish: Need a heartfelt message for them\n' : ''}
**Your Task:**
The tribute isn't COMPLETE yet! Ask for more specific reasons and details.`;
        }
      }

      // Special World: Must have multiple sights/sounds and rich details
      if (this.bookType === BookType.SPECIAL_WORLD) {
        const dailyWalkSights = this.state.collectedData['daily_walk_sights'] as any[];
        const favoriteSounds = this.state.collectedData['favorite_sounds'] as any[];
        const cozyRoutine = this.state.collectedData['cozy_routine'];

        if (!dailyWalkSights || dailyWalkSights.length < 3 || !favoriteSounds || favoriteSounds.length < 2 || !cozyRoutine) {
          return `**CRITICAL:** Special World is INCOMPLETE!

**What You Have:**
${collectedSummary}

**MISSING CRITICAL ELEMENTS:**
${(!dailyWalkSights || dailyWalkSights.length < 3) ? '❌ daily_walk_sights: Need at least 3-4 things they see (only have ' + (dailyWalkSights?.length || 0) + ')\n' : ''}${(!favoriteSounds || favoriteSounds.length < 2) ? '❌ favorite_sounds: Need at least 2-3 sounds (only have ' + (favoriteSounds?.length || 0) + ')\n' : ''}${!cozyRoutine ? '❌ cozy_routine: Need details about their daily ritual\n' : ''}
**Your Task:**
The world picture isn't COMPLETE yet! Ask for more specific sights and sounds.`;
        }
      }
    }

    if (missingFields.length === 0) {
      return `**Status:** All information collected!

**Collected:**
${collectedSummary}

**Your Task:**
Give an enthusiastic closing message confirming you have everything needed. Let them know you're ready to create their magical story!`;
    }

    return `**Status:** Conversation in progress

**Collected So Far:**
${collectedSummary}

**Still Need:**
${missingFields}

**Your Task:**
Based on what's been shared, ask the NEXT most natural question to collect missing information.
- Be conversational and build on previous answers
- Ask about ONE thing at a time
- If they're telling a story, let them finish completely before moving on
- Ask follow-ups if their answer feels incomplete
- Make it feel like a natural conversation, not an interview`;
  }

  /**
   * Update collected data and mark fields as complete
   */
  updateCollectedData(extractedData: Record<string, any>): void {
    for (const [field, value] of Object.entries(extractedData)) {
      const fieldDef = this.fieldSchema.find(f => f.field === field);

      if (fieldDef) {
        if (fieldDef.type === 'array') {
          // Append to existing array
          const existing = (this.state.collectedData[field] as any[]) || [];
          const newValues = Array.isArray(value) ? value : [value];
          this.state.collectedData[field] = [...existing, ...newValues];
        } else {
          // Replace single value (only if more detailed)
          const existing = this.state.collectedData[field];
          if (!existing || value.toString().length > existing.toString().length) {
            this.state.collectedData[field] = value;
          }
        }

        // Mark field as collected with stricter validation
        if (fieldDef.type === 'array') {
          const arr = this.state.collectedData[field] as any[];
          // For arrays, need at least 2 items or 1 detailed item (50+ chars)
          if (arr.length >= 2 || (arr.length === 1 && arr[0].length >= 50)) {
            this.state.completedFields.add(field);
          }
        } else {
          const val = this.state.collectedData[field];
          // For strings, need substantial content (minimum 30 characters)
          if (val && val.toString().trim().length >= 30) {
            this.state.completedFields.add(field);
          }
        }
      }
    }

    // Check if we're complete with special validation for Growth Story
    const requiredFields = getRequiredFields(this.bookType);
    const allFieldsMarked = requiredFields.every(f =>
      this.state.completedFields.has(f)
    );

    // Extra validation based on book type
    if (this.bookType === BookType.GROWTH_STORY) {
      // Growth Story: Must have complete journey arc
      const breakthrough = this.state.collectedData['breakthrough'];
      const afterglow = this.state.collectedData['afterglow'];
      const middleJourney = this.state.collectedData['middle_journey'] as any[];

      const hasValidBreakthrough = breakthrough && breakthrough.toString().length >= 50;
      const hasValidAfterglow = afterglow && afterglow.toString().length >= 30;
      const hasEnoughMiddle = middleJourney && middleJourney.length >= 2;

      this.state.isComplete = allFieldsMarked && hasValidBreakthrough && hasValidAfterglow && hasEnoughMiddle;
    } else if (this.bookType === BookType.SPECIAL_MOMENT) {
      // Special Moment: Must have complete event sequence
      const whatHappened = this.state.collectedData['what_happened'] as any[];
      const sensoryDetails = this.state.collectedData['sensory_details'];
      const whySpecial = this.state.collectedData['why_special'];

      const hasCompleteSequence = whatHappened && whatHappened.length >= 2;
      const hasSensory = sensoryDetails && sensoryDetails.toString().length >= 30;
      const hasWhy = whySpecial && whySpecial.toString().length >= 30;

      this.state.isComplete = allFieldsMarked && hasCompleteSequence && hasSensory && hasWhy;
    } else if (this.bookType === BookType.TRIBUTE_BOOK) {
      // Tribute Book: Must have multiple reasons and complete memory
      const reasonsToLove = this.state.collectedData['reasons_to_love'] as any[];
      const sharedMemory = this.state.collectedData['shared_memory'];
      const specialWish = this.state.collectedData['special_wish'];

      const hasEnoughReasons = reasonsToLove && reasonsToLove.length >= 3;
      const hasMemory = sharedMemory && sharedMemory.toString().length >= 50;
      const hasWish = specialWish && specialWish.toString().length >= 30;

      this.state.isComplete = allFieldsMarked && hasEnoughReasons && hasMemory && hasWish;
    } else if (this.bookType === BookType.SPECIAL_WORLD) {
      // Special World: Must have multiple sights/sounds
      const dailyWalkSights = this.state.collectedData['daily_walk_sights'] as any[];
      const favoriteSounds = this.state.collectedData['favorite_sounds'] as any[];
      const cozyRoutine = this.state.collectedData['cozy_routine'];

      const hasEnoughSights = dailyWalkSights && dailyWalkSights.length >= 3;
      const hasEnoughSounds = favoriteSounds && favoriteSounds.length >= 2;
      const hasRoutine = cozyRoutine && cozyRoutine.toString().length >= 30;

      this.state.isComplete = allFieldsMarked && hasEnoughSights && hasEnoughSounds && hasRoutine;
    } else {
      // Guided Template: Standard validation
      this.state.isComplete = allFieldsMarked;
    }
  }

  /**
   * Add message to conversation history (Gemini format)
   */
  addMessage(role: 'user' | 'model', content: string): void {
    this.state.conversationHistory.push({
      role,
      parts: [{ text: content }]
    });
  }

  /**
   * Get conversation history in Gemini format
   */
  getConversationHistory(): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    return this.state.conversationHistory;
  }

  /**
   * Calculate completion percentage
   */
  getCompletionPercentage(): number {
    const requiredFields = getRequiredFields(this.bookType);
    if (requiredFields.length === 0) return 100;

    const completed = Array.from(this.state.completedFields).filter(f =>
      requiredFields.includes(f)
    ).length;

    return Math.round((completed / requiredFields.length) * 100);
  }

  /**
   * Check if conversation is complete
   */
  isComplete(): boolean {
    return this.state.isComplete;
  }

  /**
   * Get final collected data
   */
  getFinalData(): any {
    return this.state.collectedData;
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return this.state;
  }
}
