// app/api/generate-story/route.ts
/**
 * Async Story Generation with Job Queue
 * Prevents frontend timeouts by using polling pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PersonId, type Locale } from '@/lib/store/bookStore';
import { CAMERA_ANGLES } from '@/lib/camera/highContrastShots';
import { generateSpreadSequence } from '@/lib/sequence/spreadSequence';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

const STORY_MODEL = 'gemini-2.5-pro';

// Language name mapping for Gemini prompts
const LANGUAGE_NAMES: Record<Locale, string> = {
  'en': 'English',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'it': 'Italian'
};

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
  illustration_description: string; // NEW: Customer-friendly description of what the page will show
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
  is_refinement_only?: boolean; // DEPRECATED: Use is_minimalist_moment instead
  is_minimalist_moment?: boolean; // Mark 1-2 spreads as minimalist moments (single poetic sentence)
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
  // SIMPLIFIED: Always return 8 spreads (16 physical pages)
  // Each spread is 1536×1024 and displays as an "open book" with divider
  return 8;
}

function getWordLimit(ageInMonths: number): { min: number; max: number; total: { min: number; max: number } } {
  // Per-spread word limits (8 spreads total, but 1-2 are refinement-only with no narration)
  // So effective narration spreads: 6-7 spreads
  if (ageInMonths < 6) return { min: 3, max: 8, total: { min: 80, max: 160 } };  // 0-6 months (infant)
  if (ageInMonths < 12) return { min: 5, max: 12, total: { min: 120, max: 250 } }; // 6-12 months (infant)
  if (ageInMonths < 24) return { min: 8, max: 15, total: { min: 160, max: 320 } }; // 12-24 months (toddler)
  if (ageInMonths < 48) return { min: 15, max: 30, total: { min: 300, max: 900 } }; // 2-4 years (preschooler)
  return { min: 25, max: 50, total: { min: 800, max: 1600 } }; // 4-6 years (kindergartener)
}

function getStoryGuidelines(ageInMonths: number): string {
  if (ageInMonths < 24) {
    // 0-2 years (Infant/Toddler)
    return `AGE-SPECIFIC WRITING GUIDELINES (0-2 YEARS - INFANT/TODDLER):

FOCUS: Rhythm, repetition, naming the world, and simple interactive questions. Tone should be gentle and soothing.

LANGUAGE RULES:
- Use simple, declarative sentences (e.g., "Yara sees the big, blue water.")
- Heavy use of onomatopoeia ("Splash! Splash!", "Swoosh!")
- **RHYME IS ESPECIALLY POWERFUL** for this age - if using Rhyming Couplets style, keep rhymes simple and natural
- Repetition is your friend - repeat key phrases for rhythm (refrains, anaphora)
- Name objects and actions clearly ("This is sand. Soft, warm sand.")
- Use sensory words (warm, soft, bright, loud)
- Include simple questions to build anticipation ("What's that?", "Who's there?")

NARRATIVE STRUCTURE:
- Simple, linear sequence of events
- No complex problems or conflicts
- Focus on discovery and sensory experience
- Each spread = one clear moment/action
- Build gentle anticipation through simple cause-and-effect
- Use questions to create surprise and engagement before revealing

MILESTONE & FIRSTS EMPHASIS:
- If this is a "first" (first beach, first bath, first meeting), emphasize the novelty and wonder
- Capture the emotional significance of the moment
- Show the memory-making nature of the experience

EMOTIONAL TONE:
- Warm, reassuring, joyful
- Celebrate small discoveries and milestones
- Emphasize parent-child bond and safety

EXAMPLE:
"Yara's toes wiggle. What's that feeling?
Warm. Soft. It's sand!
What's that sound? SWOOSH! SWOOSH!
Down she sits. PLOP!
The big, blue waves say hello!"`;
  } else if (ageInMonths < 48) {
    // 2-4 years (Preschooler)
    return `AGE-SPECIFIC WRITING GUIDELINES (2-4 YEARS - PRESCHOOLER):

FOCUS: A clear emotional journey with a simple, relatable problem-and-resolution. Build anticipation with questions.

LANGUAGE RULES:
- Mix of simple and compound sentences
- **RHYME & RHYTHM** help memorability - if using rhyme, vary your patterns to keep it interesting
- Introduce simple dialogue that feels natural
- More descriptive words, but still concrete (not abstract)
- Action verbs that show movement (reached, grabbed, splashed, giggled)
- Use "show don't tell" - describe actions/expressions, not emotions directly
- Include engaging questions that build up to the moment ("What's in there?", "Where are we going?")
- **ALLOW HUMOR** - silly moments, playful actions, funny outcomes make stories engaging

NARRATIVE STRUCTURE (3-ACT):
- ACT 1 (Setup): Introduce the scene and build anticipation with questions
- ACT 2 (Challenge): Present a "little challenge" (hesitation, uncertainty, small obstacle)
- ACT 3 (Resolution): Show the child overcoming it with family support, ending with joy

THE EMOTIONAL CORE IS KEY:
- Identify the central feeling (excitement, bravery, wonder, love)
- Every spread should connect back to this core emotion
- Show character growth through the experience

MILESTONE & FIRSTS EMPHASIS:
- If this is a milestone or "first time" moment, make it special and memorable
- Capture what made this moment significant to the family
- Show the emotions and reactions that made it unforgettable

EXAMPLE:
"What was that big, sandy place?
Yara stared at the waves. They looked... scary.
'It's okay, sweetie,' Mama whispered. 'I'm right here.'
Yara took one tiny step. Then another.
SPLASH! The water tickled her toes!
She looked up at Mama and giggled. 'Again! Again!'"`;
  } else {
    // 4-6 years (Kindergartener)
    return `AGE-SPECIFIC WRITING GUIDELINES (4-6 YEARS - KINDERGARTENER):

FOCUS: Themes of discovery, family bonds, character growth, and milestones. Humor, dialogue, and anticipation-building questions are effective.

LANGUAGE RULES:
- Varied sentence structures (short for impact, longer for description)
- Robust vocabulary, but still accessible (brave, determined, curious, magnificent)
- Natural dialogue that reveals character and emotion
- Use metaphors and similes sparingly ("as big as a house", "like a giant blanket")
- "Show don't tell" is critical - describe expressions, body language, reactions
- Use questions to build suspense and engagement ("Where could this be?", "What would happen next?")

NARRATIVE STRUCTURE (COMPLETE ARC ACROSS 8 SPREADS):
- BEGINNING (Spreads 1-2): Set scene, introduce characters, build anticipation/wonder with questions
- RISING ACTION (Spreads 3-5): The discovery, exploration, and any challenges faced
- CLIMAX (Spreads 6-7): The main event or achievement
- RESOLUTION (Spread 8): Warm conclusion, emotional satisfaction, lesson learned

CHARACTER DEVELOPMENT:
- Show internal thoughts through actions ("She bit her lip")
- Demonstrate growth (from hesitant to confident, scared to brave)
- Include meaningful interactions with family members
- Celebrate the achievement with genuine emotion

MILESTONE & FIRSTS EMPHASIS:
- If this captures a meaningful "first" or milestone, give it the weight it deserves
- Show the family's pride and love
- Make the moment feel as special as it truly was

EXAMPLE:
"What was this place, stretching out forever?
Yara stood at the edge of the beach, her eyes wide as saucers. The ocean was bigger than anything she'd ever seen.
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

  const pages = [
    {
      narration: `${babyName} crawls closer. Eyes wide! ${refrain}`,
      illustration_description: `${babyName} crawling forward with wide eyes, looking excited.`,
      page_goal: 'Opening scene with excitement',
      characters_on_page: ['baby' as PersonId],
      camera_angle: 'establishing_wide',
      shot_description: CAMERA_ANGLES['establishing_wide']?.name || 'Establishing Wide',
      emotion: 'excited' as const,
      visual_action: 'crawling forward eagerly',
      sensory_details: 'Movement, anticipation'
    },
    {
      narration: `Tiny fingers reach and grab! *Squeak!*`,
      illustration_description: `${babyName}'s hands reaching out and grabbing a toy.`,
      page_goal: 'The moment of contact',
      characters_on_page: ['baby' as PersonId],
      camera_angle: 'discovery_moment',
      shot_description: CAMERA_ANGLES['discovery_moment']?.name || 'Discovery Moment',
      emotion: 'joy' as const,
      visual_focus: 'hands',
      visual_action: 'grabbing toy',
      sensory_details: 'Texture, squeeze'
    },
    {
      narration: `Splash splash splash! ${babyName} plays! ${refrain}`,
      illustration_description: `${babyName} playing in the bath, splashing water everywhere.`,
      page_goal: 'Peak action and joy',
      characters_on_page: ['baby' as PersonId],
      camera_angle: 'birds_eye_overhead',
      shot_description: CAMERA_ANGLES['birds_eye_overhead']?.name || "Bird's-Eye View",
      emotion: 'joy' as const,
      visual_action: 'splashing in bath',
      sensory_details: 'Water, bubbles, laughter'
    },
    {
      narration: `Mommy wraps ${babyName} warm and snug.`,
      illustration_description: `Mom wrapping ${babyName} in a cozy towel.`,
      page_goal: 'Comfort and care',
      characters_on_page: ['baby' as PersonId, 'mom' as PersonId],
      camera_angle: 'peek_through_frame',
      shot_description: CAMERA_ANGLES['peek_through_frame']?.name || 'Peek Through Frame',
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

    const { babyProfile, conversation, illustrationStyle, storyLength, locale = 'en' } = params;

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

    // Environmental elements (collected via conversation or defaults)
    const weatherCondition = conversation.find((c: any) => c.question === 'weather')?.answer || '';
    const timeOfDay = conversation.find((c: any) => c.question === 'time_of_day')?.answer || '';
    const sounds = conversation.find((c: any) => c.question === 'sounds')?.answer || '';
    const specialElements = conversation.find((c: any) => c.question === 'special_elements')?.answer || '';
    const toys = conversation.find((c: any) => c.question === 'toys')?.answer || specialObject;

    // Developmental abilities (critical for accurate physical descriptions)
    const developmentalAbilities = conversation.find((c: any) => c.question === 'developmental_abilities')?.answer || '';

    // Extract illustration feedback from preview (NEW)
    const illustrationFeedback = conversation.find((c: any) => c.question === 'illustration_feedback')?.answer || '';
    const editedPreviewPages = conversation.find((c: any) => c.question === 'edited_preview_pages')?.answer || '';

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

    // Build camera angle options for Gemini to intelligently select from
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

    // Poetic style parameter (can be passed in or default to lyrical prose)
    const poeticStyle = params.poeticStyle || 'Lyrical Prose'; // Options: 'Lyrical Prose', 'Rhyming Couplets', 'Subtle Rhyme'

    // Get language name for prompt
    const languageName = LANGUAGE_NAMES[locale as Locale] || 'English';

    // Master prompt for children's book generation
    const prompt = `You are a master children's book author and poet, renowned for your ability to capture the profound wonder of early childhood. You write with a lyrical, warm voice, turning simple memories into timeless, emotionally resonant stories. You understand that for a child, every new experience is epic.

**CRITICAL INSTRUCTION: Write the ENTIRE story in ${languageName.toUpperCase()} language.**
All narration text must be in ${languageName}. Use age-appropriate vocabulary in ${languageName} and maintain the warm, lyrical tone in ${languageName}.

=== THE GOLDEN RULE: TRUTH TO THE MEMORY ===
This is the most important rule. **You must be 100% faithful to the memory provided.**

- **DO NOT INVENT ACTIONS:** If the data says a coconut was there, describe the child SEEING it, TOUCHING it, or being NEAR it. DO NOT invent the action of sipping it unless the user's data explicitly says they did.
- **DO NOT CONTRADICT FACTS:** The story must align perfectly with the Core Memory, storyBeginning, storyMiddle, and storyEnd provided by the user. Your job is to narrate what happened, beautifully and accurately.
- **RESPECT DEVELOPMENTAL STAGE:** If the child could only sit at the time, they must be sitting in ALL descriptions. Never show them standing, walking, or performing actions beyond their developmental abilities.

Your task is to transform the following raw story data into a beautiful manuscript that accurately reflects this cherished memory.

=== TARGET READER ===
Child Name: ${babyProfile.baby_name}
Age: ${ageInMonths} months (${ageInMonths < 24 ? '0-2 years: Infant/Toddler' : ageInMonths < 48 ? '2-4 years: Preschooler' : '4-6 years: Kindergartener'})
Gender: ${babyGender === 'girl' ? 'baby girl' : babyGender === 'boy' ? 'baby boy' : 'baby'}

=== STORY DATA (The User's Memory) ===
Core Memory: ${memory}
Developmental Abilities: ${developmentalAbilities || `Assume age-appropriate abilities based on ${ageInMonths} months old`}
Location: ${location || 'outdoor setting'}
Who Was There: ${whoWasThere || 'Just baby'}
Special Object/Toy: ${specialObject || toys || 'None'}
Milestone: ${isMilestone ? `Yes - ${milestoneDetail || milestoneCheck}` : 'No'}
Emotional Significance: ${whySpecial}

STORY ARC (provided by parent):
- Beginning: ${storyBeginning}
- Middle: ${storyMiddle}
- Ending: ${storyEnd}

Sensory Details: ${sensoryDetails}
Cast Members: ${extractedCast.join(', ')}

${illustrationFeedback && illustrationFeedback !== 'approved' ? `
=== CUSTOMER ILLUSTRATION FEEDBACK ===
**CRITICAL: The customer reviewed a story preview and provided the following feedback on what they want to see in the illustrations:**

${illustrationFeedback}

**YOU MUST incorporate these requests into the illustration_description and visual_action fields for the appropriate pages.**
Ensure the requested elements (colors, objects, people, pets, etc.) appear exactly as the customer specified.
If the customer requested specific changes to specific pages, make sure those changes are reflected.
` : illustrationFeedback === 'approved' ? `
=== CUSTOMER APPROVAL ===
The customer reviewed and approved the story preview with no changes requested.
` : ''}

ENVIRONMENTAL ELEMENTS (weave these into the story for vivid scenes):
- Weather: ${weatherCondition || 'Not specified - infer from setting'}
- Time of Day: ${timeOfDay || 'Not specified - choose what fits best'}
- Sounds: ${sounds || 'Include natural sounds from the setting'}
- Special Elements: ${specialElements || 'None specified'}
- Objects/Toys: ${toys || specialObject || 'None specified'}

=== MASTER STORYTELLING PRINCIPLES ===

1. **The Emotional North Star:** The core emotion (${whySpecial || 'joy and wonder'}) is the heart of the story. Every sentence, every description must serve to build and deepen this feeling.

2. **The Child's Perspective is Epic (And Full of Questions):**
   - Treat every small discovery—the texture of sand, the taste of a strawberry—with the gravity and wonder a child feels. It is not just sand; it is a world of tiny, warm stars.
   - **Crucially, introduce moments of gentle narrative tension.** This is not fear, but rather curiosity, challenge, or surprise. Reveal it through the child's actions: a furrowed brow of concentration, a moment of stillness before touching something new, a slightly clumsy attempt that leads to a funny outcome. The resolution of this micro-tension is what creates the "reassuring" feeling.
   - Example: Instead of "The sand felt nice," try "What was this funny grit? It tickled and prickled! A finger poked down, then a giggle broke out."

3. **Lyrical Language & Poetic Devices:**
   You will write with a clear, pleasing rhythm appropriate for the child's age.

   **Poetic Style: ${poeticStyle}**
   - **If "Lyrical Prose"**: Write in beautiful, rhythmic prose. You may use occasional internal rhymes or rhyming couplets at the end of a spread, but the entire text will not be rhyming. Focus on melody and flow.
   - **If "Rhyming Couplets"**: Write the entire story in AABB rhyming couplets. Every two lines on a spread should rhyme. This is classic for young children. Prioritize natural rhythm over forced rhymes.
   - **If "Subtle Rhyme"**: Use a mix of rhyme schemes, such as ABCB or end-of-spread rhymes, to create a gentle, less predictable poetic feel.

   **Use these poetic devices:**
   - **Refrain**: A recurring line or phrase that anchors the story. The refrain in the JSON output MUST be used 2-3 times within the narrative spreads (woven naturally into the narration).
   - **Anaphora**: The repetition of a word or phrase at the beginning of successive clauses (e.g., "A toe in the water. A splash in the sea. A giggle so happy and free.")
   - **Onomatopoeia**: Use sound words that enrich the sensory experience, but sparingly and purposefully.
   - **Simple, Beautiful Similes**: (e.g., "The sand was like warm sugar," "The sky was a big blue blanket")

4. **Pacing is Everything:** Use a mix of longer, descriptive sentences to set a scene and short, impactful sentences to emphasize a key action or feeling.

${storyGuidelines}

=== CRITICAL WRITING RULES ===

1. POINT OF VIEW: Third-person limited, deeply immersed in ${babyProfile.baby_name}'s feelings, thoughts, and senses. The reader should feel the sun on their skin and the sand between their toes, just as ${babyProfile.baby_name} did.

2. TENSE: Use past tense for a classic, timeless story feel.

3. TONE: Warm and reassuring, but NOT constantly "lovey dovey." Allow room for playful tension, curiosity, surprise, and humor. The warmth should come from the journey and resolution, not from every single sentence being overtly affectionate. Let the story breathe.

4. SHOW, DON'T TELL (The Full Emotional Spectrum):
   Do not state emotions. Reveal them through physical action, sensory details, and internal feelings.

   **Do not just show love and joy.** Show the full range of a child's experience:
   - **Curiosity**: head tilt, pointed finger, eyes following something
   - **Concentration**: furrowed brow, tongue sticking out, gripping tight
   - **Surprise**: wide eyes, sharp inhale, sudden stillness
   - **Effort**: a little grunt, wobbly legs, determined face
   - **Hesitation**: pause before touching, looking back at parent, tiny step forward
   - **Delight**: burst of giggles, bouncing, clapping hands

   This emotional variety makes the resulting smile or hug feel earned and real.

   ❌ BAD: "${babyProfile.baby_name} was happy."
   ✅ GOOD: "A warmth spread all through ${babyProfile.baby_name}'s chest, and a smile bloomed on her face, as bright as the morning sun."

   ❌ BAD: "He was curious about the shell."
   ✅ GOOD: "${babyProfile.baby_name}'s eyes went wide. His head tilted, and one tiny finger reached out, slowly, slowly, to touch the bumpy, swirly thing."

5. CENTRAL EMOTION AS NORTH STAR:
   The emotional core is: ${whySpecial || 'joy and wonder'}
   Every page must connect back to this feeling in some way.

6. SENSORY & INTERNAL WORLD:
   Weave in the provided sensory details (${sensoryDetails || 'sights, sounds, feelings'}) but go deeper.
   Describe how these things *felt* inside ${babyProfile.baby_name}'s small body.
   The shock of cool water, the tickle of a feather, the comforting weight of Daddy's hand.
   Create a vivid, multi-sensory world using the environmental elements provided.

7. MILESTONE & FIRSTS PRIORITY:
   ${isMilestone ? `⭐ THIS IS A MILESTONE MOMENT - ${milestoneDetail || milestoneCheck}` : 'If this feels like a significant "first," treat it with reverence.'}

   - **YOU MUST EXPLICITLY STATE THE MILESTONE:** Early in the story, you must clearly state what the "first" is. For example, use phrases like "For the very first time..." or "This was ${babyProfile.baby_name}'s first day at the beach." This grounds the memory and gives it importance.
   - **BUILD A CRESCENDO:** The entire narrative arc should build towards this moment, making it the sparkling centerpiece of the story.

8. VIVID & VARIED VOCABULARY:
   Do not overuse simple emotional words. Instead of repeating "happy," describe the *physical sensations* of joy.
   ❌ BAD: "${babyProfile.baby_name} was happy. The sand felt happy. It was a happy day."
   ✅ GOOD: "A bright smile bloomed on ${babyProfile.baby_name}'s face. A shiver of pure delight ran up her arms as she touched the warm sand. The whole world felt full of sunshine and wonder."
   Use a rich palette of words to describe feelings. If you describe joy, use varied words: delight, wonder, excitement, glee, contentment, warmth.

9. INTERACTIVE QUESTIONS:
   Gently invite curiosity. Use questions like, "And what was that sound?" or "But what did ${babyProfile.baby_name} see, peeking from behind the leaf?" to build anticipation before a reveal.

10. DEVELOPMENTAL ACCURACY:
   All described actions MUST be appropriate for the child's stated developmental abilities (${developmentalAbilities || `${ageInMonths} months old`}).
   If the data says "${babyProfile.baby_name} can sit but not yet stand," you MUST NOT describe them standing, walking, or running.
   All physical descriptions in both the narration and visual_action must respect this limit. This is paramount.

11. WORD COUNT (STRICT):
   - Per spread: ${wordLimits.min}-${wordLimits.max} words
   - Total story: ${wordLimits.total.min}-${wordLimits.total.max} words
   - Total spreads: ${pageCount}

=== NARRATIVE STRUCTURE (${pageCount} Spreads) ===

IMPORTANT - MINIMALIST MOMENT SPREADS:
- Out of ${pageCount} spreads, designate 1-2 spreads as "Minimalist Moment" spreads.
- These spreads have NO long narration. Instead, they feature ONE single, short, poetic sentence (3-8 words) that captures a peak moment of action or emotion.
- These sentences should be descriptive and beautiful, NOT just sound effects.
    ❌ BAD: "Wiggle wiggle!" or "Splash splash!"
    ✅ GOOD: "Her tiny toes sank into the warm, soft sand."
    ✅ GOOD: "All the world was a happy, bubbly splash."
- Mark these spreads with "is_minimalist_moment": true. The rest of the spreads will have full narration.

NARRATIVE ARC (for the spreads with full narration):
- **Spread 1: Arrival & Wonder.** Set the scene. Introduce a sense of awe and gentle questioning. ${isMilestone ? `**IF IT'S A MILESTONE, STATE IT HERE** to establish the importance of the day. (e.g., "This was the day ${babyProfile.baby_name} met the ocean for the very first time.")` : ''}
- **Spreads 2-3: Exploration & Discovery.** The child interacts with the environment. Build anticipation towards the core memory.
- **Spreads 4-5: The Heart of the Memory.** This is the climax. Describe the milestone or the central emotional moment with rich detail.
- **Spreads 6-7: The Feeling.** Focus on the emotional aftermath. How did the experience feel? The joy, the pride, the connection.
- **Spread 8: Gentle Resolution.** A warm, reassuring conclusion that snuggles the memory down. Often a hug, a sleepy smile, or a look of love with family.

Use the parent's story_beginning, story_middle, and story_end as your guide for this arc.

=== VISUAL VARIETY (Critical for Illustrations) ===

CAMERA ANGLE SELECTION (INTELLIGENT MATCHING):
You must intelligently select the BEST camera angle for each spread based on:
- The emotion of the moment (peaceful → shadow_silhouette, curious → discovery_moment)
- The action happening (playing → birds_eye_overhead, intimate parent moment → peek_through_frame)
- The narrative beat (opening → establishing_wide, reflection → reflection_surface)
- The "Best for" scenarios listed below

AVAILABLE CAMERA ANGLES:
${cameraAngleOptions}

🎬 CAMERA ANGLE RULES:
- SPREAD 1 MUST use "establishing_wide" to set the scene
- EVERY other spread MUST use a COMPLETELY DIFFERENT camera angle (no repeats!)
- Match the angle to the scene content and emotion
- Consider what the angle communicates emotionally
- Use the "Best for" scenarios as guidance
- EVERY page MUST show a DIFFERENT action/moment
- Vary body positions: standing, sitting, crawling, reaching, jumping, etc.
- Vary locations within the scene
- Vary emotional expressions page to page

EXAMPLES OF SMART MATCHING:
- Peaceful sunset moment → "shadow_silhouette" (ethereal, dreamy)
- Baby discovering something new → "discovery_moment" (wonder, curiosity)
- Parent holding baby → "peek_through_frame" (intimate, protected)
- Baby playing from above → "birds_eye_overhead" (playful overview)
- Emotional connection moment → "over_shoulder_parent" (intimate bond)
- Baby's adventure forward → "direct_back_following" (exploration)
- Classic memory capture → "perfect_profile_side" (timeless)
- Water/mirror play → "reflection_surface" (dreamlike, artistic)

=== CHARACTER ASSIGNMENT ===
Cast available: ${extractedCast.join(', ')}

Guidelines:
- Opening pages: Often ${babyProfile.baby_name} alone or with one parent (establishing shot)
- Middle pages: Can include ${babyProfile.baby_name} + supporting characters during action
- Closing pages: Often ${babyProfile.baby_name} + family for emotional resolution
- Assign characters where they naturally fit the narrative moment

=== OUTPUT FORMAT (EXACT JSON STRUCTURE) ===

{
  "title": "Short, poetic, emotionally evocative title (3-6 words). ${isMilestone ? `If it is a major 'first,' STRONGLY CONSIDER incorporating it, like '${babyProfile.baby_name}'s First Beach Day' or '${babyProfile.baby_name} Meets the Ocean'.` : ''}",
  "refrain": "2-4 word rhythmic refrain (optional, if it fits poetically)",
  "emotional_core": "The heart of this story in one sentence (e.g., 'The wonder of feeling sand for the very first time.')",
  "story_arc": "The emotional journey in 3-5 words (e.g., 'Curiosity to Joy to Comfort')",
  "cast_members": [${extractedCast.map(c => `"${c}"`).join(', ')}],
  "pages": [
    {
      "page_number": 1,
      "narration": "Full narration text (${wordLimits.min}-${wordLimits.max} words). Use lyrical, descriptive language. SHOW emotions through actions and sensory feelings. Onomatopoeia should be used sparingly and only if it truly serves the story, like the distant 'Caw!' of a seagull.",
      "illustration_description": "A SHORT, CUSTOMER-FRIENDLY description (1-2 sentences, max 25 words) of what will appear in this illustration. Focus ONLY on: WHO is in the picture (which people/pets), WHAT key objects or elements are visible, and WHERE they are (the setting). Do NOT mention camera angles, lighting, or technical details. Example: '${babyProfile.baby_name} sitting on the beach with Mom, looking at the ocean waves. A small red bucket is beside them.' This is what customers will see and be able to edit.",
      "visual_action": "A rich description for the illustrator, staying **strictly faithful** to the user's provided memory and the child's developmental abilities. **Do not add actions that didn't happen.** For example, if the baby can only sit, describe them sitting and reaching, not standing. What is ${babyProfile.baby_name} doing? What is the expression of wonder on their face? Describe the light, the weather, the key objects.",
      "action_description": "How this visual establishes the story's sense of wonder and place.",
      "page_goal": "What this spread achieves in the story arc (e.g., 'To introduce the setting and spark the child's curiosity').",
      "camera_angle": "MUST choose from available angles - different for each spread",
      "shot_description": "Name of the chosen camera angle",
      "visual_focus": "Key visual element to emphasize (e.g., 'The vastness of the ocean' or 'The texture of the fuzzy blanket').",
      "emotion": "joy/wonder/peaceful/curious/proud/excited/brave/loved",
      "sensory_details": "Specific sensory elements for this spread (e.g., 'The salty smell of the air, the gentle warmth of the morning sun').",
      "characters_on_page": ["baby", "mom", "dad", etc.],
      "scene_type": "opening/action/closing/transition",
      "is_minimalist_moment": false
    },
    {
      "page_number": 2,
      "narration": "The whole world was a happy, bubbly splash.",
      "is_minimalist_moment": true,
      "illustration_description": "${babyProfile.baby_name} sitting at the water's edge, splashing with their hands.",
      "visual_action": "${babyProfile.baby_name} sitting at the water's edge, hands splashing enthusiastically, sending droplets flying everywhere. A huge, open-mouthed laugh on their face.",
      "emotion": "joy",
      "characters_on_page": ["baby"],
      "scene_type": "action",
      "...": "etc - mark 1-2 spreads total as minimalist moments"
    }
  ]
}

=== FINAL CHECKLIST ===
✓ **Factual & Developmental Accuracy:** The story is 100% faithful to the provided memory data and developmental abilities. There are NO invented actions.
✓ **Milestone is Stated:** ${isMilestone ? `The "first" (${milestoneDetail || milestoneCheck}) is clearly and explicitly mentioned in the story, title, or opening spread.` : 'N/A - not a milestone moment'}
✓ **Poetic Style Followed:** The story adheres to the "${poeticStyle}" style. ${poeticStyle === 'Rhyming Couplets' ? 'Every two lines rhyme in AABB pattern.' : poeticStyle === 'Subtle Rhyme' ? 'Rhymes are used strategically (ABCB or end-of-spread).' : 'Prose flows with rhythm and occasional rhymes.'}
✓ **Refrain is Used:** The refrain appears 2-3 times naturally woven into the narration spreads.
✓ **Micro-Tension Present:** The story includes moments of curiosity, hesitation, surprise, or gentle challenge that create narrative interest.
✓ **Emotional Range:** Shows full spectrum of emotions (curiosity, concentration, surprise, effort, hesitation, delight) not just constant joy.
✓ **Varied Vocabulary:** The story avoids repeating simple emotional words like "happy." Physical sensations are described using a rich palette of varied words.
✓ Age-appropriate yet rich and lyrical vocabulary
✓ Word count within limits (${wordLimits.min}-${wordLimits.max} words per spread, ${wordLimits.total.min}-${wordLimits.total.max} total)
✓ All emotions SHOWN through action, expression, and internal sensation (never stated)
✓ The Emotional North Star is present but not overwhelming on every page
✓ Sensory details are woven in to create a full, immersive world
✓ Each spread has a unique camera angle and depicts a distinct action
✓ Narrative flows through a clear arc of Wonder → Exploration → Climax → Resolution
✓ Tone is warm and reassuring but allows room for playful tension, not "lovey dovey" throughout
✓ Third-person past tense is used consistently
✓ 1-2 spreads are marked as "is_minimalist_moment": true with a single, powerful sentence (3-8 words)
✓ The milestone or "first" is celebrated as the heart of the story
✓ ${pageCount} total spreads

Now, with the heart of a poet and the discipline of a historian, create the complete ${pageCount}-spread children's book manuscript in the specified JSON format, ensuring every detail is true to the provided memory.`;

    job.progress = 50;
    job.message = `Writing ${babyProfile.baby_name}'s story...`;

    // Call Gemini with master prompt
    const systemPrompt = `You are a master children's book author and poet with deep understanding of child psychology, narrative structure, and the lyrical beauty of language.

You excel at:
- Creating timeless, emotionally resonant stories that capture the profound wonder of childhood
- Writing with a lyrical, warm voice that treats every small discovery as epic
- "Show don't tell" emotional writing (revealing feelings through physical actions, sensory details, and internal sensations)
- Crafting narratives with gentle micro-tensions (curiosity, hesitation, surprise) that make resolutions satisfying
- Weaving rich sensory details that create vivid, immersive worlds felt through the child's perspective
- Building clear narrative arcs with emotional crescendos (Wonder → Exploration → Climax → Resolution)
- Using poetic devices (refrain, anaphora, rhyme schemes) with natural rhythm and flow
- Showing the full emotional spectrum of childhood (curiosity, concentration, surprise, effort, hesitation, delight)
- Third-person limited perspective that makes readers feel the sun on their skin and sand between their toes
- Visual variety for illustrations (varied camera angles, actions, and compositions)

You follow instructions precisely and create beautiful, poetic, emotionally resonant children's books that balance warmth with narrative dynamism.

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
        illustration_description: page.illustration_description || 'Scene description',
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
    const { babyProfile, conversation, illustrationStyle, storyLength, poeticStyle, locale = 'en' } = body;

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