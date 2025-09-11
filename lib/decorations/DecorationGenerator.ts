// lib/decorations/DecorationGenerator.ts
'use client';

import { HIGH_CONTRAST_SHOTS } from '@/lib/camera/highContrastShots';

export interface Decoration {
  id: string;
  type: 'band' | 'corner' | 'edge' | 'cluster' | 'accent';
  position: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  prompt: string;
  aspectRatio: string; // e.g., "1:3", "1:2", "2:3"
  width: number;
  height: number;
  x: number;
  y: number;
  imageUrl?: string;
  transparency: boolean;
  storyRelevance: string;
}

export interface SpreadDecorations {
  spreadNumber: number;
  leftPageDecorations: Decoration[];
  rightPageDecorations: Decoration[];
}

export class DecorationGenerator {
  private readonly SAFE_MARGIN = 142; // From print specs
  private readonly GUTTER = 100;
  private readonly PAGE_WIDTH = 3600;
  private readonly PAGE_HEIGHT = 2400;
  
  /**
   * Extract story cues from narration
   */
  private extractStoryCues(narration: string): {
    setting: string;
    action: string;
    mood: string;
    objects: string[];
    season?: string;
  } {
    const lowerText = narration.toLowerCase();
    
    // Extract setting
    let setting = 'indoor';
    const settingKeywords = {
      beach: ['beach', 'sand', 'ocean', 'wave', 'shore', 'sea'],
      forest: ['forest', 'tree', 'wood', 'leaf', 'branch'],
      park: ['park', 'grass', 'playground', 'swing'],
      home: ['home', 'room', 'house', 'bed', 'kitchen'],
      garden: ['garden', 'flower', 'plant'],
      water: ['water', 'pool', 'bath', 'splash'],
      city: ['city', 'street', 'building', 'apartment']
    };
    
    for (const [key, keywords] of Object.entries(settingKeywords)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        setting = key;
        break;
      }
    }
    
    // Extract action
    let action = 'playing';
    const actionKeywords = {
      running: ['run', 'race', 'dash'],
      sleeping: ['sleep', 'rest', 'nap', 'dream'],
      eating: ['eat', 'food', 'hungry', 'yum'],
      playing: ['play', 'fun', 'toy', 'game'],
      exploring: ['explore', 'discover', 'find', 'look'],
      celebrating: ['party', 'birthday', 'celebrate']
    };
    
    for (const [key, keywords] of Object.entries(actionKeywords)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        action = key;
        break;
      }
    }
    
    // Extract mood
    let mood = 'joyful';
    if (lowerText.includes('quiet') || lowerText.includes('calm')) mood = 'calm';
    if (lowerText.includes('excit')) mood = 'excited';
    if (lowerText.includes('sleep') || lowerText.includes('rest')) mood = 'peaceful';
    
    // Extract specific objects
    const objects: string[] = [];
    const objectKeywords = [
      'ball', 'duck', 'toy', 'blanket', 'bottle', 'flower', 'butterfly',
      'star', 'moon', 'sun', 'cloud', 'bird', 'shell', 'leaf', 'balloon',
      'bubble', 'kite', 'boat', 'train', 'car', 'book', 'teddy', 'bear'
    ];
    
    for (const obj of objectKeywords) {
      if (lowerText.includes(obj)) {
        objects.push(obj);
      }
    }
    
    // Extract season if mentioned
    let season: string | undefined;
    const seasons = ['spring', 'summer', 'autumn', 'fall', 'winter'];
    for (const s of seasons) {
      if (lowerText.includes(s)) {
        season = s;
        break;
      }
    }
    
    return { setting, action, mood, objects, season };
  }
  
  /**
   * Generate decoration based on story context
   */
  private generateDecoration(
    cues: ReturnType<typeof this.extractStoryCues>,
    position: Decoration['position'],
    type: Decoration['type']
  ): Decoration {
    // Create story-relevant prompt based on cues
    let prompt = 'paper collage style decorative element, ';
    let relevance = '';
    
    // Setting-specific decorations
    const settingDecorations: Record<string, string[]> = {
      beach: ['foamy wave band', 'shell cluster', 'sandy texture strip', 'seaweed ribbon'],
      forest: ['leaf spray', 'branch band', 'pine cone cluster', 'forest floor texture'],
      park: ['grass blade edge', 'flower garland', 'butterfly accent'],
      home: ['window frame edge', 'cozy corner pattern', 'toy scatter'],
      garden: ['flower bed band', 'garden fence edge', 'petal scatter'],
      water: ['ripple band', 'splash pattern', 'water droplet cluster'],
      city: ['building silhouette band', 'window grid pattern', 'city lights strip']
    };
    
    const decorOptions = settingDecorations[cues.setting] || ['geometric pattern band'];
    const selectedDecor = decorOptions[Math.floor(Math.random() * decorOptions.length)];
    
    prompt += selectedDecor;
    relevance = `Matches ${cues.setting} setting`;
    
    // Add specific objects if found
    if (cues.objects.length > 0) {
      const obj = cues.objects[0];
      prompt += `, incorporating small ${obj} motifs`;
      relevance += `, includes ${obj} from story`;
    }
    
    // Mood-based coloring
    if (cues.mood === 'calm') {
      prompt += ', soft pastel colors';
    } else if (cues.mood === 'excited') {
      prompt += ', bright vibrant colors';
    } else if (cues.mood === 'peaceful') {
      prompt += ', gentle muted tones';
    }
    
    // Season adjustments
    if (cues.season) {
      const seasonColors: Record<string, string> = {
        spring: 'fresh greens and pinks',
        summer: 'bright yellows and blues',
        autumn: 'warm oranges and reds',
        fall: 'warm oranges and reds',
        winter: 'cool blues and whites'
      };
      prompt += `, ${seasonColors[cues.season]} color palette`;
      relevance += `, ${cues.season} themed`;
    }
    
    // Aspect ratio based on type
    const aspectRatios: Record<Decoration['type'], string> = {
      band: '1:3',
      corner: '1:1',
      edge: '1:2',
      cluster: '2:3',
      accent: '1:1'
    };
    
    // Calculate dimensions and position
    const { width, height, x, y } = this.calculateDecorationBounds(
      position,
      type,
      aspectRatios[type]
    );
    
    prompt += ', transparent background PNG, paper cutout style';
    
    return {
      id: `decor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      position,
      prompt,
      aspectRatio: aspectRatios[type],
      width,
      height,
      x,
      y,
      transparency: true,
      storyRelevance: relevance
    };
  }
  
  /**
   * Calculate safe bounds for decoration placement
   */
  private calculateDecorationBounds(
    position: Decoration['position'],
    type: Decoration['type'],
    aspectRatio: string
  ): { width: number; height: number; x: number; y: number } {
    const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
    
    // Base dimensions based on type
    let baseWidth = 400;
    let baseHeight = 150;
    
    switch (type) {
      case 'band':
        baseWidth = 600;
        baseHeight = 200;
        break;
      case 'corner':
        baseWidth = 250;
        baseHeight = 250;
        break;
      case 'edge':
        baseWidth = 450;
        baseHeight = 225;
        break;
      case 'cluster':
        baseWidth = 300;
        baseHeight = 200;
        break;
      case 'accent':
        baseWidth = 150;
        baseHeight = 150;
        break;
    }
    
    // Apply aspect ratio
    const width = baseWidth;
    const height = Math.round(baseWidth * (heightRatio / widthRatio));
    
    // Calculate position based on placement
    let x = 0;
    let y = 0;
    
    switch (position) {
      case 'top':
        x = this.PAGE_WIDTH / 2 - width / 2;
        y = this.SAFE_MARGIN;
        break;
      case 'bottom':
        x = this.PAGE_WIDTH / 2 - width / 2;
        y = this.PAGE_HEIGHT - this.SAFE_MARGIN - height;
        break;
      case 'left':
        x = this.SAFE_MARGIN;
        y = this.PAGE_HEIGHT / 2 - height / 2;
        break;
      case 'right':
        x = this.PAGE_WIDTH - this.SAFE_MARGIN - width;
        y = this.PAGE_HEIGHT / 2 - height / 2;
        break;
      case 'top-left':
        x = this.SAFE_MARGIN;
        y = this.SAFE_MARGIN;
        break;
      case 'top-right':
        x = this.PAGE_WIDTH - this.SAFE_MARGIN - width;
        y = this.SAFE_MARGIN;
        break;
      case 'bottom-left':
        x = this.SAFE_MARGIN;
        y = this.PAGE_HEIGHT - this.SAFE_MARGIN - height;
        break;
      case 'bottom-right':
        x = this.PAGE_WIDTH - this.SAFE_MARGIN - width;
        y = this.PAGE_HEIGHT - this.SAFE_MARGIN - height;
        break;
    }
    
    // Ensure not crossing gutter for single page
    if (x + width > this.PAGE_WIDTH / 2 - this.GUTTER / 2 && x < this.PAGE_WIDTH / 2) {
      // Adjust to stay on left side
      x = Math.min(x, this.PAGE_WIDTH / 2 - this.GUTTER / 2 - width);
    }
    
    return { width, height, x, y };
  }
  
  /**
   * Generate decorations for a spread
   */
  public generateSpreadDecorations(
    spreadNumber: number,
    leftPageNarration: string,
    rightPageNarration: string
  ): SpreadDecorations {
    const leftCues = this.extractStoryCues(leftPageNarration);
    const rightCues = this.extractStoryCues(rightPageNarration);
    
    // Choose decoration positions that don't interfere
    const leftPositions: Decoration['position'][] = ['top-left', 'bottom-right'];
    const rightPositions: Decoration['position'][] = ['top-right', 'bottom-left'];
    
    // Generate 1-2 decorations per page
    const leftDecorations: Decoration[] = [];
    const rightDecorations: Decoration[] = [];
    
    // Left page decorations
    const leftDecorCount = Math.random() > 0.5 ? 2 : 1;
    for (let i = 0; i < leftDecorCount && i < leftPositions.length; i++) {
      const type: Decoration['type'] = i === 0 ? 'band' : 'accent';
      leftDecorations.push(
        this.generateDecoration(leftCues, leftPositions[i], type)
      );
    }
    
    // Right page decorations
    const rightDecorCount = Math.random() > 0.5 ? 2 : 1;
    for (let i = 0; i < rightDecorCount && i < rightPositions.length; i++) {
      const type: Decoration['type'] = i === 0 ? 'edge' : 'cluster';
      rightDecorations.push(
        this.generateDecoration(rightCues, rightPositions[i], type)
      );
    }
    
    return {
      spreadNumber,
      leftPageDecorations: leftDecorations,
      rightPageDecorations: rightDecorations
    };
  }
}

// API route for generating decoration images
export async function generateDecorationImage(decoration: Decoration): Promise<string> {
  try {
    const response = await fetch('/api/generate-decoration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: decoration.prompt,
        width: decoration.width,
        height: decoration.height,
        aspectRatio: decoration.aspectRatio
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate decoration');
    }
    
    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error('Decoration generation error:', error);
    // Return placeholder for now
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjUwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiIGZpbGw9IiNmMGYwZjAiLz48L3N2Zz4=';
  }
}