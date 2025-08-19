/**
 * Fetch image from OpenAI URL with retry logic
 */
// app/api/generate-image-async/route.ts
/**
 * Style-Anchored Image Generation with GPT-IMAGE-1
 * 
 * FLOW:
 * 1. Page 1: Upload Photo → GPT transforms to chosen style → Store as anchor
 * 2. Pages 2+: Send Page 1 image to GPT → Modify only camera/action → Consistent style
 * 
 * CRITICAL: 
 * - Page 1 MUST complete before Pages 2+ can start
 * - Every page after 1 uses the SAME Page 1 image as input to GPT
 * - This ensures perfect style and character consistency
 * 
 * NOTE ON RESPONSE FORMAT:
 * - OpenAI docs say gpt-image-1 always returns base64
 * - But the SDK actually returns URLs that we need to fetch
 * - We handle both cases for compatibility
 * 
 * API CALLS:
 * - Page 1: openai.images.edit(uploaded_photo) → styled_anchor
 * - Page 2: openai.images.edit(styled_anchor) → new_camera_angle
 * - Page 3: openai.images.edit(styled_anchor) → different_action
 * - etc...
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
  maxRetries: 2,
});

// In-memory job storage
const jobs = new Map<string, {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  startedAt: number;
  completedAt?: number;
}>();

// Style anchor storage (in production, use Redis/DB)
const styleAnchors = new Map<string, string>();

// Clean up old jobs periodically
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.startedAt < oneHourAgo) {
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

/**
 * Camera angle to concise prompt mapping
 */
function getCameraPrompt(angle: string): string {
  const cameraMap: Record<string, string> = {
    extreme_closeup: "extreme close-up on tiny details, 85mm macro",
    macro: "macro texture shot, shallow depth",
    pov_baby: "POV from baby height looking at own hands/feet, 28mm",
    wide: "wide environmental shot, 28mm",
    birds_eye: "top-down bird's-eye view, 28mm",
    worms_eye: "extreme low angle looking up, 28mm",
    profile: "strict profile from side, 50mm",
    over_shoulder: "over-the-shoulder framing, 50mm"
  };
  return cameraMap[angle] || "medium shot, 35mm";
}

/**
 * POST - Start image generation job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookId, pageNumber, babyPhotoUrl, pageData, style } = body;
    
    // Create job ID
    const jobId = `${bookId}-${pageNumber}-${Date.now()}`;
    
    // Store job
    jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      progress: 0,
      startedAt: Date.now()
    });
    
    // Start async processing
    processImageGeneration(jobId, body).catch(error => {
      console.error(`Job ${jobId} failed:`, error);
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
      }
    });
    
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Image generation started'
    });
    
  } catch (error: any) {
    console.error('Failed to start job:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start job' },
      { status: 500 }
    );
  }
}

/**
 * GET - Check job status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  
  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
  }
  
  const job = jobs.get(jobId);
  
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  
  return NextResponse.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      duration: job.completedAt 
        ? job.completedAt - job.startedAt 
        : Date.now() - job.startedAt
    }
  });
}

/**
 * Process image generation asynchronously
 */
async function processImageGeneration(jobId: string, params: any) {
  const job = jobs.get(jobId);
  if (!job) return;
  
  try {
    job.status = 'processing';
    job.progress = 10;
    
    const { bookId, pageNumber, babyPhotoUrl, pageData, style } = params;
    
    console.log(`[Job ${jobId}] Page ${pageNumber}, Camera: ${pageData.camera_angle}`);
    console.log(`[Job ${jobId}] Camera Prompt: ${pageData.camera_prompt}`);
    
    let imageBase64: string;
    
    if (pageNumber === 1) {
      // PAGE 1: Create style anchor from uploaded photo
      imageBase64 = await createStyleAnchor({
        uploadedPhotoB64: babyPhotoUrl.replace(/^data:image\/\w+;base64,/, ''),
        style,
        setting: extractSetting(pageData),
        action: pageData.visual_action || pageData.action_label,
        camera: pageData.camera_angle,
        cameraPrompt: pageData.camera_prompt
      });
      
      // Store as anchor for this book
      styleAnchors.set(bookId, imageBase64);
      console.log(`[Job ${jobId}] Created style anchor for book ${bookId}`);
      
    } else {
      // PAGES 2+: Must use style anchor from Page 1
      const maxAttempts = 15; // Wait up to 30 seconds for anchor
      let anchorB64: string | undefined;
      
      // Wait for anchor to be available
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        anchorB64 = styleAnchors.get(bookId);
        if (anchorB64) {
          console.log(`[Job ${jobId}] Found anchor after ${attempt} attempts`);
          break;
        }
        
        if (attempt === 0) {
          console.log(`[Job ${jobId}] Waiting for Page 1 anchor to be available...`);
        }
        
        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      if (!anchorB64) {
        throw new Error('Style anchor from Page 1 not available. Cannot generate subsequent pages without anchor.');
      }
      
      // Generate using the Page 1 anchor as base image
      console.log(`[Job ${jobId}] Using Page 1 anchor for consistency`);
      imageBase64 = await generateFromAnchor({
        styleAnchorB64: anchorB64, // This is the Page 1 image being sent to GPT
        setting: extractSetting(pageData),
        action: pageData.visual_action || pageData.action_label,
        camera: pageData.camera_angle,
        cameraPrompt: pageData.camera_prompt
      });
    }
    
    job.progress = 90;
    
    // Create data URL
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    
    job.progress = 100;
    job.status = 'completed';
    job.completedAt = Date.now();
    job.result = {
      page_number: pageNumber,
      dataUrl,
      sizeKB: Math.round(Buffer.from(imageBase64, 'base64').length / 1024),
      style,
      camera_angle: pageData.camera_angle,
      action: pageData.visual_action,
      elapsed_ms: Date.now() - job.startedAt
    };
    
    console.log(`[Job ${jobId}] Completed in ${job.result.elapsed_ms}ms`);
    
  } catch (error: any) {
    console.error(`[Job ${jobId}] Failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = Date.now();
  }
}

/**
 * Create style anchor from uploaded photo (Page 1)
 */
async function createStyleAnchor({
  uploadedPhotoB64,
  style,
  setting,
  action,
  camera,
  cameraPrompt
}: {
  uploadedPhotoB64: string;
  style: string;
  setting: string;
  action: string;
  camera: string;
  cameraPrompt?: string;
}): Promise<string> {
  const styleMap: Record<string, string> = {
    wondrous: 'soft watercolor illustration, pastel colors, dreamy atmosphere',
    crayon: 'crayon drawing style, waxy texture, bold colors, hand-drawn feel',
    vintage: 'vintage children\'s book illustration, muted colors, nostalgic'
  };
  
  // Use the camera_prompt if provided, otherwise fall back to getCameraPrompt
  const cameraDescription = cameraPrompt || getCameraPrompt(camera);
  
  const prompt = [
    `Transform into ${styleMap[style] || style}.`,
    `Keep exact child identity and features.`,
    `Setting: ${setting}.`,
    `Action: ${action}.`,
    `Camera: ${cameraDescription}.`,
    'Picture book for ages 0-3.',
    'No text in image.'
  ].join(' ');
  
  console.log('Creating style anchor with prompt:', prompt);
  
  // Convert base64 to Buffer
  const imageBuffer = Buffer.from(uploadedPhotoB64, 'base64');
  const imageFile = await toFile(imageBuffer, 'photo.png', { type: 'image/png' });
  
  // Send the Page 1 anchor image to OpenAI for modification
  // The image parameter contains the Page 1 styled image
  // The prompt tells GPT to keep the style/character but change camera/action
  
  // Call OpenAI with minimal parameters first
  const response = await openai.images.edit({
    model: 'gpt-image-1',
    image: imageFile,  // <-- This is the Page 1 anchor image being sent to GPT
    prompt,            // <-- Instructions to modify camera angle and action only
    n: 1,
    size: '1024x1024'
    // Removed parameters that might be causing issues
  });
  
  if (!response.data || !response.data[0]) {
    throw new Error('No image data in response');
  }
  
  const imageData = response.data[0];
  
  // The OpenAI SDK might return URLs even for gpt-image-1
  // despite what the API docs say
  if ('url' in imageData && imageData.url) {
    console.log('Got URL response (SDK behavior), fetching image...');
    const imageBuffer = await fetchImageWithRetry(imageData.url);
    const base64 = imageBuffer.toString('base64');
    console.log(`Page generated successfully from URL (${Math.round(base64.length / 1024)}KB)`);
    return base64;
  }
  
  // Check for base64 response (what the docs say should happen)
  if ('b64_json' in imageData && imageData.b64_json) {
    console.log(`Page generated successfully from base64 (${Math.round(imageData.b64_json.length / 1024)}KB)`);
    return imageData.b64_json;
  }
  
  // If we get here, log the entire response for debugging
  console.error('Unexpected response structure:', JSON.stringify(imageData));
  throw new Error('Could not find image data in response. Check logs for response structure.');
}

/**
 * Generate new page from style anchor (Pages 2+)
 * Takes the Page 1 image as input and modifies it with new camera angle/action
 * This ensures style and character consistency across all pages
 */
async function generateFromAnchor({
  styleAnchorB64,
  setting,
  action,
  camera,
  cameraPrompt
}: {
  styleAnchorB64: string; // This is the Page 1 image in base64
  setting: string;
  action: string;
  camera: string;
  cameraPrompt?: string;
}): Promise<string> {
  // Use the camera_prompt if provided, otherwise fall back to getCameraPrompt
  const cameraDescription = cameraPrompt || getCameraPrompt(camera);
  
  const prompt = [
    'Create new scene with SAME art style and SAME child as reference image.',
    'Keep identical character features, clothing, and art style.',
    'Only change the camera angle and action.',
    `Setting: ${setting}.`,
    `New action: ${action}.`,
    `New camera angle: ${cameraDescription}.`,
    'Maintain exact style consistency with reference.',
    'No text in image.'
  ].join(' ');
  
  console.log('Generating from anchor with prompt:', prompt);
  
  // Convert the Page 1 anchor image to a file for OpenAI
  const imageBuffer = Buffer.from(styleAnchorB64, 'base64');
  const imageFile = await toFile(imageBuffer, 'anchor.png', { type: 'image/png' });
  
  // Try with response_format first for direct base64
  let response;
  try {
    response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json'
    });
  } catch (error: any) {
    console.log('b64_json format not supported, trying with URL format');
    // Fallback to URL format
    response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt,
      n: 1,
      size: '1024x1024'
    });
  }
  
  if (!response.data || !response.data[0]) {
    throw new Error('No image data in response');
  }
  
  // Handle both response formats
  let base64: string;
  
  if ('b64_json' in response.data[0]) {
    // Direct base64 response
    base64 = response.data[0].b64_json!;
  } else if ('url' in response.data[0]) {
    // URL response - fetch and convert
    const imageUrl = response.data[0].url;
    if (!imageUrl) {
      throw new Error('No image URL in response');
    }
    
    try {
      console.log('Fetching image from URL:', imageUrl.substring(0, 100) + '...');
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      base64 = Buffer.from(arrayBuffer).toString('base64');
    } catch (fetchError) {
      console.error('Error fetching generated image:', fetchError);
      throw new Error('Failed to download generated image');
    }
  } else {
    throw new Error('Unknown response format from OpenAI');
  }
  
  return base64;
}

/**
 * Extract setting from page data
 */
function extractSetting(pageData: any): string {
  // Use sensory details or narration to infer setting
  if (pageData.sensory_details) {
    return pageData.sensory_details;
  }
  
  const narration = (pageData.narration || '').toLowerCase();
  
  // Specific setting detection
  if (narration.includes('beach') || narration.includes('sand') || narration.includes('wave')) {
    return 'sunny beach with warm sand and gentle waves';
  }
  if (narration.includes('park') || narration.includes('grass') || narration.includes('tree')) {
    return 'green park with trees and soft grass';
  }
  if (narration.includes('home') || narration.includes('room') || narration.includes('inside')) {
    return 'cozy home interior with warm lighting';
  }
  if (narration.includes('garden') || narration.includes('flower')) {
    return 'beautiful garden with colorful flowers';
  }
  if (narration.includes('pool') || narration.includes('water') || narration.includes('splash')) {
    return 'swimming pool with clear blue water';
  }
  if (narration.includes('birthday') || narration.includes('party')) {
    return 'festive birthday party with decorations';
  }
  
  // Default based on common baby book settings
  return 'bright, cheerful outdoor environment with soft natural light';
}

/**
 * Fetch image from OpenAI URL with retry logic
 */
async function fetchImageWithRetry(url: string, maxRetries = 3): Promise<Buffer> {
  if (!url || !url.startsWith('http')) {
    throw new Error(`Invalid URL provided: ${url}`);
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching image from URL (attempt ${attempt}/${maxRetries})...`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Next.js Server',
          'Accept': 'image/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Verify we got actual image data
      if (buffer.length < 100) {
        throw new Error(`Image too small: ${buffer.length} bytes`);
      }
      
      console.log(`Successfully fetched image: ${Math.round(buffer.length / 1024)}KB`);
      return buffer;
      
    } catch (error: any) {
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to fetch image after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait a bit before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Failed to fetch image');
}

/**
 * DELETE - Clean up temporary files
 */
export async function DELETE() {
  try {
    // Clear style anchors older than 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [bookId, _] of styleAnchors.entries()) {
      // In production, check timestamp
      // For now, clear all
    }
    
    jobs.clear();
    styleAnchors.clear();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cleaned up old data'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}