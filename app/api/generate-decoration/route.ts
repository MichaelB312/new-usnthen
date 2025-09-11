// app/api/generate-decoration/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, width, height, aspectRatio } = await request.json();
    
    // Generate decoration image using DALL-E
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `${prompt}, isolated on transparent background, paper collage cutout style, decorative element only`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json'
    });
    
    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) {
      throw new Error('No image data in response');
    }
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    
    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
      width: width,
      height: height,
      aspectRatio: aspectRatio
    });
    
  } catch (error: any) {
    console.error('Decoration generation error:', error);
    
    // Get width and height from request body for placeholder
    const { width = 400, height = 200, aspectRatio = '2:1' } = await request.json().catch(() => ({}));
    
    // Return placeholder decoration for development
    const placeholderSVG = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="paper" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#f0f0f0"/>
            <circle cx="20" cy="20" r="15" fill="#e0e0e0" opacity="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#paper)" rx="5"/>
      </svg>
    `;
    
    const base64 = Buffer.from(placeholderSVG).toString('base64');
    const placeholderUrl = `data:image/svg+xml;base64,${base64}`;
    
    return NextResponse.json({
      success: true,
      imageUrl: placeholderUrl,
      width: width,
      height: height,
      aspectRatio: aspectRatio,
      isPlaceholder: true
    });
  }
}