/**
 * AI-Powered Guide Conversation API (3.0)
 *
 * Uses Gemini AI to conduct natural conversations while collecting
 * structured data based on book type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BookTypeDirector } from '@/lib/agents/BookTypeDirector';
import { BookType, WritingStyle } from '@/lib/types/bookTypes3';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 1024,
  }
});

// Session storage (in production, use Redis or similar)
const sessions = new Map<string, BookTypeDirector>();

// Clean up old sessions every 30 minutes
setInterval(() => {
  if (sessions.size > 100) {
    sessions.clear();
  }
}, 30 * 60 * 1000);

interface ConversationRequest {
  sessionId: string;
  babyName: string;
  bookType: BookType;
  writingStyle: WritingStyle | null;
  userMessage?: string;
  action: 'start' | 'continue';
  locale?: string;
}

/**
 * POST /api/guide-conversation
 * Main conversation endpoint for 3.0 system
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConversationRequest = await request.json();
    const {
      sessionId,
      babyName,
      bookType,
      writingStyle,
      userMessage,
      action,
      locale = 'en'
    } = body;

    if (!sessionId || !babyName || !bookType) {
      return NextResponse.json(
        { error: 'Session ID, baby name, and book type required' },
        { status: 400 }
      );
    }

    // Get or create director for this session
    let director = sessions.get(sessionId);
    if (!director) {
      director = new BookTypeDirector(sessionId, babyName, bookType, writingStyle, locale);
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

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Guide Conversation] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Start a new conversation
 */
async function handleStart(director: BookTypeDirector) {
  try {
    const systemPrompt = director.getSystemPrompt();
    const nextPromptInstruction = director.getNextPromptInstruction();

    // Generate opening message using Gemini
    const prompt = `${systemPrompt}

${nextPromptInstruction}

Generate a warm opening message to start the conversation.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Save assistant message to history
    director.addMessage('model', response);

    return NextResponse.json({
      success: true,
      message: response,
      progress: director.getCompletionPercentage(),
      isComplete: director.isComplete(),
      collectedFields: Array.from(director.getState().completedFields)
    });
  } catch (error: any) {
    console.error('[Guide Conversation] Start error:', error);
    throw error;
  }
}

/**
 * Continue the conversation with user input
 */
async function handleContinue(director: BookTypeDirector, userMessage: string) {
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
      const jsonText = extractionText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      extractedData = JSON.parse(jsonText);

      console.log('[Guide Conversation] Extracted data:', extractedData);

      // Update director's state with extracted data
      director.updateCollectedData(extractedData);
    } catch (parseError) {
      console.warn('[Guide Conversation] Failed to parse extraction:', parseError);
      // Continue anyway - we'll ask for clarification
    }

    // Step 2: Check if we're done
    if (director.isComplete()) {
      const closingMessage = await generateClosingMessage(director);
      director.addMessage('model', closingMessage);

      return NextResponse.json({
        success: true,
        message: closingMessage,
        progress: 100,
        isComplete: true,
        collectedData: director.getFinalData(),
        collectedFields: Array.from(director.getState().completedFields)
      });
    }

    // Step 3: Generate next question using Gemini with full conversation context
    const conversationHistory = director.getConversationHistory();

    // Filter history: Gemini requires first message to be 'user', not 'model'
    // Skip the initial greeting (which is 'model') when building chat history
    const filteredHistory = conversationHistory.filter((msg, idx) => {
      // Keep all user messages
      if (msg.role === 'user') return true;
      // For model messages, only keep if there's a user message before it
      return idx > 0 && conversationHistory[idx - 1].role === 'user';
    });

    // Create chat with filtered history
    const chat = model.startChat({
      history: filteredHistory
    });

    const systemPrompt = director.getSystemPrompt();
    const nextPromptInstruction = director.getNextPromptInstruction();

    const nextQuestionPrompt = `${systemPrompt}

${nextPromptInstruction}

Based on the conversation so far, ask the next most natural question.`;

    const result = await chat.sendMessage(nextQuestionPrompt);
    const nextMessage = result.response.text();

    // Save assistant message
    director.addMessage('model', nextMessage);

    return NextResponse.json({
      success: true,
      message: nextMessage,
      progress: director.getCompletionPercentage(),
      isComplete: false,
      extractedData, // For debugging
      collectedFields: Array.from(director.getState().completedFields)
    });
  } catch (error: any) {
    console.error('[Guide Conversation] Continue error:', error);
    throw error;
  }
}

/**
 * Generate closing message
 */
async function generateClosingMessage(director: BookTypeDirector): Promise<string> {
  const state = director.getState();
  const systemPrompt = director.getSystemPrompt();

  const prompt = `${systemPrompt}

All information has been collected! Generate an enthusiastic closing message that:
1. Thanks them for sharing their beautiful story about ${state.babyName}
2. Confirms you have everything needed
3. Builds excitement about creating their magical book
4. Keeps it warm and personal

Generate the closing message now.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('[Guide Conversation] Closing message error:', error);
    return `Thank you so much for sharing all these wonderful details about ${state.babyName}! I have everything I need to create your beautiful book. Let's make some magic! ✨`;
  }
}
