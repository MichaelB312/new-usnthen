import Replicate from 'replicate';

/**
 * Upscale an image using Real-ESRGAN via Replicate API
 *
 * @param imageBase64 - Base64 encoded image (without data URI prefix)
 * @param scale - Upscaling factor (2 or 4)
 * @returns Base64 encoded upscaled image (without data URI prefix)
 */
export async function upscaleImage(
  imageBase64: string,
  scale: 2 | 4 = 2
): Promise<string> {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  console.log(`[Upscaler] Starting ${scale}x upscale with Real-ESRGAN`);

  // Real-ESRGAN expects a data URI or URL
  const dataUri = `data:image/png;base64,${imageBase64}`;

  try {
    const output = await replicate.run(
      "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
      {
        input: {
          image: dataUri,
          scale: scale,
          face_enhance: false // Keep false to preserve children's book illustration style
        }
      }
    ) as unknown as string;

    console.log(`[Upscaler] Upscaling complete, fetching result`);

    // Replicate returns a URL to the upscaled image
    const response = await fetch(output);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const resultBase64 = buffer.toString('base64');
    console.log(`[Upscaler] Successfully upscaled to ${scale}x resolution`);

    return resultBase64;
  } catch (error) {
    console.error('[Upscaler] Error during upscaling:', error);
    throw new Error(`Failed to upscale image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Add bleed borders to an image for print production
 *
 * At 300 DPI:
 * - 3mm = ~35 pixels
 * - Adds white borders on all sides
 *
 * @param imageBase64 - Base64 encoded image (without data URI prefix)
 * @param bleedMM - Bleed size in millimeters (default 3mm)
 * @returns Base64 encoded image with bleed borders (without data URI prefix)
 */
export async function addBleed(
  imageBase64: string,
  bleedMM: number = 3
): Promise<string> {
  const Canvas = require('canvas');
  const { loadImage } = Canvas;

  // Calculate bleed in pixels at 300 DPI
  // 1 inch = 25.4mm, 300 DPI means 300 pixels per inch
  const bleedPx = Math.round((bleedMM / 25.4) * 300);

  console.log(`[Bleed] Adding ${bleedMM}mm (${bleedPx}px) bleed on all sides`);

  try {
    const img = await loadImage(`data:image/png;base64,${imageBase64}`);

    const newWidth = img.width + (bleedPx * 2);
    const newHeight = img.height + (bleedPx * 2);

    const canvas = Canvas.createCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');

    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, newWidth, newHeight);

    // Draw original image centered (with bleed margins)
    ctx.drawImage(img, bleedPx, bleedPx);

    console.log(`[Bleed] Final dimensions: ${newWidth}×${newHeight}px`);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  } catch (error) {
    console.error('[Bleed] Error adding bleed:', error);
    throw new Error(`Failed to add bleed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Complete print-ready processing pipeline
 *
 * 1. Upscale image 2× (1536×1024 → 3072×2048)
 * 2. Add 3mm bleed borders (3072×2048 → 3307×2283)
 *
 * @param imageBase64 - Base64 encoded image (without data URI prefix)
 * @param includeBleed - Whether to add bleed borders (default true)
 * @returns Base64 encoded print-ready image (without data URI prefix)
 */
export async function processPrintReady(
  imageBase64: string,
  includeBleed: boolean = true
): Promise<string> {
  console.log('[Print Processing] Starting print-ready pipeline');

  // Step 1: Upscale 2×
  const upscaledBase64 = await upscaleImage(imageBase64, 2);

  // Step 2: Add bleed if requested
  if (includeBleed) {
    const withBleedBase64 = await addBleed(upscaledBase64, 3);
    console.log('[Print Processing] Print-ready processing complete (with bleed)');
    return withBleedBase64;
  }

  console.log('[Print Processing] Print-ready processing complete (no bleed)');
  return upscaledBase64;
}
