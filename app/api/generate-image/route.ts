// app/api/generate-image/route.ts
/**
 * Enhanced image generation with specific visual focus
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

// Also update the interface to include new fields:
interface EnhancedGenerateImageRequest {
  bookId: string;
  pageNumber: number;
  babyPhotoUrl?: string;
  pageData: {
    narration: string;
    shot?: string; // Legacy field
    camera_angle?: string; // New: specific camera angle
    camera_angle_description?: string; // New: camera description
    action_id: string;
    action_label?: string;
    visual_focus?: string;
    visual_action?: string;
    detail_prompt?: string;
    sensory_details?: string;
    pose_description?: string; // New: pose for this shot
  };
  style: 'wondrous' | 'crayon' | 'vintage';
  size?: 'preview' | 'print';
}

const STYLE_DESCRIPTIONS = {
  wondrous: 'Soft watercolor illustration, dreamy and magical, pastel colors, gentle brush strokes',
  crayon: 'Crayon drawing style, hand-drawn texture, waxy appearance, childlike charm',
  vintage: 'Vintage children\'s book illustration, muted colors, nostalgic feel, mid-century aesthetic'
} as const;

const VISUAL_FOCUS_PROMPTS = {
  hands: 'extreme close-up on baby hands, detailed fingers, skin texture visible',
  feet: 'close-up on baby feet, toes clearly visible, foot details prominent',
  face: 'close-up on baby face, clear facial expression, eyes and smile prominent',
  eyes: 'extreme close-up on eyes, sparkling with emotion, detailed iris',
  full_body: 'full body shot showing entire baby in scene',
  object_interaction: 'focus on baby interacting with specific object',
  environmental: 'baby within environmental context, surroundings visible'
} as const;

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
 * Build enhanced prompt using camera angles and visual details
 */
function buildEnhancedPrompt(
  page: EnhancedGenerateImageRequest['pageData'],
  style: keyof typeof STYLE_DESCRIPTIONS,
  babyName?: string
): string {
  const parts: string[] = [];
  
  // CAMERA ANGLE FIRST - This is most important for composition
  if (page.camera_angle) {
    // Add specific camera angle instructions
    const cameraInstructions = {
      'extreme_closeup': 'EXTREME CLOSE-UP SHOT, fill entire frame with detail, no background visible',
      'closeup': 'CLOSE-UP SHOT, focus on specific area, minimal background',
      'medium': 'MEDIUM SHOT, character and immediate surroundings visible',
      'wide': 'WIDE SHOT, full scene with environment, character small in frame',
      'birds_eye': 'BIRD\'S EYE VIEW, looking straight down from directly above',
      'low_angle': 'LOW ANGLE SHOT, camera at ground level looking up',
      'pov_baby': 'POV SHOT from baby\'s perspective, first-person view of own body parts or surroundings',
      'pov_parent': 'POV SHOT from parent\'s perspective looking down at baby',
      'over_shoulder': 'OVER-THE-SHOULDER SHOT, seeing what baby sees',
      'macro': 'MACRO PHOTOGRAPHY, extreme magnification showing texture details',
      'dutch_angle': 'DUTCH ANGLE, tilted camera for dynamic playful feeling',
      'profile': 'PROFILE SHOT, perfect side view of subject'
    };
    
    const cameraInstruction = cameraInstructions[page.camera_angle as keyof typeof cameraInstructions];
    if (cameraInstruction) {
      parts.push(cameraInstruction);
    }
  }
  
  // If we have a detailed prompt from story generation, add it
  if (page.detail_prompt) {
    parts.push(page.detail_prompt);
  } else {
    // Fallback to building from components
    
    // Camera angle description if available
    if (page.camera_angle_description) {
      parts.push(page.camera_angle_description);
    }
    
    // Visual focus if specified
    if (page.visual_focus) {
      const focusDescriptions = {
        'hands': 'focus on baby hands, detailed fingers',
        'feet': 'focus on baby feet, toes clearly visible',
        'face': 'focus on baby face, clear expression',
        'eyes': 'focus on eyes, detailed and expressive',
        'full_body': 'show entire baby in scene',
        'object_interaction': 'show baby interacting with object',
        'environmental': 'baby within environment context'
      };
      const focusDesc = focusDescriptions[page.visual_focus as keyof typeof focusDescriptions];
      if (focusDesc) parts.push(focusDesc);
    }
    
    // Visual action
    if (page.visual_action) {
      parts.push(page.visual_action.replace(/_/g, ' '));
    }
    
    // Action label or ID
    if (page.action_label) {
      parts.push(page.action_label);
    } else if (page.action_id) {
      parts.push(page.action_id.replace(/_/g, ' '));
    }
  }
  
  // Pose description if available
  if (page.pose_description) {
    parts.push(`pose: ${page.pose_description}`);
  }
  
  // Add sensory details if available
  if (page.sensory_details) {
    parts.push(page.sensory_details);
  }
  
  // Always add style and format specifications
  parts.push('children\'s book illustration');
  parts.push(STYLE_DESCRIPTIONS[style]);
  parts.push('consistent baby character');
  parts.push('professional quality');
  
  // Special instructions for certain camera angles
  if (page.camera_angle === 'pov_baby') {
    parts.push('first-person perspective');
    parts.push('looking at own body parts');
  } else if (page.camera_angle === 'macro') {
    parts.push('extreme detail visible');
    parts.push('texture clearly shown');
  } else if (page.camera_angle === 'birds_eye') {
    parts.push('top-down perspective');
    parts.push('symmetrical composition');
  }
  
  // Join all parts
  const prompt = parts.join(', ');
  
  console.log(`Enhanced prompt for ${page.camera_angle} angle:`, prompt);
  return prompt;
}

/**
 * Main POST handler with enhanced visual focus
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: EnhancedGenerateImageRequest = await request.json();
    const { bookId, pageNumber, babyPhotoUrl, pageData, style, size = 'preview' } = body;
    
    console.log(`Generating page ${pageNumber} for book ${bookId}`);
    console.log(`Visual focus: ${pageData.visual_focus}, Action: ${pageData.visual_action}`);
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
    
    // Build enhanced prompt
    const pagePrompt = buildEnhancedPrompt(pageData, style);
    console.log(`Full prompt: ${pagePrompt}`);
    
    // Call GPT-IMAGE-1 with enhanced parameters
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
        output_format: 'png',
        input_fidelity: 'high' // Keep baby's features consistent
      };
      
      // Add extra parameters for specific visual focus
      if (pageData.visual_focus === 'hands' || pageData.visual_focus === 'feet') {
        params.detail = 'high'; // Request higher detail for close-ups
      }
      
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
    
    // Create data URL
    const dataUrl = `data:${mimeType};base64,${finalBuffer.toString('base64')}`;
    
    const elapsedMs = Date.now() - startTime;
    console.log(`Page ${pageNumber} completed in ${elapsedMs}ms`);
    
    return NextResponse.json({ 
      success: true,
      page_number: pageNumber,
      dataUrl,
      size: size === 'print' ? '2100x2100' : '1024x1024',
      sizeKB: Math.round(finalBuffer.length / 1024),
      prompt: pagePrompt,
      style,
      shot: pageData.shot,
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