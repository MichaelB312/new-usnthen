// lib/layout/textFit.ts

/**
 * Text fitting utilities for optimal toddler-friendly text sizing
 */

export interface TextMetrics {
  fontSize: number;
  lineHeight: number;
  lines: string[];
  totalHeight: number;
}

/**
 * Calculate optimal font size for text to fit within bounds
 * Prioritizes readability with minimum 42pt for toddlers
 */
export function calculateOptimalFontSize(
  text: string,
  maxWidth: number,
  maxHeight: number,
  options: {
    minFontSize?: number;
    maxFontSize?: number;
    fontFamily?: string;
    lineHeightRatio?: number;
  } = {}
): TextMetrics {
  const {
    minFontSize = 42, // Minimum 42pt for toddler readability
    maxFontSize = 72, // Maximum 72pt for impact
    fontFamily = 'Patrick Hand',
    lineHeightRatio = 1.6
  } = options;
  
  // Estimate character width (rough approximation)
  const avgCharWidth = 0.6; // Ratio of font size
  
  // Split text into words
  const words = text.split(/\s+/);
  
  // Try different font sizes
  let optimalFontSize = maxFontSize;
  let lines: string[] = [];
  
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const charWidth = fontSize * avgCharWidth;
    const lineHeight = fontSize * lineHeightRatio;
    
    // Calculate how many characters fit per line
    const charsPerLine = Math.floor(maxWidth / charWidth);
    
    // Break text into lines
    lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= charsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    // Check if text fits vertically
    const totalHeight = lines.length * lineHeight;
    
    if (totalHeight <= maxHeight) {
      optimalFontSize = fontSize;
      break;
    }
  }
  
  return {
    fontSize: optimalFontSize,
    lineHeight: optimalFontSize * lineHeightRatio,
    lines,
    totalHeight: lines.length * (optimalFontSize * lineHeightRatio)
  };
}

/**
 * Split text for optimal readability in children's books
 * Tries to keep lines balanced and avoid orphans
 */
export function splitTextForDisplay(
  text: string,
  maxWordsPerLine: number = 5
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  
  // If very short, keep on one line
  if (words.length <= maxWordsPerLine) {
    return [text];
  }
  
  // Calculate ideal line count
  const idealLineCount = Math.ceil(words.length / maxWordsPerLine);
  const wordsPerLine = Math.ceil(words.length / idealLineCount);
  
  let currentLine: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    currentLine.push(words[i]);
    
    // Check if we should break the line
    const remainingWords = words.length - i - 1;
    const remainingLines = idealLineCount - lines.length - 1;
    
    if (
      currentLine.length >= wordsPerLine ||
      (remainingLines > 0 && remainingWords <= remainingLines * wordsPerLine)
    ) {
      lines.push(currentLine.join(' '));
      currentLine = [];
    }
  }
  
  // Add any remaining words
  if (currentLine.length > 0) {
    // Avoid orphans (single word on last line)
    if (currentLine.length === 1 && lines.length > 0) {
      const lastLine = lines.pop()!;
      lines.push(`${lastLine} ${currentLine[0]}`);
    } else {
      lines.push(currentLine.join(' '));
    }
  }
  
  return lines;
}

/**
 * Get recommended font size based on word count
 * Follows toddler-friendly sizing guidelines
 */
export function getRecommendedFontSize(wordCount: number): number {
  if (wordCount <= 10) return 72;  // Very large for short text
  if (wordCount <= 15) return 56;  // Large
  if (wordCount <= 20) return 48;  // Medium-large
  if (wordCount <= 25) return 44;  // Medium
  return 42; // Minimum size for longer text
}

/**
 * Calculate text bounding box with padding
 */
export function calculateTextBounds(
  text: string,
  fontSize: number,
  options: {
    padding?: number;
    lineHeight?: number;
    maxWidth?: number;
  } = {}
): { width: number; height: number } {
  const {
    padding = 30,
    lineHeight = fontSize * 1.6,
    maxWidth = Infinity
  } = options;
  
  // Estimate text dimensions
  const avgCharWidth = fontSize * 0.6;
  const textWidth = Math.min(text.length * avgCharWidth * 0.7, maxWidth);
  
  // Calculate lines needed
  const wordsPerLine = Math.floor(textWidth / (avgCharWidth * 5));
  const lineCount = Math.ceil(text.split(/\s+/).length / wordsPerLine);
  
  return {
    width: textWidth + padding * 2,
    height: lineCount * lineHeight + padding * 2
  };
}

/**
 * Check if text will fit in given area
 */
export function willTextFit(
  text: string,
  area: { width: number; height: number },
  fontSize: number
): boolean {
  const bounds = calculateTextBounds(text, fontSize, {
    maxWidth: area.width
  });
  
  return bounds.width <= area.width && bounds.height <= area.height;
}