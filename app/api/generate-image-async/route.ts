// app/api/generate-image-async/route.ts
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
  buildIsolatedScenePrompt,
  enhanceWithIsolatedPaperCollage,
  getGenderDescription,
  extractSurface,
  extractProps
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
 * Build Isolated Paper Collage prompt with white/transparent background
 */
function buildEnhancedIsolatedPrompt(
  pageData: any,
  pageNumber: number,
  babyGender: 'boy' | 'girl' | 'neutral'
): string {
  // Determine the best isolated shot
  const shotId = pageData.shot_id || selectBestShot(
    pageData.visual_action || pageData.action_description,
    pageData.emotion,
    pageData.visual_focus,
    pageData.scene_type as 'opening' | 'action' | 'closing'
  );
  
  // Build isolated scene prompt
  const scenePrompt = buildIsolatedScenePrompt({
    action: pageData.visual_action || pageData.action_description || 'sitting',
    narration: pageData.narration || '',
    mood: pageData.emotion || 'peaceful',
    characters: [{ type: 'baby', gender: babyGender }]
  });
  
  // Extract surface and props from narration
  const surface = extractSurface(pageData.narration || '');
  const props = extractProps(pageData.narration || '');
  
  // Build comprehensive isolated prompt - emphasize isolated subject
  let fullPrompt = 'CRITICAL: CREATE ISOLATED CHARACTER ON WHITE/TRANSPARENT BACKGROUND\n';
  fullPrompt += 'ISOLATED SUBJECT ONLY, NO SCENERY, NO SKY, NO BACKGROUND ELEMENTS, NO ENVIRONMENT\n';
  fullPrompt += 'PRODUCT PHOTOGRAPHY STYLE - SUBJECT ON CLEAN WHITE OR TRANSPARENT BACKGROUND\n\n';
  
  fullPrompt += scenePrompt + '\n\n';
  
  // Add specific shot guidance
  const shot = CINEMATIC_SHOTS[shotId];
  if (shot) {
    fullPrompt += `Shot type: ${shot.isolation_prompt}\n`;
  }
  
  // Add surface and props
  fullPrompt += `Surface: ${surface}\n`;
  if (props.length > 0) {
    fullPrompt += `Props: ${props.join(', ')}\n`;
  }
  
  // Strict isolation rules
  fullPrompt += '\nSTRICT ISOLATION RULES:\n';
  fullPrompt += '1. Character must be ISOLATED on WHITE or TRANSPARENT background\n';
  fullPrompt += '2. Only show minimal ground/surface texture directly under character feet/body\n';
  fullPrompt += '3. NO environmental elements, NO scenery, NO sky, NO background objects\n';
  fullPrompt += '4. Paper collage cutout style with visible paper texture on character only\n';
  fullPrompt += '5. Studio product photography style - clean isolated subject\n';
  fullPrompt += '6. Character centered in frame with empty space around\n';
  fullPrompt += '7. ' + (babyGender === 'girl' ? 'Clearly a paper cutout baby girl' : babyGender === 'boy' ? 'Obviously a paper cutout baby boy' : 'Adorable paper cutout baby') + '\n';
  fullPrompt += '8. BACKGROUND MUST BE EMPTY - white or transparent, no details\n';
  fullPrompt += '9. Surface indication should be minimal - just a thin line or small patch under character\n';
  
  // Special instructions for page 1
  if (pageNumber === 1) {
    fullPrompt += '\nPAGE 1: Establish the isolated paper cutout style on clean background for consistency';
  } else {
    fullPrompt += '\nMATCH STYLE: Continue the isolated paper cutout style on clean background from page 1';
  }
  
  console.log(`[Page ${pageNumber}] Isolated prompt for ${babyGender} baby:`, fullPrompt);
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
 * Get ONE best reference for a character
 */
function getOneCharacterReference(
  characterId: PersonId,
  uploadedPhotos: UploadedPhoto[],
  bookId: string
): string | null {
  const bookCache = characterReferences.get(bookId);
  if (bookCache?.has(characterId)) {
    return bookCache.get(characterId)!;
  }
  
  let bestPhoto: string | null = null;
  
  const soloPhoto = uploadedPhotos.find(p => 
    p.people.length === 1 && p.people[0] === characterId
  );
  if (soloPhoto) {
    bestPhoto = soloPhoto.fileUrl;
  } else {
    const photosWithChar = uploadedPhotos
      .filter(p => p.people.includes(characterId))
      .sort((a, b) => a.people.length - b.people.length);
    
    if (photosWithChar.length > 0) {
      bestPhoto = photosWithChar[0].fileUrl;
    }
  }
  
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
    
    const babyGender = babyProfile?.gender || 'neutral';
    
    const jobId = `${bookId}-${pageNumber}-${Date.now()}`;
    
    jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      progress: 0,
      startedAt: Date.now()
    });
    
    processIsolatedImageGeneration(jobId, { ...body, babyGender }).catch(error => {
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
      message: 'Isolated Paper Collage image generation started'
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
 * Process isolated image generation
 */
async function processIsolatedImageGeneration(jobId: string, params: any) {
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
    
    console.log(`[Job ${jobId}] Page ${pageNumber}, Isolated ${babyGender} baby`);
    
    let imageFiles: any[] = [];
    let prompt: string;
    
    if (pageNumber === 1) {
      let babyReference = babyPhotoUrl;
      if (!babyReference && uploadedPhotos.length > 0) {
        babyReference = getOneCharacterReference('baby', uploadedPhotos, bookId);
      }
      
      if (!babyReference) {
        throw new Error('No baby photo provided for Page 1');
      }
      
      console.log(`[Job ${jobId}] Page 1: Creating Isolated Paper Collage style anchor`);
      
      const babyFile = await prepareImageFile(babyReference, 'baby.png');
      imageFiles = [babyFile];
      
      prompt = buildEnhancedIsolatedPrompt(pageData, 1, babyGender);
      
    } else {
      const styleAnchor = await waitForStyleAnchor(bookId);
      if (!styleAnchor) {
        throw new Error('Style anchor not available. Please generate Page 1 first.');
      }
      
      const references: { url: string; name: string }[] = [];
      references.push({ url: styleAnchor, name: 'style.png' });
      
      const uniqueCharacters = new Set(pageData.characters_on_page || []);
      
      for (const characterId of uniqueCharacters) {
        if (references.length >= 4) break;
        
        const charRef = getOneCharacterReference(characterId as PersonId, uploadedPhotos, bookId);
        if (charRef) {
          references.push({ 
            url: charRef, 
            name: `${characterId}.png` 
          });
        }
      }
      
      console.log(`[Job ${jobId}] Page ${pageNumber}: Isolated style with ${references.length} refs`);
      
      imageFiles = await Promise.all(
        references.map(ref => prepareImageFile(ref.url, ref.name))
      );
      
      prompt = buildEnhancedIsolatedPrompt(pageData, pageNumber, babyGender);
    }
    
    job.progress = 30;
    
    console.log(`[Job ${jobId}] Calling OpenAI with Isolated Paper Collage prompt`);
    
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
      console.log(`[Job ${jobId}] Isolated style anchor created for book ${bookId}`);
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
      style: 'isolated-paper-collage',
      gender: babyGender,
      shot_id: pageData.shot_id,
      characters_on_page: pageData.characters_on_page,
      reference_count: imageFiles.length,
      elapsed_ms: Date.now() - job.startedAt
    };
    
    console.log(`[Job ${jobId}] Completed with Isolated Paper Collage style`);
    
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
      console.log(`Waiting for Isolated Paper Collage style anchor for book ${bookId}...`);
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