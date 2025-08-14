// app/api/generate-images/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads'; // Import toFile helper
import fs from 'fs';
import path from 'path';
import os from 'os';

// Force Node runtime for fs/sharp compatibility
export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Feature flag for Replicate (keep for fallback)
const USE_REPLICATE = process.env.USE_REPLICATE === 'true';

// Style tag mappings
const STYLE_TAGS = {
  wondrous: 'Wondrous Illustration Style (magical, airy watercolor)',
  crayon: 'Crayon Illustration Style (waxy, hand-drawn)',
  vintage: 'Vintage Illustration Style (mid-century print)'
} as const;

// Shot type mappings
const SHOT_DESCRIPTIONS = {
  wide: 'wide shot',
  medium: 'medium shot',
  closeup: 'close-up',
  birdseye: "bird's-eye view",
  low: 'low angle'
} as const;

interface GenerateImagesRequest {
  babyPhotoUrl: string;
  storyPages: Array<{
    page_number: number;
    narration: string;
    shot: string;
    shot_custom?: string;
    closest_shot?: string;
    action_id: string;
    action_label?: string;
    scene_type: string;
  }>;
  style: 'wondrous' | 'crayon' | 'vintage';
  bookId: string;
}

// PNG conversion cache to avoid reconverting for each page
const pngCache = new Map<string, string>();

/**
 * Convert base64 image to RGBA PNG temp file
 * Ensures alpha channel for OpenAI Images Edits compatibility
 */
async function ensurePngTempFileFromBase64(
  base64: string, 
  bookId: string
): Promise<string> {
  // Check cache first
  const cacheKey = `png-${bookId}`;
  if (pngCache.has(cacheKey)) {
    const cachedPath = pngCache.get(cacheKey)!;
    // Verify file still exists
    if (fs.existsSync(cachedPath)) {
      console.log(`Using cached RGBA PNG for bookId: ${bookId}`);
      return cachedPath;
    }
  }

  try {
    // Import sharp dynamically
    const sharp = await import('sharp').then(m => m.default).catch(() => null);
    
    if (!sharp) {
      throw new Error('Sharp is required for PNG conversion. Please install: npm install sharp');
    }

    // Extract base64 data
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Convert to RGBA PNG with alpha channel
    const pngBuffer = await sharp(buffer)
      .rotate() // Respect EXIF orientation
      .toColourspace('srgb') // Keep sRGB color space
      .ensureAlpha(1) // ADD ALPHA CHANNEL (fully opaque) - CRITICAL!
      .png({ compressionLevel: 9 }) // PNG output
      .toBuffer();
    
    // Verify the PNG has alpha channel (RGBA = 4 channels)
    const metadata = await sharp(pngBuffer).metadata();
    console.log('PNG metadata:', {
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    });
    
    if (metadata.channels !== 4 || metadata.hasAlpha !== true) {
      throw new Error(
        `PNG must be RGBA with alpha channel. Got channels=${metadata.channels}, hasAlpha=${metadata.hasAlpha}`
      );
    }
    
    // Save to temp file
    const tmpPath = path.join(os.tmpdir(), `us-then-${bookId}-plate-rgba.png`);
    await fs.promises.writeFile(tmpPath, pngBuffer);
    
    // Cache the path
    pngCache.set(cacheKey, tmpPath);
    
    console.log(`Created RGBA PNG temp file for bookId ${bookId}: ${tmpPath}`);
    return tmpPath;
  } catch (error) {
    console.error('PNG conversion error:', error);
    throw new Error('Failed to convert image to RGBA PNG format');
  }
}

/**
 * Clean narration text for image generation
 * Removes page-turn cues and other text artifacts
 */
function cleanNarrationForImage(narration: string): string {
  return narration
    .replace(/\s*…?and then—\s*$/i, '') // Remove page-turn cue
    .replace(/[.!?]+$/, '') // Remove ending punctuation
    .trim();
}

/**
 * Build prompt for image generation
 */
function buildPrompt(
  page: any,
  style: keyof typeof STYLE_TAGS
): string {
  // Get the canonical shot type
  const shotType = page.closest_shot || page.shot || 'medium';
  const shotLine = SHOT_DESCRIPTIONS[shotType as keyof typeof SHOT_DESCRIPTIONS] || 'medium shot';
  
  // Convert action_id to readable action line
  const actionLine = page.action_label || 
    page.action_id.replace(/_/g, ' ').toLowerCase();
  
  // Clean and extract scene description from narration
  const sceneLine = cleanNarrationForImage(page.narration)
    .slice(0, 50)
    .toLowerCase();
  
  // Build the prompt
  return `${shotLine}, ${sceneLine}, ${actionLine}, clean composition, picture-book ages 0-3, ${STYLE_TAGS[style]}`;
}

/**
 * Retry wrapper for transient network errors
 */
async function withRetries<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
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
 * Generate image using OpenAI Images API
 */
async function generateWithOpenAI(
  pngPath: string,
  pagePrompt: string  // Renamed from 'prompt' to 'pagePrompt' for clarity
) {
  try {
    // Read PNG file into buffer
    const pngBuffer = await fs.promises.readFile(pngPath);
    
    // Verify PNG magic header
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (!pngBuffer.subarray(0, 8).equals(pngHeader)) {
      throw new Error('PNG header check failed - file may be corrupted');
    }
    
    // Double-check metadata before sending to OpenAI
    const sharp = await import('sharp').then(m => m.default).catch(() => null);
    if (sharp) {
      const meta = await sharp(pngBuffer).metadata();
      console.log('Final PNG check before OpenAI:', {
        channels: meta.channels,
        hasAlpha: meta.hasAlpha,
        format: meta.format,
        space: meta.space
      });
      
      // Ensure it's RGBA
      if (meta.channels !== 4 || !meta.hasAlpha) {
        console.warn('PNG missing alpha channel, attempting to fix...');
        // Try to add alpha if missing
        const fixedBuffer = await sharp(pngBuffer)
          .ensureAlpha(1)
          .png()
          .toBuffer();
        // Update the buffer
        await fs.promises.writeFile(pngPath, fixedBuffer);
        
        // Use fixed buffer with retry logic
        const imageFile = await toFile(
          fixedBuffer,
          'plate.png',
          { type: 'image/png' }
        );
        console.log('Fixed PNG with alpha channel');
        
        const response = await withRetries(() => 
          openai.images.edit({
            image: imageFile,
            prompt: pagePrompt,  // Using pagePrompt variable
            model: 'dall-e-2',
            n: 1,
            size: '1024x1024',
            response_format: 'url'
          })
        );
        
        if (!response.data || response.data.length === 0 || !response.data[0].url) {
          throw new Error('No image URL in response');
        }
        
        return await processOpenAIResponse(response.data[0].url, pagePrompt);
      }
    }
    
    // Wrap buffer with explicit MIME type using toFile
    const imageFile = await toFile(
      pngBuffer, 
      path.basename(pngPath) || 'plate.png',
      { type: 'image/png' }
    );
    
    console.log('Calling OpenAI images.edit with RGBA PNG File object...');
    
    // Call OpenAI with retry logic for network errors
    const response = await withRetries(() => 
      openai.images.edit({
        image: imageFile, // Now a File with correct MIME type and RGBA format
        prompt: pagePrompt,  // Using pagePrompt variable
        model: 'dall-e-2',
        n: 1,
        size: '1024x1024',
        response_format: 'url'
      })
    );
    
    if (!response.data || response.data.length === 0 || !response.data[0].url) {
      throw new Error('No image URL in response');
    }
    
    console.log('OpenAI generation successful');
    
    return await processOpenAIResponse(response.data[0].url, pagePrompt);
    
  } catch (error: any) {
    console.error('OpenAI generation error:', error);
    if (error.message?.includes('format must be in')) {
      throw new Error('PNG must have alpha channel (RGBA format). Please check image conversion.');
    }
    if (error.message?.includes('unsupported mimetype')) {
      throw new Error('Image must be PNG format with proper MIME type.');
    }
    if (error.message?.includes('application/octet-stream')) {
      throw new Error('Image MIME type issue - file was sent as octet-stream instead of image/png');
    }
    throw error;
  }
}

/**
 * Process OpenAI response and optionally upscale
 */
async function processOpenAIResponse(imageUrl: string, pagePrompt: string) {
  // Fetch the generated image
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  
  // Try to upscale if sharp is available
  let finalImage: string;
  
  try {
    const sharp = await import('sharp').then(m => m.default).catch(() => null);
    if (sharp) {
      // Upscale while preserving alpha channel
      const upscaledBuffer = await sharp(imageBuffer)
        .resize(3600, 2400, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        })
        .ensureAlpha(1) // Keep alpha channel in upscaled version
        .png()
        .toBuffer();
      
      finalImage = `data:image/png;base64,${upscaledBuffer.toString('base64')}`;
      console.log('Image upscaled to print resolution with alpha preserved');
    } else {
      finalImage = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      console.log('Returning original size (sharp not available)');
    }
  } catch (error) {
    console.warn('Upscaling failed, using original size:', error);
    finalImage = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  }
  
  return {
    url: finalImage,
    debugPrompt: pagePrompt  // Return the actual prompt used
  };
}

/**
 * Generate with Replicate (fallback)
 */
async function generateWithReplicate(
  pagePrompt: string,  // Renamed for consistency
  seed: number
) {
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  
  if (!REPLICATE_API_TOKEN) {
    throw new Error('Replicate API token not configured');
  }
  
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: '8e3e22eea3e5bf685dd0190fa9f7f8e35c3a9eb551c787d217149db768204e58',
      input: {
        prompt: pagePrompt,  // Using consistent variable name
        num_outputs: 1,
        aspect_ratio: '3:2',
        output_format: 'webp',
        output_quality: 95,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        seed: seed
      }
    })
  });
  
  const prediction = await response.json();
  
  // Poll for completion
  let result = prediction;
  let attempts = 0;
  const maxAttempts = 60;
  
  while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      {
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        }
      }
    );
    
    result = await statusResponse.json();
    attempts++;
  }
  
  if (result.status === 'succeeded' && result.output) {
    const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    return {
      url: outputUrl,
      debugPrompt: pagePrompt  // Return the actual prompt used
    };
  }
  
  throw new Error('Replicate generation failed');
}

/**
 * Main POST handler
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateImagesRequest = await request.json();
    const { 
      babyPhotoUrl, 
      storyPages, 
      style, 
      bookId 
    } = body;
    
    console.log('Starting image generation with:', {
      style,
      pageCount: storyPages.length,
      bookId,
      useReplicate: USE_REPLICATE
    });
    
    const results = [];
    const baseSeed = Math.floor(Math.random() * 1000000);
    
    // Convert baby photo to PNG once for all pages (if using OpenAI)
    let pngPath: string | null = null;
    
    if (!USE_REPLICATE && babyPhotoUrl) {
      try {
        pngPath = await ensurePngTempFileFromBase64(babyPhotoUrl, bookId);
        console.log('PNG conversion successful');
      } catch (error) {
        console.error('PNG conversion failed:', error);
        throw new Error('Failed to prepare image for AI generation. Please ensure sharp is installed.');
      }
    }
    
    // Generate images for each page
    for (let i = 0; i < storyPages.length; i++) {
      const page = storyPages[i];
      const pageSeed = baseSeed + i;
      
      try {
        let result;
        let pagePrompt: string;
        
        if (USE_REPLICATE) {
          // Fallback to Replicate
          pagePrompt = buildPrompt(page, style);
          console.log(`Generating page ${i + 1} with Replicate prompt:`, pagePrompt);
          result = await generateWithReplicate(pagePrompt, pageSeed);
        } else {
          // Use OpenAI Images API
          if (!pngPath) {
            throw new Error('PNG conversion required for OpenAI generation');
          }
          
          pagePrompt = buildPrompt(page, style);
          console.log(`Generating page ${i + 1} with OpenAI prompt:`, pagePrompt);
          
          result = await generateWithOpenAI(pngPath, pagePrompt);
        }
        
        results.push({
          page_number: page.page_number,
          url: result.url,
          seed: pageSeed,
          style: style,
          prompt: result.debugPrompt || pagePrompt,  // Use pagePrompt as fallback
          shot: page.shot,
          action_id: page.action_id
        });
        
        console.log(`Successfully generated image for page ${i + 1}`, {
          prompt: pagePrompt,  // Log with correct variable name
          page_number: page.page_number
        });
      } catch (error) {
        console.error(`Error generating image for page ${i + 1}:`, error);
        
        // Fallback to placeholder
        results.push({
          page_number: page.page_number,
          url: `https://via.placeholder.com/3600x2400/E9D5FF/4C1D95?text=Page+${page.page_number}`,
          error: true,
          shot: page.shot,
          action_id: page.action_id
        });
      }
    }
    
    // Cleanup temp PNG file after all pages are done (optional)
    // We keep it cached for potential regeneration requests
    
    // Count successful generations
    const successCount = results.filter(r => !r.error).length;
    
    if (successCount > 0) {
      console.log(`Generation complete: ${successCount} of ${results.length} images generated successfully`);
    } else {
      console.log('Generation failed: No images were successfully generated');
    }
    
    return NextResponse.json({ 
      success: successCount > 0, 
      illustrations: results,
      method: USE_REPLICATE ? 'replicate' : 'openai',
      stats: {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount
      }
    });
    
  } catch (error: any) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to generate images',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Cleanup function for removing old temp files (optional)
export async function DELETE(request: NextRequest) {
  try {
    const tmpDir = os.tmpdir();
    const files = await fs.promises.readdir(tmpDir);
    
    // Clean up old us-then PNG files
    const oldFiles = files.filter(f => f.startsWith('us-then-') && f.endsWith('.png'));
    
    for (const file of oldFiles) {
      try {
        await fs.promises.unlink(path.join(tmpDir, file));
      } catch (error) {
        console.error(`Failed to delete temp file ${file}:`, error);
      }
    }
    
    // Clear cache
    pngCache.clear();
    
    return NextResponse.json({ 
      success: true, 
      cleaned: oldFiles.length 
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}