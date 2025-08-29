// lib/styles/paperCollage.ts
/**
 * Paper Collage Style System
 * Our unique brand signature style for children's book illustrations
 */

export interface StyleDefinition {
  id: string;
  name: string;
  base_prompt: string;
  texture_details: string;
  color_palette: string;
  composition_rules: string;
  gender_enhancement: {
    girl: string;
    boy: string;
    neutral: string;
  };
}

export const PAPER_COLLAGE_STYLE: StyleDefinition = {
  id: 'paper-collage',
  name: 'Paper Collage',
  base_prompt: 'Paper collage illustration style, tactile handmade paper cutouts with visible texture and layers',
  texture_details: 'torn paper edges, visible paper grain, layered depth with subtle shadows, handcrafted feel, construction paper and tissue paper textures',
  color_palette: 'soft pastels mixed with bright accent colors, gentle gradients within paper pieces, warm and inviting tones',
  composition_rules: 'clear shapes, distinct paper layers creating depth, visible overlapping edges, playful arrangement, dimensional feel',
  gender_enhancement: {
    girl: 'clearly feminine baby girl with delicate features, soft rounded cheeks, gentle expression, wearing distinctly girly outfit with bows, flowers, or ruffles in pinks, purples, or soft pastels, longer eyelashes, sweet and adorable appearance',
    boy: 'clearly masculine baby boy with defined boyish features, playful expression, wearing distinctly boyish outfit in blues, greens, or earth tones, shorter hair, active and energetic appearance',
    neutral: 'adorable baby with sweet expression, wearing cheerful outfit in yellows, oranges, or rainbow colors, playful and happy appearance'
  }
};

/**
 * Build a complete Paper Collage style prompt with gender awareness
 */
export function buildPaperCollagePrompt(
  basePrompt: string,
  gender: 'boy' | 'girl' | 'neutral',
  includeCharacterDetails: boolean = true
): string {
  const style = PAPER_COLLAGE_STYLE;
  
  // Start with the style foundation
  let prompt = `${style.base_prompt}, ${basePrompt}`;
  
  // Add gender-specific character details
  if (includeCharacterDetails) {
    prompt += `, ${style.gender_enhancement[gender]}`;
  }
  
  // Add texture and composition details
  prompt += `, ${style.texture_details}, ${style.composition_rules}`;
  
  // Add color palette
  prompt += `, ${style.color_palette}`;
  
  // Technical specifications for consistency
  prompt += ', high contrast for baby books, clear distinct shapes, safe rounded corners on all paper pieces';
  
  // Ensure it's child-appropriate
  prompt += ', whimsical and charming, suitable for ages 0-3, absolutely adorable and heartwarming';
  
  return prompt;
}

/**
 * Get gender-aware character description
 */
export function getGenderDescription(
  gender: 'boy' | 'girl' | 'neutral',
  characterType: 'baby' | 'toddler' = 'baby'
): string {
  const descriptions = {
    girl: {
      baby: 'adorable baby girl with clearly feminine features, sweet expression, soft pink bow or headband, wearing cute dress or outfit with floral details',
      toddler: 'precious toddler girl with pigtails or bows in hair, wearing pretty dress with ruffles, clearly a little girl, feminine and sweet'
    },
    boy: {
      baby: 'cute baby boy with clearly boyish features, playful expression, wearing onesie or outfit in blues and greens, distinctly a baby boy',
      toddler: 'energetic toddler boy with short hair, wearing overalls or shorts, clearly a little boy, active and adventurous'
    },
    neutral: {
      baby: 'adorable baby with happy expression, wearing colorful outfit, sweet and playful',
      toddler: 'cheerful toddler with bright smile, wearing rainbow or yellow outfit, joyful and energetic'
    }
  };
  
  return descriptions[gender][characterType];
}

/**
 * Style-specific visual elements for Paper Collage
 */
export const PAPER_COLLAGE_ELEMENTS = {
  backgrounds: [
    'layered paper clouds with cotton texture',
    'paper cutout trees with tissue paper leaves',
    'construction paper sun with radiating paper strips',
    'torn paper waves in gradient blues',
    'paper flower garden with dimensional petals'
  ],
  
  textures: [
    'visible paper grain and fibers',
    'torn and deckled edges',
    'crepe paper crinkles',
    'corrugated cardboard texture',
    'tissue paper translucency'
  ],
  
  effects: [
    'paper pieces casting soft shadows',
    'overlapping layers creating depth',
    'curled paper edges adding dimension',
    'paper accordion folds for texture',
    'paper quilling spiral details'
  ],
  
  props: {
    girl: [
      'paper butterfly with glitter accents',
      'tissue paper flowers in pinks and purples',
      'paper ribbon bows',
      'paper heart decorations',
      'paper doll accessories'
    ],
    boy: [
      'paper airplane with fold details',
      'construction paper cars and trucks',
      'paper sailboat with tissue sail',
      'paper dinosaur cutouts',
      'paper ball with pentagon patches'
    ],
    neutral: [
      'paper rainbow with cotton clouds',
      'paper stars and moon',
      'paper balloons on string',
      'paper animals (bunny, bear, duck)',
      'paper blocks with letters'
    ]
  }
};

/**
 * Enhanced prompt builder for specific scenes
 */
export function buildScenePrompt(
  scene: {
    action: string;
    setting: string;
    mood: string;
    characters: Array<{ type: string; gender: 'boy' | 'girl' | 'neutral' }>;
  }
): string {
  let prompt = PAPER_COLLAGE_STYLE.base_prompt;
  
  // Add each character with clear gender distinction
  scene.characters.forEach(character => {
    if (character.type === 'baby' || character.type === 'toddler') {
      prompt += `, ${getGenderDescription(character.gender, character.type as 'baby' | 'toddler')}`;
    }
  });
  
  // Add action and setting
  prompt += `, ${scene.action} in ${scene.setting}`;
  
  // Add mood-appropriate details
  if (scene.mood === 'playful') {
    prompt += ', bright colored paper pieces, dynamic arrangement';
  } else if (scene.mood === 'peaceful') {
    prompt += ', soft pastel paper layers, gentle composition';
  } else if (scene.mood === 'joyful') {
    prompt += ', vibrant paper colors, celebratory feel';
  }
  
  // Add paper-specific details
  prompt += `, ${PAPER_COLLAGE_STYLE.texture_details}`;
  prompt += ', clear paper-cut illustration style, handmade aesthetic';
  
  return prompt;
}

/**
 * Validate and enhance any prompt with Paper Collage style
 */
export function enhanceWithPaperCollage(
  originalPrompt: string,
  gender?: 'boy' | 'girl' | 'neutral'
): string {
  // Remove any conflicting style mentions
  let enhanced = originalPrompt.replace(
    /watercolor|oil paint|digital art|pencil|crayon|photorealistic/gi, 
    ''
  );
  
  // Ensure Paper Collage style is prominent
  if (!enhanced.includes('paper collage')) {
    enhanced = `Paper collage art style, ${enhanced}`;
  }
  
  // Add texture if not present
  if (!enhanced.includes('paper') || !enhanced.includes('texture')) {
    enhanced += ', visible paper texture and torn edges';
  }
  
  // Add gender clarity if specified
  if (gender && !enhanced.includes('girl') && !enhanced.includes('boy')) {
    enhanced += `, ${PAPER_COLLAGE_STYLE.gender_enhancement[gender]}`;
  }
  
  // Ensure it ends with child-appropriate context
  if (!enhanced.includes('children') && !enhanced.includes('baby book')) {
    enhanced += ', children\'s book illustration for ages 0-3';
  }
  
  return enhanced;
}