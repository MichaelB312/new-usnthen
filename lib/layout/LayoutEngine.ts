// lib/layout/LayoutEngine.ts

// ==================== Type Definitions ====================
export type CanonShot = "wide" | "medium" | "closeup" | "birdseye" | "low";
export type CoreEmotion = "joy" | "curiosity" | "calm" | "pride" | "wonder";
export type LayoutTemplate = "hero_spread" | "action_focus" | "portrait_emphasis" | "collage" | "closing_spread";

export interface PrintSpecs {
  width_px: number;      // 3600px
  height_px: number;     // 2400px  
  dpi: number;          // 300
  bleed_mm: number;     // 3mm
  margin_mm: number;    // 12mm
  gutter_mm: number;    // 10mm
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
  safeArea: { x: number; y: number; width: number; height: number };
  bleedArea: { x: number; y: number; width: number; height: number };
  gutterArea: { x: number; y: number; width: number; height: number };
  seed: number;
  template: string;
  shot: string;
  debug?: {
    collisionChecks: boolean;
    safeAreaViolations: string[];
  };
}

// ==================== Canonicalizers ====================
const SHOT_MAP: Record<string, CanonShot> = {
  "wide": "wide",
  "establishing": "wide",
  "panoramic": "wide",
  "full": "wide",
  "medium": "medium",
  "two-shot": "medium",
  "mid": "medium",
  "half": "medium",
  "closeup": "closeup",
  "close-up": "closeup",
  "close": "closeup",
  "extreme close-up": "closeup",
  "ecu": "closeup",
  "macro": "closeup",
  "birdseye": "birdseye",
  "bird's-eye": "birdseye",
  "overhead": "birdseye",
  "top-down": "birdseye",
  "aerial": "birdseye",
  "low": "low",
  "worm's-eye": "low",
  "low angle": "low",
  "ground": "low"
};

export function canonicalizeShot(s?: string, fallback: CanonShot = "medium"): CanonShot {
  if (!s) return fallback;
  const key = s.toLowerCase().trim().replace(/[_-]/g, ' ');
  return SHOT_MAP[key] ?? fallback;
}

export function canonicalizeEmotion(e?: string): CoreEmotion {
  const key = (e || "").toLowerCase();
  if (["joy", "curiosity", "calm", "pride", "wonder"].includes(key)) {
    return key as CoreEmotion;
  }
  return "joy"; // Safe default for toddlers
}

// ==================== Layout Templates ====================
const LAYOUT_CONFIGS: Record<LayoutTemplate, any> = {
  hero_spread: {
    name: "Hero Spread",
    image: { x: 0.5, y: 0.45, w: 0.65, h: 0.65 },
    text: { x: 0.5, y: 0.85, w: 0.7, h: 0.12 },
    textStyle: { font_size_pt: 48, text_align: 'center' as const }
  },
  action_focus: {
    name: "Action Focus",
    image: { x: 0.35, y: 0.5, w: 0.45, h: 0.6 },
    text: { x: 0.72, y: 0.5, w: 0.35, h: 0.4 },
    textStyle: { font_size_pt: 42, text_align: 'left' as const }
  },
  portrait_emphasis: {
    name: "Portrait Emphasis",
    image: { x: 0.5, y: 0.4, w: 0.5, h: 0.5 },
    text: { x: 0.5, y: 0.75, w: 0.6, h: 0.12 },
    textStyle: { font_size_pt: 44, text_align: 'center' as const }
  },
  collage: {
    name: "Collage",
    image: { x: 0.5, y: 0.5, w: 0.7, h: 0.7 },
    text: { x: 0.5, y: 0.9, w: 0.8, h: 0.08 },
    textStyle: { font_size_pt: 40, text_align: 'center' as const }
  },
  closing_spread: {
    name: "Closing Spread",
    image: { x: 0.5, y: 0.35, w: 0.6, h: 0.45 },
    text: { x: 0.5, y: 0.7, w: 0.7, h: 0.2 },
    textStyle: { font_size_pt: 52, text_align: 'center' as const }
  }
};

// ==================== Main Layout Engine ====================
export class LayoutEngine {
  private seed: number;
  private random: () => number;
  private specs: PrintSpecs;
  
  // Convert mm to pixels at 300 DPI
  private mmToPx = (mm: number) => Math.round((mm / 25.4) * 300);
  
  constructor(bookId: string, pageNumber: number) {
    const seedString = `${bookId}-${pageNumber}`;
    this.seed = this.hashCode(seedString);
    this.random = this.createSeededRandom(this.seed);
    
    // Print specifications
    this.specs = {
      width_px: 3600,
      height_px: 2400,
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
  
  generateLayout(
    templateName: string,
    narration: string,
    illustrationUrl: string,
    shot?: string,
    actionId?: string
  ): PageLayout {
    // Get canonical shot type
    const canonShot = canonicalizeShot(shot);
    
    // Map shot to template if not specified
    const template = templateName as LayoutTemplate || this.shotToTemplate(canonShot);
    const config = LAYOUT_CONFIGS[template];
    
    // Calculate pixel values
    const bleedPx = this.mmToPx(this.specs.bleed_mm);
    const marginPx = this.mmToPx(this.specs.margin_mm);
    const gutterPx = this.mmToPx(this.specs.gutter_mm);
    
    const layout: PageLayout = {
      canvas: {
        width: this.specs.width_px,
        height: this.specs.height_px,
        dpi: this.specs.dpi,
        bleed: bleedPx,
        margin: marginPx,
        gutter: gutterPx
      },
      elements: [],
      safeArea: {
        x: marginPx,
        y: marginPx,
        width: this.specs.width_px - (marginPx * 2),
        height: this.specs.height_px - (marginPx * 2)
      },
      bleedArea: {
        x: -bleedPx,
        y: -bleedPx,
        width: this.specs.width_px + (bleedPx * 2),
        height: this.specs.height_px + (bleedPx * 2)
      },
      gutterArea: {
        x: (this.specs.width_px / 2) - (gutterPx / 2),
        y: 0,
        width: gutterPx,
        height: this.specs.height_px
      },
      seed: this.seed,
      template: template,
      shot: canonShot,
      debug: {
        collisionChecks: false,
        safeAreaViolations: []
      }
    };
    
    // Apply character scale based on shot type
    const scaleMultiplier = this.getScaleForShot(canonShot);
    
    // Place main image with micro-jitter
    if (illustrationUrl) {
      const jitterX = this.getRandomInRange(-0.02, 0.02);
      const jitterY = this.getRandomInRange(-0.02, 0.02);
      const jitterRotation = this.getRandomInRange(-2, 2);
      
      const imageElement: LayoutElement = {
        type: 'image',
        id: 'main_image',
        x: (config.image.x + jitterX) * this.specs.width_px,
        y: (config.image.y + jitterY) * this.specs.height_px,
        width: config.image.w * this.specs.width_px * scaleMultiplier,
        height: config.image.h * this.specs.height_px * scaleMultiplier,
        rotation: jitterRotation,
        url: illustrationUrl,
        zIndex: 2
      };
      
      // Ensure image stays in safe area
      this.constrainToSafeArea(imageElement, layout.safeArea);
      layout.elements.push(imageElement);
    }
    
    // Place text with plaque background
    if (narration) {
      const textJitterX = this.getRandomInRange(-0.015, 0.015);
      const textJitterY = this.getRandomInRange(-0.01, 0.01);
      const textJitterRotation = this.getRandomInRange(-1, 1);
      
      // Text background plaque (keeping as it's part of text, not decoration)
      const plaquePadding = 20;
      const plaqueElement: LayoutElement = {
        type: 'text',
        id: 'text_plaque',
        x: (config.text.x + textJitterX) * this.specs.width_px,
        y: (config.text.y + textJitterY) * this.specs.height_px,
        width: config.text.w * this.specs.width_px + plaquePadding * 2,
        height: config.text.h * this.specs.height_px + plaquePadding * 2,
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
        x: (config.text.x + textJitterX) * this.specs.width_px,
        y: (config.text.y + textJitterY) * this.specs.height_px,
        width: config.text.w * this.specs.width_px,
        height: config.text.h * this.specs.height_px,
        rotation: textJitterRotation,
        content: narration,
        style: {
          font_family: 'Patrick Hand',
          font_size_pt: config.textStyle.font_size_pt,
          text_align: config.textStyle.text_align,
          color: '#2D3748',
          line_height: 1.4
        },
        zIndex: 4
      };
      
      // Keep text out of gutter
      this.avoidGutter(textElement, layout.gutterArea);
      this.constrainToSafeArea(textElement, layout.safeArea);
      
      layout.elements.push(plaqueElement);
      layout.elements.push(textElement);
    }
    
    // Sort by z-index
    layout.elements.sort((a, b) => a.zIndex - b.zIndex);
    
    // Check for collisions
    layout.debug!.collisionChecks = this.checkCollisions(layout);
    
    return layout;
  }
  
  private shotToTemplate(shot: CanonShot): LayoutTemplate {
    const mappings: Record<CanonShot, LayoutTemplate> = {
      'wide': 'hero_spread',
      'medium': 'action_focus',
      'closeup': 'portrait_emphasis',
      'birdseye': 'collage',
      'low': 'hero_spread'
    };
    return mappings[shot];
  }
  
  private getScaleForShot(shot: CanonShot): number {
    const scales: Record<CanonShot, number> = {
      'wide': 0.6,      // 60% - show environment
      'medium': 0.75,   // 75% - balanced
      'closeup': 0.9,   // 90% - fill frame
      'birdseye': 0.3,  // 30% - show context
      'low': 0.8        // 80% - imposing
    };
    return scales[shot];
  }
  
  private constrainToSafeArea(element: LayoutElement, safeArea: PageLayout['safeArea']) {
    const halfWidth = element.width / 2;
    const halfHeight = element.height / 2;
    
    // Constrain X
    const minX = safeArea.x + halfWidth;
    const maxX = safeArea.x + safeArea.width - halfWidth;
    element.x = Math.max(minX, Math.min(maxX, element.x));
    
    // Constrain Y
    const minY = safeArea.y + halfHeight;
    const maxY = safeArea.y + safeArea.height - halfHeight;
    element.y = Math.max(minY, Math.min(maxY, element.y));
  }
  
  private avoidGutter(element: LayoutElement, gutterArea: PageLayout['gutterArea']) {
    const elementLeft = element.x - element.width / 2;
    const elementRight = element.x + element.width / 2;
    const gutterLeft = gutterArea.x;
    const gutterRight = gutterArea.x + gutterArea.width;
    
    // If element overlaps gutter, shift it
    if (elementLeft < gutterRight && elementRight > gutterLeft) {
      const leftDistance = gutterLeft - elementLeft;
      const rightDistance = elementRight - gutterRight;
      
      if (leftDistance < rightDistance) {
        // Shift left
        element.x = gutterLeft - element.width / 2 - 20;
      } else {
        // Shift right
        element.x = gutterRight + element.width / 2 + 20;
      }
    }
  }
  
  checkCollisions(layout: PageLayout): boolean {
    for (let i = 0; i < layout.elements.length; i++) {
      for (let j = i + 1; j < layout.elements.length; j++) {
        const a = layout.elements[i];
        const b = layout.elements[j];
        
        // Skip if one is the text plaque and the other is text
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
  
  // Export layout as print-ready specifications
  exportPrintSpecs(layout: PageLayout): any {
    return {
      dimensions: {
        width_mm: Math.round((layout.canvas.width / layout.canvas.dpi) * 25.4),
        height_mm: Math.round((layout.canvas.height / layout.canvas.dpi) * 25.4),
        width_px: layout.canvas.width,
        height_px: layout.canvas.height,
        dpi: layout.canvas.dpi
      },
      bleed: {
        mm: this.specs.bleed_mm,
        px: layout.canvas.bleed
      },
      margins: {
        mm: this.specs.margin_mm,
        px: layout.canvas.margin
      },
      gutter: {
        mm: this.specs.gutter_mm,
        px: layout.canvas.gutter
      },
      elements: layout.elements.map(el => ({
        ...el,
        x_mm: Math.round((el.x / layout.canvas.dpi) * 25.4),
        y_mm: Math.round((el.y / layout.canvas.dpi) * 25.4),
        width_mm: Math.round((el.width / layout.canvas.dpi) * 25.4),
        height_mm: Math.round((el.height / layout.canvas.dpi) * 25.4)
      }))
    };
  }
}