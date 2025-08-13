export interface LayoutElement {
  type: 'image' | 'text' | 'decoration';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content?: string;
  url?: string;
  style?: any;
  zIndex: number;
}

export interface PageLayout {
  canvas: {
    width: number;
    height: number;
    dpi: number;
    bleed: number;
    margin: number;
  };
  elements: LayoutElement[];
  seed: number;
  template: string;
}

interface LayoutTemplate {
  name: string;
  canvas: {
    width_px: number;
    height_px: number;
    dpi: number;
    bleed_px: number;
    margin_px: number;
  };
  image_slots: Array<{
    id: string;
    anchor: { x: number; y: number };
    size: { w: number; h: number };
    fit: string;
    mask: string;
    z_index: number;
    jitter: {
      dx: [number, number];
      dy: [number, number];
      scale: [number, number];
      rotate_deg: [number, number];
    };
  }>;
  text_frames: Array<{
    id: string;
    anchor: { x: number; y: number };
    box: { w: number; h: number };
    z_index: number;
    styles: {
      font_family: string;
      font_size_pt: number;
      text_align: string;
      color: string;
      line_height: number;
    };
    jitter: {
      dx: [number, number];
      dy: [number, number];
      rotate_deg: [number, number];
    };
  }>;
  decorations?: {
    enabled: boolean;
    elements: string[];
    density: number;
  };
}

// Import templates (we'll define them inline to avoid import issues)
const layoutTemplates: Record<string, LayoutTemplate> = {
  hero_spread: {
    name: "Hero Spread",
    canvas: {
      width_px: 3600,
      height_px: 2400,
      dpi: 300,
      bleed_px: 38,
      margin_px: 150
    },
    image_slots: [{
      id: "main_image",
      anchor: { x: 0.5, y: 0.45 },
      size: { w: 0.65, h: 0.65 },
      fit: "cover",
      mask: "soft-circle",
      z_index: 2,
      jitter: {
        dx: [-0.03, 0.03],
        dy: [-0.02, 0.02],
        scale: [0.98, 1.02],
        rotate_deg: [-2, 2]
      }
    }],
    text_frames: [{
      id: "narration",
      anchor: { x: 0.5, y: 0.85 },
      box: { w: 0.7, h: 0.15 },
      z_index: 3,
      styles: {
        font_family: "Patrick Hand",
        font_size_pt: 24,
        text_align: "center",
        color: "#2D3748",
        line_height: 1.4
      },
      jitter: {
        dx: [-0.02, 0.02],
        dy: [-0.01, 0.01],
        rotate_deg: [-1, 1]
      }
    }]
  }
  // Add other templates here...
};

export class LayoutEngine {
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
    illustrationUrl: string
  ): PageLayout {
    const template = layoutTemplates[templateName] || layoutTemplates.hero_spread;
    const layout: PageLayout = {
      canvas: {
        width: template.canvas.width_px,
        height: template.canvas.height_px,
        dpi: template.canvas.dpi,
        bleed: template.canvas.bleed_px,
        margin: template.canvas.margin_px
      },
      elements: [],
      seed: this.seed,
      template: templateName
    };
    
    // Place main image with jitter
    const imageSlot = template.image_slots[0];
    if (imageSlot && illustrationUrl) {
      const jitterX = this.getRandomInRange(imageSlot.jitter.dx[0], imageSlot.jitter.dx[1]);
      const jitterY = this.getRandomInRange(imageSlot.jitter.dy[0], imageSlot.jitter.dy[1]);
      const jitterScale = this.getRandomInRange(imageSlot.jitter.scale[0], imageSlot.jitter.scale[1]);
      const jitterRotation = this.getRandomInRange(imageSlot.jitter.rotate_deg[0], imageSlot.jitter.rotate_deg[1]);
      
      const imageElement: LayoutElement = {
        type: 'image',
        id: imageSlot.id,
        x: (imageSlot.anchor.x + jitterX) * template.canvas.width_px,
        y: (imageSlot.anchor.y + jitterY) * template.canvas.height_px,
        width: imageSlot.size.w * template.canvas.width_px * jitterScale,
        height: imageSlot.size.h * template.canvas.height_px * jitterScale,
        rotation: jitterRotation,
        url: illustrationUrl,
        zIndex: imageSlot.z_index
      };
      
      layout.elements.push(imageElement);
    }
    
    // Place text with jitter
    const textFrame = template.text_frames[0];
    if (textFrame && narration) {
      const jitterX = this.getRandomInRange(textFrame.jitter.dx[0], textFrame.jitter.dx[1]);
      const jitterY = this.getRandomInRange(textFrame.jitter.dy[0], textFrame.jitter.dy[1]);
      const jitterRotation = this.getRandomInRange(textFrame.jitter.rotate_deg[0], textFrame.jitter.rotate_deg[1]);
      
      const textElement: LayoutElement = {
        type: 'text',
        id: textFrame.id,
        x: (textFrame.anchor.x + jitterX) * template.canvas.width_px,
        y: (textFrame.anchor.y + jitterY) * template.canvas.height_px,
        width: textFrame.box.w * template.canvas.width_px,
        height: textFrame.box.h * template.canvas.height_px,
        rotation: jitterRotation,
        content: narration,
        style: textFrame.styles,
        zIndex: textFrame.z_index
      };
      
      layout.elements.push(textElement);
    }
    
    // Sort by z-index
    layout.elements.sort((a, b) => a.zIndex - b.zIndex);
    
    return layout;
  }
  
  checkCollisions(layout: PageLayout): boolean {
    for (let i = 0; i < layout.elements.length; i++) {
      for (let j = i + 1; j < layout.elements.length; j++) {
        const a = layout.elements[i];
        const b = layout.elements[j];
        
        if (a.type === 'decoration' || b.type === 'decoration') continue;
        
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