import { NextRequest, NextResponse } from 'next/server';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

function extractSimpleAction(visualPrompt: string): string {
  const actions = {
    'crawling': 'crawling on the floor',
    'sitting': 'sitting happily',
    'standing': 'standing up',
    'laughing': 'laughing joyfully',
    'sleeping': 'sleeping peacefully',
    'playing': 'playing',
    'crying': 'crying',
    'eating': 'eating',
    'walking': 'taking first steps',
    'smiling': 'smiling sweetly',
    'exploring': 'exploring curiously',
    'reaching': 'reaching out',
    'clapping': 'clapping hands',
    'waving': 'waving hello',
    'hugging': 'hugging'
  };
  
  for (const [key, value] of Object.entries(actions)) {
    if (visualPrompt.toLowerCase().includes(key)) {
      return value;
    }
  }
  
  return 'being adorable';
}

export async function POST(request: NextRequest) {
  try {
    const { 
      babyPhotoUrl, 
      storyPages, 
      style, 
      bookId 
    } = await request.json();
    
    console.log('Starting image generation with:', {
      style,
      pageCount: storyPages.length,
      bookId
    });

    const results = [];
    const baseSeed = Math.floor(Math.random() * 1000000);
    
    for (let i = 0; i < storyPages.length; i++) {
      const page = storyPages[i];
      const pageSeed = baseSeed + i;
      
      // Extract simple action
      const simpleAction = extractSimpleAction(page.visual_prompt);
      
      // Create focused prompt
      const simplePrompt = `make this baby ${simpleAction}, ${style} art style, children's book illustration`;
      
      console.log(`Generating page ${i + 1} with prompt:`, simplePrompt);
      
      try {
        // Use the correct model and version
        const response = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Use flux-dev with LoRA for now as flux-kontext-pro might need different setup
            version: '8e3e22eea3e5bf685dd0190fa9f7f8e35c3a9eb551c787d217149db768204e58',
            input: {
              prompt: simplePrompt,
              num_outputs: 1,
              aspect_ratio: '1:1',
              output_format: 'webp',
              output_quality: 80,
              num_inference_steps: 28,
              guidance_scale: 3.5,
              seed: pageSeed
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Replicate API error response:', errorData);
          throw new Error(`Replicate API error: ${response.status}`);
        }

        const prediction = await response.json();
        console.log(`Started prediction ${prediction.id} for page ${i + 1}`);
        
        // Poll for completion
        let result = prediction;
        let attempts = 0;
        const maxAttempts = 60;
        
        while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const statusResponse = await fetch(
            `https://api.replicate.com/v1/predictions/${prediction.id}`,
            {
              headers: {
                'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
              }
            }
          );
          
          result = await statusResponse.json();
          attempts++;
          console.log(`Polling attempt ${attempts} for page ${i + 1}: ${result.status}`);
        }
        
        if (result.status === 'succeeded' && result.output) {
          console.log(`Successfully generated image for page ${i + 1}`);
          const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
          results.push({
            page_number: page.page_number,
            url: outputUrl,
            seed: pageSeed,
            style: style,
            predictionId: result.id
          });
        } else {
          console.error(`Failed to generate image for page ${i + 1}:`, result.error);
          results.push({
            page_number: page.page_number,
            url: `https://via.placeholder.com/800x800/E9D5FF/4C1D95?text=Page+${page.page_number}`,
            error: true
          });
        }
      } catch (error) {
        console.error(`Error generating image for page ${i + 1}:`, error);
        results.push({
          page_number: page.page_number,
          url: `https://via.placeholder.com/800x800/E9D5FF/4C1D95?text=Page+${page.page_number}`,
          error: true
        });
      }
    }
    
    console.log('Generation complete, returning results:', results.length, 'images');
    
    return NextResponse.json({ 
      success: true, 
      illustrations: results 
    });
    
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate images' },
      { status: 500 }
    );
  }
}