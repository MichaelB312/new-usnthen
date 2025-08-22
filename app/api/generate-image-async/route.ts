// app/api/generate-image-async/route.ts
/**
 * Enhanced Image Generation with Multi-Reference Character Support
 * 
 * FLOW:
 * 1. Page 1: Creates style anchor with first character reference
 * 2. Pages 2+: Uses style anchor + character-specific identity anchors
 * 3. Explicit mapping tells model which reference is which character
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { PersonId, CastMember, UploadedPhoto, selectImageReferences } from '@/lib/store/bookStore';

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

// Character identity anchors storage
const identityAnchors = new Map<string, Map<PersonId, string>>(); // bookId -> personId -> anchorUrl

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
 * Build character-aware prompt with explicit reference mapping
 */
function buildCharacterAwarePrompt(
  pageData: any,
  style: string,
  referenceMapping: { index: number; type: 'style' | 'identity' | 'group'; character?: PersonId; description: string }[]
): string {
  const styleMap: Record<string, string> = {
    wondrous: 'soft watercolor illustration, pastel colors, dreamy atmosphere',
    crayon: 'crayon drawing style, waxy texture, bold colors, hand-drawn feel',
    vintage: 'vintage children\'s book illustration, muted colors, nostalgic'
  };
  
  // Build reference mapping description
  const refDescription = referenceMapping.map(ref => {
    if (ref.type === 'style') {
      return `image[${ref.index}] = STYLE ANCHOR (lock palette, line, texture)`;
    } else if (ref.type === 'identity') {
      return `image[${ref.index}] = ${ref.character} identity anchor`;
    } else if (ref.type === 'group') {
      return `image[${ref.index}] = Group composition reference`;
    }
    return '';
  }).join('\n');
  
  // Build character list
  const charactersPresent = pageData.characters_on_page?.join(', ') || 'baby';
  const backgroundExtras = pageData.background_extras?.length 
    ? `Optional background extras: ${pageData.background_extras.join(', ')}. Keep them low prominence, background only.`
    : 'No background extras.';
  
  const prompt = [
    `REFERENCE MAPPING:`,
    refDescription,
    '',
    'STYLE: Match image[0] exactly (palette, line weight, texture).',
    '',
    'IDENTITIES:',
    ...referenceMapping
      .filter(ref => ref.type === 'identity')
      .map(ref => `- ${ref.character} = image[${ref.index}] (preserve exact face, hair, skin tone, eye color, outfit)`),
    '',
    `SCENE (Page ${pageData.page_number}):`,
    `- Characters present: ${charactersPresent}. Do NOT introduce anyone not listed.`,
    `- ${backgroundExtras}`,
    `- Action: ${pageData.visual_action || pageData.action_description || 'interacting'}`,
    `- Camera: ${pageData.camera_prompt || pageData.camera_angle || 'medium shot'}`,
    `- Setting: ${pageData.sensory_details || 'bright, cheerful environment'}`,
    '',
    'RULES:',
    '- Composition: single frame, no text on canvas',
    '- Keep consistent outfits per identity anchors',
    '- Baby/toddler must be smaller than adults',
    '- Natural lighting, picture book for ages 0-3',
    '- No text or labels in the image',
    '',
    referenceMapping.some(ref => ref.type === 'group') 
      ? 'If provided, use the group photo reference for relative scale and spacing, but keep art style locked to image[0].'
      : ''
  ].filter(line => line !== undefined).join('\n');
  
  console.log('Generated character-aware prompt:', prompt);
  return prompt;
}

/**
 * Convert base64 images to files for OpenAI
 */
async function prepareImageFiles(imageUrls: string[]): Promise<any[]> {
  const files = [];
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB max per image for gpt-image-1
  const MAX_IMAGES = 16; // Maximum 16 images for gpt-image-1
  
  // Filter out invalid URLs
  const validUrls = imageUrls.filter(url => url && url.length > 0);
  
  if (validUrls.length === 0) {
    throw new Error('No valid image URLs provided');
  }
  
  if (validUrls.length > MAX_IMAGES) {
    console.warn(`Attempting to send ${validUrls.length} images, but gpt-image-1 only supports up to ${MAX_IMAGES}`);
    throw new Error(`Too many reference images: ${validUrls.length} (max ${MAX_IMAGES})`);
  }
  
  for (let i = 0; i < validUrls.length; i++) {
    const url = validUrls[i];
    let buffer: Buffer;
    
    try {
      if (url.startsWith('data:')) {
        // Base64 image
        const base64 = url.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64, 'base64');
      } else if (url.startsWith('http')) {
        // Fetch from URL
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        // Assume it's already base64
        buffer = Buffer.from(url, 'base64');
      }
      
      // Check size
      if (buffer.length > MAX_SIZE) {
        console.warn(`Image ${i} is ${(buffer.length / 1024 / 1024).toFixed(2)}MB, which exceeds the 50MB limit`);
        throw new Error(`Image ${i} exceeds 50MB size limit`);
      }
      
      const file = await toFile(buffer, `ref_${i}.png`, { type: 'image/png' });
      files.push(file);
    } catch (error) {
      console.error(`Failed to prepare image ${i}:`, error);
      throw new Error(`Failed to prepare image ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log(`Prepared ${files.length} image files for OpenAI`);
  return files;
}

/**
 * POST - Start image generation job with character management
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      bookId, 
      pageNumber, 
      babyPhotoUrl,
      pageData, 
      style,
      cast,           // New: cast member data
      uploadedPhotos, // New: all uploaded photos with character tags
      identityAnchors: providedAnchors // New: pre-generated identity anchors
    } = body;
    
    // Validate required fields
if (!bookId || !pageNumber || !pageData) {
  console.error('400 generate-image-async: missing fields', {
    hasBookId: !!bookId,
    pageNumber,
    hasPageData: !!pageData,
  });
  return NextResponse.json(
    { success: false, error: 'Missing required fields: bookId, pageNumber, or pageData' },
    { status: 400 }
  );
}
    
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
    processImageGenerationWithCharacters(jobId, body).catch(error => {
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
 * Process image generation with character management
 */
async function processImageGenerationWithCharacters(jobId: string, params: any) {
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
      style,
      cast = {} as Partial<Record<PersonId, CastMember>>, // Updated type
      uploadedPhotos = [],
      identityAnchors: providedAnchors = {}
    } = params;
    
    console.log(`[Job ${jobId}] Page ${pageNumber}, Characters: ${pageData.characters_on_page?.join(', ')}`);
    console.log(`[Job ${jobId}] Received ${uploadedPhotos?.length || 0} uploaded photos`);
    console.log(`[Job ${jobId}] Cast members: ${Object.keys(cast || {}).join(', ')}`);
    
    let imageBase64: string;
    let referenceMapping: any[] = [];
    
    if (pageNumber === 1) {
      // PAGE 1: Create style anchor with initial character
      
      // Prepare references for Page 1
      const references: string[] = [];
      
      // Use baby photo as base if available
      if (babyPhotoUrl) {
        references.push(babyPhotoUrl);
        referenceMapping.push({ 
          index: 0, 
          type: 'identity', 
          character: 'baby',
          description: 'Baby photo for style creation'
        });
      } else {
        throw new Error('No baby photo provided for Page 1 generation');
      }
      
      // Add any other character photos for Page 1
      for (const character of pageData.characters_on_page || ['baby']) {
        if (character !== 'baby') {
          const photo = uploadedPhotos.find((p: UploadedPhoto) => 
            p.people.includes(character as PersonId)
          );
          if (photo) {
            references.push(photo.fileUrl);
            referenceMapping.push({
              index: references.length - 1,
              type: 'identity',
              character,
              description: `${character} reference`
            });
          }
        }
      }
      
      // Generate Page 1 with character references
      const prompt = buildCharacterAwarePrompt(pageData, style, [
        { index: 0, type: 'style', description: 'Creating initial style' },
        ...referenceMapping.slice(1)
      ]);
      
      console.log(`[Job ${jobId}] Preparing ${references.length} reference images for Page 1`);
      const imageFiles = await prepareImageFiles(references);
      
      // Call OpenAI with all reference images
      // IMPORTANT: Remove response_format for gpt-image-1
      let response;
      try {
        response = await openai.images.edit({
  model: 'gpt-image-1',
  image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
  prompt,
  n: 1,
  size: '1024x1024',
  quality: 'high',
  input_fidelity: 'high',
  background: 'transparent',
  // @ts-expect-error: moderation exists for gpt-image-1 edits but isn't in this SDK's types yet
moderation: 'low',

});
      } catch (apiError: any) {
        console.error(`[Job ${jobId}] OpenAI API error (Page 1):`, apiError);
        
        // Log more details about the error
        if (apiError.response) {
          console.error(`[Job ${jobId}] Response status:`, apiError.response.status);
          console.error(`[Job ${jobId}] Response data:`, apiError.response.data);
        }
        if (apiError.error) {
          console.error(`[Job ${jobId}] Error details:`, apiError.error);
        }
        
        // Extract meaningful error message
        let errorMessage = 'OpenAI API error';
        if (apiError.response?.data?.error?.message) {
          errorMessage = apiError.response.data.error.message;
        } else if (apiError.message) {
          errorMessage = apiError.message;
        }
        
        throw new Error(errorMessage);
      }
      
      // Handle response
      imageBase64 = await handleOpenAIResponse(response);
      
      // Store as style anchor
      styleAnchors.set(bookId, imageBase64);
      
      // Also store any identity anchors if this is a solo shot
      if (pageData.characters_on_page?.length === 1) {
        const charId = pageData.characters_on_page[0] as PersonId;
        if (!identityAnchors.has(bookId)) {
          identityAnchors.set(bookId, new Map());
        }
        identityAnchors.get(bookId)!.set(charId, imageBase64);
      }
      
      console.log(`[Job ${jobId}] Created style anchor for book ${bookId}`);
      
    } else {
      // PAGES 2+: Use style anchor + character identity anchors
      
      // Wait for style anchor
      const styleAnchor = await waitForStyleAnchor(bookId);
      if (!styleAnchor) {
        throw new Error('Style anchor from Page 1 not available');
      }
      
      // Build reference array (filter out any undefined/empty values)
      const references: string[] = [];
      referenceMapping = [];
      
      // Always start with style anchor
      if (styleAnchor) {
        references.push(styleAnchor);
        referenceMapping.push({ 
          index: 0, 
          type: 'style',
          description: 'Style anchor from Page 1'
        });
      } else {
        throw new Error('Style anchor not available for page 2+ generation');
      }
      
      // Add identity anchors for each character
      const bookAnchors = identityAnchors.get(bookId) || new Map();
      
      for (const character of pageData.characters_on_page || []) {
        const charId = character as PersonId;
        
        // Check for pre-generated identity anchor
        let anchor = providedAnchors[charId] || bookAnchors.get(charId);
        
        // Fallback to uploaded photo
        if (!anchor) {
          const photo = uploadedPhotos.find((p: UploadedPhoto) => 
            p.people.includes(charId) && p.is_identity_anchor
          );
          if (photo) {
            anchor = photo.fileUrl;
          }
        }
        
        // Last resort: any photo with this character
        if (!anchor) {
          const photo = uploadedPhotos.find((p: UploadedPhoto) => 
            p.people.includes(charId)
          );
          if (photo) {
            anchor = photo.fileUrl;
          }
        }
        
        if (anchor) {
          references.push(anchor);
          referenceMapping.push({
            index: references.length - 1,
            type: 'identity',
            character: charId,
            description: `${charId} identity anchor`
          });
        }
      }
      
      // Look for exact-match group photo
      const wantedSet = [...(pageData.characters_on_page || [])].sort().join('|');
      const groupPhoto = uploadedPhotos.find((p: UploadedPhoto) => 
        p.is_group_photo && 
        [...p.people].sort().join('|') === wantedSet
      );
      
      if (groupPhoto) {
        references.push(groupPhoto.fileUrl);
        referenceMapping.push({
          index: references.length - 1,
          type: 'group',
          description: 'Group composition reference'
        });
      }
      
      // Build prompt with explicit mapping
      const prompt = buildCharacterAwarePrompt(pageData, style, referenceMapping);
      
      // Prepare ALL reference images as files
      console.log(`[Job ${jobId}] Preparing ${references.length} reference images for Page ${pageNumber}`);
      const imageFiles = await prepareImageFiles(references);
      
      // Call OpenAI with ALL reference images
      // IMPORTANT: Remove response_format for gpt-image-1
      let response;
      try {
        response = await openai.images.edit({
  model: 'gpt-image-1',
  image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
  prompt,
  n: 1,
  size: '1024x1024',
  quality: 'high',
  input_fidelity: 'high',
  background: 'transparent',
  // @ts-expect-error: moderation exists for gpt-image-1 edits but isn't in this SDK's types yet
moderation: 'low',

});
      } catch (apiError: any) {
        console.error(`[Job ${jobId}] OpenAI API error (Page 2+):`, apiError);
        
        // Log more details about the error
        if (apiError.response) {
          console.error(`[Job ${jobId}] Response status:`, apiError.response.status);
          console.error(`[Job ${jobId}] Response data:`, apiError.response.data);
        }
        if (apiError.error) {
          console.error(`[Job ${jobId}] Error details:`, apiError.error);
        }
        
        // Extract meaningful error message
        let errorMessage = 'OpenAI API error';
        if (apiError.response?.data?.error?.message) {
          errorMessage = apiError.response.data.error.message;
        } else if (apiError.message) {
          errorMessage = apiError.message;
        }
        
        throw new Error(errorMessage);
      }
      
      imageBase64 = await handleOpenAIResponse(response);
      
      // If this page has a single character, store as potential identity anchor
      if (pageData.characters_on_page?.length === 1) {
        const charId = pageData.characters_on_page[0] as PersonId;
        if (!bookAnchors.has(charId)) {
          bookAnchors.set(charId, imageBase64);
        }
      }
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
      characters_on_page: pageData.characters_on_page,
      reference_count: referenceMapping.length,
      elapsed_ms: Date.now() - job.startedAt
    };
    
    console.log(`[Job ${jobId}] Completed with ${referenceMapping.length} references`);
    
  } catch (error: any) {
    console.error(`[Job ${jobId}] Failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = Date.now();
  }
}

/**
 * Handle OpenAI response format variations
 * gpt-image-1 always returns base64, but the SDK might return URLs
 */
async function handleOpenAIResponse(response: any): Promise<string> {
  if (!response.data || !response.data[0]) {
    throw new Error('No image data in response');
  }
  
  const imageData = response.data[0];
  
  // Check for base64 response (what gpt-image-1 should return)
  if ('b64_json' in imageData && imageData.b64_json) {
    console.log('Got base64 response directly');
    return imageData.b64_json;
  }
  
  // Handle URL response (SDK might do this even for gpt-image-1)
  if ('url' in imageData && imageData.url) {
    console.log('Got URL response (SDK behavior), fetching image...');
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
 * Wait for style anchor to be available
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
 * DELETE - Clean up temporary data
 */
export async function DELETE() {
  try {
    jobs.clear();
    styleAnchors.clear();
    identityAnchors.clear();
    
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