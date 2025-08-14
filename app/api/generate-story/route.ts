// app/api/generate-story/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Core shot types for distribution
const CORE_SHOTS = ['wide', 'medium', 'closeup', 'birdseye', 'low'] as const;

// Scene types
const SCENE_TYPES = [
  'opening_magical',
  'action',
  'close_up', 
  'exploration',
  'celebration',
  'closing'
] as const;

interface StoryPage {
  page_number: number;
  scene_type: string;
  narration: string;
  emotion: string;
  emotion_custom?: string;
  shot: string;
  shot_custom?: string;
  closest_shot?: string;
  action_id: string;
  action_label?: string;
  page_turn_cue?: boolean;
  visual_prompt?: string;
  layout_template?: string;
}

interface StoryResponse {
  title: string;
  refrain: string;
  style: 'wondrous' | 'crayon' | 'vintage';
  pages: StoryPage[];
  reading_level: 'toddler';
  meta: {
    version: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { babyProfile, conversation } = await request.json();
    
    // Extract conversation details
    const memoryAnchor = conversation.find((c: any) => c.question === 'memory_anchor')?.answer || '';
    const whySpecial = conversation.find((c: any) => c.question === 'why_special')?.answer || '';
    const babyAction = conversation.find((c: any) => c.question === 'baby_action')?.answer || '';
    const babyReaction = conversation.find((c: any) => c.question === 'baby_reaction')?.answer || '';
    
    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const pronouns = getPronounsForGender(babyProfile.gender);
    
    const prompt = `
You are a children's book author specializing in board books for ages 0-3. Create a 6-page story for ${babyProfile.baby_name}, a ${ageInMonths}-month-old ${babyProfile.gender === 'neutral' ? 'baby' : babyProfile.gender}.

Memory context:
- What happened: ${memoryAnchor}
- Why it was special: ${whySpecial}
- What baby did: ${babyAction}
- Baby's reaction: ${babyReaction}

CRITICAL RULES (C1):
1. Maximum 20 words per page
2. Present tense only
3. Concrete, simple language (no abstract concepts)
4. One POV character (the baby)
5. One emotion per page
6. Include a refrain (exact same line) that appears on 3-4 pages
7. Gentle onomatopoeia (max 1 per page)
8. Pages 1, 3, and 5 must end with "...and then—" for page-turn cues
9. Each page MUST have a DIFFERENT camera shot
10. Each page MUST have a UNIQUE action_id (snake_case)

SHOT DISTRIBUTION for 6 pages:
- Use each of these exactly once: wide, medium, closeup, birdseye, low
- The 6th page should repeat either 'medium' or 'wide'
- Never use the same shot on consecutive pages

Create a JSON response with EXACTLY this structure:
{
  "title": "Creative title with baby's name (e.g., '${babyProfile.baby_name}'s Beach Day')",
  "refrain": "A short memorable line that repeats (e.g., 'Sand everywhere!')",
  "style": "wondrous",
  "pages": [
    {
      "page_number": 1,
      "scene_type": "opening_magical",
      "narration": "Opening text (≤20 words, ends with '...and then—')",
      "emotion": "curiosity",
      "shot": "wide",
      "action_id": "discovering_sand",
      "action_label": "discovering warm sand",
      "page_turn_cue": true
    },
    {
      "page_number": 2,
      "scene_type": "action",
      "narration": "Include the refrain here (≤20 words)",
      "emotion": "joy",
      "shot": "closeup",
      "action_id": "touching_sand",
      "action_label": "tiny fingers explore"
    },
    {
      "page_number": 3,
      "scene_type": "exploration",
      "narration": "Text with '...and then—' at end (≤20 words)",
      "emotion": "wonder",
      "shot": "birdseye",
      "action_id": "sitting_surrounded",
      "action_label": "sitting in sand circle",
      "page_turn_cue": true
    },
    {
      "page_number": 4,
      "scene_type": "close_up",
      "narration": "Include refrain (≤20 words)",
      "emotion": "calm",
      "shot": "low",
      "action_id": "patting_sand",
      "action_label": "patting sand gently"
    },
    {
      "page_number": 5,
      "scene_type": "celebration",
      "narration": "Text ending with '...and then—' (≤20 words)",
      "emotion": "pride",
      "shot": "medium",
      "action_id": "showing_creation",
      "action_label": "showing sand creation",
      "page_turn_cue": true
    },
    {
      "page_number": 6,
      "scene_type": "closing",
      "narration": "Closing with refrain (≤20 words)",
      "emotion": "joy",
      "shot": "wide",
      "action_id": "resting_happy",
      "action_label": "resting contentedly"
    }
  ],
  "reading_level": "toddler",
  "meta": {
    "version": "1.1"
  }
}

Important:
- Keep language extremely simple (toddler-appropriate)
- Make ${babyProfile.baby_name} the clear protagonist
- Each action_id must be unique and describe what the baby is doing
- The refrain should be memorable and appear at least 3 times
- Ensure natural story flow despite technical requirements`;

    if (process.env.OPENAI_API_KEY) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { 
            role: "system", 
            content: "You are an expert children's book author specializing in board books for ages 0-3. You always follow the exact JSON structure provided and ensure each page has unique camera shots and action identifiers."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 2000,
      });

      const story: StoryResponse = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Validate and enhance the story
      if (!story.pages || story.pages.length !== 6) {
        throw new Error('Invalid story structure');
      }
      
      // Map shots to layout templates
      story.pages = story.pages.map((page) => ({
        ...page,
        layout_template: mapShotToLayout(page.shot || page.closest_shot || 'medium'),
        visual_prompt: generateVisualPrompt(page, babyProfile)
      }));
      
      return NextResponse.json({ success: true, story });
    } else {
      // Fallback mock data for testing
      const story = generateMockStoryV2(babyProfile, memoryAnchor, whySpecial, babyAction, babyReaction);
      return NextResponse.json({ success: true, story });
    }
    
  } catch (error) {
    console.error('Story generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate story' },
      { status: 500 }
    );
  }
}

function calculateAgeInMonths(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
}

function getPronounsForGender(gender: string) {
  switch(gender) {
    case 'boy': return { they: 'he', them: 'him', their: 'his' };
    case 'girl': return { they: 'she', them: 'her', their: 'her' };
    default: return { they: 'they', them: 'them', their: 'their' };
  }
}

function mapShotToLayout(shot: string): string {
  const mappings: Record<string, string> = {
    'wide': 'hero_spread',
    'medium': 'action_focus',
    'closeup': 'portrait_emphasis',
    'birdseye': 'collage',
    'low': 'hero_spread'
  };
  return mappings[shot] || 'action_focus';
}

function generateVisualPrompt(page: StoryPage, profile: any): string {
  const age = calculateAgeInMonths(profile.birthdate);
  const ageDesc = age < 12 ? 'baby' : 'toddler';
  
  return `${page.action_label || page.action_id}, ${ageDesc} ${profile.baby_name}, ${page.shot} shot, ${page.scene_type} scene`;
}

function generateMockStoryV2(profile: any, memory: string, why: string, action: string, reaction: string): StoryResponse {
  return {
    title: `${profile.baby_name}'s Special Day`,
    refrain: "What a wonderful moment!",
    style: 'wondrous',
    pages: [
      {
        page_number: 1,
        scene_type: 'opening_magical',
        narration: `Once upon a time, ${profile.baby_name} discovered something new...and then—`,
        emotion: 'curiosity',
        shot: 'wide',
        action_id: 'discovering_moment',
        action_label: 'discovering something wonderful',
        page_turn_cue: true,
        layout_template: 'hero_spread'
      },
      {
        page_number: 2,
        scene_type: 'action',
        narration: `${action}. What a wonderful moment!`,
        emotion: 'joy',
        shot: 'closeup',
        action_id: 'exploring_closely',
        action_label: 'exploring with tiny hands',
        layout_template: 'portrait_emphasis'
      },
      {
        page_number: 3,
        scene_type: 'exploration',
        narration: `The world seemed bigger and brighter...and then—`,
        emotion: 'wonder',
        shot: 'birdseye',
        action_id: 'looking_around',
        action_label: 'taking it all in',
        page_turn_cue: true,
        layout_template: 'collage'
      },
      {
        page_number: 4,
        scene_type: 'close_up',
        narration: `${reaction}. What a wonderful moment!`,
        emotion: 'calm',
        shot: 'low',
        action_id: 'feeling_peaceful',
        action_label: 'feeling peaceful and content',
        layout_template: 'hero_spread'
      },
      {
        page_number: 5,
        scene_type: 'celebration',
        narration: `Everyone smiled with love...and then—`,
        emotion: 'pride',
        shot: 'medium',
        action_id: 'sharing_joy',
        action_label: 'sharing the joy',
        page_turn_cue: true,
        layout_template: 'action_focus'
      },
      {
        page_number: 6,
        scene_type: 'closing',
        narration: `${profile.baby_name} knew this was special. What a wonderful moment!`,
        emotion: 'joy',
        shot: 'wide',
        action_id: 'remembering_always',
        action_label: 'a memory to keep forever',
        layout_template: 'hero_spread'
      }
    ],
    reading_level: 'toddler',
    meta: {
      version: '1.1'
    }
  };
}