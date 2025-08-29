// app/api/generate-image/route.ts
/**
 * Enhanced image generation with cinematic camera prompting
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { 
  CINEMATIC_SHOTS, 
  buildCinematicPrompt, 
  selectBestShot 
} from '@/lib/camera/cinematicShots';

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
    shot_id?: string;  // Enhanced: Using shot_id instead of camera_angle
    camera_angle?: string;  // Fallback for backward compatibility
    camera_angle_description?: string;
    shot_description?: string;
    action_id?: string;
    action_label?: string;
    visual_focus?: string;
    visual_action?: string;
    detail_prompt?: string;
    sensory_details?: string;
    pose_description?: string;
    emotion?: string;
    scene_type?: 'opening' | 'action' | 'closing';
  };
  style: 'bright-bold' | 'pop-art' | 'rainbow';
  size?: 'preview' | 'print';
}

/**
 * Build cinematic prompt with emotional depth and visual variety
 */
function buildEnhancedCinematicPrompt(
  page: GenerateImageRequest['pageData'],
  style: string
): string {
  // Determine the best shot - use shot_id if available, otherwise select based on context
  const shotId = page.shot_id || selectBestShot(
    page.visual_action || page.action_label,
    page.emotion,
    page.visual_focus,
    page.scene_type
  );
  
  // Build the cinematic prompt with all available context
  const cinematicPrompt = buildCinematicPrompt(shotId, {
    visualFocus: page.visual_focus,
    visualAction: page.visual_action || page.action_label,
    sensoryDetails: page.sensory_details,
    emotion: page.emotion,
    style: style,
    characters: [] // Characters handled separately in this route
  });
  
  // Log the selected shot for debugging
  const shot = CINEMATIC_SHOTS[shotId];
  if (shot) {
    console.log(`Selected cinematic shot: ${shot.name} - ${shot.base_prompt}`);
    if (shot.mood) {
      console.log(`Shot mood: ${shot.mood.join(', ')}`);
    }
  }
  
  return cinematicPrompt;
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
 * Main POST handler with enhanced cinematic prompting
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: GenerateImageRequest = await request.json();
    const { bookId, pageNumber, babyPhotoUrl, pageData, style, size = 'preview' } = body;
    
    // Log cinematic details
    console.log(`Generating page ${pageNumber} for book ${bookId}`);
    if (pageData.shot_id) {
      const shot = CINEMATIC_SHOTS[pageData.shot_id];
      console.log(`Cinematic shot: ${shot?.name || pageData.shot_id}`);
      console.log(`Emotion: ${pageData.emotion}, Visual focus: ${pageData.visual_focus}`);
    } else {
      console.log(`Legacy camera angle: ${pageData.camera_angle}`);
    }
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
    
    // Build enhanced cinematic prompt
    const prompt = buildEnhancedCinematicPrompt(pageData, style);
    console.log(`Enhanced cinematic prompt: ${prompt}`);
    
    // Call GPT-IMAGE-1 with the cinematic prompt
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
    
    // Get shot details for response
    const shotId = pageData.shot_id || selectBestShot(
      pageData.visual_action,
      pageData.emotion,
      pageData.visual_focus,
      pageData.scene_type
    );
    const shot = CINEMATIC_SHOTS[shotId];
    
    console.log(`Page ${pageNumber} completed in ${elapsedMs}ms with cinematic shot: ${shot?.name || shotId}`);
    
    return NextResponse.json({ 
      success: true,
      page_number: pageNumber,
      dataUrl,
      size: size === 'print' ? '2100x2100' : '1024x1024',
      sizeKB: Math.round(finalBuffer.length / 1024),
      prompt: prompt,
      style,
      shot_id: shotId,
      shot_name: shot?.name,
      shot_mood: shot?.mood,
      camera_angle: pageData.camera_angle,  // Keep for backward compatibility
      action_id: pageData.action_id,
      visual_focus: pageData.visual_focus,
      visual_action: pageData.visual_action,
      emotion: pageData.emotion,
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