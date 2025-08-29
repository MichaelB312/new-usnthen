// app/api/generate-story/route.ts
/**
 * Story Generation with Emotional Narrative Arc
 * Creates engaging stories with heart, not just action logs
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { PersonId } from '@/lib/store/bookStore';
import { generateDiverseShotSequence, CINEMATIC_SHOTS } from '@/lib/camera/cinematicShots';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const STORY_MODEL = process.env.OPENAI_STORY_MODEL || 'gpt-4o-mini';

// Get list of available shots for variety
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
  page_goal?: string;
}

interface StoryResponse {
  title: string;
  refrain: string;
  pages: StoryPage[];
  cast_members?: string[];
  metadata?: any;
  style?: string;
  story_arc?: string;
  emotional_core?: string;
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

function getStoryGuidelines(ageInMonths: number): string {
  if (ageInMonths < 12) {
    return `LITTLEST LISTENERS (0-12 months):
    - Focus on sensory experiences and parent-child bond
    - Use rhythmic, musical language with lots of repetition
    - Include onomatopoeia (boom!, splash!, whoosh!)
    - Create wonder through simple cause-and-effect
    - Each page should engage the senses (sight, sound, touch)
    - Use the baby's name frequently
    - Example: "Down sits ${"{name}"}. Wiggle, wiggle, toes! What is that? Sand!"`;
  } else if (ageInMonths < 24) {
    return `EAGER TODDLERS (12-24 months):
    - Simple sequence with clear cause and effect
    - Character wants something, does something, gets result
    - Use strong action verbs (stomp, reach, tumble, hug)
    - Include repetitive phrases they can join in on
    - Create mini-narratives within each page
    - Example: "A shiny red pail! ${"{name}"} reaches... and GRABS it. Up, up, up it goes. Then... THUMP! Down it comes again."`;
  } else {
    return `CURIOUS PRESCHOOLERS (24-36 months):
    - Clear problem and solution arc
    - Name and explore feelings (proud, frustrated, excited)
    - Include simple dialogue and character interactions
    - Answer "why" through the narrative
    - Build to a satisfying emotional resolution
    - Example: "A little wave tickled her toes. *Swish!* ${"{name}"} giggled and chased it back to the sea. 'You can't catch me!' she squealed with delight."`;
  }
}

function getEmotionalArcs(): string[] {
  return [
    'Discovery Arc: Curiosity → Exploration → Wonder → Joy',
    'Challenge Arc: Desire → Attempt → Small Struggle → Triumph',
    'Connection Arc: Alone → Meeting → Playing Together → Friendship',
    'Comfort Arc: Uncertainty → Gentle Exploration → Growing Confidence → Safety',
    'Adventure Arc: Ordinary Moment → Unexpected Discovery → Brave Investigation → Happy Resolution'
  ];
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
          story: createEngagingFallbackStory(
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
    const whySpecial =
      conversation.find((c: any) => c.question === 'why_special')?.answer ||
      '';
    const babyActions =
      conversation.find((c: any) => c.question === 'baby_action')?.answer ||
      '';
    const babyReaction =
      conversation.find((c: any) => c.question === 'baby_reaction')?.answer ||
      '';

    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const pageCount = getPageCount(ageInMonths);
    const wordLimits = getWordLimit(ageInMonths);
    const babyGender = babyProfile.gender || 'neutral';
    const storyGuidelines = getStoryGuidelines(ageInMonths);
    const emotionalArcs = getEmotionalArcs();

    // Generate diverse shot sequence
    const shotSequence = generateDiverseShotSequence(pageCount);
    const shotsDescription = shotSequence.map((shotId, idx) => {
      const shot = CINEMATIC_SHOTS[shotId];
      return `Page ${idx + 1}: ${shot.name} - MUST BE VISUALLY DISTINCT FROM OTHER PAGES`;
    }).join('\n');

    // Gender-specific guidance
    const genderGuidance = babyGender === 'girl' 
      ? 'Baby girl with feminine charm and sweetness'
      : babyGender === 'boy'
      ? 'Baby boy with boyish energy and playfulness'
      : 'Baby with joyful, curious spirit';

    // Enhanced story generation prompt
    const prompt = `You are a beloved children's book author who creates emotionally engaging stories that parents love to read and babies adore hearing. Your stories have HEART, not just actions.

CREATE A STORY FOR: ${babyProfile.baby_name}, a ${babyGender === 'girl' ? 'baby girl' : babyGender === 'boy' ? 'baby boy' : 'baby'}, age ${ageInMonths} months.

MEMORY CONTEXT:
- What happened: ${memory}
- Why it was special: ${whySpecial}
- What ${babyProfile.baby_name} did: ${babyActions}
- How ${babyProfile.baby_name} felt: ${babyReaction}

AGE-APPROPRIATE GUIDELINES:
${storyGuidelines}

WORD LIMIT: ${wordLimits.min}-${wordLimits.max} words per page (STRICT)

THE 3 GOLDEN RULES YOU MUST FOLLOW:
1. GIVE IT A HEART: Every page needs emotional resonance. Show how ${babyProfile.baby_name} FEELS, not just what they do.
2. CREATE AN ARC: Choose one of these emotional journeys:
   ${emotionalArcs.join('\n   ')}
3. USE SENSORY LANGUAGE: Include sounds (splash!), textures (squishy), and sensations (tickly) on every page.

VISUAL VARIETY REQUIREMENT - CRITICAL:
${shotsDescription}

Each page MUST have a completely different camera angle and composition. NO SIMILAR SHOTS!
Available shot types to ensure variety:
${SHOT_OPTIONS.slice(0, 20).map(s => `- ${s.id}: ${s.name}`).join('\n')}

STORY STRUCTURE:
Page 1: Opening - Establish setting and emotion (use wide/establishing shot)
Pages 2-${pageCount-1}: Build the narrative with varied actions and emotions (alternate between close, medium, wide, high, low angles)
Page ${pageCount}: Closing - Emotional resolution and satisfaction (use intimate/emotional shot)

WRITING STYLE REQUIREMENTS:
- Present tense only
- Include a 2-4 word REFRAIN that appears on at least 3 pages
- Use ${babyProfile.baby_name}'s name 2-3 times (not on every page)
- Include at least 2 instances of onomatopoeia (sound words)
- Each page should make the reader FEEL something
- Create moments of wonder, discovery, or connection
- Use rhythm and musicality in your language

AVOID THESE COMMON MISTAKES:
❌ DON'T write action logs: "Yara sits. Yara plays. Yara laughs."
✅ DO write with emotion: "Down plops Yara in the warm, tickly sand. *Giggle!*"

❌ DON'T use similar shots: All medium shots or all portraits
✅ DO vary dramatically: Overhead → Close-up → Wide → Low angle → Profile

❌ DON'T forget sensory details: "Yara touches sand"
✅ DO engage the senses: "Soft sand squishes between tiny fingers"

OUTPUT JSON (exact structure):
{
  "title": "Short, emotionally evocative title",
  "refrain": "2-4 word rhythmic refrain",
  "emotional_core": "The heart of this story in one sentence",
  "story_arc": "The emotional journey (e.g., curiosity to joy)",
  "cast_members": ["baby", ...],
  "pages": [
    {
      "page_number": 1,
      "narration": "${wordLimits.min}-${wordLimits.max} words with EMOTION and SENSORY details",
      "page_goal": "What emotional beat this page achieves",
      "shot_id": "${shotSequence[0]}" (MUST use assigned shot),
      "shot_description": "How this unique angle serves the story",
      "visual_action": "Specific physical action for isolated illustration",
      "action_description": "How the action shows emotion",
      "visual_focus": "Key detail to emphasize",
      "emotion": "joy/wonder/peaceful/curious/proud/excited",
      "sensory_details": "What can be felt/heard/seen",
      "characters_on_page": ["baby", ...],
      "scene_type": "opening"
    }
  ]
}

Remember: You're not documenting events, you're creating MOMENTS that matter. Make parents smile and babies giggle!`;

    // Call OpenAI with enhanced prompt
    const completion = await openai.chat.completions.create(
      {
        model: STORY_MODEL,
        messages: [
          {
            role: 'system',
            content:
              "You are a master children's book author who understands that the best baby books create emotional connections through simple, sensory-rich narratives. Every word you write serves both the child's delight and the parent's joy in reading."
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8, // Slightly higher for more creative variation
      },
      { timeout: 20_000 }
    );

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (!raw) throw new Error('Empty model response');
    const storyData: StoryResponse = JSON.parse(raw);

    // Validate and enhance pages
    const enhancedPages = storyData.pages.map((page, index) => {
      const charactersOnPage: PersonId[] = [];
      
      // Process characters
      for (const char of page.characters_on_page || []) {
        const personId = mapToPersonId(char, babyProfile.baby_name);
        if (personId && !charactersOnPage.includes(personId)) {
          charactersOnPage.push(personId);
        }
      }

      // Ensure baby is included if not specified
      if (charactersOnPage.length === 0) {
        charactersOnPage.push('baby');
      }

      // Ensure unique shot_id
      const shotId = page.shot_id || shotSequence[index] || 'isolated_portrait';

      return {
        ...page,
        page_number: page.page_number,
        shot_id: shotId,
        shot_description: page.shot_description || CINEMATIC_SHOTS[shotId]?.name || 'Unique angle',
        characters_on_page: charactersOnPage,
        scene_type: page.scene_type || (
          index === 0 ? 'opening' : 
          index === storyData.pages.length - 1 ? 'closing' : 
          'action'
        ),
        emotion: page.emotion || 'joy',
        layout_template: 'auto',
        page_goal: page.page_goal || `Emotional beat ${index + 1}`
      };
    });

    const enhancedStory = {
      title: storyData.title,
      refrain: storyData.refrain,
      pages: enhancedPages,
      cast_members: Array.from(new Set(enhancedPages.flatMap(p => p.characters_on_page))),
      metadata: {
        ...storyData.metadata,
        emotional_core: storyData.emotional_core,
        story_arc: storyData.story_arc
      },
      style: 'isolated-paper-collage',
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
        story: createEngagingFallbackStory(
          safeName,
          calculateAgeInMonths(safeBirth),
          safeGender
        )
      },
      { status: 200 }
    );
  }
}

function createEngagingFallbackStory(
  babyName: string,
  ageInMonths: number,
  gender: 'boy' | 'girl' | 'neutral' = 'neutral'
): any {
  const pageCount = getPageCount(ageInMonths);
  const refrain = 'What joy!';
  const shotSequence = generateDiverseShotSequence(pageCount);

  const pages = [
    {
      narration: `Morning sunshine kisses ${babyName}'s cheeks. Mmm, warm! ${refrain}`,
      page_goal: 'Establish warmth and comfort',
      characters_on_page: ['baby' as PersonId],
      shot_id: shotSequence[0],
      shot_description: 'Wide establishing shot showing baby in morning light',
      emotion: 'peaceful' as const,
      visual_focus: 'face',
      sensory_details: 'Warm golden light, soft textures'
    },
    {
      narration: `Peek-a-boo! Mommy's here! *Giggle giggle!*`,
      page_goal: 'Connection and recognition',
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      shot_id: shotSequence[1],
      shot_description: 'Over-shoulder intimate moment',
      emotion: 'joy' as const,
      visual_action: 'reaching up happily',
      sensory_details: 'Soft voice, warm embrace'
    },
    {
      narration: `Tiny fingers explore. Soft... bumpy... smooth!`,
      page_goal: 'Sensory discovery',
      characters_on_page: ['baby' as PersonId],
      shot_id: shotSequence[2],
      shot_description: 'Extreme close-up on hands',
      emotion: 'curious' as const,
      visual_focus: 'hands',
      sensory_details: 'Different textures to touch'
    },
    {
      narration: `${babyName} kicks! Splash-splash-splash! ${refrain}`,
      page_goal: 'Active play and cause-effect',
      characters_on_page: ['baby' as PersonId],
      shot_id: shotSequence[3],
      shot_description: 'Dynamic angle showing movement',
      emotion: 'joy' as const,
      visual_action: 'kicking and splashing',
      sensory_details: 'Water droplets, movement'
    },
    {
      narration: `Together we dance, swirl and sway. Round and round!`,
      page_goal: 'Joyful connection',
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      shot_id: shotSequence[4],
      shot_description: 'Wide shot showing movement',
      emotion: 'joy' as const,
      visual_action: 'being held and spun gently',
      sensory_details: 'Motion, laughter, closeness'
    },
    {
      narration: `Sleepy ${babyName}, cozy and loved. Sweet dreams. ${refrain}`,
      page_goal: 'Peaceful resolution',
      characters_on_page: ['baby' as PersonId],
      shot_id: shotSequence[5],
      shot_description: 'Soft, peaceful close-up',
      emotion: 'peaceful' as const,
      visual_action: 'curled up peacefully',
      sensory_details: 'Soft blanket, quiet, warmth'
    }
  ];

  return {
    title: `${babyName}'s Day of Wonder`,
    refrain,
    emotional_core: 'The joy of simple discoveries and loving connections',
    story_arc: 'Peaceful awakening → playful exploration → restful satisfaction',
    cast_members: ['baby', 'mom'],
    metadata: {
      emotional_core: 'A celebration of everyday moments of joy and discovery',
      story_arc: 'comfort → play → rest'
    },
    style: 'isolated-paper-collage',
    gender,
    cinematic_sequence: shotSequence,
    pages: pages.slice(0, pageCount).map((page, i) => ({
      page_number: i + 1,
      ...page,
      action_description: page.visual_action || 'Gentle baby moment',
      background_extras: undefined,
      scene_type: i === 0 ? 'opening' : i === pageCount - 1 ? 'closing' : 'action',
      layout_template: 'auto'
    }))
  };
}