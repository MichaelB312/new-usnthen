// lib/utils/PromptCompiler.ts - Compiles structured data into AI generation briefs

import {
  BookType,
  WritingStyle,
  StoryGenerationBrief,
  SpecialMomentData,
  GrowthStoryData,
  TributeBookData,
  SpecialWorldData,
  GuidedTemplateData
} from '@/lib/types/bookTypes3';

/**
 * Calculate age group from birthdate
 */
function calculateAgeGroup(birthdate: string): string {
  const birth = new Date(birthdate);
  const now = new Date();
  const ageInMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

  if (ageInMonths < 6) return 'Newborn (0-6 months)';
  if (ageInMonths < 12) return 'Infant (6-12 months)';
  if (ageInMonths < 24) return 'Toddler (1-2 years)';
  if (ageInMonths < 36) return 'Toddler (2-3 years)';
  return 'Preschooler (3+ years)';
}

/**
 * Get writing style instructions
 */
function getWritingStyleInstructions(style: WritingStyle): string {
  switch (style) {
    case WritingStyle.WARM_HEARTFELT:
      return `Write in a warm, heartfelt, and emotional tone. Use tender language full of love and connection. The narrative should feel like a gentle hug, capturing the emotional significance of every moment. Focus on feelings, love, and the deep bonds between characters.`;

    case WritingStyle.RHYME_RHYTHM:
      return `Write in rhyming verse with strong rhythm and musicality. Use AABB or ABAB rhyme schemes. The language should dance and flow like a song. Keep the rhymes natural and avoid forced constructions. Perfect for reading aloud with a playful, bouncing cadence.`;

    case WritingStyle.FUNNY_PLAYFUL:
      return `Write in a funny, playful, and silly tone. Use humor, unexpected moments, and delightful surprises. Include sound effects, playful language, and moments that make children giggle. Keep it light, joyful, and full of fun. Characters can be goofy and situations amusing.`;

    case WritingStyle.SIMPLE_CLEAR:
      return `Write in very simple, clear language perfect for the youngest readers. Use short sentences (5-8 words max). Simple vocabulary. Direct statements. One idea per sentence. "Baby sees cat. Cat is soft. Baby smiles." This style prioritizes clarity and accessibility for beginning language learners.`;

    case WritingStyle.POETIC_DREAMY:
      return `Write in a poetic, dreamy, and lyrical style. Use beautiful imagery, atmospheric language, and a gentle, flowing rhythm. The prose should feel like a lullaby—soft, magical, and almost whispered. Focus on sensory details, metaphors, and creating a dreamlike quality.`;

    default:
      return 'Write naturally and engagingly for young children.';
  }
}

/**
 * Get vocabulary constraints based on age
 */
function getVocabularyConstraints(ageGroup: string): string {
  if (ageGroup.includes('Newborn')) {
    return 'Age 0-1: Use extremely simple, repetitive words. Focus on sensory language.';
  } else if (ageGroup.includes('Infant')) {
    return 'Age 0-2: Use simple, concrete words. Short phrases. Repetition is key.';
  } else if (ageGroup.includes('Toddler')) {
    return 'Age 1-3: Use simple vocabulary with some variety. Short sentences. Introduce simple emotions.';
  } else {
    return 'Age 3+: Use varied vocabulary appropriate for preschoolers. Can introduce some complex emotions and ideas.';
  }
}

/**
 * Compile Brief for Special Moment
 */
function compileSpecialMoment(
  data: SpecialMomentData,
  brief: StoryGenerationBrief
): string {
  return `
# Book Type: A Special Moment

You are creating a children's book that captures a single, vivid, precious memory.

## The Moment
**Title**: ${data.moment_title || 'A Special Day'}
**When**: ${data.when_it_happened || 'A wonderful day'}
**Setting**: ${data.the_setting || 'A special place'}

## What Happened
${Array.isArray(data.what_happened) ? data.what_happened.map((event, i) => `${i + 1}. ${event}`).join('\n') : data.what_happened}

## Sensory Details
${data.sensory_details || 'Use vivid sensory details to bring this moment alive'}

## Why It Matters
${data.why_special}

## Structure Guidelines
- Create 10-12 pages that tell this story chronologically
- Start with setting the scene
- Build through the key moments
- End with the emotional significance
- Use the sensory details to make every page immersive
- Each page should capture a distinct beat of the memory

${getWritingStyleInstructions(brief.writingStyle)}

## Vocabulary & Tone
${brief.constraints.vocab_level}
Baby's name: ${brief.babyProfile.name}
Baby's age: ${brief.babyProfile.age_group}
`.trim();
}

/**
 * Compile Brief for Growth Story
 */
function compileGrowthStory(
  data: GrowthStoryData,
  brief: StoryGenerationBrief
): string {
  return `
# Book Type: A Growth Story (Milestone Journey)

You are creating a children's book that celebrates a developmental milestone or journey.

## The Journey
**Milestone**: ${data.milestone_name || 'An amazing achievement'}
**Helpers**: ${data.helpers || 'With love and support'}

## Story Arc

### Beginning (Pages 1-3)
${data.beginning}

### The Journey (Pages 4-8)
${Array.isArray(data.middle_journey) ? data.middle_journey.map((step, i) => `**Step ${i + 1}**: ${step}`).join('\n') : data.middle_journey}

${data.funny_moments && data.funny_moments.length > 0 ? `
**Funny Moments to Include**:
${data.funny_moments.map((m, i) => `- ${m}`).join('\n')}
` : ''}

### Breakthrough (Pages 9-10)
${data.breakthrough}

### Afterglow (Pages 11-12)
${data.afterglow}

## Structure Guidelines
- Create a clear narrative arc: Before → Journey → Breakthrough → After
- The middle journey should show progression and effort
- Include moments of practice, trying, and learning
- The breakthrough should be dramatic and celebratory
- End on a note of pride and accomplishment

${getWritingStyleInstructions(brief.writingStyle)}

## Vocabulary & Tone
${brief.constraints.vocab_level}
Baby's name: ${brief.babyProfile.name}
Baby's age: ${brief.babyProfile.age_group}
`.trim();
}

/**
 * Compile Brief for Tribute Book
 */
function compileTributeBook(
  data: TributeBookData,
  brief: StoryGenerationBrief
): string {
  return `
# Book Type: A Tribute Book (Gift for Someone Special)

You are creating a children's book as a gift that celebrates a special person in the baby's life.

## The Special Person
**Recipient**: ${data.recipient || 'Someone special'}
**Relationship**: ${data.relationship || 'A loving connection'}
**Their Special Thing**: ${data.their_special_thing || ''}

## Why They're Wonderful
${Array.isArray(data.reasons_to_love) ? data.reasons_to_love.map((reason, i) => `${i + 1}. ${reason}`).join('\n') : data.reasons_to_love}

## A Special Memory Together
${data.shared_memory}

## Message for Them
${data.special_wish}

## Structure Guidelines
- Create 10-12 pages that celebrate this person
- Open with introducing who they are
- Dedicate pages to different reasons they're special
- Include the shared memory as a centerpiece (spread across 2-3 pages)
- Build to the heartfelt message at the end
- Make it feel like a love letter that a child can "give" to this person
- The tone should be appreciative, warm, and full of gratitude

${getWritingStyleInstructions(brief.writingStyle)}

## Vocabulary & Tone
${brief.constraints.vocab_level}
Baby's name: ${brief.babyProfile.name}
Recipient: ${brief.recipient || data.recipient}
This book is designed to be GIVEN to ${data.recipient}, so write it from the baby's perspective expressing love and appreciation.
`.trim();
}

/**
 * Compile Brief for Special World
 */
function compileSpecialWorld(
  data: SpecialWorldData,
  brief: StoryGenerationBrief
): string {
  return `
# Book Type: Our Special World

You are creating a children's book that explores and celebrates the baby's everyday world.

## The World
**Theme**: ${data.world_theme || 'Our wonderful world'}
**Home Corner**: ${data.home_corner || 'A cozy favorite spot'}

## What We See
${Array.isArray(data.daily_walk_sights) ? data.daily_walk_sights.map((sight, i) => `- ${sight}`).join('\n') : data.daily_walk_sights}

## What We Hear
${Array.isArray(data.favorite_sounds) ? data.favorite_sounds.map((sound, i) => `- ${sound}`).join('\n') : data.favorite_sounds || 'The sounds of home'}

## Our Cozy Routine
${data.cozy_routine}

${data.seasonal_moment ? `
## Seasonal Touch
${data.seasonal_moment}
` : ''}

${data.neighborhood_friends && data.neighborhood_friends.length > 0 ? `
## Friends in Our World
${data.neighborhood_friends.map((friend, i) => `- ${friend}`).join('\n')}
` : ''}

## Structure Guidelines
- Create 10-12 pages that explore different aspects of their world
- Start with the home corner
- Move outward to daily sights and sounds
- Include the cozy routine as an anchor
- Create a sense of belonging, safety, and joy
- Make the ordinary feel magical and special
- End with a sense of contentment and home

${getWritingStyleInstructions(brief.writingStyle)}

## Vocabulary & Tone
${brief.constraints.vocab_level}
Baby's name: ${brief.babyProfile.name}
This book should celebrate the beauty in everyday life and make the familiar feel enchanted.
`.trim();
}

/**
 * Compile Brief for Guided Template
 */
function compileGuidedTemplate(
  data: GuidedTemplateData,
  brief: StoryGenerationBrief
): string {
  return `
# Book Type: Guided Template

You are creating a children's book based on a pre-designed template, personalized with the user's details.

## Template
**Template ID**: ${data.template_id || 'custom'}

## Personalization Details
**Detail 1**: ${data.slot_1 || ''}
**Detail 2**: ${data.slot_2 || ''}
**Detail 3**: ${data.slot_3 || ''}
**Detail 4**: ${data.slot_4 || ''}
**Detail 5**: ${data.slot_5 || ''}

## Additional Custom Details
${data.custom_details || 'None provided'}

## Structure Guidelines
- Follow the template structure for "${data.template_id}"
- Weave in the personalized details naturally
- Maintain the template's narrative flow
- Create 10-12 pages following the template pattern

${getWritingStyleInstructions(brief.writingStyle)}

## Vocabulary & Tone
${brief.constraints.vocab_level}
Baby's name: ${brief.babyProfile.name}
`.trim();
}

/**
 * Main Compiler Function
 */
export function compilePromptBrief(
  bookType: BookType,
  writingStyle: WritingStyle,
  babyProfile: {
    baby_name: string;
    birthdate: string;
    gender: 'boy' | 'girl' | 'neutral';
  },
  structuredData: any,
  locale: string,
  recipient?: string
): StoryGenerationBrief & { compiledPrompt: string } {
  // Create the brief object
  const brief: StoryGenerationBrief = {
    bookType,
    writingStyle,
    babyProfile: {
      name: babyProfile.baby_name,
      age_group: calculateAgeGroup(babyProfile.birthdate),
      gender: babyProfile.gender,
      birthdate: babyProfile.birthdate
    },
    structuredData,
    constraints: {
      vocab_level: getVocabularyConstraints(calculateAgeGroup(babyProfile.birthdate)),
      length: '10-12 pages'
    },
    language: locale,
    recipient
  };

  // Compile the appropriate prompt based on book type
  let compiledPrompt = '';

  switch (bookType) {
    case BookType.SPECIAL_MOMENT:
      compiledPrompt = compileSpecialMoment(structuredData as SpecialMomentData, brief);
      break;
    case BookType.GROWTH_STORY:
      compiledPrompt = compileGrowthStory(structuredData as GrowthStoryData, brief);
      break;
    case BookType.TRIBUTE_BOOK:
      compiledPrompt = compileTributeBook(structuredData as TributeBookData, brief);
      break;
    case BookType.SPECIAL_WORLD:
      compiledPrompt = compileSpecialWorld(structuredData as SpecialWorldData, brief);
      break;
    case BookType.GUIDED_TEMPLATE:
      compiledPrompt = compileGuidedTemplate(structuredData as GuidedTemplateData, brief);
      break;
  }

  // Add universal footer
  compiledPrompt += `

---

## Universal Requirements

**Language**: ${locale.toUpperCase()} - Write the ENTIRE story in ${locale === 'en' ? 'English' : locale === 'de' ? 'German' : locale === 'fr' ? 'French' : locale === 'es' ? 'Spanish' : locale === 'pt' ? 'Portuguese' : 'Italian'}.

**Gender**: ${babyProfile.gender === 'boy' ? 'Use he/him pronouns' : babyProfile.gender === 'girl' ? 'Use she/her pronouns' : 'Use they/them pronouns'}

**Output Format**: Return a JSON object with:
\`\`\`json
{
  "title": "The book title",
  "pages": [
    {
      "page_number": 1,
      "narration": "The text for this page",
      "visual_prompt": "Detailed illustration description for AI image generation",
      "illustration_description": "Parent-friendly description of what will appear",
      "scene_type": "opening/action/emotional/climax/resolution",
      "characters_on_page": ["baby", "mom", etc.],
      "layout_template": "full_bleed/text_left/text_right/centered"
    }
  ],
  "metadata": {
    "book_type": "${bookType}",
    "writing_style": "${writingStyle}",
    "emotional_arc": "description of the emotional journey"
  }
}
\`\`\`

**Page Count**: Exactly 10-12 pages

**Illustration Descriptions**: Each page must have:
1. \`narration\`: The text that appears on the page
2. \`visual_prompt\`: Detailed prompt for AI image generation (focus on paper-collage style)
3. \`illustration_description\`: Human-friendly description of what the illustration shows

Make this story magical, emotionally resonant, and perfect for reading aloud to a child. ✨
`.trim();

  return {
    ...brief,
    compiledPrompt
  };
}

/**
 * Helper: Extract prompt string for API call
 */
export function extractPromptString(brief: ReturnType<typeof compilePromptBrief>): string {
  return brief.compiledPrompt;
}
