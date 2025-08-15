// app/api/generate-image/route.ts
/**
 * Single-page image generation endpoint using OpenAI GPT-IMAGE-1
 * 
 * GPT-IMAGE-1 advantages over DALL-E-2:
 * - Better facial feature consistency (input_fidelity: high)
 * - Supports up to 16 images for better character consistency
 * - Larger file size limit (50MB vs 4MB)
 * - Better quality options (high/medium/low)
 * - Automatic size determination
 * - Transparent background support
 * - Always returns base64 (no URL expiration)
 * 
 * NOTE: The OpenAI SDK TypeScript types don't include GPT-IMAGE-1 parameters yet,
 * so we use 'any' type for the API call parameters to bypass type checking.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Force Node runtime for fs/sharp compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,   // 2 minute SDK timeout
  maxRetries: 2,     // SDK-level retries
});

// PNG conversion cache (in-memory for this worker)
const plateCache = new Map<string, string>();

interface GenerateImageRequest {
  bookId: string;
  pageNumber: number;
  babyPhotoUrl?: string; // Only needed if plate not cached
  additionalPhotos?: string[]; // Optional: more reference photos for better consistency
  pageData: {
    narration: string;
    shot: string;
    action_id: string;
    action_label?: string;
  };
  style: 'wondrous' | 'crayon' | 'vintage';
}

// Style tag mappings (enhanced for GPT-IMAGE-1)
const STYLE_TAGS = {
  wondrous: 'Wondrous Illustration Style (magical, airy watercolor with soft edges and dreamy atmosphere)',
  crayon: 'Crayon Illustration Style (waxy, hand-drawn texture with visible strokes)',
  vintage: 'Vintage Illustration Style (mid-century print aesthetic with muted colors)'
} as const;

// Shot type mappings
const SHOT_DESCRIPTIONS = {
  wide: 'wide shot showing full environment',
  medium: 'medium shot showing character and immediate surroundings',
  closeup: 'close-up shot focusing on face and expressions',
  birdseye: "bird's-eye view from above",
  low: 'low angle shot looking up'
} as const;

/**
 * Get or create RGBA PNG plate for this book
 */
async function getOrCreatePlate(bookId: string, babyPhotoUrl?: string): Promise<string> {
  // Check memory cache first
  const cacheKey = `plate-${bookId}`;
  if (plateCache.has(cacheKey)) {
    const cachedPath = plateCache.get(cacheKey)!;
    if (fs.existsSync(cachedPath)) {
      console.log(`Using cached plate for bookId: ${bookId}`);
      return cachedPath;
    }
  }
  
  // Check temp file
  const tmpPath = path.join(os.tmpdir(), `us-then-${bookId}-plate-rgba.png`);
  if (fs.existsSync(tmpPath)) {
    console.log(`Found existing plate file for bookId: ${bookId}`);
    plateCache.set(cacheKey, tmpPath);
    return tmpPath;
  }
  
  // Need to create new plate
  if (!babyPhotoUrl) {
    throw new Error('Baby photo URL required to create plate');
  }
  
  try {
    const sharp = await import('sharp').then(m => m.default);
    
    // Extract base64 data
    const base64Data = babyPhotoUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Convert to RGBA PNG with alpha channel
    const pngBuffer = await sharp(buffer)
      .rotate() // Respect EXIF orientation
      .toColourspace('srgb')
      .ensureAlpha(1) // ADD ALPHA CHANNEL - CRITICAL!
      .png({ compressionLevel: 9 })
      .toBuffer();
    
    // Verify RGBA (required for both dall-e-2 and gpt-image-1)
    const metadata = await sharp(pngBuffer).metadata();
    console.log('PNG metadata for GPT-IMAGE-1:', {
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: `${(buffer.length / 1024 / 1024).toFixed(2)}MB` // Show size (max 50MB for gpt-image-1)
    });
    
    if (metadata.channels !== 4 || !metadata.hasAlpha) {
      throw new Error('PNG must be RGBA with alpha channel');
    }
    
    // Save to temp file
    await fs.promises.writeFile(tmpPath, pngBuffer);
    
    // Cache the path
    plateCache.set(cacheKey, tmpPath);
    
    console.log(`Created new RGBA PNG plate for bookId ${bookId}`);
    return tmpPath;
  } catch (error) {
    console.error('PNG conversion error:', error);
    throw new Error('Failed to convert image to RGBA PNG format');
  }
}

/**
 * Clean narration text for image generation
 */
function cleanNarrationForImage(narration: string): string {
  return narration
    .replace(/\s*…?and then—\s*$/i, '') // Remove page-turn cue
    .replace(/[.!?]+$/, '') // Remove ending punctuation
    .trim();
}

/**
 * Build prompt for image generation (optimized for GPT-IMAGE-1)
 */
function buildPrompt(
  page: GenerateImageRequest['pageData'],
  style: keyof typeof STYLE_TAGS
): string {
  const shotType = page.shot || 'medium';
  const shotLine = SHOT_DESCRIPTIONS[shotType as keyof typeof SHOT_DESCRIPTIONS] || 'medium shot';
  
  const actionLine = page.action_label || 
    page.action_id.replace(/_/g, ' ').toLowerCase();
  
  const sceneLine = cleanNarrationForImage(page.narration)
    .toLowerCase();
  
  // GPT-IMAGE-1 supports up to 32000 characters, so we can be more descriptive
  const detailedPrompt = [
    shotLine,
    sceneLine,
    actionLine,
    'clean composition',
    'picture-book for ages 0-3',
    STYLE_TAGS[style],
    'maintain consistent character appearance',
    'child-friendly illustration',
    'bright and engaging colors',
    'simple background',
    'professional children\'s book quality'
  ].join(', ');
  
  return detailedPrompt;
}

/**
 * Retry wrapper for transient errors
 */
async function withRetries<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      
      // Check if it's a model availability issue
      if (err?.message?.includes('model') && err?.message?.includes('gpt-image-1')) {
        console.warn('GPT-IMAGE-1 not available, will fallback to DALL-E-2');
        throw err; // Don't retry model errors
      }
      
      const transient = 
        err?.code === 'ECONNRESET' || 
        err?.name === 'APIConnectionError' ||
        err?.message?.includes('ECONNRESET');
      
      if (!transient || i === tries - 1) throw err;
      
      const delay = 500 * Math.pow(2, i); // Exponential backoff
      console.log(`Retry ${i + 1}/${tries} after ${delay}ms due to: ${err.code || err.name}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Main POST handler for single page generation
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let modelUsed = 'unknown'; // Track which model was used
  
  try {
    const body: GenerateImageRequest = await request.json();
    const { bookId, pageNumber, babyPhotoUrl, additionalPhotos, pageData, style } = body;
    
    console.log(`Generating page ${pageNumber} for book ${bookId} using GPT-IMAGE-1`);
    
    // Get or create the RGBA plate
    const platePath = await getOrCreatePlate(bookId, babyPhotoUrl);
    
    // Read PNG file into buffer
    const pngBuffer = await fs.promises.readFile(platePath);
    
    // Create primary image file
    const imageFile = await toFile(
      pngBuffer, 
      'plate.png',
      { type: 'image/png' }
    );
    
    // Prepare images array (GPT-IMAGE-1 can accept multiple images)
    const images = [imageFile];
    
    // Add additional reference photos if provided (up to 16 total)
    if (additionalPhotos && additionalPhotos.length > 0) {
      console.log(`Adding ${additionalPhotos.length} additional reference photos`);
      for (let i = 0; i < Math.min(additionalPhotos.length, 15); i++) {
        try {
          const additionalBase64 = additionalPhotos[i].replace(/^data:image\/\w+;base64,/, '');
          const additionalBuffer = Buffer.from(additionalBase64, 'base64');
          const additionalFile = await toFile(
            additionalBuffer,
            `ref-${i}.png`,
            { type: 'image/png' }
          );
          images.push(additionalFile);
        } catch (err) {
          console.warn(`Failed to add reference photo ${i}:`, err);
        }
      }
    }
    
    // Build the prompt
    const pagePrompt = buildPrompt(pageData, style);
    console.log(`Page ${pageNumber} prompt: ${pagePrompt}`);
    
    let response: any;
    modelUsed = 'gpt-image-1'; // Set default
    
    try {
      // Try GPT-IMAGE-1 first
      response = await withRetries(async () => {
        console.log(`Calling OpenAI GPT-IMAGE-1 for page ${pageNumber}...`);
        
        // TypeScript workaround: The SDK types don't include GPT-IMAGE-1 params yet
        // So we build the params object with proper typing bypass
        const params: any = {
          model: 'gpt-image-1',  // Using the better model!
          image: images.length === 1 ? images[0] : images, // Single or multiple images
          prompt: pagePrompt,
          n: 1,
          // GPT-IMAGE-1 specific parameters (not in TypeScript types yet)
          input_fidelity: 'high', // Better face matching!
          quality: 'high',        // High quality output
          size: 'auto',           // Let model choose best size
          background: 'transparent', // Keep transparency
          output_format: 'png'    // PNG format
        };
        
        return openai.images.edit(params);
      });
    } catch (gptError: any) {
      // Fallback to DALL-E-2 if GPT-IMAGE-1 fails
      console.warn('GPT-IMAGE-1 failed, falling back to DALL-E-2:', gptError.message);
      modelUsed = 'dall-e-2';
      
      response = await withRetries(async () => {
        console.log(`Calling OpenAI DALL-E-2 for page ${pageNumber}...`);
        
        // DALL-E-2 requires shorter prompt (max 1000 chars)
        const shortPrompt = pagePrompt.substring(0, 1000);
        
        return openai.images.edit({
          model: 'dall-e-2',
          image: images[0], // DALL-E-2 only supports one image
          prompt: shortPrompt,
          n: 1,
          size: '1024x1024',
          response_format: 'url'
        });
      });
    }
    
    // Check response based on model
    // GPT-IMAGE-1 always returns base64, DALL-E-2 can return URL or base64
    let imageBase64: string;
    
    if (response.data && response.data.length > 0) {
      const imageData = response.data[0];
      
      // Handle both b64_json and url formats
      if ('b64_json' in imageData && imageData.b64_json) {
        imageBase64 = imageData.b64_json;
      } else if ('url' in imageData && imageData.url) {
        // Fallback for URL response (shouldn't happen with GPT-IMAGE-1)
        console.log('Unexpected URL response from GPT-IMAGE-1, fetching image...');
        const imageResponse = await fetch(imageData.url);
        const buffer = await imageResponse.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString('base64');
      } else {
        throw new Error('No image data in response');
      }
    } else {
      throw new Error('Empty response from OpenAI');
    }
    
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    console.log(`OpenAI ${modelUsed} generation successful for page ${pageNumber}`);
    
    // Upscale the image
    let finalImage: string;
    
    try {
      const sharp = await import('sharp').then(m => m.default);
      if (sharp) {
        // Upscale to print resolution
        const upscaledBuffer = await sharp(imageBuffer)
          .resize(3600, 2400, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .ensureAlpha(1) // Keep alpha channel
          .png()
          .toBuffer();
        
        finalImage = `data:image/png;base64,${upscaledBuffer.toString('base64')}`;
        console.log(`Page ${pageNumber} upscaled to print resolution`);
      } else {
        finalImage = `data:image/png;base64,${imageBase64}`;
      }
    } catch (upscaleError) {
      console.warn('Upscaling failed, using original:', upscaleError);
      finalImage = `data:image/png;base64,${imageBase64}`;
    }
    
    const elapsedMs = Date.now() - startTime;
    console.log(`Page ${pageNumber} completed in ${elapsedMs}ms`);
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      page_number: pageNumber,
      url: finalImage,
      prompt: pagePrompt,
      style: style,
      shot: pageData.shot,
      action_id: pageData.action_id,
      elapsed_ms: elapsedMs,
      model: modelUsed, // Shows which model was actually used
      settings: modelUsed === 'gpt-image-1' ? {
        input_fidelity: 'high',
        quality: 'high',
        background: 'transparent'
      } : {
        size: '1024x1024',
        response_format: 'url'
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
  } catch (error: any) {
    console.error(`Error generating page:`, error);
    
    const elapsedMs = Date.now() - startTime;
    
    // Provide helpful error messages for common issues
    let errorMessage = error.message || 'Failed to generate image';
    
    if (error.message?.includes('format must be in')) {
      errorMessage = 'Image must be PNG format with alpha channel (RGBA)';
    } else if (error.message?.includes('50MB')) {
      errorMessage = 'Image file too large (max 50MB for gpt-image-1)';
    } else if (error.message?.includes('model')) {
      errorMessage = 'Model error - ensure gpt-image-1 is available';
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        elapsed_ms: elapsedMs,
        model: modelUsed || 'attempted: gpt-image-1',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    );
  }
}

/**
 * Cleanup endpoint for temp files
 */
export async function DELETE(request: NextRequest) {
  try {
    const tmpDir = os.tmpdir();
    const files = await fs.promises.readdir(tmpDir);
    
    // Clean up old us-then PNG files (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleaned = 0;
    
    for (const file of files) {
      if (file.startsWith('us-then-') && file.endsWith('.png')) {
        const filePath = path.join(tmpDir, file);
        try {
          const stats = await fs.promises.stat(filePath);
          if (stats.mtimeMs < oneHourAgo) {
            await fs.promises.unlink(filePath);
            cleaned++;
          }
        } catch (error) {
          console.error(`Failed to clean ${file}:`, error);
        }
      }
    }
    
    // Clear cache
    plateCache.clear();
    
    return NextResponse.json({ 
      success: true, 
      cleaned,
      message: `Cleaned ${cleaned} old temporary files`
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}