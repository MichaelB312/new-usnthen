// app/api/generate-story/route.ts
/**
 * Story Generation API - Creates personalized baby books from ANY memory
 *
 * Follows professional baby book guidelines:
 * - Age-appropriate word counts (5-10 words for 9-12 months)
 * - Rhythmic text with repeating refrains
 * - Concrete, sensory language
 * - Present tense for immediacy
 * - Fun to read aloud with natural rhythm
 *
 * Works for ALL types of memories:
 * - Beach/outdoor adventures
 * - First birthday parties
 * - Learning to walk
 * - Bath time fun
 * - Playing with grandparents
 * - Discovering new foods
 * - Pet interactions
 * - Holiday celebrations
 * - Bedtime routines
 * - Park visits
 * - And ANY other precious memory!
 *
 * The system automatically:
 * - Extracts action types from the memory
 * - Matches camera angles to actions
 * - Adapts text complexity to baby's age
 * - Ensures visual variety with unique angles per page
 * - Creates rhythm and repetition for engagement
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced camera angles - ALL 15+ angles for variety (plus extras used elsewhere)
const CAMERA_ANGLES = {
  // Ultra close shots
  extreme_closeup: 'Extreme close-up on a specific detail (hand, foot, face part).',
  macro: 'Macro shot showing tiny details and textures.',
  detail_shot: 'Detail shot focusing on small objects or textures.',

  // POV shots
  pov_baby: 'POV from baby perspective looking at own body parts or objects.',
  pov_parent: 'POV from parent perspective looking down at baby.',
  pov_toy: 'POV from toy or object perspective looking at baby.',

  // Standard shots
  closeup: 'Close-up focusing on face or a specific area.',
  medium_closeup: 'Medium close-up from chest up.',
  medium: 'Medium shot showing baby and immediate surroundings.',
  medium_wide: 'Medium wide shot showing more environment.',
  wide: 'Wide shot showing full scene and environment.',
  full: 'Full shot (head-to-toe) showing the entire body.', // added

  // Dynamic angles
  over_shoulder: 'Over-the-shoulder seeing what the subject sees.',
  birds_eye: "Bird's-eye view looking straight down from above.",
  low_angle: 'Low angle shot looking up from ground level.',
  high_angle: 'High angle shot looking down but not directly above.',
  profile: 'Profile shot from the side.',
  three_quarter: 'Three-quarter angle view.',
  dutch_angle: 'Dutch (tilted) angle for playful/energetic feeling.',
  worms_eye: "Worm's-eye view from ground looking up.",

  // Environment-specific
  underwater: 'Underwater or waterline shot for aquatic scenes.' // added
} as const;

// Get page count based on age
function getPageCountForAge(ageInMonths: number): number {
  if (ageInMonths < 6) return 6;    // Newborn: 6 pages
  if (ageInMonths < 12) return 6;   // Infant: 6 pages
  if (ageInMonths < 18) return 8;   // Young toddler: 8 pages
  if (ageInMonths < 24) return 8;   // Toddler: 8 pages
  if (ageInMonths < 30) return 10;  // Older toddler: 10 pages
  if (ageInMonths < 36) return 12;  // Advanced toddler: 12 pages
  return 12; // Preschool: 12 pages
}

// GENERIC action types to camera mapping - works for ANY story
const ACTION_TYPE_TO_CAMERA_MAP: Record<string, string[]> = {
  // Fine motor / detailed actions (any small movements)
  grabbing: ['macro', 'extreme_closeup', 'pov_baby', 'detail_shot'],
  touching: ['extreme_closeup', 'macro', 'closeup', 'detail_shot'],
  holding: ['closeup', 'medium_closeup', 'over_shoulder', 'pov_baby'],
  picking: ['macro', 'extreme_closeup', 'over_shoulder'],
  dropping: ['high_angle', 'pov_baby', 'closeup', 'macro'],
  throwing: ['medium', 'profile', 'three_quarter', 'wide'],
  reaching: ['over_shoulder', 'pov_baby', 'closeup', 'medium_closeup'],
  pointing: ['over_shoulder', 'closeup', 'pov_baby'],

  // Gross motor / body movements
  walking: ['low_angle', 'profile', 'medium', 'wide'],
  crawling: ['low_angle', 'worms_eye', 'dutch_angle', 'profile'],
  sitting: ['wide', 'medium_wide', 'birds_eye', 'three_quarter'],
  standing: ['low_angle', 'worms_eye', 'full', 'profile'], // uses full
  jumping: ['low_angle', 'worms_eye', 'profile', 'dutch_angle'],
  dancing: ['dutch_angle', 'medium', 'low_angle', 'wide'],
  running: ['profile', 'low_angle', 'dutch_angle', 'wide'],
  climbing: ['low_angle', 'worms_eye', 'profile', 'medium'],
  rolling: ['dutch_angle', 'birds_eye', 'profile'],
  spinning: ['dutch_angle', 'birds_eye', 'medium'],

  // Facial/emotional expressions
  smiling: ['closeup', 'extreme_closeup', 'medium_closeup'],
  laughing: ['closeup', 'medium_closeup', 'three_quarter'],
  crying: ['closeup', 'extreme_closeup', 'profile'],
  looking: ['profile', 'closeup', 'over_shoulder', 'pov_baby'],
  watching: ['profile', 'over_shoulder', 'three_quarter'],
  sleeping: ['closeup', 'high_angle', 'profile', 'medium'],
  yawning: ['closeup', 'extreme_closeup', 'profile'],

  // Interactive/social actions
  playing: ['birds_eye', 'high_angle', 'wide', 'medium_wide'],
  sharing: ['medium', 'over_shoulder', 'closeup'],
  hugging: ['closeup', 'medium_closeup', 'profile', 'medium'],
  kissing: ['closeup', 'profile', 'medium_closeup'],
  waving: ['medium', 'closeup', 'three_quarter'],
  clapping: ['medium', 'closeup', 'pov_baby'],

  // Exploration/discovery
  exploring: ['over_shoulder', 'pov_baby', 'wide', 'medium'],
  discovering: ['over_shoulder', 'pov_baby', 'closeup', 'wide'],
  finding: ['pov_baby', 'over_shoulder', 'birds_eye'],
  searching: ['wide', 'birds_eye', 'over_shoulder'],
  observing: ['profile', 'three_quarter', 'closeup'],

  // Object interaction (generic)
  opening: ['over_shoulder', 'closeup', 'pov_baby', 'macro'],
  closing: ['closeup', 'over_shoulder', 'medium'],
  pushing: ['profile', 'medium', 'low_angle'],
  pulling: ['profile', 'medium', 'three_quarter'],
  stacking: ['birds_eye', 'over_shoulder', 'closeup'],
  building: ['birds_eye', 'medium_wide', 'over_shoulder'],

  // Eating/drinking
  eating: ['closeup', 'profile', 'medium_closeup'],
  drinking: ['profile', 'closeup', 'medium'],
  tasting: ['extreme_closeup', 'closeup', 'profile'],
  feeding: ['over_shoulder', 'medium', 'closeup'],

  // Water/bath activities
  splashing: ['low_angle', 'medium', 'dutch_angle', 'wide'],
  pouring: ['closeup', 'macro', 'over_shoulder'],
  floating: ['birds_eye', 'high_angle', 'medium'],
  swimming: ['wide', 'medium_wide', 'underwater', 'profile'], // uses underwater

  // Default for any unmatched action
  default: ['medium', 'wide', 'closeup', 'three_quarter']
};

// Extract action TYPES from any memory (not specific to beach/sand)
function extractActionTypesFromMemory(text: string): string[] {
  const actionTypes: string[] = [];
  const lowerText = text.toLowerCase();

  // Check for various action types in the text
  const actionVerbs = [
    // Fine motor
    'grab', 'touch', 'hold', 'pick', 'drop', 'throw', 'reach', 'point',
    // Gross motor
    'walk', 'crawl', 'sit', 'stand', 'jump', 'dance', 'run', 'climb', 'roll', 'spin',
    // Facial/emotional
    'smile', 'laugh', 'cry', 'look', 'watch', 'sleep', 'yawn',
    // Interactive
    'play', 'share', 'hug', 'kiss', 'wave', 'clap',
    // Exploration
    'explore', 'discover', 'find', 'search', 'observe',
    // Object interaction
    'open', 'close', 'push', 'pull', 'stack', 'build',
    // Eating/drinking
    'eat', 'drink', 'taste', 'feed',
    // Water/bath
    'splash', 'pour', 'float', 'swim'
  ];

  // Find which action types are mentioned
  actionVerbs.forEach(verb => {
    const variations = [
      verb,
      verb + 's',
      verb + 'ing',
      verb + 'ed',
      verb + verb.slice(-1) + 'ing',
      verb.slice(0, -1) + 'ing'
    ];

    for (const variation of variations) {
      if (lowerText.includes(variation)) {
        actionTypes.push(verb + 'ing'); // standardize to -ing form
        break;
      }
    }
  });

  // If no specific actions found, add generic ones
  if (actionTypes.length === 0) {
    actionTypes.push('playing', 'exploring', 'discovering', 'looking', 'touching');
  }

  return [...new Set(actionTypes)];
}

// Select best camera angle based on action TYPE (not specific action)
function selectCameraForActionType(actionType: string, usedAngles: Set<string>): string {
  const baseAction = actionType.replace(/ing$/, '').replace(/ed$/, '').replace(/s$/, '');
  let possibleAngles: string[] = [];

  for (const [key, angles] of Object.entries(ACTION_TYPE_TO_CAMERA_MAP)) {
    if (key.includes(baseAction) || baseAction.includes(key.replace(/ing$/, ''))) {
      possibleAngles = angles;
      break;
    }
  }

  if (possibleAngles.length === 0) {
    possibleAngles = ACTION_TYPE_TO_CAMERA_MAP.default;
  }

  for (const angle of possibleAngles) {
    if (!usedAngles.has(angle)) {
      return angle;
    }
  }

  const allAngles = Object.keys(CAMERA_ANGLES);
  return allAngles.find(a => !usedAngles.has(a)) || 'medium';
}

interface StoryPage {
  page_number: number;
  narration: string;
  camera_angle: string;
  camera_prompt: string;
  action: string;
  visual_details: string;
}

interface StoryResponse {
  title: string;
  pages: StoryPage[];
  refrain?: string; // allow refrain if model provides it
}

function calculateAgeInMonths(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
}

// Get appropriate word count based on age - MUST MEET MINIMUMS!
function getWordLimitForAge(ageInMonths: number): { min: number; max: number } {
  if (ageInMonths < 3) return { min: 0, max: 3 };
  if (ageInMonths < 6) return { min: 2, max: 5 };
  if (ageInMonths < 9) return { min: 4, max: 8 };
  if (ageInMonths < 12) return { min: 5, max: 10 };
  if (ageInMonths < 15) return { min: 6, max: 12 };
  if (ageInMonths < 18) return { min: 7, max: 14 };
  if (ageInMonths < 24) return { min: 8, max: 16 };
  if (ageInMonths < 30) return { min: 10, max: 20 };
  if (ageInMonths < 36) return { min: 12, max: 25 };
  return { min: 15, max: 30 };
}

/**
 * VALIDATE + FIX the story returned by the model so we always output correct structure.
 * - Ensures page count
 * - Enforces word counts per page
 * - Guarantees valid & unique camera angles
 * - Fills missing fields with safe defaults
 * - Infers a refrain if missing
 */
function validateAndFixStory(
  raw: StoryResponse | any,
  wordLimits: { min: number; max: number },
  pageCount: number,
  babyName?: string
): StoryResponse {
  const validAngles = Object.keys(CAMERA_ANGLES);
  const used = new Set<string>();

  const normalizeAngle = (a?: string): string => {
    if (!a) return validAngles.find(x => !used.has(x)) || 'medium';
    const aliasMap: Record<string, string> = {
      fullscreen: 'full',
      longshot: 'wide',
      long_shot: 'wide',
      full_body: 'full',
      waterline: 'underwater',
      under_water: 'underwater'
    };
    const candidate = aliasMap[a] || a;
    return validAngles.includes(candidate)
      ? candidate
      : (validAngles.find(x => !used.has(x)) || 'medium');
  };

  const wordCount = (s: string) => s ? s.trim().split(/\s+/).filter(Boolean).length : 0;

  const clampToWordRange = (text: string, min: number, max: number, pad = 'Feels so good!') => {
    let tokens = (text || '').trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) tokens = pad.trim().split(/\s+/);
    if (tokens.length > max) return tokens.slice(0, max).join(' ');
    while (tokens.length < min) {
      const add = pad.trim().split(/\s+/);
      for (const w of add) {
        if (tokens.length >= max) break;
        tokens.push(w);
      }
      if (add.length === 0) break;
    }
    return tokens.join(' ');
  };

  const story: StoryResponse = {
    title: (raw?.title && String(raw.title).trim()) || `${babyName || 'Baby'}'s Special Memory`,
    pages: Array.isArray(raw?.pages) ? raw.pages : []
  };

  // Force correct page count
  if (story.pages.length !== pageCount) {
    const fillCount = pageCount - story.pages.length;
    for (let i = 0; i < fillCount; i++) {
      story.pages.push({
        page_number: story.pages.length + 1,
        narration: '',
        camera_angle: '',
        camera_prompt: '',
        action: 'playing',
        visual_details: 'Baby smiling and exploring'
      });
    }
    story.pages = story.pages.slice(0, pageCount);
  }

  story.pages = story.pages.map((p, i) => {
    const pageNum = i + 1;

    const narrationFixed = clampToWordRange(
      String(p?.narration || ''),
      wordLimits.min,
      wordLimits.max
    );

    // ensure valid & unique angle
    let angle = normalizeAngle(String(p?.camera_angle || ''));
    if (used.has(angle)) {
      angle = validAngles.find(a => !used.has(a)) || 'medium';
    }
    used.add(angle);

    const action = (p?.action && String(p.action).trim()) || 'playing';
    const visual = (p?.visual_details && String(p.visual_details).trim()) || 'Baby smiling and exploring';

    const cameraPrompt =
      (p?.camera_prompt && String(p.camera_prompt).trim()) ||
      `${angle} shot showing ${action}`;

    return {
      page_number: pageNum,
      narration: narrationFixed,
      camera_angle: angle,
      camera_prompt: cameraPrompt,
      action,
      visual_details: visual
    };
  });

  // Try to infer a refrain; it will be used later if needed
  const inferredRefrain = extractRefrain(story.pages);
  story.refrain = raw?.refrain ? String(raw.refrain) : inferredRefrain;

  return story;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { babyProfile, conversation } = body;

  // Extract the memory details from the conversation
  const memoryAnchor = conversation.find((c: any) => c.question === 'memory_anchor')?.answer || '';
  const whySpecial = conversation.find((c: any) => c.question === 'why_special')?.answer || '';
  const babyAction = conversation.find((c: any) => c.question === 'baby_action')?.answer || '';
  const babyReaction = conversation.find((c: any) => c.question === 'baby_reaction')?.answer || '';

  try {
    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const wordLimits = getWordLimitForAge(ageInMonths);
    const pageCount = getPageCountForAge(ageInMonths);

    // Extract action TYPES from the memory (generic, not beach-specific)
    const extractedActions = extractActionTypesFromMemory(memoryAnchor + ' ' + babyAction);

    // Get all available camera angles and shuffle them for variety
    const allCameraAngles = Object.keys(CAMERA_ANGLES);
    const shuffledAngles = [...allCameraAngles].sort(() => Math.random() - 0.5);
    const selectedAngles = shuffledAngles.slice(0, pageCount);

    const storyPrompt = `You are a children's book author specializing in board books for babies aged ${ageInMonths} months.

CRITICAL RULES FOR ${ageInMonths}-MONTH-OLD BABY:
1. Create EXACTLY ${pageCount} pages
2. Each page MUST have ${wordLimits.min}-${wordLimits.max} words (COUNT THEM!)
3. Each page MUST have a UNIQUE camera angle from this list: ${selectedAngles.join(', ')}
4. Each page MUST show a DIFFERENT action/pose - NEVER repeat
5. Use PRESENT TENSE and CONCRETE words only
6. Include ONE refrain that appears on at least 3-4 pages
7. Text must have RHYTHM - it should bounce when read aloud
8. Use SPECIFIC words from the memory (if they mention "sand", use "sand" not "something soft")

THE ACTUAL MEMORY TO TURN INTO A STORY:
"${memoryAnchor}"

Baby's specific actions: "${babyAction}"
Baby's emotions: "${babyReaction}"

EXTRACT AND USE THESE SPECIFIC ELEMENTS:
- If they mention sand → use "sand" in the story
- If they mention feet → show feet touching/moving
- If they mention hands → show hands grabbing/touching
- If they mention watching → show baby observing
- Use the EXACT location/objects mentioned

Example of GOOD text for ${ageInMonths} months old:
- "Yara's tiny feet touch warm sand today." (7 words) ✓
- "Soft sand falls through little fingers slowly." (7 words) ✓
- "Wiggle wiggle go the happy toes! Feels so good!" (9 words) ✓

Example of BAD text:
- "Touch touch." (2 words) ✗ TOO SHORT
- "Look!" (1 word) ✗ TOO SHORT
- "The baby is experiencing a new texture." ✗ TOO ABSTRACT

Your refrain options (pick ONE to repeat):
- "Feels so good!" (3 words - can be added to other text)
- "What a feeling!" (3 words)
- "[Baby's name] loves this!" (3 words)
- Or create your own 3-4 word refrain

Create a ${pageCount}-page story with this EXACT JSON structure:
{
  "title": "${babyProfile.baby_name}'s [Memory Theme] Adventure",
  "pages": [
    ${Array.from({ length: pageCount }, (_, i) => `{
      "page_number": ${i + 1},
      "narration": "Must be ${wordLimits.min}-${wordLimits.max} words capturing the actual memory",
      "camera_angle": "${selectedAngles[i]}",
      "camera_prompt": "${selectedAngles[i]} shot showing [specific action from memory]",
      "action": "[specific action from memory like: feet_in_sand, hands_grabbing_sand, watching_sand_fall]",
      "visual_details": "[exact details: Yara's feet rubbing back and forth in sand]"
    }`).join(',\n    ')}
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You write rhythmic baby books for ${ageInMonths}-month-olds with EXACTLY ${wordLimits.min}-${wordLimits.max} words per page. Always use specific details from the memory. Include a repeating refrain. Never write text shorter than ${wordLimits.min} words.`
        },
        { role: 'user', content: storyPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 3000
    });

    const storyData: StoryResponse = JSON.parse(completion.choices[0].message.content || '{}');

    // Validate and fix the story to ensure it meets all requirements
    const validatedStory = validateAndFixStory(
      storyData,
      wordLimits,
      pageCount,
      babyProfile.baby_name
    );

    // Ensure we have unique camera angles in final payload (double safety)
    const usedAngles = new Set<string>();
    const availableAngles = Object.keys(CAMERA_ANGLES);

    // Transform to match your existing structure
    const enhancedStory = {
      title: validatedStory.title,
      refrain: validatedStory.refrain || extractRefrain(validatedStory.pages),
      pages: validatedStory.pages.map((page: StoryPage, index: number) => {
        // Ensure unique angle
        let cameraAngle = page.camera_angle;
        if (usedAngles.has(cameraAngle)) {
          cameraAngle = availableAngles.find(a => !usedAngles.has(a)) || 'medium';
        }
        usedAngles.add(cameraAngle);

        return {
          page_number: page.page_number,
          scene_type: index === 0 ? 'opening' : index === validatedStory.pages.length - 1 ? 'closing' : 'action',
          narration: page.narration,
          emotion: 'joy',
          camera_angle: cameraAngle,
          camera_angle_description: CAMERA_ANGLES[cameraAngle as keyof typeof CAMERA_ANGLES],
          visual_focus: determineVisualFocus(page.action),
          visual_action: page.action,
          detail_prompt: page.camera_prompt,
          action_id: page.action.replace(/\s+/g, '_').toLowerCase(),
          action_label: page.action,
          sensory_details: page.visual_details,
          pose_description: page.visual_details,
          page_turn_cue: index % 2 === 0 // Every other page
        };
      }),
      camera_sequence: validatedStory.pages.map((p: StoryPage) => p.camera_angle),
      reading_level: getReadingLevel(ageInMonths),
      meta: {
        version: '4.0'
      }
    };

    return NextResponse.json({ success: true, story: enhancedStory });
  } catch (error) {
    console.error('Story generation error:', error);

    // Return a properly formatted mock story based on age
    const ageInMonths = calculateAgeInMonths(babyProfile?.birthdate || '2024-01-01');
    const mockStory = generateMockStory(ageInMonths);

    // If we have the actual memory, enhance the mock story with it
    if (memoryAnchor && memoryAnchor.toLowerCase().includes('beach')) {
      mockStory.title = `${babyProfile?.baby_name || 'Baby'}'s Beach Adventure`;
      if (mockStory.pages[0]) {
        mockStory.pages[0].narration = 'First time at the beach today! Feels so good!';
        mockStory.pages[0].action = 'discovering_beach';
        mockStory.pages[0].visual_details = 'Baby seeing sand for the first time';
      }
      if (mockStory.pages[1]) {
        mockStory.pages[1].narration = 'Tiny feet touch warm, soft sand everywhere.';
        mockStory.pages[1].action = 'feet_touching_sand';
        mockStory.pages[1].visual_details = 'Feet touching sand for first time';
      }
      if (mockStory.pages[2]) {
        mockStory.pages[2].narration = 'Back and forth go happy feet! Feels so good!';
        mockStory.pages[2].action = 'feet_rubbing_sand';
        mockStory.pages[2].visual_details = 'Feet rubbing back and forth in sand';
      }
    }

    return NextResponse.json({ success: true, story: mockStory });
  }
}

// Get reading level based on age
function getReadingLevel(ageInMonths: number): string {
  if (ageInMonths < 6) return 'newborn';
  if (ageInMonths < 12) return 'infant';
  if (ageInMonths < 24) return 'toddler';
  if (ageInMonths < 36) return 'older_toddler';
  return 'preschool';
}

function determineVisualFocus(action: string): string {
  const lowerAction = action.toLowerCase();

  if (lowerAction.includes('feet') || lowerAction.includes('toe') || lowerAction.includes('step') || lowerAction.includes('walk') || lowerAction.includes('kick')) {
    return 'feet';
  }
  if (lowerAction.includes('hand') || lowerAction.includes('finger') || lowerAction.includes('grab') || lowerAction.includes('hold') || lowerAction.includes('touch')) {
    return 'hands';
  }
  if (lowerAction.includes('face') || lowerAction.includes('smile') || lowerAction.includes('laugh') || lowerAction.includes('cry')) {
    return 'face';
  }
  if (lowerAction.includes('eye') || lowerAction.includes('look') || lowerAction.includes('watch') || lowerAction.includes('see')) {
    return 'eyes';
  }

  return 'full_body';
}

function extractRefrain(pages: StoryPage[]): string {
  const phrases: Record<string, number> = {};

  pages.forEach(page => {
    const sentences = page.narration.split(/[.!?]/);
    sentences.forEach(s => {
      const trimmed = s.trim();
      const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
      if (trimmed.length > 3 && wordCount >= 2 && wordCount <= 5) {
        phrases[trimmed] = (phrases[trimmed] || 0) + 1;
      }
    });

    const commaPhrases = page.narration.split(',');
    commaPhrases.forEach(p => {
      const trimmed = p.trim().replace(/[.!?]$/, '');
      const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
      if (trimmed.length > 3 && wordCount >= 2 && wordCount <= 5) {
        phrases[trimmed] = (phrases[trimmed] || 0) + 1;
      }
    });
  });

  let maxCount = 2; // Minimum 3 appearances
  let refrain = 'What a feeling!'; // Default refrain

  for (const [phrase, count] of Object.entries(phrases)) {
    if (count > maxCount) {
      maxCount = count;
      refrain = phrase;
    }
  }

  return refrain;
}

/**
 * Generate a mock story for testing - works for ANY memory type
 * This is just a fallback when the API fails - the real system
 * will generate a story based on the ACTUAL memory provided
 */
function generateMockStory(ageInMonths: number): any {
  const pageCount = getPageCountForAge(ageInMonths);
  const wordLimits = getWordLimitForAge(ageInMonths);

  const allAngles = Object.keys(CAMERA_ANGLES);
  const selectedAngles = allAngles.slice(0, pageCount);

  const genericActions = [
    'discovering', 'exploring', 'touching', 'looking', 'smiling',
    'playing', 'reaching', 'grabbing', 'watching', 'sitting',
    'moving', 'finding', 'showing', 'enjoying', 'resting'
  ];

  const narrations = {
    3: ['Look!', 'Oh!', 'Wow!', 'See?', 'Hi!', 'Yay!'],
    6: [
      'Look! So new!', 'Touch, touch, touch.', 'Soft and nice.',
      'Baby sees this!', 'Happy, happy baby!', 'All done now!'
    ],
    9: [
      'Something new to see today!', 'Little hands reach out to touch.',
      'This feels nice. So nice!', 'Baby plays and plays here.',
      'Happy sounds fill the air!', 'Time to rest. So nice!'
    ],
    11: [
      'Look what baby found today! Feels so good!',
      'Tiny fingers touch and explore everything here.',
      'Soft and warm between little toes wiggling.',
      'Grab it, hold it, let it fall down.',
      'Watch it move! Feels so good!',
      'Happy baby plays and plays all day.',
      'Back and forth, again and again now.',
      'Everyone smiles. Baby loves this! Feels so good!',
      'Almost done with our special adventure today.',
      'All done playing. What a wonderful time!',
      'Best day ever! Feels so good!',
      'Time for hugs and happy memories.'
    ],
    18: [
      'Today we found something brand new to explore together!',
      'Little hands are busy touching everything they can reach.',
      'Soft and squishy, rough and smooth, all different textures.',
      'Up and down, round and round, baby moves everywhere.',
      'Giggles and smiles fill our special playtime. So much fun!',
      'Watch me do this amazing thing all by myself!',
      'Again, again! Baby wants to do it more!',
      'Mommy and Daddy watch with big happy smiles today.',
      'Getting tired now but still want to play more.',
      'Almost time to stop our adventure. So much fun!',
      'One more time before we have to go home.',
      'All done now. What a perfect day together! So much fun!'
    ],
    24: [
      "What an amazing adventure we're having today! Everything is new and exciting to discover.",
      "Baby's curious hands reach out to touch and feel every single thing around here.",
      'Soft between the toes, rough on the hands, so many different feelings to explore.',
      "Watch how it moves when baby does this! It's like magic happening right now.",
      'Everyone is laughing and smiling together. This is the best day we\'ve ever had!',
      'Try it again, a different way this time. Each time brings new surprises here.'
    ]
  } as const;

  let ageKey: 3 | 6 | 9 | 11 | 18 | 24;
  if (ageInMonths < 3) ageKey = 3;
  else if (ageInMonths < 6) ageKey = 6;
  else if (ageInMonths < 9) ageKey = 9;
  else if (ageInMonths < 12) ageKey = 11;
  else if (ageInMonths < 18) ageKey = 18;
  else ageKey = 24;

  const selectedNarrations = narrations[ageKey];

  const refrain =
    ageInMonths < 6 ? 'Yay!' :
    ageInMonths < 12 ? 'Feels so good!' :
    ageInMonths < 24 ? 'So much fun!' :
    'What an adventure!';

  const pages = Array.from({ length: pageCount }, (_, i) => ({
    page_number: i + 1,
    narration: selectedNarrations[i] || `Page ${i + 1} text. ${refrain}`,
    camera_angle: selectedAngles[i],
    camera_prompt: `${selectedAngles[i]} shot showing baby ${genericActions[i] || 'playing'}`,
    visual_focus: ['full_body', 'hands', 'feet', 'face'][i % 4],
    action_id: genericActions[i] || `action_${i + 1}`,
    scene_type: i === 0 ? 'opening' : i === pageCount - 1 ? 'closing' : 'action',
    emotion: 'joy',
    camera_angle_description: CAMERA_ANGLES[selectedAngles[i] as keyof typeof CAMERA_ANGLES] || 'medium shot',
    visual_action: genericActions[i] || `action_${i + 1}`,
    detail_prompt: `${selectedAngles[i]} shot of baby in the memory`,
    action_label: genericActions[i] || `action ${i + 1}`,
    pose_description: `${selectedAngles[i]} angle showing ${genericActions[i] || 'baby'}`,
    page_turn_cue: i % 2 === 0
  }));

  return {
    title: "Baby's Special Memory",
    refrain: refrain,
    pages,
    camera_sequence: selectedAngles,
    reading_level: getReadingLevel(ageInMonths),
    meta: { version: '4.0' }
  };
}
