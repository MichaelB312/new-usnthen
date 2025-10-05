// lib/prompts/landscapePagePrompt.ts
/**
 * Landscape Page Prompt Builder - WITH MULTI-CHARACTER SUPPORT
 * Each "page" is a 1536×1024 landscape image that displays as an open book
 */

import { Page, PersonId } from '@/lib/store/bookStore';
import { getCameraAngleDescription, CAMERA_ANGLES } from '@/lib/camera/highContrastShots';

/**
 * Extract the core action from visual_action or narration
 */
function extractAction(page: Page): string {
  if (page.visual_action) return page.visual_action;

  const narration = page.narration || '';
  const actionVerbs = ['standing', 'crawling', 'hugging', 'laughing', 'walking', 'clapping',
                       'rubbing', 'sitting', 'reaching', 'grabbing', 'smiling', 'playing',
                       'splashing', 'holding', 'waving', 'pointing'];

  for (const verb of actionVerbs) {
    if (narration.toLowerCase().includes(verb)) {
      return verb;
    }
  }

  return 'sitting';
}

/**
 * Map PersonId to readable character name
 */
function getCharacterName(personId: PersonId): string {
  const names: Record<PersonId, string> = {
    baby: 'baby',
    mom: 'mom',
    dad: 'dad',
    grandma: 'grandma',
    grandpa: 'grandpa',
    sibling: 'sibling',
    aunt: 'aunt',
    uncle: 'uncle',
    friend: 'friend'
  };
  return names[personId] || 'person';
}

/**
 * Build character description for prompts with multiple people
 */
function buildCharacterDescription(characters: PersonId[], action: string, narration: string): string {
  if (characters.length === 0 || (characters.length === 1 && characters[0] === 'baby')) {
    // Single baby
    return `Baby ${action}`;
  }

  if (characters.length === 1 && characters[0] !== 'baby') {
    // Only supporting character (rare case)
    return `${getCharacterName(characters[0])} ${action}`;
  }

  // Multiple characters - detect interaction from narration
  const lowerNarration = narration.toLowerCase();
  const otherCharacters = characters.filter(c => c !== 'baby').map(getCharacterName);

  // Build character list
  let characterList = 'Baby';
  if (otherCharacters.length === 1) {
    characterList += ` and ${otherCharacters[0]}`;
  } else if (otherCharacters.length === 2) {
    characterList += `, ${otherCharacters[0]}, and ${otherCharacters[1]}`;
  } else if (otherCharacters.length > 2) {
    characterList += ` and family members`;
  }

  // Detect specific interactions
  if (lowerNarration.includes('hold') && lowerNarration.includes('hand')) {
    return `${characterList} holding hands while ${action}`;
  } else if (lowerNarration.includes('hug')) {
    return `${characterList} hugging`;
  } else if (lowerNarration.includes('watch') || lowerNarration.includes('look at')) {
    return `${characterList} together, ${otherCharacters[0] || 'parent'} watching ${action}`;
  } else if (lowerNarration.includes('together') || lowerNarration.includes('with')) {
    return `${characterList} ${action} together`;
  } else if (lowerNarration.includes('reach') && otherCharacters.length > 0) {
    return `Baby ${action} toward ${otherCharacters[0]}`;
  } else {
    // Default: describe spatial relationship
    return `Baby ${action}, ${otherCharacters[0] || 'parent'} beside them`;
  }
}

/**
 * Build ultra-simple prompt for ONE page with camera angle and multi-character support
 */
// Track which group camera angle was used last (alternates per function call)
let lastGroupCameraAngle: 'birds_eye' | 'wide' = 'wide';

export function buildLandscapePagePrompt(page: Page): string {
  const characters = page.characters_on_page || [];
  const hasCharacters = characters.length > 0;
  const isGroupScene = characters.length > 1;

  // For group scenes, use EXTREME camera angles and alternate between them
  let cameraAngle = page.camera_angle || page.shot_id || 'medium_shot';
  let cameraDescription = getCameraAngleDescription(cameraAngle);

  if (isGroupScene) {
    // Alternate between bird's eye and wide shot (don't use same twice in a row)
    if (lastGroupCameraAngle === 'wide') {
      cameraAngle = 'birds_eye_overhead';
      cameraDescription = "EXTREME bird's-eye view: Very high overhead, looking straight down from far above";
      lastGroupCameraAngle = 'birds_eye';
    } else {
      cameraAngle = 'establishing_wide';
      cameraDescription = "EXTREME wide shot: Very far distance, characters appear small in the frame";
      lastGroupCameraAngle = 'wide';
    }
  } else {
    cameraDescription = getCameraAngleDescription(cameraAngle);
  }

  const action = extractAction(page);

  // Extract setting from page metadata or default to beach
  const setting = page.spread_metadata?.setting || 'beach';
  const specialObject = page.spread_metadata?.special_object;

  if (!hasCharacters) {
    // Character-free page - just objects
    return `Soft paper collage style. 1536×1024 landscape. FULL BLEED edge-to-edge composition, NO white borders.
${page.spread_metadata?.action || 'Objects on sand'} in ${setting}.
Light pastel colors, cheerful bright tones. Objects only, no people.
Paper cutout elements with white background showing between pieces. Cute, gentle aesthetic.`;
  }

  // Build character description with interaction detection
  const characterDesc = buildCharacterDescription(characters, action, page.narration || '');

  // Add special object if mentioned
  const objectMention = specialObject && specialObject.toLowerCase() !== 'no' && specialObject.toLowerCase() !== 'none'
    ? ` with ${specialObject}`
    : '';

  // Determine character positioning (rule of thirds)
  const useLeftThird = Math.random() > 0.5;
  const characterSide = useLeftThird ? 'left third' : 'right third';
  const textSide = useLeftThird ? 'right third' : 'left third';
  const textAlignment = useLeftThird ? 'right-aligned' : 'left-aligned';

  // Use isGroupScene already defined earlier for composition note
  const compositionNote = isGroupScene
    ? `Wide composition. Group ALL characters together in the ${characterSide}. Keep all characters on one side, do not spread them across the image.`
    : `Position character in the ${characterSide}.`;

  // Return both the prompt and metadata for text placement
  const promptData = {
    prompt: `Soft paper collage style. 1536×1024 landscape. FULL BLEED edge-to-edge composition, NO white borders.
${cameraDescription}: ${characterDesc}${objectMention} in ${setting}.

CRITICAL COMPOSITION - RULE OF THIRDS:
- Position ALL characters in the ${characterSide} of the image (NEVER in the middle third)
- ${compositionNote}
- Keep the ${textSide} clear and relatively uncluttered for later text overlay
- Characters should be composed within the ${characterSide} area only

Soft paper collage style with gentle torn edges. NO warm filter. NO yellow tones.
Light pastel colors with bright cheerful accents. Soft, cute aesthetic.
CRITICAL: This page MUST have completely different camera angle and action from other pages.
Use reference images for ALL character appearances.`,
    textSide: textSide,
    textAlignment: textAlignment,
    narration: page.narration
  };

  return promptData.prompt;
}

/**
 * Get text placement metadata for a page
 */
export function getTextPlacementData(page: Page): {
  textSide: 'left third' | 'right third';
  textAlignment: 'left-aligned' | 'right-aligned';
  narration: string;
  textBoxCoordinates: { x: number; y: number; width: number; height: number };
} {
  const characters = page.characters_on_page || [];
  const useLeftThird = Math.random() > 0.5;
  const characterSide = useLeftThird ? 'left third' : 'right third';
  const textSide = useLeftThird ? 'right third' : 'left third';
  const textAlignment = useLeftThird ? 'right-aligned' : 'left-aligned';

  // Calculate exact text box coordinates based on which side
  // Image is 1536×1024
  const textBoxCoordinates = textSide === 'right third'
    ? { x: 1024, y: 150, width: 462, height: 724 }  // Right third with margins
    : { x: 50, y: 150, width: 462, height: 724 };   // Left third with margins

  return {
    textSide,
    textAlignment,
    narration: page.narration || '',
    textBoxCoordinates
  };
}
