# Hybrid Agent System Documentation

## Overview

The Hybrid Agent System is a sophisticated conversational AI system that combines backend state management with Google's Gemini AI to create a natural, intelligent story-gathering experience. This replaces the rigid, predefined question tree with a dynamic, context-aware conversation flow.

## Architecture

### The Two-Part System

#### 1. **Backend Director** (`lib/agents/StoryMemoryDirector.ts`)
The "Director" is the state manager and validator. It doesn't understand natural language but maintains a strict checklist of required information.

**Responsibilities:**
- Tracks which pieces of information have been collected
- Validates data structure and completeness
- Manages conversation state and history
- Provides system prompts to guide the AI
- Ensures all required fields are gathered before completion

**Key Features:**
- Maintains a list of required fields (event, location, characters, story arc, etc.)
- Validates each piece of collected data
- Tracks completion percentage
- Generates context-aware prompts for the AI

#### 2. **Gemini AI Brain** (`app/api/story-conversation/route.ts`)
The "Brain" handles the messy, beautiful part of human conversation.

**Responsibilities:**
- Understands unstructured user input
- Generates natural, context-aware questions
- Extracts structured data from free-form responses
- Maintains conversational flow and warmth
- Adapts questions based on previous answers

## How It Works

### Flow Diagram

```
User Input → Gemini Extraction → Director Validation → State Update
                                                              ↓
                                                    Check Completion
                                                              ↓
                                          Incomplete ←→ Generate Next Question
                                                              ↓
                                                           Complete
                                                              ↓
                                                    Convert to Legacy Format
                                                              ↓
                                                      Story Generation
```

### Step-by-Step Process

1. **Conversation Start**
   - User begins chat
   - Director creates initial system prompt
   - Gemini generates warm opening question
   - Question is context-aware and can ask about multiple fields at once

2. **User Response**
   - User provides unstructured input (e.g., "Her first time at the beach with me and her Dad")
   - Frontend sends to `/api/story-conversation` with action: 'continue'

3. **Data Extraction**
   - Gemini receives extraction prompt with user input
   - AI extracts structured JSON from natural language:
     ```json
     {
       "event": "First time at the beach",
       "location": "the beach",
       "characters": ["Yara", "Mom", "Dad"]
     }
     ```

4. **State Update**
   - Director validates extracted data
   - Updates collected data and marks fields as complete
   - Calculates completion percentage

5. **Next Question Generation**
   - If incomplete, Director creates next prompt instruction
   - Gemini generates natural follow-up question
   - Question weaves in previously collected context
   - Shows genuine interest and builds on conversation

6. **Completion**
   - When all required fields are collected
   - Gemini generates warm closing message
   - Data is converted to legacy format for story generation
   - Triggers story creation workflow

## API Endpoints

### POST `/api/story-conversation`

**Actions:**

#### `start` - Initialize Conversation
```typescript
{
  sessionId: string;
  babyName: string;
  action: 'start';
}
```
**Response:**
```typescript
{
  success: true;
  message: "Opening question from Gemini";
  progress: 0;
  isComplete: false;
  collectedFields: [];
}
```

#### `continue` - Process User Input
```typescript
{
  sessionId: string;
  babyName: string;
  userMessage: string;
  action: 'continue';
}
```
**Response:**
```typescript
{
  success: true;
  message: "Next question from Gemini";
  progress: 60;
  isComplete: false;
  extractedData: { /* extracted fields */ };
  collectedFields: ["event", "location", "characters"];
}
```

#### `extract` - Get Final Data
```typescript
{
  sessionId: string;
  babyName: string;
  action: 'extract';
}
```
**Response:**
```typescript
{
  success: true;
  data: { /* all collected data */ };
  isComplete: true;
  collectedFields: [/* all fields */];
}
```

### GET `/api/story-conversation?sessionId=xxx`
Retrieve current session state and progress.

### DELETE `/api/story-conversation?sessionId=xxx`
Clean up a session.

## Frontend Components

### `HybridChatInterface.tsx`

The main UI component that provides:
- Real-time conversation display
- Visual progress indicator with collected fields
- Typing indicators for natural feel
- Smooth animations and transitions
- Session management

**Key Features:**
- Auto-starts conversation on mount
- Shows progress bar with completion percentage
- Displays collected fields as badges
- Converts Gemini data to legacy format on completion
- Handles errors gracefully

## Data Flow & Conversion

### Gemini Format (Collected)
```typescript
{
  event: "First time at the beach";
  location: "the beach";
  characters: ["Yara", "Mom", "Dad"];
  story_beginning: "She saw the waves";
  story_middle: "Scared at first but crawled forward";
  story_end: "Fell asleep happy";
  sensory_details: "Warm sand, sound of waves";
  special_object: "Red bucket";
  emotional_significance: "She was so brave";
  milestone: true;
}
```

### Legacy Format (For Story Generation)
```typescript
[
  { question: 'memory_anchor', answer: 'First time at the beach' },
  { question: 'location', answer: 'the beach' },
  { question: 'who_was_there', answer: 'Mom, Dad' },
  { question: 'special_object', answer: 'Red bucket' },
  { question: 'milestone_check', answer: 'Yes, a milestone!' },
  { question: 'why_special', answer: 'She was so brave' },
  { question: 'story_beginning', answer: 'She saw the waves' },
  { question: 'story_middle', answer: 'Scared at first but crawled forward' },
  { question: 'story_end', answer: 'Fell asleep happy' },
  { question: 'sensory_details', answer: 'Warm sand, sound of waves' }
]
```

## Required Fields

### Mandatory (Must Collect)
- `event` - The special memory or moment
- `location` - Where it happened
- `characters` - Who was there
- `story_beginning` - How it started
- `story_middle` - The exciting part
- `story_end` - How it concluded

### Optional (Nice to Have)
- `sensory_details` - Sounds, smells, feelings
- `special_object` - Any special toy or item
- `emotional_significance` - Why it was special
- `milestone` - First time or milestone indicator

## Feature Flag

The system is controlled via feature flag:

```typescript
// lib/features/flags.ts
export const FEATURE_FLAGS = {
  hybrid_agent: process.env.NEXT_PUBLIC_HYBRID_AGENT === 'true' || true
}
```

**To enable:**
```bash
# .env.local
NEXT_PUBLIC_HYBRID_AGENT=true
```

**To disable (use old question tree):**
```bash
# .env.local
NEXT_PUBLIC_HYBRID_AGENT=false
```

## Advantages Over Old System

### Old System (Question Tree)
- ❌ Rigid, predefined questions
- ❌ No context awareness
- ❌ Repetitive and robotic
- ❌ Can't combine questions intelligently
- ❌ Limited to exact flow sequence
- ❌ No understanding of user input variations

### New System (Hybrid Agent)
- ✅ Dynamic, conversational questions
- ✅ Fully context-aware
- ✅ Natural and warm dialogue
- ✅ Intelligently combines multiple fields into one question
- ✅ Adapts flow based on responses
- ✅ Handles any phrasing or variation
- ✅ Uses powerful AI to understand intent
- ✅ Extracts structured data from free-form input
- ✅ Visual progress tracking
- ✅ Graceful validation and error handling

## Example Conversation

**Old System:**
```
Wizard: What special memory would you like to capture today?
User: Her first time at the beach with me and her Dad
Wizard: Where did this happen?
User: At the beach
Wizard: Who was there with Yara?
User: Me and her Dad
```

**New System:**
```
Wizard: To begin, just tell me about the moment you're thinking of - what happened, where were you, and who was there with little Yara?
User: Her first time at the beach with me and her Dad

[Gemini extracts: event="First time at the beach", location="beach", characters=["Yara", "Mom", "Dad"]]

Wizard: What a precious first! I can picture Yara at the beach with you both. How did this special moment begin - what caught her attention first?
User: She saw the big waves and was scared at first
```

## Environment Variables Required

```bash
# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key

# Feature Flag (optional, defaults to true)
NEXT_PUBLIC_HYBRID_AGENT=true
```

## Session Management

Sessions are stored in-memory on the server:
- Automatic cleanup after 1 hour
- Maximum 100 concurrent sessions
- Can be extended to use Redis for production

## Error Handling

The system includes comprehensive error handling:
- Gemini API failures fallback to generic questions
- JSON parsing errors are caught and logged
- Missing required fields are tracked and requested again
- Network timeouts show friendly messages
- Invalid data is rejected with validation feedback

## Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/create`

3. Fill in baby profile

4. Experience the hybrid agent chat interface

5. Monitor console for extraction results and state updates

## Future Enhancements

- [ ] Redis-based session storage for scalability
- [ ] Multi-language support
- [ ] Voice input integration
- [ ] Photo context analysis (describe uploaded photos)
- [ ] Emotion detection in responses
- [ ] Personalized question styles based on user preferences
- [ ] A/B testing framework for different conversation strategies
- [ ] Analytics on conversation quality and completion rates

## Troubleshooting

### Issue: Questions seem generic
**Solution:** Ensure GEMINI_API_KEY is set correctly and Gemini API has sufficient quota.

### Issue: Data not being extracted
**Solution:** Check browser console for extraction results. The AI might need clearer extraction prompts for edge cases.

### Issue: Conversation doesn't progress
**Solution:** Verify that required fields are being marked as complete in the Director. Check the progress indicator.

### Issue: TypeScript errors
**Solution:** Run `npx tsc --noEmit` to check types. Ensure Gemini SDK types are correctly imported.

## Support

For issues or questions about the Hybrid Agent System:
1. Check this documentation
2. Review console logs for detailed error messages
3. Test with feature flag disabled to compare behaviors
4. Examine session state via GET endpoint

---

**Built with ❤️ using Google Gemini AI and Next.js**
