// lib/styles/paperCollage.ts
/**
 * Paper Collage Style System - Isolated Subject Version
 * Creates isolated paper cutout characters on white backgrounds
 */

export interface StyleDefinition {
  id: string;
  name: string;
  base_prompt: string;
  texture_details: string;
  color_palette: string;
  composition_rules: string;
  isolation_rules: string;
  gender_enhancement: {
    girl: string;
    boy: string;
    neutral: string;
  };
}

export const PAPER_COLLAGE_STYLE: StyleDefinition = {
  id: 'paper-collage',
  name: 'Paper Collage Isolated',
  base_prompt: 'Isolated paper collage character on pure white background, single paper cutout figure with visible texture and layers',
  texture_details: 'torn paper edges, visible paper grain, layered depth with subtle shadows on white, handcrafted feel, construction paper and tissue paper textures',
  color_palette: 'soft pastels mixed with bright accent colors for the character only, pure white background, warm and inviting tones on the subject',
  composition_rules: 'centered isolated subject, minimal ground surface indication, no background elements, clear negative space, focus entirely on character and immediate surface',
  isolation_rules: 'ISOLATED SUBJECT on PURE WHITE BACKGROUND, NO sky, NO background scenery, NO environmental details beyond immediate surface, character floating on white with only ground texture directly under them',
  gender_enhancement: {
    girl: 'clearly feminine baby girl paper cutout with delicate features, soft rounded cheeks, gentle expression, wearing distinctly girly outfit with bows, flowers, or ruffles in pinks, purples, or soft pastels, longer eyelashes, sweet and adorable appearance',
    boy: 'clearly masculine baby boy paper cutout with defined boyish features, playful expression, wearing distinctly boyish outfit in blues, greens, or earth tones, shorter hair, active and energetic appearance',
    neutral: 'adorable baby paper cutout with sweet expression, wearing cheerful outfit in yellows, oranges, or rainbow colors, playful and happy appearance'
  }
};

/**
 * Build an isolated Paper Collage style prompt
 */
export function buildPaperCollagePrompt(
  basePrompt: string,
  gender: 'boy' | 'girl' | 'neutral',
  includeCharacterDetails: boolean = true
): string {
  const style = PAPER_COLLAGE_STYLE;
  
  // Start with isolation rules
  let prompt = `${style.isolation_rules}, ${style.base_prompt}, ${basePrompt}`;
  
  // Add gender-specific character details
  if (includeCharacterDetails) {
    prompt += `, ${style.gender_enhancement[gender]}`;
  }
  
  // Add texture but emphasize isolation
  prompt += `, ${style.texture_details}, isolated on white background`;
  
  // Add composition for isolated subject
  prompt += `, ${style.composition_rules}`;
  
  // Technical specifications for isolation
  prompt += ', studio lighting on white background, isolated product photography style, minimal cast shadow on immediate surface only';
  
  // Reinforce isolation
  prompt += ', IMPORTANT: pure white background, no scenery, no sky, no environmental details, only character and immediate ground surface they touch';
  
  return prompt;
}

/**
 * Get isolated character description
 */
export function getGenderDescription(
  gender: 'boy' | 'girl' | 'neutral',
  characterType: 'baby' | 'toddler' = 'baby'
): string {
  const descriptions = {
    girl: {
      baby: 'isolated paper cutout baby girl on white background with clearly feminine features, sweet expression, soft pink bow or headband, wearing cute dress or outfit with floral details',
      toddler: 'isolated paper cutout toddler girl on white background with pigtails or bows in hair, wearing pretty dress with ruffles, clearly a little girl, feminine and sweet'
    },
    boy: {
      baby: 'isolated paper cutout baby boy on white background with clearly boyish features, playful expression, wearing onesie or outfit in blues and greens, distinctly a baby boy',
      toddler: 'isolated paper cutout toddler boy on white background with short hair, wearing overalls or shorts, clearly a little boy, active and adventurous'
    },
    neutral: {
      baby: 'isolated paper cutout baby on white background with happy expression, wearing colorful outfit, sweet and playful',
      toddler: 'isolated paper cutout toddler on white background with bright smile, wearing rainbow or yellow outfit, joyful and energetic'
    }
  };
  
  return descriptions[gender][characterType];
}

/**
 * Surface texture descriptions for minimal ground indication
 */
export const SURFACE_TEXTURES = {
  beach: 'small patch of paper sand texture directly under character',
  park: 'tiny area of paper grass texture beneath character',
  grass: 'minimal paper grass cutouts just under feet',
  water: 'small paper water ripples only where character touches',
  floor: 'thin paper floor line under character',
  wood: 'paper wood grain strip beneath character',
  carpet: 'paper carpet texture patch under character',
  mat: 'paper mat rectangle directly under character',
  blanket: 'paper blanket edge just under character',
  ground: 'simple paper ground line beneath character'
};

/**
 * Extract surface from narration
 */
export function extractSurface(narration: string): string {
  const text = narration.toLowerCase();
  
  for (const [surface, texture] of Object.entries(SURFACE_TEXTURES)) {
    if (text.includes(surface)) {
      return texture;
    }
  }
  
  // Default minimal surface
  return 'thin paper ground line under character';
}

/**
 * Extract props from narration
 */
export function extractProps(narration: string): string[] {
  const props: string[] = [];
  const text = narration.toLowerCase();
  
  // Common baby props to look for
  const propKeywords = [
    'blanket', 'toy', 'ball', 'teddy', 'bear', 'bottle', 'pacifier',
    'rattle', 'book', 'blocks', 'spoon', 'cup', 'bowl', 'bib',
    'hat', 'shoes', 'socks', 'mittens', 'coconut', 'shell', 'flower',
    'leaf', 'stick', 'bucket', 'shovel', 'bubbles', 'balloon'
  ];
  
  for (const prop of propKeywords) {
    if (text.includes(prop)) {
      props.push(`paper cutout ${prop}`);
    }
  }
  
  return props;
}

/**
 * Build isolated scene prompt
 */
export function buildIsolatedScenePrompt(
  scene: {
    action: string;
    narration: string;
    mood: string;
    characters: Array<{ type: string; gender: 'boy' | 'girl' | 'neutral' }>;
  }
): string {
  // Start with strict isolation
  let prompt = 'ISOLATED CHARACTER on PURE WHITE BACKGROUND, no scenery, no sky, no environment';
  
  // Add paper collage style
  prompt += `, ${PAPER_COLLAGE_STYLE.base_prompt}`;
  
  // Add each character with clear gender distinction
  scene.characters.forEach(character => {
    if (character.type === 'baby' || character.type === 'toddler') {
      prompt += `, ${getGenderDescription(character.gender, character.type as 'baby' | 'toddler')}`;
    }
  });
  
  // Add action as isolated pose
  prompt += `, paper cutout character ${scene.action} on white background`;
  
  // Extract and add minimal surface
  const surface = extractSurface(scene.narration);
  prompt += `, ${surface}`;
  
  // Extract and add props if any
  const props = extractProps(scene.narration);
  if (props.length > 0) {
    prompt += `, with ${props.join(' and ')} as isolated paper elements`;
  }
  
  // Add mood through character expression only
  if (scene.mood === 'playful') {
    prompt += ', bright colored paper character, dynamic pose';
  } else if (scene.mood === 'peaceful') {
    prompt += ', soft pastel paper character, calm pose';
  } else if (scene.mood === 'joyful') {
    prompt += ', vibrant paper character, happy pose';
  }
  
  // Reinforce isolation
  prompt += ', studio photography style, product shot on white, no background elements whatsoever';
  
  return prompt;
}

/**
 * Enhance any prompt with isolated Paper Collage style
 */
export function enhanceWithIsolatedPaperCollage(
  originalPrompt: string,
  gender?: 'boy' | 'girl' | 'neutral'
): string {
  // Remove any conflicting style mentions
  let enhanced = originalPrompt.replace(
    /watercolor|oil paint|digital art|pencil|crayon|photorealistic|landscape|environment|scenery|sky|clouds|trees|buildings/gi, 
    ''
  );
  
  // Ensure isolation is prominent
  if (!enhanced.includes('isolated') && !enhanced.includes('white background')) {
    enhanced = `ISOLATED on PURE WHITE BACKGROUND, ${enhanced}`;
  }
  
  // Ensure Paper Collage style
  if (!enhanced.includes('paper collage')) {
    enhanced = `Paper collage cutout style, ${enhanced}`;
  }
  
  // Add texture if not present
  if (!enhanced.includes('paper') || !enhanced.includes('texture')) {
    enhanced += ', visible paper texture and torn edges on character only';
  }
  
  // Add gender clarity if specified
  if (gender && !enhanced.includes('girl') && !enhanced.includes('boy')) {
    enhanced += `, ${PAPER_COLLAGE_STYLE.gender_enhancement[gender]}`;
  }
  
  // Ensure isolation at the end
  enhanced += ', NO BACKGROUND ELEMENTS, only character and immediate surface, pure white background, isolated subject';
  
  return enhanced;
}