// lib/layout/EnhancedLayoutEngine.ts

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

// ==================== Layout Templates with BIGGER FONTS ====================
const LAYOUT_CONFIGS: Record<LayoutTemplate, any> = {
  hero_spread: {
    name: "Hero Spread",
    image: { x: 0.5, y: 0.45, w: 0.65, h: 0.65 },
    text: { x: 0.5, y: 0.85, w: 0.7, h: 0.15 },
    textStyle: { 
      font_size_pt: 72,  // BIGGER! Was 48
      text_align: 'center' as const,
      font_weight: '800', // Extra bold
      letter_spacing: '0.02em'
    }
  },
  action_focus: {
    name: "Action Focus",
    image: { x: 0.35, y: 0.5, w: 0.45, h: 0.6 },
    text: { x: 0.72, y: 0.5, w: 0.35, h: 0.4 },
    textStyle: { 
      font_size_pt: 64,  // BIGGER! Was 42
      text_align: 'left' as const,
      font_weight: '700',
      letter_spacing: '0.01em'
    }
  },
  portrait_emphasis: {
    name: "Portrait Emphasis",
    image: { x: 0.5, y: 0.4, w: 0.5, h: 0.5 },
    text: { x: 0.5, y: 0.75, w: 0.6, h: 0.15 },
    textStyle: { 
      font_size_pt: 68,  // BIGGER! Was 44
      text_align: 'center' as const,
      font_weight: '700',
      letter_spacing: '0.02em'
    }
  },
  collage: {
    name: "Collage",
    image: { x: 0.5, y: 0.5, w: 0.7, h: 0.7 },
    text: { x: 0.5, y: 0.9, w: 0.8, h: 0.08 },
    textStyle: { 
      font_size_pt: 60,  // BIGGER! Was 40
      text_align: 'center' as const,
      font_weight: '800',
      letter_spacing: '0.01em'
    }
  },
  closing_spread: {
    name: "Closing Spread",
    image: { x: 0.5, y: 0.35, w: 0.6, h: 0.45 },
    text: { x: 0.5, y: 0.7, w: 0.7, h: 0.2 },
    textStyle: { 
      font_size_pt: 76,  // BIGGER! Was 52
      text_align: 'center' as const,
      font_weight: '900', // Black weight
      letter_spacing: '0.03em'
    }
  }
};

// Baby-friendly color palettes
const TEXT_COLORS = {
  default: '#2D1B69',     // Deep purple
  warm: '#D2386C',        // Warm pink
  playful: '#FF6B35',     // Orange
  calm: '#4ECDC4',        // Teal
  happy: '#FFD93D'        // Yellow
};

// Fun fonts for babies (in order of preference)
const BABY_FONTS = [
  'Comic Sans MS',        // Playful
  'Patrick Hand',         // Handwritten
  'Caveat',              // Casual script
  'Fredoka One',         // Rounded and bold
  'Bubblegum Sans',      // Cute and round
  'Arial Rounded MT Bold' // Fallback rounded
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
  
  // Get emotion-based text color
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
    
    // Place text with colorful plaque background
    if (narration) {
      const textJitterX = this.getRandomInRange(-0.015, 0.015);
      const textJitterY = this.getRandomInRange(-0.01, 0.01);
      const textJitterRotation = this.getRandomInRange(-1, 1);
      
      // Colorful text background plaque
      const plaquePadding = 40; // Bigger padding for baby books
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
          // Fun gradient background for babies
          background_color: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,240,245,0.95) 100%)'
        },
        zIndex: 3
      };
      
      // Text element with bigger, bolder font
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
          font_family: BABY_FONTS[0], // Use most playful font
          font_size_pt: config.textStyle.font_size_pt,
          text_align: config.textStyle.text_align,
          color: this.getTextColorForEmotion(emotion),
          line_height: 1.6, // More spacing for readability
          font_weight: config.textStyle.font_weight,
          text_shadow: '2px 2px 4px rgba(0,0,0,0.1)', // Soft shadow for depth
          letter_spacing: config.textStyle.letter_spacing
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
      'wide': 0.6,
      'medium': 0.75,
      'closeup': 0.9,
      'birdseye': 0.3,
      'low': 0.8
    };
    return scales[shot];
  }
  
  private constrainToSafeArea(element: LayoutElement, safeArea: PageLayout['safeArea']) {
    const halfWidth = element.width / 2;
    const halfHeight = element.height / 2;
    
    const minX = safeArea.x + halfWidth;
    const maxX = safeArea.x + safeArea.width - halfWidth;
    element.x = Math.max(minX, Math.min(maxX, element.x));
    
    const minY = safeArea.y + halfHeight;
    const maxY = safeArea.y + safeArea.height - halfHeight;
    element.y = Math.max(minY, Math.min(maxY, element.y));
  }
  
  private avoidGutter(element: LayoutElement, gutterArea: PageLayout['gutterArea']) {
    const elementLeft = element.x - element.width / 2;
    const elementRight = element.x + element.width / 2;
    const gutterLeft = gutterArea.x;
    const gutterRight = gutterArea.x + gutterArea.width;
    
    if (elementLeft < gutterRight && elementRight > gutterLeft) {
      const leftDistance = gutterLeft - elementLeft;
      const rightDistance = elementRight - gutterRight;
      
      if (leftDistance < rightDistance) {
        element.x = gutterLeft - element.width / 2 - 20;
      } else {
        element.x = gutterRight + element.width / 2 + 20;
      }
    }
  }
  
  checkCollisions(layout: PageLayout): boolean {
    for (let i = 0; i < layout.elements.length; i++) {
      for (let j = i + 1; j < layout.elements.length; j++) {
        const a = layout.elements[i];
        const b = layout.elements[j];
        
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
}