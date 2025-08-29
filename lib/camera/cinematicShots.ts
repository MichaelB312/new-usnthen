// lib/camera/cinematicShots.ts - Updated for Paper Collage style
/**
 * Advanced Cinematic Shot System for Paper Collage Children's Books
 * Combines shot size, camera angle, lens effects, and emotional keywords
 * Optimized for paper cutout aesthetic
 */

export interface ShotDefinition {
  id: string;
  name: string;
  base_prompt: string;
  emotional_variants?: Record<string, string>;
  requires?: ('visual_focus' | 'visual_action' | 'sensory_details')[];
  focus_template?: string;
  lens_effect?: string;
  depth_of_field?: 'shallow' | 'medium' | 'deep';
  mood?: string[];
  best_for?: string[];
}

// Import Paper Collage style elements if available
import { PAPER_COLLAGE_STYLE, enhanceWithPaperCollage } from '../styles/paperCollage';

// Comprehensive shot library for Paper Collage style
export const CINEMATIC_SHOTS: Record<string, ShotDefinition> = {
  // EXTREME CLOSE-UPS - For tiny paper details
  wonder_macro: {
    id: 'wonder_macro',
    name: 'Wonder Macro',
    base_prompt: 'An enchanting macro shot of layered paper details',
    emotional_variants: {
      joy: 'A joyful extreme close-up of paper cutout eyes with sparkle details',
      discovery: 'A wondrous macro shot of tiny paper fingers exploring paper textures',
      peaceful: 'A serene extreme close-up of peaceful paper features'
    },
    requires: ['visual_focus'],
    focus_template: 'of {visual_focus}, rendered with paper layers and torn edges',
    lens_effect: '100mm macro lens style showing paper grain',
    depth_of_field: 'shallow',
    mood: ['intimate', 'magical', 'detailed'],
    best_for: ['hands', 'feet', 'eyes', 'textures']
  },

  intimate_detail: {
    id: 'intimate_detail',
    name: 'Intimate Detail',
    base_prompt: 'An intimate extreme close-up with layered paper depth',
    requires: ['visual_focus'],
    focus_template: 'focusing on baby\'s {visual_focus} made from paper cutouts',
    lens_effect: '85mm portrait lens with paper layer separation',
    depth_of_field: 'shallow',
    mood: ['tender', 'warm', 'emotional']
  },

  // CLOSE-UPS - For paper collage emotions
  emotional_portrait: {
    id: 'emotional_portrait',
    name: 'Emotional Portrait',
    base_prompt: 'A warm close-up portrait with paper cutout features',
    emotional_variants: {
      joy: 'A radiant close-up of paper collage joy with bright paper pieces',
      wonder: 'An awe-filled close-up with layered paper creating depth',
      sleepy: 'A gentle close-up with soft tissue paper overlay'
    },
    lens_effect: '85mm portrait style with paper layers creating depth',
    depth_of_field: 'shallow',
    mood: ['expressive', 'heartwarming', 'intimate']
  },

  // MEDIUM SHOTS - For paper action scenes
  playful_medium: {
    id: 'playful_medium',
    name: 'Playful Medium',
    base_prompt: 'A dynamic medium shot with paper pieces at playful angles',
    requires: ['visual_action'],
    focus_template: 'showing baby {visual_action} with paper cutouts',
    lens_effect: '50mm natural perspective with paper depth',
    mood: ['energetic', 'fun', 'active'],
    best_for: ['playing', 'crawling', 'reaching']
  },

  interaction_frame: {
    id: 'interaction_frame',
    name: 'Interaction Frame',
    base_prompt: 'A warm medium shot with layered paper figures interacting',
    requires: ['visual_action'],
    focus_template: 'capturing paper collage moment of {visual_action}',
    lens_effect: '35mm lens with multiple paper layers',
    mood: ['connected', 'loving', 'gentle']
  },

  // WIDE SHOTS - For paper collage environments
  storybook_wide: {
    id: 'storybook_wide',
    name: 'Storybook Wide',
    base_prompt: 'A magical wide shot with elaborate paper collage background',
    requires: ['sensory_details'],
    focus_template: 'with paper baby exploring {sensory_details}',
    lens_effect: '24mm wide-angle showing full paper scene',
    depth_of_field: 'deep',
    mood: ['adventurous', 'expansive', 'magical']
  },

  cozy_establishing: {
    id: 'cozy_establishing',
    name: 'Cozy Establishing',
    base_prompt: 'A warm establishing shot with layered paper creating cozy scene',
    lens_effect: '35mm wide shot with paper depth layers',
    mood: ['safe', 'comfortable', 'homey']
  },

  // HERO ANGLES - Paper cutouts from below
  tiny_hero: {
    id: 'tiny_hero',
    name: 'Tiny Hero',
    base_prompt: 'An empowering low-angle shot with paper baby looking brave',
    requires: ['visual_action'],
    focus_template: 'as paper baby triumphantly {visual_action}',
    lens_effect: '24mm dramatic angle with paper pieces',
    mood: ['brave', 'proud', 'triumphant'],
    best_for: ['first_steps', 'standing', 'reaching_up']
  },

  giant_world: {
    id: 'giant_world',
    name: 'Giant\'s World',
    base_prompt: 'A worm\'s-eye view with towering paper cutout world',
    lens_effect: '14mm ultra-wide with paper layers stacked high',
    mood: ['awe-inspiring', 'vast', 'adventurous']
  },

  // OVERHEAD SHOTS - Flat lay paper arrangements
  dreamy_overhead: {
    id: 'dreamy_overhead',
    name: 'Dreamy Overhead',
    base_prompt: 'A gentle bird\'s-eye view of paper collage arrangement',
    lens_effect: '50mm overhead shot of paper pieces laid flat',
    mood: ['peaceful', 'protective', 'calm'],
    best_for: ['sleeping', 'playing_on_mat', 'tummy_time']
  },

  playmat_symphony: {
    id: 'playmat_symphony',
    name: 'Playmat Symphony',
    base_prompt: 'A perfectly arranged overhead shot of colorful paper pieces',
    lens_effect: '35mm flat lay style with paper cutout toys',
    mood: ['organized', 'colorful', 'playful']
  },

  // DUTCH ANGLES - Tilted paper fun
  giggle_tilt: {
    id: 'giggle_tilt',
    name: 'Giggle Tilt',
    base_prompt: 'A playfully tilted angle with paper pieces at dynamic angles',
    requires: ['visual_action'],
    focus_template: 'as paper baby joyfully {visual_action}',
    lens_effect: '35mm with 15-degree tilt of paper scene',
    mood: ['silly', 'energetic', 'fun']
  },

  tumble_angle: {
    id: 'tumble_angle',
    name: 'Tumble Angle',
    base_prompt: 'A dynamic canted angle with paper pieces tumbling',
    lens_effect: '24mm with 30-degree tilt showing paper chaos',
    mood: ['chaotic', 'exciting', 'dynamic']
  },

  // POV SHOTS - First person paper perspective
  baby_pov: {
    id: 'baby_pov',
    name: 'Baby\'s Eyes',
    base_prompt: 'POV shot showing paper hands from baby perspective',
    requires: ['visual_focus'],
    focus_template: 'focusing on paper cutout {visual_focus}',
    lens_effect: '28mm POV with paper edges visible',
    depth_of_field: 'shallow',
    mood: ['curious', 'discovering', 'personal']
  },

  parent_pov: {
    id: 'parent_pov',
    name: 'Parent\'s View',
    base_prompt: 'Tender POV looking down at precious paper baby',
    lens_effect: '35mm from above with paper layers',
    mood: ['loving', 'protective', 'adoring']
  },

  // OVER-THE-SHOULDER - Paper collage perspectives
  peek_over_shoulder: {
    id: 'peek_over_shoulder',
    name: 'Peek Over Shoulder',
    base_prompt: 'Over-the-shoulder shot with paper baby discovering',
    requires: ['visual_action'],
    focus_template: 'as paper baby discovers {visual_action}',
    lens_effect: '50mm following paper baby\'s view',
    mood: ['curious', 'exploring', 'shared']
  },

  // PROFILE SHOTS - Paper silhouettes
  gentle_profile: {
    id: 'gentle_profile',
    name: 'Gentle Profile',
    base_prompt: 'A soft profile shot with layered paper creating silhouette',
    lens_effect: '85mm profile with paper depth layers',
    depth_of_field: 'shallow',
    mood: ['thoughtful', 'peaceful', 'focused']
  },

  // CINEMATIC PAPER COLLAGE COMBINATIONS
  magic_moment: {
    id: 'magic_moment',
    name: 'Magic Moment',
    base_prompt: 'A cinematic shot with golden paper accents and sparkles',
    emotional_variants: {
      sunset: 'Paper scene with warm orange and pink paper layers',
      morning: 'Soft pastel paper pieces with tissue paper light',
      twilight: 'Deep blue paper with glitter paper stars'
    },
    lens_effect: '50mm with layered paper creating depth',
    mood: ['magical', 'ethereal', 'memorable']
  },

  storybook_spread: {
    id: 'storybook_spread',
    name: 'Storybook Spread',
    base_prompt: 'A beautifully composed paper collage two-page spread',
    lens_effect: '35mm showing full paper scene composition',
    depth_of_field: 'medium',
    mood: ['balanced', 'artistic', 'timeless']
  }
};

// Helper function to get appropriate shot based on context
export function selectBestShot(
  action?: string,
  emotion?: string,
  visualFocus?: string,
  pageType?: 'opening' | 'action' | 'closing'
): string {
  // Opening pages benefit from establishing shots
  if (pageType === 'opening') {
    return emotion === 'peaceful' ? 'cozy_establishing' : 'storybook_wide';
  }
  
  // Closing pages work well with emotional shots
  if (pageType === 'closing') {
    return emotion === 'peaceful' ? 'dreamy_overhead' : 'emotional_portrait';
  }
  
  // Match shots to specific visual focuses
  if (visualFocus) {
    if (visualFocus === 'hands' || visualFocus === 'feet') return 'wonder_macro';
    if (visualFocus === 'face' || visualFocus === 'eyes') return 'emotional_portrait';
    if (visualFocus === 'toys') return 'playmat_symphony';
  }
  
  // Match shots to actions
  if (action) {
    if (action.includes('sleep')) return 'dreamy_overhead';
    if (action.includes('crawl') || action.includes('tumble')) return 'tumble_angle';
    if (action.includes('stand') || action.includes('step')) return 'tiny_hero';
    if (action.includes('play')) return 'playful_medium';
    if (action.includes('reach')) return 'tiny_hero';
  }
  
  // Default based on emotion
  if (emotion === 'joy') return 'giggle_tilt';
  if (emotion === 'wonder') return 'emotional_portrait';
  if (emotion === 'peaceful') return 'gentle_profile';
  
  // Fallback
  return 'playful_medium';
}

// Build a complete cinematic prompt for Paper Collage style
export function buildCinematicPrompt(
  shotId: string,
  context: {
    visualFocus?: string;
    visualAction?: string;
    sensoryDetails?: string;
    emotion?: string;
    style?: string;
    characters?: string[];
    gender?: 'boy' | 'girl' | 'neutral';
  }
): string {
  const shot = CINEMATIC_SHOTS[shotId];
  if (!shot) {
    // Fallback to simple prompt if shot not found
    return `medium shot of paper collage baby ${context.visualAction || 'playing'}`;
  }
  
  let prompt = shot.base_prompt;
  
  // Use emotional variant if available
  if (context.emotion && shot.emotional_variants?.[context.emotion]) {
    prompt = shot.emotional_variants[context.emotion];
  }
  
  // Apply focus template
  if (shot.focus_template) {
    if (context.visualFocus && shot.focus_template.includes('{visual_focus}')) {
      prompt += ', ' + shot.focus_template.replace('{visual_focus}', context.visualFocus);
    }
    if (context.visualAction && shot.focus_template.includes('{visual_action}')) {
      prompt += ', ' + shot.focus_template.replace('{visual_action}', context.visualAction);
    }
    if (context.sensoryDetails && shot.focus_template.includes('{sensory_details}')) {
      prompt += ', ' + shot.focus_template.replace('{sensory_details}', context.sensoryDetails);
    }
  }
  
  // Add lens effect
  if (shot.lens_effect) {
    prompt += ', ' + shot.lens_effect;
  }
  
  // Add depth of field for paper layers
  if (shot.depth_of_field === 'shallow') {
    prompt += ', with foreground paper pieces blurred, focus on main subject';
  } else if (shot.depth_of_field === 'deep') {
    prompt += ', with all paper layers in sharp focus';
  }
  
  // Add characters if specified
  if (context.characters && context.characters.length > 0) {
    prompt += ', featuring paper cutout ' + context.characters.join(' and ');
  }
  
  // ALWAYS add Paper Collage style descriptors
  prompt += ', paper collage art style, visible paper texture, torn edges, layered paper pieces';
  prompt += ', handcrafted look, construction paper and tissue paper';
  prompt += ', clear distinct paper shapes, dimensional paper layers';
  
  // Add gender clarity if specified
  if (context.gender) {
    if (context.gender === 'girl') {
      prompt += ', clearly a baby girl with feminine paper details';
    } else if (context.gender === 'boy') {
      prompt += ', obviously a baby boy with boyish paper features';
    }
  }
  
  // Always end with baby book context
  prompt += ', children\'s book illustration for ages 0-3, paper craft art';
  
  return prompt;
}

// Get diverse shot sequence for a story
export function generateShotSequence(pageCount: number): string[] {
  const sequence: string[] = [];
  
  // Opening shot - establishing
  sequence.push('cozy_establishing');
  
  // Vary between different shot types
  const shotTypes = [
    ['wonder_macro', 'intimate_detail'],
    ['emotional_portrait', 'gentle_profile'],
    ['playful_medium', 'interaction_frame'],
    ['tiny_hero', 'giant_world'],
    ['dreamy_overhead', 'playmat_symphony'],
    ['giggle_tilt', 'tumble_angle'],
    ['baby_pov', 'peek_over_shoulder']
  ];
  
  for (let i = 1; i < pageCount - 1; i++) {
    const typeIndex = i % shotTypes.length;
    const options = shotTypes[typeIndex];
    const shot = options[Math.floor(Math.random() * options.length)];
    sequence.push(shot);
  }
  
  // Closing shot - emotional or peaceful
  sequence.push(Math.random() > 0.5 ? 'emotional_portrait' : 'magic_moment');
  
  return sequence.slice(0, pageCount);
}