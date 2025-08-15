// app/api/generate-image/route.ts
/**
 * Optimized image generation - 1024×1024 for preview, upscale only on export
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Force Node runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
  maxRetries: 2,
});

// Cache for processed plates
const plateCache = new Map<string, string>();

interface GenerateImageRequest {
  bookId: string;
  pageNumber: number;
  babyPhotoUrl?: string;
  pageData: {
    narration: string;
    shot: string;
    action_id: string;
    action_label?: string;
  };
  style: 'wondrous' | 'crayon' | 'vintage';
  size?: 'preview' | 'print'; // Optional size mode
}

const STYLE_TAGS = {
  wondrous: 'Wondrous watercolor style, soft and dreamy',
  crayon: 'Crayon drawing style, hand-drawn texture',
  vintage: 'Vintage illustration style, muted colors'
} as const;

const SHOT_DESCRIPTIONS = {
  wide: 'wide shot showing full environment',
  medium: 'medium shot showing character and surroundings',
  closeup: 'close-up shot focusing on face',
  birdseye: "bird's-eye view from above",
  low: 'low angle shot looking up'
} as const;

/**
 * GET handler - returns 405 Method Not Allowed
 */
export async function GET() {
  return NextResponse.json(
    { 
      error: 'Method Not Allowed',
      message: 'This endpoint only accepts POST requests'
    },
    { 
      status: 405,
      headers: { 
        'Allow': 'POST, DELETE',
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Process baby photo to RGBA PNG
 */
async function getOrCreatePlate(bookId: string, babyPhotoUrl?: string): Promise<string> {
  const cacheKey = `plate-${bookId}`;
  if (plateCache.has(cacheKey)) {
    const cachedPath = plateCache.get(cacheKey)!;
    if (fs.existsSync(cachedPath)) {
      return cachedPath;
    }
  }
  
  const tmpPath = path.join(os.tmpdir(), `us-then-${bookId}-plate.png`);
  if (fs.existsSync(tmpPath)) {
    plateCache.set(cacheKey, tmpPath);
    return tmpPath;
  }
  
  if (!babyPhotoUrl) {
    throw new Error('Baby photo required');
  }
  
  try {
    const sharp = await import('sharp').then(m => m.default);
    const base64Data = babyPhotoUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Resize to reasonable size for processing (max 1024px)
    const pngBuffer = await sharp(buffer)
      .rotate()
      .resize(1024, 1024, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .toColourspace('srgb')
      .ensureAlpha(1)
      .png({ compressionLevel: 9 })
      .toBuffer();
    
    await fs.promises.writeFile(tmpPath, pngBuffer);
    plateCache.set(cacheKey, tmpPath);
    
    console.log(`Created plate for ${bookId} (${pngBuffer.length / 1024}KB)`);
    return tmpPath;
  } catch (error) {
    console.error('PNG conversion error:', error);
    throw new Error('Failed to process image');
  }
}

/**
 * Build prompt for GPT-IMAGE-1
 */
function buildPrompt(
  page: GenerateImageRequest['pageData'],
  style: keyof typeof STYLE_TAGS
): string {
  const shotType = page.shot || 'medium';
  const shotLine = SHOT_DESCRIPTIONS[shotType as keyof typeof SHOT_DESCRIPTIONS] || 'medium shot';
  
  const sceneLine = page.narration
    .replace(/\s*…?and then—\s*$/i, '')
    .replace(/[.!?]+$/, '')
    .trim()
    .toLowerCase();
  
  return [
    shotLine,
    sceneLine,
    page.action_label || page.action_id.replace(/_/g, ' '),
    'children\'s book illustration',
    STYLE_TAGS[style],
    'consistent character',
    'simple background',
    'bright colors'
  ].join(', ');
}

/**
 * Main POST handler
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: GenerateImageRequest = await request.json();
    const { bookId, pageNumber, babyPhotoUrl, pageData, style, size = 'preview' } = body;
    
    console.log(`Generating page ${pageNumber} for book ${bookId}`);
    console.log(`Size mode: ${size}, Style: ${style}, Shot: ${pageData.shot}`);
    
    // Get processed plate
    const platePath = await getOrCreatePlate(bookId, babyPhotoUrl);
    const pngBuffer = await fs.promises.readFile(platePath);
    
    // Create file for OpenAI
    const imageFile = await toFile(
      pngBuffer, 
      'plate.png',
      { type: 'image/png' }
    );
    
    // Build prompt
    const pagePrompt = buildPrompt(pageData, style);
    console.log(`Prompt: ${pagePrompt.substring(0, 100)}...`);
    
    // Call GPT-IMAGE-1
    let response;
    try {
      const params: any = {
        model: 'gpt-image-1',
        image: imageFile,
        prompt: pagePrompt,
        n: 1,
        size: '1024x1024', // Always generate at 1024 for speed
        quality: 'high',
        background: 'transparent',
        output_format: 'png'
      };
      
      response = await openai.images.edit(params);
    } catch (error: any) {
      console.error('OpenAI error:', error);
      throw new Error(error.message || 'Image generation failed');
    }
    
    // Extract image
    let imageBase64: string;
    if (response.data?.[0]?.b64_json) {
      imageBase64 = response.data[0].b64_json;
    } else if (response.data?.[0]?.url) {
      const imgResponse = await fetch(response.data[0].url);
      const buffer = await imgResponse.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString('base64');
    } else {
      throw new Error('No image in response');
    }
    
    // Process with sharp for optimization
    const sharp = await import('sharp').then(m => m.default);
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // For preview: keep at 1024, convert to optimized PNG or WebP
    let finalBuffer: Buffer;
    let mimeType: string;
    
    if (size === 'print') {
      // Only upscale if specifically requested for print
      // Most baby books are 7×7" = 2100×2100px at 300 DPI
      finalBuffer = await sharp(imageBuffer)
        .resize(2100, 2100, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png({ quality: 95 })
        .toBuffer();
      mimeType = 'image/png';
      console.log(`Upscaled to print size: ${finalBuffer.length / 1024}KB`);
    } else {
      // For preview: optimize at 1024
      finalBuffer = await sharp(imageBuffer)
        .png({ 
          quality: 85,
          compressionLevel: 9,
          palette: true // Use palette for smaller size
        })
        .toBuffer();
      mimeType = 'image/png';
      console.log(`Optimized preview: ${finalBuffer.length / 1024}KB`);
    }
    
    // Create data URL (much smaller now!)
    const dataUrl = `data:${mimeType};base64,${finalBuffer.toString('base64')}`;
    
    const elapsedMs = Date.now() - startTime;
    console.log(`Page ${pageNumber} completed in ${elapsedMs}ms`);
    
    return NextResponse.json({ 
      success: true,
      page_number: pageNumber,
      dataUrl, // Smaller data URL
      size: size === 'print' ? '2100x2100' : '1024x1024',
      sizeKB: Math.round(finalBuffer.length / 1024),
      prompt: pagePrompt,
      style,
      shot: pageData.shot,
      action_id: pageData.action_id,
      elapsed_ms: elapsedMs,
      model: 'gpt-image-1'
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      }
    });
    
  } catch (error: any) {
    console.error(`Error generating page:`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to generate image',
        elapsed_ms: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - cleanup temp files
 */
export async function DELETE() {
  try {
    const tmpDir = os.tmpdir();
    const files = await fs.promises.readdir(tmpDir);
    
    let cleaned = 0;
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
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
    
    plateCache.clear();
    
    return NextResponse.json({ 
      success: true, 
      cleaned,
      message: `Cleaned ${cleaned} old files`
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}