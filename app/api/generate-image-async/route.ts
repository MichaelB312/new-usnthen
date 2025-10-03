// app/api/generate-image-async/route.ts
/**
 * Enhanced image generation with High-Contrast Shots
 * Handles both character and character-free pages
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { PersonId, CastMember, UploadedPhoto, Page } from '@/lib/store/bookStore';
import { HIGH_CONTRAST_SHOTS, buildHighContrastPrompt } from '@/lib/camera/highContrastShots';
import { enhanceWithIsolatedPaperCollage, getGenderDescription } from '@/lib/styles/paperCollage';
import { buildLandscapePagePrompt } from '@/lib/prompts/landscapePagePrompt';

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
  startTime: number;
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
    if (job.startTime < oneHourAgo) {
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

/**
 * Build High-Contrast Paper Collage prompt
 */
// app/api/generate-image-async/route.ts
// Update the buildEnhancedHighContrastPrompt function
function buildEnhancedHighContrastPrompt(
  pageData: any,
  pageNumber: number,
  babyGender: 'boy' | 'girl' | 'neutral',
  babyName?: string,
  allPages?: Page[]
): string {
  // Check if we have landscape page metadata (simple: page number directly maps to array index)
  console.log(`[buildPrompt] Page ${pageNumber}: Checking for metadata...`);
  console.log(`[buildPrompt] Has spread_metadata: ${!!pageData.spread_metadata}`);

  if (pageData.spread_metadata && babyName) {
    console.log(`[buildPrompt] ✅ Using SIMPLIFIED LANDSCAPE PROMPT for Page ${pageNumber}`);
    console.log(`[buildPrompt] Setting: ${pageData.spread_metadata.setting}, Action: ${pageData.spread_metadata.action}`);

    // Simple! Just use the page data directly (no merging, no complex logic)
    return buildLandscapePagePrompt(pageData);
  }

  console.log(`[buildPrompt] ⚠️  Falling back to generic HIGH CONTRAST prompt for Page ${pageNumber}`);

  // Fallback to original prompt builder
  const shotId = pageData.shot_id || 'establishing_wide';
  const shot = HIGH_CONTRAST_SHOTS[shotId];

  if (!shot) {
    console.error(`Unknown shot ID: ${shotId}`);
    return 'Paper collage cutout on pure white background';
  }

  // Check if this is a character-free page
  const isCharacterFree = !shot.requires_character || pageData.is_character_free;

  if (isCharacterFree) {
    // CHARACTER-FREE PAGE - Make it relate to the story!
    let prompt = 'CRITICAL: NO PEOPLE, NO CHARACTERS IN THIS IMAGE\n';
    prompt += shot.base_prompt + '\n';
    prompt += shot.isolation_prompt + '\n';
    
    // Extract objects and themes from the narration
    const narration = pageData.narration?.toLowerCase() || '';
    
    // Extract specific objects mentioned in the narration
    const objectKeywords = [
      'ball', 'duck', 'toy', 'blanket', 'bottle', 'shoe', 'hat', 'book',
      'flower', 'shell', 'teddy', 'bear', 'blocks', 'cup', 'spoon',
      'bubbles', 'balloon', 'sand', 'water', 'grass', 'leaves', 'sun',
      'moon', 'stars', 'cloud', 'tree', 'bird', 'butterfly', 'fish',
      'car', 'train', 'boat', 'kite', 'drum', 'guitar', 'piano'
    ];
    
    const foundObjects = objectKeywords.filter(obj => narration.includes(obj));
    
    if (foundObjects.length > 0) {
      // Use the specific object from the story
      prompt += `Focus on: paper collage ${foundObjects[0]}\n`;
      prompt += `This ${foundObjects[0]} is central to the story moment\n`;
    } else if (pageData.object_focus) {
      prompt += `Focus on: paper collage ${pageData.object_focus}\n`;
    } else {
      // Extract theme from narration
      if (narration.includes('sleep') || narration.includes('night')) {
        prompt += 'Focus on: paper collage moon and stars\n';
      } else if (narration.includes('play') || narration.includes('fun')) {
        prompt += 'Focus on: paper collage colorful toy\n';
      } else if (narration.includes('eat') || narration.includes('food')) {
        prompt += 'Focus on: paper collage bowl and spoon\n';
      } else if (narration.includes('outside') || narration.includes('garden')) {
        prompt += 'Focus on: paper collage flower or butterfly\n';
      } else {
        prompt += 'Focus on: paper collage toy or decorative element\n';
      }
    }
    
    // Add emotional context from the narration
    if (narration.includes('quiet') || narration.includes('peaceful')) {
      prompt += 'Soft, calm paper colors, gentle arrangement\n';
    } else if (narration.includes('excit') || narration.includes('joy')) {
      prompt += 'Bright, vibrant paper colors, dynamic arrangement\n';
    }
    
    prompt += 'Paper collage style object, clean white background\n';
    prompt += 'Torn paper edges, layered paper texture\n';

    return prompt;
  }

  // CHARACTER PAGE - Include story context
  const prompt = buildHighContrastPrompt(shotId, {
    includeCharacter: true,
    action: pageData.visual_action || pageData.action_description,
    emotion: pageData.emotion,
    gender: babyGender,
    narration: pageData.narration
  });

  // Add story-specific details
  let enhancedPrompt = prompt + '\n';
  
  // Add specific actions from narration
  const narration = pageData.narration?.toLowerCase() || '';
  
  // Action extraction
  if (narration.includes('crawl')) {
    enhancedPrompt += 'Baby crawling on hands and knees\n';
  } else if (narration.includes('reach')) {
    enhancedPrompt += 'Baby reaching with arms extended\n';
  } else if (narration.includes('laugh') || narration.includes('giggl')) {
    enhancedPrompt += 'Baby laughing joyfully with open mouth\n';
  } else if (narration.includes('sleep') || narration.includes('rest')) {
    enhancedPrompt += 'Baby peacefully sleeping or resting\n';
  } else if (narration.includes('play')) {
    enhancedPrompt += 'Baby actively playing\n';
  } else if (narration.includes('eat') || narration.includes('food')) {
    enhancedPrompt += 'Baby eating or holding food\n';
  } else if (narration.includes('walk') || narration.includes('step')) {
    enhancedPrompt += 'Baby taking steps or walking\n';
  } else if (narration.includes('sit')) {
    enhancedPrompt += 'Baby sitting up\n';
  }
  
  // Add props mentioned in narration
  const props = [];
  const propKeywords = ['ball', 'toy', 'blanket', 'teddy', 'bear', 'bottle', 'book', 'blocks'];
  for (const prop of propKeywords) {
    if (narration.includes(prop)) {
      props.push(`paper collage ${prop}`);
    }
  }
  if (props.length > 0) {
    enhancedPrompt += `Including: ${props.join(', ')}\n`;
  }
  
  // Add emotional expression based on narration
  if (narration.includes('happy') || narration.includes('joy')) {
    enhancedPrompt += 'Expression: big smile, bright eyes\n';
  } else if (narration.includes('curious') || narration.includes('wonder')) {
    enhancedPrompt += 'Expression: wide eyes, curious look\n';
  } else if (narration.includes('surprise')) {
    enhancedPrompt += 'Expression: surprised, mouth open\n';
  } else if (narration.includes('peaceful') || narration.includes('calm')) {
    enhancedPrompt += 'Expression: peaceful, content\n';
  }
  
  // Add paper collage style
  enhancedPrompt = enhanceWithIsolatedPaperCollage(enhancedPrompt, babyGender);
  
  return enhancedPrompt;
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
    const { bookId, pageNumber, pageData: page, babyProfile, cast, allPages } = body;

    if (!bookId || pageNumber === undefined || pageNumber === null || !page) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Enhance pageData with all story context
    const pageData = {
      ...page,
      narration: page.narration,  // CRITICAL: Include the actual story text
      shot_id: page.shot_id,
      shot_description: page.shot_description,
      camera_angle: page.camera_angle,
      camera_prompt: page.camera_prompt,
      visual_action: page.visual_action || page.action_description,
      action_label: page.action_label,
      sensory_details: page.sensory_details,
      emotion: page.emotion,
      visual_focus: page.visual_focus,
      scene_type: page.scene_type,
      characters_on_page: page.characters_on_page,
      background_extras: page.background_extras,
      // Add any story-specific details
      object_focus: page.object_focus,
      page_goal: page.page_goal,
      spread_metadata: page.spread_metadata  // Include spread metadata
    };

    const babyGender = babyProfile?.gender || 'neutral';
    const shotId = pageData.shot_id || 'establishing_wide';
    const shot = HIGH_CONTRAST_SHOTS[shotId];
    const isCharacterFree = pageNumber === 1
      ? false  // Force Page 1 to always have character
      : (!shot?.requires_character || pageData.is_character_free);

    const jobId = `${bookId}-${pageNumber}-${Date.now()}`;
    jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      progress: 0,
      startTime: Date.now()
    });

    console.log(`[Job ${jobId}] Page ${pageNumber}, ${isCharacterFree ? 'Character-free' : 'Character'} ${babyGender} shot: ${pageData.shot_id}`);

    // Pass the enhanced payload with all story context
    const payload: any = {
      bookId,
      pageNumber,
      babyProfile,
      pageData,
      cast: cast,
      babyGender,
      isCharacterFree,
      allPages: allPages,  // Pass all pages for spread context
      ...body  // Include any other fields from the original body
    };

    processHighContrastImageGeneration(jobId, payload).catch(error => {
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
      message: `High-Contrast ${isCharacterFree ? 'character-free' : 'character'} image generation started`
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
 * Process high-contrast image generation
 */
async function processHighContrastImageGeneration(jobId: string, params: any) {
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
      babyProfile,
      babyGender = 'neutral',
      uploadedPhotos = [],
      cast = {},
      isCharacterFree,
      allPages = []
    } = params;

    const babyName = babyProfile?.baby_name || 'Baby';

    console.log(`[Job ${jobId}] Page ${pageNumber}, ${isCharacterFree ? 'Character-free' : 'Character'} ${babyGender} shot: ${pageData.shot_id}`);

    let imageFiles: any[] = [];
    let prompt: string;

    // SPECIAL: Page 0 = Character Anchor (NOT an actual page)
    if (pageNumber === 0) {
        let babyReference = babyPhotoUrl;
        let babyDescription = params.babyDescription || params.cast?.baby?.features_lock;

        if (!babyReference && uploadedPhotos.length > 0) {
            babyReference = getOneCharacterReference('baby', uploadedPhotos, bookId);
        }

        if (!babyReference && !babyDescription) {
            throw new Error('No baby photo or description provided for character anchor');
        }

        console.log(`[Job ${jobId}] CHARACTER ANCHOR (Page 0): Creating style reference for ${babyGender} baby (NOT a story page)`);

        if (babyReference) {
            const babyFile = await prepareImageFile(babyReference, 'baby.png');
            imageFiles = [babyFile];
        } else {
            const whiteBase = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
            const baseFile = await prepareImageFile(whiteBase, 'white.png');
            imageFiles = [baseFile];
        }

        // Enhanced character anchor prompt - request cute, adorable baby
        const genderText = babyGender === 'boy' ? 'boy' : babyGender === 'girl' ? 'girl' : 'baby';
        prompt = `Paper collage style. 1536×1024 landscape. Full bleed edge-to-edge, no white padding or borders.
Adorable, cute ${genderText} baby with sweet, charming features and lovely expression.
Baby standing or sitting, centered. Use reference image for all character features and appearance.
Paper cutout aesthetic with torn edges. Full bleed composition.`;

        if (!babyReference && babyDescription) {
            prompt += `\n\nBaby character description: ${babyDescription}\n`;
            prompt += 'Create adorable paper collage baby with cute features matching this exact description.\n';
        }

    } else if (isCharacterFree) {
      // CHARACTER-FREE PAGE - No references needed
      console.log(`[Job ${jobId}] Character-free page - no character references`);

      const whiteBase = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const baseFile = await prepareImageFile(whiteBase, 'white.png');
      imageFiles = [baseFile];

      prompt = buildEnhancedHighContrastPrompt(pageData, pageNumber, babyGender, babyName, allPages);

    } else {
      // ALL STORY PAGES (1, 2, 3, etc.) - use character anchor + landscape page prompts
      const styleAnchor = await waitForStyleAnchor(bookId);
      if (!styleAnchor) {
        throw new Error('Style anchor not available. Generate character anchor (page 0) first.');
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

      console.log(`[Job ${jobId}] Page ${pageNumber}: Landscape page scene with ${references.length} refs`);

      imageFiles = await Promise.all(
        references.map(ref => prepareImageFile(ref.url, ref.name))
      );

      // Build landscape spread prompt with full scene details
      prompt = buildEnhancedHighContrastPrompt(pageData, pageNumber, babyGender, babyName, allPages);

      // DO NOT add character descriptions!
      // Character appearance comes from the reference images (anchor + uploaded photos)
      // The prompt should ONLY describe: scene, action, environment, composition
      // This ensures consistent character appearance across all pages
    }

    job.progress = 30;

    console.log(`[Job ${jobId}] ========== GPT IMAGE 1 REQUEST ==========`);
    console.log(`[Job ${jobId}] Page Number: ${pageNumber}`);
    console.log(`[Job ${jobId}] Reference Images Count: ${imageFiles.length}`);
    console.log(`[Job ${jobId}] FULL PROMPT:\n`, prompt);
    console.log(`[Job ${jobId}] ==========================================`);

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
      prompt,
      n: 1,
      size: '1536x1024',  // LANDSCAPE for pages
      quality: 'high',
      input_fidelity: 'high',
      background: 'transparent',
      // @ts-expect-error: moderation exists but not in SDK types
      moderation: 'low',
    });

    job.progress = 80;

    const imageBase64 = await handleOpenAIResponse(response);

    // ALWAYS save page 0 as style anchor (it's the character anchor)
    if (pageNumber === 0) {
      styleAnchors.set(bookId, imageBase64);
      console.log(`[Job ${jobId}] Style anchor created for book ${bookId}`);
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
      style: 'high-contrast-paper-collage',
      gender: babyGender,
      shot_id: pageData.shot_id,
      shot_name: HIGH_CONTRAST_SHOTS[pageData.shot_id]?.name,
      is_character_free: isCharacterFree,
      characters_on_page: isCharacterFree ? [] : pageData.characters_on_page,
      reference_count: imageFiles.length,
      elapsed_ms: Date.now() - job.startTime
    };

    console.log(`[Job ${jobId}] Completed: ${isCharacterFree ? 'Character-free' : 'Character'} ${HIGH_CONTRAST_SHOTS[pageData.shot_id]?.name} shot`);

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
      console.log(`Waiting for High-Contrast style anchor for book ${bookId}...`);
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
        ? job.completedAt - job.startTime
        : Date.now() - job.startTime
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