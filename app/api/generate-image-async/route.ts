// app/api/generate-image-async/route.ts - Paper Collage Style with Gender Awareness
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { PersonId, CastMember, UploadedPhoto } from '@/lib/store/bookStore';
import { 
  CINEMATIC_SHOTS, 
  buildCinematicPrompt, 
  selectBestShot 
} from '@/lib/camera/cinematicShots';
import {
  buildPaperCollagePrompt,
  enhanceWithPaperCollage,
  getGenderDescription,
  PAPER_COLLAGE_ELEMENTS
} from '@/lib/styles/paperCollage';

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

// Character reference cache
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
 * Build Paper Collage prompt with cinematic shot and gender awareness
 */
function buildEnhancedPaperCollagePrompt(
  pageData: any,
  pageNumber: number,
  babyGender: 'boy' | 'girl' | 'neutral'
): string {
  // Determine the best shot based on context
  const shotId = pageData.shot_id || selectBestShot(
    pageData.visual_action || pageData.action_description,
    pageData.emotion,
    pageData.visual_focus,
    pageData.scene_type as 'opening' | 'action' | 'closing'
  );
  
  // Get the cinematic shot details
  const shot = CINEMATIC_SHOTS[shotId];
  let basePrompt = shot ? shot.base_prompt : 'medium shot';
  
  // Add visual action/focus to the base prompt
  if (pageData.visual_action) {
    basePrompt += `, showing ${pageData.visual_action}`;
  }
  if (pageData.visual_focus && shot?.focus_template) {
    basePrompt += `, ${shot.focus_template.replace('{visual_focus}', pageData.visual_focus)}`;
  }
  
  // Build Paper Collage prompt with gender awareness
  const paperCollagePrompt = buildPaperCollagePrompt(
    basePrompt,
    babyGender,
    true // Include character details
  );
  
  // Add specific Paper Collage elements based on scene
  let sceneElements = '';
  
  // Add background elements
  if (pageData.sensory_details) {
    sceneElements += `, ${pageData.sensory_details} created with layered paper cutouts`;
  }
  
  // Add gender-appropriate props
  const props = PAPER_COLLAGE_ELEMENTS.props[babyGender];
  if (props && props.length > 0 && pageData.emotion) {
    const propIndex = pageNumber % props.length;
    sceneElements += `, featuring ${props[propIndex]}`;
  }
  
  // Add emotion-based paper effects
  if (pageData.emotion === 'joy') {
    sceneElements += ', bright colored paper pieces arranged dynamically, paper confetti accents';
  } else if (pageData.emotion === 'peaceful') {
    sceneElements += ', soft pastel paper layers, gentle overlapping, tissue paper clouds';
  } else if (pageData.emotion === 'curious') {
    sceneElements += ', paper pieces at playful angles, pop-up book style depth';
  } else if (pageData.emotion === 'wonder') {
    sceneElements += ', magical paper sparkles, layered paper creating dreamy depth';
  }
  
  // Additional rules for consistency
  const rules = [
    'IMPORTANT: Paper collage art style must be prominent throughout',
    'Each element is a distinct paper cutout with visible texture',
    'Clear gender distinction - ' + (babyGender === 'girl' ? 'obviously a baby girl' : babyGender === 'boy' ? 'clearly a baby boy' : 'adorable baby'),
    'Maintain character consistency across all pages',
    'Torn paper edges and layered depth visible',
    'High contrast suitable for baby vision',
    'No text or labels in the image'
  ];
  
  // Special instructions for page 1 (style anchor)
  if (pageNumber === 1) {
    rules.unshift('CREATE PAPER COLLAGE STYLE: This is page 1 - establish the handcrafted paper cutout aesthetic');
  } else {
    rules.unshift('MATCH PAPER COLLAGE STYLE: Continue the exact paper cutout style from page 1');
  }
  
  const fullPrompt = [
    paperCollagePrompt,
    sceneElements,
    '',
    ...rules
  ].filter(s => s.trim()).join('\n');
  
  console.log(`[Page ${pageNumber}] Paper Collage prompt with ${babyGender} baby:`, fullPrompt);
  return fullPrompt;
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
    const { bookId, pageNumber, pageData, babyProfile } = body;
    
    if (!bookId || !pageNumber || !pageData) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get baby gender from profile
    const babyGender = babyProfile?.gender || 'neutral';
    
    const jobId = `${bookId}-${pageNumber}-${Date.now()}`;
    
    jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      progress: 0,
      startedAt: Date.now()
    });
    
    processOptimalImageGeneration(jobId, { ...body, babyGender }).catch(error => {
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
      message: 'Paper Collage image generation started'
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
 * Process image generation with Paper Collage style and gender awareness
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
      babyGender = 'neutral',
      uploadedPhotos = []
    } = params;
    
    console.log(`[Job ${jobId}] Page ${pageNumber}, Gender: ${babyGender}, Shot: ${pageData.shot_id || 'auto'}`);
    
    let imageFiles: any[] = [];
    let prompt: string;
    
    if (pageNumber === 1) {
      // PAGE 1: Create Paper Collage style anchor with baby photo
      let babyReference = babyPhotoUrl;
      if (!babyReference && uploadedPhotos.length > 0) {
        babyReference = getOneCharacterReference('baby', uploadedPhotos, bookId);
      }
      
      if (!babyReference) {
        throw new Error('No baby photo provided for Page 1');
      }
      
      console.log(`[Job ${jobId}] Page 1: Creating Paper Collage style anchor for ${babyGender} baby`);
      
      const babyFile = await prepareImageFile(babyReference, 'baby.png');
      imageFiles = [babyFile];
      
      prompt = buildEnhancedPaperCollagePrompt(pageData, 1, babyGender);
      
    } else {
      // PAGES 2+: Style anchor + character references
      const styleAnchor = await waitForStyleAnchor(bookId);
      if (!styleAnchor) {
        throw new Error('Style anchor not available. Please generate Page 1 first.');
      }
      
      const references: { url: string; name: string }[] = [];
      references.push({ url: styleAnchor, name: 'style.png' });
      
      // Get UNIQUE characters on this page
      const uniqueCharacters = new Set(pageData.characters_on_page || []);
      
      // Add ONE reference per unique character
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
      
      console.log(`[Job ${jobId}] Page ${pageNumber}: ${uniqueCharacters.size} characters, ${babyGender} baby`);
      
      imageFiles = await Promise.all(
        references.map(ref => prepareImageFile(ref.url, ref.name))
      );
      
      prompt = buildEnhancedPaperCollagePrompt(pageData, pageNumber, babyGender);
    }
    
    job.progress = 30;
    
    // Call OpenAI with Paper Collage prompt
    console.log(`[Job ${jobId}] Calling OpenAI with Paper Collage style for ${babyGender} baby`);
    
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
      console.log(`[Job ${jobId}] Paper Collage style anchor created for book ${bookId}`);
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
      style: 'paper-collage',
      gender: babyGender,
      shot_id: pageData.shot_id,
      characters_on_page: pageData.characters_on_page,
      reference_count: imageFiles.length,
      elapsed_ms: Date.now() - job.startedAt
    };
    
    console.log(`[Job ${jobId}] Completed with Paper Collage style for ${babyGender} baby`);
    
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
      console.log(`Waiting for Paper Collage style anchor for book ${bookId}...`);
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