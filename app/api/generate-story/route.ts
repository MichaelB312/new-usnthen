// app/api/generate-story/route.ts
/**
 * Async Story Generation with Job Queue
 * Prevents frontend timeouts by using polling pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { PersonId } from '@/lib/store/bookStore';
import { generateCameraSequence, CAMERA_ANGLES } from '@/lib/camera/highContrastShots';
import { generateSpreadSequence } from '@/lib/sequence/spreadSequence';

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
  camera_angle?: string; // Fallback if GPT returns this instead of shot_id
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
  // SIMPLIFIED: Always return 4 pages (landscape spreads)
  // Each page is 1536×1024 and displays as an "open book" with divider
  return 4;
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

/**
 * Extract setting from location answer
 */
function extractSetting(location: string): string {
  const loc = location.toLowerCase();
  if (loc.includes('beach') || loc.includes('ocean') || loc.includes('sea')) return 'beach';
  if (loc.includes('park')) return 'park';
  if (loc.includes('home') || loc.includes('house') || loc.includes('room')) return 'home';
  if (loc.includes('backyard') || loc.includes('garden')) return 'backyard';
  if (loc.includes('pool') || loc.includes('water')) return 'pool';
  if (loc.includes('grandma') || loc.includes('grandpa')) return 'grandparents house';
  return location || 'outdoor setting';
}

/**
 * Extract cast members from "who was there" answer
 */
function extractCastMembers(whoWasThere: string, babyName: string): PersonId[] {
  const cast: PersonId[] = ['baby']; // Baby is always included
  const text = whoWasThere.toLowerCase();

  // Map common phrases to PersonId
  if (text.includes('mom') || text.includes('mommy') || text.includes('mama') || text.includes('mother')) {
    cast.push('mom');
  }
  if (text.includes('dad') || text.includes('daddy') || text.includes('papa') || text.includes('father')) {
    cast.push('dad');
  }
  if (text.includes('grandma') || text.includes('granny') || text.includes('nana') || text.includes('grandmother')) {
    cast.push('grandma');
  }
  if (text.includes('grandpa') || text.includes('granddad') || text.includes('grandfather') || text.includes('papa')) {
    if (!cast.includes('dad')) { // Only add if not already added as dad
      cast.push('grandpa');
    }
  }
  if (text.includes('brother') || text.includes('sister') || text.includes('sibling')) {
    cast.push('sibling');
  }
  if (text.includes('aunt') || text.includes('auntie')) {
    cast.push('aunt');
  }
  if (text.includes('uncle')) {
    cast.push('uncle');
  }
  if (text.includes('friend')) {
    cast.push('friend');
  }

  return cast;
}

function createEngagingFallbackStory(
  babyName: string,
  ageInMonths: number,
  gender: 'boy' | 'girl' | 'neutral' = 'neutral'
): any {
  const pageCount = getPageCount(ageInMonths);
  const refrain = 'What joy!';
  const cameraSequence = generateCameraSequence(pageCount);

  const pages = [
    {
      narration: `${babyName} crawls closer. Eyes wide! ${refrain}`,
      page_goal: 'Opening scene with excitement',
      characters_on_page: ['baby' as PersonId],
      camera_angle: cameraSequence[0],
      shot_description: CAMERA_ANGLES[cameraSequence[0]].name,
      emotion: 'excited' as const,
      visual_action: 'crawling forward eagerly',
      sensory_details: 'Movement, anticipation'
    },
    {
      narration: `Tiny fingers reach and grab! *Squeak!*`,
      page_goal: 'The moment of contact',
      characters_on_page: ['baby' as PersonId],
      camera_angle: cameraSequence[1],
      shot_description: CAMERA_ANGLES[cameraSequence[1]].name,
      emotion: 'joy' as const,
      visual_focus: 'hands',
      visual_action: 'grabbing toy',
      sensory_details: 'Texture, squeeze'
    },
    {
      narration: `Splash splash splash! ${babyName} plays! ${refrain}`,
      page_goal: 'Peak action and joy',
      characters_on_page: ['baby' as PersonId],
      camera_angle: cameraSequence[2],
      shot_description: CAMERA_ANGLES[cameraSequence[2]].name,
      emotion: 'joy' as const,
      visual_action: 'splashing in bath',
      sensory_details: 'Water, bubbles, laughter'
    },
    {
      narration: `Mommy wraps ${babyName} warm and snug.`,
      page_goal: 'Comfort and care',
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      camera_angle: cameraSequence[3],
      shot_description: CAMERA_ANGLES[cameraSequence[3]].name,
      emotion: 'peaceful' as const,
      visual_action: 'being wrapped in towel',
      sensory_details: 'Soft, warm, cozy'
    }
  ];

  return {
    title: `${babyName}'s Splish Splash`,
    refrain,
    emotional_core: 'The simple joy of discovery and play',
    story_arc: 'excitement → joy → comfort',
    cast_members: ['baby', 'mom'],
    metadata: {
      emotional_core: 'A celebration of simple pleasures and loving care',
      story_arc: 'action → joy → comfort'
    },
    style: 'paper-collage',
    gender,
    camera_sequence: cameraSequence,
    pages: pages.map((page, i) => ({
      page_number: i + 1,
      ...page,
      shot_id: page.camera_angle, // For backward compatibility
      action_description: page.visual_action || 'Scene moment',
      scene_type: i === 0 ? 'opening' : i === pageCount - 1 ? 'closing' : 'action',
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
    job.message = 'Reading your precious memory...';

    const { babyProfile, conversation, illustrationStyle, storyLength } = params;

    // Extract memory details - ENHANCED with new fields
    const memory = conversation.find((c: any) => c.question === 'memory_anchor')?.answer || '';
    const location = conversation.find((c: any) => c.question === 'location')?.answer || '';
    const whoWasThere = conversation.find((c: any) => c.question === 'who_was_there')?.answer || '';
    const specialObject = conversation.find((c: any) => c.question === 'special_object')?.answer || '';
    const milestoneCheck = conversation.find((c: any) => c.question === 'milestone_check')?.answer || '';
    const milestoneDetail = conversation.find((c: any) => c.question === 'milestone_detail')?.answer || '';
    const whySpecial = conversation.find((c: any) => c.question === 'why_special')?.answer || '';
    const storyBeginning = conversation.find((c: any) => c.question === 'story_beginning')?.answer || '';
    const storyMiddle = conversation.find((c: any) => c.question === 'story_middle')?.answer || '';
    const storyEnd = conversation.find((c: any) => c.question === 'story_end')?.answer || '';
    const sensoryDetails = conversation.find((c: any) => c.question === 'sensory_details')?.answer || '';

    // Extract setting from location
    const setting = extractSetting(location);

    // Extract cast members from "who was there" answer
    const extractedCast = extractCastMembers(whoWasThere, babyProfile.baby_name);

    // Detect if this is a milestone moment
    const isMilestone = milestoneCheck.toLowerCase().includes('yes') || milestoneCheck.toLowerCase().includes('first') || milestoneCheck.toLowerCase().includes('milestone');

    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const pageCount = getPageCount(ageInMonths);
    const wordLimits = getWordLimit(ageInMonths);
    const babyGender = babyProfile.gender || 'neutral';
    const storyGuidelines = getStoryGuidelines(ageInMonths);

    job.progress = 20;

    // Generate diverse camera sequence for this story
    const cameraSequence = generateCameraSequence(pageCount);

    // Build camera angle options for GPT
    const cameraAngleOptions = Object.entries(CAMERA_ANGLES).map(([id, angle]) => {
      return `"${id}": ${angle.name} - ${angle.description}
        Best for: ${angle.best_for?.join(', ') || 'versatile scenes'}`;
    }).join('\n\n');

    job.progress = 30;
    job.message = 'Crafting your story...';

    // Gender-specific guidance
    const genderGuidance = babyGender === 'girl'
      ? 'Baby girl with feminine charm and sweetness'
      : babyGender === 'boy'
      ? 'Baby boy with boyish energy and playfulness'
      : 'Baby with joyful, curious spirit';

    // Enhanced story generation prompt with all context + onomatopoeia
    const prompt = `You are creating an emotionally engaging children's book with MAXIMUM VISUAL VARIETY using different camera angles for each page.

CREATE A STORY FOR: ${babyProfile.baby_name}, a ${babyGender === 'girl' ? 'baby girl' : babyGender === 'boy' ? 'baby boy' : 'baby'}, age ${ageInMonths} months.

MEMORY CONTEXT:
- Core memory: ${memory}
- Location/Setting: ${location || 'outdoor setting'}
- Who was there: ${whoWasThere || 'Just baby'}
- Special object: ${specialObject || 'None'}
- Milestone: ${isMilestone ? `Yes - ${milestoneDetail || milestoneCheck}` : 'No'}
- Why special: ${whySpecial}
- Story beginning: ${storyBeginning}
- Story middle: ${storyMiddle}
- Story ending: ${storyEnd}
- Sensory details: ${sensoryDetails}

CAST MEMBERS DETECTED: ${extractedCast.join(', ')}

AGE-APPROPRIATE GUIDELINES:
${storyGuidelines}

🔊 ONOMATOPOEIA RULES (Sound Words):
${ageInMonths < 12 ? `Ages 0-12 months: Use simple sound words as main text elements. Examples: "Splash!", "Woof!", "Beep!"` :
  ageInMonths < 24 ? `Ages 12-24 months: Integrate sounds into simple sentences with repetition. Examples: "The duck says, Quack, quack!", "Knock, knock!"` :
  ageInMonths < 48 ? `Ages 24-48 months: Use sounds to punctuate actions. Examples: "He jumped. SPLASH, SPLASH!", "Swoosh went the leaves."` :
  `Ages 48+ months: Integrate sounds smoothly into complex sentences. Examples: "...with a satisfying squelch", "Pop, pop, pop went the popcorn"`}
- Add onomatopoeia (sound words) naturally based on actions
- Sound words should match the age guidelines above
- Format sound words in UPPERCASE for emphasis
- Examples: SPLASH, WOOSH, GIGGLE, THUMP, SWOOSH, MUNCH, POP

WORD LIMIT: ${wordLimits.min}-${wordLimits.max} words per page (STRICT)
PAGE COUNT: ${pageCount} pages

SUGGESTED CAMERA SEQUENCE (use these for maximum variety):
${cameraSequence.map((angleId, i) => `Page ${i + 1}: ${CAMERA_ANGLES[angleId].name} - ${CAMERA_ANGLES[angleId].description}`).join('\n')}

AVAILABLE CAMERA ANGLES:
${cameraAngleOptions}

🎬 CRITICAL CAMERA ANGLE RULES:
1. **EVERY PAGE MUST HAVE A COMPLETELY DIFFERENT CAMERA ANGLE** - No repeats!
2. **EVERY PAGE MUST HAVE A COMPLETELY DIFFERENT ACTION** - Vary what the baby is doing!
3. Each page should show a different moment/action:
   - Different body positions (standing, sitting, crawling, reaching, etc.)
   - Different locations or parts of the scene
   - Different emotional expressions
4. Use the suggested camera sequence above, or choose different angles that match your narrative
5. Return camera_angle field with the angle ID (e.g., "wide_shot", "birds_eye", etc.)

OUTPUT JSON (exact structure):
{
  "title": "Short, emotionally evocative title",
  "refrain": "2-4 word rhythmic refrain",
  "emotional_core": "The heart of this story in one sentence",
  "story_arc": "The emotional journey",
  "cast_members": [${extractedCast.map(c => `"${c}"`).join(', ')}],
  "pages": [
    {
      "page_number": 1,
      "narration": "${wordLimits.min}-${wordLimits.max} words with ONOMATOPOEIA in UPPERCASE",
      "page_goal": "What this page achieves narratively",
      "camera_angle": "CHOOSE from available camera angles - MUST be different for each page",
      "shot_description": "Copy the name of the chosen camera angle",
      "visual_action": "SPECIFIC action - MUST be different from other pages",
      "action_description": "How this action serves the story",
      "visual_focus": "Key visual element${specialObject ? ` (include ${specialObject} if relevant)` : ''}",
      "emotion": "joy/wonder/peaceful/curious/proud/excited",
      "sensory_details": "${sensoryDetails || 'What can be felt/heard/seen'}",
      "characters_on_page": ["baby"${extractedCast.length > 1 ? `, "mom/dad/grandma/etc" - assign supporting characters strategically` : ''}],
      "scene_type": "opening/action/closing/transition"
    }
  ]
}

📋 STORY STRUCTURE GUIDE (use the provided story arc):
- Page 1 (Opening): ${storyBeginning || 'How the moment started'}
- Pages 2-3 (Middle): ${storyMiddle || 'The exciting part, include small challenge if mentioned'}
- Page 4 (Closing): ${storyEnd || 'Sweet conclusion'}

👥 CHARACTER ASSIGNMENT GUIDELINES:
- Page 1: Usually baby alone (establishing shot)
- Pages 2-3: Can include baby + supporting characters during action
- Page 4: Often baby + parent/family for emotional resolution
- Assign characters based on who would naturally be in each scene moment

🎯 CRITICAL REMINDERS:
- Each page MUST have a DIFFERENT camera_angle
- Each page MUST show a DIFFERENT action
- NO repeated camera angles across pages
- NO repeated actions across pages
- Maximum visual variety = better book!
- Include onomatopoeia (sound words) in UPPERCASE
- Use the story beginning/middle/end to structure pages
- Assign characters to pages where they fit the narrative`;

    job.progress = 50;
    job.message = `Writing ${babyProfile.baby_name}'s story...`;

    // Call OpenAI with enhanced prompt
    const completion = await openai.chat.completions.create({
      model: STORY_MODEL,
      messages: [
        {
          role: 'system',
          content: "You are a master children's book author who understands age-appropriate storytelling, visual variety through camera angles, and the engaging power of onomatopoeia (sound words). You know how to structure stories with clear beginning-middle-end arcs and assign supporting characters to appropriate pages for emotional impact."
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    job.progress = 70;
    job.message = 'Bringing the story to life...';

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (!raw) throw new Error('Empty model response');
    const storyData: StoryResponse = JSON.parse(raw);

    job.progress = 80;
    job.message = 'Adding the finishing touches...';

    // Validate and enhance pages
    const enhancedPages = storyData.pages.map((page, index) => {
      // Use GPT's chosen camera_angle (or shot_id as fallback)
      const cameraAngle = page.camera_angle || page.shot_id || 'medium_shot';
      const angle = CAMERA_ANGLES[cameraAngle];

      if (!angle) {
        console.warn(`Unknown camera_angle: ${cameraAngle}, defaulting to medium_shot`);
      }

      const charactersOnPage: PersonId[] = [];

      // Process characters on page
      if (page.characters_on_page && page.characters_on_page.length > 0) {
        for (const char of page.characters_on_page) {
          const personId = mapToPersonId(char, babyProfile.baby_name);
          if (personId && !charactersOnPage.includes(personId)) {
            charactersOnPage.push(personId);
          }
        }
      }

      // Ensure baby is included if not specified
      if (charactersOnPage.length === 0) {
        charactersOnPage.push('baby');
      }

      return {
        ...page,
        page_number: page.page_number,
        narration: page.narration,
        visual_prompt: page.visual_action || page.action_description || 'Scene description',
        shot_id: cameraAngle, // For backward compatibility
        camera_angle: cameraAngle,
        shot_description: angle?.name || page.shot_description || 'Unique angle',
        characters_on_page: charactersOnPage,
        scene_type: page.scene_type || (
          index === 0 ? 'opening' :
          index === storyData.pages.length - 1 ? 'closing' : 'action'
        ),
        emotion: page.emotion || 'joy',
        layout_template: 'auto',
        page_goal: page.page_goal || `Page ${index + 1} beat`
      };
    });

    job.progress = 90;

    // Generate landscape spread sequence metadata
    const spreadSequences = generateSpreadSequence(enhancedPages, storyData.metadata);

    // Attach sequence metadata to pages (spreads) + setting
    const pagesWithSequence = enhancedPages.map((page, index) => {
      const spreadIndex = Math.floor(index / 2);
      return {
        ...page,
        spread_metadata: {
          ...spreadSequences[spreadIndex],
          setting: setting, // Add extracted setting
          special_object: specialObject || undefined
        }
      };
    });

    job.message = 'Almost there...';

    const enhancedStory = {
      title: storyData.title,
      refrain: storyData.refrain,
      pages: pagesWithSequence,
      cast_members: Array.from(new Set(enhancedPages.flatMap(p => p.characters_on_page))),
      metadata: {
        ...storyData.metadata,
        emotional_core: storyData.emotional_core,
        story_arc: storyData.story_arc,
        includes_character_free_pages: true,
        spread_sequences: spreadSequences  // Store sequences in metadata
      },
      style: 'isolated-paper-collage',
      high_contrast_sequence: enhancedPages.map(p => p.shot_id), // Extract shot sequence from GPT's choices
      gender: babyGender
    };

    job.progress = 100;
    job.status = 'completed';
    job.result = enhancedStory;
    job.completedAt = Date.now();
    job.message = `${babyProfile.baby_name}'s story is ready!`;

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