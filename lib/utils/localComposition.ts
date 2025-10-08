// lib/utils/localComposition.ts
/**
 * Layer 2 - Local Composition Engine
 * Composes character cutout + narration text into 1536×1024 spread
 * NO AI - pure local rendering with fixed typography rules
 */

const Canvas = require('canvas');

export interface CompositionConfig {
  characterImageBase64: string; // 1024×1024 transparent character
  narration: string;
  characterPosition: 'left' | 'right'; // Which panel for character
}

export interface TypographyRules {
  fontSize: number; // 38px
  lineHeight: number; // 1.8
  padding: number; // 70px (increased for more breathing room)
  fontFamily: string; // Patrick Hand (handwritten)
  color: string; // black
}

const DEFAULT_TYPOGRAPHY: TypographyRules = {
  fontSize: 38,
  lineHeight: 1.8,
  padding: 70, // Increased for more breathing room
  fontFamily: 'Patrick Hand, cursive',
  color: '#000000'
};

export interface CompositionResult {
  imageDataUrl: string;
  actualTextBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Compose character + narration into 1536×1024 spread
 * Returns both the image and the ACTUAL text bounds (not estimated)
 */
export async function composeSpread(config: CompositionConfig): Promise<CompositionResult> {
  const canvas = Canvas.createCanvas(1536, 1024);
  const ctx = canvas.getContext('2d');

  // Fill with white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 1536, 1024);

  // Panel dimensions: 768×1024 each
  const panelWidth = 768;
  const panelHeight = 1024;

  // Determine panels
  const characterPanel = config.characterPosition === 'left' ? 'left' : 'right';
  const narrationPanel = characterPanel === 'left' ? 'right' : 'left';

  // Character panel coordinates
  const charX = characterPanel === 'left' ? 0 : 768;
  const charY = 0;

  // Narration panel coordinates
  const narX = narrationPanel === 'left' ? 0 : 768;
  const narY = 0;

  // Step 1: Draw character (scaled to fit 768×1024 panel while maintaining aspect)
  const characterImage = await loadImageFromBase64(config.characterImageBase64);

  // Calculate scaling to fit character in panel
  // Character is 1024×1024, panel is 768×1024
  const scale = Math.min(panelWidth / characterImage.width, panelHeight / characterImage.height);
  const scaledWidth = characterImage.width * scale;
  const scaledHeight = characterImage.height * scale;

  // Center character in its panel
  const charDrawX = charX + (panelWidth - scaledWidth) / 2;
  const charDrawY = charY + (panelHeight - scaledHeight) / 2;

  ctx.drawImage(characterImage, charDrawX, charDrawY, scaledWidth, scaledHeight);

  // Step 2: Render narration text in opposite panel and capture actual bounds
  const textBounds = await renderNarrationText(
    ctx,
    config.narration,
    narX,
    narY,
    panelWidth,
    panelHeight,
    DEFAULT_TYPOGRAPHY
  );

  // Return image AND actual text bounds
  return {
    imageDataUrl: canvas.toDataURL('image/png'),
    actualTextBounds: textBounds
  };
}

/**
 * Render narration text with word wrapping and typography rules
 * Returns the ACTUAL bounds of the rendered text
 */
async function renderNarrationText(
  ctx: any,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  typography: TypographyRules
): Promise<{ x: number; y: number; width: number; height: number }> {
  console.log(`[LocalComposition] Rendering text: "${text.substring(0, 50)}..." at position (${x}, ${y})`);

  if (!text || text.trim().length === 0) {
    console.warn('[LocalComposition] WARNING: Empty or whitespace-only text!');
    // Return minimal bounds at expected position
    const verticalOffset = 80;
    const padding = typography.padding;
    return {
      x: x + padding,
      y: y + padding + verticalOffset,
      width: width - (padding * 2),
      height: 0
    };
  }

  const { fontSize, lineHeight, padding, fontFamily, color } = typography;

  // Set font (Note: Patrick Hand needs to be available on server)
  // For now, fall back to system font if Patrick Hand not available
  ctx.font = `${fontSize}px "${fontFamily}", cursive, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  // Calculate available text area (with padding + vertical offset)
  const verticalOffset = 80; // Additional offset to move text down from top
  const textX = x + padding;
  const textY = y + padding + verticalOffset;
  const textWidth = width - (padding * 2);
  const textHeight = height - (padding * 2) - verticalOffset;

  console.log(`[LocalComposition] Text area: x=${textX}, y=${textY}, width=${textWidth}, height=${textHeight}`);

  // Word wrap the text
  const lines = wrapText(ctx, text, textWidth);

  console.log(`[LocalComposition] Wrapped into ${lines.length} lines`);

  // Calculate line spacing
  const lineSpacing = fontSize * lineHeight;

  // Draw each line and track actual height used
  let currentY = textY;
  let lastLineY = textY;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if we're exceeding available height
    if (currentY + fontSize > textY + textHeight) {
      console.warn(`[LocalComposition] Text overflow: line ${i + 1} exceeds available height`);
      break;
    }

    console.log(`[LocalComposition] Drawing line ${i + 1}: "${line}" at y=${currentY}`);
    ctx.fillText(line, textX, currentY);
    lastLineY = currentY;
    currentY += lineSpacing;
  }

  // Calculate actual text bounds
  const actualHeight = (lastLineY - textY) + fontSize; // Last line Y position + font size

  console.log(`[LocalComposition] Text rendering complete! Actual bounds: x=${textX}, y=${textY}, width=${textWidth}, height=${actualHeight}`);

  return {
    x: textX,
    y: textY,
    width: textWidth,
    height: actualHeight
  };
}

/**
 * Word wrap text to fit within specified width
 */
function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && currentLine) {
      // Line is too long, push current line and start new one
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  // Push the last line
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Load image from base64 string
 */
async function loadImageFromBase64(base64: string): Promise<any> {
  const { loadImage } = Canvas;

  // Handle both data URLs and raw base64
  const imageData = base64.startsWith('data:')
    ? base64
    : `data:image/png;base64,${base64}`;

  return await loadImage(imageData);
}

/**
 * Get character position from page metadata
 * Uses existing spread_metadata or defaults based on page number
 */
export function getCharacterPosition(pageNumber: number, pageData?: any): 'left' | 'right' {
  // Check if spread metadata specifies position
  if (pageData?.spread_metadata?.char_anchor_hint) {
    const hint = pageData.spread_metadata.char_anchor_hint;
    if (hint === 'left' || hint === 'right') {
      return hint;
    }
  }

  // Alternate by page number for visual variety
  return pageNumber % 2 === 0 ? 'left' : 'right';
}

/**
 * Extract refinement word from spread metadata
 */
export function getRefinementWord(pageData?: any): string | null {
  return pageData?.spread_metadata?.refinement_word || null;
}

/**
 * Get composition bounds for debugging/validation
 */
export interface CompositionBounds {
  characterPanel: { x: number; y: number; width: number; height: number };
  narrationPanel: { x: number; y: number; width: number; height: number };
}

export function getCompositionBounds(characterPosition: 'left' | 'right'): CompositionBounds {
  const panelWidth = 768;
  const panelHeight = 1024;

  const characterPanel = characterPosition === 'left'
    ? { x: 0, y: 0, width: panelWidth, height: panelHeight }
    : { x: 768, y: 0, width: panelWidth, height: panelHeight };

  const narrationPanel = characterPosition === 'left'
    ? { x: 768, y: 0, width: panelWidth, height: panelHeight }
    : { x: 0, y: 0, width: panelWidth, height: panelHeight };

  return { characterPanel, narrationPanel };
}
