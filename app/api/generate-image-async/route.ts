// app/api/generate-image-async/route.ts - Fixed version with one ref per character
// Key changes: Only send ONE reference per unique character, better styles

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { PersonId, CastMember, UploadedPhoto } from '@/lib/store/bookStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
  maxRetries: 2,
});

// Job storage
const jobs = new Map<string, {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  startedAt: number;
  completedAt?: number;
}>();

// Style anchor storage
const styleAnchors = new Map<string, string>();

// Character reference cache - store best reference per character per book
const characterReferences = new Map<string, Map<PersonId, string>>();

// Cleanup interval
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.startedAt < oneHourAgo) {
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

/**
 * Build vibrant, high-contrast prompt for baby books
 */
function buildVibrantPrompt(
  pageData: any,
  pageNumber: number,
  style: string
): string {
  // Updated styles with high contrast and vibrant colors for babies
  const styleMap: Record<string, string> = {
    'bright-bold': 'BRIGHT BOLD illustration style: vivid saturated colors, thick black outlines, high contrast, cheerful and energetic, baby board book style',
    'pop-art': 'POP ART baby book style: bold primary colors (red, blue, yellow), thick black outlines, high contrast shapes, playful and graphic',
    'rainbow': 'RAINBOW BRIGHT style: vibrant multi-colored palette, bold shapes, high contrast, joyful and stimulating for babies, thick outlines',
    
    // Legacy styles (updated to be more vibrant)
    wondrous: 'VIBRANT watercolor style: bright saturated colors, high contrast, thick outlines, cheerful atmosphere',
    crayon: 'BOLD CRAYON style: bright waxy colors, thick black outlines, high contrast, playful texture',
    vintage: 'RETRO BRIGHT style: vivid colors, high contrast, thick lines, nostalgic but energetic'
  };
  
  const charactersPresent = pageData.characters_on_page?.join(', ') || 'baby';
  
  const prompt = [
    pageNumber === 1 ? 'CREATE STYLE:' : 'MATCH STYLE:',
    pageNumber === 1 
      ? `${styleMap[style] || styleMap['bright-bold']}` 
      : 'Match image[0] style EXACTLY - same colors, same line thickness, same energy level',
    '',
    'IMPORTANT: Use BRIGHT, HIGH-CONTRAST colors suitable for baby vision',
    'Thick black outlines on all elements',
    'Bold, simple shapes',
    '',
    `SCENE (Page ${pageData.page_number}):`,
    `- Characters: ${charactersPresent}`,
    `- Action: ${pageData.visual_action || pageData.action_description || 'playing'}`,
    `- Camera: ${pageData.camera_prompt || pageData.camera_angle || 'medium shot'}`,
    '',
    'RULES:',
    '- Baby board book illustration (ages 0-3)',
    '- HIGH CONTRAST and BRIGHT COLORS essential',
    '- Thick, bold outlines on everything',
    '- Simple, clear shapes',
    '- Cheerful, energetic mood',
    '- Keep characters consistent',
    '- No text or labels',
    '- Single frame composition'
  ].filter(line => line !== undefined).join('\n');
  
  console.log(`[Page ${pageNumber}] Vibrant prompt:`, prompt);
  return prompt;
}

/**
 * Convert base64/URL to file for OpenAI
 */
async function prepareImageFile(imageUrl: string, name: string = 'ref.png'): Promise<any> {
  let buffer: Buffer;
  
  try {
    if (imageUrl.startsWith('data:')) {
      const base64 = imageUrl.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64, 'base64');
    } else if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = Buffer.from(imageUrl, 'base64');
    }
    
    if (buffer.length > 50 * 1024 * 1024) {
      throw new Error('Image exceeds 50MB limit');
    }
    
    return await toFile(buffer, name, { type: 'image/png' });
  } catch (error) {
    console.error(`Failed to prepare image:`, error);
    throw error;
  }
}

/**
 * Get ONE best reference for a character (cached)
 */
function getOneCharacterReference(
  characterId: PersonId,
  uploadedPhotos: UploadedPhoto[],
  bookId: string
): string | null {
  // Check cache first
  const bookCache = characterReferences.get(bookId);
  if (bookCache?.has(characterId)) {
    return bookCache.get(characterId)!;
  }
  
  // Find best photo (prefer solo shots)
  let bestPhoto: string | null = null;
  
  // Priority 1: Solo photo of just this character
  const soloPhoto = uploadedPhotos.find(p => 
    p.people.length === 1 && p.people[0] === characterId
  );
  if (soloPhoto) {
    bestPhoto = soloPhoto.fileUrl;
  } else {
    // Priority 2: Any photo with this character (prefer fewer people)
    const photosWithChar = uploadedPhotos
      .filter(p => p.people.includes(characterId))
      .sort((a, b) => a.people.length - b.people.length);
    
    if (photosWithChar.length > 0) {
      bestPhoto = photosWithChar[0].fileUrl;
    }
  }
  
  // Cache the result
  if (bestPhoto) {
    if (!bookCache) {
      characterReferences.set(bookId, new Map());
    }
    characterReferences.get(bookId)!.set(characterId, bestPhoto);
  }
  
  return bestPhoto;
}

/**
 * POST - Start image generation job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookId, pageNumber, pageData } = body;
    
    if (!bookId || !pageNumber || !pageData) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const jobId = `${bookId}-${pageNumber}-${Date.now()}`;
    
    jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      progress: 0,
      startedAt: Date.now()
    });
    
    processOptimalImageGeneration(jobId, body).catch(error => {
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
 * Process image generation with ONE reference per character
 */
async function processOptimalImageGeneration(jobId: string, params: any) {
  const job = jobs.get(jobId);
  if (!job) return;
  
  try {
    job.status = 'processing';
    job.progress = 10;
    
    const { 
      bookId, 
      pageNumber, 
      babyPhotoUrl,
      pageData, 
      style = 'bright-bold', // Default to vibrant style
      uploadedPhotos = []
    } = params;
    
    console.log(`[Job ${jobId}] Page ${pageNumber}, Characters: ${pageData.characters_on_page?.join(', ')}`);
    
    let imageFiles: any[] = [];
    let prompt: string;
    
    if (pageNumber === 1) {
      // PAGE 1: Create style anchor with ONLY baby photo
      let babyReference = babyPhotoUrl;
      if (!babyReference && uploadedPhotos.length > 0) {
        babyReference = getOneCharacterReference('baby', uploadedPhotos, bookId);
      }
      
      if (!babyReference) {
        throw new Error('No baby photo provided for Page 1');
      }
      
      console.log(`[Job ${jobId}] Page 1: Creating vibrant style anchor`);
      
      const babyFile = await prepareImageFile(babyReference, 'baby.png');
      imageFiles = [babyFile];
      
      prompt = buildVibrantPrompt(pageData, 1, style);
      
    } else {
      // PAGES 2+: Style anchor + ONE reference per unique character
      const styleAnchor = await waitForStyleAnchor(bookId);
      if (!styleAnchor) {
        throw new Error('Style anchor not available. Please generate Page 1 first.');
      }
      
      const references: { url: string; name: string }[] = [];
      references.push({ url: styleAnchor, name: 'style.png' });
      
      // Get UNIQUE characters on this page
      const uniqueCharacters = new Set(pageData.characters_on_page || []);
      
      // Add ONE reference per unique character (max 3 characters typically)
      for (const characterId of uniqueCharacters) {
        if (references.length >= 4) break; // Max 4 total (style + 3 chars)
        
        const charRef = getOneCharacterReference(characterId as PersonId, uploadedPhotos, bookId);
        if (charRef) {
          references.push({ 
            url: charRef, 
            name: `${characterId}.png` 
          });
        }
      }
      
      console.log(`[Job ${jobId}] Page ${pageNumber}: ${uniqueCharacters.size} unique characters, ${references.length} total refs`);
      
      imageFiles = await Promise.all(
        references.map(ref => prepareImageFile(ref.url, ref.name))
      );
      
      prompt = buildVibrantPrompt(pageData, pageNumber, style);
    }
    
    job.progress = 30;
    
    // Call OpenAI
    console.log(`[Job ${jobId}] Calling OpenAI with ${imageFiles.length} reference(s)`);
    
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
      input_fidelity: 'high',
      background: 'transparent',
      // @ts-expect-error: moderation exists but not in SDK types
      moderation: 'low',
    });
    
    job.progress = 80;
    
    const imageBase64 = await handleOpenAIResponse(response);
    
    if (pageNumber === 1) {
      styleAnchors.set(bookId, imageBase64);
      console.log(`[Job ${jobId}] Vibrant style anchor created for book ${bookId}`);
    }
    
    job.progress = 90;
    
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    
    job.progress = 100;
    job.status = 'completed';
    job.completedAt = Date.now();
    job.result = {
      page_number: pageNumber,
      dataUrl,
      sizeKB: Math.round(Buffer.from(imageBase64, 'base64').length / 1024),
      style,
      characters_on_page: pageData.characters_on_page,
      reference_count: imageFiles.length,
      elapsed_ms: Date.now() - job.startedAt
    };
    
    console.log(`[Job ${jobId}] Completed with ${imageFiles.length} reference(s)`);
    
  } catch (error: any) {
    console.error(`[Job ${jobId}] Failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = Date.now();
  }
}

/**
 * Handle OpenAI response
 */
async function handleOpenAIResponse(response: any): Promise<string> {
  if (!response.data || !response.data[0]) {
    throw new Error('No image data in response');
  }
  
  const imageData = response.data[0];
  
  if ('b64_json' in imageData && imageData.b64_json) {
    return imageData.b64_json;
  }
  
  if ('url' in imageData && imageData.url) {
    const imgResponse = await fetch(imageData.url);
    if (!imgResponse.ok) {
      throw new Error(`Failed to fetch image: ${imgResponse.status}`);
    }
    const arrayBuffer = await imgResponse.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  }
  
  throw new Error('Unknown response format from OpenAI');
}

/**
 * Wait for style anchor
 */
async function waitForStyleAnchor(bookId: string, maxAttempts = 15): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const anchor = styleAnchors.get(bookId);
    if (anchor) {
      return anchor;
    }
    
    if (attempt === 0) {
      console.log(`Waiting for style anchor for book ${bookId}...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return null;
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
 * DELETE - Clean up
 */
export async function DELETE() {
  try {
    jobs.clear();
    styleAnchors.clear();
    characterReferences.clear();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cleaned up temporary data'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}