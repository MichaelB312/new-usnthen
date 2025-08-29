// lib/camera/cinematicShots.ts
/**
 * Diverse Isolated Shot System - Ensures Visual Variety
 * Every page gets a dramatically different angle
 */

export interface ShotDefinition {
  id: string;
  name: string;
  base_prompt: string;
  isolation_prompt: string;
  angle_type: 'extreme_close' | 'close' | 'medium' | 'wide' | 'overhead' | 'low' | 'high' | 'profile' | 'three_quarter';
  variety_score: number; // Higher = more unique
  emotional_variants?: Record<string, string>;
  requires?: ('visual_focus' | 'visual_action' | 'sensory_details')[];
  focus_template?: string;
  mood?: string[];
  best_for?: string[];
}

import { PAPER_COLLAGE_STYLE, enhanceWithIsolatedPaperCollage, extractSurface, extractProps } from '../styles/paperCollage';

// Diverse isolated shot library with variety scores
export const CINEMATIC_SHOTS: Record<string, ShotDefinition> = {
  // EXTREME CLOSE-UPS (Variety: 9/10)
  isolated_macro_hands: {
    id: 'isolated_macro_hands',
    name: 'Macro Hands Detail',
    base_prompt: 'EXTREME CLOSE-UP of baby hands only, isolated on white',
    isolation_prompt: 'tiny hands filling frame, white background',
    angle_type: 'extreme_close',
    variety_score: 9,
    emotional_variants: {
      joy: 'Happy clapping hands isolated on white',
      discovery: 'Exploring fingers isolated on white',
      peaceful: 'Resting tiny hands isolated on white'
    },
    mood: ['intimate', 'detailed', 'precious']
  },

  isolated_macro_feet: {
    id: 'isolated_macro_feet',
    name: 'Macro Feet Detail',
    base_prompt: 'EXTREME CLOSE-UP of baby feet only, isolated on white',
    isolation_prompt: 'tiny feet filling frame, white background',
    angle_type: 'extreme_close',
    variety_score: 9,
    mood: ['intimate', 'cute', 'detailed']
  },

  isolated_macro_face: {
    id: 'isolated_macro_face',
    name: 'Macro Face Expression',
    base_prompt: 'EXTREME CLOSE-UP of baby face expression, isolated on white',
    isolation_prompt: 'face filling entire frame, white background',
    angle_type: 'extreme_close',
    variety_score: 8,
    mood: ['emotional', 'expressive', 'intimate']
  },

  // OVERHEAD SHOTS (Variety: 10/10)
  isolated_birds_eye: {
    id: 'isolated_birds_eye',
    name: 'Bird\'s Eye View',
    base_prompt: 'DIRECTLY OVERHEAD looking straight down at baby, isolated on white',
    isolation_prompt: 'perfect top-down view, baby on white surface',
    angle_type: 'overhead',
    variety_score: 10,
    mood: ['unique', 'playful', 'geometric']
  },

  isolated_overhead_play: {
    id: 'isolated_overhead_play',
    name: 'Overhead Play View',
    base_prompt: 'HIGH OVERHEAD ANGLE of baby playing, isolated on white',
    isolation_prompt: 'looking down from above at 75 degrees, white background',
    angle_type: 'overhead',
    variety_score: 9,
    mood: ['organized', 'clear', 'documentary']
  },

  // LOW ANGLE SHOTS (Variety: 10/10)
  isolated_worms_eye: {
    id: 'isolated_worms_eye',
    name: 'Worm\'s Eye View',
    base_prompt: 'EXTREME LOW ANGLE looking up at baby from ground level, isolated on white',
    isolation_prompt: 'camera on ground looking up, baby appears heroic, white background',
    angle_type: 'low',
    variety_score: 10,
    mood: ['heroic', 'powerful', 'unique']
  },

  isolated_low_angle: {
    id: 'isolated_low_angle',
    name: 'Low Angle Portrait',
    base_prompt: 'LOW ANGLE shot looking up at baby, isolated on white',
    isolation_prompt: 'slightly below baby looking up, white background',
    angle_type: 'low',
    variety_score: 8,
    mood: ['empowering', 'dramatic', 'interesting']
  },

  // HIGH ANGLE SHOTS (Variety: 8/10)
  isolated_high_angle: {
    id: 'isolated_high_angle',
    name: 'High Angle View',
    base_prompt: 'HIGH ANGLE looking down at baby at 45 degrees, isolated on white',
    isolation_prompt: 'elevated view looking down, baby small in frame, white background',
    angle_type: 'high',
    variety_score: 8,
    mood: ['protective', 'observational', 'gentle']
  },

  // PROFILE SHOTS (Variety: 7/10)
  isolated_perfect_profile: {
    id: 'isolated_perfect_profile',
    name: 'Perfect Profile',
    base_prompt: 'EXACT SIDE PROFILE of baby, isolated on white',
    isolation_prompt: 'pure 90-degree side view, white background',
    angle_type: 'profile',
    variety_score: 7,
    mood: ['elegant', 'classic', 'artistic']
  },

  isolated_profile_action: {
    id: 'isolated_profile_action',
    name: 'Profile in Action',
    base_prompt: 'SIDE VIEW of baby in motion, isolated on white',
    isolation_prompt: 'profile showing movement, white background',
    angle_type: 'profile',
    variety_score: 7,
    requires: ['visual_action'],
    mood: ['dynamic', 'active', 'energetic']
  },

  // THREE-QUARTER ANGLES (Variety: 6/10)
  isolated_three_quarter_high: {
    id: 'isolated_three_quarter_high',
    name: 'Three-Quarter High',
    base_prompt: 'THREE-QUARTER VIEW from slightly above, isolated on white',
    isolation_prompt: '3/4 angle elevated view, white background',
    angle_type: 'three_quarter',
    variety_score: 6,
    mood: ['friendly', 'approachable', 'warm']
  },

  isolated_three_quarter_low: {
    id: 'isolated_three_quarter_low',
    name: 'Three-Quarter Low',
    base_prompt: 'THREE-QUARTER VIEW from slightly below, isolated on white',
    isolation_prompt: '3/4 angle looking up, white background',
    angle_type: 'three_quarter',
    variety_score: 6,
    mood: ['confident', 'strong', 'engaging']
  },

  // WIDE SHOTS (Variety: 5/10)
  isolated_full_body: {
    id: 'isolated_full_body',
    name: 'Full Body Wide',
    base_prompt: 'WIDE FULL BODY shot of baby, isolated on white',
    isolation_prompt: 'entire baby visible with space around, white background',
    angle_type: 'wide',
    variety_score: 5,
    mood: ['complete', 'contextual', 'clear']
  },

  isolated_wide_sitting: {
    id: 'isolated_wide_sitting',
    name: 'Wide Sitting Shot',
    base_prompt: 'WIDE SHOT of baby sitting, full figure visible, isolated on white',
    isolation_prompt: 'seated baby with margin of white space, white background',
    angle_type: 'wide',
    variety_score: 5,
    mood: ['stable', 'calm', 'centered']
  },

  // MEDIUM SHOTS (Variety: 4/10)
  isolated_medium_waist: {
    id: 'isolated_medium_waist',
    name: 'Medium Waist Up',
    base_prompt: 'MEDIUM SHOT from waist up, isolated on white',
    isolation_prompt: 'baby from waist up, white background',
    angle_type: 'medium',
    variety_score: 4,
    mood: ['balanced', 'standard', 'friendly']
  },

  isolated_medium_action: {
    id: 'isolated_medium_action',
    name: 'Medium Action Shot',
    base_prompt: 'MEDIUM SHOT capturing action, isolated on white',
    isolation_prompt: 'mid-distance action shot, white background',
    angle_type: 'medium',
    variety_score: 4,
    requires: ['visual_action'],
    mood: ['active', 'engaged', 'dynamic']
  },

  // CLOSE-UPS (Variety: 3/10)
  isolated_close_portrait: {
    id: 'isolated_close_portrait',
    name: 'Close Portrait',
    base_prompt: 'CLOSE-UP portrait of baby face and shoulders, isolated on white',
    isolation_prompt: 'head and shoulders filling frame, white background',
    angle_type: 'close',
    variety_score: 3,
    mood: ['intimate', 'emotional', 'connecting']
  },

  // UNIQUE ANGLES (Variety: 10/10)
  isolated_dutch_angle: {
    id: 'isolated_dutch_angle',
    name: 'Dutch Angle Tilt',
    base_prompt: 'TILTED DUTCH ANGLE of baby at 30 degrees, isolated on white',
    isolation_prompt: 'camera tilted for dynamic composition, white background',
    angle_type: 'three_quarter',
    variety_score: 10,
    mood: ['playful', 'energetic', 'whimsical']
  },

  isolated_over_shoulder: {
    id: 'isolated_over_shoulder',
    name: 'Over Shoulder View',
    base_prompt: 'OVER THE SHOULDER view of baby, isolated on white',
    isolation_prompt: 'looking over baby shoulder, white background',
    angle_type: 'three_quarter',
    variety_score: 8,
    mood: ['following', 'engaged', 'participatory']
  },

  isolated_between_legs: {
    id: 'isolated_between_legs',
    name: 'Through Legs View',
    base_prompt: 'VIEW THROUGH BABY\'S LEGS while crawling, isolated on white',
    isolation_prompt: 'unique view between legs, white background',
    angle_type: 'low',
    variety_score: 10,
    mood: ['playful', 'unique', 'surprising']
  }
};

// Generate maximally diverse shot sequence
export function generateDiverseShotSequence(pageCount: number): string[] {
  // Group shots by angle type for maximum variety
  const angleGroups = {
    extreme_close: ['isolated_macro_hands', 'isolated_macro_feet', 'isolated_macro_face'],
    overhead: ['isolated_birds_eye', 'isolated_overhead_play'],
    low: ['isolated_worms_eye', 'isolated_low_angle', 'isolated_between_legs'],
    high: ['isolated_high_angle'],
    profile: ['isolated_perfect_profile', 'isolated_profile_action'],
    three_quarter: ['isolated_three_quarter_high', 'isolated_three_quarter_low', 'isolated_dutch_angle', 'isolated_over_shoulder'],
    wide: ['isolated_full_body', 'isolated_wide_sitting'],
    medium: ['isolated_medium_waist', 'isolated_medium_action'],
    close: ['isolated_close_portrait']
  };
  
  const sequence: string[] = [];
  const usedTypes = new Set<string>();
  const usedShots = new Set<string>();
  
  // Start with establishing wide or medium
  const openingShots = ['isolated_full_body', 'isolated_wide_sitting', 'isolated_medium_waist'];
  const opening = openingShots[Math.floor(Math.random() * openingShots.length)];
  sequence.push(opening);
  usedShots.add(opening);
  usedTypes.add('wide');
  
  // Fill middle pages with maximum variety
  for (let i = 1; i < pageCount - 1; i++) {
    // Find angle types we haven't used recently
    const availableTypes = Object.keys(angleGroups).filter(type => {
      // Don't repeat the same angle type within 2 pages
      const lastTwoTypes = sequence.slice(-2).map(shotId => {
        const shot = CINEMATIC_SHOTS[shotId];
        return shot ? shot.angle_type : null;
      });
      return !lastTwoTypes.includes(type as any);
    });
    
    // If all types used recently, pick the one used longest ago
    const typeToUse = availableTypes.length > 0 
      ? availableTypes[Math.floor(Math.random() * availableTypes.length)]
      : Object.keys(angleGroups)[i % Object.keys(angleGroups).length];
    
    // Pick unused shot from this type
    const availableShots = angleGroups[typeToUse as keyof typeof angleGroups]
      .filter(shot => !usedShots.has(shot));
    
    if (availableShots.length > 0) {
      const shot = availableShots[Math.floor(Math.random() * availableShots.length)];
      sequence.push(shot);
      usedShots.add(shot);
    } else {
      // Fallback: pick highest variety score shot not used
      const allShots = Object.keys(CINEMATIC_SHOTS)
        .filter(id => !usedShots.has(id))
        .sort((a, b) => CINEMATIC_SHOTS[b].variety_score - CINEMATIC_SHOTS[a].variety_score);
      
      if (allShots.length > 0) {
        sequence.push(allShots[0]);
        usedShots.add(allShots[0]);
      }
    }
  }
  
  // End with emotional close-up or intimate shot
  const closingShots = ['isolated_close_portrait', 'isolated_macro_face', 'isolated_perfect_profile']
    .filter(shot => !usedShots.has(shot));
  
  if (closingShots.length > 0) {
    sequence.push(closingShots[0]);
  } else {
    sequence.push('isolated_close_portrait');
  }
  
  console.log('Generated diverse shot sequence:', sequence.map(id => CINEMATIC_SHOTS[id]?.name).join(' → '));
  
  return sequence;
}

// Helper function to select best shot based on context
export function selectBestShot(
  action?: string,
  emotion?: string,
  visualFocus?: string,
  pageType?: 'opening' | 'action' | 'closing'
): string {
  if (pageType === 'opening') {
    return 'isolated_full_body';
  }
  
  if (pageType === 'closing') {
    return emotion === 'peaceful' ? 'isolated_close_portrait' : 'isolated_macro_face';
  }
  
  // Match to visual focus
  if (visualFocus) {
    if (visualFocus === 'hands') return 'isolated_macro_hands';
    if (visualFocus === 'feet') return 'isolated_macro_feet';
    if (visualFocus === 'face' || visualFocus === 'eyes') return 'isolated_macro_face';
  }
  
  // Match to action with variety
  if (action) {
    if (action.includes('crawl')) return 'isolated_between_legs';
    if (action.includes('stand')) return 'isolated_worms_eye';
    if (action.includes('sit')) return 'isolated_birds_eye';
    if (action.includes('play')) return 'isolated_dutch_angle';
    if (action.includes('reach')) return 'isolated_low_angle';
  }
  
  // Default based on emotion with variety
  if (emotion === 'joy') return 'isolated_dutch_angle';
  if (emotion === 'wonder') return 'isolated_over_shoulder';
  if (emotion === 'peaceful') return 'isolated_perfect_profile';
  
  return 'isolated_medium_waist';
}

// Build complete isolated prompt with specific angle emphasis
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
    narration?: string;
  }
): string {
  const shot = CINEMATIC_SHOTS[shotId];
  if (!shot) {
    return 'isolated paper cutout baby on pure white background, varied angle';
  }
  
  // Start with strong angle specification
  let prompt = `CRITICAL ANGLE: ${shot.base_prompt}\n`;
  prompt += `ISOLATED SUBJECT on PURE WHITE BACKGROUND\n`;
  prompt += `${shot.isolation_prompt}\n`;
  
  // Use emotional variant if available
  if (context.emotion && shot.emotional_variants?.[context.emotion]) {
    prompt += shot.emotional_variants[context.emotion] + '\n';
  }
  
  // Extract and add minimal surface from narration
  if (context.narration) {
    const surface = extractSurface(context.narration);
    prompt += `Surface indication: ${surface}\n`;
    
    const props = extractProps(context.narration);
    if (props.length > 0) {
      prompt += `Props: ${props.join(', ')} as isolated paper elements\n`;
    }
  }
  
  // Add specific angle reinforcement
  prompt += `\nCAMERA ANGLE REQUIREMENTS:\n`;
  prompt += `- This MUST be a ${shot.angle_type.replace('_', ' ').toUpperCase()} shot\n`;
  prompt += `- Variety score: ${shot.variety_score}/10 - make it visually distinct!\n`;
  prompt += `- Mood: ${shot.mood?.join(', ')}\n`;
  
  // Paper collage style
  prompt += '\nSTYLE: Paper collage cutout, visible texture, torn edges\n';
  
  // Gender clarity
  if (context.gender) {
    if (context.gender === 'girl') {
      prompt += 'Clearly a paper cutout baby GIRL with feminine details\n';
    } else if (context.gender === 'boy') {
      prompt += 'Obviously a paper cutout baby BOY with boyish features\n';
    }
  }
  
  // Final isolation emphasis
  prompt += '\nREMEMBER: NO BACKGROUND, NO SCENERY, only character on WHITE';
  
  return prompt;
}