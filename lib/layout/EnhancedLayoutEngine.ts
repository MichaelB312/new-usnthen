// lib/layout/EnhancedLayoutEngine.ts
/**
 * Simplified Layout Engine - Focus on clean, consistent layouts
 */

// Print specifications (12" x 8" @ 300dpi)
export const CANVAS_W = 3600;
export const CANVAS_H = 2400;
export const BLEED = 36;
export const SAFE = 142;
export const GUTTER = 100;

export type Rect = { x: number; y: number; w: number; h: number };

export interface LayoutElement {
  type: 'image' | 'text';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content?: string;
  url?: string;
  style?: TextStyle;
  zIndex: number;
}

export interface TextStyle {
  font_family: string;
  font_size_pt: number;
  text_align: 'left' | 'center' | 'right';
  color: string;
  line_height: number;
  font_weight?: string;
}

export interface PageLayout {
  canvas: {
    width: number;
    height: number;
    dpi: number;
    bleed: number;
    margin: number;
    gutter: number;
  };
  elements: LayoutElement[];
  safeArea: Rect;
  bleedArea: Rect;
  gutterArea: Rect;
  seed: number;
  template: string;
  shot: string;
  mode: 'simple' | 'text-left' | 'text-right' | 'text-bottom';
}

// Consistent text styling for toddler books
const TODDLER_TEXT_STYLE: TextStyle = {
  font_family: 'Patrick Hand, Comic Sans MS, sans-serif',
  font_size_pt: 72,
  text_align: 'center',
  color: '#2D1B69',
  line_height: 1.4,
  font_weight: '700'
};

export class EnhancedLayoutEngine {
  private seed: number;
  private random: () => number;
  
  constructor(bookId: string, pageNumber: number) {
    const seedString = `${bookId}-${pageNumber}`;
    this.seed = this.hashCode(seedString);
    this.random = this.createSeededRandom(this.seed);
  }
  
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
    }
    return Math.abs(hash);
  }
  
  private createSeededRandom(seed: number) {
    let currentSeed = seed;
    return () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
  }
  
  generateLayout(
templateName: string, narration: string, illustrationUrl: string, shot?: string, action_id?: string | undefined, emotion?: string | undefined  ): PageLayout {
    const wordCount = narration ? narration.split(/\s+/).length : 0;
    const mode = this.chooseLayoutMode(shot, wordCount);
    
    const layout: PageLayout = {
      canvas: {
        width: CANVAS_W,
        height: CANVAS_H,
        dpi: 300,
        bleed: BLEED,
        margin: SAFE,
        gutter: GUTTER
      },
      elements: [],
      safeArea: {
        x: SAFE,
        y: SAFE,
        w: CANVAS_W - 2 * SAFE,
        h: CANVAS_H - 2 * SAFE
      },
      bleedArea: {
        x: -BLEED,
        y: -BLEED,
        w: CANVAS_W + 2 * BLEED,
        h: CANVAS_H + 2 * BLEED
      },
      gutterArea: {
        x: CANVAS_W / 2 - GUTTER / 2,
        y: 0,
        w: GUTTER,
        h: CANVAS_H
      },
      seed: this.seed,
      template: templateName,
      shot: shot || 'medium',
      mode
    };
    
    this.createSimpleLayout(layout, mode, narration, illustrationUrl, wordCount);
    layout.elements.sort((a, b) => a.zIndex - b.zIndex);
    
    return layout;
  }
  
  private chooseLayoutMode(
    shot?: string, 
    wordCount?: number
  ): PageLayout['mode'] {
    // Simple decision tree
    if (!shot) return 'simple';
    
    const s = shot.toLowerCase();
    
    // Wide shots: text at bottom
    if (s.includes('wide') || s.includes('birds')) {
      return 'text-bottom';
    }
    
    // Close shots: text on side
    if (s.includes('close') || s.includes('macro')) {
      return wordCount && wordCount > 10 ? 'text-left' : 'text-right';
    }
    
    // Default: simple centered layout
    return 'simple';
  }
  
  private createSimpleLayout(
    layout: PageLayout,
    mode: PageLayout['mode'],
    narration: string,
    illustrationUrl: string,
    wordCount: number
  ) {
    // Adjust text size based on word count
    const textStyle = { ...TODDLER_TEXT_STYLE };
    if (wordCount > 20) {
      textStyle.font_size_pt = 56;
    } else if (wordCount > 15) {
      textStyle.font_size_pt = 64;
    }
    
    // Slight random rotation for playful feel
    const imageRotation = this.random() * 4 - 2; // -2 to +2 degrees
    
    switch (mode) {
      case 'simple': {
        // Full page image with text overlay at bottom
        if (illustrationUrl) {
          layout.elements.push({
            type: 'image',
            id: 'main_image',
            x: CANVAS_W / 2,
            y: CANVAS_H / 2,
            width: CANVAS_W - 2 * SAFE,
            height: CANVAS_H - 2 * SAFE,
            rotation: 0,
            url: illustrationUrl,
            zIndex: 1
          });
        }
        
        if (narration) {
          layout.elements.push({
            type: 'text',
            id: 'narration',
            x: CANVAS_W / 2,
            y: CANVAS_H - 400,
            width: CANVAS_W - 400,
            height: 300,
            rotation: 0,
            content: narration,
            style: textStyle,
            zIndex: 2
          });
        }
        break;
      }
      
      case 'text-left': {
        // Text on left, image on right
        if (narration) {
          layout.elements.push({
            type: 'text',
            id: 'narration',
            x: CANVAS_W * 0.25,
            y: CANVAS_H / 2,
            width: CANVAS_W * 0.35,
            height: CANVAS_H * 0.6,
            rotation: 0,
            content: narration,
            style: { ...textStyle, text_align: 'left' },
            zIndex: 2
          });
        }
        
        if (illustrationUrl) {
          layout.elements.push({
            type: 'image',
            id: 'main_image',
            x: CANVAS_W * 0.7,
            y: CANVAS_H / 2,
            width: CANVAS_W * 0.5,
            height: CANVAS_H * 0.8,
            rotation: imageRotation,
            url: illustrationUrl,
            zIndex: 1
          });
        }
        break;
      }
      
      case 'text-right': {
        // Image on left, text on right
        if (illustrationUrl) {
          layout.elements.push({
            type: 'image',
            id: 'main_image',
            x: CANVAS_W * 0.3,
            y: CANVAS_H / 2,
            width: CANVAS_W * 0.5,
            height: CANVAS_H * 0.8,
            rotation: imageRotation,
            url: illustrationUrl,
            zIndex: 1
          });
        }
        
        if (narration) {
          layout.elements.push({
            type: 'text',
            id: 'narration',
            x: CANVAS_W * 0.75,
            y: CANVAS_H / 2,
            width: CANVAS_W * 0.35,
            height: CANVAS_H * 0.6,
            rotation: 0,
            content: narration,
            style: { ...textStyle, text_align: 'left' },
            zIndex: 2
          });
        }
        break;
      }
      
      case 'text-bottom': {
        // Large image top, text bottom
        if (illustrationUrl) {
          layout.elements.push({
            type: 'image',
            id: 'main_image',
            x: CANVAS_W / 2,
            y: CANVAS_H * 0.4,
            width: CANVAS_W * 0.9,
            height: CANVAS_H * 0.65,
            rotation: 0,
            url: illustrationUrl,
            zIndex: 1
          });
        }
        
        if (narration) {
          layout.elements.push({
            type: 'text',
            id: 'narration',
            x: CANVAS_W / 2,
            y: CANVAS_H - 300,
            width: CANVAS_W - 400,
            height: 250,
            rotation: 0,
            content: narration,
            style: textStyle,
            zIndex: 2
          });
        }
        break;
      }
    }
  }
}