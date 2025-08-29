/**
 * Story Generation with Paper Collage Style and Cinematic Shots
 * Uses Paper Collage as the single brand style
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { PersonId } from '@/lib/store/bookStore';
import { generateShotSequence, CINEMATIC_SHOTS } from '@/lib/camera/cinematicShots';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prefer a stable, fast model by default
const STORY_MODEL = process.env.OPENAI_STORY_MODEL || 'gpt-4o-mini';

// Get list of available cinematic shots for prompting
const SHOT_OPTIONS = Object.keys(CINEMATIC_SHOTS).map(id => ({
  id,
  name: CINEMATIC_SHOTS[id].name,
  mood: CINEMATIC_SHOTS[id].mood?.join(', ')
}));

interface StoryPage {
  page_number: number;
  narration: string;
  shot_id: string;
  shot_description: string;
  visual_action: string;
  action_description: string;
  visual_focus?: string;
  emotion: string;
  sensory_details?: string;
  characters_on_page: string[];
  background_extras?: string[];
  scene_type?: 'opening' | 'action' | 'closing';
}

interface StoryResponse {
  title: string;
  refrain: string;
  pages: StoryPage[];
  cast_members?: string[];
  metadata?: any;
  style?: string;
}

function calculateAgeInMonths(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth())
  );
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

  if (
    normalized === babyName.toLowerCase() ||
    normalized === 'baby' ||
    normalized === 'little one'
  ) {
    return 'baby';
  }

  const mapping: Record<string, PersonId> = {
    mom: 'mom',
    mommy: 'mom',
    mama: 'mom',
    mother: 'mom',
    dad: 'dad',
    daddy: 'dad',
    papa: 'dad',
    father: 'dad',
    grandma: 'grandma',
    granny: 'grandma',
    nana: 'grandma',
    grandmother: 'grandma',
    grandpa: 'grandpa',
    granddad: 'grandpa',
    grandfather: 'grandpa',
    brother: 'sibling',
    sister: 'sibling',
    sibling: 'sibling',
    aunt: 'aunt',
    auntie: 'aunt',
    uncle: 'uncle',
    friend: 'friend'
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
  characters.add('baby');

  const combinedText = `${memory} ${babyActions}`.toLowerCase();

  if (/\b(mom|mommy|mama|mother)\b/.test(combinedText)) characters.add('mom');
  if (/\b(dad|daddy|papa|father)\b/.test(combinedText)) characters.add('dad');
  if (/\b(grandma|granny|nana|grandmother)\b/.test(combinedText))
    characters.add('grandma');
  if (/\b(grandpa|granddad|grandfather)\b/.test(combinedText))
    characters.add('grandpa');
  if (/\b(brother|sister|sibling)\b/.test(combinedText))
    characters.add('sibling');
  if (/\b(aunt|auntie)\b/.test(combinedText)) characters.add('aunt');
  if (/\b(uncle)\b/.test(combinedText)) characters.add('uncle');

  return characters;
}

export async function POST(request: NextRequest) {
  let babyProfile: any;
  let conversation: any;

  try {
    const body = await request.json().catch(() => ({}));
    babyProfile = body?.babyProfile;
    conversation = body?.conversation || [];

    if (!babyProfile?.baby_name || !babyProfile?.birthdate) {
      const safeName = babyProfile?.baby_name || 'Baby';
      const safeBirth = babyProfile?.birthdate || '2024-01-01';
      const safeGender = babyProfile?.gender || 'neutral';
      return NextResponse.json(
        {
          success: true,
          story: createFallbackStoryWithPaperCollage(
            safeName,
            calculateAgeInMonths(safeBirth),
            safeGender
          )
        },
        { status: 200 }
      );
    }

    // Extract memory details
    const memory =
      conversation.find((c: any) => c.question === 'memory_anchor')?.answer ||
      '';
    const babyActions =
      conversation.find((c: any) => c.question === 'baby_action')?.answer ||
      '';
    const emotions =
      conversation.find((c: any) => c.question === 'baby_reaction')?.answer ||
      '';

    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const pageCount = getPageCount(ageInMonths);
    const wordLimits = getWordLimit(ageInMonths);
    const babyGender = babyProfile.gender || 'neutral';

    // Analyze memory for potential characters
    const detectedCharacters = analyzeMemoryForCharacters(
      memory,
      babyActions,
      babyProfile.baby_name
    );
    const characterList = Array.from(detectedCharacters).join(', ');

    // Generate a cinematic shot sequence
    const shotSequence = generateShotSequence(pageCount);
    const shotsDescription = shotSequence.map((shotId, idx) => {
      const shot = CINEMATIC_SHOTS[shotId];
      return `Page ${idx + 1}: ${shot.name} (${shot.base_prompt})`;
    }).join('\n');

    // Available shots for the AI to understand
    const availableShotsInfo = SHOT_OPTIONS.slice(0, 15).map(s => 
      `${s.id}: ${s.name} (mood: ${s.mood})`
    ).join('\n');

    // Gender-specific guidance
    const genderGuidance = babyGender === 'girl' 
      ? 'Make sure the baby girl has clearly feminine features and wears girly outfits'
      : babyGender === 'boy'
      ? 'Ensure the baby boy has distinctly boyish features and wears boyish outfits'
      : 'Keep the baby gender-neutral with cheerful, colorful appearance';

    // Enhanced prompt with Paper Collage focus
    const prompt = `You are an award-winning children's book author specializing in Paper Collage style stories.
Write a ${pageCount}-page baby book for ${babyProfile.baby_name}, a ${babyGender === 'girl' ? 'baby girl' : babyGender === 'boy' ? 'baby boy' : 'baby'}, age ${ageInMonths} months.

MEMORY: ${JSON.stringify(memory)}
BABY ACTIONS: ${babyActions}
EMOTIONS: ${emotions}
BABY GENDER: ${babyGender}
POTENTIAL CHARACTERS DETECTED: ${characterList}

AGE WORD WINDOW PER PAGE: ${wordLimits.min}-${wordLimits.max} words (HARD requirement)

IMPORTANT STYLE NOTE: This book will be illustrated in PAPER COLLAGE style - think of scenes that would look beautiful as paper cutouts with layers, texture, and dimensional depth.

GENDER CLARITY: ${genderGuidance}

CINEMATIC SHOT SEQUENCE (use these specific shots):
${shotsDescription}

AVAILABLE SHOT TYPES (for reference):
${availableShotsInfo}

CHARACTER MANAGEMENT RULES:
- EXPLICITLY list who appears on each page in characters_on_page array
- Use these character IDs: baby, mom, dad, grandma, grandpa, sibling, aunt, uncle, friend
- The baby (${babyProfile.baby_name}) should be "baby" in the array
- Only include characters who are actively part of the scene

VISUAL STORYTELLING FOR PAPER COLLAGE:
- Each page must use its assigned shot_id from the sequence
- Think about how paper layers would create depth
- Consider paper textures (torn edges, tissue paper, construction paper)
- Visualize scenes that work well with paper cutouts
- Include sensory details that translate to paper textures

STORY RULES:
- Present tense only. Concrete, sensory words. Short, read-aloud-friendly lines.
- Include ONE short refrain (2-4 words). Repeat it on at least 3 different pages.
- Gentle musicality: prefer soft end-rhyme or internal rhyme on at least 4 pages.
- Use ${babyProfile.baby_name} by name on 1-2 pages.
- Include at least one playful onomatopoeia.

OUTPUT JSON (exact structure):
{
  "title": "Short, concrete title",
  "refrain": "2-4 word refrain",
  "cast_members": ["baby", "mom", ...],
  "pages": [
    {
      "page_number": 1,
      "narration": "${wordLimits.min}-${wordLimits.max} words, present tense",
      "shot_id": "${shotSequence[0]}",
      "shot_description": "Description of how this shot frames the paper collage scene",
      "visual_action": "specific action suitable for paper cutouts",
      "action_description": "what paper elements to show",
      "visual_focus": "what paper detail to emphasize",
      "emotion": "joy/wonder/peaceful/curious",
      "sensory_details": "paper textures, colors, layers",
      "characters_on_page": ["baby", "mom"],
      "background_extras": [],
      "scene_type": "opening"
    }
  ]
}

IMPORTANT: Create scenes that will translate beautifully into layered paper collage art with clear shapes and dimensional depth.`;

    // Call OpenAI with strict timeout
    const completion = await openai.chat.completions.create(
      {
        model: STORY_MODEL,
        messages: [
          {
            role: 'system',
            content:
              "You are a visual storyteller who specializes in Paper Collage children's books. Each page should be designed to work beautifully as a paper cutout illustration with layers and texture."
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      },
      { timeout: 20_000 }
    );

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (!raw) throw new Error('Empty model response');
    const storyData: StoryResponse = JSON.parse(raw);

    // Validate and convert character arrays to PersonId[]
    const enhancedPages = storyData.pages.map((page, index) => {
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

      // Ensure we have a valid shot_id
      const shotId = page.shot_id || shotSequence[index] || 'playful_medium';

      return {
        ...page,
        page_number: page.page_number,
        shot_id: shotId,
        shot_description: page.shot_description || CINEMATIC_SHOTS[shotId]?.name || 'Medium shot',
        characters_on_page: charactersOnPage,
        background_extras: backgroundExtras.length > 0 ? backgroundExtras : undefined,
        scene_type: page.scene_type || (
          index === 0 ? 'opening' : 
          index === storyData.pages.length - 1 ? 'closing' : 
          'action'
        ),
        emotion: page.emotion || 'joy',
        layout_template: 'auto'
      };
    });

    // Get unique cast members
    const allCharacters = new Set<PersonId>();
    enhancedPages.forEach((page) => {
      page.characters_on_page.forEach((c) => allCharacters.add(c));
      page.background_extras?.forEach((c) => allCharacters.add(c));
    });

    const enhancedStory = {
      title: storyData.title,
      refrain: storyData.refrain,
      pages: enhancedPages,
      cast_members: Array.from(allCharacters),
      metadata: storyData.metadata || {},
      style: 'paper-collage', // Always Paper Collage
      cinematic_sequence: shotSequence,
      gender: babyGender
    };

    return NextResponse.json({ success: true, story: enhancedStory }, { status: 200 });
  } catch (error) {
    console.error('Story generation error:', error);
    const safeName = babyProfile?.baby_name || 'Baby';
    const safeBirth = babyProfile?.birthdate || '2024-01-01';
    const safeGender = babyProfile?.gender || 'neutral';

    return NextResponse.json(
      {
        success: true,
        story: createFallbackStoryWithPaperCollage(
          safeName,
          calculateAgeInMonths(safeBirth),
          safeGender
        )
      },
      { status: 200 }
    );
  }
}

function createFallbackStoryWithPaperCollage(
  babyName: string,
  ageInMonths: number,
  gender: 'boy' | 'girl' | 'neutral' = 'neutral'
): any {
  const pageCount = getPageCount(ageInMonths);
  const refrain = 'So much fun!';
  const shotSequence = generateShotSequence(pageCount);

  const pages = [
    {
      narration: `${babyName} wakes up happy. ${refrain}`,
      characters_on_page: ['baby' as PersonId],
      shot_id: shotSequence[0],
      shot_description: 'Paper collage establishing scene',
      emotion: 'peaceful' as const,
      visual_focus: 'face'
    },
    {
      narration: `Mommy comes to play.`,
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      shot_id: shotSequence[1],
      shot_description: 'Layered paper interaction',
      emotion: 'joy' as const,
      visual_action: 'reaching for mommy'
    },
    {
      narration: `Tiny hands reach up high.`,
      characters_on_page: ['baby' as PersonId],
      shot_id: shotSequence[2],
      shot_description: 'Paper cutout detail shot',
      emotion: 'curious' as const,
      visual_focus: 'hands'
    },
    {
      narration: `Together they explore. ${refrain}`,
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      shot_id: shotSequence[3],
      shot_description: 'Paper scene with depth',
      emotion: 'wonder' as const,
      visual_action: 'discovering paper toys'
    },
    {
      narration: `Giggles fill the air.`,
      characters_on_page: ['baby' as PersonId],
      shot_id: shotSequence[4],
      shot_description: 'Dynamic paper angles',
      emotion: 'joy' as const,
      visual_focus: 'face'
    },
    {
      narration: `Time for snuggles now. ${refrain}`,
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      shot_id: shotSequence[5],
      shot_description: 'Peaceful paper collage closing',
      emotion: 'peaceful' as const,
      visual_action: 'cuddling together'
    }
  ];

  return {
    title: `${babyName}'s Happy Day`,
    refrain,
    cast_members: ['baby', 'mom'],
    metadata: {},
    style: 'paper-collage',
    gender,
    cinematic_sequence: shotSequence,
    pages: pages.slice(0, pageCount).map((page, i) => ({
      page_number: i + 1,
      ...page,
      action_description: 'Paper cutout baby moments',
      sensory_details: 'Layered paper with torn edges and texture',
      background_extras: undefined,
      scene_type: i === 0 ? 'opening' : i === pageCount - 1 ? 'closing' : 'action',
      layout_template: 'auto'
    }))
  };
}