// app/api/generate-image-async/route.ts
/**
 * 3-Layer Image Generation Pipeline
 * Layer 1: Character cutouts (anchor + variants) via Image Edits
 * Layer 2: Local composition (character + narration rendering)
 * Layer 3: Inpainting (scene details + refinement words)
 *
 * Quality set to "high" for production-quality results
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PersonId, CastMember, UploadedPhoto, Page } from '@/lib/store/bookStore';

// Layer utilities
import {
  generateCharacterPreservationMask,
  getPreserveLevelForAction
} from '@/lib/utils/characterMasks';
import {
  composeSpread,
  getCharacterPosition,
  getCompositionBounds,
  CompositionResult
} from '@/lib/utils/localComposition';
import {
  generateInpaintingMask,
  calculateNarrationBounds,
  getRefinementWordZones
} from '@/lib/utils/inpaintingMasks';
import { processPrintReady } from '@/lib/utils/upscaler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
  maxRetries: 2,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Quality set to high for production results
const IMAGE_QUALITY = 'high' as const;

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

// Style anchor storage (now stores 1024×1024 transparent character)
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
 * Extract refinement word from narration (hidden surprise element)
 * Looks for onomatopoeia, repeated words, or sound effects
 */
function extractRefinementWordFromNarration(narration: string, action: string): string | undefined {
  const lower = narration.toLowerCase();

  // Look for repeated words (like "splash splash" or "giggle giggle")
  const repeatedPattern = /\b(\w+)\s+\1\b/i;
  const match = narration.match(repeatedPattern);
  if (match) {
    return match[0]; // Return the full "word word" pattern
  }

  // Look for onomatopoeia
  if (lower.includes('boom')) return 'boom!';
  if (lower.includes('splash')) return 'splash!';
  if (lower.includes('whoosh')) return 'whoosh!';
  if (lower.includes('giggle')) return 'giggle giggle';
  if (lower.includes('yay')) return 'yay!';
  if (lower.includes('wow')) return 'wow!';
  if (lower.includes('shh') || lower.includes('shhh')) return 'shhhh';
  if (lower.includes('zoom')) return 'zoom!';
  if (lower.includes('pop')) return 'pop!';

  // Don't force a refinement word if it's not natural
  return undefined;
}

/**
 * Analyze action to determine ground level and character interaction with environment
 */
interface ActionAnalysis {
  groundLevel: 'low' | 'medium' | 'high'; // How high ground elements should be placed
  interactionType: 'on' | 'in' | 'near' | 'above'; // How character relates to environment
  primaryElement: string; // Main environmental element (sand, water, grass, floor)
  secondaryElements: string[]; // Supporting elements
}

function analyzeCharacterAction(action: string, setting: string): ActionAnalysis {
  const actionLower = action.toLowerCase();

  // Detect ground level based on action
  let groundLevel: 'low' | 'medium' | 'high' = 'medium';
  let interactionType: 'on' | 'in' | 'near' | 'above' = 'on';

  // Ground level detection
  if (actionLower.includes('sitting') || actionLower.includes('lying') || actionLower.includes('crawling') || actionLower.includes('crouching')) {
    groundLevel = 'high'; // Ground comes up higher when sitting/lying
  } else if (actionLower.includes('jumping') || actionLower.includes('flying') || actionLower.includes('reaching up')) {
    groundLevel = 'low'; // Ground stays lower when jumping/flying
  } else {
    groundLevel = 'medium'; // Standing, walking, etc.
  }

  // Interaction type detection
  if (actionLower.includes('in water') || actionLower.includes('splashing') || actionLower.includes('swimming') || actionLower.includes('in the water')) {
    interactionType = 'in'; // Character is IN the element
  } else if (actionLower.includes('above') || actionLower.includes('jumping') || actionLower.includes('flying')) {
    interactionType = 'above'; // Character is ABOVE the ground
  } else if (actionLower.includes('near') || actionLower.includes('by') || actionLower.includes('at')) {
    interactionType = 'near'; // Character is NEAR the element
  } else {
    interactionType = 'on'; // Character is ON the ground
  }

  // Setting-based element selection
  const settingLower = setting.toLowerCase();
  let primaryElement = 'ground';
  let secondaryElements: string[] = [];

  if (settingLower.includes('beach') || settingLower.includes('ocean') || settingLower.includes('sea')) {
    if (interactionType === 'in') {
      primaryElement = 'water with small waves';
      secondaryElements = ['foam', 'splashes', 'droplets'];
    } else {
      primaryElement = 'sandy beach';
      secondaryElements = ['small shells', 'starfish', 'seagulls in sky'];
    }
  } else if (settingLower.includes('park') || settingLower.includes('garden') || settingLower.includes('outside') || settingLower.includes('outdoor')) {
    primaryElement = 'grass';
    secondaryElements = ['flowers', 'butterflies', 'small trees or bushes'];
  } else if (settingLower.includes('pool') || settingLower.includes('water')) {
    if (interactionType === 'in') {
      primaryElement = 'pool water';
      secondaryElements = ['splashes', 'ripples', 'water droplets'];
    } else {
      primaryElement = 'pool edge';
      secondaryElements = ['water visible', 'pool toys'];
    }
  } else if (settingLower.includes('home') || settingLower.includes('room') || settingLower.includes('house') || settingLower.includes('indoor')) {
    primaryElement = 'floor';
    secondaryElements = ['wallpaper pattern at edges', 'small toys', 'rug or mat'];
  } else if (settingLower.includes('backyard')) {
    primaryElement = 'grass or patio';
    secondaryElements = ['fence elements', 'garden items', 'trees'];
  } else {
    // Generic outdoor
    primaryElement = 'natural ground';
    secondaryElements = ['sky elements', 'small decorative nature items'];
  }

  return {
    groundLevel,
    interactionType,
    primaryElement,
    secondaryElements
  };
}

/**
 * Build context-aware scene prompt based on action analysis and character position
 */
function buildContextAwareScenePrompt(
  action: string,
  setting: string,
  characterPosition: 'left' | 'right',
  narration: string
): string {
  const analysis = analyzeCharacterAction(action, setting);

  let prompt = `Paper collage style environmental elements (NO characters, NO text edits).

CRITICAL: Add elements that support the action and setting. Keep white background visible.

SETTING: ${setting}
ACTION: ${action}
CHARACTER POSITION: Character is on ${characterPosition} side

ENVIRONMENTAL ELEMENTS:

`;

  // Ground/primary element placement based on ground level and interaction
  if (analysis.interactionType === 'in') {
    // Character is IN the element (water, etc.)
    prompt += `PRIMARY: ${analysis.primaryElement} SURROUNDING character at mid-level (SMALL SCALE)
- Place SMALL ${analysis.primaryElement} elements around and slightly below character
- Suggest immersion WITHOUT overwhelming the composition
- Keep elements light and minimal
- ${analysis.secondaryElements.join(', ')} near character - SMALL decorative pieces only
`;
  } else if (analysis.interactionType === 'on') {
    // Character is ON the ground
    if (analysis.groundLevel === 'high') {
      // Sitting/lying - ground comes up higher
      prompt += `PRIMARY: ${analysis.primaryElement} at MEDIUM-HIGH level - MINIMAL coverage (character is sitting/lying on it)
- Place THIN LAYER of ${analysis.primaryElement} from BOTTOM up to mid-lower area
- Suggest character resting ON ${analysis.primaryElement} without heavy coverage
- Keep it light and airy, not dense
- ${analysis.secondaryElements.join(', ')} scattered around - 2-3 small pieces maximum
`;
    } else if (analysis.groundLevel === 'low') {
      // Jumping/flying - ground stays lower
      prompt += `PRIMARY: ${analysis.primaryElement} at BOTTOM level ONLY - MINIMAL strip (character is above it)
- Place NARROW STRIP of ${analysis.primaryElement} at very BOTTOM of composition
- Keep clear space between ground and character
- Light and minimal ground indication
- ${analysis.secondaryElements.join(', ')} at ground level - small accents only
`;
    } else {
      // Standing/walking - medium ground level
      prompt += `PRIMARY: ${analysis.primaryElement} at LOWER-MEDIUM level - LIGHT LAYER (character standing on it)
- Place THIN LAYER of ${analysis.primaryElement} from BOTTOM up to lower third
- Suggest character's feet ON ${analysis.primaryElement} without heavy coverage
- Keep it light and breathable
- ${analysis.secondaryElements.join(', ')} around on ground - small decorative pieces only
`;
    }
  } else if (analysis.interactionType === 'near') {
    // Character is NEAR the element
    prompt += `PRIMARY: ${analysis.primaryElement} ADJACENT to character - SMALL ACCENT (not full coverage)
- Place SMALL SECTION of ${analysis.primaryElement} on opposite side from character
- Light suggestion of proximity, not immersion
- Minimal and tasteful
- ${analysis.secondaryElements.join(', ')} between character and primary element - tiny details only
`;
  } else {
    // Above
    prompt += `PRIMARY: ${analysis.primaryElement} well BELOW character - MINIMAL STRIP at bottom
- Place THIN LINE of ${analysis.primaryElement} at BOTTOM only
- Large open space between ground and character
- Very light and minimal
- ${analysis.secondaryElements.join(', ')} at ground level - small accents
`;
  }

  // Background elements (always at top/edges)
  if (setting.toLowerCase().includes('beach') || setting.toLowerCase().includes('park') || setting.toLowerCase().includes('outdoor') || setting.toLowerCase().includes('garden') || setting.toLowerCase().includes('outside')) {
    prompt += `
BACKGROUND: Sky elements at TOP corners ONLY - MINIMAL
- 1-2 small clouds or soft color accent at very top corners
- Do NOT create full sky - just hint of atmosphere
- Maximum 10-15% coverage at top
- Preserve white space and breathing room
`;
  } else if (setting.toLowerCase().includes('home') || setting.toLowerCase().includes('room') || setting.toLowerCase().includes('indoor')) {
    prompt += `
BACKGROUND: Indoor accents at far edges ONLY - MINIMAL
- Tiny pattern hints at extreme corners
- Do NOT fill sides - just suggest walls
- Keep 80%+ of composition white/clean
- Small decorative items in far corners only
`;
  }

  prompt += `
CRITICAL PLACEMENT RULES:
- Character is on ${characterPosition} side, so place accent elements on opposite side or balanced
- PRESERVE WHITE BACKGROUND: At least 60% of composition MUST remain white/clean
- Elements are SMALL ACCENTS ONLY - think minimalist children's book illustration
- DO NOT fill entire areas - add small decorative pieces, not full coverage
- Soft pastel colors, torn paper edges, gentle and sparse
- If in doubt, add LESS rather than more
- Elements should whisper, not shout

ABSOLUTE PROHIBITIONS (DO NOT DO THESE):
❌ DO NOT create full-page backgrounds
❌ DO NOT fill entire corners or sides with solid colors
❌ DO NOT extend elements beyond specified zones
❌ DO NOT cover white space with texture or patterns
❌ DO NOT create heavy, dense, or overwhelming compositions
❌ DO NOT add elements that touch or overlap the center divider line
❌ DO NOT modify, erase, or paint over existing narration text
❌ DO NOT add background elements inside character panel's center area

MUST DO (REQUIREMENTS):
✓ Keep composition LIGHT and AIRY - lots of breathing room
✓ Elements must be SMALL SCALE decorative accents
✓ Preserve large areas of clean white background
✓ Place elements ONLY in specified narrow zones (60px borders)
✓ Use soft pastel colors with transparency/lightness
✓ Think "a few strategic touches" not "full scene"`;

  return prompt;
}

/**
 * Reactive moderation fix using Gemini
 * Only called when OpenAI moderation actually fails
 */
async function fixModerationIssueWithGemini(originalPrompt: string, context: string): Promise<string> {
  try {
    console.log(`[Gemini Moderation Fix] Attempting to rewrite prompt that triggered moderation`);

    const systemPrompt = `You are a moderation safety expert helping to rewrite AI image generation prompts that triggered false-positive moderation flags.

CONTEXT: This is for an innocent children's book about a baby/toddler. The content is 100% wholesome and family-friendly, but the AI moderation system flagged it incorrectly.

TASK: Rewrite the prompt to preserve the creative intent while removing ANY words that might trigger moderation:
- Replace "bare" + body parts with alternatives (bare feet → tiny feet, bare hands → little hands)
- Replace any clothing state references with neutral descriptions
- Replace any body part close-ups with gentler phrasing
- Keep the same artistic style, composition, and scene description
- Maintain all character details and camera angles

ORIGINAL PROMPT (flagged by moderation):
${originalPrompt}

CONTEXT:
${context}

OUTPUT: Return ONLY the rewritten prompt as plain text. No explanations, no JSON, just the fixed prompt.`;

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.3,
      },
    });

    const rewrittenPrompt = result.response.text().trim();
    console.log(`[Gemini Moderation Fix] Rewritten prompt (${rewrittenPrompt.length} chars)`);
    console.log(`[Gemini Moderation Fix] Original: ${originalPrompt.substring(0, 100)}...`);
    console.log(`[Gemini Moderation Fix] Rewritten: ${rewrittenPrompt.substring(0, 100)}...`);

    return rewrittenPrompt;
  } catch (error: any) {
    console.error('[Gemini Moderation Fix] Failed:', error);
    // Fallback to basic sanitization if Gemini fails
    return sanitizePromptForModeration(originalPrompt);
  }
}

/**
 * Sanitize prompt to avoid false positive moderation flags (fallback)
 */
function sanitizePromptForModeration(prompt: string): string {
  let sanitized = prompt;

  // Replace potentially problematic terms with safe alternatives
  const replacements: [RegExp, string][] = [
    [/\bbare\s+feet\b/gi, 'tiny feet'],
    [/\bbare\s+foot\b/gi, 'tiny foot'],
    [/\bnaked\b/gi, 'unclothed'],
    [/\bbare\s+skin\b/gi, 'soft skin'],
    [/\bbare\s+/gi, 'little '], // Generic "bare" -> "little"
  ];

  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
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
 * Wait for style anchor
 */
async function waitForStyleAnchor(bookId: string, maxAttempts = 15): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const anchor = styleAnchors.get(bookId);
    if (anchor) {
      return anchor;
    }
    if (attempt === 0) {
      console.log(`Waiting for character anchor for book ${bookId}...`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return null;
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

    const pageData = {
      ...page,
      narration: page.narration,
      shot_id: page.shot_id,
      shot_description: page.shot_description,
      visual_action: page.visual_action || page.action_description,
      action_label: page.action_label,
      characters_on_page: page.characters_on_page,
      spread_metadata: page.spread_metadata
    };

    const babyGender = babyProfile?.gender || 'neutral';

    const jobId = `${bookId}-${pageNumber}-${Date.now()}`;
    jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      progress: 0,
      startTime: Date.now()
    });

    console.log(`[Job ${jobId}] Page ${pageNumber} - 3-Layer Pipeline (quality=${IMAGE_QUALITY})`);

    // Pass payload to processing
    const payload: any = {
      bookId,
      pageNumber,
      babyProfile,
      pageData,
      cast: cast,
      babyGender,
      allPages: allPages,
      ...body
    };

    processThreeLayerPipeline(jobId, payload).catch(error => {
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
      message: `3-Layer pipeline started for page ${pageNumber}`
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
 * Process 3-Layer Pipeline
 */
async function processThreeLayerPipeline(jobId: string, params: any) {
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
      cast = {}
    } = params;

    const babyName = babyProfile?.baby_name || 'Baby';

    // ============================================================
    // PAGE 0: CHARACTER ANCHOR (NOT part of 3-layer pipeline)
    // Simple isolated character on transparent background
    // ============================================================
    if (pageNumber === 0) {
      console.log(`[Job ${jobId}] CHARACTER ANCHOR: Generating isolated character (1024×1024 transparent)`);

      let babyReference = babyPhotoUrl;
      let babyDescription = params.babyDescription || params.cast?.baby?.features_lock;

      if (!babyReference && uploadedPhotos.length > 0) {
        babyReference = getOneCharacterReference('baby', uploadedPhotos, bookId);
      }

      if (!babyReference && !babyDescription) {
        throw new Error('No baby photo or description provided for character anchor');
      }

      let imageFiles: any[] = [];

      if (babyReference) {
        const babyFile = await prepareImageFile(babyReference, 'baby.png');
        imageFiles = [babyFile];
      } else {
        // Use white base if only description available
        const whiteBase = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        const baseFile = await prepareImageFile(whiteBase, 'white.png');
        imageFiles = [baseFile];
      }

      // Build anchor prompt
      const genderText = babyGender === 'boy' ? 'boy' : babyGender === 'girl' ? 'girl' : 'baby';
      const genderCharacteristics = babyGender === 'boy'
        ? 'Clear baby boy characteristics. Boyish features, short hair.'
        : babyGender === 'girl'
        ? 'Clear baby girl characteristics. Feminine features, may have bow or headband.'
        : 'Neutral baby characteristics.';

      let prompt = `CHARACTER ANCHOR - Isolated character ONLY on transparent background.

CRITICAL: This is a character cutout template, NOT a scene or composition.

Style: Soft paper collage with gentle torn edges
Size: 1024×1024 square
Background: PURE TRANSPARENT (alpha channel, NO white, NO colors)

Character: Adorable, cute ${genderText} baby
- ${genderCharacteristics}
- Soft face, delicate features, small eyebrows, sweet expression
- Standing or sitting pose, centered in frame
- Full body visible

ABSOLUTE REQUIREMENTS:
✓ ONLY the character - nothing else
✓ Completely isolated cutout with crisp edges
✓ Pure transparent background (no white, no texture, no elements)
✓ NO ground, NO shadows, NO decorative elements
✓ NO text, NO scene objects, NO background colors
✓ Character should be transferable to any background later

Soft pastel colors on character only. Clean paper collage cutout.`;

      if (!babyReference && babyDescription) {
        prompt += `\n\nBaby character description: ${babyDescription}`;
        prompt += '\nCreate adorable paper collage baby matching this exact description.';
      }

      job.progress = 30;

      console.log(`[Job ${jobId}] Calling GPT-Image-1 (quality=${IMAGE_QUALITY})`);
      console.log(`[Job ${jobId}] Prompt:`, prompt);

      let response;
      try {
        response = await openai.images.edit({
          model: 'gpt-image-1',
          image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
          prompt,
          n: 1,
          size: '1024x1024', // SQUARE for character
          quality: IMAGE_QUALITY,
          input_fidelity: 'high',
          background: 'transparent',
          // @ts-expect-error: moderation exists but not in SDK types
          moderation: 'low',
        });
      } catch (error: any) {
        // Retry with Gemini-rewritten prompt if moderation blocked
        if (error.code === 'moderation_blocked') {
          console.log(`[Job ${jobId}] ANCHOR MODERATION BLOCKED - Using Gemini to rewrite prompt`);

          const context = `Creating character anchor for ${babyName} (${babyGender}). 1024×1024 transparent background.`;
          const fixedPrompt = await fixModerationIssueWithGemini(prompt, context);

          response = await openai.images.edit({
            model: 'gpt-image-1',
            image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
            prompt: fixedPrompt,
            n: 1,
            size: '1024x1024',
            quality: IMAGE_QUALITY,
            input_fidelity: 'high',
            background: 'transparent',
            // @ts-expect-error: moderation exists but not in SDK types
            moderation: 'low',
          });
        } else {
          throw error;
        }
      }

      job.progress = 80;

      const imageBase64 = await handleOpenAIResponse(response);

      // Save as style anchor
      const dataUrl = `data:image/png;base64,${imageBase64}`;
      styleAnchors.set(bookId, dataUrl);
      console.log(`[Job ${jobId}] ✅ Character anchor complete - SKIPPING Layer 2 & 3 (anchor is standalone)`);

      job.progress = 100;
      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = {
        page_number: pageNumber,
        dataUrl,
        sizeKB: Math.round(Buffer.from(imageBase64, 'base64').length / 1024),
        style: 'character-anchor', // NOT part of 3-layer pipeline
        gender: babyGender,
        elapsed_ms: Date.now() - job.startTime
      };

      console.log(`[Job ${jobId}] Anchor ready for use in Pages 1-4`);
      return; // EXIT - Pages 1-4 will use 3-layer pipeline
    }

    // ============================================================
    // PAGES 1-4: 3-LAYER PIPELINE (character anchor is already created)
    // Layer 1: Character pose variant (from anchor)
    // Layer 2: Local composition (character + text rendering)
    // Layer 3: Scene inpainting (minimal backgrounds)
    // ============================================================

    // Wait for anchor
    const styleAnchor = await waitForStyleAnchor(bookId);
    if (!styleAnchor) {
      throw new Error('Character anchor not available. Generate page 0 first.');
    }

    console.log(`[Job ${jobId}] ========================================`);
    console.log(`[Job ${jobId}] Page ${pageNumber} - Starting 3-Layer Pipeline`);
    console.log(`[Job ${jobId}] ========================================`);

    // -------------------- LAYER 1: Character Variant --------------------
    console.log(`[Job ${jobId}] LAYER 1: Creating character variant from anchor`);

    const preserveLevel = getPreserveLevelForAction(pageData.visual_action || pageData.action_label);
    const preservationMask = generateCharacterPreservationMask(preserveLevel);

    // Collect ALL character references for this page
    const charactersOnPage = pageData.characters_on_page || [];
    const imageFiles: any[] = [];

    // Always start with baby anchor
    const anchorFile = await prepareImageFile(styleAnchor, 'anchor.png');
    imageFiles.push(anchorFile);

    // Add other character references if they exist
    for (const charId of charactersOnPage) {
      if (charId === 'baby') continue; // Skip baby, already have anchor

      const charRef = getOneCharacterReference(charId as PersonId, uploadedPhotos, bookId);
      if (charRef) {
        const charFile = await prepareImageFile(charRef, `${charId}.png`);
        imageFiles.push(charFile);
      }
    }

    console.log(`[Job ${jobId}] L1 Character references: ${imageFiles.length} (${['baby', ...charactersOnPage.filter((c: PersonId) => c !== 'baby')].join(', ')})`);

    const maskFile = await prepareImageFile(preservationMask, 'mask.png');

    // Get camera angle from page data
    const cameraAngle = pageData.shot_id || pageData.camera_angle || 'medium';
    const cameraDescription = pageData.shot_description || pageData.camera_prompt || '';

    // Build pose/gesture prompt with camera angle AND character descriptions
    let posePrompt = '';

    if (charactersOnPage.length > 1) {
      // MULTI-CHARACTER: Explicit reference mapping and spatial composition
      posePrompt = `MULTI-CHARACTER COMPOSITION - ${pageData.visual_action || pageData.action_label || 'family together'}.
Camera angle: ${cameraAngle}${cameraDescription ? '. ' + cameraDescription : ''}.

REFERENCE IMAGE MAPPING (critical - follow exactly):`;

      let refIndex = 1;
      for (const charId of ['baby', ...charactersOnPage.filter((c: PersonId) => c !== 'baby')]) {
        if (!charactersOnPage.includes(charId)) continue;

        const charName = cast[charId]?.displayName || charId;
        const charDesc = cast[charId]?.features_lock || '';

        if (charId === 'baby') {
          posePrompt += `\nReference ${refIndex}: ${babyName} (baby) - MAIN CHARACTER`;
          if (charDesc) posePrompt += ` - ${charDesc}`;
        } else {
          posePrompt += `\nReference ${refIndex}: ${charName} (${charId})`;
          if (charDesc) posePrompt += ` - ${charDesc}`;
        }
        refIndex++;
      }

      // Explicit spatial positioning based on action
      const actionLower = (pageData.visual_action || '').toLowerCase();
      posePrompt += `\n\nSPATIAL COMPOSITION:`;

      if (actionLower.includes('in mom') || actionLower.includes("in mother's") || actionLower.includes('holding')) {
        posePrompt += `\n- Mom: LEFT side, holding/carrying baby, full body visible, facing slightly right`;
        posePrompt += `\n- ${babyName}: CENTER-LEFT, in Mom's arms, facing camera or slightly right`;
        if (charactersOnPage.includes('dad')) {
          posePrompt += `\n- Dad: RIGHT side, standing nearby, full body visible, facing slightly left`;
        }
      } else if (charactersOnPage.includes('mom') && charactersOnPage.includes('dad')) {
        // Generic family positioning
        posePrompt += `\n- Mom: LEFT third, full body visible, facing camera`;
        posePrompt += `\n- ${babyName}: CENTER, between parents, full body visible, facing camera`;
        posePrompt += `\n- Dad: RIGHT third, full body visible, facing camera`;
      } else {
        // Baby with one parent
        const otherChar = charactersOnPage.find((c: PersonId) => c !== 'baby');
        const otherName = cast[otherChar]?.displayName || otherChar;
        posePrompt += `\n- ${otherName}: LEFT side, near or holding baby, full body visible`;
        posePrompt += `\n- ${babyName}: CENTER-RIGHT, with ${otherName}, full body visible`;
      }

      posePrompt += `\n\nPOSITIONING RULES:
- Each character MUST match their reference image exactly
- Show complete full bodies (head to feet) for ALL characters
- Characters should be close together as a family group
- Maintain appropriate size ratios (baby smaller than adults)
- All faces should be clearly visible
- Natural family poses and interactions`;

    } else {
      // SINGLE CHARACTER: Simple pose description
      posePrompt = `${pageData.visual_action || pageData.action_label || 'standing naturally'}.
Camera angle: ${cameraAngle}${cameraDescription ? '. ' + cameraDescription : ''}.

Character: ${babyName} (baby)`;
      const babyDesc = cast['baby']?.features_lock;
      if (babyDesc) {
        posePrompt += ` - ${babyDesc}`;
      }
    }

    posePrompt += `\n\nMaintain exact same face and features as reference image(s).
1024×1024 TRANSPARENT BACKGROUND, isolated character(s) cutout ONLY.
NO scene elements, NO background objects, just the character(s).
Paper collage style with soft edges.`;

    console.log(`[Job ${jobId}] L1 Camera: ${cameraAngle}, Preserve Level: ${preserveLevel}`);
    console.log(`[Job ${jobId}] L1 Prompt: ${posePrompt}`);

    let layer1Response;
    try {
      layer1Response = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
        mask: maskFile,
        prompt: posePrompt,
        n: 1,
        size: '1024x1024',
        quality: IMAGE_QUALITY,
        input_fidelity: 'high',
        background: 'transparent',
        // @ts-expect-error: moderation exists but not in SDK types
        moderation: 'low',
      });
    } catch (error: any) {
      // Retry with Gemini-rewritten prompt if moderation blocked
      if (error.code === 'moderation_blocked') {
        console.log(`[Job ${jobId}] L1 MODERATION BLOCKED - Using Gemini to rewrite prompt`);

        const context = `Layer 1: Character variant. Page ${pageNumber}. Action: ${pageData.visual_action}. Camera: ${cameraAngle}. Characters: ${charactersOnPage.join(', ')}.`;
        const fixedPrompt = await fixModerationIssueWithGemini(posePrompt, context);

        layer1Response = await openai.images.edit({
          model: 'gpt-image-1',
          image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
          mask: maskFile,
          prompt: fixedPrompt,
          n: 1,
          size: '1024x1024',
          quality: IMAGE_QUALITY,
          input_fidelity: 'high',
          background: 'transparent',
          // @ts-expect-error: moderation exists but not in SDK types
          moderation: 'low',
        });
      } else {
        throw error;
      }
    }

    const characterVariantBase64 = await handleOpenAIResponse(layer1Response);
    const characterVariantDataUrl = `data:image/png;base64,${characterVariantBase64}`;

    job.progress = 40;

    // -------------------- LAYER 2: Local Composition --------------------
    console.log(`[Job ${jobId}] LAYER 2: Composing character + narration (local rendering)`);

    const characterPosition = getCharacterPosition(pageNumber, pageData);
    const narrationText = pageData.narration || '';

    if (!narrationText) {
      console.warn(`[Job ${jobId}] WARNING: No narration text for page ${pageNumber}!`);
    }

    console.log(`[Job ${jobId}] L2 Narration text (${narrationText.length} chars): "${narrationText.substring(0, 50)}..."`);

    const compositionResult = await composeSpread({
      characterImageBase64: characterVariantDataUrl,
      narration: narrationText,
      characterPosition
    });

    const composedDataUrl = compositionResult.imageDataUrl;
    const actualTextBounds = compositionResult.actualTextBounds;

    console.log(`[Job ${jobId}] L2 Complete: Character on ${characterPosition}, narration on opposite panel`);
    console.log(`[Job ${jobId}] L2 Actual text bounds: x=${actualTextBounds.x}, y=${actualTextBounds.y}, w=${actualTextBounds.width}, h=${actualTextBounds.height}`);

    job.progress = 60;

    // -------------------- LAYER 3: Inpainting Scene + Refinement Words --------------------
    console.log(`[Job ${jobId}] LAYER 3: Inpainting scene details + refinement words`);

    // Use ACTUAL text bounds from Layer 2 rendering (not estimated)
    console.log(`[Job ${jobId}] L3 Using actual text bounds from Layer 2 (not estimation)`);

    // Generate inpainting mask with actual bounds
    const inpaintingMask = generateInpaintingMask(characterPosition, actualTextBounds);

    // Extract refinement word from narration (hidden from parents, surprise for final book)
    const refinementWord = extractRefinementWordFromNarration(pageData.narration || '', pageData.visual_action || '');
    const refinementZones = getRefinementWordZones(characterPosition, pageNumber);

    // Log refinement word extraction (for debugging)
    if (refinementWord) {
      console.log(`[Job ${jobId}] L3 Refinement word extracted: "${refinementWord}" (hidden from parents, surprise for book)`);
    }

    // Get setting from spread_metadata (explicit setting from story generation)
    const setting = pageData.spread_metadata?.setting || 'outdoor setting';
    const action = pageData.visual_action || pageData.action_label || 'standing naturally';

    console.log(`[Job ${jobId}] L3 Context - Setting: "${setting}", Action: "${action}", Character: ${characterPosition}`);

    // Build context-aware scene prompt based on action analysis
    let scenePrompt = buildContextAwareScenePrompt(
      action,
      setting,
      characterPosition,
      pageData.narration || ''
    );

    // Add refinement words instruction if present
    if (refinementWord) {
      scenePrompt += `\n\nREFINEMENT WORD: Add decorative text "${refinementWord}" in paper-collage letter style (cut-paper look, slight rotation, subtle shadow). `;
      scenePrompt += `Place in available corner zones ONLY, small scale, do NOT overlap character or main narration.`;
    }

    console.log(`[Job ${jobId}] L3 Prompt:`, scenePrompt);

    const composedFile = await prepareImageFile(composedDataUrl, 'composed.png');
    const inpaintMaskFile = await prepareImageFile(inpaintingMask, 'inpaint-mask.png');

    let layer3Response;
    try {
      layer3Response = await openai.images.edit({
        model: 'gpt-image-1',
        image: composedFile,
        mask: inpaintMaskFile,
        prompt: scenePrompt,
        n: 1,
        size: '1536x1024', // LANDSCAPE spread
        quality: IMAGE_QUALITY,
        input_fidelity: 'high',
        // @ts-expect-error: moderation exists but not in SDK types
        moderation: 'low',
      });
    } catch (error: any) {
      // Retry with Gemini-rewritten prompt if moderation blocked
      if (error.code === 'moderation_blocked') {
        console.log(`[Job ${jobId}] L3 MODERATION BLOCKED - Using Gemini to rewrite prompt`);

        const context = `Layer 3: Scene inpainting. Page ${pageNumber}. Narration: "${pageData.narration}". Refinement word: ${refinementWord || 'none'}.`;
        const fixedPrompt = await fixModerationIssueWithGemini(scenePrompt, context);

        layer3Response = await openai.images.edit({
          model: 'gpt-image-1',
          image: composedFile,
          mask: inpaintMaskFile,
          prompt: fixedPrompt,
          n: 1,
          size: '1536x1024',
          quality: IMAGE_QUALITY,
          input_fidelity: 'high',
          // @ts-expect-error: moderation exists but not in SDK types
          moderation: 'low',
        });
      } else {
        throw error;
      }
    }

    const finalImageBase64 = await handleOpenAIResponse(layer3Response);

    job.progress = 85;

    // -------------------- UPSCALING FOR PRINT --------------------
    console.log(`[Job ${jobId}] UPSCALING: Processing for print (1536×1024 → 3072×2048)`);

    let printReadyBase64: string;
    try {
      // Upscale 2× and add 3mm bleed
      printReadyBase64 = await processPrintReady(finalImageBase64, true);
      console.log(`[Job ${jobId}] ✅ Print-ready image complete (3072×2048 with bleed)`);
    } catch (error: any) {
      console.error(`[Job ${jobId}] Upscaling failed:`, error);
      console.log(`[Job ${jobId}] Falling back to original resolution`);
      printReadyBase64 = finalImageBase64; // Fallback to original if upscaling fails
    }

    const finalDataUrl = `data:image/png;base64,${printReadyBase64}`;

    job.progress = 90;

    console.log(`[Job ${jobId}] 3-Layer Pipeline Complete!`);

    job.progress = 100;
    job.status = 'completed';
    job.completedAt = Date.now();
    job.result = {
      page_number: pageNumber,
      dataUrl: finalDataUrl,
      sizeKB: Math.round(Buffer.from(finalImageBase64, 'base64').length / 1024),
      style: '3-layer-pipeline',
      gender: babyGender,
      character_position: characterPosition,
      preserve_level: preserveLevel,
      characters_on_page: pageData.characters_on_page,
      refinement_word: refinementWord,
      elapsed_ms: Date.now() - job.startTime
    };

  } catch (error: any) {
    console.error(`[Job ${jobId}] Failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = Date.now();
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
