// app/api/generate-story/route.ts
/**
 * Async Story Generation with Job Queue
 * Prevents frontend timeouts by using polling pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PersonId } from '@/lib/store/bookStore';
import { generateCameraSequence, CAMERA_ANGLES } from '@/lib/camera/highContrastShots';
import { generateSpreadSequence } from '@/lib/sequence/spreadSequence';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const STORY_MODEL = 'gemini-2.5-flash';

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

function getWordLimit(ageInMonths: number): { min: number; max: number; total: { min: number; max: number } } {
  // Per-page word limits based on master prompt guidelines
  if (ageInMonths < 6) return { min: 3, max: 8, total: { min: 50, max: 100 } };  // 0-6 months (infant)
  if (ageInMonths < 12) return { min: 5, max: 12, total: { min: 75, max: 150 } }; // 6-12 months (infant)
  if (ageInMonths < 24) return { min: 8, max: 15, total: { min: 100, max: 200 } }; // 12-24 months (toddler)
  if (ageInMonths < 48) return { min: 15, max: 30, total: { min: 200, max: 600 } }; // 2-4 years (preschooler)
  return { min: 25, max: 50, total: { min: 500, max: 1000 } }; // 4-6 years (kindergartener)
}

function getStoryGuidelines(ageInMonths: number): string {
  if (ageInMonths < 24) {
    // 0-2 years (Infant/Toddler)
    return `AGE-SPECIFIC WRITING GUIDELINES (0-2 YEARS - INFANT/TODDLER):

FOCUS: Rhythm, repetition, and naming the world. Tone should be gentle and soothing.

LANGUAGE RULES:
- Use simple, declarative sentences (e.g., "Yara sees the big, blue water.")
- Heavy use of onomatopoeia ("Splash! Splash!", "Swoosh!")
- Repetition is your friend - repeat key phrases for rhythm
- Name objects and actions clearly ("This is sand. Soft, warm sand.")
- Use sensory words (warm, soft, bright, loud)

NARRATIVE STRUCTURE:
- Simple, linear sequence of events
- No complex problems or conflicts
- Focus on discovery and sensory experience
- Each page = one clear moment/action
- Build gentle anticipation through simple cause-and-effect

EMOTIONAL TONE:
- Warm, reassuring, joyful
- Celebrate small discoveries
- Emphasize parent-child bond and safety

EXAMPLE:
"Yara's toes wiggle in the warm sand. Wiggle, wiggle!
Down she sits. PLOP!
What's that sound? SWOOSH! SWOOSH!
It's the big, blue waves!"`;
  } else if (ageInMonths < 48) {
    // 2-4 years (Preschooler)
    return `AGE-SPECIFIC WRITING GUIDELINES (2-4 YEARS - PRESCHOOLER):

FOCUS: A clear emotional journey and a simple, relatable problem-and-resolution.

LANGUAGE RULES:
- Mix of simple and compound sentences
- Introduce simple dialogue that feels natural
- More descriptive words, but still concrete (not abstract)
- Action verbs that show movement (reached, grabbed, splashed, giggled)
- Use "show don't tell" - describe actions/expressions, not emotions directly

NARRATIVE STRUCTURE (3-ACT):
- ACT 1 (Setup): Introduce the scene and build anticipation
- ACT 2 (Challenge): Present a "little challenge" (hesitation, uncertainty, small obstacle)
- ACT 3 (Resolution): Show the child overcoming it with family support, ending with joy

THE EMOTIONAL CORE IS KEY:
- Identify the central feeling (excitement, bravery, wonder, love)
- Every page should connect back to this core emotion
- Show character growth through the experience

EXAMPLE:
"Yara stared at the big waves. They looked... scary.
'It's okay, sweetie,' Mama whispered. 'I'm right here.'
Yara took one tiny step. Then another.
SPLASH! The water tickled her toes!
She looked up at Mama and giggled. 'Again! Again!'"`;
  } else {
    // 4-6 years (Kindergartener)
    return `AGE-SPECIFIC WRITING GUIDELINES (4-6 YEARS - KINDERGARTENER):

FOCUS: Themes of discovery, family bonds, and character growth. Humor and dialogue are effective.

LANGUAGE RULES:
- Varied sentence structures (short for impact, longer for description)
- Robust vocabulary, but still accessible (brave, determined, curious, magnificent)
- Natural dialogue that reveals character and emotion
- Use metaphors and similes sparingly ("as big as a house", "like a giant blanket")
- "Show don't tell" is critical - describe expressions, body language, reactions

NARRATIVE STRUCTURE (COMPLETE ARC):
- BEGINNING (Pages 1-3): Set scene, introduce characters, build anticipation/wonder
- RISING ACTION (Pages 4-7): The discovery, exploration, and any challenges faced
- CLIMAX (Page 8-9): The main event or achievement
- RESOLUTION (Pages 10-12): Warm conclusion, emotional satisfaction, lesson learned

CHARACTER DEVELOPMENT:
- Show internal thoughts through actions ("She bit her lip")
- Demonstrate growth (from hesitant to confident, scared to brave)
- Include meaningful interactions with family members
- Celebrate the achievement with genuine emotion

EXAMPLE:
"Yara stood at the edge of the beach, her eyes wide as saucers. The ocean stretched out before her, bigger than anything she'd ever seen.
'You ready, sweetheart?' Dad asked, his hand warm in hers.
Yara took a deep breath. She wasn't sure, but... she wanted to be brave.
'Let's do it!' she declared, squeezing Dad's hand tight.
Together, they stepped forward. And when that first wave washed over her feet, Yara's surprised laugh rang out across the beach."`;
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

    // Master prompt for children's book generation
    const prompt = `You are an expert children's book author with deep understanding of child psychology and narrative structure.

Your task is to transform the following raw story data into a beautiful, warm, and engaging children's book manuscript.

=== TARGET READER ===
Child Name: ${babyProfile.baby_name}
Age: ${ageInMonths} months (${ageInMonths < 24 ? '0-2 years: Infant/Toddler' : ageInMonths < 48 ? '2-4 years: Preschooler' : '4-6 years: Kindergartener'})
Gender: ${babyGender === 'girl' ? 'baby girl' : babyGender === 'boy' ? 'baby boy' : 'baby'}

=== STORY DATA (The User's Memory) ===
Core Memory: ${memory}
Location: ${location || 'outdoor setting'}
Who Was There: ${whoWasThere || 'Just baby'}
Special Object: ${specialObject || 'None'}
Milestone: ${isMilestone ? `Yes - ${milestoneDetail || milestoneCheck}` : 'No'}
Emotional Significance: ${whySpecial}

STORY ARC (provided by parent):
- Beginning: ${storyBeginning}
- Middle: ${storyMiddle}
- Ending: ${storyEnd}

Sensory Details: ${sensoryDetails}
Cast Members: ${extractedCast.join(', ')}

=== MASTER STORYTELLING PRINCIPLES ===

${storyGuidelines}

=== CRITICAL WRITING RULES ===

1. POINT OF VIEW: Write in third-person limited, focusing on ${babyProfile.baby_name}'s feelings and experiences. The reader should feel like they are right there with ${babyProfile.baby_name}.

2. TENSE: Use past tense for classic storytelling (e.g., "${babyProfile.baby_name} saw the waves.")

3. TONE: Consistently warm, loving, and reassuring throughout.

4. SHOW, DON'T TELL EMOTIONS:
   ❌ BAD: "She was happy."
   ✅ GOOD: "A giant smile spread across ${babyProfile.baby_name}'s face, and she let out a happy giggle."

   ❌ BAD: "He felt scared."
   ✅ GOOD: "${babyProfile.baby_name} stopped. His eyes grew wide, and he reached for Daddy's hand."

5. CENTRAL EMOTION AS NORTH STAR:
   The emotional core is: ${whySpecial || 'joy and wonder'}
   Every page must connect back to this feeling in some way.

6. SENSORY IMAGERY:
   Weave in these sensory details throughout: ${sensoryDetails || 'sights, sounds, feelings'}
   Create a vivid, multi-sensory world.

7. WORD COUNT (STRICT):
   - Per page: ${wordLimits.min}-${wordLimits.max} words
   - Total story: ${wordLimits.total.min}-${wordLimits.total.max} words
   - Page count: ${pageCount} pages

=== NARRATIVE STRUCTURE (Paced ${pageCount}-Page Story) ===

${pageCount === 4 ? `
SETUP (Pages 1-2): Use story_beginning to set scene, introduce characters, build anticipation
ACTION (Page 3): Main event from story_middle, show discovery/challenge with family support
CONCLUSION (Page 4): Use story_end to wind down, warm and emotionally satisfying
` : `
SETUP (Pages 1-3): Use story_beginning to set scene, introduce characters, build anticipation
DISCOVERY & ACTION (Pages 4-7): Heart of story from story_middle, show reactions and any challenges
CONCLUSION (Pages 8-${pageCount}): Use story_end to wind down, warm and emotionally satisfying
`}

=== VISUAL VARIETY (Critical for Illustrations) ===

CAMERA ANGLES (use these for maximum visual variety):
${cameraSequence.map((angleId, i) => `Page ${i + 1}: ${CAMERA_ANGLES[angleId].name} - ${CAMERA_ANGLES[angleId].description}`).join('\n')}

AVAILABLE CAMERA ANGLES:
${cameraAngleOptions}

🎬 CAMERA ANGLE RULES:
- EVERY page MUST use a COMPLETELY DIFFERENT camera angle (no repeats!)
- EVERY page MUST show a DIFFERENT action/moment
- Vary body positions: standing, sitting, crawling, reaching, jumping, etc.
- Vary locations within the scene
- Vary emotional expressions page to page

=== CHARACTER ASSIGNMENT ===
Cast available: ${extractedCast.join(', ')}

Guidelines:
- Opening pages: Often ${babyProfile.baby_name} alone or with one parent (establishing shot)
- Middle pages: Can include ${babyProfile.baby_name} + supporting characters during action
- Closing pages: Often ${babyProfile.baby_name} + family for emotional resolution
- Assign characters where they naturally fit the narrative moment

=== OUTPUT FORMAT (EXACT JSON STRUCTURE) ===

{
  "title": "Short, emotionally evocative title (3-6 words)",
  "refrain": "2-4 word rhythmic refrain (optional, can be empty string)",
  "emotional_core": "The heart of this story in one sentence",
  "story_arc": "The emotional journey in 3-5 words",
  "cast_members": [${extractedCast.map(c => `"${c}"`).join(', ')}],
  "pages": [
    {
      "page_number": 1,
      "narration": "The actual text that appears on the page (${wordLimits.min}-${wordLimits.max} words). SHOW emotions through actions. Include onomatopoeia in UPPERCASE where natural.",
      "visual_action": "Brief scene description for illustrator (what ${babyProfile.baby_name} is doing, where, key visual elements)",
      "action_description": "How this visual serves the narrative",
      "page_goal": "What this page achieves in the story arc",
      "camera_angle": "MUST choose from available angles - different for each page",
      "shot_description": "Name of the chosen camera angle",
      "visual_focus": "Key visual element to emphasize${specialObject ? ` (include ${specialObject} if relevant)` : ''}",
      "emotion": "joy/wonder/peaceful/curious/proud/excited/brave/loved",
      "sensory_details": "Specific sensory elements for this page",
      "characters_on_page": ["baby"${extractedCast.length > 1 ? `, "mom", "dad", etc. - assign strategically` : ''}],
      "scene_type": "opening/action/closing/transition"
    }
  ]
}

=== FINAL CHECKLIST ===
✓ Age-appropriate vocabulary and sentence structure
✓ Word count within limits (per page AND total)
✓ All emotions shown through actions, not stated
✓ Central emotional theme woven throughout
✓ Sensory details create vivid world
✓ Each page has unique camera angle (no repeats!)
✓ Each page shows different action/moment
✓ Characters assigned naturally to pages
✓ Narrative flows from beginning → middle → end
✓ Warm, loving, reassuring tone throughout
✓ Third-person past tense consistently
✓ Onomatopoeia included where natural (UPPERCASE)

Now create the complete ${pageCount}-page children's book manuscript in JSON format.`;

    job.progress = 50;
    job.message = `Writing ${babyProfile.baby_name}'s story...`;

    // Call Gemini with master prompt
    const systemPrompt = `You are an expert children's book author with deep understanding of child psychology and narrative structure.

You excel at:
- Age-appropriate storytelling (adapting vocabulary, sentence structure, and themes to the child's developmental stage)
- "Show don't tell" emotional writing (revealing feelings through actions, expressions, and body language)
- Creating warm, loving, reassuring narratives that strengthen family bonds
- Weaving sensory details that create vivid, immersive worlds
- Building clear narrative arcs (setup → action/challenge → resolution)
- Using onomatopoeia and rhythm to engage young readers
- Third-person limited perspective that makes readers feel present in the moment
- Visual variety for illustrations (varied camera angles, actions, and compositions)

You follow instructions precisely and create beautiful, emotionally resonant children's books.

IMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, just pure JSON.`;

    const fullPrompt = `${systemPrompt}

${prompt}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: 'application/json',
      },
    });

    job.progress = 70;
    job.message = 'Bringing the story to life...';

    const raw = result.response.text().trim();
    if (!raw) throw new Error('Empty model response');

    // Remove markdown code blocks if present
    const jsonText = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const storyData: StoryResponse = JSON.parse(jsonText);

    job.progress = 80;
    job.message = 'Adding the finishing touches...';

    // Validate word counts
    const totalWords = storyData.pages.reduce((sum, page) => {
      const words = page.narration.split(/\s+/).length;
      return sum + words;
    }, 0);

    console.log(`Story word count: ${totalWords} (target: ${wordLimits.total.min}-${wordLimits.total.max})`);

    // Warn if word count is significantly off
    if (totalWords < wordLimits.total.min * 0.8 || totalWords > wordLimits.total.max * 1.2) {
      console.warn(`⚠️ Story word count (${totalWords}) is outside target range (${wordLimits.total.min}-${wordLimits.total.max})`);
    }

    // Validate and enhance pages
    const enhancedPages = storyData.pages.map((page, index) => {
      const pageWordCount = page.narration.split(/\s+/).length;

      // Log word count per page
      if (pageWordCount < wordLimits.min || pageWordCount > wordLimits.max) {
        console.warn(`⚠️ Page ${index + 1} word count (${pageWordCount}) outside range (${wordLimits.min}-${wordLimits.max})`);
      }
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