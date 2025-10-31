# Us & Then 3.0: Implementation Guide

## Overview

The **Us & Then 3.0** system represents a complete transformation of the book creation experience, moving from a passive conversational approach to an **active, user-driven design process**. The core philosophy: **"The user designs their book (type and style) first, and then gives us the specific pieces the AI needs to execute that vision."**

## Core Architecture

### 1. Type System (`lib/types/bookTypes3.ts`)

The foundation of 3.0 is a robust type system that defines:

#### **Book Types** (5 total)
- **Special Moment**: A single vivid memory
- **Growth Story**: A milestone or developmental journey
- **Tribute Book**: A gift for someone special
- **Our Special World**: The baby's everyday environment
- **Guided Template**: Pre-built personalized templates

#### **Writing Styles** (4 total)
- **Warm & Heartfelt**: Emotional, tender, full of love
- **Rhyme & Rhythm**: Musical verses with AABB rhyme schemes
- **Funny & Playful**: Silly, joyful, full of giggles
- **Simple & Clear**: Perfect for youngest readers

#### **Structured Data Schemas**

Each book type has its own data schema that the GuideAgent collects:

**Special Moment Data:**
```typescript
{
  moment_title: string;
  when_it_happened: string;
  the_setting: string;
  what_happened: string[]; // Array for sequence
  sensory_details: string;
  emotional_tone: string;
  why_special: string;
}
```

**Growth Story Data:**
```typescript
{
  milestone_name: string;
  beginning: string;
  middle_journey: string[]; // Array for progression
  breakthrough: string;
  afterglow: string;
  helpers: string;
  funny_moments: string[];
}
```

**Tribute Book Data:**
```typescript
{
  recipient: string;
  relationship: string;
  reasons_to_love: string[]; // Array
  shared_memory: string;
  special_wish: string;
  their_special_thing: string;
}
```

**Special World Data:**
```typescript
{
  world_theme: string;
  home_corner: string;
  daily_walk_sights: string[]; // Array
  favorite_sounds: string[]; // Array
  cozy_routine: string;
  seasonal_moment: string;
  neighborhood_friends: string[];
}
```

**Guided Template Data:**
```typescript
{
  template_id: string;
  slot_1: string;
  slot_2: string;
  slot_3: string;
  slot_4: string;
  slot_5: string;
  custom_details: string;
}
```

### 2. State Management (`lib/store/bookStore.ts`)

The Zustand store has been extended with 3.0 fields:

```typescript
interface BookStore {
  // 3.0 Architecture
  bookType: BookType | null;
  writingStyle: WritingStyle | null;
  structuredData: SpecialMomentData | GrowthStoryData | ... | null;
  guideConversationState: GuideConversationState | null;
  recipient: string | null; // For tribute books

  // 3.0 Actions
  setBookType: (bookType: BookType) => void;
  setWritingStyle: (style: WritingStyle) => void;
  setStructuredData: (data: any) => void;
  setGuideConversationState: (state: GuideConversationState | null) => void;
  setRecipient: (recipient: string) => void;
  updateStructuredDataField: (field: string, value: any) => void;

  // ... existing fields
}
```

### 3. GuideAgent System (`lib/agents/GuideAgent.ts`)

The **GuideAgent** is the heart of 3.0 - an adaptive conversational AI that:

1. **Holds natural conversations** with users
2. **Collects structured data** specific to the book type
3. **Tracks progress** and knows what fields are missing
4. **Asks follow-up questions** adaptively
5. **Knows when it's done** (all required fields collected)

#### How it works:

```typescript
// 1. Create a guide for a specific book type
const agent = createGuideAgent(BookType.GROWTH_STORY, 'Yara');

// 2. Get the initial greeting
const greeting = agent.getInitialGreeting('Yara');
// "Hello! I'm here to help you celebrate Yara's amazing growth journey! 🌱"

// 3. Get the first question
const question = agent.getNextQuestion();
// "I'm so excited to tell this growth story! What milestone or journey
//  are we celebrating? For example, 'Learning to walk' or 'Finding their voice.'"

// 4. Process user's response
agent.processUserResponse("She learned to walk!");

// 5. Decide: follow-up or next field?
if (agent.shouldAskFollowUp(message.length)) {
  const followUp = agent.getFollowUpQuestion();
  // "That's such an amazing milestone! Let's capture every part of this journey."
} else {
  const nextQuestion = agent.getNextQuestion();
  // Moves to 'beginning' field
}

// 6. Check completion
if (agent.getState().isComplete) {
  // All required fields collected! Ready to generate.
}

// 7. Track progress
agent.getProgressPercentage(); // 75%
```

#### Field Collection Strategies

Each book type has a conversation strategy that defines:
- **Initial questions** for each field
- **Follow-up questions** for more detail
- **Field dependencies** (collect X before Y)
- **Array handling** (for fields that collect multiple items)

Example strategy for Growth Story:
```typescript
{
  field: 'middle_journey',
  initialQuestion: "Now, let's talk about the middle part—the practice, the little steps, the helpers, or even the funny fails. What happened during this journey?",
  followUpQuestions: [
    "I love that! Were there any other moments or attempts you remember?",
    "That's great! Anything else from this practice time?"
  ],
  isArray: true // Collects multiple items
}
```

### 4. Prompt Compiler (`lib/utils/PromptCompiler.ts`)

The **PromptCompiler** transforms structured data into comprehensive AI generation briefs.

```typescript
const brief = compilePromptBrief(
  BookType.GROWTH_STORY,           // Book type
  WritingStyle.RHYME_RHYTHM,       // Writing style
  babyProfile,                      // Baby's info
  structuredData,                   // Collected data
  'de',                             // Language
  undefined                         // Optional recipient
);

const compiledPrompt = extractPromptString(brief);
```

#### What it does:

1. **Calculates age group** from birthdate
2. **Gets writing style instructions** for AI
3. **Gets vocabulary constraints** based on age
4. **Compiles book-type-specific briefs** with structured data
5. **Adds universal requirements** (language, gender, format)

Example compiled brief (excerpt):

```markdown
# Book Type: A Growth Story (Milestone Journey)

## The Journey
**Milestone**: Learning to walk
**Helpers**: Mom and Dad

## Story Arc

### Beginning (Pages 1-3)
She was just pulling herself up on the window, but she was too scared to let go.

### The Journey (Pages 4-8)
**Step 1**: used her riding toy
**Step 2**: fell on diaper near the dog

### Breakthrough (Pages 9-10)
First steps across the living room

### Afterglow (Pages 11-12)
Now she's so fast and confident

## Poetic Style: Rhyme & Rhythm
Write the entire story in AABB rhyming couplets...

## Language: GERMAN
Write the ENTIRE story in German...
```

### 5. Story Generation API (`app/api/generate-story/route.ts`)

The API now supports **both 3.0 and legacy modes**:

```typescript
// POST /api/generate-story

// Detect mode
const is3_0Request = bookType && writingStyle && structuredData;

if (is3_0Request) {
  // Route to 3.0 handler
  process3_0StoryGeneration(jobId, body);
} else {
  // Route to legacy handler
  processStoryGeneration(jobId, body);
}
```

#### 3.0 Processing:

1. **Compile brief** using PromptCompiler
2. **Call Gemini AI** with compiled prompt
3. **Parse JSON response** with story data
4. **Enhance pages** with camera angles, characters
5. **Generate spread sequences** for layout
6. **Return story** with metadata including book_type and writing_style

### 6. UI Components

#### **BookTypeSelection** (`components/story-wizard/BookTypeSelection.tsx`)

Beautiful card-based selection with:
- Visual gradient backgrounds per type
- Icons and emojis
- Descriptions and example prompts
- Hover effects and animations

#### **WritingStyleSelection** (`components/story-wizard/WritingStyleSelection.tsx`)

Interactive style picker with:
- **Micro-previews**: Short example text showing each style
- Voice icon to emphasize "how it sounds"
- Accent colors per style
- Large, readable cards

#### **Create3Flow** (`components/story-wizard/Create3Flow.tsx`)

The main orchestrator that manages:
1. **Book type selection**
2. **Writing style selection**
3. **Baby profile**
4. **Recipient input** (conditional for tribute books)
5. **Guide chat** with progress indicator
6. **Story generation** with loading state
7. **Story review**

## User Flow

```
1. Landing Page
   ↓
2. "Create Your Book" → BookType Selection
   ↓
3. Pick from 5 book types (cards with descriptions)
   ↓
4. Writing Style Selection
   ↓
5. Pick from 4 styles (with micro-previews)
   ↓
6. Baby Profile
   ↓
7. Enter baby name, birthdate, gender
   ↓
8. [If Tribute Book] Enter recipient name
   ↓
9. Guided Conversation
   ↓
   - AI Guide asks natural questions
   - User responds (text or voice)
   - Progress bar shows completion
   - Guide adapts with follow-ups
   - All required fields collected
   ↓
10. Story Generation
   ↓
   - Brief compiled from structured data
   - AI generates story with specific style
   - Loading screen (30-60 seconds)
   ↓
11. Story Review
   ↓
   - User reads generated story
   - [Future] Toggle writing styles here
   ↓
12. Illustrations → Layout → Order
```

## Key Benefits of 3.0

### 1. **User Empowerment**
Users **design** their book first, setting expectations upfront.

### 2. **Structured Data = Reliable Output**
The AI has clear, structured input → better, more consistent stories.

### 3. **Magical UX with Robust Backend**
Feels like natural conversation, but collects precise data.

### 4. **Style Flexibility**
Users can try different writing styles **without re-entering data**.

### 5. **Layout Mapping**
Book types map to specific visual templates:
- Growth Story → Timeline spreads
- Tribute Book → Moments grid
- Special World → Map spread

### 6. **Multilanguage Support**
Works seamlessly with all 6 languages (en, de, fr, es, pt, it).

## Implementation Status

✅ **Completed:**
- Type definitions and schemas
- State management (bookStore)
- GuideAgent system
- PromptCompiler utility
- API integration (dual-mode)
- UI components (BookType, WritingStyle selections)
- Create3Flow orchestrator
- Test page (`/create3`)

⏳ **Pending:**
- Integration with HybridChatInterface (optional refinement)
- Style toggle feature on review page
- Layout mapping system implementation
- End-to-end testing with all book types

## Testing the 3.0 System

### Access the 3.0 Flow:

Visit: `/en/create3` (or any other locale)

### Test Each Book Type:

1. **Special Moment**: A day at the beach
2. **Growth Story**: Learning to walk
3. **Tribute Book**: Why I love Grandma
4. **Our Special World**: Our neighborhood
5. **Guided Template**: First Birthday

### Test Each Writing Style:

- Try generating the same story with different styles
- Compare "Rhyme & Rhythm" vs "Simple & Clear"
- See how "Warm & Heartfelt" differs from "Funny & Playful"

## Future Enhancements

### Phase 2: Advanced Features

1. **Smart Visual Templates**
   - Auto-select layouts based on book type
   - Special spreads for specific data (timeline, grid, map)

2. **Style Regeneration**
   - One-click style switching on review page
   - Keep all data, just change the voice

3. **AI Refinement**
   - Let users refine specific pages
   - "Make page 3 more playful" → regenerate with note

4. **Template Library**
   - Pre-built templates with customization
   - "First Month", "First Birthday", "Family Tree"

5. **Multi-Book Projects**
   - Save book types and styles as favorites
   - "Create another Growth Story like last time"

## Technical Notes

### Backward Compatibility

The system maintains **full backward compatibility** with the legacy conversation-based approach. The API automatically detects and routes requests appropriately.

### Performance

- GuideAgent runs **client-side** (no API calls during conversation)
- Only generates story once all data is collected
- Typical generation time: **30-60 seconds**

### Data Persistence

All 3.0 fields are persisted in localStorage:
- bookType
- writingStyle
- structuredData
- guideConversationState
- recipient

### Error Handling

- Fallback story if generation fails
- Validation of required fields
- Type-safe throughout

## Code References

| Component | Location | Purpose |
|-----------|----------|---------|
| Type System | `lib/types/bookTypes3.ts` | All TypeScript types |
| Store Updates | `lib/store/bookStore.ts` | State management |
| GuideAgent | `lib/agents/GuideAgent.ts` | Conversation AI |
| PromptCompiler | `lib/utils/PromptCompiler.ts` | Brief generation |
| API Handler | `app/api/generate-story/route.ts` | Story generation |
| BookType UI | `components/story-wizard/BookTypeSelection.tsx` | Type picker |
| Style UI | `components/story-wizard/WritingStyleSelection.tsx` | Style picker |
| Flow Orchestrator | `components/story-wizard/Create3Flow.tsx` | Main flow |
| Test Page | `app/[locale]/create3/page.tsx` | Demo page |

## Conclusion

**Us & Then 3.0** transforms book creation from a passive Q&A into an **active design experience**. Users feel empowered, the AI receives structured data, and the output is more consistent, personalized, and magical.

The system is production-ready for testing and can be activated by directing users to `/create3` instead of `/create`.

---

**Built with ❤️ by Claude Code**
Implementation Date: 2025-10-24
