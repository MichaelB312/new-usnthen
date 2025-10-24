// app/api/regenerate-story/route.ts
/**
 * Story Regeneration API
 * Regenerates story with manual narration edits and/or illustration feedback
 * Maintains perfect correlation between narration and illustration descriptions
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { type Locale } from '@/lib/store/bookStore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

const LANGUAGE_NAMES: Record<Locale, string> = {
  'en': 'English',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'it': 'Italian'
};

export async function POST(request: NextRequest) {
  try {
    const {
      originalStory,
      illustrationFeedback,
      manualNarrationEdits,
      locale = 'en'
    } = await request.json();

    if (!originalStory || !originalStory.pages) {
      return NextResponse.json(
        { error: 'Original story required' },
        { status: 400 }
      );
    }

    const languageName = LANGUAGE_NAMES[locale as Locale] || 'English';

    // Build edit instructions
    const hasManualEdits = manualNarrationEdits && Object.keys(manualNarrationEdits).length > 0;
    const hasFeedback = illustrationFeedback && illustrationFeedback.some((f: string) => f && f.trim());

    if (!hasManualEdits && !hasFeedback) {
      // No changes needed, return original
      return NextResponse.json({
        success: true,
        story: originalStory
      });
    }

    const manualEditsText = hasManualEdits
      ? Object.entries(manualNarrationEdits)
          .map(([pageIdx, newText]) => `Page ${parseInt(pageIdx) + 1}: "${newText}"`)
          .join('\n')
      : '';

    const feedbackText = hasFeedback
      ? illustrationFeedback
          .map((fb: string, idx: number) => fb && fb.trim() ? `Page ${idx + 1}: ${fb}` : null)
          .filter(Boolean)
          .join('\n')
      : '';

    const prompt = `You are a master children's book author and illustrator. You previously created this story:

ORIGINAL STORY:
${JSON.stringify(originalStory, null, 2)}

The parent has requested changes:

${hasManualEdits ? `
MANUAL NARRATION EDITS (YOU MUST USE EXACTLY AS PROVIDED):
${manualEditsText}

For these pages, you MUST:
1. Use the exact narration text provided above
2. Generate NEW illustration_description that perfectly matches the edited narration
3. Generate NEW visual_prompt (technical description) that matches the edited narration
4. Ensure characters_on_page reflects who appears in the new narration
5. Keep the same emotional_core and page structure
` : ''}

${hasFeedback ? `
ILLUSTRATION FEEDBACK:
${feedbackText}

For these pages, you MUST:
1. Update the illustration_description to incorporate the feedback
2. Update the visual_prompt to include the requested elements
3. Keep the narration unchanged unless it conflicts with the feedback
4. Ensure the illustration perfectly matches what the parent requested
` : ''}

**CRITICAL INSTRUCTION: Write the ENTIRE story in ${languageName.toUpperCase()} language.**

YOUR TASK:
1. For pages with manual edits: Use EXACT narration provided, generate matching illustrations
2. For pages with illustration feedback: Update illustration fields to incorporate feedback
3. For unchanged pages: Keep everything as-is
4. Ensure ALL pages maintain:
   - Perfect correlation between narration and illustration_description
   - Coherent emotional arc across all pages
   - Same poetic style and voice
   - Age-appropriate language and complexity

Return the complete updated story with all pages in JSON format matching the original structure exactly.

OUTPUT FORMAT (JSON only, no markdown):
{
  "title": "Same title or slightly adjusted if needed",
  "refrain": "Same refrain",
  "pages": [ ... all 8 pages with updates applied ... ],
  "cast_members": [ ... same cast ... ],
  "metadata": { ... same metadata ... },
  "style": "isolated-paper-collage",
  "emotional_core": "Same emotional core",
  "story_arc": "Same story arc"
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: 'application/json',
      },
    });

    const raw = result.response.text().trim();
    if (!raw) throw new Error('Empty model response');

    const jsonText = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const updatedStory = JSON.parse(jsonText);

    // Validate we got the same number of pages
    if (updatedStory.pages?.length !== originalStory.pages?.length) {
      console.warn(`Regeneration returned ${updatedStory.pages?.length} pages instead of ${originalStory.pages?.length}`);
    }

    return NextResponse.json({
      success: true,
      story: updatedStory
    });

  } catch (error: any) {
    console.error('Story regeneration error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to regenerate story' },
      { status: 500 }
    );
  }
}
