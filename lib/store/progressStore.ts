// lib/store/progressStore.ts
/**
 * Progress Save/Resume System
 * Allows users to save their progress and continue later
 */

export interface SavedProgress {
  savedAt: string;
  currentStep: number;
  babyProfile?: any;
  conversation?: any[];
  storyData?: any;
  generatedImages?: any[];
  bookId?: string;
}

const STORAGE_KEY = 'usnthen_saved_progress';

/**
 * Save current progress to localStorage
 */
export function saveProgress(progress: SavedProgress): void {
  try {
    const data = {
      ...progress,
      // Don't save generated images to avoid localStorage quota errors
      // Images are already in bookStore which has its own size management
      generatedImages: undefined,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('Progress saved (images excluded to avoid quota)');
  } catch (error) {
    console.error('Failed to save progress:', error);
    // Don't throw - just log the error and continue
    // Progress saving is a nice-to-have, not critical
    console.warn('Progress could not be saved, but you can continue working');
  }
}

/**
 * Load saved progress from localStorage
 */
export function loadProgress(): SavedProgress | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const progress = JSON.parse(saved) as SavedProgress;

    // Check if saved data is older than 30 days
    const savedDate = new Date(progress.savedAt);
    const now = new Date();
    const daysDiff = (now.getTime() - savedDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 30) {
      console.log('Saved progress expired (>30 days)');
      clearProgress();
      return null;
    }

    return progress;
  } catch (error) {
    console.error('Failed to load progress:', error);
    return null;
  }
}

/**
 * Clear saved progress
 */
export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Progress cleared');
  } catch (error) {
    console.error('Failed to clear progress:', error);
  }
}

/**
 * Check if there is saved progress
 */
export function hasSavedProgress(): boolean {
  return loadProgress() !== null;
}

/**
 * Get a human-readable description of saved progress
 */
export function getProgressDescription(progress: SavedProgress): string {
  const stepNames = [
    'Getting Started',
    'Baby Profile',
    'Memory Chat',
    'Story Review',
    'Illustrations',
    'Book Preview',
    'Complete'
  ];

  const stepName = stepNames[progress.currentStep] || 'Unknown Step';
  const savedDate = new Date(progress.savedAt);
  const timeAgo = getTimeAgo(savedDate);

  return `${stepName} • Saved ${timeAgo}`;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return 'over a month ago';
}
