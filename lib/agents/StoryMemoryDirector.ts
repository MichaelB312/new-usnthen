/**
 * Story Memory Director (Backend State Manager)
 *
 * This is the "Director" - it manages conversation state and tracks which pieces
 * of information have been collected. It doesn't understand natural language itself,
 * it just keeps a checklist and validates data.
 */

export interface RequiredField {
  id: string;
  name: string;
  description: string;
  required: boolean;
  validator?: (value: any) => boolean;
}

export interface ConversationState {
  sessionId: string;
  babyName: string;
  collectedData: Record<string, any>;
  completedFields: Set<string>;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  currentPhase: 'gathering' | 'extraction' | 'complete';
}

export class StoryMemoryDirector {
  // Define required fields (the checklist)
  private requiredFields: RequiredField[] = [
    {
      id: 'event',
      name: 'Event',
      description: 'The special memory or moment',
      required: true,
      validator: (value) => typeof value === 'string' && value.length > 0
    },
    {
      id: 'location',
      name: 'Location',
      description: 'Where the memory took place',
      required: true,
      validator: (value) => typeof value === 'string' && value.length > 0
    },
    {
      id: 'characters',
      name: 'Characters',
      description: 'Who was there (family members)',
      required: true,
      validator: (value) => Array.isArray(value) && value.length > 0
    },
    {
      id: 'story_beginning',
      name: 'Story Beginning',
      description: 'How the moment started',
      required: true,
      validator: (value) => typeof value === 'string' && value.length > 0
    },
    {
      id: 'story_middle',
      name: 'Story Middle',
      description: 'The exciting part in the middle',
      required: true,
      validator: (value) => typeof value === 'string' && value.length > 0
    },
    {
      id: 'story_end',
      name: 'Story End',
      description: 'How the moment ended',
      required: true,
      validator: (value) => typeof value === 'string' && value.length > 0
    },
    {
      id: 'final_confirmation',
      name: 'Final Confirmation',
      description: 'User confirms they are ready or wants to add more',
      required: true,
      validator: (value) => typeof value === 'boolean'
    },
    {
      id: 'sensory_details',
      name: 'Sensory Details',
      description: 'Sounds, smells, feelings from the memory',
      required: false,
      validator: (value) => typeof value === 'string'
    },
    {
      id: 'special_object',
      name: 'Special Object',
      description: 'Any special toy, food, or item',
      required: false,
      validator: (value) => typeof value === 'string'
    },
    {
      id: 'emotional_significance',
      name: 'Emotional Significance',
      description: 'What made the moment special',
      required: false,
      validator: (value) => typeof value === 'string'
    },
    {
      id: 'milestone',
      name: 'Milestone',
      description: 'Whether this was a first time or milestone',
      required: false,
      validator: (value) => typeof value === 'boolean' || typeof value === 'string'
    }
  ];

  private state: ConversationState;

  constructor(sessionId: string, babyName: string) {
    this.state = {
      sessionId,
      babyName,
      collectedData: {},
      completedFields: new Set(),
      conversationHistory: [],
      currentPhase: 'gathering'
    };
  }

  /**
   * Get the system prompt for the Gemini AI
   */
  getSystemPrompt(): string {
    return `You are a warm, friendly Story Wizard helping parents capture precious memories of their baby ${this.state.babyName}.

Your goal is to gather details for a beautiful children's storybook through natural conversation.

CONVERSATION STYLE:
- Be warm, empathetic, and conversational
- Ask questions that feel natural, not like a form
- Combine multiple pieces of information into single thoughtful questions when possible
- Use the baby's name (${this.state.babyName}) naturally in your questions
- Show genuine interest in the parent's memories
- Build on previous answers to create context-aware follow-up questions

REQUIRED INFORMATION TO COLLECT:
${this.requiredFields.filter(f => f.required).map(f => `- ${f.name}: ${f.description}`).join('\n')}

OPTIONAL INFORMATION (gather if naturally fits):
${this.requiredFields.filter(f => !f.required).map(f => `- ${f.name}: ${f.description}`).join('\n')}

ALREADY COLLECTED:
${Array.from(this.state.completedFields).join(', ') || 'None yet'}

STILL NEEDED:
${this.getMissingRequiredFields().map(f => f.name).join(', ') || 'All required fields collected!'}`;
  }

  /**
   * Generate the next conversational prompt based on state
   */
  getNextPromptInstruction(): string {
    const missing = this.getMissingRequiredFields();

    if (missing.length === 0) {
      return `All required information has been collected! Generate a warm closing message thanking the parent and letting them know you have everything needed to create their story.`;
    }

    // Check if we need final confirmation
    const needsConfirmation = missing.length === 1 && missing[0].id === 'final_confirmation';

    if (needsConfirmation) {
      return `All the story details have been collected. Now ask the parent if they're happy with everything or if they'd like to add anything else.

Generate a warm, friendly message that:
- Briefly summarizes what you've captured (the memory, location, who was there, and the story arc)
- Asks if they're ready to create the story OR if they want to add/change anything
- Makes it clear they can add more details if they want

Be conversational and make them feel in control.`;
    }

    const history = this.getConversationSummary();

    return `Based on the conversation so far, generate your next question to naturally gather: ${missing.map(f => f.name).join(', ')}.

Conversation context:
${history}

Instructions:
- Be conversational and warm, not robotic
- If you can ask about multiple pieces in one natural question, do so
- Reference previous answers to show you're listening
- Make questions feel like a natural conversation, not an interrogation
- Use ${this.state.babyName}'s name when appropriate

Generate ONLY the next question/message to send to the parent. Be natural and conversational.`;
  }

  /**
   * Get extraction prompt for structured data
   */
  getExtractionPrompt(userInput: string): string {
    return `Extract structured information from this parent's response about their baby ${this.state.babyName}.

Parent's response: "${userInput}"

Previously collected data:
${JSON.stringify(this.state.collectedData, null, 2)}

Extract and return a JSON object with any of these fields you can identify:
{
  "event": "string (the special memory/moment)",
  "location": "string (where it happened)",
  "characters": ["array of people who were there, e.g., 'Yara', 'Mom', 'Dad'"],
  "story_beginning": "string (how it started)",
  "story_middle": "string (the exciting part)",
  "story_end": "string (how it ended)",
  "sensory_details": "string (sounds, smells, feelings)",
  "special_object": "string (any special item)",
  "emotional_significance": "string (why it was special)",
  "milestone": "boolean or string (was this a first time?)",
  "final_confirmation": "boolean (true if user confirms they're ready/happy, false if they want to add more)"
}

IMPORTANT:
- Always include the baby's name (${this.state.babyName}) in the characters array
- Only include fields you can confidently extract from the input
- Return an empty object {} if nothing can be extracted
- For characters, use proper names or roles (Mom, Dad, Grandma, etc.)
- For final_confirmation: detect phrases like "yes", "ready", "looks good", "that's it" (true) vs "add", "change", "more", "wait" (false)`;
  }

  /**
   * Update state with extracted data
   */
  updateCollectedData(extractedData: Record<string, any>): void {
    for (const [key, value] of Object.entries(extractedData)) {
      const field = this.requiredFields.find(f => f.id === key);

      if (field) {
        // Validate if validator exists
        if (field.validator && !field.validator(value)) {
          console.warn(`Invalid value for ${key}:`, value);
          continue;
        }

        // Update collected data
        this.state.collectedData[key] = value;
        this.state.completedFields.add(key);
      }
    }
  }

  /**
   * Add message to conversation history
   */
  addMessage(role: 'user' | 'assistant', content: string): void {
    this.state.conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });
  }

  /**
   * Check if all required fields are collected
   */
  isComplete(): boolean {
    return this.getMissingRequiredFields().length === 0;
  }

  /**
   * Get missing required fields
   */
  getMissingRequiredFields(): RequiredField[] {
    return this.requiredFields.filter(
      f => f.required && !this.state.completedFields.has(f.id)
    );
  }

  /**
   * Get conversation summary for context
   */
  getConversationSummary(): string {
    if (this.state.conversationHistory.length === 0) {
      return 'No conversation yet - this is the opening message.';
    }

    return this.state.conversationHistory
      .slice(-4) // Last 4 messages for context
      .map(m => `${m.role === 'user' ? 'Parent' : 'Wizard'}: ${m.content}`)
      .join('\n');
  }

  /**
   * Get conversation history for Gemini API
   */
  getConversationHistory(): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    return this.state.conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return { ...this.state };
  }

  /**
   * Get final collected data
   */
  getFinalData(): Record<string, any> {
    return { ...this.state.collectedData };
  }

  /**
   * Get completion percentage
   */
  getCompletionPercentage(): number {
    const required = this.requiredFields.filter(f => f.required);
    const completed = required.filter(f => this.state.completedFields.has(f.id));
    return Math.round((completed.length / required.length) * 100);
  }

  /**
   * Set phase
   */
  setPhase(phase: 'gathering' | 'extraction' | 'complete'): void {
    this.state.currentPhase = phase;
  }
}
