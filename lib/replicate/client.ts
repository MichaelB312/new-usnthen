export class ReplicateClient {
  private apiToken: string;
  
  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }
  
  async generateImage(params: {
    prompt: string;
    referenceImage: string;
    style: string;
    seed?: number;
  }) {
    // Start prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'black-forest-labs/flux-1.1-pro',
        input: {
          prompt: params.prompt,
          aspect_ratio: '1:1',
          output_format: 'png',
          output_quality: 95,
          safety_tolerance: 2,
          seed: params.seed
        }
      })
    });

    const prediction = await response.json();
    
    // Poll for completion
    return this.pollPrediction(prediction.id);
  }
  
  async generateWithKontext(params: {
    prompt: string;
    referenceImageUrl: string;
    style: string;
    seed?: number;
    pageNumber: number;
  }) {
    const enhancedPrompt = `${params.prompt}, in ${params.style} art style, children's book illustration, consistent character`;
    
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'black-forest-labs/flux-dev-lora',
        input: {
          model: 'dev',
          lora_scale: 1,
          num_outputs: 1,
          aspect_ratio: '1:1',
          output_format: 'png',
          guidance_scale: 3.5,
          output_quality: 95,
          prompt: enhancedPrompt,
          num_inference_steps: 28,
          disable_safety_checker: false,
          seed: params.seed || Math.floor(Math.random() * 1000000)
        }
      })
    });

    const prediction = await response.json();
    return this.pollPrediction(prediction.id);
  }
  
  private async pollPrediction(predictionId: string, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          }
        }
      );
      
      const result = await response.json();
      
      if (result.status === 'succeeded') {
        return {
          success: true,
          output: result.output,
          id: result.id
        };
      } else if (result.status === 'failed') {
        throw new Error(`Prediction failed: ${result.error}`);
      }
    }
    
    throw new Error('Prediction timeout');
  }
}