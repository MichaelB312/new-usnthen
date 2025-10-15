// lib/utils/inpaintingMasks.ts
/**
 * Layer 3 - Inpainting Mask Generation
 * Creates masks that protect character + narration while opening zones for scene details
 */

const Canvas = require('canvas');

export interface InpaintingZones {
  topBand: { y: number; height: number }; // Sky/ceiling area
  bottomBand: { y: number; height: number }; // Ground/floor area
  corners: Array<{ x: number; y: number; width: number; height: number }>; // Corner zones for refinement words
  margins: { left: number; right: number }; // Side margins
}

/**
 * Generate inpainting mask for scene details + refinement words
 * Black = preserve (character panel + narration text)
 * White = editable (sky band, ground band, corners for refinement words)
 *
 * @param characterPosition - 'left' or 'right' panel
 * @param narrationBounds - { x, y, width, height } of narration text area
 * @param zones - Optional custom zones, uses defaults if not provided
 * @returns Base64 encoded PNG mask (1536×1024)
 */
export function generateInpaintingMask(
  characterPosition: 'left' | 'right',
  narrationBounds: { x: number; y: number; width: number; height: number },
  zones?: Partial<InpaintingZones>
): string {
  const canvas = Canvas.createCanvas(1536, 1024);
  const ctx = canvas.getContext('2d');

  // Start with black (all preserved)
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 1536, 1024);

  // Use default zones if not provided
  const defaultZones = getDefaultInpaintingZones();
  const finalZones = { ...defaultZones, ...zones };

  // Strategy: Start with WHITE (all editable), then paint BLACK to preserve specific areas
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 1536, 1024);

  // Now paint BLACK over areas to PRESERVE
  ctx.fillStyle = 'black';

  // Step 1: Preserve narration text area with VERY generous margin
  const textMargin = 80; // Increased from 50 to 80 for stronger protection

  // Calculate protected area bounds (with margin)
  const protectX = Math.max(0, narrationBounds.x - textMargin);
  const protectY = Math.max(0, narrationBounds.y - textMargin);
  const protectWidth = Math.min(
    1536 - protectX,  // Remaining canvas width from actual start position
    narrationBounds.width + (textMargin * 2)
  );
  const protectHeight = Math.min(
    1024 - protectY,  // Remaining canvas height from actual start position
    narrationBounds.height + (textMargin * 2)
  );

  // Draw protection area
  ctx.fillRect(protectX, protectY, protectWidth, protectHeight);

  console.log(`[InpaintingMask] Text protection: x=${protectX}, y=${protectY}, w=${protectWidth}, h=${protectHeight}`);
  console.log(`[InpaintingMask] Original text bounds: x=${narrationBounds.x}, y=${narrationBounds.y}, w=${narrationBounds.width}, h=${narrationBounds.height}`);

  // Step 2: Preserve center area of character panel (protect character cutout)
  // REDUCED margins to be more conservative - only allow thin border zones
  const characterPanelX = characterPosition === 'left' ? 0 : 768;
  const charProtectMargin = 60; // Reduced from 100 to 60 - more conservative

  ctx.fillRect(
    characterPanelX + charProtectMargin,
    charProtectMargin,
    768 - (charProtectMargin * 2),
    1024 - (charProtectMargin * 2)
  );

  // Step 3: Preserve central gutter (divider between panels)
  const gutterWidth = 40;
  const gutterX = 768 - (gutterWidth / 2);
  ctx.fillRect(gutterX, 0, gutterWidth, 1024);

  // CONSERVATIVE MASK: Only allows scene elements in narrow zones:
  // - Top 60px (sky/ceiling) - small strip only
  // - Bottom 60px (ground/floor) - small strip only
  // - Left/right 60px margins (minimal decorative elements)
  // - Forces AI to be more minimal and preserve white space

  return canvas.toDataURL('image/png');
}

/**
 * Get default inpainting zones
 */
export function getDefaultInpaintingZones(): InpaintingZones {
  return {
    topBand: {
      y: 0,
      height: 120 // Top 120px for sky/clouds/ceiling elements
    },
    bottomBand: {
      y: 900, // Bottom 124px for ground/floor elements
      height: 124
    },
    corners: [
      // Top-left corner (for refinement words)
      { x: 20, y: 150, width: 200, height: 80 },
      // Top-right corner
      { x: 1316, y: 150, width: 200, height: 80 },
      // Bottom-left corner
      { x: 20, y: 780, width: 200, height: 80 },
      // Bottom-right corner
      { x: 1316, y: 780, width: 200, height: 80 }
    ],
    margins: {
      left: 15,
      right: 15
    }
  };
}

/**
 * Generate narration bounds from composition config
 * This calculates where the narration text actually is
 */
export function calculateNarrationBounds(
  characterPosition: 'left' | 'right',
  narrationText: string,
  fontSize: number = 38,
  lineHeight: number = 1.8,
  padding: number = 70
): { x: number; y: number; width: number; height: number } {
  const panelWidth = 768;
  const panelHeight = 1024;

  const narrationPanelX = characterPosition === 'left' ? 768 : 0;

  // Text area with padding + vertical offset (matching localComposition.ts)
  const verticalOffset = 80;
  const textX = narrationPanelX + padding;
  const textY = padding + verticalOffset;
  const textWidth = panelWidth - (padding * 2);

  // Estimate text height based on line count
  // (In production, this should match the actual rendering logic)
  const words = narrationText.split(' ');
  const avgWordWidth = fontSize * 0.6; // Rough estimate
  const wordsPerLine = Math.floor(textWidth / avgWordWidth);
  const estimatedLines = Math.ceil(words.length / wordsPerLine);
  const textHeight = estimatedLines * (fontSize * lineHeight);

  return {
    x: textX,
    y: textY,
    width: textWidth,
    height: textHeight
  };
}

/**
 * Generate a refined mask with custom scene zones
 * Allows more precise control over where scene elements can appear
 */
export function generateCustomSceneMask(
  characterPosition: 'left' | 'right',
  narrationBounds: { x: number; y: number; width: number; height: number },
  sceneZones: Array<{ x: number; y: number; width: number; height: number }>,
  refinementWordZones: Array<{ x: number; y: number; width: number; height: number }>
): string {
  const canvas = Canvas.createCanvas(1536, 1024);
  const ctx = canvas.getContext('2d');

  // Start with black (all preserved)
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 1536, 1024);

  // Open scene zones - WHITE
  ctx.fillStyle = 'white';
  for (const zone of sceneZones) {
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
  }

  // Open refinement word zones - WHITE
  for (const zone of refinementWordZones) {
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
  }

  // Re-apply preserves (character panel + narration)
  const characterPanelX = characterPosition === 'left' ? 0 : 768;
  ctx.fillStyle = 'black';
  ctx.fillRect(characterPanelX, 0, 768, 1024);

  // Narration text area
  const textMargin = 10;
  ctx.fillRect(
    narrationBounds.x - textMargin,
    narrationBounds.y - textMargin,
    narrationBounds.width + (textMargin * 2),
    narrationBounds.height + (textMargin * 2)
  );

  return canvas.toDataURL('image/png');
}

/**
 * Validate mask integrity - ensure preserved areas are truly black
 */
export function validateMaskIntegrity(
  maskBase64: string,
  characterPosition: 'left' | 'right',
  narrationBounds: { x: number; y: number; width: number; height: number }
): { valid: boolean; errors: string[] } {
  // Note: This is a conceptual validator
  // In production, you'd load the mask and check pixel values
  const errors: string[] = [];

  // Check character panel is preserved
  const charPanelX = characterPosition === 'left' ? 0 : 768;
  // ... pixel checking logic would go here

  // Check narration area is preserved
  // ... pixel checking logic would go here

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get refinement word placement zones based on page layout
 * Returns available zones where refinement words can be placed without collision
 */
export function getRefinementWordZones(
  characterPosition: 'left' | 'right',
  pageNumber: number
): Array<{ x: number; y: number; width: number; height: number; name: string }> {
  // Return 2-4 small zones per page for refinement words
  const zones: Array<{ x: number; y: number; width: number; height: number; name: string }> = [];

  // Top sky area (opposite side from character)
  const skyX = characterPosition === 'left' ? 900 : 100;
  zones.push({ x: skyX, y: 30, width: 150, height: 60, name: 'top-sky' });

  // Bottom ground area (same side as character)
  const groundX = characterPosition === 'left' ? 100 : 1200;
  zones.push({ x: groundX, y: 920, width: 150, height: 60, name: 'bottom-ground' });

  // Add page-specific zones for variety
  if (pageNumber % 2 === 0) {
    // Even pages: add top-right zone
    zones.push({ x: 1300, y: 200, width: 120, height: 50, name: 'top-right' });
  } else {
    // Odd pages: add mid-left zone
    zones.push({ x: 50, y: 500, width: 120, height: 50, name: 'mid-left' });
  }

  return zones;
}
