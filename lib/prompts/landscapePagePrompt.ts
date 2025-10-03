// lib/prompts/landscapePagePrompt.ts
/**
 * Landscape Page Prompt Builder - SIMPLIFIED WITH CAMERA ANGLES
 * Each "page" is a 1536×1024 landscape image that displays as an open book
 */

import { Page } from '@/lib/store/bookStore';
import { getCameraAngleDescription, CAMERA_ANGLES } from '@/lib/camera/highContrastShots';

/**
 * Extract the core action from visual_action or narration
 */
function extractAction(page: Page): string {
  if (page.visual_action) return page.visual_action;

  const narration = page.narration || '';
  const actionVerbs = ['standing', 'crawling', 'hugging', 'laughing', 'walking', 'clapping',
                       'rubbing', 'sitting', 'reaching', 'grabbing', 'smiling', 'playing'];

  for (const verb of actionVerbs) {
    if (narration.toLowerCase().includes(verb)) {
      return verb;
    }
  }

  return 'sitting';
}

/**
 * Build ultra-simple prompt for ONE page with camera angle variety enforcement
 */
export function buildLandscapePagePrompt(page: Page): string {
  const hasCharacters = (page.characters_on_page?.length || 0) > 0;
  const cameraAngle = page.camera_angle || page.shot_id || 'medium_shot';
  const cameraDescription = getCameraAngleDescription(cameraAngle);
  const action = extractAction(page);

  // Extract setting from page metadata or default to beach
  const setting = page.spread_metadata?.setting || 'beach';

  if (!hasCharacters) {
    // Character-free page - just objects
    return `Paper collage style. 1536×1024 landscape. FULL BLEED edge-to-edge, NO white padding or borders.
${page.spread_metadata?.action || 'Objects on sand'} in ${setting}.
Objects only, no people. Clean paper cutout aesthetic. Full bleed composition.`;
  }

  // Character page - with camera angle and variety enforcement
  return `Paper collage style. 1536×1024 landscape. FULL BLEED edge-to-edge, NO white padding or borders.
${cameraDescription}: Character ${action} in ${setting}.
CRITICAL: This page MUST have a completely different camera angle and action from other pages.
Use reference image for character appearance. Paper cutout aesthetic. Full bleed composition.`;
}
