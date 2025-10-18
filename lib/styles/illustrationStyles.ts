// lib/styles/illustrationStyles.ts
/**
 * Illustration Style Configurations
 * Defines prompts and settings for different illustration styles
 */

export type IllustrationStyleId = 'paper-collage' | 'watercolor-ink';

export interface StyleConfig {
  id: IllustrationStyleId;
  name: string;
  description: string;
  recommended: boolean;
  negativeSpaceMinimum: number; // Percentage of white/negative space to preserve
  characterAnchorPrompt: (params: {
    genderText: string;
    genderCharacteristics: string;
    babyDescription?: string;
  }) => string;
  characterVariantSuffix: string; // Appended to pose prompt for Layer 1
  sceneStylePrefix: string; // Prepended to scene prompt for Layer 3
  sceneStyleRules: string; // Core style rules for environmental elements
  poeticTextOverlayStyle: string; // How to render poetic text
}

export const ILLUSTRATION_STYLES: Record<IllustrationStyleId, StyleConfig> = {
  'paper-collage': {
    id: 'paper-collage',
    name: 'Paper Collage',
    description: 'Soft paper-collage art with gentle torn edges and pastel colors (Recommended)',
    recommended: true,
    negativeSpaceMinimum: 60,

    characterAnchorPrompt: ({ genderText, genderCharacteristics, babyDescription }) => `CHARACTER ANCHOR - Isolated character ONLY on transparent background.

CRITICAL: This is a character cutout template, NOT a scene or composition.

Style: Soft paper collage with gentle torn edges
Size: 1024×1024 square
Background: PURE TRANSPARENT (alpha channel, NO white, NO colors)

Character: Adorable, cute ${genderText} baby
- ${genderCharacteristics}
- Soft face, delicate features, small eyebrows, sweet expression
- Standing or sitting pose, centered in frame
- Full body visible

ABSOLUTE REQUIREMENTS:
✓ ONLY the character - nothing else
✓ Completely isolated cutout with crisp edges
✓ Pure transparent background (no white, no texture, no elements)
✓ NO ground, NO shadows, NO decorative elements
✓ NO text, NO scene objects, NO background colors
✓ Character should be transferable to any background later

Soft pastel colors on character only. Clean paper collage cutout.${babyDescription ? `\n\nBaby character description: ${babyDescription}\nCreate adorable paper collage baby matching this exact description.` : ''}`,

    characterVariantSuffix: `\n\nMaintain exact same face and features as reference image(s).
1024×1024 TRANSPARENT BACKGROUND, isolated character(s) cutout ONLY.
NO scene elements, NO background objects, just the character(s).
Paper collage style with soft edges.`,

    sceneStylePrefix: `Paper collage style environmental elements (NO characters should be added/modified).`,

    sceneStyleRules: `- Soft pastel colors, torn paper edges, gentle and sparse
- Elements should whisper, not shout
- Think "a few strategic touches" not "full scene"`,

    poeticTextOverlayStyle: `Add decorative text in paper-collage letter style.
- Cut-paper letter look with gentle hand-crafted feel
- Slight rotation and subtle shadow for depth`
  },

  'watercolor-ink': {
    id: 'watercolor-ink',
    name: 'Watercolor & Ink',
    description: 'Transparent watercolor washes with delicate ink line work',
    recommended: false,
    negativeSpaceMinimum: 60,

    characterAnchorPrompt: ({ genderText, genderCharacteristics, babyDescription }) => `CHARACTER ANCHOR - Isolated character ONLY on transparent background.

CRITICAL: This is a character illustration template, NOT a scene or composition.

Style: Watercolor and ink illustration with sketchy, wobbly outlines and a loose watercolor wash.
Size: 1024×1024 square
Background: PURE TRANSPARENT (alpha channel, NO white, NO colors)

Character: Adorable, cute ${genderText} baby
- ${genderCharacteristics}
- Soft face, delicate features, small eyebrows, sweet expression
- Standing or sitting pose, centered in frame
- Full body visible

ABSOLUTE REQUIREMENTS:
✓ ONLY the illustrated character - nothing else
✓ Completely isolated illustration with crisp (but artistically uneven) outlines
✓ Pure transparent background (no white, no texture, no elements)
✓ NO ground, NO shadows, NO decorative elements
✓ NO text, NO scene objects, NO background colors
✓ The character should be a self-contained element, ready to be placed on any background${babyDescription ? `\n\nBaby character description: ${babyDescription}\nCreate adorable watercolor & ink illustration matching this exact description.` : ''}`,

    characterVariantSuffix: `\n\nMaintain exact same face and features as reference image(s).
1024×1024 TRANSPARENT BACKGROUND, isolated character(s) illustration ONLY.
NO scene elements, NO background objects, just the character(s).
Watercolor and ink style with sketchy outlines and loose watercolor wash.`,

    sceneStylePrefix: `Watercolor and ink style environmental elements (NO characters should be added/modified).`,

    sceneStyleRules: `- Transparent watercolor washes combined with delicate ink lines
- Visible paper grain (cold-press paper), subtle water blooms, and color bleeding
- Defined by sketchy, wobbly, and imperfect ink outlines
- Soft, luminous pastel colors emphasizing transparency
- Elements are small, delicate accents only
- Very light, transparent watercolor washes for primary elements
- A few delicate ink lines to define shapes
- Keep it ethereal and translucent
- If in doubt, add LESS rather than more
- Elements should whisper, not shout`,

    poeticTextOverlayStyle: `Add decorative text in hand-lettered ink and watercolor style.
- Elegant, hand-drawn ink lettering with a slightly uneven, natural feel
- Add a light, transparent watercolor wash either inside or around the letters
- Use a slight rotation and subtle drop shadow for depth
- Place strategically in available white space (not over the character)
- Medium-to-large scale, readable, and artistic`
  }
};

export function getStyleConfig(styleId: IllustrationStyleId): StyleConfig {
  return ILLUSTRATION_STYLES[styleId];
}

export function getDefaultStyle(): StyleConfig {
  return ILLUSTRATION_STYLES['paper-collage'];
}
