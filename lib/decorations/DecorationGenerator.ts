// lib/decorations/DecorationGenerator.ts
'use client';

type Setting =
  | 'beach'
  | 'forest'
  | 'park'
  | 'city'
  | 'apartment'
  | 'water'
  | 'night'
  | 'indoor'
  | 'outdoor';

type Mood = 'playful' | 'calm' | 'excited' | 'cozy' | 'adventurous';

type DecoType = 'edge_band' | 'corner_shape' | 'ground_pad' | 'horizon_stripe' | 'frame_edge';

type Position =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'under';

type AspectRatio = `${number}:${number}`;

type Analysis = {
  setting: Setting;
  mood: Mood;
  specificElements: string[];
};

export interface Decoration {
  id: string;
  type: DecoType;
  position: Position;
  prompt: string;
  aspectRatio: AspectRatio; // e.g., "3:1", "2:1", "1:2", "1:1"
  width: number;
  height: number;
  x: number;
  y: number;
  imageUrl?: string;
  transparency: boolean;
  storyRelevance: string;
  placement: 'left_page' | 'right_page';
}

export interface SpreadDecorations {
  spreadNumber: number;
  leftPageDecoration?: Decoration;
  rightPageDecoration?: Decoration;
}

export class DecorationGenerator {
  private readonly SAFE_MARGIN = 40; // Simplified safe margin in pixels for 400x400 pages
  private readonly GUTTER_MARGIN = 20;
  private readonly PAGE_WIDTH = 400;
  private readonly PAGE_HEIGHT = 400;

  /**
   * Extract story setting and mood from narration
   */
  private analyzeNarration(narration: string): Analysis {
    const text = (narration || '').toLowerCase();

    // Determine setting
    let setting: Setting = 'indoor';

    if (text.includes('beach') || text.includes('sand') || text.includes('ocean') || text.includes('shore')) {
      setting = 'beach';
    } else if (text.includes('forest') || text.includes('tree') || text.includes('wood')) {
      setting = 'forest';
    } else if (text.includes('park') || text.includes('grass') || text.includes('playground')) {
      setting = 'park';
    } else if (text.includes('city') || text.includes('street') || text.includes('building')) {
      setting = 'city';
    } else if (text.includes('apartment') || text.includes('window') || text.includes('room')) {
      setting = 'apartment';
    } else if (text.includes('water') || text.includes('pool') || text.includes('bath') || text.includes('splash')) {
      setting = 'water';
    } else if (text.includes('night') || text.includes('moon') || text.includes('sleep') || text.includes('bed')) {
      setting = 'night';
    } else if (text.includes('outside') || text.includes('sun') || text.includes('sky')) {
      setting = 'outdoor';
    }

    // Determine mood
    let mood: Mood = 'playful';

    if (text.includes('quiet') || text.includes('calm') || text.includes('peaceful')) {
      mood = 'calm';
    } else if (text.includes('excit') || text.includes('joy') || text.includes('laugh')) {
      mood = 'excited';
    } else if (text.includes('cozy') || text.includes('warm') || text.includes('snug')) {
      mood = 'cozy';
    } else if (text.includes('adventure') || text.includes('explore') || text.includes('discover')) {
      mood = 'adventurous';
    }

    // Extract specific elements mentioned
    const specificElements: string[] = [];
    const elementKeywords = [
      'wave',
      'foam',
      'leaf',
      'flower',
      'cloud',
      'rain',
      'sun',
      'grass',
      'window',
      'curtain',
    ];

    for (const element of elementKeywords) {
      if (text.includes(element)) {
        specificElements.push(element);
      }
    }

    return { setting, mood, specificElements };
  }

  /**
   * Select appropriate decoration type and position based on story
   */
  private selectDecoration(
    analysis: Analysis,
    _isLeftPage: boolean,
    hasCharacter: boolean,
    characterPosition?: 'center' | 'left' | 'right'
  ): {
    type: Decoration['type'];
    position: Decoration['position'];
    prompt: string;
    aspectRatio: AspectRatio;
  } | null {
    const decorationMap: Record<
      Setting,
      { type: DecoType; position: Position; prompt: string; aspectRatio: AspectRatio }[]
    > = {
      beach: [
        {
          type: 'edge_band',
          position: 'bottom',
          prompt:
            'shoreline foam band with irregular torn paper edge, warm sand transitioning to white foam, paper collage style',
          aspectRatio: '3:1',
        },
        {
          type: 'ground_pad',
          position: 'under',
          prompt: 'sand puddle pad, soft organic shape in warm beige paper collage',
          aspectRatio: '2:1',
        },
        {
          type: 'corner_shape',
          position: 'top-right',
          prompt: 'sun warmth corner piece, gradient from yellow to pale orange paper layers',
          aspectRatio: '1:1',
        },
      ],
      forest: [
        {
          type: 'corner_shape',
          position: 'top-left',
          prompt:
            'leafy corner with overlapping green paper leaves, 2-3 shades of green, torn edges',
          aspectRatio: '1:1',
        },
        {
          type: 'edge_band',
          position: 'top',
          prompt: 'tree branch band with paper cutout twigs and small leaves',
          aspectRatio: '3:1',
        },
        {
          type: 'ground_pad',
          position: 'under',
          prompt: 'forest floor pad with brown and green paper layers',
          aspectRatio: '2:1',
        },
      ],
      park: [
        {
          type: 'ground_pad',
          position: 'under',
          prompt: 'grass tuft pad, layered green paper strips like grass blades',
          aspectRatio: '2:1',
        },
        {
          type: 'edge_band',
          position: 'bottom',
          prompt: 'grass edge band with irregular paper cutout grass texture',
          aspectRatio: '3:1',
        },
      ],
      city: [
        {
          type: 'edge_band',
          position: 'top',
          prompt: 'city rooftop silhouette band, geometric paper shapes in grays',
          aspectRatio: '3:1',
        },
        {
          type: 'frame_edge',
          position: 'top-right',
          prompt: 'building corner L-shape, simple geometric paper cuts',
          aspectRatio: '1:1',
        },
      ],
      apartment: [
        {
          type: 'frame_edge',
          position: 'top-left',
          prompt: 'window frame L-shape corner piece, warm interior tone paper strips',
          aspectRatio: '1:1',
        },
        {
          type: 'edge_band',
          position: 'right',
          prompt: 'curtain side band, soft draped paper shapes',
          aspectRatio: '1:2',
        },
      ],
      water: [
        {
          type: 'ground_pad',
          position: 'under',
          prompt: 'water puddle pad, organic blob shape in 2 shades of blue paper',
          aspectRatio: '2:1',
        },
        {
          type: 'edge_band',
          position: 'bottom',
          prompt: 'ripple water edge band with wavy torn paper layers',
          aspectRatio: '3:1',
        },
      ],
      night: [
        {
          type: 'edge_band',
          position: 'top',
          prompt:
            'moonlight glow band, gradient from deep blue to pale yellow paper',
          aspectRatio: '3:1',
        },
        {
          type: 'corner_shape',
          position: 'top-right',
          prompt: 'night sky corner with deep blue layered paper',
          aspectRatio: '1:1',
        },
      ],
      indoor: [
        {
          type: 'ground_pad',
          position: 'under',
          prompt: 'floor mat pad, simple oval in warm brown paper',
          aspectRatio: '2:1',
        },
        {
          type: 'corner_shape',
          position: 'bottom-left',
          prompt: 'cozy corner piece with warm tone paper layers',
          aspectRatio: '1:1',
        },
      ],
      outdoor: [
        {
          type: 'edge_band',
          position: 'top',
          prompt: 'sky horizon band with pale blue gradient paper',
          aspectRatio: '3:1',
        },
        {
          type: 'ground_pad',
          position: 'under',
          prompt: 'ground pad with earthy brown paper texture',
          aspectRatio: '2:1',
        },
      ],
    };

    const options = decorationMap[analysis.setting] || decorationMap['indoor'];

    // Filter based on character position to avoid overlaps
    const validOptions = options.filter((opt) => {
      // If character is present and decoration is a ground pad, always valid
      if (hasCharacter && opt.type === 'ground_pad') return true;

      // Avoid decorations that might overlap with character
      if (hasCharacter) {
        if (characterPosition === 'center' && (opt.position === 'left' || opt.position === 'right')) {
          return false;
        }
        if (characterPosition === 'left' && (opt.position === 'left' || opt.position.includes('left'))) {
          return false;
        }
        if (characterPosition === 'right' && (opt.position === 'right' || opt.position.includes('right'))) {
          return false;
        }
      }

      return true;
    });

    // Pick one valid option
    if (validOptions.length > 0) {
      const selected = validOptions[Math.floor(Math.random() * validOptions.length)];

      // Add transparent PNG instruction to prompt
      const finalPrompt =
        `Transparent PNG. Paper collage style. ${selected.prompt}. ` +
        `Keep everything inside canvas with visible inner margin. ` +
        `No characters, no text. Subtle, supportive partial background element.`;

      return {
        type: selected.type,
        position: selected.position,
        prompt: finalPrompt,
        aspectRatio: selected.aspectRatio,
      };
    }

    return null;
  }

  /**
   * Calculate safe placement bounds for decoration
   */
  private calculateBounds(
    type: Decoration['type'],
    position: Decoration['position'],
    aspectRatio: AspectRatio,
    isLeftPage: boolean
  ): { x: number; y: number; width: number; height: number } {
    const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number) as [number, number];

    // Base dimensions based on type
    let width = 0;
    let height = 0;
    let x = 0;
    let y = 0;

    switch (type) {
      case 'edge_band':
        if (position === 'top' || position === 'bottom') {
          width = this.PAGE_WIDTH - 2 * this.SAFE_MARGIN;
          height = (width / widthRatio) * heightRatio;
          x = this.SAFE_MARGIN;
          y = position === 'top' ? this.SAFE_MARGIN : this.PAGE_HEIGHT - this.SAFE_MARGIN - height;
        } else {
          height = this.PAGE_HEIGHT * 0.6;
          width = (height / heightRatio) * widthRatio;
          x = position === 'left' ? this.SAFE_MARGIN : this.PAGE_WIDTH - this.SAFE_MARGIN - width;
          y = this.PAGE_HEIGHT * 0.2;
        }
        break;

      case 'corner_shape':
        width = this.PAGE_WIDTH * 0.3;
        height = this.PAGE_HEIGHT * 0.3;

        if (position === 'top-left') {
          x = this.SAFE_MARGIN;
          y = this.SAFE_MARGIN;
        } else if (position === 'top-right') {
          x = this.PAGE_WIDTH - this.SAFE_MARGIN - width;
          y = this.SAFE_MARGIN;
        } else if (position === 'bottom-left') {
          x = this.SAFE_MARGIN;
          y = this.PAGE_HEIGHT - this.SAFE_MARGIN - height;
        } else {
          x = this.PAGE_WIDTH - this.SAFE_MARGIN - width;
          y = this.PAGE_HEIGHT - this.SAFE_MARGIN - height;
        }
        break;

      case 'ground_pad':
        width = this.PAGE_WIDTH * 0.5;
        height = (width / widthRatio) * heightRatio;
        x = this.PAGE_WIDTH / 2 - width / 2;
        y = this.PAGE_HEIGHT * 0.7;
        break;

      case 'horizon_stripe':
        width = this.PAGE_WIDTH - 2 * this.SAFE_MARGIN;
        height = 40;
        x = this.SAFE_MARGIN;
        y = this.PAGE_HEIGHT * 0.6;
        break;

      case 'frame_edge':
        width = this.PAGE_WIDTH * 0.25;
        height = this.PAGE_HEIGHT * 0.4;

        if (position.includes('left')) {
          x = this.SAFE_MARGIN;
        } else {
          x = this.PAGE_WIDTH - this.SAFE_MARGIN - width;
        }

        if (position.includes('top')) {
          y = this.SAFE_MARGIN;
        } else {
          y = this.PAGE_HEIGHT - this.SAFE_MARGIN - height;
        }
        break;
    }

    // Ensure we don't cross into gutter on inner edge
    if (isLeftPage && x + width > this.PAGE_WIDTH - this.GUTTER_MARGIN) {
      width = this.PAGE_WIDTH - this.GUTTER_MARGIN - x;
    } else if (!isLeftPage && x < this.GUTTER_MARGIN) {
      const adjustment = this.GUTTER_MARGIN - x;
      x = this.GUTTER_MARGIN;
      width -= adjustment;
    }

    return { x, y, width, height };
  }

  /**
   * Generate decorations for a spread
   */
  public generateSpreadDecorations(
    spreadNumber: number,
    leftPageNarration: string,
    rightPageNarration: string,
    leftPageHasCharacter: boolean = false,
    rightPageHasCharacter: boolean = false
  ): SpreadDecorations {
    const leftAnalysis = this.analyzeNarration(leftPageNarration);
    const rightAnalysis = this.analyzeNarration(rightPageNarration || leftPageNarration);

    const decorations: SpreadDecorations = {
      spreadNumber,
    };

    // Decide on 1-2 decorations per spread
    const decorationCount = Math.random() > 0.6 ? 2 : 1;

    // Generate left page decoration
    if (decorationCount >= 1 && Math.random() > 0.5) {
      const selected = this.selectDecoration(
        leftAnalysis,
        true,
        leftPageHasCharacter,
        leftPageHasCharacter ? 'center' : undefined
      );

      if (selected) {
        const bounds = this.calculateBounds(selected.type, selected.position, selected.aspectRatio, true);

        decorations.leftPageDecoration = {
          id: `decor_${spreadNumber}_left`,
          type: selected.type,
          position: selected.position,
          prompt: selected.prompt,
          aspectRatio: selected.aspectRatio,
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          transparency: true,
          storyRelevance: `${leftAnalysis.setting} setting, ${leftAnalysis.mood} mood`,
          placement: 'left_page',
        };
      }
    }

    // Generate right page decoration
    if (decorationCount === 2 && rightPageNarration) {
      const selected = this.selectDecoration(
        rightAnalysis,
        false,
        rightPageHasCharacter,
        rightPageHasCharacter ? 'center' : undefined
      );

      if (selected) {
        const bounds = this.calculateBounds(selected.type, selected.position, selected.aspectRatio, false);

        decorations.rightPageDecoration = {
          id: `decor_${spreadNumber}_right`,
          type: selected.type,
          position: selected.position,
          prompt: selected.prompt,
          aspectRatio: selected.aspectRatio,
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          transparency: true,
          storyRelevance: `${rightAnalysis.setting} setting, ${rightAnalysis.mood} mood`,
          placement: 'right_page',
        };
      }
    }

    return decorations;
  }
}

// SSR-safe base64 helper
const toBase64 = (str: string) => {
  if (typeof window === 'undefined') {
    // Node/SSR
    return Buffer.from(str, 'utf8').toString('base64');
  }
  // Browser
  return window.btoa(str);
};

// Placeholder image generator for decorations
export function generateDecorationPlaceholder(decoration: Decoration): string {
  // Return a simple SVG placeholder that represents the decoration shape
  const svg = `
    <svg width="${decoration.width}" height="${decoration.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad_${decoration.id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#E0E7FF;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#C7D2FE;stop-opacity:0.5" />
        </linearGradient>
      </defs>
      <rect 
        width="100%" 
        height="100%" 
        fill="url(#grad_${decoration.id})" 
        rx="${decoration.type === 'ground_pad' ? '50%' : '5'}"
        opacity="0.6"
      />
    </svg>
  `;

  const base64 = toBase64(svg);
  return `data:image/svg+xml;base64,${base64}`;
}
