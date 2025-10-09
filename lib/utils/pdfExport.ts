import { jsPDF } from 'jspdf';

/**
 * Export book pages to a print-ready PDF
 *
 * Pages are exported as landscape spreads at 300 DPI
 * Dimensions: 26×17.35 cm (with bleed: 27.6×19.1 cm)
 *
 * @param pages - Array of page image data URLs (upscaled 3072×2048 or with bleed)
 * @param bookTitle - Title of the book for filename
 * @param includeBleed - Whether images include bleed borders
 */
export async function exportBookToPDF(
  pages: string[],
  bookTitle: string = 'My Book',
  includeBleed: boolean = true
): Promise<void> {
  console.log(`[PDF Export] Starting export of ${pages.length} pages`);

  // Calculate page dimensions in mm (jsPDF uses mm by default)
  // With bleed: 27.6 cm × 19.1 cm
  // Without bleed: 26 cm × 17.35 cm
  const pageWidth = includeBleed ? 276 : 260;
  const pageHeight = includeBleed ? 191 : 173.5;

  // Create PDF in landscape orientation
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pageWidth, pageHeight],
    compress: true,
    precision: 2
  });

  console.log(`[PDF Export] PDF dimensions: ${pageWidth}×${pageHeight}mm`);

  for (let i = 0; i < pages.length; i++) {
    const pageDataUrl = pages[i];

    if (!pageDataUrl) {
      console.warn(`[PDF Export] Skipping empty page ${i}`);
      continue;
    }

    console.log(`[PDF Export] Adding page ${i + 1}/${pages.length}`);

    // Add new page for all but the first
    if (i > 0) {
      pdf.addPage([pageWidth, pageHeight], 'landscape');
    }

    try {
      // Add the image to fill the entire page
      pdf.addImage(
        pageDataUrl,
        'PNG',
        0, // x position
        0, // y position
        pageWidth, // width
        pageHeight, // height
        undefined, // alias
        'FAST' // compression
      );
    } catch (error) {
      console.error(`[PDF Export] Failed to add page ${i}:`, error);
      throw new Error(`Failed to add page ${i} to PDF`);
    }
  }

  // Generate filename
  const sanitizedTitle = bookTitle
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${sanitizedTitle}_${timestamp}.pdf`;

  console.log(`[PDF Export] Saving as ${filename}`);

  // Save the PDF
  pdf.save(filename);

  console.log(`[PDF Export] ✅ Export complete`);
}

/**
 * Export book pages with metadata (title page, page numbers, etc.)
 *
 * @param bookData - Full book data including pages and metadata
 */
export async function exportFullBookToPDF(bookData: {
  title: string;
  author?: string;
  pages: { dataUrl: string; narration: string }[];
  babyName?: string;
  includeBleed?: boolean;
}): Promise<void> {
  const { title, pages, includeBleed = true } = bookData;

  console.log(`[PDF Export] Exporting full book: "${title}"`);
  console.log(`[PDF Export] Total pages: ${pages.length}`);

  // Extract just the data URLs
  const pageDataUrls = pages
    .map(p => p.dataUrl)
    .filter(url => url && url.length > 0);

  if (pageDataUrls.length === 0) {
    throw new Error('No pages to export');
  }

  await exportBookToPDF(pageDataUrls, title, includeBleed);
}

/**
 * Estimate PDF file size
 *
 * @param pages - Array of page image data URLs
 * @returns Estimated size in MB
 */
export function estimatePDFSize(pages: string[]): number {
  let totalBytes = 0;

  for (const pageDataUrl of pages) {
    if (!pageDataUrl) continue;

    // Remove data URL prefix to get just the base64 data
    const base64Data = pageDataUrl.replace(/^data:image\/\w+;base64,/, '');

    // Calculate approximate byte size
    // Base64 encoding increases size by ~4/3
    const bytes = (base64Data.length * 3) / 4;
    totalBytes += bytes;
  }

  // PDF has some overhead, add 10%
  const estimatedBytes = totalBytes * 1.1;

  // Convert to MB
  return estimatedBytes / (1024 * 1024);
}

/**
 * Validate pages before export
 *
 * @param pages - Array of page image data URLs
 * @returns Validation result
 */
export function validatePagesForExport(pages: string[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (pages.length === 0) {
    errors.push('No pages provided');
  }

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    if (!page || page.length === 0) {
      warnings.push(`Page ${i + 1} is empty`);
      continue;
    }

    if (!page.startsWith('data:image/')) {
      errors.push(`Page ${i + 1} is not a valid image data URL`);
    }

    // Check approximate size (warn if > 5MB per page)
    const base64Data = page.replace(/^data:image\/\w+;base64,/, '');
    const bytes = (base64Data.length * 3) / 4;
    const megabytes = bytes / (1024 * 1024);

    if (megabytes > 5) {
      warnings.push(`Page ${i + 1} is very large (${megabytes.toFixed(1)}MB)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
