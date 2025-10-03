// lib/camera/highContrastShots.ts
/**
 * Camera Angles for 4-Page Landscape Book System
 * Provides maximum visual variety across pages
 */

export interface CameraAngle {
  id: string;
  name: string;
  description: string;
  best_for?: string[];
}

// Camera angles for landscape book pages - Maximum visual differentiation
export const CAMERA_ANGLES: Record<string, CameraAngle> = {
  birds_eye_overhead: {
    id: 'birds_eye_overhead',
    name: "Bird's-Eye View",
    description: "High overhead view looking down from above the baby's front (not from behind)",
    best_for: ['playing', 'lying down', 'crawling', 'overhead perspective']
  },

  extreme_macro_detail: {
    id: 'extreme_macro_detail',
    name: 'Extreme Macro',
    description: "Ultra close-up focusing on tiny detail like baby's hand texture, foot, or eye",
    best_for: ['hands', 'feet', 'eyes', 'tiny details', 'texture']
  },

  establishing_wide: {
    id: 'establishing_wide',
    name: 'Establishing Wide',
    description: "Very wide shot showing entire scene and context",
    best_for: ['opening scenes', 'showing scale', 'full environment']
  },

  over_shoulder_parent: {
    id: 'over_shoulder_parent',
    name: 'Over-the-Shoulder',
    description: "Framed from behind parent's shoulder looking toward baby",
    best_for: ['parent-child moments', 'intimate connection', 'protective view']
  },

  direct_back_following: {
    id: 'direct_back_following',
    name: 'Following Behind',
    description: "Camera directly behind baby, tracking forward movement",
    best_for: ['crawling away', 'exploring', 'movement', 'adventure']
  },

  perfect_profile_side: {
    id: 'perfect_profile_side',
    name: 'Perfect Profile',
    description: "Pure 90-degree side view, clean profile silhouette",
    best_for: ['movement', 'sitting', 'walking', 'contemplation', 'classic view']
  },

  reflection_surface: {
    id: 'reflection_surface',
    name: 'Reflection Shot',
    description: "Focuses on baby's reflection in mirror, water, or shiny surface",
    best_for: ['water play', 'mirrors', 'discovery', 'dreamlike moments']
  }
};

/**
 * Generate diverse camera angles for 4-page book
 * Ensures each page has a completely different angle
 */
export function generateCameraSequence(pageCount: number = 4): string[] {
  const allAngles = Object.keys(CAMERA_ANGLES);
  const sequence: string[] = [];

  // Page 1: Always start with establishing wide to set the scene
  sequence.push('establishing_wide');

  // Remaining pages: Pick completely different angles
  const remainingAngles = allAngles.filter(a => a !== 'establishing_wide');

  // Shuffle for randomness
  const shuffled = remainingAngles.sort(() => Math.random() - 0.5);

  // Take first N-1 shuffled angles
  for (let i = 1; i < pageCount; i++) {
    sequence.push(shuffled[i - 1]);
  }

  console.log('Camera sequence:', sequence.map(id => CAMERA_ANGLES[id]?.name).join(' → '));

  return sequence;
}

/**
 * Get camera angle name for use in prompts
 */
export function getCameraAngleName(angleId: string): string {
  return CAMERA_ANGLES[angleId]?.name || 'Medium Shot';
}

/**
 * Get camera angle description for use in prompts
 */
export function getCameraAngleDescription(angleId: string): string {
  return CAMERA_ANGLES[angleId]?.description || 'Balanced view';
}