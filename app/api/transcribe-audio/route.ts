/**
 * Gemini Audio Transcription API
 *
 * High-quality voice transcription using Gemini 2.5 Pro
 * - Transcribes parent's voice recordings about baby memories
 * - Detects emotional context to enhance story generation
 * - Context-aware transcription for accurate baby names and details
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Use Pro model for superior audio transcription quality (95-98% accuracy)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

// Language name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'it': 'Italian'
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const babyName = formData.get('babyName') as string;
    const duration = formData.get('duration') as string;
    const locale = (formData.get('locale') as string) || 'en';

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file required' },
        { status: 400 }
      );
    }

    // Convert audio file to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    // Get language name for prompt
    const languageName = LANGUAGE_NAMES[locale] || 'English';

    // Prepare STRICT transcription prompt that prevents hallucination
    const transcriptionPrompt = `You are a SPEECH-TO-TEXT transcription system. Your ONLY job is to transcribe spoken words.

**The speaker is talking in ${languageName} language. Transcribe the speech in ${languageName}.**

CRITICAL RULES:
1. If you hear NO SPEECH or only SILENCE: Return exactly "NO_SPEECH_DETECTED"
2. If audio is unclear or garbled: Return exactly "AUDIO_UNCLEAR"
3. If you hear actual speech: Transcribe ONLY what is spoken, word-for-word in ${languageName}
4. DO NOT generate, create, or invent ANY content
5. DO NOT write stories, memories, or examples
6. DO NOT be creative or helpful beyond transcription
7. If uncertain what was said: Return "AUDIO_UNCLEAR"

TRANSCRIPTION TASK:
- Listen to the audio (spoken in ${languageName})
- If speech is present: transcribe it exactly as spoken in ${languageName}
- If NO speech: return "NO_SPEECH_DETECTED"
- Fix minor speech errors (um, uh) naturally
- Use proper punctuation

The speaker may be talking about their baby ${babyName}, but ONLY transcribe if they actually speak.

Return format: Just the transcribed text in ${languageName}, OR "NO_SPEECH_DETECTED" if silent, OR "AUDIO_UNCLEAR" if unintelligible.`;

    // Send to Gemini with audio data
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: audioFile.type,
          data: base64Audio
        }
      },
      { text: transcriptionPrompt }
    ]);

    const transcription = result.response.text().trim();

    // Check if no speech was detected
    if (transcription === 'NO_SPEECH_DETECTED' || transcription === 'AUDIO_UNCLEAR') {
      return NextResponse.json(
        {
          error: 'no_speech_detected',
          message: 'No speech detected. Please try again and speak clearly.'
        },
        { status: 400 }
      );
    }

    // Check if transcription is suspiciously long (might be hallucination)
    if (transcription.length > 1000) {
      return NextResponse.json(
        {
          error: 'transcription_too_long',
          message: 'Audio processing error. Please try recording again.'
        },
        { status: 400 }
      );
    }

    // Extract emotional context for enhanced story generation
    const emotionPrompt = `Based on this transcription of a parent talking about their baby:
"${transcription}"

Analyze the emotional tone and return a JSON object with:
{
  "primary_emotion": "one word: joyful, tender, excited, proud, amazed, peaceful, playful, loving, curious, delighted",
  "intensity": "subtle, moderate, strong",
  "mood_keywords": ["2-3 adjectives describing the overall feeling"]
}

Return ONLY the JSON object, no additional text.`;

    const emotionResult = await model.generateContent(emotionPrompt);
    const emotionText = emotionResult.response.text().trim();

    // Parse emotion data
    let emotionData = null;
    try {
      // Remove markdown code blocks if present
      const jsonText = emotionText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      emotionData = JSON.parse(jsonText);
    } catch (parseError) {
      // Fallback to basic emotion
      emotionData = {
        primary_emotion: 'loving',
        intensity: 'moderate',
        mood_keywords: ['warm', 'heartfelt']
      };
    }

    const elapsedMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      transcription,
      emotion: emotionData,
      metadata: {
        audioSize: audioFile.size,
        audioType: audioFile.type,
        duration: duration || 'unknown',
        processingTime: elapsedMs
      }
    });

  } catch (error: any) {
    const elapsedMs = Date.now() - startTime;
    console.error('[Transcription] Error:', error);

    // Provide helpful error messages
    let errorMessage = 'Failed to transcribe audio';
    if (error.message?.includes('quota')) {
      errorMessage = 'API quota exceeded. Please try again later.';
    } else if (error.message?.includes('invalid')) {
      errorMessage = 'Audio format not supported. Please try again.';
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.message,
        processingTime: elapsedMs
      },
      { status: 500 }
    );
  }
}
