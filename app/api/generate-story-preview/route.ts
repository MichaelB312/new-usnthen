// app/api/generate-story-preview/route.ts
/**
 * Story Preview Generation API
 * Generates a lightweight 8-page story outline with illustration descriptions
 * for customer review BEFORE creating the full story
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PersonId, type Locale } from '@/lib/store/bookStore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // Fast model for previews

const LANGUAGE_NAMES: Record<Locale, string> = {
  'en': 'English',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'it': 'Italian'
};

interface PreviewPage {
  page_number: number;
  brief_narration: string;
  illustration_description: string;
  characters: string[];
}

interface PreviewResponse {
  title: string;
  pages: PreviewPage[];
}

function calculateAgeInMonths(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth())
  );
}

function extractCastMembers(whoWasThere: string, babyName: string): PersonId[] {
  const cast: PersonId[] = ['baby']; // Baby is always included
  const text = whoWasThere.toLowerCase();

  if (text.includes('mom') || text.includes('mommy') || text.includes('mama') || text.includes('mother')) {
    cast.push('mom');
  }
  if (text.includes('dad') || text.includes('daddy') || text.includes('papa') || text.includes('father')) {
    cast.push('dad');
  }
  if (text.includes('grandma') || text.includes('granny') || text.includes('nana') || text.includes('grandmother')) {
    cast.push('grandma');
  }
  if (text.includes('grandpa') || text.includes('granddad') || text.includes('grandfather')) {
    if (!cast.includes('dad')) {
      cast.push('grandpa');
    }
  }
  if (text.includes('brother') || text.includes('sister') || text.includes('sibling')) {
    cast.push('sibling');
  }
  if (text.includes('aunt') || text.includes('auntie')) {
    cast.push('aunt');
  }
  if (text.includes('uncle')) {
    cast.push('uncle');
  }
  if (text.includes('friend')) {
    cast.push('friend');
  }

  return cast;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { babyProfile, collectedData, locale = 'en' } = body;

    if (!babyProfile?.baby_name || !babyProfile?.birthdate) {
      return NextResponse.json(
        { error: 'Baby profile required' },
        { status: 400 }
      );
    }

    const babyName = babyProfile.baby_name;
    const ageInMonths = calculateAgeInMonths(babyProfile.birthdate);
    const languageName = LANGUAGE_NAMES[locale as Locale] || 'English';

    // Extract data from collected conversation
    const event = collectedData?.event || 'a special moment';
    const location = collectedData?.location || 'a beautiful place';
    const characters = collectedData?.characters || [];
    const storyBeginning = collectedData?.story_beginning || '';
    const storyMiddle = collectedData?.story_middle || '';
    const storyEnd = collectedData?.story_end || '';
    const sensoryDetails = collectedData?.sensory_details || '';
    const specialObject = collectedData?.special_object || '';
    const emotionalSignificance = collectedData?.emotional_significance || '';
    const milestone = collectedData?.milestone || false;

    // Extract cast from characters
    const whoWasThere = Array.isArray(characters) ? characters.join(', ') : characters;
    const extractedCast = extractCastMembers(whoWasThere, babyName);

    const prompt = `You are creating a BRIEF PREVIEW of a children's storybook for ${babyName} (age ${ageInMonths} months).

**IMPORTANT: Write the ENTIRE preview in ${languageName.toUpperCase()} language.**

This is NOT the final story - just a quick outline for the parent to review.

MEMORY DETAILS:
- Event: ${event}
- Location: ${location}
- Who was there: ${whoWasThere}
- Story arc: Beginning (${storyBeginning}), Middle (${storyMiddle}), End (${storyEnd})
- Special object: ${specialObject || 'None'}
- Emotional significance: ${emotionalSignificance}
- Sensory details: ${sensoryDetails}
- Milestone: ${milestone ? 'Yes' : 'No'}

YOUR TASK:
Create a preview with exactly 8 pages. Each page should have:
1. **brief_narration**: A SHORT 1-2 sentence summary of what happens on this page (not the final poetic text, just the concept)
2. **illustration_description**: A clear, customer-friendly description of WHO will be in the illustration and WHAT key elements/objects will appear (15-25 words)
3. **characters**: List of characters appearing on this page

GUIDELINES:
- Keep narration BRIEF - this is just a preview
- Focus on CLEAR illustration descriptions so parents know what to expect
- Distribute the story arc across all 8 pages (beginning → middle → climax → end)
- Make sure the characters listed match who appears in the illustration description
- Page 1 should set the scene, Page 8 should wrap up warmly
- Include the special object (${specialObject || 'key elements from the memory'}) where appropriate

OUTPUT FORMAT (JSON only, no markdown):
{
  "title": "Short working title (3-5 words)",
  "pages": [
    {
      "page_number": 1,
      "brief_narration": "Short 1-2 sentence concept for this page",
      "illustration_description": "Clear description of who and what will appear in the image",
      "characters": ["baby", "mom", etc.]
    }
  ]
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    });

    const raw = result.response.text().trim();
    if (!raw) throw new Error('Empty model response');

    const jsonText = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const preview: PreviewResponse = JSON.parse(jsonText);

    // Validate we got 8 pages
    if (!preview.pages || preview.pages.length !== 8) {
      console.warn(`Preview generated ${preview.pages?.length || 0} pages instead of 8`);
    }

    return NextResponse.json({
      success: true,
      preview: {
        title: preview.title,
        pages: preview.pages.map(page => ({
          ...page,
          page_number: page.page_number,
          brief_narration: page.brief_narration,
          illustration_description: page.illustration_description,
          characters: page.characters || ['baby']
        }))
      }
    });

  } catch (error: any) {
    console.error('Story preview generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate story preview' },
      { status: 500 }
    );
  }
}
