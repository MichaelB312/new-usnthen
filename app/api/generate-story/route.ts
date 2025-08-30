// app/api/generate-story/route.ts
/**
 * Async Story Generation with Job Queue
 * Prevents frontend timeouts by using polling pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { PersonId } from '@/lib/store/bookStore';
import { generateHighContrastSequence, HIGH_CONTRAST_SHOTS } from '@/lib/camera/highContrastShots';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout for OpenAI
});

const STORY_MODEL = process.env.OPENAI_STORY_MODEL || 'gpt-4o-mini';

// Job storage
interface StoryJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  startTime: number;
  completedAt?: number;
  babyName?: string;
  message?: string;
}

const storyJobs = new Map<string, StoryJob>();

// Cleanup old jobs every 10 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of storyJobs.entries()) {
    if (job.startTime < oneHourAgo) {
      storyJobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

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
  is_character_free?: boolean;
  object_focus?: string;
  scene_type?: 'opening' | 'action' | 'closing' | 'transition';
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

function createEngagingFallbackStory(
  babyName: string,
  ageInMonths: number,
  gender: 'boy' | 'girl' | 'neutral' = 'neutral'
): any {
  const pageCount = getPageCount(ageInMonths);
  const refrain = 'What joy!';
  const shotSequence = generateHighContrastSequence(pageCount, true);

  const pages = [
    {
      narration: `A bright yellow duck sits waiting by the tub.`,
      page_goal: 'Set the scene with object of desire',
      characters_on_page: [],
      is_character_free: true,
      shot_id: 'object_of_desire',
      shot_description: 'Object of Desire',
      emotion: 'anticipatory' as const,
      object_focus: 'yellow rubber duck',
      visual_focus: 'toy',
      sensory_details: 'Shiny, smooth, inviting'
    },
    {
      narration: `${babyName} crawls closer. Eyes wide! ${refrain}`,
      page_goal: 'Show approach and excitement',
      characters_on_page: ['baby' as PersonId],
      is_character_free: false,
      shot_id: 'worms_eye_ground',
      shot_description: 'Worm\'s-Eye View',
      emotion: 'excited' as const,
      visual_action: 'crawling forward eagerly',
      sensory_details: 'Movement, anticipation'
    },
    {
      narration: `Tiny fingers reach and grab! *Squeak!*`,
      page_goal: 'The moment of contact',
      characters_on_page: ['baby' as PersonId],
      is_character_free: false,
      shot_id: 'extreme_macro_detail',
      shot_description: 'Extreme Macro',
      emotion: 'joy' as const,
      visual_focus: 'hands',
      visual_action: 'grabbing duck',
      sensory_details: 'Texture of duck, squeeze'
    },
    {
      narration: `Splash splash splash! ${babyName} and ducky play! ${refrain}`,
      page_goal: 'Peak action and joy',
      characters_on_page: ['baby' as PersonId],
      is_character_free: false,
      shot_id: 'birds_eye_overhead',
      shot_description: 'Bird\'s-Eye View',
      emotion: 'joy' as const,
      visual_action: 'splashing in bath',
      sensory_details: 'Water, bubbles, laughter'
    },
    {
      narration: `Mommy wraps ${babyName} warm and snug.`,
      page_goal: 'Comfort and care',
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      is_character_free: false,
      shot_id: 'over_shoulder_parent',
      shot_description: 'Over-the-Shoulder',
      emotion: 'peaceful' as const,
      visual_action: 'being wrapped in towel',
      sensory_details: 'Soft, warm, cozy'
    },
    {
      narration: `Duck floats alone. Bubbles pop one by one.`,
      page_goal: 'Peaceful aftermath',
      characters_on_page: [],
      is_character_free: true,
      shot_id: 'aftermath_quiet',
      shot_description: 'Aftermath Shot',
      emotion: 'peaceful' as const,
      object_focus: 'duck floating in calm water',
      sensory_details: 'Quiet, still, peaceful'
    }
  ];

  return {
    title: `${babyName}'s Splish Splash`,
    refrain,
    emotional_core: 'The simple joy of bath time discovery',
    story_arc: 'anticipation → excitement → joy → comfort → peace',
    cast_members: ['baby', 'mom'],
    metadata: {
      emotional_core: 'A celebration of simple pleasures and loving care',
      story_arc: 'desire → action → joy → comfort',
      includes_character_free_pages: true
    },
    style: 'isolated-paper-collage',
    gender,
    high_contrast_sequence: shotSequence,
    pages: pages.slice(0, pageCount).map((page, i) => ({
      page_number: i + 1,
      ...page,
      action_description: page.visual_action || 'Scene moment',
      background_extras: undefined,
      scene_type: i === 0 ? 'opening' : i === pageCount - 1 ? 'closing' : page.is_character_free ? 'transition' : 'action',
      layout_template: 'auto'
    }))
  };
}

// Process story generation asynchronously
async function processStoryGeneration(jobId: string, params: any) {
  const job = storyJobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'processing';
    job.progress = 10;
    job.message = 'Extracting memory details...';

    const { babyProfile, conversation, illustrationStyle, storyLength } = params;

    // Extract memory details
    const memory = conversation.find((c: any) => c.question === 'memory_anchor')?.answer || '';
    const whySpecial = conversation.find((c: any) => c.question === 'why_special')?.answer || '';
    const babyActions = conversation.find((c: any) => c.question === 'baby_action')?.answer || '';
    const babyReaction = conversation.find((c: any) => c.question === 'baby_reaction')?.answer || '';

    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const pageCount = getPageCount(ageInMonths);
    const wordLimits = getWordLimit(ageInMonths);
    const babyGender = babyProfile.gender || 'neutral';
    const storyGuidelines = getStoryGuidelines(ageInMonths);

    job.progress = 20;
    job.message = 'Generating shot sequence...';

    // Generate high-contrast shot sequence with character-free pages
    const shotSequence = generateHighContrastSequence(pageCount, true);
    
    // Build shot descriptions for the prompt
    const shotsDescription = shotSequence.map((shotId, idx) => {
      const shot = HIGH_CONTRAST_SHOTS[shotId];
      const pageNum = idx + 1;
      
      if (!shot.requires_character) {
        return `Page ${pageNum}: ${shot.name} (CHARACTER-FREE) - ${shot.base_prompt}
        This page should NOT include ${babyProfile.baby_name} or any characters.
        Focus on: objects, atmosphere, or environmental details.`;
      } else {
        return `Page ${pageNum}: ${shot.name} - ${shot.base_prompt}
        This is a CHARACTER shot featuring ${babyProfile.baby_name}.`;
      }
    }).join('\n');

    job.progress = 30;
    job.message = 'Creating narrative structure...';

    // Gender-specific guidance
    const genderGuidance = babyGender === 'girl' 
      ? 'Baby girl with feminine charm and sweetness'
      : babyGender === 'boy'
      ? 'Baby boy with boyish energy and playfulness'
      : 'Baby with joyful, curious spirit';

    // Enhanced story generation prompt
    const prompt = `You are creating an emotionally engaging children's book with sophisticated visual pacing.

CREATE A STORY FOR: ${babyProfile.baby_name}, a ${babyGender === 'girl' ? 'baby girl' : babyGender === 'boy' ? 'baby boy' : 'baby'}, age ${ageInMonths} months.

MEMORY CONTEXT:
- What happened: ${memory}
- Why it was special: ${whySpecial}
- What ${babyProfile.baby_name} did: ${babyActions}
- How ${babyProfile.baby_name} felt: ${babyReaction}

AGE-APPROPRIATE GUIDELINES:
${storyGuidelines}

WORD LIMIT: ${wordLimits.min}-${wordLimits.max} words per page (STRICT)

CRITICAL VISUAL VARIETY REQUIREMENTS:
You MUST use these EXACT shots for each page (NO SUBSTITUTIONS):
${shotsDescription}

IMPORTANT RULES FOR CHARACTER-FREE PAGES:
- Pages marked as "CHARACTER-FREE" must NOT mention ${babyProfile.baby_name} in the narration
- These pages should describe objects, atmosphere, or environmental details
- They create pacing, build anticipation, or show aftermath
- Example character-free narrations:
  * "A bright red ball sits waiting in the grass."
  * "Tiny footprints trail across the sandy beach."
  * "Sunlight dances through the window, warm and golden."

STORY STRUCTURE RULES:
1. Use character-free pages strategically for:
   - Opening: Set the scene or introduce an object of desire
   - Mid-story: Create breathing room after intense action
   - Transitions: Show passage of time or change of scene
   - Closing: Peaceful aftermath or setting for next adventure

2. Each page must have COMPLETELY DIFFERENT visual composition
3. Never use similar angles on consecutive pages
4. Include a 2-4 word REFRAIN that appears on at least 3 CHARACTER pages

OUTPUT JSON (exact structure):
{
  "title": "Short, emotionally evocative title",
  "refrain": "2-4 word rhythmic refrain",
  "emotional_core": "The heart of this story in one sentence",
  "story_arc": "The emotional journey",
  "cast_members": ["baby", ...],
  "pages": [
    {
      "page_number": 1,
      "narration": "${wordLimits.min}-${wordLimits.max} words (or object description for character-free pages)",
      "page_goal": "What this page achieves narratively",
      "shot_id": "${shotSequence[0]}",
      "shot_description": "${HIGH_CONTRAST_SHOTS[shotSequence[0]]?.name}",
      "is_character_free": ${!HIGH_CONTRAST_SHOTS[shotSequence[0]]?.requires_character},
      "visual_action": "Specific action or object focus",
      "action_description": "How this serves the story",
      "visual_focus": "Key visual element",
      "emotion": "joy/wonder/peaceful/curious/proud/excited",
      "sensory_details": "What can be felt/heard/seen",
      "characters_on_page": ${!HIGH_CONTRAST_SHOTS[shotSequence[0]]?.requires_character ? '[]' : '["baby", ...]'},
      "object_focus": "For character-free pages, what object/detail to show",
      "scene_type": "opening"
    }
  ]
}

Remember: Character-free pages are powerful tools for pacing and atmosphere. Use them wisely!`;

    job.progress = 50;
    job.message = 'Calling AI to generate story...';

    // Call OpenAI with enhanced prompt
    const completion = await openai.chat.completions.create({
      model: STORY_MODEL,
      messages: [
        {
          role: 'system',
          content: "You are a master children's book author who understands visual storytelling and the power of pacing through character-free atmospheric pages."
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    job.progress = 70;
    job.message = 'Processing AI response...';

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (!raw) throw new Error('Empty model response');
    const storyData: StoryResponse = JSON.parse(raw);

    job.progress = 80;
    job.message = 'Enhancing story pages...';

    // Validate and enhance pages
    const enhancedPages = storyData.pages.map((page, index) => {
      const shotId = shotSequence[index] || 'establishing_wide';
      const shot = HIGH_CONTRAST_SHOTS[shotId];
      
      const charactersOnPage: PersonId[] = [];
      
      // Only process characters for character pages
      if (shot?.requires_character && page.characters_on_page) {
        for (const char of page.characters_on_page) {
          const personId = mapToPersonId(char, babyProfile.baby_name);
          if (personId && !charactersOnPage.includes(personId)) {
            charactersOnPage.push(personId);
          }
        }
        
        // Ensure baby is included if not specified
        if (charactersOnPage.length === 0 && !page.is_character_free) {
          charactersOnPage.push('baby');
        }
      }

      return {
        ...page,
        page_number: page.page_number,
        shot_id: shotId,
        shot_description: shot?.name || 'Unique angle',
        is_character_free: !shot?.requires_character,
        characters_on_page: charactersOnPage,
        scene_type: page.scene_type || (
          index === 0 ? 'opening' : 
          index === storyData.pages.length - 1 ? 'closing' : 
          page.is_character_free ? 'transition' : 'action'
        ),
        emotion: page.emotion || 'joy',
        layout_template: 'auto',
        page_goal: page.page_goal || `Page ${index + 1} beat`,
        object_focus: page.object_focus || (page.is_character_free ? 'atmospheric detail' : undefined)
      };
    });

    job.progress = 90;
    job.message = 'Finalizing story...';

    const enhancedStory = {
      title: storyData.title,
      refrain: storyData.refrain,
      pages: enhancedPages,
      cast_members: Array.from(new Set(enhancedPages.flatMap(p => p.characters_on_page))),
      metadata: {
        ...storyData.metadata,
        emotional_core: storyData.emotional_core,
        story_arc: storyData.story_arc,
        includes_character_free_pages: true
      },
      style: 'isolated-paper-collage',
      high_contrast_sequence: shotSequence,
      gender: babyGender
    };

    job.progress = 100;
    job.status = 'completed';
    job.result = enhancedStory;
    job.completedAt = Date.now();
    job.message = 'Story generation complete!';

    console.log(`Story job ${jobId} completed successfully`);

  } catch (error: any) {
    console.error(`Story job ${jobId} failed:`, error);
    
    const job = storyJobs.get(jobId);
    if (job) {
      // If it fails, provide fallback story
      const safeName = params.babyProfile?.baby_name || 'Baby';
      const safeBirth = params.babyProfile?.birthdate || '2024-01-01';
      const safeGender = params.babyProfile?.gender || 'neutral';
      
      job.status = 'completed';
      job.result = createEngagingFallbackStory(
        safeName,
        calculateAgeInMonths(safeBirth),
        safeGender
      );
      job.completedAt = Date.now();
      job.message = 'Used fallback story due to generation error';
    }
  }
}

// POST - Start story generation job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { babyProfile, conversation, illustrationStyle, storyLength } = body;

    if (!babyProfile?.baby_name || !babyProfile?.birthdate) {
      // Return fallback immediately if missing data
      const safeName = babyProfile?.baby_name || 'Baby';
      const safeBirth = babyProfile?.birthdate || '2024-01-01';
      const safeGender = babyProfile?.gender || 'neutral';
      
      return NextResponse.json({
        success: true,
        story: createEngagingFallbackStory(
          safeName,
          calculateAgeInMonths(safeBirth),
          safeGender
        )
      }, { status: 200 });
    }

    // Create job ID
    const jobId = `story-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Create job entry
    const job: StoryJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
      babyName: babyProfile.baby_name,
      message: 'Starting story generation...'
    };
    
    storyJobs.set(jobId, job);
    
    // Start async processing
    processStoryGeneration(jobId, body).catch(error => {
      console.error(`Failed to process story job ${jobId}:`, error);
      const job = storyJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        job.completedAt = Date.now();
      }
    });
    
    // Return job ID immediately
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Story generation started'
    });
    
  } catch (error: any) {
    console.error('Failed to start story generation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start story generation' },
      { status: 500 }
    );
  }
}

// GET - Check job status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  
  if (!jobId) {
    return NextResponse.json(
      { error: 'Job ID required' },
      { status: 400 }
    );
  }
  
  const job = storyJobs.get(jobId);
  
  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      result: job.result,
      error: job.error,
      duration: job.completedAt 
        ? job.completedAt - job.startTime 
        : Date.now() - job.startTime
    }
  });
}

// DELETE - Clean up jobs
export async function DELETE() {
  try {
    storyJobs.clear();
    
    return NextResponse.json({ 
      success: true, 
      message: 'All story jobs cleared'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to clear jobs' },
      { status: 500 }
    );
  }
}