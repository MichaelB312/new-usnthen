// app/api/generate-story/route.ts
/**
 * Enhanced Story Generation - Proper baby book with rhythm, refrain, and visual diversity
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ONLY truly distinct camera angles that produce different images
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
}

interface StoryResponse {
  title: string;
  refrain: string;
  pages: StoryPage[];
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

function getDistinctAction(index: number, usedActions: Set<string>): string {
  const allActions = [
    'reaching with open palm',
    'grasping with closed fist',
    'pointing with one finger',
    'clapping both hands together',
    'crawling on all fours',
    'standing on two feet',
    'sitting with legs crossed',
    'rolling sideways on ground',
    'jumping with both feet up',
    'laughing with mouth wide',
    'concentrating with furrowed brow',
    'eyes wide with surprise',
    'throwing arm forward',
    'hugging arms tight',
    'pushing with both hands',
    'pulling toward body',
    'toes wiggling in sand',
    'feet kicking up',
    'hands splashing water',
    'fingers tracing patterns'
  ];
  
  for (const action of allActions) {
    if (!usedActions.has(action)) {
      return action;
    }
  }
  
  return `exploring_${index + 1}`;
}

export async function POST(request: NextRequest) {
  let babyProfile: any;
  let conversation: any;
  
  try {
    const body = await request.json();
    babyProfile = body.babyProfile;
    conversation = body.conversation;
    
    // Extract memory details
    const memory = conversation.find((c: any) => c.question === 'memory_anchor')?.answer || '';
    const whySpecial = conversation.find((c: any) => c.question === 'why_special')?.answer || '';
    const babyActions = conversation.find((c: any) => c.question === 'baby_action')?.answer || '';
    const emotions = conversation.find((c: any) => c.question === 'baby_reaction')?.answer || '';
    
    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const pageCount = getPageCount(ageInMonths);
    const wordLimits = getWordLimit(ageInMonths);
    
    // Get all camera angles and shuffle for variety
    const cameraAngles = Object.keys(DISTINCT_CAMERA_ANGLES) as CameraAngle[];
    const shuffledAngles = [...cameraAngles].sort(() => Math.random() - 0.5);
    const selectedAngles = shuffledAngles.slice(0, pageCount);
    const cameraAnglesList = selectedAngles.join(", ");
    
    // Enhanced prompt with all baby book requirements
    const prompt = `You are an award-winning board-book author.
Write a ${pageCount}-page baby book for ${babyProfile.baby_name}, age ${ageInMonths} months.

MEMORY (use concrete details from this): ${JSON.stringify(memory)}
BABY ACTIONS: ${babyActions}
EMOTIONS: ${emotions}

AGE WORD WINDOW PER PAGE: ${wordLimits.min}-${wordLimits.max} words (HARD requirement)

NON-NEGOTIABLE RULES:
- Present tense only. Concrete, sensory words. Short, read-aloud-friendly lines.
- Include ONE short refrain (2-4 words). Repeat it on at least 3 different pages.
- Gentle musicality: prefer soft end-rhyme or internal rhyme on at least 4 pages. Never force rhyme.
- Use ${babyProfile.baby_name} by name on 1-2 pages.
- Include at least one playful onomatopoeia somewhere (e.g., "swoosh", "plop", "shhh").
- Give at least two subtle page-turn hooks (end a line with suspense like "and then...").
- Each page = a DIFFERENT, VISUALLY DISTINCT action/pose.
- Each page uses a UNIQUE camera angle (choose exactly one per page from: ${cameraAnglesList}).
- No meta commentary, no instructions, no markdown. Output JSON only.

OUTPUT JSON SHAPE (exact keys):
{
  "title": "Short, concrete title using the memory",
  "refrain": "2-4 words (will repeat)",
  "pages": [
    {
      "page_number": 1,
      "narration": "A ${wordLimits.min}-${wordLimits.max}-word line in present tense that can be read aloud musically. Use the refrain here if it fits.",
      "camera_angle": "one of: ${cameraAnglesList}",
      "visual_action": "specific distinct action (e.g., 'toes wiggling in sand', 'hands clapping', 'pointing at shell')",
      "action_description": "what the illustrator shows (concrete, sensory detail)",
      "camera_prompt": "CAMERA_TAG - 1 short line telling the framing for the image model"
    }
  ]
}

CAMERA PROMPT GUIDELINES:
- Format: "CAMERA_TAG - short framing". Examples:
  - "birds_eye - top-down on ${babyProfile.baby_name}'s toes in warm sand"
  - "over_shoulder - POV toward the little shell ${babyProfile.baby_name} points at"
  - "worms_eye - low angle, sky and waving hands"

Ensure JSON is valid and includes exactly ${pageCount} pages with the angles: ${cameraAnglesList}.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a children\'s book author specializing in rhythmic, sensory-rich board books for babies. Create stories with musicality, repetition, and vivid concrete imagery.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 3000
    });

    const storyData: StoryResponse = JSON.parse(completion.choices[0].message.content || '{}');
    
    // Validate and enhance with proper baby book elements
    const story = validateAndEnhanceStory(storyData, pageCount, wordLimits, babyProfile.baby_name, selectedAngles);
    
    // Transform to expected structure for compatibility
    const enhancedStory = {
      ...story,
      pages: story.pages.map((page, index) => ({
        ...page,
        page_number: page.page_number,
        scene_type: index === 0 ? 'opening' : index === story.pages.length - 1 ? 'closing' : 'action',
        emotion: 'joy',
        layout_template: 'auto'
      }))
    };
    
    return NextResponse.json({ success: true, story: enhancedStory });
    
  } catch (error) {
    console.error('Story generation error:', error);
    
    // Return a properly structured fallback story
    return NextResponse.json({ 
      success: true, 
      story: createProperFallbackStory(
        babyProfile?.baby_name || 'Baby',
        calculateAgeInMonths(babyProfile?.birthdate || '2024-01-01')
      )
    });
  }
}

function validateAndEnhanceStory(
  raw: any,
  pageCount: number,
  wordLimits: { min: number; max: number },
  babyName: string,
  selectedAngles: CameraAngle[]
): StoryResponse {
  const angles = selectedAngles;
  const usedAngles = new Set<string>();
  const usedActions = new Set<string>();
  
  // Ensure we have a refrain
  const fallbackRefrains = ["Feels so good!", "So much fun!", "What a day!"];
  const refrain =
    (typeof raw?.refrain === "string" && raw.refrain.trim().slice(0, 32)) ||
    fallbackRefrains[Math.floor(Math.random() * fallbackRefrains.length)];
  
  // Helper to clamp words to required range
  const clampWords = (line: string) => {
    const words = (line || "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return refrain; // never empty
    if (words.length > wordLimits.max) return words.slice(0, wordLimits.max).join(" ");
    while (words.length < wordLimits.min) {
      const add = refrain.split(/\s+/);
      for (const w of add) {
        if (words.length >= wordLimits.max) break;
        words.push(w);
      }
      if (add.length === 0) break;
    }
    return words.join(" ");
  };
  
  // Helper to ensure present tense
  const asPresentTense = (s: string) => {
    return s
      .replace(/\bwas\b/gi, "is")
      .replace(/\bwere\b/gi, "are")
      .replace(/\bhad\b/gi, "has")
      .replace(/\bplayed\b/gi, "plays")
      .replace(/\btouched\b/gi, "touches")
      .replace(/\blooked\b/gi, "looks");
  };
  
  const story: StoryResponse = {
    title: (raw?.title && String(raw.title).trim()) || `${babyName}'s Adventure`,
    refrain,
    pages: []
  };
  
  // Ensure we have exactly pageCount pages
  const rawPages = Array.isArray(raw?.pages) ? raw.pages.slice(0, pageCount) : [];
  while (rawPages.length < pageCount) rawPages.push({});
  
  // Decide which pages should include refrain (every other page, at least 3 times)
  const refrainPages = new Set<number>();
  for (let i = 0; i < pageCount; i += 2) refrainPages.add(i); // 0-based indices
  
  for (let i = 0; i < pageCount; i++) {
    const rp = rawPages[i] || {};
    
    // Unique angle
    let angle = rp.camera_angle as CameraAngle;
    if (!angle || !angles.includes(angle) || usedAngles.has(angle)) {
      angle = angles.find(a => !usedAngles.has(a)) || "wide";
    }
    usedAngles.add(angle);
    
    // Distinct action
    let action = String(rp.visual_action || "").trim();
    if (!action || usedActions.has(action)) {
      action = getDistinctAction(i, usedActions);
    }
    usedActions.add(action);
    
    // Camera prompt
    const cameraPrompt =
      (rp.camera_prompt && String(rp.camera_prompt)) ||
      `${angle} - ${babyName} ${action}`;
    
    // Narration: clamp to word range, nudge present tense, inject refrain on chosen pages
    let narration = String(rp.narration || "").trim();
    narration = asPresentTense(narration);
    
    // Add refrain to designated pages if not already present
    if (refrainPages.has(i) && !new RegExp(`\\b${refrain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(narration)) {
      narration = `${narration} ${refrain}`.trim();
    }
    
    narration = clampWords(narration);
    
    // Action description: ensure concrete
    const actionDesc = String(rp.action_description || action || "concrete action").trim();
    
    story.pages.push({
      page_number: i + 1,
      narration,
      camera_angle: angle,
      visual_action: action,
      action_description: actionDesc,
      camera_prompt: cameraPrompt
    });
  }
  
  return story;
}

function createProperFallbackStory(babyName: string, ageInMonths: number): any {
  const pageCount = getPageCount(ageInMonths);
  const wordLimits = getWordLimit(ageInMonths);
  const angles = Object.keys(DISTINCT_CAMERA_ANGLES) as CameraAngle[];
  const refrain = "So much fun!";
  
  // Age-appropriate narrations with rhythm and refrain
  const narrations: Record<number, string[]> = {
    6: [ // 3-5 words
      `${babyName} looks. ${refrain}`,
      'Tiny hands reach.',
      'Touch, touch, touch.',
      `Giggles fill air. ${refrain}`,
      'Soft and warm.',
      `All done now. ${refrain}`
    ],
    12: [ // 5-10 words
      `${babyName} discovers something new today. ${refrain}`,
      'Little fingers wiggle and reach out far.',
      'Splash! Water drops fly everywhere now.',
      `Round and round we go. ${refrain}`,
      'Up, up, up into the bright sky.',
      `Time to rest, little one. ${refrain}`
    ],
    24: [ // 8-15 words
      `Look what ${babyName} finds hiding in the grass today! ${refrain}`,
      'Stomp, stomp go the little feet on the path.',
      'The butterfly dances near the reaching fingertips.',
      `Whoosh! The wind tickles our faces. ${refrain}`,
      'One, two, three blocks stack up high and tall.',
      'Snuggle close for one more hug.',
      `What an adventure we had today! ${refrain}`,
      'Tomorrow brings more fun to find.'
    ]
  };
  
  const ageKey = ageInMonths < 12 ? 6 : ageInMonths < 24 ? 12 : 24;
  const selectedNarrations = narrations[ageKey];
  
  return {
    title: `${babyName}'s Day`,
    refrain,
    pages: Array.from({ length: pageCount }, (_, i) => ({
      page_number: i + 1,
      narration: selectedNarrations[i] || `Page ${i + 1}. ${refrain}`,
      camera_angle: angles[i % angles.length],
      visual_action: getDistinctAction(i, new Set()),
      action_description: 'Baby exploring and discovering',
      camera_prompt: `${angles[i % angles.length]} - ${babyName} playing`,
      // Compatibility fields
      scene_type: i === 0 ? 'opening' : i === pageCount - 1 ? 'closing' : 'action',
      emotion: 'joy',
      layout_template: 'auto'
    }))
  };
}