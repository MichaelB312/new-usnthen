/**
 * Conversation Adapter
 *
 * Converts Gemini hybrid agent conversation data to the format
 * expected by the story generation API
 */

export interface GeminiConversationData {
  event?: string;
  location?: string;
  characters?: string[];
  story_beginning?: string;
  story_middle?: string;
  story_end?: string;
  sensory_details?: string;
  special_object?: string;
  emotional_significance?: string;
  milestone?: boolean | string;
}

export interface LegacyConversationFormat {
  question: string;
  answer: string;
}

/**
 * Convert Gemini agent collected data to legacy conversation format
 * that the story generation API expects
 */
export function convertToLegacyFormat(
  collectedData: GeminiConversationData
): LegacyConversationFormat[] {
  const conversation: LegacyConversationFormat[] = [];

  // Event/Memory
  if (collectedData.event) {
    conversation.push({
      question: 'memory_anchor',
      answer: collectedData.event
    });
  }

  // Location
  if (collectedData.location) {
    conversation.push({
      question: 'location',
      answer: collectedData.location
    });
  }

  // Who was there (characters)
  if (collectedData.characters && collectedData.characters.length > 0) {
    const charactersText = collectedData.characters
      .filter(c => c.toLowerCase() !== 'yara' && c.toLowerCase() !== 'baby')
      .join(', ');

    conversation.push({
      question: 'who_was_there',
      answer: charactersText || 'Just baby'
    });
  }

  // Special object
  if (collectedData.special_object) {
    conversation.push({
      question: 'special_object',
      answer: collectedData.special_object
    });
  }

  // Milestone check
  if (collectedData.milestone !== undefined) {
    const milestoneAnswer = typeof collectedData.milestone === 'boolean'
      ? (collectedData.milestone ? 'Yes, a milestone!' : 'No, just beautiful')
      : collectedData.milestone;

    conversation.push({
      question: 'milestone_check',
      answer: milestoneAnswer
    });

    // If it's a milestone, add detail
    if (collectedData.milestone && typeof collectedData.milestone === 'string') {
      conversation.push({
        question: 'milestone_detail',
        answer: collectedData.milestone
      });
    }
  }

  // Why special (emotional significance)
  if (collectedData.emotional_significance) {
    conversation.push({
      question: 'why_special',
      answer: collectedData.emotional_significance
    });
  }

  // Story beginning
  if (collectedData.story_beginning) {
    conversation.push({
      question: 'story_beginning',
      answer: collectedData.story_beginning
    });
  }

  // Story middle
  if (collectedData.story_middle) {
    conversation.push({
      question: 'story_middle',
      answer: collectedData.story_middle
    });
  }

  // Story end
  if (collectedData.story_end) {
    conversation.push({
      question: 'story_end',
      answer: collectedData.story_end
    });
  }

  // Sensory details
  if (collectedData.sensory_details) {
    conversation.push({
      question: 'sensory_details',
      answer: collectedData.sensory_details
    });
  }

  return conversation;
}

/**
 * Validate that we have minimum required fields for story generation
 */
export function validateConversationData(data: GeminiConversationData): {
  valid: boolean;
  missing: string[];
} {
  const required = ['event', 'location', 'story_beginning', 'story_middle', 'story_end'];
  const missing: string[] = [];

  for (const field of required) {
    if (!data[field as keyof GeminiConversationData]) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}
