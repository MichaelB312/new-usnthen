// lib/utils/maskGenerator.ts
/**
 * Generate a mask image for text inpainting
 * Mask is a grayscale image where white areas will be edited
 */

/**
 * Create a PNG mask image for the text area
 * @param x - X coordinate of text box
 * @param y - Y coordinate of text box
 * @param width - Width of text box
 * @param height - Height of text box
 * @returns Base64 encoded PNG mask image
 */
export async function generateTextMask(
  x: number,
  y: number,
  width: number,
  height: number
): Promise<string> {
  // Create a canvas for the mask (1536×1024)
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  // Fill entire canvas with black (areas NOT to edit)
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 1536, 1024);

  // Draw white rectangle where text should be (area TO edit)
  ctx.fillStyle = 'white';
  ctx.fillRect(x, y, width, height);

  // Convert canvas to base64 PNG
  return canvas.toDataURL('image/png');
}

/**
 * Server-side mask generation using node canvas (for API routes)
 */
export function generateTextMaskServer(
  x: number,
  y: number,
  width: number,
  height: number
): string {
  // For server-side, we'll generate a simple base64 PNG programmatically
  // This creates a minimal PNG with the mask pattern

  // For now, return a data URL that we can construct
  // In production, you'd use a library like 'canvas' or 'sharp'

  // Simple approach: Create a Buffer with PNG data
  const Canvas = require('canvas');
  const canvas = Canvas.createCanvas(1536, 1024);
  const ctx = canvas.getContext('2d');

  // Fill entire canvas with black
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 1536, 1024);

  // Draw white rectangle for text area
  ctx.fillStyle = 'white';
  ctx.fillRect(x, y, width, height);

  // Convert to base64
  return canvas.toDataURL('image/png');
}
