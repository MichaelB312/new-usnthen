// app/api/generate-story/route.ts
/**
 * Enhanced Story Generation with Character Tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { PersonId } from '@/lib/store/bookStore';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Camera angles remain the same
const DISTINCT_CAMERA_ANGLES = {
  extreme_closeup: 'Extreme close-up on tiny details (fingers, toes, eyes)',
  macro: 'Macro shot of textures and materials',
  pov_baby: 'POV from baby perspective looking at own hands/feet',
  wide: 'Wide shot showing full scene and environment',
  birds_eye: "Bird's-eye view looking straight down from above",
  worms_eye: "Worm's-eye view from ground looking up",
  profile: 'Strict profile shot from the side',
  over_shoulder: 'Over-the-shoulder seeing what baby sees'
} as const;

type CameraAngle = keyof typeof DISTINCT_CAMERA_ANGLES;

interface StoryPage {
  page_number: number;
  narration: string;
  camera_angle: CameraAngle;
  visual_action: string;
  action_description: string;
  camera_prompt?: string;
  characters_on_page: string[]; // Will be converted to PersonId[]
  background_extras?: string[];
}

interface StoryResponse {
  title: string;
  refrain: string;
  pages: StoryPage[];
  cast_members?: string[]; // Made optional for backward compatibility
  metadata?: any; // Added metadata
  style?: string; // Added style
}

function calculateAgeInMonths(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + 
                     (now.getMonth() - birth.getMonth()));
}

function getPageCount(ageInMonths: number): number {
  if (ageInMonths < 12) return 6;
  if (ageInMonths < 24) return 8;
  return 10;
}

function getWordLimit(ageInMonths: number): { min: number; max: number } {
  if (ageInMonths < 6) return { min: 3, max: 5 };
  if (ageInMonths < 12) return { min: 5, max: 10 };
  if (ageInMonths < 24) return { min: 8, max: 15 };
  return { min: 10, max: 20 };
}

// Map string character names to PersonId
function mapToPersonId(character: string, babyName: string): PersonId | null {
  const normalized = character.toLowerCase().trim();
  
  // Check if it's the baby
  if (normalized === babyName.toLowerCase() || 
      normalized === 'baby' || 
      normalized === 'little one') {
    return 'baby';
  }
  
  // Map common family terms
  const mapping: Record<string, PersonId> = {
    'mom': 'mom',
    'mommy': 'mom',
    'mama': 'mom',
    'mother': 'mom',
    'dad': 'dad',
    'daddy': 'dad',
    'papa': 'dad',
    'father': 'dad',
    'grandma': 'grandma',
    'granny': 'grandma',
    'nana': 'grandma',
    'grandmother': 'grandma',
    'grandpa': 'grandpa',
    'granddad': 'grandpa',
    'grandfather': 'grandpa',
    'brother': 'sibling',
    'sister': 'sibling',
    'sibling': 'sibling',
    'aunt': 'aunt',
    'auntie': 'aunt',
    'uncle': 'uncle',
    'friend': 'friend'
  };
  
  return mapping[normalized] || null;
}

// Extract characters from memory details
function analyzeMemoryForCharacters(
  memory: string,
  babyActions: string,
  babyName: string
): Set<PersonId> {
  const characters = new Set<PersonId>();
  characters.add('baby'); // Baby is always present
  
  const combinedText = `${memory} ${babyActions}`.toLowerCase();
  
  // Check for family members
  if (/\b(mom|mommy|mama|mother)\b/.test(combinedText)) characters.add('mom');
  if (/\b(dad|daddy|papa|father)\b/.test(combinedText)) characters.add('dad');
  if (/\b(grandma|granny|nana|grandmother)\b/.test(combinedText)) characters.add('grandma');
  if (/\b(grandpa|granddad|grandfather)\b/.test(combinedText)) characters.add('grandpa');
  if (/\b(brother|sister|sibling)\b/.test(combinedText)) characters.add('sibling');
  if (/\b(aunt|auntie)\b/.test(combinedText)) characters.add('aunt');
  if (/\b(uncle)\b/.test(combinedText)) characters.add('uncle');
  
  return characters;
}

export async function POST(request: NextRequest) {
  let babyProfile: any;
  let conversation: any;
  let illustrationStyle = 'wondrous'; // Declare at function scope
  
  try {
    const body = await request.json();
    babyProfile = body.babyProfile;
    conversation = body.conversation;
    illustrationStyle = body.illustrationStyle || 'wondrous'; // Assign from request
    
    // Extract memory details
    const memory = conversation.find((c: any) => c.question === 'memory_anchor')?.answer || '';
    const whySpecial = conversation.find((c: any) => c.question === 'why_special')?.answer || '';
    const babyActions = conversation.find((c: any) => c.question === 'baby_action')?.answer || '';
    const emotions = conversation.find((c: any) => c.question === 'baby_reaction')?.answer || '';
    
    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const pageCount = getPageCount(ageInMonths);
    const wordLimits = getWordLimit(ageInMonths);
    
    // Analyze memory for potential characters
    const detectedCharacters = analyzeMemoryForCharacters(memory, babyActions, babyProfile.baby_name);
    const characterList = Array.from(detectedCharacters).join(', ');
    
    // Get camera angles
    const cameraAngles = Object.keys(DISTINCT_CAMERA_ANGLES) as CameraAngle[];
    const shuffledAngles = [...cameraAngles].sort(() => Math.random() - 0.5);
    const selectedAngles = shuffledAngles.slice(0, pageCount);
    const cameraAnglesList = selectedAngles.join(", ");
    
    // Enhanced prompt with character tracking
    const prompt = `You are an award-winning board-book author who excels at character continuity.
Write a ${pageCount}-page baby book for ${babyProfile.baby_name}, age ${ageInMonths} months.

MEMORY: ${JSON.stringify(memory)}
BABY ACTIONS: ${babyActions}
EMOTIONS: ${emotions}
POTENTIAL CHARACTERS DETECTED: ${characterList}

AGE WORD WINDOW PER PAGE: ${wordLimits.min}-${wordLimits.max} words (HARD requirement)

CHARACTER MANAGEMENT RULES:
- EXPLICITLY list who appears on each page in characters_on_page array
- Use these character IDs: baby, mom, dad, grandma, grandpa, sibling, aunt, uncle, friend
- The baby (${babyProfile.baby_name}) should be "baby" in the array
- Only include characters who are actively part of the scene
- Use background_extras for characters visible but not central to action
- Be consistent: if mom appears in page 1, she should look the same throughout

STORY RULES:
- Present tense only. Concrete, sensory words. Short, read-aloud-friendly lines.
- Include ONE short refrain (2-4 words). Repeat it on at least 3 different pages.
- Gentle musicality: prefer soft end-rhyme or internal rhyme on at least 4 pages.
- Use ${babyProfile.baby_name} by name on 1-2 pages.
- Include at least one playful onomatopoeia.
- Give at least two subtle page-turn hooks.
- Each page = a DIFFERENT, VISUALLY DISTINCT action/pose.
- Each page uses a UNIQUE camera angle from: ${cameraAnglesList}.

OUTPUT JSON (exact structure):
{
  "title": "Short, concrete title",
  "refrain": "2-4 word refrain",
  "cast_members": ["baby", "mom", ...], // All unique characters in story
  "pages": [
    {
      "page_number": 1,
      "narration": "${wordLimits.min}-${wordLimits.max} words, present tense",
      "camera_angle": "one of: ${cameraAnglesList}",
      "visual_action": "specific action (e.g., 'baby reaches for shell, mom points')",
      "action_description": "what illustrator shows",
      "camera_prompt": "camera framing description",
      "characters_on_page": ["baby", "mom"], // Who MUST appear
      "background_extras": [] // Optional background characters
    }
  ]
}

IMPORTANT: Track characters carefully. If the memory mentions family members, include them appropriately across pages. The baby should appear on most/all pages as "baby" in the array.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a children\'s book author who specializes in character consistency and family dynamics. You carefully track which characters appear on each page.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 3500
    });

    const storyData: StoryResponse = JSON.parse(completion.choices[0].message.content || '{}');
    
    // Validate and convert character arrays to PersonId[]
    const enhancedPages = storyData.pages.map((page, index) => {
      // Convert string character names to PersonId
      const charactersOnPage: PersonId[] = [];
      const backgroundExtras: PersonId[] = [];
      
      // Process characters_on_page
      for (const char of page.characters_on_page || []) {
        const personId = mapToPersonId(char, babyProfile.baby_name);
        if (personId && !charactersOnPage.includes(personId)) {
          charactersOnPage.push(personId);
        }
      }
      
      // Process background_extras
      for (const char of page.background_extras || []) {
        const personId = mapToPersonId(char, babyProfile.baby_name);
        if (personId && !backgroundExtras.includes(personId)) {
          backgroundExtras.push(personId);
        }
      }
      
      // Ensure baby is always included if not specified
      if (charactersOnPage.length === 0) {
        charactersOnPage.push('baby');
      }
      
      return {
        ...page,
        page_number: page.page_number,
        characters_on_page: charactersOnPage,
        background_extras: backgroundExtras.length > 0 ? backgroundExtras : undefined,
        scene_type: index === 0 ? 'opening' : index === storyData.pages.length - 1 ? 'closing' : 'action',
        emotion: 'joy',
        layout_template: 'auto'
      };
    });
    
    // Get unique cast members
    const allCharacters = new Set<PersonId>();
    enhancedPages.forEach(page => {
      page.characters_on_page.forEach(c => allCharacters.add(c));
      page.background_extras?.forEach(c => allCharacters.add(c));
    });
    
    const enhancedStory = {
      title: storyData.title,
      refrain: storyData.refrain,
      pages: enhancedPages,
      cast_members: Array.from(allCharacters), // Include cast_members
      metadata: storyData.metadata || {}, // Include metadata with fallback
      style: storyData.style || illustrationStyle // Include style with fallback using the variable from request
    };
    
    return NextResponse.json({ success: true, story: enhancedStory });
    
  } catch (error) {
    console.error('Story generation error:', error);
    
    // Return a fallback story with character tracking
    return NextResponse.json({ 
      success: true, 
      story: createFallbackStoryWithCharacters(
        babyProfile?.baby_name || 'Baby',
        calculateAgeInMonths(babyProfile?.birthdate || '2024-01-01'),
        illustrationStyle
      )
    });
  }
}

function createFallbackStoryWithCharacters(babyName: string, ageInMonths: number, style: string = 'wondrous'): any {
  const pageCount = getPageCount(ageInMonths);
  const angles = Object.keys(DISTINCT_CAMERA_ANGLES) as CameraAngle[];
  const refrain = "So much fun!";
  
  // Simple story with mom and baby
  const pages = [
    {
      narration: `${babyName} wakes up happy. ${refrain}`,
      characters_on_page: ['baby' as PersonId],
      camera_angle: 'extreme_closeup' as CameraAngle
    },
    {
      narration: `Mommy comes to play.`,
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      camera_angle: 'wide' as CameraAngle
    },
    {
      narration: `Tiny hands reach up high.`,
      characters_on_page: ['baby' as PersonId],
      camera_angle: 'macro' as CameraAngle
    },
    {
      narration: `Together they explore. ${refrain}`,
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      camera_angle: 'over_shoulder' as CameraAngle
    },
    {
      narration: `Giggles fill the air.`,
      characters_on_page: ['baby' as PersonId],
      camera_angle: 'profile' as CameraAngle
    },
    {
      narration: `Time for snuggles now. ${refrain}`,
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      camera_angle: 'birds_eye' as CameraAngle
    }
  ];
  
  return {
    title: `${babyName}'s Happy Day`,
    refrain,
    cast_members: ['baby', 'mom'],
    metadata: {},
    style: style,
    pages: pages.slice(0, pageCount).map((page, i) => ({
      page_number: i + 1,
      ...page,
      visual_action: 'baby exploring and playing',
      action_description: 'Joyful baby moments',
      camera_prompt: `${page.camera_angle} shot`,
      background_extras: undefined,
      scene_type: i === 0 ? 'opening' : i === pageCount - 1 ? 'closing' : 'action',
      emotion: 'joy',
      layout_template: 'auto'
    }))
  };
}