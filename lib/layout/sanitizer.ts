// lib/layout/sanitizer.ts

/**
 * Sanitizes layout data by removing deprecated fields
 * while maintaining backward compatibility
 */

export interface SanitizedLayoutElement {
  type: 'image' | 'text';
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

export interface SanitizedPageLayout {
  canvas: {
    width: number;
    height: number;
    dpi: number;
    bleed: number;
    margin: number;
    gutter: number;
  };
  elements: SanitizedLayoutElement[];
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

/**
 * Removes decorations from a single element
 * Returns null if element should be removed entirely
 */
function sanitizeElement(element: any): SanitizedLayoutElement | null {
  // Remove decoration elements entirely
  if (element.type === 'decoration' && element.id !== 'text_plaque') {
    return null;
  }
  
  // Convert text_plaque decorations to text type
  if (element.type === 'decoration' && element.id === 'text_plaque') {
    return {
      ...element,
      type: 'text'
    };
  }
  
  // Remove deprecated fields
  const { opacity, decorations, ...cleanElement } = element;
  
  return cleanElement as SanitizedLayoutElement;
}

/**
 * Sanitizes a page layout by removing all decoration elements
 * except for text plaques which are converted to text type
 */
export function sanitizePageLayout(layout: any): SanitizedPageLayout {
  if (!layout) {
    throw new Error('Layout is required');
  }
  
  // Remove decorations field from root if it exists
  const { decorations: _deprecatedDecorations, ...cleanLayout } = layout;
  
  // Sanitize elements array
  const sanitizedElements = (layout.elements || [])
    .map(sanitizeElement)
    .filter((el: any) => el !== null) as SanitizedLayoutElement[];
  
  return {
    ...cleanLayout,
    elements: sanitizedElements
  };
}

/**
 * Sanitizes a story page by removing decoration references
 */
export function sanitizeStoryPage(page: any): any {
  const { decorations: _deprecated, decoration_config: _alsoDeprecated, ...cleanPage } = page || {};
  return cleanPage;
}

/**
 * Sanitizes an entire book's layout data
 */
export function sanitizeBookLayouts(layouts: Record<number, any>): Record<number, SanitizedPageLayout> {
  const sanitized: Record<number, SanitizedPageLayout> = {};
  
  for (const [pageNum, layout] of Object.entries(layouts)) {
    try {
      sanitized[Number(pageNum)] = sanitizePageLayout(layout);
    } catch (error) {
      console.warn(`Failed to sanitize layout for page ${pageNum}:`, error);
      // Skip invalid layouts
    }
  }
  
  return sanitized;
}

/**
 * Checks if a layout contains deprecated decorations
 * Useful for migration warnings
 */
export function hasDeprecatedDecorations(layout: any): boolean {
  if (!layout) return false;
  
  // Check for decorations field
  if ('decorations' in layout) return true;
  
  // Check for decoration elements
  if (layout.elements?.some((el: any) => 
    el.type === 'decoration' && el.id !== 'text_plaque'
  )) {
    return true;
  }
  
  return false;
}

/**
 * Migration helper to detect and report deprecated content
 */
export function detectDeprecatedContent(bookData: any): {
  hasDeprecations: boolean;
  affectedPages: number[];
  deprecationTypes: string[];
} {
  const affectedPages: number[] = [];
  const deprecationTypes = new Set<string>();
  
  // Check layouts
  if (bookData.layouts) {
    for (const [pageNum, layout] of Object.entries(bookData.layouts)) {
      if (hasDeprecatedDecorations(layout)) {
        affectedPages.push(Number(pageNum));
        deprecationTypes.add('decorations');
      }
    }
  }
  
  // Check story pages
  if (bookData.storyData?.pages) {
    bookData.storyData.pages.forEach((page: any, index: number) => {
      if ('decorations' in page || 'decoration_config' in page) {
        affectedPages.push(page.page_number || index + 1);
        deprecationTypes.add('story_decorations');
      }
    });
  }
  
  return {
    hasDeprecations: affectedPages.length > 0,
    affectedPages: Array.from(new Set(affectedPages)).sort((a, b) => a - b),
    deprecationTypes: Array.from(deprecationTypes)
  };
}