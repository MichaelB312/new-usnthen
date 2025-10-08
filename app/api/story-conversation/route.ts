/**
 * Gemini-Powered Story Conversation API
 *
 * This implements the hybrid agent model:
 * - Backend (Director): Manages state and tracks required information
 * - Gemini AI (Brain): Handles natural conversation and data extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StoryMemoryDirector } from '@/lib/agents/StoryMemoryDirector';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Session storage (in production, use Redis or similar)
const sessions = new Map<string, StoryMemoryDirector>();

// Clean up old sessions every 30 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  // Simple cleanup - in production you'd check session timestamps
  if (sessions.size > 100) {
    sessions.clear();
  }
}, 30 * 60 * 1000);

interface ConversationRequest {
  sessionId: string;
  babyName: string;
  userMessage?: string;
  action: 'start' | 'continue' | 'extract';
}

/**
 * POST /api/story-conversation
 * Main conversation endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConversationRequest = await request.json();
    const { sessionId, babyName, userMessage, action } = body;

    if (!sessionId || !babyName) {
      return NextResponse.json(
        { error: 'Session ID and baby name required' },
        { status: 400 }
      );
    }

    // Get or create director for this session
    let director = sessions.get(sessionId);
    if (!director) {
      director = new StoryMemoryDirector(sessionId, babyName);
      sessions.set(sessionId, director);
    }

    // Handle different actions
    switch (action) {
      case 'start':
        return handleStart(director);

      case 'continue':
        if (!userMessage) {
          return NextResponse.json(
            { error: 'User message required for continue action' },
            { status: 400 }
          );
        }
        return handleContinue(director, userMessage);

      case 'extract':
        return handleExtract(director);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Story conversation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Start a new conversation
 */
async function handleStart(director: StoryMemoryDirector) {
  try {
    const systemPrompt = director.getSystemPrompt();
    const nextPromptInstruction = director.getNextPromptInstruction();

    // Generate opening message using Gemini
    const prompt = `${systemPrompt}

${nextPromptInstruction}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Save assistant message to history
    director.addMessage('assistant', response);

    return NextResponse.json({
      success: true,
      message: response,
      progress: director.getCompletionPercentage(),
      isComplete: director.isComplete(),
      collectedFields: Array.from(director.getState().completedFields)
    });
  } catch (error: any) {
    console.error('Start conversation error:', error);
    throw error;
  }
}

/**
 * Continue the conversation with user input
 */
async function handleContinue(director: StoryMemoryDirector, userMessage: string) {
  try {
    // Add user message to history
    director.addMessage('user', userMessage);

    // Step 1: Extract structured data from user input
    const extractionPrompt = director.getExtractionPrompt(userMessage);
    const extractionResult = await model.generateContent(extractionPrompt);

    let extractedData = {};
    try {
      const extractionText = extractionResult.response.text();
      // Remove markdown code blocks if present
      const jsonText = extractionText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(jsonText);

      // Update director's state with extracted data
      director.updateCollectedData(extractedData);
    } catch (parseError) {
      console.warn('Failed to parse extraction result:', parseError);
      // Continue anyway - we'll ask for clarification
    }

    // Step 2: Check if we're done
    if (director.isComplete()) {
      const closingMessage = await generateClosingMessage(director);
      director.addMessage('assistant', closingMessage);
      director.setPhase('complete');

      return NextResponse.json({
        success: true,
        message: closingMessage,
        progress: 100,
        isComplete: true,
        collectedData: director.getFinalData(),
        collectedFields: Array.from(director.getState().completedFields)
      });
    }

    // Step 3: Generate next question using Gemini
    const systemPrompt = director.getSystemPrompt();
    const nextPromptInstruction = director.getNextPromptInstruction();

    const conversationHistory = director.getConversationHistory();

    // Filter history to ensure it starts with 'user' role
    // Skip the first message if it's from the assistant (the initial greeting)
    const filteredHistory = conversationHistory.length > 0 && conversationHistory[0].role === 'model'
      ? conversationHistory.slice(1)
      : conversationHistory;

    // Create chat with history
    const chat = model.startChat({
      history: filteredHistory
    });

    const nextQuestionPrompt = `${systemPrompt}

${nextPromptInstruction}`;

    const result = await chat.sendMessage(nextQuestionPrompt);
    const nextMessage = result.response.text();

    // Save assistant message
    director.addMessage('assistant', nextMessage);

    return NextResponse.json({
      success: true,
      message: nextMessage,
      progress: director.getCompletionPercentage(),
      isComplete: false,
      extractedData, // Return what was extracted for debugging
      collectedFields: Array.from(director.getState().completedFields)
    });
  } catch (error: any) {
    console.error('Continue conversation error:', error);
    throw error;
  }
}

/**
 * Extract final structured data
 */
async function handleExtract(director: StoryMemoryDirector) {
  try {
    const finalData = director.getFinalData();

    return NextResponse.json({
      success: true,
      data: finalData,
      isComplete: director.isComplete(),
      collectedFields: Array.from(director.getState().completedFields)
    });
  } catch (error: any) {
    console.error('Extract data error:', error);
    throw error;
  }
}

/**
 * Generate a warm closing message
 */
async function generateClosingMessage(director: StoryMemoryDirector): Promise<string> {
  const babyName = director.getState().babyName;
  const prompt = `You are a warm Story Wizard who has just finished gathering all the details for ${babyName}'s precious memory storybook.

Generate a warm, heartfelt closing message (2-3 sentences) that:
- Thanks the parent for sharing their special memories
- Expresses excitement about creating the story
- Mentions that you have everything needed to create a magical book

Be genuine, warm, and brief.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * GET /api/story-conversation?sessionId=xxx
 * Get session status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const director = sessions.get(sessionId);

    if (!director) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      state: director.getState(),
      progress: director.getCompletionPercentage(),
      isComplete: director.isComplete(),
      collectedData: director.getFinalData()
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/story-conversation?sessionId=xxx
 * Clean up a session
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    sessions.delete(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session cleaned up'
    });
  } catch (error: any) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
