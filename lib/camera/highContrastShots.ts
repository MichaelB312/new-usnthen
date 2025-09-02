// lib/camera/highContrastShots.ts
/**
 * High-Contrast Shot System - Guarantees Visual Variety
 * Each shot is fundamentally different from all others
 */

export interface ShotDefinition {
  id: string;
  name: string;
  base_prompt: string;
  isolation_prompt: string;
  requires_character: boolean;
  shot_category: 'character' | 'object' | 'atmosphere' | 'transition';
  variety_score: 10; // All shots are maximum variety
  emotional_tone?: string;
  best_for?: string[];
  page_type?: 'opening' | 'action' | 'closing' | 'transition';
}

// THE UNMISTAKABLE 10 + CHARACTER-FREE SHOTS
export const HIGH_CONTRAST_SHOTS: Record<string, ShotDefinition> = {
  // ===== CHARACTER SHOTS (The Unmistakable 10) =====
  
  birds_eye_overhead: {
    id: 'birds_eye_overhead',
    name: 'Bird\'s-Eye View',
    base_prompt: 'DIRECTLY OVERHEAD top-down bird\'s-eye view, looking straight down from directly above at the baby',
    isolation_prompt: 'perfectly vertical overhead shot, baby on white surface viewed from directly above',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'playful, graphic',
    best_for: ['playing', 'lying down', 'crawling'],
    page_type: 'action'
  },

  worms_eye_ground: {
    id: 'worms_eye_ground',
    name: 'Worm\'s-Eye View',
    base_prompt: 'EXTREME LOW ANGLE worm\'s-eye view from ground level, looking straight up at the towering baby',
    isolation_prompt: 'camera on the ground looking directly up, baby appears giant and heroic against white',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'heroic, wondrous',
    best_for: ['standing', 'reaching up', 'triumphant moments'],
    page_type: 'action'
  },

  baby_pov_hands: {
    id: 'baby_pov_hands',
    name: 'Baby\'s POV',
    base_prompt: 'FIRST-PERSON POV from baby\'s perspective, looking down at their own hands/feet',
    isolation_prompt: 'baby\'s eye view showing their own hands or feet in foreground, white background',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'intimate, discovering',
    best_for: ['exploring', 'touching', 'discovering'],
    page_type: 'action'
  },

  extreme_macro_detail: {
    id: 'extreme_macro_detail',
    name: 'Extreme Macro',
    base_prompt: 'EXTREME CLOSE-UP MACRO shot focusing only on tiny detail like baby\'s hand texture',
    isolation_prompt: 'ultra close macro of single tiny feature filling entire frame, white background',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'precious, detailed',
    best_for: ['hands', 'feet', 'eyes', 'tiny details'],
    page_type: 'action'
  },

  establishing_wide: {
    id: 'establishing_wide',
    name: 'Establishing Wide',
    base_prompt: 'WIDE ESTABLISHING SHOT showing entire scene, baby is small element in vast white space',
    isolation_prompt: 'very wide shot, tiny baby figure in expansive white space',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'contextual, peaceful',
    best_for: ['opening scenes', 'showing scale'],
    page_type: 'opening'
  },

  over_shoulder_parent: {
    id: 'over_shoulder_parent',
    name: 'Over-the-Shoulder',
    base_prompt: 'OVER-THE-SHOULDER shot from behind parent\'s shoulder, looking down at baby',
    isolation_prompt: 'framed by adult shoulder silhouette, looking toward baby on white',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'intimate, connected',
    best_for: ['parent-child moments', 'protection'],
    page_type: 'action'
  },

  direct_back_following: {
    id: 'direct_back_following',
    name: 'Following Behind',
    base_prompt: 'DIRECT BACK SHOT from directly behind baby, following as they move forward',
    isolation_prompt: 'camera directly behind baby showing back of head and body, white ahead',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'adventurous, forward',
    best_for: ['crawling away', 'exploring', 'movement'],
    page_type: 'action'
  },

  perfect_profile_side: {
    id: 'perfect_profile_side',
    name: 'Perfect Profile',
    base_prompt: 'EXACT SIDE PROFILE tracking shot, camera perfectly level moving alongside baby',
    isolation_prompt: 'pure 90-degree side view, profile silhouette against white',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'elegant, classic',
    best_for: ['movement', 'sitting', 'contemplation'],
    page_type: 'action'
  },

  reflection_surface: {
    id: 'reflection_surface',
    name: 'Reflection Shot',
    base_prompt: 'REFLECTION FOCUS shot capturing baby\'s image in reflective surface',
    isolation_prompt: 'baby\'s reflection in shiny surface or water, dreamlike and wavy',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'dreamlike, magical',
    best_for: ['water play', 'mirrors', 'discovery'],
    page_type: 'action'
  },

  focus_object_blur_baby: {
    id: 'focus_object_blur_baby',
    name: 'Object Focus',
    base_prompt: 'SHALLOW DEPTH shot focused on toy/object in foreground, baby blurred in background',
    isolation_prompt: 'sharp focus on object close to camera, baby soft and joyful behind on white',
    requires_character: true,
    shot_category: 'character',
    variety_score: 10,
    emotional_tone: 'anticipatory, playful',
    best_for: ['toy interaction', 'reaching', 'desire'],
    page_type: 'action'
  },

  // ===== CHARACTER-FREE SHOTS (Atmospheric & Pacing) =====
  
  object_of_desire: {
    id: 'object_of_desire',
    name: 'Object of Desire',
    base_prompt: 'CLOSE-UP of single toy/object alone on white, no people in shot',
    isolation_prompt: 'isolated object centered on pure white, casting soft shadow',
    requires_character: false,
    shot_category: 'object',
    variety_score: 10,
    emotional_tone: 'anticipatory, focused',
    best_for: ['story opening', 'introducing goals'],
    page_type: 'opening'
  },

  aftermath_quiet: {
    id: 'aftermath_quiet',
    name: 'Aftermath Shot',
    base_prompt: 'QUIET SHOT of scattered toys or traces left behind, empty scene',
    isolation_prompt: 'remnants of play on white surface, no people, peaceful aftermath',
    requires_character: false,
    shot_category: 'atmosphere',
    variety_score: 10,
    emotional_tone: 'peaceful, contemplative',
    best_for: ['after action', 'quiet moments'],
    page_type: 'transition'
  },

  atmospheric_detail: {
    id: 'atmospheric_detail',
    name: 'Atmospheric Detail',
    base_prompt: 'ATMOSPHERIC CLOSE-UP of environmental detail like sunbeam or shadow pattern',
    isolation_prompt: 'abstract light pattern or soft shadow on white surface, no people',
    requires_character: false,
    shot_category: 'atmosphere',
    variety_score: 10,
    emotional_tone: 'calm, mood-setting',
    best_for: ['transitions', 'mood establishment'],
    page_type: 'transition'
  },

  nature_wonder: {
    id: 'nature_wonder',
    name: 'Nature Detail',
    base_prompt: 'MACRO DETAIL of small natural element like flower or feather',
    isolation_prompt: 'single natural object in extreme detail on white, no people',
    requires_character: false,
    shot_category: 'atmosphere',
    variety_score: 10,
    emotional_tone: 'wonder, discovery',
    best_for: ['outdoor stories', 'quiet wonder'],
    page_type: 'transition'
  },

  transition_portal: {
    id: 'transition_portal',
    name: 'Transition Portal',
    base_prompt: 'SHOT of doorway, window, or passage suggesting movement to new space',
    isolation_prompt: 'architectural element suggesting transition, empty and inviting',
    requires_character: false,
    shot_category: 'transition',
    variety_score: 10,
    emotional_tone: 'anticipatory, changing',
    best_for: ['scene changes', 'time transitions'],
    page_type: 'transition'
  }
};

/**
 * Generate a high-contrast shot sequence with guaranteed variety
 * Includes strategic character-free shots for pacing
 */
// lib/camera/highContrastShots.ts
// Update the generateHighContrastSequence function

export function generateHighContrastSequence(
  pageCount: number,
  includeCharacterFree: boolean = true
): string[] {
  const sequence: string[] = [];
  const usedCategories = new Set<string>();
  
  // Page 1: MUST ALWAYS be a character shot to create style anchor
  // Never use character-free shots for Page 1
  sequence.push('establishing_wide'); // Always use establishing_wide for Page 1
  usedCategories.add('wide');
  
  // Character action shots - use most distinct ones
  const characterShots = [
    'birds_eye_overhead',
    'worms_eye_ground',
    'baby_pov_hands',
    'extreme_macro_detail',
    'over_shoulder_parent',
    'direct_back_following',
    'perfect_profile_side',
    'reflection_surface',
    'focus_object_blur_baby'
  ];
  
  // Shuffle for variety
  const shuffled = characterShots.sort(() => Math.random() - 0.5);
  
  // Fill middle pages
  let characterShotIndex = 0;
  for (let i = 1; i < pageCount - 1; i++) {
    // Insert character-free shot for pacing (roughly every 3 pages)
    if (includeCharacterFree && i > 0 && i % 3 === 0 && i < pageCount - 2) {
      const atmosphericShots = [
        'object_of_desire', // Can use this for later pages, just not Page 1
        'aftermath_quiet', 
        'atmospheric_detail', 
        'nature_wonder'
      ];
      const atmospheric = atmosphericShots[Math.floor(Math.random() * atmosphericShots.length)];
      sequence.push(atmospheric);
    } else {
      // Add character shot
      if (characterShotIndex < shuffled.length) {
        sequence.push(shuffled[characterShotIndex]);
        characterShotIndex++;
      } else {
        // If we run out, restart with different order
        const reShuffled = characterShots.sort(() => Math.random() - 0.5);
        sequence.push(reShuffled[0]);
      }
    }
  }
  
  // Last page: Closing shot (can be character or transition)
  if (includeCharacterFree && Math.random() > 0.6) {
    sequence.push('transition_portal');
  } else {
    // Use a calm character shot for closing
    const closingShots = ['perfect_profile_side', 'reflection_surface'];
    sequence.push(closingShots[Math.floor(Math.random() * closingShots.length)]);
  }
  
  console.log('High-contrast sequence generated:', sequence.map(id => HIGH_CONTRAST_SHOTS[id]?.name).join(' → '));
  
  return sequence;
}

/**
 * Select best shot based on story context
 */
export function selectHighContrastShot(
  action?: string,
  emotion?: string,
  pageType?: 'opening' | 'action' | 'closing',
  previousShot?: string
): string {
  // Never repeat the previous shot
  const availableShots = Object.keys(HIGH_CONTRAST_SHOTS).filter(id => id !== previousShot);
  
  // Filter by page type
  let candidates = availableShots;
  if (pageType) {
    candidates = availableShots.filter(id => {
      const shot = HIGH_CONTRAST_SHOTS[id];
      return shot.page_type === pageType || !shot.page_type;
    });
  }
  
  // Match to action
  if (action) {
    const actionMatches = candidates.filter(id => {
      const shot = HIGH_CONTRAST_SHOTS[id];
      return shot.best_for?.some(use => action.toLowerCase().includes(use));
    });
    if (actionMatches.length > 0) {
      return actionMatches[Math.floor(Math.random() * actionMatches.length)];
    }
  }
  
  // Default: pick randomly from candidates
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function buildHighContrastPrompt(
  shotId: string,
  context: {
    includeCharacter: boolean;
    objectDescription?: string;
    action?: string;
    emotion?: string;
    gender?: 'boy' | 'girl' | 'neutral';
    narration?: string;  // Add narration to context
  }
): string {
  const shot = HIGH_CONTRAST_SHOTS[shotId];
  if (!shot) {
    return 'paper collage cutout on white background';
  }
  
  // Start with the specific camera angle
  let prompt = `${shot.base_prompt}\n`;
  prompt += `${shot.isolation_prompt}\n`;
  
  // For character-free shots
  if (!shot.requires_character) {
    prompt += 'NO PEOPLE, NO CHARACTERS in this shot\n';
    
    // Extract objects from narration for character-free pages
    if (context.narration) {
      const narrationLower = context.narration.toLowerCase();
      
      // Try to find specific objects in the narration
      const objectMap: Record<string, string> = {
        'duck': 'yellow rubber duck',
        'ball': 'colorful bouncing ball',
        'teddy': 'soft teddy bear',
        'bear': 'cuddly teddy bear',
        'toy': 'bright children\'s toy',
        'bottle': 'baby bottle',
        'blanket': 'soft baby blanket',
        'book': 'colorful picture book',
        'blocks': 'wooden alphabet blocks',
        'flower': 'bright paper flower',
        'butterfly': 'colorful paper butterfly',
        'star': 'shimmering paper star',
        'moon': 'crescent paper moon',
        'sun': 'bright paper sun',
        'cloud': 'fluffy paper cloud'
      };
      
      for (const [keyword, description] of Object.entries(objectMap)) {
        if (narrationLower.includes(keyword)) {
          prompt += `Focus on: paper collage ${description}\n`;
          prompt += `This object relates to the story: "${context.narration}"\n`;
          break;
        }
      }
    }
    
    if (context.objectDescription) {
      prompt += `Main object: ${context.objectDescription}\n`;
    }
    
    prompt += 'Paper collage style object or scene, clean white background\n';
    return prompt;
  }
  
  // For character shots - incorporate the story narration
  prompt += 'Paper collage cutout baby, isolated on pure white\n';
  
  // Parse the narration for specific actions and context
  if (context.narration) {
    const narrationLower = context.narration.toLowerCase();
    
    // Extract and add specific body positions
    if (narrationLower.includes('hands')) {
      prompt += 'Focus on baby\'s hands in the shot\n';
    } else if (narrationLower.includes('feet') || narrationLower.includes('toes')) {
      prompt += 'Show baby\'s feet or toes prominently\n';
    } else if (narrationLower.includes('face') || narrationLower.includes('smile')) {
      prompt += 'Focus on baby\'s face and expression\n';
    }
    
    // Add context-specific details
    if (narrationLower.includes('first')) {
      prompt += 'This is a milestone moment - baby\'s first time\n';
    }
    if (narrationLower.includes('discover')) {
      prompt += 'Baby is discovering something new with wonder\n';
    }
    if (narrationLower.includes('reach')) {
      prompt += 'Baby reaching or stretching toward something\n';
    }
  }
  
  // Add gender clarity
  if (context.gender) {
    if (context.gender === 'girl') {
      prompt += 'Clearly a paper cutout baby GIRL with feminine outfit\n';
    } else if (context.gender === 'boy') {
      prompt += 'Obviously a paper cutout baby BOY with boyish outfit\n';
    }
  }
  
  // Add the specific action from the story
  if (context.action) {
    prompt += `Story action: ${context.action}\n`;
  }
  
  // Add emotion that matches the narration
  if (context.emotion) {
    prompt += `Emotional expression: ${context.emotion}\n`;
  }
  
  // Include a reference to what's happening in the story
  if (context.narration) {
    // Truncate if too long
    const shortNarration = context.narration.length > 100 
      ? context.narration.substring(0, 100) + '...'
      : context.narration;
    prompt += `\nThis image illustrates: "${shortNarration}"\n`;
  }
  
  // Final emphasis on the specific angle
  prompt += `\nCRITICAL: This MUST be a ${shot.name} shot - ${shot.base_prompt}`;
  
  return prompt;
}