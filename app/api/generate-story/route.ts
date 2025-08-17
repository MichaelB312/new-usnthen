// app/api/generate-story/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced camera angles with POV and dynamic perspectives
const CAMERA_ANGLES = {
  extreme_closeup: 'extreme close-up showing minute details',
  closeup: 'close-up shot focusing on specific area',
  medium: 'medium shot showing character and immediate surroundings',
  wide: 'wide shot showing full scene and environment',
  birds_eye: 'bird\'s eye view looking straight down from above',
  low_angle: 'low angle shot looking up from ground level',
  pov_baby: 'POV shot from baby\'s perspective looking at their own body parts or surroundings',
  pov_parent: 'POV shot from parent\'s perspective looking down at baby',
  over_shoulder: 'over-the-shoulder shot showing what baby sees',
  macro: 'macro shot showing extreme detail of texture or small objects',
  dutch_angle: 'dutch angle (tilted) for playful or dynamic feeling',
  profile: 'profile shot from the side'
} as const;

// Map visual focus to best camera angles
const FOCUS_TO_CAMERA_SUGGESTIONS = {
  hands: ['extreme_closeup', 'macro', 'pov_baby', 'closeup'],
  feet: ['pov_baby', 'extreme_closeup', 'low_angle', 'macro'],
  face: ['closeup', 'profile', 'medium'],
  eyes: ['extreme_closeup', 'macro'],
  full_body: ['wide', 'medium', 'birds_eye', 'low_angle'],
  object_interaction: ['over_shoulder', 'closeup', 'pov_baby', 'macro'],
  environmental: ['wide', 'birds_eye', 'pov_parent', 'dutch_angle']
};

// Actions that work well with specific angles
const ACTION_CAMERA_PAIRING = {
  'falling': ['macro', 'extreme_closeup', 'pov_baby'], // for sand falling
  'rubbing': ['pov_baby', 'extreme_closeup', 'macro'], // for feet rubbing
  'grabbing': ['extreme_closeup', 'pov_baby', 'over_shoulder'],
  'watching': ['pov_baby', 'over_shoulder', 'profile'],
  'discovering': ['wide', 'pov_baby', 'medium'],
  'sitting': ['birds_eye', 'wide', 'low_angle'],
  'reaching': ['pov_baby', 'over_shoulder', 'closeup'],
  'exploring': ['pov_baby', 'birds_eye', 'wide']
};

interface EnhancedStoryPage {
  page_number: number;
  scene_type: string;
  narration: string;
  emotion: string;
  emotion_custom?: string;
  camera_angle: string; // New: specific camera angle
  camera_angle_description: string; // New: detailed camera description
  visual_focus: string;
  visual_action: string;
  detail_prompt: string;
  action_id: string;
  action_label?: string;
  page_turn_cue?: boolean;
  sensory_details?: string;
  pose_description?: string; // New: specific pose for this shot
}

interface EnhancedStoryResponse {
  title: string;
  refrain: string;
  style: 'wondrous' | 'crayon' | 'vintage';
  pages: EnhancedStoryPage[];
  extracted_moments: string[];
  camera_sequence: string[]; // New: ordered list of camera angles used
  reading_level: 'toddler';
  meta: {
    version: string;
  };
}

// Extract specific visual moments and actions from the conversation
function extractVisualMomentsAndActions(conversation: any): { 
  moments: string[], 
  actions: string[],
  bodyParts: string[] 
} 

{
  const moments: string[] = [];
  const actions: string[] = [];
  const bodyParts: string[] = [];
  
  // Combine all answers to analyze
  const fullMemory = conversation.map((c: any) => c.answer).join(' ').toLowerCase();
  
  // Extract body parts
  const bodyPartMatches = fullMemory.match(/\b(hands?|fingers?|palms?|feet|foot|toes?|eyes?|face|arms?|legs?)\b/gi);
  if (bodyPartMatches) {
    // Fix: Process each match individually
    bodyPartMatches.forEach((match: string) => {
      const lowerMatch = match.toLowerCase();
      if (!bodyParts.includes(lowerMatch)) {
        bodyParts.push(lowerMatch);
      }
    });
  }
  
  // Extract actions
  const actionWords = [
    'grab', 'grasp', 'hold', 'pick', 'touch', 'feel', 'rub', 'squeeze', 'pat', 'stroke',
    'watch', 'look', 'gaze', 'stare', 'peek', 'observe',
    'drop', 'fall', 'pour', 'sprinkle', 'scatter', 'throw', 'toss', 'release',
    'wiggle', 'shake', 'move', 'dance', 'jump', 'run', 'crawl', 'walk', 'sit', 'stand'
  ];
  
  actionWords.forEach(action => {
    const regex = new RegExp(`\\b${action}\\w*\\b`, 'gi');
    const matches = fullMemory.match(regex);
    if (matches) {
      actions.push(...matches.map((m: string) => m.toLowerCase()));
      matches.forEach((match: string) => {
        // Try to capture the full context around the action
        const contextRegex = new RegExp(`\\b\\w+\\s+${match}\\s+\\w+\\b`, 'gi');
        const contextMatches = fullMemory.match(contextRegex);
        if (contextMatches) {
          moments.push(...contextMatches);
        }
      });
    }
  });
  
  return { 
    moments: [...new Set(moments)], 
    actions: [...new Set(actions)],
    bodyParts: [...new Set(bodyParts)]
  };
}

// Select best camera angle based on action and focus
function selectCameraAngle(
  visualFocus: string,
  action: string,
  usedAngles: string[],
  pageNumber: number
): { angle: string, description: string } {
  // Get suggestions based on visual focus
  const focusSuggestions = FOCUS_TO_CAMERA_SUGGESTIONS[visualFocus as keyof typeof FOCUS_TO_CAMERA_SUGGESTIONS] || 
                           ['medium', 'closeup', 'wide'];
  
  // Get suggestions based on action
  let actionSuggestions: string[] = [];
  for (const [actionKey, angles] of Object.entries(ACTION_CAMERA_PAIRING)) {
    if (action.includes(actionKey)) {
      actionSuggestions = angles;
      break;
    }
  }
  
  // Combine and prioritize suggestions
  const allSuggestions = [...new Set([...actionSuggestions, ...focusSuggestions])];
  
  // Find first unused angle from suggestions
  let selectedAngle = allSuggestions.find(angle => !usedAngles.includes(angle));
  
  // If all suggested angles are used, pick from any unused angle
  if (!selectedAngle) {
    const allAngles = Object.keys(CAMERA_ANGLES);
    selectedAngle = allAngles.find(angle => !usedAngles.includes(angle)) || 'medium';
  }
  
  return {
    angle: selectedAngle,
    description: CAMERA_ANGLES[selectedAngle as keyof typeof CAMERA_ANGLES] || CAMERA_ANGLES.medium
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
    
    // Extract specific visual moments and actions
    const { moments, actions, bodyParts } = extractVisualMomentsAndActions(conversation);
    
    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const pronouns = getPronounsForGender(babyProfile.gender);
    
    const enhancedPrompt = `
You are a children's book author and cinematographer specializing in personalized board books with dynamic visual storytelling.
Create a 6-page story for ${babyProfile.baby_name}, a ${ageInMonths}-month-old ${babyProfile.gender === 'neutral' ? 'baby' : babyProfile.gender}.

CRITICAL: Each page MUST have a COMPLETELY DIFFERENT camera angle and pose. NO REPEATING ANGLES.

Memory context:
- What happened: ${memoryAnchor}
- Why it was special: ${whySpecial}
- What baby did: ${babyAction}
- Baby's reaction: ${babyReaction}
- Specific actions identified: ${actions.join(', ')}
- Body parts mentioned: ${bodyParts.join(', ')}
- Key visual moments: ${moments.join(', ')}

AVAILABLE CAMERA ANGLES (use each only ONCE):
1. extreme_closeup - extreme close-up showing minute details (perfect for sand falling, texture)
2. closeup - close-up shot focusing on specific area
3. medium - medium shot showing character and immediate surroundings
4. wide - wide shot showing full scene and environment
5. birds_eye - bird's eye view looking straight down from above
6. low_angle - low angle shot looking up from ground level
7. pov_baby - POV shot from baby's perspective (looking at own hands/feet)
8. pov_parent - POV shot from parent's perspective looking down
9. over_shoulder - over-the-shoulder shot showing what baby sees
10. macro - macro shot showing extreme detail of texture
11. dutch_angle - tilted angle for playful feeling
12. profile - profile shot from the side

CAMERA MATCHING RULES:
- For "feet rubbing in sand" → Use pov_baby (baby looking at own feet) or extreme_closeup
- For "hands grabbing sand" → Use macro or extreme_closeup
- For "sand falling through fingers" → Use macro or pov_baby (watching own hands)
- For "looking/watching" → Use pov_baby or over_shoulder
- For environmental context → Use wide, birds_eye, or pov_parent
- For emotional expressions → Use closeup or profile

REQUIREMENTS:
1. Maximum 20 words per page narration
2. Each page MUST use a DIFFERENT camera_angle from the list above
3. Each page MUST show a DIFFERENT action/pose (no repeated actions)
4. Distribute the specific actions mentioned across different pages
5. Pages 1, 3, and 5 end with "...and then—"
6. Never include meta-text in narration

Create a JSON response with this EXACT structure:
{
  "title": "Creative title with baby's name",
  "refrain": "A short memorable line that repeats",
  "style": "wondrous",
  "extracted_moments": ["List of specific visual moments"],
  "camera_sequence": ["List of camera angles in order used"],
  "pages": [
    {
      "page_number": 1,
      "scene_type": "opening_magical",
      "narration": "Story text only (≤20 words)",
      "emotion": "curiosity",
      "camera_angle": "wide",
      "camera_angle_description": "wide shot showing full scene and environment",
      "visual_focus": "full_body",
      "visual_action": "discovering_environment",
      "detail_prompt": "wide shot showing baby discovering the beach for first time, full environment visible",
      "pose_description": "sitting at edge of sand, looking around with wonder",
      "action_id": "first_discovery",
      "action_label": "discovering the beach",
      "sensory_details": "warm sun, soft breeze",
      "page_turn_cue": true
    },
    {
      "page_number": 2,
      "scene_type": "sensory_exploration",
      "narration": "Story text with specific action",
      "emotion": "joy",
      "camera_angle": "macro",
      "camera_angle_description": "macro shot showing extreme detail of texture",
      "visual_focus": "hands",
      "visual_action": "grasping_sand",
      "detail_prompt": "macro shot of tiny fingers closing around sand, individual grains visible between fingers, extreme detail",
      "pose_description": "hand closing into fist with sand squeezing out between fingers",
      "action_id": "sand_grab_macro",
      "action_label": "grabbing handful of sand"
    },
    {
      "page_number": 3,
      "scene_type": "movement",
      "narration": "Story text with different action",
      "emotion": "wonder",
      "camera_angle": "pov_baby",
      "camera_angle_description": "POV shot from baby's perspective looking at own feet",
      "visual_focus": "feet",
      "visual_action": "rubbing_in_sand",
      "detail_prompt": "POV looking down at own feet rubbing back and forth in sand, baby's perspective of own feet playing",
      "pose_description": "feet moving back and forth, toes curling in sand, from baby's viewpoint",
      "action_id": "feet_pov_rubbing",
      "action_label": "watching own feet in sand",
      "page_turn_cue": true
    },
    {
      "page_number": 4,
      "scene_type": "discovery",
      "narration": "Story text with another unique action",
      "emotion": "calm",
      "camera_angle": "extreme_closeup",
      "camera_angle_description": "extreme close-up showing minute details",
      "visual_focus": "hands",
      "visual_action": "sand_falling",
      "detail_prompt": "extreme close-up of sand falling through open fingers like hourglass, grains in mid-air, sharp detail",
      "pose_description": "fingers spread open, sand streaming down in thin lines",
      "action_id": "sand_falling_extreme_closeup",
      "action_label": "sand falling through fingers"
    },
    {
      "page_number": 5,
      "scene_type": "observation",
      "narration": "Story text with emotional moment",
      "emotion": "pride",
      "camera_angle": "profile",
      "camera_angle_description": "profile shot from the side",
      "visual_focus": "face",
      "visual_action": "watching_intently",
      "detail_prompt": "profile shot of baby's face watching something with wonder, side view showing expression",
      "pose_description": "head tilted slightly, eyes focused, mouth slightly open in wonder",
      "action_id": "profile_watching",
      "action_label": "watching with amazement",
      "page_turn_cue": true
    },
    {
      "page_number": 6,
      "scene_type": "closing",
      "narration": "Closing with refrain naturally included",
      "emotion": "joy",
      "camera_angle": "birds_eye",
      "camera_angle_description": "bird's eye view looking straight down from above",
      "visual_focus": "full_body",
      "visual_action": "sitting_satisfied",
      "detail_prompt": "bird's eye view looking down at baby sitting in sand surrounded by handprints and footprints patterns",
      "pose_description": "sitting contentedly, arms relaxed, surrounded by marks in sand",
      "action_id": "birds_eye_satisfied",
      "action_label": "content after adventure"
    }
  ],
  "reading_level": "toddler",
  "meta": {
    "version": "3.0"
  }
}

CRITICAL REMINDERS:
- NEVER repeat the same camera_angle
- NEVER repeat the same action/pose
- Each page must be visually distinct
- Match camera angles to actions intelligently
- The narration field contains ONLY story text, no instructions`;

    if (process.env.OPENAI_API_KEY) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { 
            role: "system", 
            content: "You are an expert children's book author and visual director who creates stories with dynamic camera angles. Each page must have a unique camera perspective and action. You understand cinematography and match camera angles to actions for maximum impact."
          },
          { role: "user", content: enhancedPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 3500,
      });

      const story: EnhancedStoryResponse = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Validate the enhanced story
      if (!story.pages || story.pages.length !== 6) {
        throw new Error('Invalid story structure');
      }
      
      // Ensure all camera angles are unique
      const usedAngles = new Set<string>();
      story.pages = story.pages.map((page) => {
        // If angle is duplicate, assign a different one
        if (usedAngles.has(page.camera_angle)) {
          const { angle, description } = selectCameraAngle(
            page.visual_focus,
            page.visual_action,
            Array.from(usedAngles),
            page.page_number
          );
          page.camera_angle = angle;
          page.camera_angle_description = description;
        }
        usedAngles.add(page.camera_angle);
        
        return {
          ...page,
          // Clean any meta-text from narration
          narration: page.narration.replace(/^(Closing |Opening |Include )?(refrain|text):?\s*/i, '').trim()
        };
      });
      
      // Store camera sequence
      story.camera_sequence = story.pages.map(p => p.camera_angle);
      
      return NextResponse.json({ success: true, story });
    } else {
      // Enhanced mock data for testing
      const story = generateEnhancedMockStory(babyProfile, memoryAnchor, whySpecial, babyAction, babyReaction, moments, actions, bodyParts);
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

function generateEnhancedMockStory(
  profile: any, 
  memory: string, 
  why: string, 
  action: string, 
  reaction: string,
  moments: string[],
  actions: string[],
  bodyParts: string[]
): EnhancedStoryResponse {
  return {
    title: `${profile.baby_name}'s Sandy Adventure`,
    refrain: "What a feeling!",
    style: 'wondrous',
    extracted_moments: moments.length > 0 ? moments : [
      'hands grabbing sand',
      'feet rubbing in sand',
      'sand falling through fingers',
      'face showing wonder'
    ],
    camera_sequence: ['wide', 'macro', 'pov_baby', 'extreme_closeup', 'profile', 'birds_eye'],
    pages: [
      {
        page_number: 1,
        scene_type: 'opening_magical',
        narration: `${profile.baby_name} discovers warm sand everywhere...and then—`,
        emotion: 'curiosity',
        camera_angle: 'wide',
        camera_angle_description: 'wide shot showing full scene and environment',
        visual_focus: 'full_body',
        visual_action: 'discovering_beach',
        detail_prompt: 'wide shot of baby sitting at edge where grass meets sand, entire beach scene visible',
        pose_description: 'sitting with legs extended, leaning forward slightly, hands ready to explore',
        action_id: 'beach_discovery_wide',
        action_label: 'discovering the beach',
        sensory_details: 'warm sun, soft breeze, sound of waves',
        page_turn_cue: true
      },
      {
        page_number: 2,
        scene_type: 'sensory_exploration',
        narration: `Tiny hands squeeze the golden sand tight. What a feeling!`,
        emotion: 'joy',
        camera_angle: 'macro',
        camera_angle_description: 'macro shot showing extreme detail of texture',
        visual_focus: 'hands',
        visual_action: 'grasping_sand',
        detail_prompt: 'macro shot of baby hand gripping sand, individual grains visible between tiny fingers, extreme close detail of skin texture and sand grains',
        pose_description: 'fist clenched with sand oozing between fingers',
        action_id: 'sand_grab_macro_detail',
        action_label: 'grabbing sand tightly'
      },
      {
        page_number: 3,
        scene_type: 'movement',
        narration: `Little feet dance back and forth...and then—`,
        emotion: 'wonder',
        camera_angle: 'pov_baby',
        camera_angle_description: 'POV shot from baby perspective looking at own feet',
        visual_focus: 'feet',
        visual_action: 'rubbing_in_sand',
        detail_prompt: 'POV looking down at own feet from baby perspective, feet rubbing back and forth in sand, toes visible wiggling, sand moving around feet',
        pose_description: 'feet moving rhythmically, toes curling and uncurling, from baby\'s viewpoint looking down',
        action_id: 'feet_pov_rubbing_sand',
        action_label: 'watching own feet play',
        page_turn_cue: true
      },
      {
        page_number: 4,
        scene_type: 'discovery',
        narration: `Open fingers let sand rain down slowly. What a feeling!`,
        emotion: 'calm',
        camera_angle: 'extreme_closeup',
        camera_angle_description: 'extreme close-up showing minute details',
        visual_focus: 'hands',
        visual_action: 'releasing_sand',
        detail_prompt: 'extreme close-up of fingers spread open with sand falling through in thin streams, grains in mid-air catching light, sharp focus on falling sand',
        pose_description: 'fingers spread wide, palm up, sand flowing down in streams',
        action_id: 'sand_waterfall_extreme_closeup',
        action_label: 'sand falling like rain'
      },
      {
        page_number: 5,
        scene_type: 'observation',
        narration: `Eyes watch every grain fall down...and then—`,
        emotion: 'pride',
        camera_angle: 'profile',
        camera_angle_description: 'profile shot from the side',
        visual_focus: 'face',
        visual_action: 'watching_intently',
        detail_prompt: 'profile shot from side showing baby face watching sand fall, expression of wonder, eye tracking movement, soft lighting on face',
        pose_description: 'head tilted down slightly, eyes following sand, mouth slightly open in concentration',
        action_id: 'profile_watching_sand',
        action_label: 'watching with amazement',
        page_turn_cue: true
      },
      {
        page_number: 6,
        scene_type: 'closing',
        narration: `${profile.baby_name} sits happy in sandy art. What a feeling!`,
        emotion: 'joy',
        camera_angle: 'birds_eye',
        camera_angle_description: 'bird\'s eye view looking straight down from above',
        visual_focus: 'full_body',
        visual_action: 'sitting_satisfied',
        detail_prompt: 'bird\'s eye view looking straight down at baby sitting in center of sand patterns, handprints and footprints creating circular pattern around baby',
        pose_description: 'sitting cross-legged, arms relaxed, looking up at camera, surrounded by sand art',
        action_id: 'birds_eye_sand_art',
        action_label: 'happy in sand creation'
      }
    ],
    reading_level: 'toddler',
    meta: {
      version: '3.0'
    }
  };
}