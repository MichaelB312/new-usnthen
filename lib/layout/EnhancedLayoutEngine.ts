// lib/layout/EnhancedLayoutEngine.ts

// ==================== Print Specifications ====================
export const CANVAS_W = 3600; // 12" @ 300dpi
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
  
  // Default logic based on word count
  return wordsCount > 16 ? "text70" : "image70";
}

// ==================== Frame Computation ====================
export function computeFrames(
  mode: LayoutMode,
  imageAR: number = 1.5 // default aspect ratio
): { imageFrame: Rect; textFrame?: Rect; safeRect: Rect; gutterRect: Rect } {
  const safeRect: Rect = { 
    x: SAFE, 
    y: SAFE, 
    w: CANVAS_W - 2 * SAFE, 
    h: CANVAS_H - 2 * SAFE 
  };
  
  const gutterRect: Rect = { 
    x: CANVAS_W / 2 - GUTTER / 2, 
    y: 0, 
    w: GUTTER, 
    h: CANVAS_H 
  };

  switch (mode) {
    case "fullBleed": {
      return { 
        imageFrame: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H }, 
        safeRect, 
        gutterRect 
      };
    }
    
    case "image70": {
      const iw = Math.round(safeRect.w * 0.66);
      const ih = Math.min(Math.round(iw / imageAR), safeRect.h);
      const adjW = Math.round(ih * imageAR);
      const imageFrame: Rect = { 
        x: safeRect.x, 
        y: safeRect.y + (safeRect.h - ih) / 2, 
        w: adjW, 
        h: ih 
      };
      const textFrame: Rect = { 
        x: imageFrame.x + imageFrame.w + 40, 
        y: safeRect.y, 
        w: safeRect.w - adjW - 40, 
        h: safeRect.h 
      };
      return { imageFrame, textFrame, safeRect, gutterRect };
    }
    
    case "text70": {
      const textFrame: Rect = { 
        x: safeRect.x, 
        y: safeRect.y, 
        w: Math.round(safeRect.w * 0.62), 
        h: safeRect.h 
      };
      const iw = Math.round(safeRect.w - textFrame.w - 40);
      const ih = Math.min(Math.round(iw / imageAR), safeRect.h);
      const imageFrame: Rect = { 
        x: textFrame.x + textFrame.w + 40, 
        y: safeRect.y + (safeRect.h - ih) / 2, 
        w: iw, 
        h: ih 
      };
      return { imageFrame, textFrame, safeRect, gutterRect };
    }
    
    case "closeup": {
      const iw = Math.round(safeRect.w * 0.85);
      const ih = Math.min(Math.round(iw / imageAR), safeRect.h);
      const imageFrame: Rect = { 
        x: safeRect.x + (safeRect.w - iw) / 2, 
        y: safeRect.y + (safeRect.h - ih) / 2, 
        w: iw, 
        h: ih 
      };
      const textFrame: Rect = { 
        x: safeRect.x + 40, 
        y: safeRect.y + safeRect.h - 360, 
        w: safeRect.w - 80, 
        h: 300 
      };
      return { imageFrame, textFrame, safeRect, gutterRect };
    }
    
    case "spread": {
      // Fill safe area; actual double-page compositing occurs at export
      return { 
        imageFrame: safeRect, 
        safeRect, 
        gutterRect 
      };
    }
  }
}

// ==================== Character Scale Rules ====================
export function getCharacterScaleForShot(shot: CanonShot): number {
  switch (shot) {
    case "closeup":
      return 0.9; // Up to 90% for close-ups
    case "birdseye":
      return 0.25; // 20-30% for exploration/bird's-eye
    case "wide":
      return 0.3; // Smaller in wide shots
    case "medium":
      return 0.55; // Default 50-60%
    case "low":
      return 0.6; // Slightly larger for dramatic effect
    default:
      return 0.5;
  }
}

// Baby-friendly color palettes
const TEXT_COLORS = {
  default: '#2D1B69',     // Deep purple
  warm: '#D2386C',        // Warm pink
  playful: '#FF6B35',     // Orange
  calm: '#4ECDC4',        // Teal
  happy: '#FFD93D'        // Yellow
};

// Toddler-friendly fonts
const BABY_FONTS = [
  'Comic Sans MS',
  'Patrick Hand',
  'Caveat',
  'Fredoka One',
  'Bubblegum Sans',
  'Arial Rounded MT Bold'
];

// ==================== Main Layout Engine ====================
export class EnhancedLayoutEngine {
  private seed: number;
  private random: () => number;
  private specs: PrintSpecs;
  
  // Convert mm to pixels at 300 DPI
  private mmToPx = (mm: number) => Math.round((mm / 25.4) * 300);
  
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
  
  private getTextColorForEmotion(emotion?: string): string {
    switch(emotion) {
      case 'joy': return TEXT_COLORS.happy;
      case 'curiosity': return TEXT_COLORS.playful;
      case 'calm': return TEXT_COLORS.calm;
      case 'pride': return TEXT_COLORS.warm;
      default: return TEXT_COLORS.default;
    }
  }
  
  generateLayout(
    templateName: string,
    narration: string,
    illustrationUrl: string,
    shot?: string,
    actionId?: string,
    emotion?: string
  ): PageLayout {
    // Get canonical shot type
    const canonShot = this.canonicalizeShot(shot);
    
    // Count words for layout decision
    const wordCount = narration ? narration.split(/\s+/).length : 0;
    
    // Choose layout mode based on shot and word count
    const mode = chooseLayoutFromShot(canonShot, wordCount);
    
    // Compute frames for this mode
    const frames = computeFrames(mode);
    
    // Get character scale
    const characterScale = getCharacterScaleForShot(canonShot);
    
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
      safeArea: frames.safeRect,
      bleedArea: {
        x: -BLEED,
        y: -BLEED,
        w: CANVAS_W + 2 * BLEED,
        h: CANVAS_H + 2 * BLEED
      },
      gutterArea: frames.gutterRect,
      seed: this.seed,
      template: templateName,
      shot: canonShot,
      mode: mode,
      debug: {
        collisionChecks: false,
        safeAreaViolations: []
      }
    };
    
    // Place main image with character scale
    if (illustrationUrl && frames.imageFrame) {
      const jitterX = this.getRandomInRange(-10, 10);
      const jitterY = this.getRandomInRange(-10, 10);
      const jitterRotation = this.getRandomInRange(-1, 1);
      
      // Apply character scale to image dimensions
      const scaledWidth = frames.imageFrame.w * characterScale;
      const scaledHeight = frames.imageFrame.h * characterScale;
      
      const imageElement: LayoutElement = {
        type: 'image',
        id: 'main_image',
        x: frames.imageFrame.x + frames.imageFrame.w / 2 + jitterX,
        y: frames.imageFrame.y + frames.imageFrame.h / 2 + jitterY,
        width: scaledWidth,
        height: scaledHeight,
        rotation: jitterRotation,
        url: illustrationUrl,
        zIndex: 2
      };
      
      // Ensure image avoids gutter
      this.avoidGutter(imageElement, frames.gutterRect);
      layout.elements.push(imageElement);
    }
    
    // Place text with toddler-friendly sizing
    if (narration && frames.textFrame) {
      const textJitterX = this.getRandomInRange(-5, 5);
      const textJitterY = this.getRandomInRange(-5, 5);
      const textJitterRotation = this.getRandomInRange(-0.5, 0.5);
      
      // Calculate font size based on word count (42-56pt for toddlers)
      const baseFontSize = wordCount <= 10 ? 56 : wordCount <= 15 ? 48 : 42;
      
      // Text background plaque
      const plaquePadding = 30;
      const plaqueElement: LayoutElement = {
        type: 'text',
        id: 'text_plaque',
        x: frames.textFrame.x + frames.textFrame.w / 2 + textJitterX,
        y: frames.textFrame.y + frames.textFrame.h / 2 + textJitterY,
        width: frames.textFrame.w + plaquePadding * 2,
        height: frames.textFrame.h + plaquePadding * 2,
        rotation: textJitterRotation,
        style: {
          font_family: '',
          font_size_pt: 0,
          text_align: 'center',
          color: '',
          line_height: 0,
          background_color: 'rgba(255, 255, 255, 0.95)'
        },
        zIndex: 3
      };
      
      // Text element
      const textElement: LayoutElement = {
        type: 'text',
        id: 'narration',
        x: frames.textFrame.x + frames.textFrame.w / 2 + textJitterX,
        y: frames.textFrame.y + frames.textFrame.h / 2 + textJitterY,
        width: frames.textFrame.w,
        height: frames.textFrame.h,
        rotation: textJitterRotation,
        content: narration,
        style: {
          font_family: BABY_FONTS[0],
          font_size_pt: baseFontSize,
          text_align: mode === 'text70' ? 'left' : 'center',
          color: this.getTextColorForEmotion(emotion),
          line_height: 1.6,
          font_weight: '700',
          text_shadow: '2px 2px 4px rgba(0,0,0,0.1)',
          letter_spacing: '0.02em'
        },
        zIndex: 4
      };
      
      // Ensure text avoids gutter
      this.avoidGutter(textElement, frames.gutterRect);
      this.avoidGutter(plaqueElement, frames.gutterRect);
      
      layout.elements.push(plaqueElement);
      layout.elements.push(textElement);
    }
    
    // Sort by z-index
    layout.elements.sort((a, b) => a.zIndex - b.zIndex);
    
    // Check for collisions and safe area violations
    layout.debug!.collisionChecks = this.checkCollisions(layout);
    this.checkSafeAreaViolations(layout);
    
    return layout;
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
  
  private avoidGutter(element: LayoutElement, gutterArea: Rect) {
    const elementLeft = element.x - element.width / 2;
    const elementRight = element.x + element.width / 2;
    const gutterLeft = gutterArea.x;
    const gutterRight = gutterArea.x + gutterArea.w;
    
    // Check if element overlaps with gutter
    if (elementLeft < gutterRight && elementRight > gutterLeft) {
      const leftDistance = gutterLeft - elementLeft;
      const rightDistance = elementRight - gutterRight;
      
      // Move to the side with more space
      if (leftDistance < rightDistance) {
        element.x = gutterLeft - element.width / 2 - 20;
      } else {
        element.x = gutterRight + element.width / 2 + 20;
      }
    }
  }
  
  private checkCollisions(layout: PageLayout): boolean {
    for (let i = 0; i < layout.elements.length; i++) {
      for (let j = i + 1; j < layout.elements.length; j++) {
        const a = layout.elements[i];
        const b = layout.elements[j];
        
        // Skip plaque-text pairs
        if ((a.id === 'text_plaque' && b.id === 'narration') ||
            (b.id === 'text_plaque' && a.id === 'narration')) continue;
        
        if (this.isColliding(a, b)) {
          return true;
        }
      }
    }
    return false;
  }
  
  private isColliding(a: LayoutElement, b: LayoutElement): boolean {
    const aLeft = a.x - a.width / 2;
    const aRight = a.x + a.width / 2;
    const aTop = a.y - a.height / 2;
    const aBottom = a.y + a.height / 2;
    
    const bLeft = b.x - b.width / 2;
    const bRight = b.x + b.width / 2;
    const bTop = b.y - b.height / 2;
    const bBottom = b.y + b.height / 2;
    
    return !(aRight < bLeft || aLeft > bRight || aBottom < bTop || aTop > bBottom);
  }
  
  private checkSafeAreaViolations(layout: PageLayout) {
    const safe = layout.safeArea;
    
    layout.elements.forEach(element => {
      const left = element.x - element.width / 2;
      const right = element.x + element.width / 2;
      const top = element.y - element.height / 2;
      const bottom = element.y + element.height / 2;
      
      const violations = [];
      if (left < safe.x) violations.push('left');
      if (right > safe.x + safe.w) violations.push('right');
      if (top < safe.y) violations.push('top');
      if (bottom > safe.y + safe.h) violations.push('bottom');
      
      if (violations.length > 0 && layout.debug) {
        layout.debug.safeAreaViolations.push(
          `${element.id}: ${violations.join(', ')}`
        );
      }
    });
  }
}