// app/api/generate-image-async/route.ts
/**
 * 3-Layer Image Generation Pipeline
 * Layer 1: Character cutouts (anchor + variants) via Image Edits
 * Layer 2: Local composition (character + narration rendering)
 * Layer 3: Inpainting (scene details + refinement words)
 *
 * Using gpt-image-1 with high quality for production results
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PersonId, CastMember, UploadedPhoto, Page } from '@/lib/store/bookStore';
import {
  IllustrationStyleId,
  getStyleConfig,
  getDefaultStyle
} from '@/lib/styles/illustrationStyles';

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
  calculateNarrationBounds
} from '@/lib/utils/inpaintingMasks';
import { processPrintReady } from '@/lib/utils/upscaler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Maximum for Vercel Hobby plan (5 minutes)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
  maxRetries: 2,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Quality set to high for high-quality production results
const IMAGE_QUALITY = 'high' as const;

// Job queue configuration
const MAX_CONCURRENT_JOBS = 4; // Limit concurrent image generation to prevent overwhelming the system
const processingJobIds = new Set<string>(); // Track currently processing jobs
const jobQueue: Array<{ jobId: string; params: any }> = []; // Queue for pending jobs

// Job storage
const jobs = new Map<string, {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'queued';
  progress: number;
  result?: any;
  error?: string;
  startTime: number;
  completedAt?: number;
  queuePosition?: number; // Position in queue if queued
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
 * Retry helper with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts (default 3)
 * @param initialDelay - Initial delay in ms (default 1000)
 * @param context - Context string for logging
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  context: string = 'Operation'
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[Retry] ${context} - Attempt ${attempt}/${maxRetries} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const result = await fn();

      if (attempt > 0) {
        console.log(`[Retry] ${context} - SUCCESS on attempt ${attempt}`);
      }

      return result;
    } catch (error: any) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;

      // Check if error is retryable
      const isRetryable =
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('502') ||
        error.message?.includes('503') ||
        error.message?.includes('504') ||
        error.status === 502 ||
        error.status === 503 ||
        error.status === 504 ||
        error.status === 429; // Rate limit

      if (!isRetryable || isLastAttempt) {
        if (isLastAttempt && isRetryable) {
          console.error(`[Retry] ${context} - FAILED after ${maxRetries} attempts:`, error.message);
        }
        throw error;
      }

      console.warn(`[Retry] ${context} - Attempt ${attempt} failed (${error.message}), retrying...`);
    }
  }

  throw lastError;
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
  narration: string,
  styleConfig: any
): string {
  const analysis = analyzeCharacterAction(action, setting);

  // Use style prefix instead of hardcoded "Paper collage"
  let prompt = `${styleConfig.sceneStylePrefix}

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
- PRESERVE WHITE BACKGROUND: At least ${styleConfig.negativeSpaceMinimum}% of composition MUST remain white/clean
- Elements are SMALL ACCENTS ONLY - think minimalist children's book illustration
- DO NOT fill entire areas - add small decorative pieces, not full coverage
${styleConfig.sceneStyleRules}
- If in doubt, add LESS rather than more

ABSOLUTE PROHIBITIONS (DO NOT DO THESE):
❌ DO NOT create full-page backgrounds
❌ DO NOT fill entire corners or sides with solid colors
❌ DO NOT extend elements beyond specified zones
❌ DO NOT cover white space with texture or patterns
❌ DO NOT create heavy, dense, or overwhelming compositions
❌ DO NOT add elements that touch or overlap the center divider line
❌ DO NOT modify, erase, or paint over any EXISTING text (unless adding poetic overlay as instructed)
❌ DO NOT add background elements inside character panel's center area
❌ DO NOT add or modify characters - they are already placed

MUST DO (REQUIREMENTS):
✓ Keep composition LIGHT and AIRY - lots of breathing room
✓ Elements must be SMALL SCALE decorative accents
✓ Preserve large areas of clean white background
✓ Place elements ONLY in specified narrow zones (60px borders)
${styleConfig.sceneStyleRules}`;

  return prompt;
}

/**
 * PROACTIVE moderation prevention using Gemini
 * Called BEFORE sending prompt to OpenAI to prevent issues
 */
async function sanitizePromptProactively(originalPrompt: string, context: string, contentType: 'character' | 'scene'): Promise<string> {
  try {
    console.log(`[Gemini Proactive] Pre-sanitizing ${contentType} prompt to prevent moderation issues`);

    const systemPrompt = `You are an AI safety expert specializing in children's book content. Your job is to rewrite image generation prompts to be 100% moderation-safe while preserving creative intent.

CONTEXT: This is for a wholesome children's storybook about a baby/toddler. The content is family-friendly, but we need to avoid ANY wording that might trigger false-positive moderation flags.

CRITICAL SAFETY RULES FOR BABIES/CHILDREN:
1. CAMERA ANGLES - Avoid problematic perspectives:
   ❌ "extreme close-up of face" → ✅ "gentle portrait showing face and shoulders"
   ❌ "macro shot of feet" → ✅ "wide view showing baby playing"
   ❌ "close-up of hands" → ✅ "medium shot showing baby reaching"
   ❌ "tight crop on body" → ✅ "full body view in scene"

2. BODY DESCRIPTIONS - Use family-friendly language:
   ❌ "bare feet" → ✅ "tiny feet" or "little toes"
   ❌ "bare hands" → ✅ "small hands" or "little fingers"
   ❌ "bare skin" → ✅ "soft cheeks" or "rosy face"
   ❌ "naked" or "unclothed" → ✅ "wearing simple clothes" or omit entirely
   ❌ ANY mention of body parts + "bare/naked/exposed" → ✅ rephrase neutrally

3. CLOTHING - Always neutral, never detailed:
   ❌ "no shirt" → ✅ "casual outfit"
   ❌ "diaper only" → ✅ "comfortable clothing"
   ❌ Detailed clothing descriptions → ✅ "wearing typical baby clothes"

4. PHYSICAL POSITIONING - Avoid suggestive angles:
   ❌ "lying down from above" → ✅ "sitting up, facing camera"
   ❌ "from below looking up" → ✅ "eye-level view"
   ❌ "crouching low" → ✅ "standing naturally"

5. FOCUS AREAS - Keep it wholesome:
   ❌ "focus on legs" → ✅ "full body in playful pose"
   ❌ "zoom in on torso" → ✅ "medium shot of whole scene"
   ❌ Isolated body part focus → ✅ Complete person in context

TASK: Rewrite this prompt to be moderation-proof. Keep the artistic intent but use only safe, family-friendly wording.

ORIGINAL PROMPT:
${originalPrompt}

CONTEXT: ${context}

OUTPUT: Return ONLY the sanitized prompt. No explanations, just the safe version.`;

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.2, // Low temp for consistent safety
      },
    });

    const sanitized = result.response.text().trim();
    console.log(`[Gemini Proactive] Sanitized (${sanitized.length} chars)`);

    // CRITICAL: Validate that sanitization didn't strip everything
    if (!sanitized || sanitized.length < 10) {
      console.warn(`[Gemini Proactive] Sanitization produced empty/too-short result (${sanitized.length} chars). Falling back to basic sanitization.`);
      return sanitizePromptForModeration(originalPrompt);
    }

    // Apply basic sanitization as well for extra safety
    const doubleSanitized = sanitizePromptForModeration(sanitized);

    // Final validation - ensure we never return empty prompt
    if (!doubleSanitized || doubleSanitized.length < 10) {
      console.error(`[Gemini Proactive] CRITICAL: Final prompt is empty after sanitization. Using original with basic cleanup.`);
      return sanitizePromptForModeration(originalPrompt);
    }

    return doubleSanitized;
  } catch (error: any) {
    // Handle Gemini blocking our innocent prompt (ironic!)
    if (error.message?.includes('PROHIBITED_CONTENT') || error.response?.promptFeedback?.blockReason === 'PROHIBITED_CONTENT') {
      console.warn('[Gemini Proactive] Gemini blocked our innocent prompt with PROHIBITED_CONTENT (false positive)');
      console.warn('[Gemini Proactive] Falling back to basic sanitization - this is a known limitation');
      // Fall back to basic sanitization when Gemini itself blocks the content
      return sanitizePromptForModeration(originalPrompt);
    }

    console.error('[Gemini Proactive] Failed:', error.message || error);
    // Fallback to basic sanitization for any other errors
    return sanitizePromptForModeration(originalPrompt);
  }
}

/**
 * Reactive moderation fix using Gemini
 * Only called when OpenAI moderation actually fails (backup to proactive)
 */
async function fixModerationIssueWithGemini(originalPrompt: string, context: string): Promise<string> {
  try {
    console.log(`[Gemini Reactive] Attempting to fix prompt that triggered moderation`);

    const systemPrompt = `You are a moderation safety expert helping to rewrite AI image generation prompts that triggered false-positive moderation flags.

CONTEXT: This is for an innocent children's book about a baby/toddler. The content is 100% wholesome and family-friendly, but the AI moderation system flagged it incorrectly.

TASK: Rewrite the prompt with MAXIMUM safety. Be MORE aggressive than normal:
- Replace "bare" + body parts with alternatives (bare feet → tiny feet, bare hands → little hands)
- Replace any clothing state references with neutral descriptions
- Replace any body part close-ups with gentler phrasing
- Change extreme camera angles to medium/wide shots
- Keep the same artistic style, composition, and scene description
- Maintain all character details

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
    console.log(`[Gemini Reactive] Rewritten prompt (${rewrittenPrompt.length} chars)`);

    return sanitizePromptForModeration(rewrittenPrompt);
  } catch (error: any) {
    console.error('[Gemini Reactive] Failed:', error);
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
 * Process next job in queue if there's capacity
 */
function processNextInQueue() {
  if (processingJobIds.size >= MAX_CONCURRENT_JOBS) {
    console.log(`[Queue] At max capacity (${processingJobIds.size}/${MAX_CONCURRENT_JOBS}), waiting...`);
    return;
  }

  if (jobQueue.length === 0) {
    console.log(`[Queue] No jobs in queue`);
    return;
  }

  const nextJob = jobQueue.shift();
  if (!nextJob) return;

  const { jobId, params } = nextJob;
  const job = jobs.get(jobId);
  if (!job) return;

  console.log(`[Queue] Starting job ${jobId} (${processingJobIds.size + 1}/${MAX_CONCURRENT_JOBS} active, ${jobQueue.length} remaining in queue)`);

  processingJobIds.add(jobId);
  job.status = 'processing';
  job.queuePosition = undefined;

  // Update queue positions for remaining jobs
  jobQueue.forEach((queuedJob, index) => {
    const queuedJobData = jobs.get(queuedJob.jobId);
    if (queuedJobData) {
      queuedJobData.queuePosition = index + 1;
    }
  });

  processThreeLayerPipeline(jobId, params)
    .catch(error => {
      console.error(`Job ${jobId} failed:`, error);
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message || 'Unknown error occurred';
        job.completedAt = Date.now();
      }
    })
    .finally(() => {
      // Remove from processing set and try to process next job
      processingJobIds.delete(jobId);
      console.log(`[Queue] Job ${jobId} completed, processing next (${processingJobIds.size}/${MAX_CONCURRENT_JOBS} active)`);
      processNextInQueue();
    });
}

/**
 * Start job processing with queue management
 */
function startJobProcessing(jobId: string, params: any) {
  const job = jobs.get(jobId);
  if (!job) {
    console.error(`[Queue] Job ${jobId} not found`);
    return;
  }

  // Check if we can process immediately
  if (processingJobIds.size < MAX_CONCURRENT_JOBS) {
    console.log(`[Queue] Starting job ${jobId} immediately (${processingJobIds.size + 1}/${MAX_CONCURRENT_JOBS} active)`);
    processingJobIds.add(jobId);
    job.status = 'processing';

    processThreeLayerPipeline(jobId, params)
      .catch(error => {
        console.error(`Job ${jobId} failed:`, error);
        const job = jobs.get(jobId);
        if (job) {
          job.status = 'failed';
          job.error = error.message || 'Unknown error occurred';
          job.completedAt = Date.now();
        }
      })
      .finally(() => {
        processingJobIds.delete(jobId);
        console.log(`[Queue] Job ${jobId} completed, processing next (${processingJobIds.size}/${MAX_CONCURRENT_JOBS} active)`);
        processNextInQueue();
      });
  } else {
    // Add to queue
    jobQueue.push({ jobId, params });
    job.status = 'queued';
    job.queuePosition = jobQueue.length;
    console.log(`[Queue] Job ${jobId} queued at position ${job.queuePosition} (${processingJobIds.size}/${MAX_CONCURRENT_JOBS} active, ${jobQueue.length} in queue)`);
  }
}

/**
 * POST - Start image generation job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookId, pageNumber, pageData: page, babyProfile, cast, allPages, illustrationStyle } = body;

    if (!bookId || pageNumber === undefined || pageNumber === null || !page) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get style configuration
    const styleId = (illustrationStyle as IllustrationStyleId) || 'paper-collage';
    const styleConfig = getStyleConfig(styleId);

    console.log(`[Style] Using illustration style: ${styleConfig.name} (${styleId})`);

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

    console.log(`[Job ${jobId}] Page ${pageNumber} - 3-Layer Pipeline (quality=${IMAGE_QUALITY}, style=${styleId})`);

    // Pass payload to processing
    const payload: any = {
      bookId,
      pageNumber,
      babyProfile,
      pageData,
      cast: cast,
      babyGender,
      allPages: allPages,
      styleConfig,
      ...body
    };

    // Use queue management instead of direct processing
    startJobProcessing(jobId, payload);

    return NextResponse.json({
      success: true,
      jobId,
      message: `3-Layer pipeline ${jobs.get(jobId)?.status === 'queued' ? 'queued' : 'started'} for page ${pageNumber}`,
      queuePosition: jobs.get(jobId)?.queuePosition
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

    // Get style configuration from params (declared once for entire pipeline)
    const styleConfig = params.styleConfig || getDefaultStyle();

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

      // Build anchor prompt using style configuration
      const genderText = babyGender === 'boy' ? 'boy' : babyGender === 'girl' ? 'girl' : 'baby';
      const genderCharacteristics = babyGender === 'boy'
        ? 'Clear baby boy characteristics. Boyish features, short hair.'
        : babyGender === 'girl'
        ? 'Clear baby girl characteristics. Feminine features, may have bow or headband.'
        : 'Neutral baby characteristics.';

      let prompt = styleConfig.characterAnchorPrompt({
        genderText,
        genderCharacteristics,
        babyDescription
      });

      job.progress = 30;

      console.log(`[Job ${jobId}] Original prompt:`, prompt);

      // PROACTIVE: Sanitize prompt BEFORE sending to OpenAI
      const context = `Creating character anchor for ${babyName} (${babyGender}). 1024×1024 transparent background.`;
      const safePrompt = await sanitizePromptProactively(prompt, context, 'character');

      console.log(`[Job ${jobId}] Calling GPT-Image-1 with sanitized prompt (quality=${IMAGE_QUALITY})`);

      let response;
      try {
        response = await retryWithBackoff(
          () => openai.images.edit({
            model: 'gpt-image-1',
            image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
            prompt: safePrompt, // Use sanitized prompt
            n: 1,
            size: '1024x1024', // SQUARE for character
            quality: IMAGE_QUALITY,
            input_fidelity: 'high',
            background: 'transparent',
            // @ts-expect-error: moderation exists but not in SDK types
            moderation: 'low',
          }),
          3, // Max 3 retries
          2000, // 2 second initial delay
          `Character anchor generation (Page 0)`
        );
      } catch (error: any) {
        // REACTIVE: If proactive sanitization wasn't enough, try even more aggressive rewrite
        if (error.code === 'moderation_blocked') {
          console.log(`[Job ${jobId}] ANCHOR MODERATION BLOCKED (despite proactive sanitization) - Using reactive fix`);

          const fixedPrompt = await fixModerationIssueWithGemini(safePrompt, context);

          response = await retryWithBackoff(
            () => openai.images.edit({
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
            }),
            3,
            2000,
            `Character anchor (reactive fix, Page 0)`
          );
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
        style: styleConfig?.id || 'paper-collage', // Actual style ID
        pipeline_stage: 'character-anchor', // NOT part of 3-layer pipeline
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

    posePrompt += styleConfig.characterVariantSuffix;

    console.log(`[Job ${jobId}] L1 Camera: ${cameraAngle}, Preserve Level: ${preserveLevel}`);
    console.log(`[Job ${jobId}] L1 Original prompt: ${posePrompt}`);

    // PROACTIVE: Sanitize prompt BEFORE sending to OpenAI
    const l1Context = `Layer 1: Character variant. Page ${pageNumber}. Action: ${pageData.visual_action}. Camera: ${cameraAngle}. Characters: ${charactersOnPage.join(', ')}.`;
    const safePosePrompt = await sanitizePromptProactively(posePrompt, l1Context, 'character');

    console.log(`[Job ${jobId}] L1 Sanitized prompt ready`);

    let layer1Response;
    try {
      layer1Response = await retryWithBackoff(
        () => openai.images.edit({
          model: 'gpt-image-1',
          image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
          mask: maskFile,
          prompt: safePosePrompt, // Use sanitized prompt
          n: 1,
          size: '1024x1024',
          quality: IMAGE_QUALITY,
          input_fidelity: 'high',
          background: 'transparent',
          // @ts-expect-error: moderation exists but not in SDK types
          moderation: 'low',
        }),
        3, // Max 3 retries
        2000, // 2 second initial delay
        `Layer 1 character variant (Page ${pageNumber})`
      );
    } catch (error: any) {
      // REACTIVE: If proactive sanitization wasn't enough, try even more aggressive rewrite
      if (error.code === 'moderation_blocked') {
        console.log(`[Job ${jobId}] L1 MODERATION BLOCKED (despite proactive sanitization) - Using reactive fix`);

        const fixedPrompt = await fixModerationIssueWithGemini(safePosePrompt, l1Context);

        layer1Response = await retryWithBackoff(
          () => openai.images.edit({
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
          }),
          3,
          2000,
          `Layer 1 character variant (reactive fix, Page ${pageNumber})`
        );
      } else {
        throw error;
      }
    }

    const characterVariantBase64 = await handleOpenAIResponse(layer1Response);
    const characterVariantDataUrl = `data:image/png;base64,${characterVariantBase64}`;

    job.progress = 40;

    // -------------------- LAYER 2: Local Composition --------------------
    // SKIP Layer 2 for minimalist moment spreads (single poetic sentence, not rendered in Layer 2)
    const isMinimalistMoment = pageData.is_minimalist_moment === true || pageData.is_refinement_only === true;
    let composedDataUrl: string;
    let actualTextBounds: any;
    const characterPosition = getCharacterPosition(pageNumber, pageData);

    if (isMinimalistMoment) {
      console.log(`[Job ${jobId}] LAYER 2: SKIPPED (minimalist moment spread - single poetic sentence, no text rendering)`);
      console.log(`[Job ${jobId}] Using character variant directly for Layer 3`);

      // For minimalist moment spreads, convert character variant (1024x1024) to landscape format (1536x1024)
      // by placing it on the appropriate side of a white landscape canvas
      const { composeSpread } = require('@/lib/utils/localComposition');
      const emptyComposition = await composeSpread({
        characterImageBase64: characterVariantDataUrl,
        narration: '', // No narration text rendering (single sentence handled in Layer 3)
        characterPosition,
        skipTextRendering: true // Flag to skip text rendering
      });

      composedDataUrl = emptyComposition.imageDataUrl;
      actualTextBounds = { x: 0, y: 0, width: 0, height: 0 }; // No text bounds

      console.log(`[Job ${jobId}] L2 Character placed on ${characterPosition} side, no narration text`);
    } else {
      console.log(`[Job ${jobId}] LAYER 2: Composing character + narration (local rendering)`);

      const narrationText = pageData.narration || '';

      if (!narrationText || narrationText.trim().length === 0) {
        console.error(`[Job ${jobId}] CRITICAL: Empty or missing narration for page ${pageNumber}!`);
        console.error(`[Job ${jobId}] Page data:`, JSON.stringify(pageData, null, 2));
        throw new Error(`Page ${pageNumber} has no narration text - cannot proceed with Layer 2`);
      }

      console.log(`[Job ${jobId}] L2 Narration text (${narrationText.length} chars): "${narrationText.substring(0, 50)}..."`);

      const compositionResult = await composeSpread({
        characterImageBase64: characterVariantDataUrl,
        narration: narrationText,
        characterPosition
      });

      composedDataUrl = compositionResult.imageDataUrl;
      actualTextBounds = compositionResult.actualTextBounds;

      console.log(`[Job ${jobId}] L2 Complete: Character on ${characterPosition}, narration on opposite panel`);
      console.log(`[Job ${jobId}] L2 Actual text bounds: x=${actualTextBounds.x}, y=${actualTextBounds.y}, w=${actualTextBounds.width}, h=${actualTextBounds.height}`);
    }

    job.progress = 60;

    // -------------------- LAYER 3: Inpainting Scene + Refinement Words --------------------
    console.log(`[Job ${jobId}] LAYER 3: Inpainting scene details + refinement words`);

    // Use ACTUAL text bounds from Layer 2 rendering (not estimated)
    console.log(`[Job ${jobId}] L3 Using actual text bounds from Layer 2 (not estimation)`);

    // Generate inpainting mask with actual bounds
    const inpaintingMask = generateInpaintingMask(characterPosition, actualTextBounds);

    // Refinement words ONLY on dedicated minimalist moment spreads
    // Normal spreads should NOT have refinement words at all
    let refinementWord: string | undefined;
    if (isMinimalistMoment) {
      // For minimalist moment spreads, the narration IS the poetic sentence/refinement word
      refinementWord = pageData.narration || undefined;
      if (refinementWord) {
        console.log(`[Job ${jobId}] L3 Minimalist moment spread - using narration as poetic overlay: "${refinementWord}"`);
      }
    } else {
      // Normal spreads: NO refinement words
      refinementWord = undefined;
      console.log(`[Job ${jobId}] L3 Normal spread - no refinement words (only on minimalist moments)`);
    }

    // Get setting from spread_metadata (explicit setting from story generation)
    const setting = pageData.spread_metadata?.setting || 'outdoor setting';
    const action = pageData.visual_action || pageData.action_label || 'standing naturally';

    console.log(`[Job ${jobId}] L3 Context - Setting: "${setting}", Action: "${action}", Character: ${characterPosition}`);

    // Build context-aware scene prompt based on action analysis AND STYLE
    let scenePrompt = buildContextAwareScenePrompt(
      action,
      setting,
      characterPosition,
      pageData.narration || '',
      styleConfig
    );

    // Add refinement words instruction if present (for minimalist moment spreads)
    if (refinementWord) {
      scenePrompt += `\n\n✓ POETIC TEXT OVERLAY (REQUIRED): Add decorative text "${refinementWord}".
${styleConfig.poeticTextOverlayStyle}
- Place strategically in available space (not over character)
- Medium-to-large scale, readable and artistic
- This is the ONLY text for this spread - make it beautiful and prominent`;
    } else {
      // For normal spreads with narration text already rendered in Layer 2
      scenePrompt += `\n\n❌ DO NOT ADD NEW TEXT - The narration text is already rendered on this spread`;
    }

    console.log(`[Job ${jobId}] L3 Original prompt:`, scenePrompt);

    // PROACTIVE: Sanitize prompt BEFORE sending to OpenAI
    const l3Context = `Layer 3: Scene inpainting. Page ${pageNumber}. Narration: "${pageData.narration}". Refinement word: ${refinementWord || 'none'}.`;
    const safeScenePrompt = await sanitizePromptProactively(scenePrompt, l3Context, 'scene');

    console.log(`[Job ${jobId}] L3 Sanitized prompt ready`);

    const composedFile = await prepareImageFile(composedDataUrl, 'composed.png');
    const inpaintMaskFile = await prepareImageFile(inpaintingMask, 'inpaint-mask.png');

    let layer3Response;
    try {
      layer3Response = await retryWithBackoff(
        () => openai.images.edit({
          model: 'gpt-image-1',
          image: composedFile,
          mask: inpaintMaskFile,
          prompt: safeScenePrompt, // Use sanitized prompt
          n: 1,
          size: '1536x1024', // LANDSCAPE spread
          quality: IMAGE_QUALITY,
          input_fidelity: 'high',
          // @ts-expect-error: moderation exists but not in SDK types
          moderation: 'low',
        }),
        3, // Max 3 retries
        2000, // 2 second initial delay
        `Layer 3 scene inpainting (Page ${pageNumber})`
      );
    } catch (error: any) {
      // REACTIVE: If proactive sanitization wasn't enough, try even more aggressive rewrite
      if (error.code === 'moderation_blocked') {
        console.log(`[Job ${jobId}] L3 MODERATION BLOCKED (despite proactive sanitization) - Using reactive fix`);

        const fixedPrompt = await fixModerationIssueWithGemini(safeScenePrompt, l3Context);

        layer3Response = await retryWithBackoff(
          () => openai.images.edit({
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
          }),
          3,
          2000,
          `Layer 3 scene inpainting (reactive fix, Page ${pageNumber})`
        );
      } else {
        throw error;
      }
    }

    const finalImageBase64 = await handleOpenAIResponse(layer3Response);

    job.progress = 85;

    // -------------------- UPSCALING FOR PRINT --------------------
    const skipUpscaling = process.env.SKIP_UPSCALING === 'true';
    let printReadyBase64: string;

    if (skipUpscaling) {
      console.log(`[Job ${jobId}] UPSCALING: SKIPPED (SKIP_UPSCALING=true) - using original resolution for testing`);
      printReadyBase64 = finalImageBase64;
    } else {
      console.log(`[Job ${jobId}] UPSCALING: Processing for print (1536×1024 → 3072×2048)`);
      try {
        // Upscale 2× and add 3mm bleed with retry logic
        printReadyBase64 = await retryWithBackoff(
          () => processPrintReady(finalImageBase64, true),
          3, // Max 3 retries
          2000, // 2 second initial delay
          `Upscaling page ${pageNumber}`
        );
        console.log(`[Job ${jobId}] ✅ Print-ready image complete (3072×2048 with bleed)`);
      } catch (error: any) {
        console.error(`[Job ${jobId}] Upscaling failed after retries:`, error);
        console.log(`[Job ${jobId}] Falling back to original resolution`);
        printReadyBase64 = finalImageBase64; // Fallback to original if upscaling fails
      }
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
      style: styleConfig?.id || 'paper-collage', // Actual style ID
      pipeline_stage: '3-layer-pipeline',
      gender: babyGender,
      character_position: characterPosition,
      preserve_level: preserveLevel,
      characters_on_page: pageData.characters_on_page,
      refinement_word: refinementWord,
      elapsed_ms: Date.now() - job.startTime
    };

  } catch (error: any) {
    console.error(`[Job ${jobId}] Pipeline failed:`, error);

    // Classify error type for better user messaging
    let errorType = 'unknown';
    let userMessage = error.message || 'An unknown error occurred';

    if (error.code === 'moderation_blocked') {
      errorType = 'moderation';
      userMessage = `Content moderation blocked the request. This is typically a false positive for family-friendly content. Please try again.`;
    } else if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      errorType = 'timeout';
      userMessage = `Request timed out. The system may be under heavy load. Please try again in a moment.`;
    } else if (error.message?.includes('502') || error.status === 502) {
      errorType = 'gateway';
      userMessage = `Gateway error (502). The image generation service is temporarily unavailable. Please try again.`;
    } else if (error.message?.includes('503') || error.status === 503) {
      errorType = 'service_unavailable';
      userMessage = `Service temporarily unavailable (503). Please try again in a moment.`;
    } else if (error.message?.includes('429') || error.status === 429) {
      errorType = 'rate_limit';
      userMessage = `Rate limit exceeded. Please wait a moment and try again.`;
    } else if (error.message?.includes('Character anchor not available')) {
      errorType = 'missing_anchor';
      userMessage = `Character anchor not ready. Please ensure page 0 completes first.`;
    } else if (error.message?.includes('No baby photo') || error.message?.includes('no narration')) {
      errorType = 'missing_data';
      userMessage = error.message;
    } else if (error.message?.includes('Image exceeds')) {
      errorType = 'file_size';
      userMessage = error.message;
    }

    job.status = 'failed';
    job.error = userMessage;
    job.completedAt = Date.now();

    console.error(`[Job ${jobId}] Error type: ${errorType}`);
    console.error(`[Job ${jobId}] User message: ${userMessage}`);
    console.error(`[Job ${jobId}] Full error:`, {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
    });
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
      queuePosition: job.queuePosition,
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
    processingJobIds.clear();
    jobQueue.length = 0; // Clear array

    return NextResponse.json({
      success: true,
      message: 'Cleaned up temporary data (jobs, anchors, queue)'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}
