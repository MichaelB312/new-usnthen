// lib/layout/EnhancedLayoutEngine.ts

// ==================== Print Specifications ====================
export const CANVAS_W = 3600; // 12" @ 300dpi (single page)
export const CANVAS_H = 2400; // 8"  @ 300dpi
export const BLEED = 36;      // ~3mm
export const SAFE = 142;      // ~12mm margin
export const GUTTER = 100;    // keep faces/text out of center

// ==================== Type Definitions ====================
export type Rect = { x: number; y: number; w: number; h: number };
export type LayoutMode = "image70" | "text70" | "fullBleed" | "closeup" | "spread";
export type CanonShot = "wide" | "medium" | "closeup" | "birdseye" | "low";
export type CoreEmotion = "joy" | "curiosity" | "calm" | "pride" | "wonder";

export interface PrintSpecs {
  width_px: number;
  height_px: number;
  dpi: number;
  bleed_mm: number;
  margin_mm: number;
  gutter_mm: number;
}

export interface LayoutElement {
  type: 'image' | 'text' | 'shape';
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
  mask?: string;
  clipPath?: string;
}

export interface TextStyle {
  font_family: string;
  font_size_pt: number;
  text_align: 'left' | 'center' | 'right';
  color: string;
  line_height: number;
  background_color?: string;
  padding?: number;
  font_weight?: string;
  text_shadow?: string;
  letter_spacing?: string;
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
  mode: LayoutMode;
  debug?: {
    collisionChecks: boolean;
    safeAreaViolations: string[];
  };
}

// ==================== CONSISTENT TEXT STYLING ====================
const CUTE_TEXT_STYLE: TextStyle = {
  font_family: 'Fredoka One, Comic Sans MS, Patrick Hand, sans-serif', // Cute, rounded fonts
  font_size_pt: 96, // LARGE consistent size
  text_align: 'center',
  color: '#2D1B69', // Deep purple-black for better readability
  line_height: 1.3,
  font_weight: '900', // Extra bold
  text_shadow: '3px 3px 6px rgba(0,0,0,0.1)', // Soft shadow for depth
  letter_spacing: '0.04em' // Wider spacing for readability
};

// ==================== Cute Shape Masks ====================
const CUTE_SHAPES = {
  wave: 'M0,50 Q25,0 50,50 T100,50 L100,100 L0,100 Z',
  cloud: 'M25,60 Q25,30 50,30 Q65,10 80,30 Q100,30 100,60 Q100,80 75,80 Q50,100 25,80 Q0,80 0,60 Q0,30 25,30',
  blob: 'M50,0 Q80,10 90,40 T70,90 Q50,100 30,90 Q10,80 10,50 T30,10 Q40,0 50,0',
  flower: 'M50,0 Q60,20 50,30 Q70,35 70,50 Q60,60 50,50 Q40,60 30,50 Q30,35 50,30 Q40,20 50,0',
  star: 'M50,0 L60,35 L95,35 L70,55 L80,90 L50,70 L20,90 L30,55 L5,35 L40,35 Z',
  heart: 'M50,25 C30,0 0,10 0,35 C0,60 50,100 50,100 C50,100 100,60 100,35 C100,10 70,0 50,25',
  bubble: 'M20,50 Q20,20 50,20 Q80,20 80,50 Q80,80 50,80 Q20,80 20,50',
  squiggle: 'M0,30 Q30,10 50,30 T100,30 L100,100 L0,100 Z'
};

// ==================== Layout Mode Selection ====================
export function chooseLayoutFromShot(
  shot: string, 
  wordsCount: number
): LayoutMode {
  const s = shot.toLowerCase();
  
  if (s.includes("bird") || s.includes("overhead") || s.includes("birdseye")) {
    return "image70";
  }
  if (s.includes("close") || s.includes("closeup")) {
    return "closeup";
  }
  if (s.includes("low")) {
    return wordsCount <= 14 ? "fullBleed" : "image70";
  }
  if (s.includes("wide")) {
    return wordsCount <= 14 ? "fullBleed" : "image70";
  }
  
  return wordsCount > 16 ? "text70" : "image70";
}

// ==================== Main Layout Engine ====================
export class EnhancedLayoutEngine {
  private seed: number;
  private random: () => number;
  private specs: PrintSpecs;
  
  constructor(bookId: string, pageNumber: number) {
    const seedString = `${bookId}-${pageNumber}`;
    this.seed = this.hashCode(seedString);
    this.random = this.createSeededRandom(this.seed);
    
    this.specs = {
      width_px: CANVAS_W,
      height_px: CANVAS_H,
      dpi: 300,
      bleed_mm: 3,
      margin_mm: 12,
      gutter_mm: 10
    };
  }
  
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
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
  
  private getRandomInRange(min: number, max: number): number {
    return min + this.random() * (max - min);
  }
  
  private getRandomShape(): string {
    const shapes = Object.keys(CUTE_SHAPES);
    const index = Math.floor(this.random() * shapes.length);
    return shapes[index];
  }
  
  generateLayout(
    templateName: string,
    narration: string,
    illustrationUrl: string,
    shot?: string,
    actionId?: string,
    emotion?: string
  ): PageLayout {
    const canonShot = this.canonicalizeShot(shot);
    const wordCount = narration ? narration.split(/\s+/).length : 0;
    const mode = chooseLayoutFromShot(canonShot, wordCount);
    
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
      shot: canonShot,
      mode: mode,
      debug: {
        collisionChecks: false,
        safeAreaViolations: []
      }
    };
    
    this.createCuteLayout(layout, mode, narration, illustrationUrl, wordCount);
    layout.elements.sort((a, b) => a.zIndex - b.zIndex);
    
    return layout;
  }
  
  private createCuteLayout(
    layout: PageLayout,
    mode: LayoutMode,
    narration: string,
    illustrationUrl: string,
    wordCount: number
  ) {
    const shapeName = this.getRandomShape();
    const jitterRotation = this.getRandomInRange(-2, 2);
    
    // ALWAYS use consistent text style
    const textStyle = { ...CUTE_TEXT_STYLE };
    
    // Adjust font size slightly based on word count, but keep it large
    if (wordCount > 25) {
      textStyle.font_size_pt = 84;
    } else if (wordCount > 20) {
      textStyle.font_size_pt = 90;
    } else {
      textStyle.font_size_pt = 96;
    }
    
    switch (mode) {
      case 'fullBleed': {
        if (illustrationUrl) {
          const imageElement: LayoutElement = {
            type: 'image',
            id: 'main_image',
            x: CANVAS_W / 2,
            y: CANVAS_H / 2,
            width: CANVAS_W,
            height: CANVAS_H,
            rotation: 0,
            url: illustrationUrl,
            zIndex: 1
          };
          layout.elements.push(imageElement);
          
          // White wave overlay for text readability
          const shapeOverlay: LayoutElement = {
            type: 'shape',
            id: 'shape_overlay',
            x: CANVAS_W / 2,
            y: CANVAS_H - 600,
            width: CANVAS_W,
            height: 800,
            rotation: 0,
            style: {
              ...textStyle,
              background_color: 'rgba(255, 255, 255, 0.85)'
            },
            clipPath: `path('${CUTE_SHAPES.wave}')`,
            zIndex: 2
          };
          layout.elements.push(shapeOverlay);
        }
        
        if (narration) {
          const textElement: LayoutElement = {
            type: 'text',
            id: 'narration',
            x: CANVAS_W / 2,
            y: CANVAS_H - 400,
            width: CANVAS_W - 400,
            height: 400,
            rotation: 0,
            content: narration,
            style: textStyle,
            zIndex: 3
          };
          layout.elements.push(textElement);
        }
        break;
      }
      
      case 'image70': {
        if (illustrationUrl) {
          const imageElement: LayoutElement = {
            type: 'image',
            id: 'main_image',
            x: CANVAS_W * 0.4,
            y: CANVAS_H / 2,
            width: CANVAS_W * 0.65,
            height: CANVAS_H * 0.85,
            rotation: jitterRotation,
            url: illustrationUrl,
            mask: shapeName,
            clipPath: `url(#${shapeName}-mask)`,
            zIndex: 2
          };
          layout.elements.push(imageElement);
        }
        
        if (narration) {
          const textElement: LayoutElement = {
            type: 'text',
            id: 'narration',
            x: CANVAS_W * 0.8,
            y: CANVAS_H / 2,
            width: CANVAS_W * 0.35,
            height: CANVAS_H * 0.6,
            rotation: 0,
            content: narration,
            style: {
              ...textStyle,
              text_align: 'left' // Left align for side text
            },
            zIndex: 3
          };
          layout.elements.push(textElement);
        }
        break;
      }
      
      case 'text70': {
        if (narration) {
          const textElement: LayoutElement = {
            type: 'text',
            id: 'narration',
            x: CANVAS_W * 0.25,
            y: CANVAS_H / 2,
            width: CANVAS_W * 0.4,
            height: CANVAS_H * 0.7,
            rotation: 0,
            content: narration,
            style: {
              ...textStyle,
              text_align: 'left'
            },
            zIndex: 3
          };
          layout.elements.push(textElement);
        }
        
        if (illustrationUrl) {
          const imageElement: LayoutElement = {
            type: 'image',
            id: 'main_image',
            x: CANVAS_W * 0.7,
            y: CANVAS_H / 2,
            width: CANVAS_W * 0.5,
            height: CANVAS_H * 0.8,
            rotation: jitterRotation,
            url: illustrationUrl,
            mask: shapeName,
            clipPath: `url(#${shapeName}-mask)`,
            zIndex: 2
          };
          layout.elements.push(imageElement);
        }
        break;
      }
      
      case 'closeup': {
        if (illustrationUrl) {
          const imageElement: LayoutElement = {
            type: 'image',
            id: 'main_image',
            x: CANVAS_W / 2,
            y: CANVAS_H / 2 - 150,
            width: CANVAS_W * 0.85,
            height: CANVAS_H * 0.75,
            rotation: jitterRotation,
            url: illustrationUrl,
            mask: 'blob',
            clipPath: 'url(#blob-mask)',
            zIndex: 2
          };
          layout.elements.push(imageElement);
        }
        
        if (narration) {
          const textElement: LayoutElement = {
            type: 'text',
            id: 'narration',
            x: CANVAS_W / 2,
            y: CANVAS_H - 350,
            width: CANVAS_W - 400,
            height: 300,
            rotation: 0,
            content: narration,
            style: textStyle,
            zIndex: 3
          };
          layout.elements.push(textElement);
        }
        break;
      }
      
      case 'spread': {
        if (illustrationUrl) {
          const imageElement: LayoutElement = {
            type: 'image',
            id: 'main_image',
            x: CANVAS_W / 2,
            y: CANVAS_H / 2,
            width: CANVAS_W * 0.95,
            height: CANVAS_H * 0.85,
            rotation: 0,
            url: illustrationUrl,
            mask: 'cloud',
            clipPath: 'url(#cloud-mask)',
            zIndex: 1
          };
          layout.elements.push(imageElement);
        }
        
        if (narration) {
          const textElement: LayoutElement = {
            type: 'text',
            id: 'narration',
            x: CANVAS_W / 2,
            y: CANVAS_H - 350,
            width: CANVAS_W * 0.7,
            height: 300,
            rotation: 0,
            content: narration,
            style: textStyle,
            zIndex: 3
          };
          layout.elements.push(textElement);
        }
        break;
      }
    }
  }
  
  private canonicalizeShot(s?: string, fallback: CanonShot = "medium"): CanonShot {
    const SHOT_MAP: Record<string, CanonShot> = {
      "wide": "wide",
      "medium": "medium",
      "closeup": "closeup",
      "close-up": "closeup",
      "birdseye": "birdseye",
      "bird's-eye": "birdseye",
      "low": "low"
    };
    
    if (!s) return fallback;
    const key = s.toLowerCase().trim().replace(/[_-]/g, ' ');
    return SHOT_MAP[key] ?? fallback;
  }
}