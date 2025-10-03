// lib/sequence/spreadSequence.ts
/**
 * Landscape Spread Sequence & Continuity System
 * Generates metadata for each spread unit to guide image composition
 */

import { SpreadSequenceMetadata, BeatType, AnchorPosition, Page } from '@/lib/store/bookStore';

/**
 * Generate sequence metadata for all spreads in a story
 */
export function generateSpreadSequence(
  pages: Page[],
  storyMetadata?: any
): SpreadSequenceMetadata[] {
  const spreadCount = Math.ceil(pages.length / 2);
  const sequences: SpreadSequenceMetadata[] = [];

  for (let i = 0; i < spreadCount; i++) {
    const leftPage = pages[i * 2];
    const rightPage = pages[i * 2 + 1];

    // Merge narration from both pages
    const mergedNarration = [
      leftPage?.narration || '',
      rightPage?.narration || ''
    ].filter(Boolean).join(' ');

    // Determine beat based on position in story
    const beat = determineSpreadBeat(i, spreadCount);

    // Extract setting from narration
    const setting = extractSetting(mergedNarration, leftPage, rightPage);

    // Extract primary action
    const action = extractPrimaryAction(mergedNarration, leftPage, rightPage);

    // Determine mood palette
    const mood_palette = extractMoodPalette(mergedNarration, leftPage, rightPage);

    // Determine visual anchor (background support)
    const visual_anchor = determineVisualAnchor(setting, action, mergedNarration);

    // Determine character anchor position (alternates by default)
    const char_anchor_hint = determineCharacterAnchor(i, leftPage, rightPage);

    // Text zone is opposite of character
    const text_zone_hint = getOppositePosition(char_anchor_hint);

    // Extract optional refinement word
    const refinement_word = extractRefinementWord(mergedNarration, action);

    // Continuity hints
    const continuity_from_prev = i > 0 ? `Continues from previous spread` : undefined;
    const lead_to_next = i < spreadCount - 1 ? `Leads to next moment` : undefined;

    sequences.push({
      seq: i,
      beat,
      setting,
      action,
      mood_palette,
      visual_anchor,
      char_anchor_hint,
      text_zone_hint,
      refinement_word,
      continuity_from_prev,
      lead_to_next,
      avoid: ['stickers', 'icons', 'stars', 'hearts', 'butterflies', 'emojis', 'gradients', 'heavy outlines', 'clutter']
    });
  }

  return sequences;
}

/**
 * Determine story beat based on spread position
 */
function determineSpreadBeat(spreadIndex: number, totalSpreads: number): BeatType {
  const position = spreadIndex / (totalSpreads - 1 || 1);

  if (position < 0.2) return 'setup';
  if (position < 0.5) return 'discovery';
  if (position < 0.7) return 'challenge';
  if (position < 0.9) return 'big_moment';
  return 'resolution';
}

/**
 * Extract setting from narration and page data
 */
function extractSetting(narration: string, leftPage?: Page, rightPage?: Page): string {
  const lower = narration.toLowerCase();

  // Check for explicit setting keywords
  if (lower.includes('beach') || lower.includes('sand') || lower.includes('ocean')) return 'beach';
  if (lower.includes('forest') || lower.includes('tree') || lower.includes('woods')) return 'forest';
  if (lower.includes('park') || lower.includes('playground') || lower.includes('outside')) return 'park';
  if (lower.includes('bath') || lower.includes('water') || lower.includes('splash')) return 'bath';
  if (lower.includes('bedroom') || lower.includes('bed') || lower.includes('sleep')) return 'bedroom';
  if (lower.includes('kitchen') || lower.includes('eat') || lower.includes('food')) return 'kitchen';
  if (lower.includes('garden') || lower.includes('flower') || lower.includes('plant')) return 'garden';
  if (lower.includes('party') || lower.includes('birthday') || lower.includes('celebration')) return 'party';

  // Default to neutral indoor
  return 'home';
}

/**
 * Extract primary action verb/event
 */
function extractPrimaryAction(narration: string, leftPage?: Page, rightPage?: Page): string {
  // Use visual_action if available
  if (leftPage?.visual_action) return leftPage.visual_action;
  if (rightPage?.visual_action) return rightPage.visual_action;

  const lower = narration.toLowerCase();

  // Extract action verbs
  if (lower.includes('crawl')) return 'crawling';
  if (lower.includes('walk') || lower.includes('step')) return 'walking';
  if (lower.includes('reach')) return 'reaching';
  if (lower.includes('laugh') || lower.includes('giggle')) return 'laughing';
  if (lower.includes('splash') || lower.includes('play with water')) return 'splashing';
  if (lower.includes('eat') || lower.includes('munch')) return 'eating';
  if (lower.includes('hug') || lower.includes('cuddle')) return 'hugging';
  if (lower.includes('sleep') || lower.includes('rest')) return 'sleeping';
  if (lower.includes('discover') || lower.includes('find')) return 'discovering';
  if (lower.includes('jump')) return 'jumping';
  if (lower.includes('dance')) return 'dancing';
  if (lower.includes('play')) return 'playing';

  return 'being present';
}

/**
 * Extract mood palette from narration and emotion
 */
function extractMoodPalette(narration: string, leftPage?: Page, rightPage?: Page): string {
  const emotion = leftPage?.emotion || rightPage?.emotion;
  const lower = narration.toLowerCase();

  // Check emotional keywords
  if (lower.includes('joy') || lower.includes('happy') || lower.includes('delight')) {
    return 'bright warm colors (yellows, oranges, warm pinks)';
  }
  if (lower.includes('peaceful') || lower.includes('calm') || lower.includes('quiet')) {
    return 'soft pastels (light blues, pale greens, cream)';
  }
  if (lower.includes('exciting') || lower.includes('adventure') || lower.includes('discover')) {
    return 'vibrant energetic colors (bright reds, oranges, yellows)';
  }
  if (lower.includes('wonder') || lower.includes('magical') || lower.includes('curious')) {
    return 'soft magical tones (purples, blues, gentle pinks)';
  }
  if (lower.includes('cozy') || lower.includes('warm') || lower.includes('snug')) {
    return 'warm earth tones (browns, oranges, soft reds)';
  }

  // Fallback based on emotion
  if (emotion === 'joy') return 'bright cheerful colors';
  if (emotion === 'peaceful') return 'soft calming colors';
  if (emotion === 'curious') return 'gentle wonder colors';

  return 'warm kid-friendly palette';
}

/**
 * Determine visual anchor (background support elements)
 */
function determineVisualAnchor(setting: string, action: string, narration: string): string {
  const lower = narration.toLowerCase();

  // Setting-based anchors
  if (setting === 'beach') return 'shoreline band along bottom edge, gentle wave texture';
  if (setting === 'forest') return 'leafy corner wedge from top-right, soft tree silhouettes';
  if (setting === 'park') return 'ground pad along bottom, subtle grass texture';
  if (setting === 'bath') return 'water edge band along bottom, bubble accents';
  if (setting === 'bedroom') return 'window edge from side, soft curtain shape';
  if (setting === 'kitchen') return 'floor band along bottom, simple counter edge';
  if (setting === 'garden') return 'flower corner wedge, gentle petal shapes';
  if (setting === 'party') return 'festive corner bands, gentle celebratory shapes';

  // Action-based anchors
  if (lower.includes('sky') || lower.includes('cloud')) return 'horizon stripe along top, cloud shapes';
  if (lower.includes('floor') || lower.includes('ground')) return 'floor band along bottom edge';

  return 'subtle edge bands suggesting environment context';
}

/**
 * Determine character anchor position (alternates by spread)
 */
function determineCharacterAnchor(
  spreadIndex: number,
  leftPage?: Page,
  rightPage?: Page
): AnchorPosition {
  // Check if there are characters on the pages
  const leftHasChar = (leftPage?.characters_on_page?.length || 0) > 0;
  const rightHasChar = (rightPage?.characters_on_page?.length || 0) > 0;

  // If no characters, return center
  if (!leftHasChar && !rightHasChar) return 'center';

  // Alternate between left and right
  return spreadIndex % 2 === 0 ? 'left' : 'right';
}

/**
 * Get opposite position for text placement
 */
function getOppositePosition(pos: AnchorPosition): AnchorPosition {
  if (pos === 'left') return 'right';
  if (pos === 'right') return 'left';
  return 'center';
}

/**
 * Extract optional refinement word from narration
 * Only extracts if the narration naturally includes sound effects or repeated words
 */
function extractRefinementWord(narration: string, action: string): string | undefined {
  const lower = narration.toLowerCase();

  // Look for repeated words (like "splash splash" or "giggle giggle")
  const repeatedPattern = /\b(\w+)\s+\1\b/i;
  const match = narration.match(repeatedPattern);
  if (match) {
    return match[0]; // Return the full "word word" pattern
  }

  // Look for onomatopoeia
  if (lower.includes('boom')) return 'boom!';
  if (lower.includes('splash')) return 'splash!';
  if (lower.includes('whoosh')) return 'whoosh!';
  if (lower.includes('giggle')) return 'giggle giggle';
  if (lower.includes('yay')) return 'yay!';
  if (lower.includes('wow')) return 'wow!';
  if (lower.includes('shh') || lower.includes('shhh')) return 'shhhh';
  if (lower.includes('zoom')) return 'zoom!';
  if (lower.includes('pop')) return 'pop!';

  // Don't force a refinement word if it's not natural
  return undefined;
}