// app/api/test-model/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(request: NextRequest) {
  const results: any = {};
  
  console.log('Testing OpenAI model availability...');
  
  // Test 1: Try GPT-IMAGE-1
  try {
    console.log('Testing GPT-IMAGE-1...');
    // Create a tiny test image
    const testImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    const file = new File([testImage], 'test.png', { type: 'image/png' });
    
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: file,
      prompt: 'test',
      n: 1
    } as any);
    
    results.gptImage1 = {
      available: true,
      response: response.data?.[0] ? 'Success' : 'No data',
      model: 'gpt-image-1'
    };
    console.log('✅ GPT-IMAGE-1 is available!');
  } catch (error: any) {
    results.gptImage1 = {
      available: false,
      error: error.message,
      code: error.code,
      type: error.type
    };
    console.log('❌ GPT-IMAGE-1 failed:', error.message);
  }
  
  // Test 2: Try DALL-E-2
  try {
    console.log('Testing DALL-E-2...');
    const testImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    const file = new File([testImage], 'test.png', { type: 'image/png' });
    
    const response = await openai.images.edit({
      model: 'dall-e-2',
      image: file,
      prompt: 'test',
      n: 1,
      size: '256x256', // Smallest size to save costs
      response_format: 'url'
    });
    
    results.dallE2 = {
      available: true,
      response: response.data?.[0] ? 'Success' : 'No data',
      model: 'dall-e-2'
    };
    console.log('✅ DALL-E-2 is available!');
  } catch (error: any) {
    results.dallE2 = {
      available: false,
      error: error.message,
      code: error.code
    };
    console.log('❌ DALL-E-2 failed:', error.message);
  }
  
  // Test 3: Check what happens with invalid model
  try {
    console.log('Testing invalid model fallback...');
    const testImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    const file = new File([testImage], 'test.png', { type: 'image/png' });
    
    const response = await openai.images.edit({
      model: 'invalid-model-name',
      image: file,
      prompt: 'test',
      n: 1
    } as any);
    
    results.invalidModel = {
      response: 'Worked somehow',
      data: response.data?.[0] ? 'Has data' : 'No data'
    };
  } catch (error: any) {
    results.invalidModel = {
      error: error.message,
      note: 'This should fail'
    };
  }
  
  return NextResponse.json({
    results,
    summary: {
      gptImage1Available: results.gptImage1?.available || false,
      dallE2Available: results.dallE2?.available || false,
      recommendation: results.gptImage1?.available 
        ? 'Use GPT-IMAGE-1' 
        : 'Use DALL-E-2 (GPT-IMAGE-1 not available)'
    },
    timestamp: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}