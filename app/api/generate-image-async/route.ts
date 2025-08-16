// app/api/generate-image-async/route.ts
/**
 * Async image generation with job queue pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Force Node runtime for file operations
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// IMPORTANT: Increase timeout for this route
export const maxDuration = 300; // 5 minutes max

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 240000, // 4 minutes timeout for OpenAI client
  maxRetries: 2,
});

// In-memory job storage (in production, use Redis or database)
const jobs = new Map<string, {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  startedAt: number;
  completedAt?: number;
}>();

// Clean up old jobs periodically
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.startedAt < oneHourAgo) {
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000); // Every 10 minutes

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
    
    // Return immediately with job ID
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Image generation started'
    });
    
  } catch (error: any) {
    console.error('Failed to start job:', error);
    return NextResponse.json(
      { success: false, error: error.message },
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
    return NextResponse.json(
      { error: 'Job ID required' },
      { status: 400 }
    );
  }
  
  const job = jobs.get(jobId);
  
  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
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
    // Update status
    job.status = 'processing';
    job.progress = 10;
    
    const { bookId, pageNumber, babyPhotoUrl, pageData, style } = params;
    
    console.log(`[Job ${jobId}] Starting generation for page ${pageNumber}`);
    
    // Process baby photo
    job.progress = 20;
    const platePath = await getOrCreatePlate(bookId, babyPhotoUrl);
    const pngBuffer = await fs.promises.readFile(platePath);
    
    console.log(`[Job ${jobId}] Plate size: ${(pngBuffer.length / 1024).toFixed(2)}KB`);
    
    // Create file for OpenAI
    job.progress = 30;
    const imageFile = await toFile(
      pngBuffer,
      'plate.png',
      { type: 'image/png' }
    );
    
    // Build prompt
    const prompt = buildPrompt(pageData, style);
    console.log(`[Job ${jobId}] Prompt: ${prompt.substring(0, 100)}...`);
    
    job.progress = 40;
    
    // Call GPT-IMAGE-1 with ALL supported parameters
    console.log(`[Job ${jobId}] Calling OpenAI API...`);
    const startTime = Date.now();
    
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
      background: 'transparent',
      output_format: 'png',
      input_fidelity: 'high' // Keep baby's features consistent
    });
    
    const apiTime = Date.now() - startTime;
    console.log(`[Job ${jobId}] OpenAI API responded in ${apiTime}ms`);
    
    job.progress = 80;
    
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
    
    job.progress = 90;
    
    // Process with sharp for optimization (optional)
    let finalBase64 = imageBase64;
    let mimeType = 'image/png';
    
    try {
      const sharp = await import('sharp').then(m => m.default);
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      
      const optimizedBuffer = await sharp(imageBuffer)
        .png({ 
          quality: 85,
          compressionLevel: 9,
          palette: true
        })
        .toBuffer();
      
      finalBase64 = optimizedBuffer.toString('base64');
      console.log(`[Job ${jobId}] Optimized: ${(optimizedBuffer.length / 1024).toFixed(2)}KB`);
    } catch (e) {
      console.warn(`[Job ${jobId}] Sharp optimization failed, using original`);
    }
    
    // Create data URL
    const dataUrl = `data:${mimeType};base64,${finalBase64}`;
    
    job.progress = 100;
    job.status = 'completed';
    job.completedAt = Date.now();
    job.result = {
      page_number: pageNumber,
      dataUrl,
      sizeKB: Math.round(Buffer.from(finalBase64, 'base64').length / 1024),
      prompt,
      style,
      shot: pageData.shot,
      action_id: pageData.action_id,
      elapsed_ms: Date.now() - job.startedAt,
      api_time_ms: apiTime
    };
    
    console.log(`[Job ${jobId}] Completed in ${job.result.elapsed_ms}ms`);
    
  } catch (error: any) {
    console.error(`[Job ${jobId}] Failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = Date.now();
  }
}

// Helper functions (same as before)
const plateCache = new Map<string, string>();

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
    
    return tmpPath;
  } catch (error) {
    console.error('PNG conversion error:', error);
    throw new Error('Failed to process image');
  }
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

function buildPrompt(
  page: any,
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
    page.action_label || page.action_id?.replace(/_/g, ' '),
    'children\'s book illustration',
    STYLE_TAGS[style],
    'consistent character',
    'simple background',
    'bright colors'
  ].join(', ');
}