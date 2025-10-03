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
export function buildLandscapePagePrompt(page: Page): string {
  const characters = page.characters_on_page || [];
  const hasCharacters = characters.length > 0;
  const cameraAngle = page.camera_angle || page.shot_id || 'medium_shot';
  const cameraDescription = getCameraAngleDescription(cameraAngle);
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

  // Character page - with camera angle and multi-character support
  return `Soft paper collage style. 1536×1024 landscape. FULL BLEED edge-to-edge composition, NO white borders.
${cameraDescription}: ${characterDesc}${objectMention} in ${setting}.
Light pastel colors with bright cheerful accents. NOT dark colors. Soft, cute aesthetic.
White background visible between paper elements. Paper cutout pieces with gentle torn edges.
CRITICAL: This page MUST have completely different camera angle and action from other pages.
Use reference images for ALL character appearances.`;
}
