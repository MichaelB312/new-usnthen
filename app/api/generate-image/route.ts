// app/api/generate-image/route.ts
/**
 * Enhanced image generation with camera-first prompting
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
    camera_angle?: string;
    camera_angle_description?: string;
    action_id: string;
    action_label?: string;
    visual_focus?: string;
    visual_action?: string;
    detail_prompt?: string;
    sensory_details?: string;
    pose_description?: string;
  };
  style: 'wondrous' | 'crayon' | 'vintage';
  size?: 'preview' | 'print';
}

// Camera angle descriptions for prompts - MUST BE FIRST IN PROMPT
const CAMERA_PROMPT_STARTERS = {
  // Ultra close shots
  extreme_closeup: 'extreme close-up',
  closeup: 'close-up',
  macro: 'macro shot',
  detail_shot: 'detail shot',
  medium_closeup: 'medium close-up',
  
  // Standard shots
  medium: 'medium shot',
  medium_wide: 'medium wide shot',
  wide: 'wide shot',
  
  // POV shots
  pov_baby: 'POV shot from baby perspective looking at own',
  pov_parent: 'POV shot from parent perspective looking down',
  pov_toy: 'POV from toy perspective',
  
  // Dynamic angles
  birds_eye: "bird's-eye view",
  low_angle: 'low angle shot',
  high_angle: 'high angle shot',
  worms_eye: "worm's eye view",
  over_shoulder: 'over-the-shoulder shot',
  dutch_angle: 'dutch angle tilted shot',
  profile: 'profile shot from side',
  three_quarter: 'three-quarter angle'
} as const;

const STYLE_DESCRIPTIONS = {
  wondrous: 'Wondrous Illustration Style (magical, airy watercolor)',
  crayon: 'Crayon Style (hand-drawn texture, waxy appearance)',
  vintage: 'Vintage Style (muted colors, mid-century aesthetic)'
} as const;

/**
 * Build prompt with camera angle FIRST (like the working examples)
 */
function buildCameraFirstPrompt(
  page: GenerateImageRequest['pageData'],
  style: keyof typeof STYLE_DESCRIPTIONS
): string {
  const parts: string[] = [];
  
  // 1. CAMERA ANGLE FIRST (most important!)
  const cameraAngle = page.camera_angle || 'medium';
  const cameraStart = CAMERA_PROMPT_STARTERS[cameraAngle as keyof typeof CAMERA_PROMPT_STARTERS] || 'medium shot';
  parts.push(cameraStart);
  
  // 2. Add specific visual focus based on camera type
  if (cameraAngle === 'extreme_closeup' || cameraAngle === 'macro') {
    // For close shots, be very specific about what we're zooming on
    if (page.visual_focus === 'hands') {
      parts.push('of tiny hands');
    } else if (page.visual_focus === 'feet') {
      parts.push('of baby feet');
    } else if (page.visual_focus === 'face') {
      parts.push('of baby face');
    }
    
    // Add the specific action
    if (page.visual_action) {
      if (page.visual_action.includes('sand_falling')) {
        parts.push('scooping sand and letting it fall in a soft sparkling arc');
      } else if (page.visual_action.includes('grabbing')) {
        parts.push('grabbing and exploring texture');
      } else {
        parts.push(page.visual_action.replace(/_/g, ' '));
      }
    }
  } else if (cameraAngle === 'pov_baby') {
    // POV shots need specific description
    if (page.visual_focus === 'feet') {
      parts.push('feet in sand');
    } else if (page.visual_focus === 'hands') {
      parts.push('hands playing');
    }
  } else if (cameraAngle === 'birds_eye') {
    // Bird's eye needs scene description
    parts.push('baby on beach blanket');
    if (page.visual_action) {
      parts.push(page.visual_action.replace(/_/g, ' '));
    }
  } else {
    // For other shots, add the action
    if (page.visual_action) {
      parts.push('baby ' + page.visual_action.replace(/_/g, ' '));
    }
  }
  
  // 3. Add environment/context if it's a wider shot
  if (['wide', 'birds_eye', 'medium'].includes(cameraAngle)) {
    if (page.sensory_details) {
      parts.push(page.sensory_details);
    } else {
      parts.push('simple clean background');
    }
  }
  
  // 4. Always end with style and format
  parts.push('picture-book ages 0-3');
  parts.push(STYLE_DESCRIPTIONS[style]);
  
  // Join with commas for clean prompt
  return parts.join(', ');
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
 * Main POST handler with camera-first prompting
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: GenerateImageRequest = await request.json();
    const { bookId, pageNumber, babyPhotoUrl, pageData, style, size = 'preview' } = body;
    
    console.log(`Generating page ${pageNumber} for book ${bookId}`);
    console.log(`Camera angle: ${pageData.camera_angle}`);
    console.log(`Visual focus: ${pageData.visual_focus}`);
    console.log(`Action: ${pageData.visual_action}`);
    
    // Get processed plate
    const platePath = await getOrCreatePlate(bookId, babyPhotoUrl);
    const pngBuffer = await fs.promises.readFile(platePath);
    
    // Create file for OpenAI
    const imageFile = await toFile(
      pngBuffer, 
      'plate.png',
      { type: 'image/png' }
    );
    
    // Build camera-first prompt (like the working examples)
    const prompt = buildCameraFirstPrompt(pageData, style);
    console.log(`Camera-first prompt: ${prompt}`);
    
    // Call GPT-IMAGE-1 with the right parameters
    let response;
    try {
      response = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFile,
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      });
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
    
    let finalBuffer: Buffer;
    let mimeType: string;
    
    if (size === 'print') {
      // Upscale for print
      finalBuffer = await sharp(imageBuffer)
        .resize(2100, 2100, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png({ quality: 95 })
        .toBuffer();
      mimeType = 'image/png';
    } else {
      // Optimize for preview
      finalBuffer = await sharp(imageBuffer)
        .png({ 
          quality: 85,
          compressionLevel: 9,
          palette: true
        })
        .toBuffer();
      mimeType = 'image/png';
    }
    
    // Create data URL
    const dataUrl = `data:${mimeType};base64,${finalBuffer.toString('base64')}`;
    
    const elapsedMs = Date.now() - startTime;
    console.log(`Page ${pageNumber} completed in ${elapsedMs}ms with camera: ${pageData.camera_angle}`);
    
    return NextResponse.json({ 
      success: true,
      page_number: pageNumber,
      dataUrl,
      size: size === 'print' ? '2100x2100' : '1024x1024',
      sizeKB: Math.round(finalBuffer.length / 1024),
      prompt: prompt,
      style,
      camera_angle: pageData.camera_angle,
      action_id: pageData.action_id,
      visual_focus: pageData.visual_focus,
      visual_action: pageData.visual_action,
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