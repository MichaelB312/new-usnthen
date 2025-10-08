// lib/utils/characterMasks.ts
/**
 * Layer 1 - Character Mask Generation for Pose Variants
 * Creates masks that preserve face/identity while allowing pose/gesture edits
 */

const Canvas = require('canvas');

export interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Generate a character preservation mask for pose variants
 * Black = preserve (face, head, torso - identity critical)
 * White = editable (limbs, pose, gesture)
 *
 * @param preserveLevel - 'strict' (head only) | 'moderate' (head+torso) | 'loose' (head only, more limbs free)
 * @returns Base64 encoded PNG mask (1024×1024)
 */
export function generateCharacterPreservationMask(
  preserveLevel: 'strict' | 'moderate' | 'loose' = 'moderate'
): string {
  const canvas = Canvas.createCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');

  // Start with white (all editable)
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 1024, 1024);

  // Add black preserve regions based on level
  ctx.fillStyle = 'black';

  switch (preserveLevel) {
    case 'strict':
      // Preserve head, neck, and upper torso (most restrictive)
      // Head region: top 40% of image, centered
      ctx.beginPath();
      ctx.ellipse(512, 300, 280, 320, 0, 0, 2 * Math.PI);
      ctx.fill();
      // Upper torso
      ctx.fillRect(312, 500, 400, 200);
      break;

    case 'moderate':
      // Preserve head and core torso (balanced)
      // Head region
      ctx.beginPath();
      ctx.ellipse(512, 280, 260, 300, 0, 0, 2 * Math.PI);
      ctx.fill();
      // Torso region (narrower to allow more arm movement)
      ctx.fillRect(362, 480, 300, 180);
      break;

    case 'loose':
      // Preserve only head/face (minimal restrictions, max pose freedom)
      // Head only
      ctx.beginPath();
      ctx.ellipse(512, 260, 240, 280, 0, 0, 2 * Math.PI);
      ctx.fill();
      break;
  }

  // Add slight feathering to avoid hard edges (draw semi-transparent border)
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 20;
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  return canvas.toDataURL('image/png');
}

/**
 * Generate a background removal mask (for anchor generation)
 * Ensures transparent background by allowing all areas except pure character
 *
 * @returns Base64 encoded PNG mask (1024×1024)
 */
export function generateBackgroundRemovalMask(): string {
  const canvas = Canvas.createCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');

  // Fill with white (all areas editable for background removal)
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 1024, 1024);

  // Create a central character silhouette preserve zone (rough estimate)
  // This ensures the character itself is preserved while bg is removed
  ctx.fillStyle = 'black';

  // Character body shape (vertical oval for standing baby)
  ctx.beginPath();
  ctx.ellipse(512, 512, 320, 450, 0, 0, 2 * Math.PI);
  ctx.fill();

  return canvas.toDataURL('image/png');
}

/**
 * Helper to determine preserve level based on action type
 */
export function getPreserveLevelForAction(action?: string): 'strict' | 'moderate' | 'loose' {
  if (!action) return 'moderate';

  const actionLower = action.toLowerCase();

  // Strict: minimal movement, face is key
  if (actionLower.includes('sleep') ||
      actionLower.includes('rest') ||
      actionLower.includes('portrait')) {
    return 'strict';
  }

  // Loose: dynamic movement, need pose freedom
  if (actionLower.includes('reach') ||
      actionLower.includes('crawl') ||
      actionLower.includes('walk') ||
      actionLower.includes('jump') ||
      actionLower.includes('play') ||
      actionLower.includes('dance')) {
    return 'loose';
  }

  // Moderate: balanced approach for most actions
  return 'moderate';
}

/**
 * Create custom preservation mask from specific regions
 */
export function generateCustomPreservationMask(
  preserveRegions: MaskRegion[]
): string {
  const canvas = Canvas.createCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');

  // Start with white (all editable)
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 1024, 1024);

  // Draw black preserve regions
  ctx.fillStyle = 'black';
  for (const region of preserveRegions) {
    ctx.fillRect(region.x, region.y, region.width, region.height);
  }

  return canvas.toDataURL('image/png');
}
